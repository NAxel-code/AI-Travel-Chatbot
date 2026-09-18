import { Context } from 'hono'
import { GoogleGenAI } from '@google/genai'
import { buildItineraryDeclaration, systemPrompt } from './ai'

// Ordered by preference. If one is overloaded (503) or unavailable (404),
// we fall through to the next.
const MODEL_CANDIDATES = [
  'gemini-3.6-flash',
  'gemini-3-flash-preview',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
]

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('overloaded')
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

// Try each candidate model; on a retryable (503) error, retry the same model
// briefly, then move on to the next candidate. Returns the stream and the
// model that succeeded.
async function startStreamWithFallback(
  ai: GoogleGenAI,
  contents: any,
) {
  let lastErr: unknown = null
  for (const model of MODEL_CANDIDATES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const stream = await ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: [{ functionDeclarations: [buildItineraryDeclaration] }],
          },
        })
        return { stream, model }
      } catch (err) {
        lastErr = err
        if (isRetryable(err) && attempt === 0) {
          await sleep(800)
          continue // retry same model once
        }
        break // non-retryable or exhausted retries -> next model
      }
    }
  }
  throw lastErr
}

export async function chatHandler(c: Context) {
  const { session_id, message } = await c.req.json()
  if (!session_id || !message) {
    return c.json({ error: 'Missing session_id or message' }, 400)
  }

  if (!c.env.GEMINI_API_KEY || c.env.GEMINI_API_KEY.startsWith('PASTE_')) {
    return c.json({ error: 'GEMINI_API_KEY is not configured. Edit backend/.dev.vars, set a real GEMINI_API_KEY, and restart wrangler.' }, 500)
  }

  const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY })
  
  // Get chat history from KV
  let historyStr = await c.env.CHAT_HISTORY.get(`session:${session_id}`)
  let history: { role: string, content: string }[] = historyStr ? JSON.parse(historyStr) : []
  
  history.push({ role: 'user', content: message })

  const contents = history.map(msg => ({
    role: msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }))

  try {
    const { stream: responseStream, model: activeModel } = await startStreamWithFallback(ai, contents)

    let isFunctionCall = false;
    let fullText = "";

    return new Response(new ReadableStream({
      async start(controller) {
        let functionCallResolved = false;

        for await (const chunk of responseStream) {
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            isFunctionCall = true;
            const call = chunk.functionCalls[0];
            const args = call.args as any;
            const itineraryId = crypto.randomUUID();
            
            // Insert into D1 DB
            await c.env.DB.prepare(`INSERT OR IGNORE INTO sessions (id, created_at) VALUES (?, ?)`)
              .bind(session_id, Date.now()).run();
              
            await c.env.DB.prepare(`INSERT INTO itineraries (id, session_id, destination, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
              .bind(itineraryId, session_id, args.destination, args.start_date, args.end_date, Date.now()).run();
            
            for (const item of (args.items || [])) {
              await c.env.DB.prepare(`INSERT INTO itinerary_items (id, itinerary_id, day_number, time_slot, title, description, category) VALUES (?, ?, ?, ?, ?, ?, ?)`)
                .bind(crypto.randomUUID(), itineraryId, item.day_number, item.time_slot, item.title, item.description, item.category).run();
            }

            const sseMessage = `data: {"type": "function_call", "name": "build_itinerary", "status": "success"}\n\n`
            controller.enqueue(new TextEncoder().encode(sseMessage));
            
            // Get final text response from Gemini after function call
            const confirmationResponse = await ai.models.generateContent({
              model: activeModel,
              contents: [
                ...contents,
                { role: 'model', parts: [{ functionCall: call }] },
                { role: 'user', parts: [{ functionResponse: { name: 'build_itinerary', response: { status: 'success' } } }] }
              ]
            })
            
            fullText = confirmationResponse.text || "Itinerary berhasil disusun!";
            const textMsg = `data: {"type": "text", "text": ${JSON.stringify(fullText)}}\n\n`
            controller.enqueue(new TextEncoder().encode(textMsg));
            functionCallResolved = true;
            break;
            
          } else if (chunk.text) {
            fullText += chunk.text;
            const textMsg = `data: {"type": "text", "text": ${JSON.stringify(chunk.text)}}\n\n`
            controller.enqueue(new TextEncoder().encode(textMsg));
          }
        }
        
        // Save new history
        history.push({ role: 'model', content: fullText });
        if(history.length > 20) history = history.slice(history.length - 20);
        await c.env.CHAT_HISTORY.put(`session:${session_id}`, JSON.stringify(history));

        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      }
    }), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error(error);
    const detail = error instanceof Error ? error.message : String(error)
    return c.json({ error: 'Internal Server Error', detail }, 500);
  }
}
