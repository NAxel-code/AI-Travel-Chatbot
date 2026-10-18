import { useEffect, useState, useRef, useCallback } from 'react'
import type { ComponentType } from 'react'
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Calendar,
  Wallet,
  MapPin,
  Share2,
} from 'lucide-react'
import { useLanguage } from '../lib/i18n'

export type TabType = 'chat' | 'overview' | 'map' | 'expenses'

export type TourStep = {
  id: string
  targetSelector: string
  tab?: TabType
  title: string
  description: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  Icon: ComponentType<{ className?: string }>
  badgeText?: string
}

export const SPOTLIGHT_STEPS: TourStep[] = [
  {
    id: 'composer',
    targetSelector: '[data-tour="chat-composer"]',
    tab: 'chat',
    placement: 'top',
    title: 'Konsultasi & Ceritakan Rencana Liburanmu',
    description:
      'Ketik destinasi, durasi hari, jumlah orang, dan gaya liburanmu di sini (misal: "Liburan 3 hari di Bali bareng teman budget 2 jutaan"). AI Rute otomatis mencocokkan tempat nyata dan cuaca terkini.',
    Icon: MessageSquare,
    badgeText: 'Langkah 1',
  },
  {
    id: 'workspace',
    targetSelector: '[data-tour="workspace-tabs"]',
    tab: 'overview',
    placement: 'bottom',
    title: 'Workspace Rencana Terpadu',
    description:
      'Setelah AI selesai merancang jadwal, panel kanan ini langsung menampilkan itinerary harian terstruktur lengkap dengan jam aktivitas, foto destinasi, dan rating lokasi.',
    Icon: Calendar,
    badgeText: 'Langkah 2',
  },
  {
    id: 'expenses',
    targetSelector: '[data-tour="tab-expenses"]',
    tab: 'expenses',
    placement: 'bottom',
    title: 'Kalkulator Biaya & Transparansi Anggaran',
    description:
      'Buka tab ini untuk melihat perkiraan biaya tiket PP, penginapan, sewa motor & BBM, makan 3x sehari, dan tiket wisata. Kamu bisa mengganti mode budget (Hemat/Standar/Nyaman) dan jumlah peserta secara instan.',
    Icon: Wallet,
    badgeText: 'Langkah 3',
  },
  {
    id: 'map',
    targetSelector: '[data-tour="tab-map"]',
    tab: 'map',
    placement: 'bottom',
    title: 'Peta Rute & Navigasi 1-Klik Google Maps',
    description:
      'Visualisasikan sebaran titik wisata harian dan jalur jalan secara geografis. Di setiap hari dan pin peta, ada tombol 1-klik untuk langsung membuka rute turn-by-turn di aplikasi Google Maps ponselmu.',
    Icon: MapPin,
    badgeText: 'Langkah 4',
  },
  {
    id: 'actions',
    targetSelector: '[data-tour="navbar-actions"]',
    placement: 'bottom',
    title: 'Bawa Rencana Traveling Offline',
    description:
      'Unduh dokumen resmi PDF siap cetak, simpan jadwal ke Google atau Apple Calendar (.ics), atau bagikan ringkasan rute langsung ke WhatsApp teman perjalananmu sebelum berangkat!',
    Icon: Share2,
    badgeText: 'Langkah 5',
  },
]

type SpotlightTourProps = {
  isOpen: boolean
  onClose: () => void
  activeTab?: TabType
  setActiveTab?: (tab: TabType) => void
}

type Rect = {
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
}

/* Hallmark · component: SpotlightTour · genre: editorial · theme: Sand & Sea (Dark & Light)
 * features: backdrop cutout · smooth element tracking · mobile auto-tab switch · keyboard navigation
 * contrast: pass (4.5:1+)
 */
export function SpotlightTour({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
}: SpotlightTourProps) {
  const { t } = useLanguage()

  const steps: TourStep[] = [
    {
      id: 'composer',
      targetSelector: '[data-tour="chat-composer"]',
      tab: 'chat',
      placement: 'top',
      title: t('spotlightStep1Title'),
      description: t('spotlightStep1Desc'),
      Icon: MessageSquare,
      badgeText: t('spotlightStepBadge', { step: 1 }),
    },
    {
      id: 'workspace',
      targetSelector: '[data-tour="workspace-tabs"]',
      tab: 'overview',
      placement: 'bottom',
      title: t('spotlightStep2Title'),
      description: t('spotlightStep2Desc'),
      Icon: Calendar,
      badgeText: t('spotlightStepBadge', { step: 2 }),
    },
    {
      id: 'expenses',
      targetSelector: '[data-tour="tab-expenses"]',
      tab: 'expenses',
      placement: 'bottom',
      title: t('spotlightStep3Title'),
      description: t('spotlightStep3Desc'),
      Icon: Wallet,
      badgeText: t('spotlightStepBadge', { step: 3 }),
    },
    {
      id: 'map',
      targetSelector: '[data-tour="tab-map"]',
      tab: 'map',
      placement: 'bottom',
      title: t('spotlightStep4Title'),
      description: t('spotlightStep4Desc'),
      Icon: MapPin,
      badgeText: t('spotlightStepBadge', { step: 4 }),
    },
    {
      id: 'actions',
      targetSelector: '[data-tour="navbar-actions"]',
      placement: 'bottom',
      title: t('spotlightStep5Title'),
      description: t('spotlightStep5Desc'),
      Icon: Share2,
      badgeText: t('spotlightStepBadge', { step: 5 }),
    },
  ]

  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 100, left: 100 })
  const popoverRef = useRef<HTMLDivElement>(null)

  const step = steps[currentStep]

  // Switch tab if step requires it (important for mobile split-screen)
  useEffect(() => {
    if (!isOpen || !step) return
    if (step.tab && activeTab !== step.tab && setActiveTab) {
      setActiveTab(step.tab)
    }
  }, [isOpen, currentStep, step, activeTab, setActiveTab])

  // Measure target element position
  const updatePositions = useCallback(() => {
    if (!isOpen || !step) return

    const el = document.querySelector(step.targetSelector)
    if (!el) {
      // Fallback center of screen
      const centerRect: Rect = {
        top: window.innerHeight / 2 - 40,
        left: window.innerWidth / 2 - 120,
        width: 240,
        height: 80,
        bottom: window.innerHeight / 2 + 40,
        right: window.innerWidth / 2 + 120,
      }
      setTargetRect(centerRect)
      return
    }

    const rect = el.getBoundingClientRect()
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    })

    // Scroll into view if out of viewport
    if (rect.top < 60 || rect.bottom > window.innerHeight - 60) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isOpen, step])

  useEffect(() => {
    if (!isOpen) return

    // Small delay to let tab switch / DOM render settle
    const timer = setTimeout(updatePositions, 80)
    window.addEventListener('resize', updatePositions)
    window.addEventListener('scroll', updatePositions, true)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updatePositions)
      window.removeEventListener('scroll', updatePositions, true)
    }
  }, [isOpen, currentStep, updatePositions])

  // Compute Popover Position relative to targetRect and viewport
  useEffect(() => {
    if (!targetRect || !popoverRef.current) return

    const popover = popoverRef.current
    const popoverWidth = popover.offsetWidth || 340
    const popoverHeight = popover.offsetHeight || 220
    const padding = 16
    const margin = 14

    let top = 0
    let left = 0

    const preferredPlacement = step.placement || 'bottom'

    if (preferredPlacement === 'top') {
      top = targetRect.top - popoverHeight - margin
      left = targetRect.left + (targetRect.width - popoverWidth) / 2
      // If overflowing above viewport, flip to bottom
      if (top < padding) {
        top = targetRect.bottom + margin
      }
    } else if (preferredPlacement === 'bottom') {
      top = targetRect.bottom + margin
      left = targetRect.left + (targetRect.width - popoverWidth) / 2
      // If overflowing below viewport, flip to top
      if (top + popoverHeight > window.innerHeight - padding) {
        top = targetRect.top - popoverHeight - margin
      }
    } else if (preferredPlacement === 'left') {
      top = targetRect.top + (targetRect.height - popoverHeight) / 2
      left = targetRect.left - popoverWidth - margin
    } else {
      top = targetRect.top + (targetRect.height - popoverHeight) / 2
      left = targetRect.right + margin
    }

    // Clamp inside viewport
    left = Math.max(padding, Math.min(window.innerWidth - popoverWidth - padding, left))
    top = Math.max(padding, Math.min(window.innerHeight - popoverHeight - padding, top))

    setPopoverPos({ top, left })
  }, [targetRect, step])

  const handleFinish = useCallback(() => {
    try {
      localStorage.setItem('rute_has_completed_spotlight', 'true')
    } catch {
      // Ignore storage error
    }
    onClose()
  }, [onClose])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleFinish()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStep < steps.length - 1) {
          setCurrentStep((prev) => prev + 1)
        } else {
          handleFinish()
        }
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        setCurrentStep((prev) => prev - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentStep, handleFinish, steps.length])

  function handleNext() {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      handleFinish()
    }
  }

  function handlePrev() {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  if (!isOpen) return null

  const cutoutPadding = 8

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tur panduan interaktif Rute"
      className="fixed inset-0 z-[10000] overflow-hidden select-none"
    >
      {/* Click blocker backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={handleFinish}
        title="Klik di luar untuk keluar dari tur panduan"
      />

      {/* Spotlight cutout highlight */}
      {targetRect && (
        <div
          style={{
            top: `${Math.max(0, targetRect.top - cutoutPadding)}px`,
            left: `${Math.max(0, targetRect.left - cutoutPadding)}px`,
            width: `${targetRect.width + cutoutPadding * 2}px`,
            height: `${targetRect.height + cutoutPadding * 2}px`,
            boxShadow: '0 0 0 9999px rgba(12, 15, 18, 0.76)',
          }}
          className="absolute rounded-2xl border-2 border-teal-400 dark:border-teal-400 ring-4 ring-teal-500/30 pointer-events-none transition-all duration-300 ease-out z-10"
        >
          {/* Glowing pulse beacon */}
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-teal-500 shadow-sm" />
          </span>
        </div>
      )}

      {/* Popover Card */}
      <div
        ref={popoverRef}
        style={{
          top: `${popoverPos.top}px`,
          left: `${popoverPos.left}px`,
        }}
        className="animate-rise absolute z-20 w-[calc(100vw-32px)] max-w-sm sm:max-w-md rounded-2xl border border-stone-200/90 bg-white p-5 shadow-2xl shadow-stone-900/30 dark:border-stone-800 dark:bg-[#141920] dark:text-stone-100 transition-all duration-300 ease-out pointer-events-auto"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800/80 pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-teal-700 text-white shadow-xs dark:bg-teal-600">
              <step.Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
                <Sparkles className="h-3 w-3" />
                {step.badgeText || `Langkah ${currentStep + 1}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
              {currentStep + 1} / {steps.length}
            </span>
            <button
              type="button"
              onClick={handleFinish}
              className="grid h-8 w-8 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-[#1e2733] dark:hover:text-stone-200 outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              title={t('spotlightSkip')}
              aria-label={t('spotlightSkip')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="py-3.5 space-y-1.5">
          <h3 className="font-display text-base font-bold text-stone-900 dark:text-stone-100 leading-snug">
            {step.title}
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Footer with Dots & Navigation Buttons */}
        <div className="flex items-center justify-between gap-2 border-t border-stone-100 dark:border-stone-800/80 pt-3">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(idx)}
                aria-label={`Step ${idx + 1}: ${s.title}`}
                className={`h-2 rounded-full transition-all duration-200 ${
                  currentStep === idx
                    ? 'w-6 bg-teal-700 dark:bg-teal-400'
                    : 'w-2 bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600'
                }`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {currentStep === 0 ? (
              <button
                type="button"
                onClick={handleFinish}
                className="px-2.5 py-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 transition"
              >
                {t('spotlightSkip')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center gap-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1a212b] px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#222c38] transition active:scale-95"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('spotlightPrev')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-teal-800 active:scale-95 shadow-xs transition dark:bg-teal-600 dark:hover:bg-teal-700"
            >
              <span>{currentStep === steps.length - 1 ? t('spotlightFinish') : t('spotlightNext')}</span>
              {currentStep === steps.length - 1 ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
