import type { ItineraryItem } from '../components/DayCard'

export type TravelReportInput = {
  destination: string
  dayCount: number
  startDate?: string
  endDate?: string
  items: ItineraryItem[]
  latestAiMessage?: string
  preferences?: { preference_category: string; preference_value: string }[]
}

type ReportPricing = {
  flightPp: number
  airportTransfer: number
  hotelNight: number
  motorDay: number
  fuelDay: number
  breakfast: number
  lunch: number
  dinner: number
  snackCoffee: number
  boatOrTour: number
  rentalHint: string
}

const REPORT_PRICING: Record<string, ReportPricing> = {
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
    boatOrTour: 850000,
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
    boatOrTour: 500000,
    rentalHint: 'Area Kuta, Seminyak, Ubud, atau Bandara Ngurah Rai',
  },
  bandung: {
    flightPp: 320000,
    airportTransfer: 60000,
    hotelNight: 320000,
    motorDay: 70000,
    fuelDay: 20000,
    breakfast: 25000,
    lunch: 45000,
    dinner: 60000,
    snackCoffee: 25000,
    boatOrTour: 250000,
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
    boatOrTour: 300000,
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
    boatOrTour: 450000,
    rentalHint: 'Area Senggigi, Mandalika (Kuta Lombok) & Kota Mataram',
  },
}

const DEFAULT_REPORT_PRICING: ReportPricing = {
  flightPp: 1750000,
  airportTransfer: 100000,
  hotelNight: 350000,
  motorDay: 75000,
  fuelDay: 25000,
  breakfast: 30000,
  lunch: 45000,
  dinner: 65000,
  snackCoffee: 25000,
  boatOrTour: 400000,
  rentalHint: 'Pusat kota, stasiun/bandara utama, atau melalui resepsionis penginapan',
}

function getPricing(destination: string): ReportPricing {
  const lower = destination.toLowerCase()
  for (const [key, val] of Object.entries(REPORT_PRICING)) {
    if (lower.includes(key)) return val
  }
  if (lower.includes('jogja')) return REPORT_PRICING.yogyakarta
  return DEFAULT_REPORT_PRICING
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount))
}

export function generateTravelReportHtml(input: TravelReportInput): string {
  const days = Math.max(1, input.dayCount || 3)
  const nights = Math.max(1, days - 1)
  const pricing = getPricing(input.destination)

  const transportTotal = pricing.flightPp + pricing.airportTransfer
  const accommodationTotal = pricing.hotelNight * nights
  const dailyMealPerDay = pricing.breakfast + pricing.lunch + pricing.dinner + pricing.snackCoffee
  const mealsTotal = dailyMealPerDay * days
  const motorTotal = (pricing.motorDay + pricing.fuelDay) * days
  const ticketsTotal = pricing.boatOrTour + days * 50000
  const grandTotal = transportTotal + accommodationTotal + mealsTotal + motorTotal + ticketsTotal

  const groupedByDay = input.items.reduce<Record<number, ItineraryItem[]>>((acc, item) => {
    ;(acc[item.day_number] ||= []).push(item)
    return acc
  }, {})

  const sortedDays = Object.keys(groupedByDay)
    .map(Number)
    .sort((a, b) => a - b)

  const itinerarySectionHtml =
    sortedDays.length > 0
      ? sortedDays
          .map((day) => {
            const dayItems = groupedByDay[day] || []
            const rows = dayItems
              .map(
                (item) => `
              <tr>
                <td class="time-cell">${escapeHtml(item.start_time || '09:00')}</td>
                <td>
                  <div class="place-title">${escapeHtml(item.place_name)}</div>
                  ${
                    item.address || item.location
                      ? `<div class="place-sub">📍 ${escapeHtml(item.address || item.location || '')}</div>`
                      : ''
                  }
                  ${item.description ? `<div class="place-desc">${escapeHtml(item.description)}</div>` : ''}
                </td>
                <td class="cat-cell">${escapeHtml(item.category || 'Aktivitas')}</td>
              </tr>`,
              )
              .join('')

            return `
            <div class="day-block">
              <div class="day-header">Hari ke-${day} — ${escapeHtml(input.destination)}</div>
              <table class="report-table">
                <thead>
                  <tr>
                    <th style="width: 90px;">Waktu</th>
                    <th>Destinasi & Aktivitas</th>
                    <th style="width: 120px;">Kategori</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>`
          })
          .join('')
      : `<div class="note-box">Jadwal harian mengacu pada rekomendasi percakapan AI di bawah serta rincian harian untuk ${days} hari (${nights} malam) di ${escapeHtml(input.destination)}.</div>`

  const aiSummaryHtml = input.latestAiMessage
    ? `
      <div class="section">
        <h2>Catatan & Ringkasan Rekomendasi AI</h2>
        <div class="ai-summary">${escapeHtml(input.latestAiMessage).replace(/\n/g, '<br/>')}</div>
      </div>`
    : ''

  const createdDate = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date())

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Laporan Perjalanan - ${escapeHtml(input.destination)} (${days} Hari)</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      line-height: 1.5;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 20px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .toolbar-info {
      font-size: 13px;
      color: #cbd5e1;
    }
    .toolbar-info strong {
      color: #34d399;
    }
    .toolbar-actions {
      display: flex;
      gap: 10px;
    }
    .btn-print {
      background: #10b981;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      padding: 9px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-close {
      background: #334155;
      color: #f8fafc;
      border: none;
      border-radius: 10px;
      padding: 9px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .page {
      max-width: 860px;
      margin: 24px auto;
      background: #ffffff;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
    }
    .report-header {
      border-bottom: 2px solid #10b981;
      padding-bottom: 18px;
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
    }
    .brand {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #059669;
    }
    h1 {
      margin: 4px 0 6px 0;
      font-size: 26px;
      color: #0f172a;
    }
    .meta {
      font-size: 13px;
      color: #475569;
    }
    .total-badge {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 12px;
      padding: 12px 16px;
      text-align: right;
    }
    .total-badge .label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #047857;
    }
    .total-badge .amount {
      font-size: 20px;
      font-weight: 800;
      color: #065f46;
    }
    .section {
      margin-bottom: 28px;
    }
    h2 {
      font-size: 17px;
      color: #0f172a;
      border-left: 4px solid #10b981;
      padding-left: 10px;
      margin: 0 0 14px 0;
    }
    .day-block {
      margin-bottom: 18px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
    }
    .day-header {
      background: #f8fafc;
      padding: 10px 14px;
      font-weight: 700;
      font-size: 14px;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .report-table th {
      background: #f1f5f9;
      text-align: left;
      padding: 9px 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    .report-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    .time-cell {
      font-weight: 700;
      color: #059669;
      white-space: nowrap;
    }
    .cat-cell {
      font-size: 12px;
      color: #475569;
      text-transform: capitalize;
    }
    .place-title {
      font-weight: 700;
      color: #0f172a;
    }
    .place-sub {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .place-desc {
      font-size: 12px;
      color: #334155;
      margin-top: 4px;
    }
    .cost-amount {
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
    }
    .total-row td {
      background: #ecfdf5;
      font-weight: 800;
      font-size: 14px;
      color: #065f46;
      border-top: 2px solid #10b981;
    }
    .ai-summary, .note-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      font-size: 13px;
      color: #1e293b;
    }
    .footer-note {
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      text-align: center;
    }
    @media (max-width: 640px) {
      .page {
        margin: 10px;
        padding: 18px;
      }
      h1 { font-size: 21px; }
    }
    @media print {
      body { background: #ffffff; }
      .toolbar { display: none !important; }
      .page {
        margin: 0;
        padding: 0;
        box-shadow: none;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-info">
      <strong>Dokumen Laporan Perjalanan Siap!</strong> — Klik tombol di samping lalu pilih <em>"Simpan sebagai PDF" (Save as PDF)</em>.
    </div>
    <div class="toolbar-actions">
      <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
      <button class="btn-close" onclick="window.close()">Tutup</button>
    </div>
  </div>

  <div class="page">
    <div class="report-header">
      <div>
        <div class="brand">Rute — AI Travel Planner Report</div>
        <h1>Laporan Perjalanan: ${escapeHtml(input.destination)}</h1>
        <div class="meta">
          Durasi: <strong>${days} Hari ${nights} Malam</strong>
          ${input.startDate && input.endDate ? ` · Tanggal: <strong>${escapeHtml(input.startDate)} s/d ${escapeHtml(input.endDate)}</strong>` : ''}
          <br />
          Dibuat pada: ${escapeHtml(createdDate)}
        </div>
      </div>
      <div class="total-badge">
        <div class="label">Total Estimasi Biaya</div>
        <div class="amount">${formatRupiah(grandTotal)}</div>
        <div class="meta" style="font-size:11px;">~${formatRupiah(grandTotal / days)} / hari</div>
      </div>
    </div>

    <div class="section">
      <h2>1. Rincian Estimasi Biaya Perjalanan (Detail Cost)</h2>
      <table class="report-table">
        <thead>
          <tr>
            <th>Komponen Biaya</th>
            <th>Rincian Detail</th>
            <th style="text-align:right;">Estimasi Biaya</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Tiket Pesawat / Transport Utama (PP)</strong></td>
            <td>Tiket pulang-pergi (${formatRupiah(pricing.flightPp)}) + Transfer bandara/stasiun PP (${formatRupiah(pricing.airportTransfer)})</td>
            <td class="cost-amount">${formatRupiah(transportTotal)}</td>
          </tr>
          <tr>
            <td><strong>Penginapan (${nights} Malam)</strong></td>
            <td>Hotel / Homestay nyaman ${formatRupiah(pricing.hotelNight)} × ${nights} malam</td>
            <td class="cost-amount">${formatRupiah(accommodationTotal)}</td>
          </tr>
          <tr>
            <td><strong>Konsumsi & Makan 3x Sehari (${days} Hari)</strong></td>
            <td>Sarapan (${formatRupiah(pricing.breakfast)}), Makan Siang (${formatRupiah(pricing.lunch)}), Makan Malam (${formatRupiah(pricing.dinner)}), Kopi/Air (${formatRupiah(pricing.snackCoffee)}) × ${days} hari</td>
            <td class="cost-amount">${formatRupiah(mealsTotal)}</td>
          </tr>
          <tr>
            <td><strong>Sewa Motor & BBM (${days} Hari)</strong></td>
            <td>Sewa motor ${formatRupiah(pricing.motorDay)}/hari + BBM Pertamax ${formatRupiah(pricing.fuelDay)}/hari (${escapeHtml(pricing.rentalHint)})</td>
            <td class="cost-amount">${formatRupiah(motorTotal)}</td>
          </tr>
          <tr>
            <td><strong>Tiket Wisata, Kapal & Aktivitas</strong></td>
            <td>Paket tur utama / pulau & tiket masuk objek wisata selama ${days} hari</td>
            <td class="cost-amount">${formatRupiah(ticketsTotal)}</td>
          </tr>
          <tr class="total-row">
            <td colspan="2">TOTAL ESTIMASI BIAYA PERJALANAN (${days} HARI ${nights} MALAM)</td>
            <td class="cost-amount">${formatRupiah(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>2. Jadwal Rencana Perjalanan Harian (Itinerary)</h2>
      ${itinerarySectionHtml}
    </div>

    ${aiSummaryHtml}

    <div class="footer-note">
      Dokumen ini dibuat otomatis oleh <strong>Rute AI Travel Assistant</strong> · Simpan halaman ini sebagai PDF untuk panduan selama perjalanan.
    </div>
  </div>
</body>
</html>`
}

export function openOrDownloadTravelReport(input: TravelReportInput): void {
  const html = generateTravelReportHtml(input)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const reportWindow = window.open(url, '_blank')
  if (!reportWindow) {
    const link = document.createElement('a')
    link.href = url
    link.download = `laporan-perjalanan-${input.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
