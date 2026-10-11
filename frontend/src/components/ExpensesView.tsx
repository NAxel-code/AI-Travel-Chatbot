import { useState } from 'react'
import {
  DollarSign,
  PieChart,
  Utensils,
  Ticket,
  BedDouble,
  Plane,
  AlertCircle,
  Users,
  Calendar,
  CheckCircle2,
  Bike,
} from 'lucide-react'
import type { ItineraryItem } from './DayCard'

type ExpensesViewProps = {
  destination: string
  items: ItineraryItem[]
  dayCount: number
}

type BudgetTier = 'budget' | 'standard' | 'comfort'

type DestinationPricing = {
  flightPp: number
  airportTransfer: number
  hotelNight: number
  motorDay: number
  fuelDay: number
  breakfast: number
  lunch: number
  dinner: number
  snackCoffee: number
  defaultTicket: number
  boatOrTour: number
  rentalHint: string
}

const PRICING_BY_DEST: Record<string, DestinationPricing> = {
  'labuan bajo': {
    flightPp: 2450000,
    airportTransfer: 100000,
    hotelNight: 420000,
    motorDay: 85000,
    fuelDay: 30000,
    breakfast: 35000,
    lunch: 55000,
    dinner: 85000,
    snackCoffee: 30000,
    defaultTicket: 50000,
    boatOrTour: 650000,
    rentalHint: 'Area Jl. Soekarno Hatta / depan Bandara Komodo & Pelabuhan Marina',
  },
  bali: {
    flightPp: 1650000,
    airportTransfer: 120000,
    hotelNight: 380000,
    motorDay: 75000,
    fuelDay: 25000,
    breakfast: 35000,
    lunch: 50000,
    dinner: 75000,
    snackCoffee: 30000,
    defaultTicket: 45000,
    boatOrTour: 350000,
    rentalHint: 'Area Kuta, Seminyak, Ubud, atau pengantaran langsung ke Bandara Ngurah Rai',
  },
  bandung: {
    flightPp: 320000, // Kereta Cepat Whoosh / Travel PP
    airportTransfer: 60000,
    hotelNight: 320000,
    motorDay: 70000,
    fuelDay: 20000,
    breakfast: 25000,
    lunch: 45000,
    dinner: 60000,
    snackCoffee: 25000,
    defaultTicket: 40000,
    boatOrTour: 150000,
    rentalHint: 'Dekat Stasiun Bandung (Kebon Kawung) & Pasteur',
  },
  yogyakarta: {
    flightPp: 1100000,
    airportTransfer: 80000,
    hotelNight: 300000,
    motorDay: 65000,
    fuelDay: 20000,
    breakfast: 20000,
    lunch: 35000,
    dinner: 50000,
    snackCoffee: 20000,
    defaultTicket: 35000,
    boatOrTour: 200000,
    rentalHint: 'Area Stasiun Tugu, Lempuyangan & Malioboro',
  },
  lombok: {
    flightPp: 1850000,
    airportTransfer: 120000,
    hotelNight: 360000,
    motorDay: 75000,
    fuelDay: 25000,
    breakfast: 30000,
    lunch: 45000,
    dinner: 70000,
    snackCoffee: 25000,
    defaultTicket: 35000,
    boatOrTour: 350000,
    rentalHint: 'Area Senggigi, Mandalika (Kuta Lombok) & Kota Mataram',
  },
}

const DEFAULT_PRICING: DestinationPricing = {
  flightPp: 1750000,
  airportTransfer: 100000,
  hotelNight: 350000,
  motorDay: 75000,
  fuelDay: 25000,
  breakfast: 30000,
  lunch: 45000,
  dinner: 65000,
  snackCoffee: 25000,
  defaultTicket: 40000,
  boatOrTour: 300000,
  rentalHint: 'Pusat kota, stasiun/bandara utama, atau melalui resepsionis penginapan',
}

function getDestinationPricing(destination: string): DestinationPricing {
  const lower = destination.toLowerCase()
  for (const [key, value] of Object.entries(PRICING_BY_DEST)) {
    if (lower.includes(key)) return value
  }
  if (lower.includes('jogja')) return PRICING_BY_DEST.yogyakarta
  return DEFAULT_PRICING
}

const TIER_MULTIPLIER: Record<BudgetTier, { mult: number; label: string; badge: string; desc: string }> = {
  budget: {
    mult: 0.78,
    label: 'Hemat / Backpacker',
    badge: 'Ekonomis',
    desc: 'Homestay/hostel bersih, warung lokal autentik & sewa motor harian',
  },
  standard: {
    mult: 1,
    label: 'Menengah / Smart',
    badge: 'Optimal',
    desc: 'Hotel bintang 3 / boutique, kombinasi resto lokal & kafe populer',
  },
  comfort: {
    mult: 1.45,
    label: 'Nyaman / Comfort',
    badge: 'Premium',
    desc: 'Resort / hotel bintang 4, restoran pilihan & transportasi privat',
  },
}

function estimateActivityItemCost(
  item: ItineraryItem,
  pricing: DestinationPricing,
  mult: number,
): { cost: number; typeLabel: string; note: string } {
  const text = `${item.title} ${item.description || ''} ${item.category || ''}`.toLowerCase()
  const roundTo5k = (n: number) => Math.round(n / 5000) * 5000

  if (/pesawat|flight|bandara|airport|keberangkatan|kepulangan|check-in bandara/i.test(text)) {
    return {
      cost: roundTo5k(pricing.airportTransfer * 0.5 * mult),
      typeLabel: 'Transport Bandara',
      note: 'Transfer lokal ke/dari bandara',
    }
  }
  if (/sewa motor|rental motor|scooter/i.test(text)) {
    return {
      cost: roundTo5k((pricing.motorDay + pricing.fuelDay) * mult),
      typeLabel: 'Sewa Motor + BBM',
      note: 'Tarif sewa 24 jam + bensin',
    }
  }
  if (/sarapan|breakfast|pagi/i.test(text) && /makan|kuliner|warung|cafe|kopi|resto|food/i.test(text)) {
    return {
      cost: roundTo5k(pricing.breakfast * mult),
      typeLabel: 'Makan Pagi',
      note: 'Per porsi + minuman',
    }
  }
  if (/makan malam|dinner|seafood|night market|kampung ujung/i.test(text)) {
    return {
      cost: roundTo5k(pricing.dinner * mult),
      typeLabel: 'Makan Malam',
      note: 'Hidangan utama + minuman',
    }
  }
  if (/makan|lunch|kuliner|warung|resto|cafe|kopi|food/i.test(text)) {
    return {
      cost: roundTo5k(pricing.lunch * mult),
      typeLabel: 'Kuliner / Makan Siang',
      note: 'Per orang sekali makan',
    }
  }
  if (/sailing|boat|kapal|island hopping|pulau padar|komodo|pink beach|manta|taka makassar|snorkeling|diving/i.test(text)) {
    return {
      cost: roundTo5k(pricing.boatOrTour * 0.45 * mult),
      typeLabel: 'Tur Laut & Tiket Kawasan',
      note: 'Kontribusi kapal/retribusi spot wisata',
    }
  }
  if (/hotel|check-in|check in|istirahat|penginapan|homestay|villa|resort/i.test(text)) {
    return {
      cost: 0,
      typeLabel: 'Akomodasi',
      note: 'Dihitung pada komponen penginapan malam',
    }
  }
  return {
    cost: roundTo5k(pricing.defaultTicket * mult),
    typeLabel: 'Tiket & Aktivitas',
    note: 'Tiket masuk / parkir / retribusi',
  }
}

export function ExpensesView({ destination, items, dayCount }: ExpensesViewProps) {
  const [tier, setTier] = useState<BudgetTier>('standard')
  const [pax, setPax] = useState<number>(1)

  const effectiveDays = Math.max(dayCount, 1)
  const effectiveNights = Math.max(effectiveDays - 1, 1)
  const pricing = getDestinationPricing(destination)
  const { mult, label: tierLabel, badge: tierBadge, desc: tierDesc } = TIER_MULTIPLIER[tier]
  const roundTo5k = (n: number) => Math.round(n / 5000) * 5000

  // Unit costs adjusted by tier
  const flightPerPerson = roundTo5k(pricing.flightPp * (tier === 'comfort' ? 1.25 : tier === 'budget' ? 0.9 : 1))
  const airportTransferTotal = roundTo5k(pricing.airportTransfer * mult)
  const hotelPerNight = roundTo5k(pricing.hotelNight * mult)
  const motorPerDay = roundTo5k(pricing.motorDay * (tier === 'comfort' ? 1.15 : 1))
  const fuelPerDay = roundTo5k(pricing.fuelDay)
  const breakfastCost = roundTo5k(pricing.breakfast * mult)
  const lunchCost = roundTo5k(pricing.lunch * mult)
  const dinnerCost = roundTo5k(pricing.dinner * mult)
  const snackCost = roundTo5k(pricing.snackCoffee * mult)
  const mealPerDayPerPerson = breakfastCost + lunchCost + dinnerCost + snackCost

  // Shared vs per-person calculations
  const roomsNeeded = Math.ceil(pax / 2)
  const motorsNeeded = Math.ceil(pax / 2)

  const totalFlight = flightPerPerson * pax + airportTransferTotal
  const totalHotel = hotelPerNight * effectiveNights * roomsNeeded
  const totalMotorAndFuel = (motorPerDay + fuelPerDay) * effectiveDays * motorsNeeded
  const totalMeals3x = mealPerDayPerPerson * effectiveDays * pax

  // Group itinerary items by day or synthesize daily structure if empty
  const dayNumbers = Array.from({ length: effectiveDays }, (_, i) => i + 1)
  const dailyBreakdowns = dayNumbers.map((day) => {
    const dayItems = items.filter((it) => it.day_number === day)
    const activityRows =
      dayItems.length > 0
        ? dayItems.map((it) => {
            const est = estimateActivityItemCost(it, pricing, mult)
            return {
              time: it.time_slot,
              title: it.title,
              typeLabel: est.typeLabel,
              note: est.note,
              costPerPax: est.cost,
              totalCost: est.cost * pax,
            }
          })
        : [
            {
              time: '08:00',
              title: `Sarapan Pagi Lokal di ${destination}`,
              typeLabel: 'Makan Pagi (1/3)',
              note: 'Menu sarapan lokal + kopi/teh',
              costPerPax: breakfastCost,
              totalCost: breakfastCost * pax,
            },
            {
              time: '09:30',
              title: `Eksplorasi Destinasi Utama Hari ${day}`,
              typeLabel: 'Tiket Wisata & Tur',
              note: 'Tiket masuk kawasan & pemandu/fasilitas',
              costPerPax: roundTo5k(pricing.defaultTicket * 1.5 * mult),
              totalCost: roundTo5k(pricing.defaultTicket * 1.5 * mult) * pax,
            },
            {
              time: '12:30',
              title: `Makan Siang Kuliner Khas ${destination}`,
              typeLabel: 'Makan Siang (2/3)',
              note: 'Hidangan utama + minuman segar',
              costPerPax: lunchCost,
              totalCost: lunchCost * pax,
            },
            {
              time: '15:30',
              title: `Spot Panorama / Sunset Hari ${day}`,
              typeLabel: 'Tiket & Parkir',
              note: 'Retribusi kawasan & parkir motor',
              costPerPax: roundTo5k(pricing.defaultTicket * mult),
              totalCost: roundTo5k(pricing.defaultTicket * mult) * pax,
            },
            {
              time: '19:00',
              title: `Makan Malam / Night Culinary ${destination}`,
              typeLabel: 'Makan Malam (3/3)',
              note: 'Seafood / kuliner malam pilihan',
              costPerPax: dinnerCost,
              totalCost: dinnerCost * pax,
            },
          ]

    const ticketOnlySum = activityRows
      .filter((r) => !/Makan|Sarapan|Kuliner|Akomodasi|Sewa Motor/i.test(r.typeLabel))
      .reduce((acc, r) => acc + r.totalCost, 0)

    const dayTicketCost = Math.max(ticketOnlySum, roundTo5k(pricing.defaultTicket * 2 * mult) * pax)
    const dayMealCost = mealPerDayPerPerson * pax
    const dayMotorCost = (motorPerDay + fuelPerDay) * motorsNeeded
    const dayHotelCost = day <= effectiveNights ? hotelPerNight * roomsNeeded : 0
    const daySubtotal = dayTicketCost + dayMealCost + dayMotorCost + dayHotelCost

    return {
      day,
      activityRows,
      dayTicketCost,
      dayMealCost,
      dayMotorCost,
      dayHotelCost,
      daySubtotal,
    }
  })

  const totalAttractions = dailyBreakdowns.reduce((acc, d) => acc + d.dayTicketCost, 0)
  const grandTotal = totalFlight + totalHotel + totalMotorAndFuel + totalMeals3x + totalAttractions
  const perPersonTotal = Math.round(grandTotal / pax)
  const dailyAverage = Math.round(grandTotal / effectiveDays)

  const formatIdr = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

  const categories = [
    {
      name: `Tiket Pesawat / Transport Utama (PP)`,
      amount: totalFlight,
      icon: Plane,
      color: 'bg-sky-500',
      textColor: 'text-sky-400',
      detail: `${pax} orang × ${formatIdr(flightPerPerson)} (PP) + transfer bandara ${formatIdr(airportTransferTotal)}`,
      subItems: [
        { label: `Tiket Pulang-Pergi (${destination})`, value: `${formatIdr(flightPerPerson)} / org` },
        { label: 'Transport Bandara PP', value: formatIdr(airportTransferTotal) },
      ],
    },
    {
      name: `Penginapan (${effectiveNights} Malam)`,
      amount: totalHotel,
      icon: BedDouble,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-400',
      detail: `${effectiveNights} malam × ${roomsNeeded} kamar × ${formatIdr(hotelPerNight)}/malam`,
      subItems: [
        { label: `Tarif Kamar (${tierLabel})`, value: `${formatIdr(hotelPerNight)} / malam` },
        { label: `Durasi Menginap`, value: `${effectiveNights} malam (${effectiveDays} hari)` },
      ],
    },
    {
      name: `Konsumsi & Makan 3x Sehari (${effectiveDays} Hari)`,
      amount: totalMeals3x,
      icon: Utensils,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      detail: `3x makan/hari + kopi (${effectiveDays * 3}x makan) × ${formatIdr(mealPerDayPerPerson)}/hari/org`,
      subItems: [
        { label: 'Sarapan Pagi', value: `${formatIdr(breakfastCost)} / sekali makan` },
        { label: 'Makan Siang', value: `${formatIdr(lunchCost)} / sekali makan` },
        { label: 'Makan Malam / Seafood', value: `${formatIdr(dinnerCost)} / sekali makan` },
        { label: 'Air Mineral, Kopi & Camilan', value: `${formatIdr(snackCost)} / hari` },
      ],
    },
    {
      name: `Sewa Motor & BBM (${effectiveDays} Hari)`,
      amount: totalMotorAndFuel,
      icon: Bike,
      color: 'bg-amber-500',
      textColor: 'text-amber-400',
      detail: `${effectiveDays} hari × ${motorsNeeded} unit motor (${formatIdr(motorPerDay)}/hr + BBM ${formatIdr(fuelPerDay)}/hr)`,
      subItems: [
        { label: 'Sewa Motor Matic (2helm + jas hujan)', value: `${formatIdr(motorPerDay)} / hari` },
        { label: 'Estimasi BBM (Pertamax/Pertalite)', value: `${formatIdr(fuelPerDay)} / hari` },
        { label: 'Lokasi Sewa Rekomendasi', value: pricing.rentalHint },
      ],
    },
    {
      name: 'Tiket Wisata, Kapal & Aktivitas',
      amount: totalAttractions,
      icon: Ticket,
      color: 'bg-rose-500',
      textColor: 'text-rose-400',
      detail: `Tiket masuk destinasi, retribusi kawasan & aktivitas selama ${effectiveDays} hari`,
      subItems: [
        { label: 'Rata-rata Tiket & Aktivitas Harian', value: `${formatIdr(Math.round(totalAttractions / effectiveDays))} / hari` },
        { label: 'Jumlah Aktivitas Terjadwal', value: `${Math.max(items.length, effectiveDays * 3)} aktivitas` },
      ],
    },
  ]

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      {/* Interactive Controls Bar: Budget Tier + Pax Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#12161f] p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1.5">Gaya Budget:</span>
          {(['budget', 'standard', 'comfort'] as BudgetTier[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                tier === t
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-[#1a212d] text-slate-300 hover:bg-slate-800'
              }`}
            >
              {TIER_MULTIPLIER[t].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Users className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-medium text-slate-300">Peserta:</span>
          <div className="flex items-center rounded-xl border border-slate-800 bg-[#1a212d] p-0.5">
            {[1, 2, 4].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setPax(count)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  pax === count ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {count} Org
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-slate-800 bg-[#151b23] p-4 sm:p-5 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Total Estimasi ({pax} Org)</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 text-xl sm:text-2xl font-bold text-white tracking-tight">
            {formatIdr(grandTotal)}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {pax > 1 ? `${formatIdr(perPersonTotal)} / orang · ` : ''}
            {effectiveDays} hari {effectiveNights} malam di {destination}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#151b23] p-4 sm:p-5 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Biaya Harian (Di Lokasi)</span>
            <PieChart className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight">
            {formatIdr(Math.round((grandTotal - totalFlight) / effectiveDays))}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Per hari di luar tiket PP (Rata-rata all-in: {formatIdr(dailyAverage)}/hr)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#151b23] p-4 sm:p-5 shadow-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Mode Rencana</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
              {tierBadge}
            </span>
          </div>
          <div className="mt-2.5 text-lg sm:text-xl font-bold text-slate-200">{tierLabel}</div>
          <p className="mt-1 text-xs text-slate-400">{tierDesc}</p>
        </div>
      </div>

      {/* Detailed Category Cost Breakdown */}
      <div className="rounded-2xl border border-slate-800 bg-[#151b23] p-4 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="text-base font-bold text-white">Rincian Detail Komponen Biaya</h3>
          <span className="text-xs text-slate-400">
            Termasuk Tiket PP, Hotel {effectiveNights} malam, Makan 3x/hari, Sewa Motor & Wisata
          </span>
        </div>

        {/* Distribution Bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-800 mb-6">
          {categories.map((cat) => {
            const pct = Math.max(Math.round((cat.amount / grandTotal) * 100), 4)
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
              <div key={cat.name} className="pt-4 first:pt-0 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-800/80 border border-slate-700/60 ${cat.textColor}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{cat.name}</div>
                      <div className="text-xs text-slate-400">{cat.detail}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm sm:text-base font-bold text-slate-100">{formatIdr(cat.amount)}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{pct}% dari total</div>
                  </div>
                </div>

                {/* Granular Sub-items */}
                <div className="ml-0 sm:ml-13 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-[#11161d] p-3 border border-slate-800/70">
                  {cat.subItems.map((sub) => (
                    <div key={sub.label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-400">{sub.label}</span>
                      <span className="font-semibold text-slate-200 text-right">{sub.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day-by-Day & Per-Activity Itemized Cost Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#151b23] p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-400" />
              Rincian Biaya Harian & Per Aktivitas ({effectiveDays} Hari)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Estimasi pengeluaran detail dari pagi hingga malam beserta sewa motor & penginapan
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {dailyBreakdowns.map((d) => (
            <div key={d.day} className="rounded-2xl border border-slate-800 bg-[#11161d] overflow-hidden">
              {/* Day Header */}
              <div className="flex items-center justify-between bg-slate-800/50 px-4 py-2.5 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Hari ke-{d.day}
                </span>
                <span className="text-xs font-bold text-white">
                  Subtotal Hari {d.day}: <span className="text-emerald-400">{formatIdr(d.daySubtotal)}</span>
                </span>
              </div>

              {/* Fixed Daily Components Pill Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border-b border-slate-800/60 bg-[#131922] text-[11px]">
                <div className="rounded-lg bg-slate-800/40 px-2.5 py-1.5">
                  <div className="text-slate-400">Makan 3x + Kopi</div>
                  <div className="font-bold text-emerald-400">{formatIdr(d.dayMealCost)}</div>
                </div>
                <div className="rounded-lg bg-slate-800/40 px-2.5 py-1.5">
                  <div className="text-slate-400">Sewa Motor + BBM</div>
                  <div className="font-bold text-amber-400">{formatIdr(d.dayMotorCost)}</div>
                </div>
                <div className="rounded-lg bg-slate-800/40 px-2.5 py-1.5">
                  <div className="text-slate-400">Tiket & Aktivitas</div>
                  <div className="font-bold text-rose-400">{formatIdr(d.dayTicketCost)}</div>
                </div>
                <div className="rounded-lg bg-slate-800/40 px-2.5 py-1.5">
                  <div className="text-slate-400">{d.dayHotelCost > 0 ? `Hotel Malam ke-${d.day}` : 'Hari Kepulangan'}</div>
                  <div className="font-bold text-indigo-400">
                    {d.dayHotelCost > 0 ? formatIdr(d.dayHotelCost) : 'Check-out'}
                  </div>
                </div>
              </div>

              {/* Per-Activity Item Rows */}
              <div className="divide-y divide-slate-800/50 px-4 py-1">
                {d.activityRows.map((row, idx) => (
                  <div key={`${d.day}-${idx}`} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="font-mono text-[11px] font-semibold text-emerald-400 shrink-0 mt-0.5">
                        {row.time}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-200 truncate">{row.title}</div>
                        <div className="text-[11px] text-slate-400">
                          <span className="text-slate-300 font-medium">{row.typeLabel}</span> · {row.note}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono font-semibold text-slate-200">
                      {row.totalCost > 0 ? formatIdr(row.totalCost) : <span className="text-slate-500 text-[11px]">Termasuk</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Practical Tips Box */}
        <div className="flex items-start gap-2.5 rounded-xl bg-emerald-500/10 p-3.5 text-xs text-slate-300 border border-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          <div>
            <strong className="text-emerald-300">Tips Sewa Motor & Kuliner di {destination}: </strong>
            Lokasi sewa motor mudah ditemukan di <em>{pricing.rentalHint}</em> dengan syarat KTP & SIM C aktif. Untuk makan 3x sehari lebih hemat, kombinasikan sarapan di penginapan/warung pagi, makan siang di dekat spot wisata, dan makan malam di pusat kuliner malam.
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-slate-800/40 p-3 text-xs text-slate-400 border border-slate-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <span>
            Perkiraan anggaran ini dihitung berdasarkan rata-rata biaya riil di {destination} dan dapat disesuaikan melalui pilihan <strong>Gaya Budget</strong> serta <strong>Jumlah Peserta</strong> di atas.
          </span>
        </div>
      </div>
    </div>
  )
}
