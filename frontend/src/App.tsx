import React, { useState, useEffect, useRef } from 'react';
import { Send, Calendar as CalendarIcon, Download, MapPin, Loader2 } from 'lucide-react';
import { cn } from './lib/utils';

// API base URL
const API_BASE = 'http://localhost:8787/api';

type Message = {
  role: 'user' | 'model';
  content: string;
}

type Itinerary = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  items: {
    day_number: number;
    time_slot: string;
    title: string;
    description: string;
    category: string;
  }[];
}

function App() {
  const [sessionId] = useState(() => {
    let id = localStorage.getItem('travel_session_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('travel_session_id', id);
    }
    return id;
  });

  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: 'Halo! Mau liburan ke mana dan untuk berapa hari? Ceritakan juga gaya liburan atau budget-mu!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetchItinerary();
  }, []);

  const fetchItinerary = async () => {
    try {
      const res = await fetch(`${API_BASE}/itinerary/${sessionId}`);
      const data = await res.json();
      if (data.data) {
        setItinerary(data.data);
      }
    } catch (e) {
      console.error('Error fetching itinerary', e);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }, { role: 'model', content: '' }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: userMsg })
      });

      if (!res.ok) throw new Error('API Error');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      
      let shouldRefetchItinerary = false;

      while (reader && !done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (dataStr === '[DONE]') {
                break;
              }
              if (!dataStr) continue;
              
              try {
                const data = JSON.parse(dataStr);
                if (data.type === 'text') {
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1].content += data.text;
                    return newMsgs;
                  });
                } else if (data.type === 'function_call' && data.name === 'build_itinerary') {
                  shouldRefetchItinerary = true;
                }
              } catch (err) {
                // Ignore parse error on partial chunks
              }
            }
          }
        }
      }

      if (shouldRefetchItinerary) {
        await fetchItinerary();
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1].content = 'Maaf, terjadi kesalahan koneksi. Silakan periksa apakah server menyala.';
        return newMsgs;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportICS = () => {
    if (!itinerary) return;
    
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AI Travel Planner//ID'
    ];

    const startDate = new Date(itinerary.start_date || new Date().toISOString());

    itinerary.items.forEach((item, index) => {
      const itemDate = new Date(startDate);
      itemDate.setDate(itemDate.getDate() + (item.day_number - 1));
      
      const dtStart = itemDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dtEnd = dtStart; // Simple all-day or same time for MVP

      icsContent.push(
        'BEGIN:VEVENT',
        `UID:event-${index}@aitravelplanner`,
        `DTSTAMP:${dtStart}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${item.title} (${item.time_slot})`,
        `DESCRIPTION:${item.description || ''}`,
        'END:VEVENT'
      );
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `itinerary-${itinerary.destination.toLowerCase().replace(/\s+/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const groupedItems = itinerary?.items?.reduce((acc, item) => {
    if (!acc[item.day_number]) acc[item.day_number] = [];
    acc[item.day_number].push(item);
    return acc;
  }, {} as Record<number, typeof itinerary.items>) || {};

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <div className="w-1/3 min-w-[350px] border-r border-border bg-card flex flex-col shadow-sm z-10 print:hidden">
        <div className="p-4 border-b border-border bg-muted/20">
          <h1 className="text-xl font-bold tracking-tight">AI Travel Planner</h1>
          <p className="text-sm text-muted-foreground">Rencanakan liburan idamanmu!</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={cn(
                "p-3 rounded-xl max-w-[85%] text-sm leading-relaxed",
                msg.role === 'model' 
                  ? "bg-muted text-foreground self-start rounded-tl-sm" 
                  : "bg-primary text-primary-foreground self-end rounded-tr-sm shadow-sm"
              )}
            >
              {msg.role === 'model' && msg.content === '' ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin opacity-50" />
                  <span className="opacity-50">Mengetik...</span>
                </div>
              ) : (
                msg.content
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-border bg-card">
          <form className="flex gap-2" onSubmit={handleSend}>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Ketik tujuan atau preferensimu..." 
              className="flex-1 bg-background border border-input rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="bg-primary text-primary-foreground p-2 aspect-square rounded-full flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      <div className="flex-1 bg-slate-50/50 p-6 overflow-y-auto print:bg-white print:p-0">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <div className="flex items-center justify-between print:hidden">
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MapPin className="w-6 h-6 text-primary" />
              {itinerary ? `Trip ke ${itinerary.destination}` : 'Rencana Perjalanan'}
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 border border-border bg-background px-3 py-1.5 rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors" 
                disabled={!itinerary}
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button 
                onClick={handleExportICS}
                className="flex items-center gap-2 border border-border bg-background px-3 py-1.5 rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors" 
                disabled={!itinerary}
              >
                <CalendarIcon className="w-4 h-4" />
                Add to Calendar
              </button>
            </div>
          </div>
          
          {!itinerary ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-white/50">
              <CalendarIcon className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium text-foreground mb-1">Belum ada Itinerary</p>
              <p className="text-sm max-w-sm">Ngobrol dengan AI di panel kiri untuk mulai menyusun rencana perjalananmu! Kami akan memandu langkah demi langkah.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8 pb-10" id="itinerary-content">
              {itinerary.start_date && itinerary.end_date && (
                <div className="bg-primary/5 border border-primary/20 text-primary-foreground p-4 rounded-xl flex gap-4 text-sm font-medium text-foreground">
                   <span>Mulai: {itinerary.start_date}</span>
                   <span>•</span>
                   <span>Selesai: {itinerary.end_date}</span>
                </div>
              )}

              {Object.keys(groupedItems).sort((a,b) => Number(a)-Number(b)).map(day => (
                <div key={day} className="flex flex-col gap-4 relative">
                  <h3 className="text-lg font-bold sticky top-0 bg-slate-50/90 py-2 backdrop-blur-sm z-10">
                    Hari ke-{day}
                  </h3>
                  <div className="flex flex-col gap-3 pl-2 border-l-2 border-primary/20 ml-2">
                    {groupedItems[Number(day)].map((item, idx) => (
                      <div key={idx} className="relative bg-background border border-border p-4 rounded-xl shadow-sm ml-6 hover:shadow-md transition-shadow">
                        <div className="absolute -left-[35px] top-4 w-4 h-4 bg-primary rounded-full border-4 border-slate-50" />
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <h4 className="font-semibold text-base">{item.title}</h4>
                          <span className="text-xs font-medium bg-muted px-2 py-1 rounded-md whitespace-nowrap">
                            {item.time_slot}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        )}
                        {item.category && (
                          <span className="inline-block mt-3 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {item.category}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
