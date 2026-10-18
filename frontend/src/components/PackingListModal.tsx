import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import {
  X,
  CheckCircle2,
  RotateCcw,
  Luggage,
  CreditCard,
  Shirt,
  Smartphone,
  Palmtree,
  Mountain,
  Compass,
} from 'lucide-react'
import { useLanguage } from '../lib/i18n'

type PackingCategory = {
  id: string
  title: string
  Icon: ComponentType<{ className?: string }>
  items: string[]
}

type PackingListModalProps = {
  isOpen: boolean
  onClose: () => void
  destination?: string
  dayCount?: number
}

function getPackingCategories(destination = 'Indonesia', lang: 'id' | 'en' = 'id'): PackingCategory[] {
  const destLower = destination.toLowerCase()
  const isIslandOrBeach =
    destLower.includes('bajo') ||
    destLower.includes('bali') ||
    destLower.includes('lombok') ||
    destLower.includes('raja ampat') ||
    destLower.includes('pantai') ||
    destLower.includes('beach') ||
    destLower.includes('island')

  const isHighlandOrCold =
    destLower.includes('bromo') ||
    destLower.includes('bandung') ||
    destLower.includes('dieng') ||
    destLower.includes('malang') ||
    destLower.includes('gunung') ||
    destLower.includes('mountain') ||
    destLower.includes('highland')

  const destinationItems: string[] = []
  if (lang === 'en') {
    if (isIslandOrBeach) {
      destinationItems.push(
        'Dry bag (10L / 20L) for island hopping / canoeing',
        'Waterproof phone pouch',
        'Water shoes / anti-slip reef sandals',
        'Personal snorkel mask / goggles',
        'Motion sickness medication (dimenhydrinate)',
      )
    } else if (isHighlandOrCold) {
      destinationItems.push(
        'Heavy jacket / windproof windbreaker',
        'Beanie & warm scarf',
        'Warm thermal gloves',
        'Face mask / volcanic dust protection',
        'Warming eucalyptus balm / oil',
      )
    } else {
      destinationItems.push(
        'Compact travel umbrella / disposable raincoat',
        'Reusable tote bag for shopping & souvenirs',
        'Personal water bottle / tumbler',
        'Sun hat / baseball cap',
      )
    }

    return [
      {
        id: 'docs',
        title: 'Documents & Money',
        Icon: CreditCard,
        items: [
          'Passport / ID card & digital copy on phone',
          'Flight tickets / boarding pass & hotel vouchers',
          'Small cash bills (for parking, local street food & tips)',
          'Debit / ATM cards & Credit cards',
          'Travel health insurance card',
        ],
      },
      {
        id: 'clothes',
        title: 'Clothing & Apparel',
        Icon: Shirt,
        items: [
          'Casual clothes / breathable cotton t-shirts',
          'Shorts & lightweight long trousers',
          'Sleepwear / pajamas',
          'Swimwear / quick-dry apparel',
          'Light jacket / cardigan for flight & AC transit',
          'Flip-flops & comfortable walking sneakers',
          'Sunglasses (UV protection) & sun hat',
        ],
      },
      {
        id: 'gadgets',
        title: 'Gadgets & Personal Health',
        Icon: Smartphone,
        items: [
          'Power bank (min 10,000 mAh) & charging cables',
          'Face & body sunscreen (SPF 50+ PA++++)',
          'Aloe vera gel / soothing lotion after sun exposure',
          'Personal medications, cold medicine & paracetamol',
          'Adhesive bandages & eye drops',
          'Hand sanitizer & wet / dry tissues',
        ],
      },
      {
        id: 'destination',
        title: `Destination Specific (${destination})`,
        Icon: isIslandOrBeach ? Palmtree : isHighlandOrCold ? Mountain : Compass,
        items: destinationItems,
      },
    ]
  }

  // Indonesian fallback
  if (isIslandOrBeach) {
    destinationItems.push(
      'Dry bag (10L / 20L) untuk island hopping / kano',
      'Waterproof pouch HP (kantong anti air)',
      'Water shoes / sandal anti licin karang',
      'Kacamata snorkel / goggles pribadi',
      'Obat anti mabuk laut (dimenhydrinate)',
    )
  } else if (isHighlandOrCold) {
    destinationItems.push(
      'Jaket tebal / windbreaker tahan angin',
      'Kupluk rajut / beanie & syal',
      'Sarung tangan hangat',
      'Masker kain / pelindung debu pasir vulkanik',
      'Balsem / minyak kayu putih hangat',
    )
  } else {
    destinationItems.push(
      'Payung lipat kecil / jas hujan sekali pakai',
      'Tas kain lipat cadangan untuk belanja / oleh-oleh',
      'Tumbler / botol minum pribadi',
      'Topi pelindung terik matahari',
    )
  }

  return [
    {
      id: 'docs',
      title: 'Dokumen & Finansial',
      Icon: CreditCard,
      items: [
        'KTP asli & salinan foto digital di HP',
        'Tiket pesawat / boarding pass & voucher hotel',
        'Uang tunai pecahan kecil (Rp 5rb, 10rb, 20rb untuk parkir & tips)',
        'Kartu Debit / ATM & Kartu Kredit',
        'Kartu BPJS Kesehatan / Asuransi perjalanan',
      ],
    },
    {
      id: 'clothes',
      title: 'Pakaian & Outfit',
      Icon: Shirt,
      items: [
        'Baju santai / kaos katun nyaman (sesuai jumlah hari)',
        'Celana pendek & celana panjang ringan',
        'Pakaian tidur / piyama',
        'Baju renang / pakaian cepat kering (quick-dry)',
        'Outer tipis / jaket ringan untuk AC pesawat / mobil',
        'Sandal santai & sepatu jalan / sneakers nyaman',
        'Kacamata hitam (UV protection) & topi',
      ],
    },
    {
      id: 'gadgets',
      title: 'Gadget & Kesehatan Pribadi',
      Icon: Smartphone,
      items: [
        'Powerbank (minimal 10.000 mAh) & kabel charger',
        'Sunscreen wajah & badan (SPF 50+ PA++++)',
        'Aloe vera gel / soothing lotion setelah panas-panasan',
        'Obat-obatan pribadi, obat flu, parasetamol & tolak angin',
        'Plester luka (hansaplast) & obat tetes mata',
        'Hand sanitizer & tisu basah / tisu kering',
      ],
    },
    {
      id: 'destination',
      title: `Khusus Destinasi (${destination})`,
      Icon: isIslandOrBeach ? Palmtree : isHighlandOrCold ? Mountain : Compass,
      items: destinationItems,
    },
  ]
}

export function PackingListModal({
  isOpen,
  onClose,
  destination = 'Wisata',
  dayCount = 3,
}: PackingListModalProps) {
  const { lang } = useLanguage()
  const storageKey = `travel_packing_checked_v2:${destination.toLowerCase()}`
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}
    } catch {
      return {}
    }
  })

  const categories = getPackingCategories(destination, lang)
  const allItems = categories.flatMap((c) => c.items)
  const totalItems = allItems.length
  const completedCount = allItems.filter((it) => Boolean(checkedItems[it])).length
  const percent = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(checkedItems))
    } catch {
      // Ignore storage errors
    }
  }, [checkedItems, storageKey])

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  function toggleItem(item: string) {
    setCheckedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }))
  }

  function handleReset() {
    const confirmMsg =
      lang === 'id'
        ? 'Reset semua centang pada checklist bawaan ini?'
        : 'Reset all checked items in this packing list?'
    if (window.confirm(confirmMsg)) {
      setCheckedItems({})
      localStorage.removeItem(storageKey)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="packing-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-900/60 dark:bg-black/75 p-3 sm:p-4 backdrop-blur-xs"
    >
      <div className="animate-rise relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white dark:border-stone-800 dark:bg-[#141920] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-800 border border-teal-100 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800/60">
              <Luggage className="h-5 w-5" />
            </span>
            <div>
              <h2 id="packing-title" className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
                {lang === 'id' ? 'Checklist Bawaan Traveler' : 'Traveler Packing Checklist'}
              </h2>
              <p className="text-xs text-stone-600 dark:text-stone-400 font-medium">
                {lang === 'id'
                  ? `Perlengkapan siap berangkat ke ${destination} (${dayCount} Hari)`
                  : `Ready-to-pack gear for ${destination} (${dayCount} Days)`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200 outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            aria-label={lang === 'id' ? 'Tutup checklist' : 'Close checklist'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-stone-50 dark:bg-[#18202a] px-5 py-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-stone-700 dark:text-stone-300">
              {lang === 'id'
                ? `${completedCount} dari ${totalItems} barang siap (${percent}%)`
                : `${completedCount} of ${totalItems} items ready (${percent}%)`}
            </span>
            {percent === 100 ? (
              <span className="flex items-center gap-1 font-bold text-teal-800 dark:text-teal-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                {lang === 'id' ? 'Siap Berangkat!' : 'Ready to Depart!'}
              </span>
            ) : (
              <span className="text-stone-500 dark:text-stone-400 text-[11px]">
                {lang === 'id' ? `Tersisa ${totalItems - completedCount} barang` : `${totalItems - completedCount} items remaining`}
              </span>
            )}
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={lang === 'id' ? 'Progress kelengkapan barang' : 'Packing list progress'}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
          >
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                percent === 100 ? 'bg-teal-600 dark:bg-teal-500' : 'bg-teal-700 dark:bg-teal-400'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Categories List */}
        <div className="thin-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
          {categories.map((cat) => {
            const catDone = cat.items.filter((it) => Boolean(checkedItems[it])).length
            const Icon = cat.Icon
            return (
              <div key={cat.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                    <Icon className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                    <span>{cat.title}</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                    {catDone}/{cat.items.length}
                  </span>
                </div>
                <div className="space-y-1.5 rounded-xl border border-stone-200/80 bg-white dark:border-stone-800 dark:bg-[#18202a] p-2">
                  {cat.items.map((item) => {
                    const isChecked = Boolean(checkedItems[item])
                    return (
                      <label
                        key={item}
                        className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-xs transition outline-none focus-within:ring-2 focus-within:ring-teal-700/60 ${
                          isChecked
                            ? 'bg-teal-50/40 text-stone-400 line-through dark:bg-teal-950/20 dark:text-stone-500'
                            : 'text-stone-800 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-[#1f2937]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItem(item)}
                          className="h-4 w-4 rounded border-stone-300 dark:border-stone-700 dark:bg-stone-800 text-teal-700 focus:ring-teal-600 cursor-pointer"
                        />
                        <span className="flex-1 select-none">{item}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 dark:border-stone-800/80 bg-white dark:bg-[#141920] px-5 py-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-400 transition outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{lang === 'id' ? 'Reset Centang' : 'Reset Checked'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-teal-800 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 shadow-xs"
          >
            {lang === 'id' ? 'Selesai' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  )
}
