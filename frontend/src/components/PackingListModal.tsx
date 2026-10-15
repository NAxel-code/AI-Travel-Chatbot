import { useEffect, useState } from 'react'
import { X, CheckCircle2, RotateCcw, Luggage } from 'lucide-react'

type PackingCategory = {
  id: string
  title: string
  icon: string
  items: string[]
}

type PackingListModalProps = {
  isOpen: boolean
  onClose: () => void
  destination?: string
  dayCount?: number
}

function getPackingCategories(destination = 'Indonesia'): PackingCategory[] {
  const destLower = destination.toLowerCase()
  const isIslandOrBeach =
    destLower.includes('bajo') ||
    destLower.includes('bali') ||
    destLower.includes('lombok') ||
    destLower.includes('raja ampat') ||
    destLower.includes('pantai')

  const isHighlandOrCold =
    destLower.includes('bromo') ||
    destLower.includes('bandung') ||
    destLower.includes('dieng') ||
    destLower.includes('malang') ||
    destLower.includes('gunung')

  const destinationItems: string[] = []
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
      icon: '💳',
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
      icon: '👕',
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
      icon: '📱',
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
      icon: '🏝️',
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
  const storageKey = `travel_packing_checked_v2:${destination.toLowerCase()}`
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}
    } catch {
      return {}
    }
  })

  const categories = getPackingCategories(destination)
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

  if (!isOpen) return null

  function toggleItem(item: string) {
    setCheckedItems((prev) => ({
      ...prev,
      [item]: !prev[item],
    }))
  }

  function handleReset() {
    if (window.confirm('Reset semua centang pada checklist bawaan ini?')) {
      setCheckedItems({})
      localStorage.removeItem(storageKey)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="packing-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-3 sm:p-4 backdrop-blur-sm"
    >
      <div className="animate-rise relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-50 text-teal-800">
              <Luggage className="h-5 w-5" />
            </span>
            <div>
              <h2 id="packing-title" className="font-display text-lg font-bold text-stone-900">
                Checklist Bawaan Traveler
              </h2>
              <p className="text-xs text-stone-500">
                Perlengkapan siap berangkat ke {destination} ({dayCount} Hari)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-100">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-stone-700">
              {completedCount} dari {totalItems} barang siap ({percent}%)
            </span>
            {percent === 100 ? (
              <span className="flex items-center gap-1 text-teal-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> Siap Berangkat!
              </span>
            ) : (
              <span className="text-stone-400 text-[11px]">Tersisa {totalItems - completedCount} barang</span>
            )}
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                percent === 100 ? 'bg-teal-600' : 'bg-teal-700'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Categories List */}
        <div className="thin-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
          {categories.map((cat) => {
            const catDone = cat.items.filter((it) => Boolean(checkedItems[it])).length
            return (
              <div key={cat.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-stone-800 uppercase tracking-wider">
                    <span>{cat.icon}</span>
                    <span>{cat.title}</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-stone-500">
                    {catDone}/{cat.items.length}
                  </span>
                </div>
                <div className="space-y-1.5 rounded-2xl border border-stone-200/80 bg-white p-2">
                  {cat.items.map((item) => {
                    const isChecked = Boolean(checkedItems[item])
                    return (
                      <label
                        key={item}
                        className={`flex min-h-[38px] cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 text-xs transition ${
                          isChecked ? 'bg-teal-50/50 text-stone-400 line-through' : 'text-stone-800 hover:bg-stone-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItem(item)}
                          className="h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-600 cursor-pointer"
                        />
                        <span className="flex-1">{item}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-stone-100 bg-white px-5 py-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-rose-600 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Centang</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-teal-700 px-5 py-2 text-xs font-bold text-white transition hover:bg-teal-800 active:scale-[0.98]"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  )
}
