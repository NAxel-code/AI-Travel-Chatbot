import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import {
  X,
  MessageSquare,
  MapPin,
  Wallet,
  FileText,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Compass,
  ArrowRight,
  Lightbulb,
} from 'lucide-react'

type TutorialModalProps = {
  isOpen: boolean
  onClose: () => void
  onSelectPrompt?: (prompt: string) => void
}

type Step = {
  id: number
  title: string
  badge: string
  Icon: ComponentType<{ className?: string }>
  headline: string
  description: string
  highlightTips: string[]
  previewBg: string
  previewIconBg: string
}

const STEPS: Step[] = [
  {
    id: 1,
    title: 'Chat AI Pintar',
    badge: 'Langkah 1',
    Icon: MessageSquare,
    headline: 'Ceritakan rencana liburanmu dengan gaya percakapan',
    description:
      'Cukup sebutkan kota tujuan, durasi hari, dan gaya travelingmu. AI Rute otomatis memvalidasi tempat nyata lewat OpenStreetMap dan memeriksa perkiraan cuaca.',
    highlightTips: [
      'Sebutkan budget: misal “budget hemat ala backpacker” atau “hotel bintang 4”.',
      'Sebutkan preferensi: “suka pantai tenang”, “kuliner malam halal”, atau “liburan bareng anak kecil”.',
      'Pilih salah satu kartu prompt kilat di awal jika belum punya ide.',
    ],
    previewBg: 'from-teal-500/10 via-teal-500/5 to-transparent',
    previewIconBg: 'bg-teal-700 text-white',
  },
  {
    id: 2,
    title: 'Jadwal & Peta',
    badge: 'Langkah 2',
    Icon: MapPin,
    headline: 'Jadwal terpadu per hari dan rute interaktif di peta',
    description:
      'Setelah AI menyusun rencana, panel kanan (atau tab Menu di HP) menampilkan jadwal terstruktur lengkap dengan jam aktivitas dan sebaran pin geografis.',
    highlightTips: [
      'Klik tab "Peta" untuk melihat jalur rute dan lokasi wisata terdekat.',
      'Klik kartu hari untuk fokus ke aktivitas hari tersebut.',
      'Ingin ubah satu hari saja? Klik "Sesuaikan Hari" atau minta di chat tanpa mengulang seluruh itinerary.',
    ],
    previewBg: 'from-amber-500/10 via-amber-500/5 to-transparent',
    previewIconBg: 'bg-amber-600 text-white',
  },
  {
    id: 3,
    title: 'Estimasi Biaya',
    badge: 'Langkah 3',
    Icon: Wallet,
    headline: 'Transparansi anggaran sebelum kamu berangkat',
    description:
      'Buka tab "Biaya" untuk melihat estimasi pengeluaran per kategori yang terhitung otomatis berdasarkan durasi dan destinasi perjalanan.',
    highlightTips: [
      'Rincian kategori: Transportasi & sewa kendaraan, Makan 3x sehari, Tiket masuk wisata, dan Penginapan.',
      'Dapat dijadikan acuan tabungan dan alokasi bujet bersama teman perjalanan.',
      'Tips hemat lokal disematkan untuk menekan biaya yang tidak perlu.',
    ],
    previewBg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    previewIconBg: 'bg-emerald-700 text-white',
  },
  {
    id: 4,
    title: 'Ekspor & Checklist',
    badge: 'Langkah 4',
    Icon: FileText,
    headline: 'Unduh laporan PDF, kalender HP, dan checklist koper',
    description:
      'Semua hasil perencanaan bisa langsung kamu bawa saat traveling offline tanpa khawatir kehilangan sinyal di perjalanan.',
    highlightTips: [
      'Laporan Lengkap (PDF): Dokumen rapi siap cetak berisi itinerary, kontak darurat, dan estimasi biaya.',
      'Kalender (.ics): Masukkan jadwal ke Google Calendar atau Apple Calendar ponselmu.',
      'Checklist Packing: Cek barang bawaan spesifik (pantai, gunung, dokumen penting) agar tidak ada yang tertinggal.',
    ],
    previewBg: 'from-sky-500/10 via-sky-500/5 to-transparent',
    previewIconBg: 'bg-teal-800 text-white',
  },
]

const PROMPT_IDEAS = [
  {
    tag: 'Populer',
    title: 'Liburan Santai Pulau & Pantai',
    prompt:
      'Buatkan itinerary santai 4 hari ke Belitung fokus pantai pasir putih, kuliner seafood lokal, dan island hopping hopping hopping, budget menengah.',
  },
  {
    tag: 'Budget Hemat',
    title: 'Wisata Kuliner & Sejarah Bandung',
    prompt:
      'Buatkan itinerary wisata kuliner dan budaya 2 hari 1 malam di Bandung akhir pekan, ramah kantong backpacker dengan sewa motor.',
  },
  {
    tag: 'Keluarga',
    title: 'Liburan Ramah Anak di Yogyakarta',
    prompt:
      'Buatkan itinerary 3 hari ke Yogyakarta untuk keluarga dengan anak kecil dan orang tua, rute tidak melelahkan, tempat adem dan ramah stroller.',
  },
  {
    tag: 'Eksplorasi Alam',
    title: 'Petualangan Alam Bromo & Malang',
    prompt:
      'Buatkan rencana petualangan 3 hari ke Bromo dan Malang, termasuk sunrise Bromo, air terjun Tumpak Sewu, dan wisata petik apel.',
  },
]

export function TutorialModal({ isOpen, onClose, onSelectPrompt }: TutorialModalProps) {
  const [activeTab, setActiveTab] = useState<'tour' | 'prompts'>('tour')
  const [currentStep, setCurrentStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  function handleFinish() {
    if (dontShowAgain) {
      try {
        localStorage.setItem('rute_has_seen_tutorial', 'true')
      } catch {
        // Ignore storage error
      }
    }
    onClose()
  }

  function handleUsePrompt(promptText: string) {
    if (dontShowAgain) {
      try {
        localStorage.setItem('rute_has_seen_tutorial', 'true')
      } catch {
        // Ignore storage error
      }
    }
    onClose()
    if (onSelectPrompt) {
      onSelectPrompt(promptText)
    }
  }

  const step = STEPS[currentStep]

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-stone-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-dialog-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleFinish()
      }}
    >
      <div className="animate-rise flex max-h-[90dvh] w-full max-w-2xl flex-col rounded-t-3xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/20 sm:rounded-3xl overflow-hidden dark:border-stone-800 dark:bg-[#141920] dark:text-stone-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 bg-stone-50/70 dark:border-stone-800/80 dark:bg-[#1a212b]">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-white shadow-xs dark:bg-teal-600">
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <h2 id="tutorial-dialog-title" className="font-display text-lg font-bold text-stone-900 dark:text-white leading-snug">
                Panduan Menggunakan Rute
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">Kuasai fitur perencanaan perjalanan dalam hitungan menit</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            className="grid h-9 w-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-200 hover:text-stone-700 dark:hover:bg-[#222c3a] dark:hover:text-stone-200"
            aria-label="Tutup panduan"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 bg-white px-5 pt-3 dark:border-stone-800 dark:bg-[#141920]">
          <button
            type="button"
            onClick={() => setActiveTab('tour')}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-xs sm:text-sm font-semibold transition ${
              activeTab === 'tour'
                ? 'border-teal-700 text-teal-800 dark:border-teal-400 dark:text-teal-300'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <span>Tur Cepat (4 Langkah)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prompts')}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-xs sm:text-sm font-semibold transition ${
              activeTab === 'prompts'
                ? 'border-teal-700 text-teal-800 dark:border-teal-400 dark:text-teal-300'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
            }`}
          >
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Contoh Prompt Siap Pakai</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="thin-scrollbar flex-1 overflow-y-auto p-5 sm:p-6">
          {activeTab === 'tour' ? (
            <div className="space-y-6">
              {/* Step indicator pills */}
              <div className="flex items-center justify-between gap-1 sm:gap-2">
                {STEPS.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentStep(idx)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-1 text-xs font-semibold transition ${
                      currentStep === idx
                        ? 'bg-teal-700 text-white shadow-xs dark:bg-teal-600'
                        : currentStep > idx
                        ? 'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60'
                        : 'bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-[#1a212b] dark:text-stone-400 dark:hover:bg-[#222c3a]'
                    }`}
                  >
                    <span>{idx + 1}.</span>
                    <span className="hidden md:inline truncate">{s.title}</span>
                  </button>
                ))}
              </div>

              {/* Active Step Card */}
              <div
                className={`relative overflow-hidden rounded-2xl border border-stone-200/90 bg-gradient-to-br ${step.previewBg} p-5 sm:p-6 dark:border-stone-800`}
              >
                <div className="flex items-start gap-4">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${step.previewIconBg} shadow-sm`}>
                    <step.Icon className="h-6 w-6" />
                  </span>
                  <div className="space-y-1">
                    <span className="inline-block rounded-md bg-stone-900/10 px-2 py-0.5 text-[10px] font-bold text-stone-800 uppercase tracking-wider dark:bg-white/10 dark:text-stone-200">
                      {step.badge}
                    </span>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-stone-900 dark:text-white">{step.headline}</h3>
                    <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed pt-1">{step.description}</p>
                  </div>
                </div>

                {/* Highlight Tips */}
                <div className="mt-5 space-y-2 rounded-xl bg-white/90 p-3.5 sm:p-4 border border-stone-200/60 shadow-xs dark:bg-[#1a212b]/95 dark:border-stone-800">
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                    <span>Tips Penting:</span>
                  </h4>
                  <ul className="space-y-1.5 text-xs text-stone-700 dark:text-stone-300">
                    {step.highlightTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600 dark:bg-teal-400" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3.5 text-xs text-amber-900 leading-relaxed dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-200">
                <span className="font-bold">Tips Berkomunikasi:</span> Semakin spesifik detail yang kamu ceritakan (jumlah hari, siapa yang ikut, budget, atau tempat favorit), semakin akurat itinerary yang dirancang Rute.
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {PROMPT_IDEAS.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-teal-700/40 hover:shadow-md hover:shadow-stone-900/5 dark:border-stone-800 dark:bg-[#1a212b] dark:hover:border-teal-500/40"
                  >
                    <div>
                      <span className="inline-block rounded-md bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 uppercase tracking-wide dark:bg-teal-950/60 dark:text-teal-300">
                        {item.tag}
                      </span>
                      <h4 className="mt-2 text-sm font-bold text-stone-900 dark:text-white">{item.title}</h4>
                      <p className="mt-1.5 text-xs text-stone-600 italic bg-stone-50 rounded-xl p-2.5 border border-stone-100 dark:bg-[#141920] dark:border-stone-800 dark:text-stone-300">
                        "{item.prompt}"
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUsePrompt(item.prompt)}
                      className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 py-2 px-3 text-xs font-semibold text-white transition hover:bg-teal-800 active:scale-95 dark:bg-teal-600 dark:hover:bg-teal-700"
                    >
                      <span>Gunakan Prompt Ini</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/60 px-5 py-3.5 dark:border-stone-800/80 dark:bg-[#1a212b]">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-600 cursor-pointer dark:border-stone-700 dark:bg-stone-800"
            />
            <span>Jangan tampilkan otomatis lagi</span>
          </label>

          <div className="flex items-center gap-2">
            {activeTab === 'tour' && currentStep > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition active:scale-95 dark:border-stone-700 dark:bg-[#141920] dark:text-stone-200 dark:hover:bg-[#222c3a]"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Sebelumnya</span>
              </button>
            )}

            {activeTab === 'tour' && currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="flex items-center gap-1 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 transition active:scale-95 shadow-xs dark:bg-teal-600 dark:hover:bg-teal-700"
              >
                <span>Lanjut</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2 text-xs font-bold text-white hover:bg-teal-800 transition active:scale-95 shadow-xs dark:bg-teal-600 dark:hover:bg-teal-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Mulai Rencanakan</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
