import { DollarSign, PieChart, Car, Utensils, Ticket, BedDouble, AlertCircle } from 'lucide-react'
import type { ItineraryItem } from './DayCard'

type ExpensesViewProps = {
  destination: string
  items: ItineraryItem[]
  dayCount: number
}

export function ExpensesView({ destination, items, dayCount }: ExpensesViewProps) {
  // Compute categorized estimated costs based on items
  const mealCount = items.filter((it) => 
    /makan|lunch|dinner|sarapan|cafe|warung|kuliner|resto/i.test(`${it.title} ${it.category || ''}`)
  ).length || Math.max(dayCount * 3, 3)

  const attractionCount = items.filter((it) => 
    /pantai|beach|pura|temple|candi|museum|waterfall|curug|taman|park/i.test(`${it.title} ${it.category || ''}`)
  ).length || Math.max(items.length - 2, 2)

  // Realistic average estimates in IDR
  const estTransportPerDay = 150000 // Sewa motor / transport harian
  const estMealAvg = 60000 // Per porsi makan lokal / cafe
  const estAttractionAvg = 45000 // Tiket masuk rata-rata
  const estHotelPerNight = 350000 // Hotel nyaman / homestay

  const totalTransport = estTransportPerDay * Math.max(dayCount, 1)
  const totalMeals = estMealAvg * mealCount
  const totalAttractions = estAttractionAvg * attractionCount
  const totalHotel = estHotelPerNight * Math.max(dayCount - 1, 1)
  const grandTotal = totalTransport + totalMeals + totalAttractions + totalHotel
  const dailyAverage = Math.round(grandTotal / Math.max(dayCount, 1))

  const formatIdr = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

  const categories = [
    {
      name: 'Penginapan (Hotel / Villa)',
      amount: totalHotel,
      icon: BedDouble,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-400',
      detail: `${Math.max(dayCount - 1, 1)} malam × ${formatIdr(estHotelPerNight)}`,
    },
    {
      name: 'Kuliner & Makan',
      amount: totalMeals,
      icon: Utensils,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      detail: `${mealCount} kali makan/ngopi × ~${formatIdr(estMealAvg)}`,
    },
    {
      name: 'Transportasi Lokal',
      amount: totalTransport,
      icon: Car,
      color: 'bg-amber-500',
      textColor: 'text-amber-400',
      detail: `${dayCount} hari sewa/kendaraan lokal`,
    },
    {
      name: 'Tiket Wisata & Aktivitas',
      amount: totalAttractions,
      icon: Ticket,
      color: 'bg-rose-500',
      textColor: 'text-rose-400',
      detail: `${attractionCount} destinasi/objek wisata terdaftar`,
    },
  ]

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[#151b23] p-5 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Total Perkiraan Biaya</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-white tracking-tight">
            {formatIdr(grandTotal)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Estimasi untuk {dayCount} hari perjalanan di {destination}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#151b23] p-5 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Rata-Rata Per Hari</span>
            <PieChart className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-400 tracking-tight">
            {formatIdr(dailyAverage)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Pengeluaran harian ideal (all-in)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#151b23] p-5 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Status Anggaran</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
              Optimal
            </span>
          </div>
          <div className="mt-3 text-xl font-bold text-slate-200">
            Mid-Range Smart
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Kombinasi kuliner autentik & destinasi favorit
          </p>
        </div>
      </div>

      {/* Breakdown Breakdown List */}
      <div className="rounded-2xl border border-slate-800 bg-[#151b23] p-6 shadow-md">
        <h3 className="text-base font-bold text-white mb-4">Rincian Per Kategori</h3>
        
        {/* Progress distribution bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-800 mb-6">
          {categories.map((cat) => {
            const pct = Math.round((cat.amount / grandTotal) * 100)
            return (
              <div
                key={cat.name}
                style={{ width: `${pct}%` }}
                className={`${cat.color} transition-all duration-500`}
                title={`${cat.name}: ${pct}%`}
              />
            )
          })}
        </div>

        <div className="space-y-4 divide-y divide-slate-800/80">
          {categories.map((cat) => {
            const Icon = cat.icon
            const pct = Math.round((cat.amount / grandTotal) * 100)
            return (
              <div key={cat.name} className="pt-4 first:pt-0 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className={`grid h-10 w-10 place-items-center rounded-xl bg-slate-800/80 border border-slate-700/60 ${cat.textColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{cat.name}</div>
                    <div className="text-xs text-slate-400">{cat.detail}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-slate-200">{formatIdr(cat.amount)}</div>
                  <div className="text-xs text-slate-400 font-mono">{pct}% dari total</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Disclaimer */}
        <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-slate-800/40 p-3 text-xs text-slate-400 border border-slate-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <span>
            Perkiraan anggaran ini didasarkan pada data rata-rata harga lokal di {destination}. Harga riil penerbangan, hotel spesifik, tiket masuk, dan transportasi dapat bervariasi tergantung musim liburan.
          </span>
        </div>
      </div>
    </div>
  )
}
