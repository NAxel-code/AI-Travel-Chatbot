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
import { useLanguage } from '../lib/i18n'

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
  const { lang } = useLanguage()
  const [tier, setTier] = useState<BudgetTier>('standard')
  const [pax, setPax] = useState<number>(1)

  const effectiveDays = Math.max(dayCount, 1)
  const effectiveNights = Math.max(effectiveDays - 1, 1)
  const pricing = getDestinationPricing(destination)
  const tierConfig: Record<BudgetTier, { mult: number; label: string; badge: string; desc: string }> = {
    budget: {
      mult: 0.78,
      label: lang === 'id' ? 'Hemat / Backpacker' : 'Budget / Backpacker',
      badge: lang === 'id' ? 'Ekonomis' : 'Budget',
      desc:
        lang === 'id'
          ? 'Homestay/hostel bersih, warung lokal autentik & sewa motor harian'
          : 'Clean homestay/hostel, authentic local warungs & daily scooter rental',
    },
    standard: {
      mult: 1,
      label: lang === 'id' ? 'Menengah / Smart' : 'Standard / Smart',
      badge: lang === 'id' ? 'Optimal' : 'Optimal',
      desc:
        lang === 'id'
          ? 'Hotel bintang 3 / boutique, kombinasi resto lokal & kafe populer'
          : '3-star boutique hotel, mixed local dining & popular cafes',
    },
    comfort: {
      mult: 1.45,
      label: lang === 'id' ? 'Nyaman / Comfort' : 'Comfort / Premium',
      badge: lang === 'id' ? 'Premium' : 'Premium',
      desc:
        lang === 'id'
          ? 'Resort / hotel bintang 4, restoran pilihan & transportasi privat'
          : '4-star resort/hotel, top restaurants & private transport',
    },
  }
  const { mult, label: tierLabel, badge: tierBadge, desc: tierDesc } = tierConfig[tier]
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
    new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

  const categories = [
    {
      name: lang === 'id' ? 'Tiket Pesawat / Transport Utama (PP)' : 'Flights / Main Transport (Roundtrip)',
      amount: totalFlight,
      icon: Plane,
      color: 'bg-teal-700',
      textColor: 'text-teal-700',
      detail:
        lang === 'id'
          ? `${pax} orang × ${formatIdr(flightPerPerson)} (PP) + transfer bandara ${formatIdr(airportTransferTotal)}`
          : `${pax} person(s) × ${formatIdr(flightPerPerson)} (roundtrip) + airport transfer ${formatIdr(airportTransferTotal)}`,
      subItems: [
        {
          label: lang === 'id' ? `Tiket Pulang-Pergi (${destination})` : `Roundtrip Tickets (${destination})`,
          value: `${formatIdr(flightPerPerson)} / ${lang === 'id' ? 'org' : 'pax'}`,
        },
        {
          label: lang === 'id' ? 'Transport Bandara PP' : 'Roundtrip Airport Transfer',
          value: formatIdr(airportTransferTotal),
        },
      ],
    },
    {
      name: lang === 'id' ? `Penginapan (${effectiveNights} Malam)` : `Lodging (${effectiveNights} Nights)`,
      amount: totalHotel,
      icon: BedDouble,
      color: 'bg-teal-600',
      textColor: 'text-teal-700',
      detail:
        lang === 'id'
          ? `${effectiveNights} malam × ${roomsNeeded} kamar × ${formatIdr(hotelPerNight)}/malam`
          : `${effectiveNights} nights × ${roomsNeeded} room(s) × ${formatIdr(hotelPerNight)}/night`,
      subItems: [
        {
          label: lang === 'id' ? `Tarif Kamar (${tierLabel})` : `Room Rate (${tierLabel})`,
          value: `${formatIdr(hotelPerNight)} / ${lang === 'id' ? 'malam' : 'night'}`,
        },
        {
          label: lang === 'id' ? 'Durasi Menginap' : 'Stay Duration',
          value:
            lang === 'id'
              ? `${effectiveNights} malam (${effectiveDays} hari)`
              : `${effectiveNights} nights (${effectiveDays} days)`,
        },
      ],
    },
    {
      name:
        lang === 'id'
          ? `Konsumsi & Makan 3x Sehari (${effectiveDays} Hari)`
          : `Meals & Dining 3x Daily (${effectiveDays} Days)`,
      amount: totalMeals3x,
      icon: Utensils,
      color: 'bg-teal-500',
      textColor: 'text-teal-800',
      detail:
        lang === 'id'
          ? `3x makan/hari + kopi (${effectiveDays * 3}x makan) × ${formatIdr(mealPerDayPerPerson)}/hari/org`
          : `3x meals/day + coffee (${effectiveDays * 3} meals) × ${formatIdr(mealPerDayPerPerson)}/day/person`,
      subItems: [
        {
          label: lang === 'id' ? 'Sarapan Pagi' : 'Breakfast',
          value: `${formatIdr(breakfastCost)} / ${lang === 'id' ? 'sekali makan' : 'meal'}`,
        },
        {
          label: lang === 'id' ? 'Makan Siang' : 'Lunch',
          value: `${formatIdr(lunchCost)} / ${lang === 'id' ? 'sekali makan' : 'meal'}`,
        },
        {
          label: lang === 'id' ? 'Makan Malam / Seafood' : 'Dinner / Seafood',
          value: `${formatIdr(dinnerCost)} / ${lang === 'id' ? 'sekali makan' : 'meal'}`,
        },
        {
          label: lang === 'id' ? 'Air Mineral, Kopi & Camilan' : 'Mineral Water, Coffee & Snacks',
          value: `${formatIdr(snackCost)} / ${lang === 'id' ? 'hari' : 'day'}`,
        },
      ],
    },
    {
      name: lang === 'id' ? `Sewa Motor & BBM (${effectiveDays} Hari)` : `Scooter Rental & Fuel (${effectiveDays} Days)`,
      amount: totalMotorAndFuel,
      icon: Bike,
      color: 'bg-cyan-700',
      textColor: 'text-cyan-700',
      detail:
        lang === 'id'
          ? `${effectiveDays} hari × ${motorsNeeded} unit motor (${formatIdr(motorPerDay)}/hr + BBM ${formatIdr(fuelPerDay)}/hr)`
          : `${effectiveDays} days × ${motorsNeeded} scooter unit(s) (${formatIdr(motorPerDay)}/day + fuel ${formatIdr(fuelPerDay)}/day)`,
      subItems: [
        {
          label:
            lang === 'id'
              ? 'Sewa Motor Matic (2helm + jas hujan)'
              : 'Automatic Scooter Rental (2 helmets + raincoats)',
          value: `${formatIdr(motorPerDay)} / ${lang === 'id' ? 'hari' : 'day'}`,
        },
        {
          label: lang === 'id' ? 'Estimasi BBM (Pertamax/Pertalite)' : 'Fuel Estimate (Gasoline)',
          value: `${formatIdr(fuelPerDay)} / ${lang === 'id' ? 'hari' : 'day'}`,
        },
        {
          label: lang === 'id' ? 'Lokasi Sewa Rekomendasi' : 'Recommended Rental Location',
          value: pricing.rentalHint,
        },
      ],
    },
    {
      name: lang === 'id' ? 'Tiket Wisata, Kapal & Aktivitas' : 'Attraction Tickets, Boats & Activities',
      amount: totalAttractions,
      icon: Ticket,
      color: 'bg-amber-500',
      textColor: 'text-stone-600',
      detail:
        lang === 'id'
          ? `Tiket masuk destinasi, retribusi kawasan & aktivitas selama ${effectiveDays} hari`
          : `Destination entrance fees, local fees & activities for ${effectiveDays} days`,
      subItems: [
        {
          label: lang === 'id' ? 'Rata-rata Tiket & Aktivitas Harian' : 'Average Daily Activities & Tickets',
          value: `${formatIdr(Math.round(totalAttractions / effectiveDays))} / ${lang === 'id' ? 'hari' : 'day'}`,
        },
        {
          label: lang === 'id' ? 'Jumlah Aktivitas Terjadwal' : 'Planned Activities Count',
          value: `${Math.max(items.length, effectiveDays * 3)} ${lang === 'id' ? 'aktivitas' : 'activities'}`,
        },
      ],
    },
  ]

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      {/* Interactive Controls Bar: Budget Tier + Pax Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-stone-200/90 bg-white p-3.5 shadow-xs dark:border-stone-800 dark:bg-[#141920]">
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={lang === 'id' ? 'Gaya budget perjalanan' : 'Trip budget style'}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mr-1.5">
            {lang === 'id' ? 'Gaya Budget:' : 'Budget Style:'}
          </span>
          {(['budget', 'standard', 'comfort'] as BudgetTier[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tier === t}
              onClick={() => setTier(t)}
              className={`min-h-[38px] rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-teal-700/80 focus-visible:ring-offset-1 ${
                tier === t
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200/70 dark:bg-[#1a212b] dark:text-stone-300 dark:hover:bg-[#222c38]'
              }`}
            >
              {tierConfig[t].label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Users className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
            {lang === 'id' ? 'Peserta:' : 'Travelers:'}
          </span>
          <div className="flex items-center rounded-xl border border-stone-200 bg-stone-50 p-0.5 dark:border-stone-800 dark:bg-[#1a212b]" role="group" aria-label={lang === 'id' ? 'Pilih jumlah peserta' : 'Select number of travelers'}>
            {[1, 2, 4].map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={pax === count}
                onClick={() => setPax(count)}
                className={`min-h-[34px] rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-teal-700/80 ${
                  pax === count ? 'bg-teal-700 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-800/60'
                }`}
              >
                {count} {lang === 'id' ? 'Org' : 'Pax'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Overview Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-teal-800/20 bg-teal-900/[0.03] dark:border-teal-800/50 dark:bg-teal-950/30 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-teal-900 dark:text-teal-300 uppercase tracking-wider">
            <span>{lang === 'id' ? `Total Estimasi (${pax} Org)` : `Total Estimate (${pax} Pax)`}</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5 font-display text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            {formatIdr(grandTotal)}
          </div>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400 font-medium">
            {pax > 1 ? `${formatIdr(perPersonTotal)} / ${lang === 'id' ? 'orang' : 'person'} · ` : ''}
            {effectiveDays} {lang === 'id' ? 'hari' : 'days'} {effectiveNights} {lang === 'id' ? 'malam di' : 'nights in'} {destination}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white dark:border-stone-800 dark:bg-[#141920] p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            <span>{lang === 'id' ? 'Biaya Harian di Lokasi' : 'Daily On-Site Cost'}</span>
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-stone-100 text-stone-700 dark:bg-[#1a212b] dark:text-stone-300">
              <PieChart className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2.5 font-display text-2xl sm:text-3xl font-bold text-teal-800 dark:text-teal-400 tracking-tight">
            {formatIdr(Math.round((grandTotal - totalFlight) / effectiveDays))}
          </div>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400 font-medium">
            {lang === 'id'
              ? `Per hari di luar tiket PP (All-in: ${formatIdr(dailyAverage)}/hr)`
              : `Daily excluding flights (All-in: ${formatIdr(dailyAverage)}/day)`}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white dark:border-stone-800 dark:bg-[#141920] p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            <span>{lang === 'id' ? 'Mode Rencana' : 'Budget Plan'}</span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 border border-teal-200/60 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/60">
              {tierBadge}
            </span>
          </div>
          <div className="mt-2.5 font-display text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">{tierLabel}</div>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">{tierDesc}</p>
        </div>
      </div>

      {/* Detailed Category Cost Breakdown */}
      <div className="rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-[#141920] p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
            {lang === 'id' ? 'Rincian Detail Komponen Biaya' : 'Detailed Cost Components Breakdown'}
          </h3>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {lang === 'id'
              ? `Termasuk Tiket PP, Hotel ${effectiveNights} malam, Makan 3x/hari, Sewa Motor & Wisata`
              : `Includes Roundtrip Flights, Hotel (${effectiveNights} nights), 3x Meals/day, Scooter Rental & Activities`}
          </span>
        </div>

        {/* Distribution Bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex bg-stone-100 dark:bg-stone-800 mb-6">
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

        <div className="space-y-4 divide-y divide-stone-100 dark:divide-stone-800/70">
          {categories.map((cat) => {
            const Icon = cat.icon
            const pct = Math.round((cat.amount / grandTotal) * 100)
            return (
              <div key={cat.name} className="pt-4 first:pt-0 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-100 border border-stone-200 dark:bg-[#1a212b] dark:border-stone-800 ${cat.textColor}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">{cat.name}</div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">{cat.detail}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm sm:text-base font-bold text-stone-800 dark:text-stone-100">{formatIdr(cat.amount)}</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                      {pct}% {lang === 'id' ? 'dari total' : 'of total'}
                    </div>
                  </div>
                </div>

                {/* Granular Sub-items */}
                <div className="ml-0 sm:ml-13 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-stone-50/60 dark:bg-[#18202a] p-3 border border-stone-200 dark:border-stone-800">
                  {cat.subItems.map((sub) => (
                    <div key={sub.label} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-stone-500 dark:text-stone-400">{sub.label}</span>
                      <span className="font-semibold text-stone-800 dark:text-stone-200 text-right">{sub.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day-by-Day & Per-Activity Itemized Cost Table */}
      <div className="rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-[#141920] p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              {lang === 'id'
                ? `Rincian Biaya Harian & Per Aktivitas (${effectiveDays} Hari)`
                : `Daily & Per-Activity Cost Breakdown (${effectiveDays} Days)`}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {lang === 'id'
                ? 'Estimasi pengeluaran detail dari pagi hingga malam beserta sewa motor & penginapan'
                : 'Detailed morning-to-night spending estimates with scooter rental & lodging'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {dailyBreakdowns.map((d) => (
            <div key={d.day} className="rounded-2xl border border-stone-200 bg-stone-50/60 dark:border-stone-800 dark:bg-[#18202a] overflow-hidden">
              {/* Day Header */}
              <div className="flex items-center justify-between bg-stone-100 dark:bg-[#141920] px-4 py-2.5 border-b border-stone-200 dark:border-stone-800">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                  {lang === 'id' ? `Hari ke-${d.day}` : `Day ${d.day}`}
                </span>
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  {lang === 'id' ? `Subtotal Hari ${d.day}: ` : `Day ${d.day} Subtotal: `}
                  <span className="text-teal-700 dark:text-teal-400">{formatIdr(d.daySubtotal)}</span>
                </span>
              </div>

              {/* Fixed Daily Components Pill Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border-b border-stone-100 dark:border-stone-800/80 bg-white dark:bg-[#1a212b] text-[11px]">
                <div className="rounded-lg bg-stone-100/70 dark:bg-[#141920]/80 px-2.5 py-1.5">
                  <div className="text-stone-500 dark:text-stone-400">{lang === 'id' ? 'Makan 3x + Kopi' : '3x Meals + Coffee'}</div>
                  <div className="font-bold text-stone-800 dark:text-stone-100">{formatIdr(d.dayMealCost)}</div>
                </div>
                <div className="rounded-lg bg-stone-100/70 dark:bg-[#141920]/80 px-2.5 py-1.5">
                  <div className="text-stone-500 dark:text-stone-400">{lang === 'id' ? 'Sewa Motor + BBM' : 'Scooter + Fuel'}</div>
                  <div className="font-bold text-stone-800 dark:text-stone-100">{formatIdr(d.dayMotorCost)}</div>
                </div>
                <div className="rounded-lg bg-stone-100/70 dark:bg-[#141920]/80 px-2.5 py-1.5">
                  <div className="text-stone-500 dark:text-stone-400">{lang === 'id' ? 'Tiket & Aktivitas' : 'Tickets & Activities'}</div>
                  <div className="font-bold text-stone-800 dark:text-stone-100">{formatIdr(d.dayTicketCost)}</div>
                </div>
                <div className="rounded-lg bg-stone-100/70 dark:bg-[#141920]/80 px-2.5 py-1.5">
                  <div className="text-stone-500 dark:text-stone-400">
                    {d.dayHotelCost > 0
                      ? (lang === 'id' ? `Hotel Malam ke-${d.day}` : `Hotel Night ${d.day}`)
                      : (lang === 'id' ? 'Hari Kepulangan' : 'Departure Day')}
                  </div>
                  <div className="font-bold text-stone-800 dark:text-stone-100">
                    {d.dayHotelCost > 0 ? formatIdr(d.dayHotelCost) : 'Check-out'}
                  </div>
                </div>
              </div>

              {/* Per-Activity Item Rows */}
              <div className="divide-y divide-stone-100 dark:divide-stone-800/70 px-4 py-1">
                {d.activityRows.map((row, idx) => (
                  <div key={`${d.day}-${idx}`} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="font-mono text-[11px] font-semibold text-teal-700 dark:text-teal-400 shrink-0 mt-0.5">
                        {row.time}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-stone-800 dark:text-stone-100 truncate">{row.title}</div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400">
                          <span className="text-stone-600 dark:text-stone-300 font-medium">{row.typeLabel}</span> · {row.note}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono font-semibold text-stone-800 dark:text-stone-100">
                      {row.totalCost > 0 ? formatIdr(row.totalCost) : <span className="text-stone-400 dark:text-stone-500 text-[11px]">{lang === 'id' ? 'Termasuk' : 'Included'}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Practical Tips Box */}
        <div className="flex items-start gap-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 p-3.5 text-xs text-stone-600 dark:text-stone-300 border border-teal-100 dark:border-teal-800/60">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400 mt-0.5" />
          <div>
            <strong className="text-teal-800 dark:text-teal-300">
              {lang === 'id' ? `Tips Sewa Motor & Kuliner di ${destination}: ` : `Scooter Rental & Dining Tips in ${destination}: `}
            </strong>
            {lang === 'id' ? (
              <>
                Lokasi sewa motor mudah ditemukan di <em>{pricing.rentalHint}</em> dengan syarat KTP & SIM C aktif. Untuk makan 3x sehari lebih hemat, kombinasikan sarapan di penginapan/warung pagi, makan siang di dekat spot wisata, dan makan malam di pusat kuliner malam.
              </>
            ) : (
              <>
                Scooter rentals are readily found around <em>{pricing.rentalHint}</em> with a valid ID and driver&apos;s license. To stay budget-friendly, have breakfast at your accommodation or local warung, lunch near attractions, and dinner at local night culinary spots.
              </>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-stone-100/70 dark:bg-[#1a212b] p-3 text-xs text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-stone-500 dark:text-stone-400 mt-0.5" />
          <span>
            {lang === 'id' ? (
              <>
                Perkiraan anggaran ini dihitung berdasarkan rata-rata biaya riil di {destination} dan dapat disesuaikan melalui pilihan <strong>Gaya Budget</strong> serta <strong>Jumlah Peserta</strong> di atas.
              </>
            ) : (
              <>
                These budget estimates are computed based on average real costs in {destination} and can be adjusted through the <strong>Budget Style</strong> and <strong>Travelers</strong> controls above.
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
