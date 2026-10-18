import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export type Language = 'id' | 'en'

export const dictionaries = {
  id: {
    // Navbar
    searchPlaceholder: 'Cari destinasi, pantai, kuliner…',
    searchInDest: 'Cari tempat di {dest}…',
    searchAriaLabel: 'Cari tempat atau aktivitas',
    clearSearch: 'Hapus teks pencarian',
    shareWa: 'WhatsApp',
    shareWaTitle: 'Bagikan rute perjalanan ke WhatsApp',
    packing: 'Packing',
    packingTitle: 'Buka checklist barang bawaan traveler',
    guide: 'Panduan',
    guideTitle: 'Panduan penggunaan & contoh prompt',
    reportPdf: 'PDF',
    reportPdfTitle: 'Unduh laporan perjalanan (PDF)',
    calendar: 'Kalender',
    calendarTitle: 'Ekspor ke kalender (.ics)',
    newSession: 'Sesi Baru',
    newSessionTitle: 'Mulai sesi baru dan buat itinerary dari awal',
    themeLightTooltip: 'Ganti ke Mode Terang (Light Mode)',
    themeDarkTooltip: 'Ganti ke Mode Gelap (Dark Mode)',
    langSwitchTooltip: 'Switch to English',
    userMenu: 'Menu pengguna',
    signInOrRegister: 'Masuk atau daftar',
    myTrips: 'Perjalanan saya',
    spotlightTour: 'Tur Interaktif (Spotlight)',
    savedPreferences: 'Preferensi tersimpan',
    signOut: 'Keluar',

    // Chat Panel Header & Starter
    assistantTitle: 'Asisten Rute',
    assistantSubtitleReady: 'Siap membantu rencanamu',
    assistantSubtitleDrafting: 'Sedang menyusun…',
    memoryBtn: 'Memori',
    memoryTitle: 'Kelola preferensi yang diingat',
    reportBtn: 'Laporan',
    reportBtnTitle: 'Unduh Dokumen Laporan Perjalanan',
    menuBtn: 'Menu',
    menuBtnAria: 'Kembali ke Menu / Jadwal',
    newToRute: 'Baru di Rute? Lihat cara kerja & fiturnya',
    openGuideBtn: 'Buka Panduan ➔',
    tryStartingWith: 'Coba mulai dengan:',
    interactiveTourBtn: 'Tur Interaktif',
    interactiveTourTitle: 'Mulai tur interaktif spotlight di layar',
    chatPlaceholder: 'Mau liburan ke mana?',
    chatDisclaimer: 'Verifikasi harga & jam buka sebelum berangkat',
    greeting: 'Halo! Mau liburan ke mana kali ini? Sebutkan destinasi (misal: Bali, Bandung, Labuan Bajo), durasi hari, dan gaya traveling favoritmu. Rute akan menyusun itinerary lengkap beserta peta dan perkiraan anggarannya!',

    // Starter Prompts
    starter1Label: 'Labuan Bajo, 5 hari',
    starter1Hint: 'Island hopping + sewa motor',
    starter1Prompt: 'Buatkan langsung itinerary 5 hari 4 malam di Labuan Bajo mulai minggu depan, lengkap tempat wisata, makan 3x sehari, dan sewa motor',
    starter2Label: 'Bali, 3 hari',
    starter2Hint: 'Pantai & kuliner, budget menengah',
    starter2Prompt: 'Buatkan itinerary liburan 3 hari ke Bali minggu depan, suka pantai dan kuliner, budget menengah',
    starter3Label: 'Bandung, akhir pekan',
    starter3Hint: 'Kuliner & alam, budget hemat',
    starter3Prompt: 'Buatkan itinerary wisata kuliner dan alam 2 hari di Bandung akhir pekan depan, budget hemat',

    // Memory Panel
    memoryHeader: 'Hal yang Rute ingat tentangmu',
    memoryEmpty: 'Belum ada. Sebutkan hal seperti “suka pantai” atau “budget hemat” di chat.',
    memoryNoticeSaved: 'Preferensi disimpan.',
    memoryNoticeDeleted: 'Preferensi dihapus dari memori.',

    // Finished Trip Card
    tripReadyBadge: 'SELESAI',
    tripReadyTitle: 'Laporan {dest} ({days} Hari) Siap!',
    tripReadyDesc: 'Dokumen perjalananmu sudah siap. Ketuk tombol di bawah untuk mengunduh laporan PDF resmi, atau eksplorasi jadwal, peta rute, dan rincian biaya:',
    btnFullReport: 'Laporan Lengkap (PDF)',
    btnShareWa: 'Bagikan ke WhatsApp',
    btnPackingList: 'Checklist Bawaan',
    btnCalendar: 'Kalender (.ics)',

    // Follow-up Questions
    followupTitle: 'Pertanyaan lanjutan:',
    qCulinary: 'Rekomendasi kuliner lokal autentik & halal',
    qTransport: 'Info sewa motor harian & rute hemat',
    qSunset: 'Spot sunset & panorama terbaik',
    qPacking: 'Checklist barang bawaan traveler',

    // Workspace
    workspaceSchedule: 'Jadwal',
    workspaceMap: 'Peta',
    workspaceExpenses: 'Biaya',
    workspaceTitleDefault: 'Ke mana kita pergi?',
    workspaceSubtitleDefault: 'Mulai rancang liburan impian',
    emptyTitle: 'Ceritakan liburan impianmu.',
    emptyDesc: 'Tulis tujuan, berapa hari, dan gaya liburanmu. Rute mencari tempat nyata di OpenStreetMap, mengecek cuaca, lalu menyusun jadwal per hari.',
    emptyGuideLink: 'Pelajari panduan fitur & contoh prompt ➔',
    savedBadge: 'Tersimpan',
    explorationDays: '{days} hari eksplorasi · Jadwal terpadu',
    clickCardHint: 'Klik kartu hari untuk fokus rute & peta interaktif',
    allDays: 'Semua hari',
    dayNumber: 'Hari {num}',
    dayActivitiesCount: '{days} hari · {activities} aktivitas terencana',
    editDay: 'Ubah',
    editDayPromptPrefix: 'Ubah itinerary hari ke-{day}: ',
    routeInMaps: 'Rute Hari di Google Maps',
    reviewsCount: '{count}rb',

    // Expenses View
    expensesTitle: 'Kalkulator Bujet & Transparansi Anggaran',
    expensesSubtitle: 'Estimasi biaya riil disesuaikan dengan destinasi dan durasi hari perjalananmu.',
    budgetModeLabel: 'Mode Anggaran',
    budgetHemat: 'Hemat',
    budgetStandar: 'Standar',
    budgetNyaman: 'Nyaman',
    travelersLabel: 'Peserta',
    travelerUnit: 'Orang',
    itemFlightTrain: 'Transportasi Utama (PP)',
    itemLodging: 'Penginapan ({days} malam)',
    itemTransport: 'Sewa Kendaraan & BBM',
    itemFood: 'Konsumsi & Kuliner ({meals}x makan)',
    itemAttraction: 'Tiket Wisata & Rekreasi',
    totalEstimatedCost: 'Estimasi Total Biaya',
    perPerson: 'per orang',

    // Packing List Modal
    packingTitleModal: 'Checklist Barang Bawaan',
    packingSubtitle: 'Rekomendasi perlengkapan untuk {days} hari di {dest}',
    packingCatClothing: 'Pakaian & Sandang',
    packingCatDocs: 'Dokumen & Finansial',
    packingCatGadget: 'Gadget & Elektronik',
    packingCatHealth: 'Kesehatan & Kebersihan',
    packingCatSpecific: 'Khusus Destinasi ({dest})',
    packingProgress: '{completed} dari {total} barang siap ({percent}%)',
    packingReset: 'Reset',
    packingClose: 'Selesai',

    // Spotlight Tour
    spotlightStep1Title: 'Konsultasi & Ceritakan Rencana Liburanmu',
    spotlightStep1Desc: 'Ketik destinasi, durasi hari, jumlah orang, dan gaya liburanmu di sini (misal: "Liburan 3 hari di Bali bareng teman budget 2 jutaan"). AI Rute otomatis mencocokkan tempat nyata dan cuaca terkini.',
    spotlightStep2Title: 'Workspace Rencana Terpadu',
    spotlightStep2Desc: 'Setelah AI selesai merancang jadwal, panel kanan ini langsung menampilkan itinerary harian terstruktur lengkap dengan jam aktivitas, foto destinasi, dan rating lokasi.',
    spotlightStep3Title: 'Kalkulator Biaya & Transparansi Anggaran',
    spotlightStep3Desc: 'Buka tab ini untuk melihat perkiraan biaya tiket PP, penginapan, sewa motor & BBM, makan 3x sehari, dan tiket wisata. Kamu bisa mengganti mode budget (Hemat/Standar/Nyaman) dan jumlah peserta secara instan.',
    spotlightStep4Title: 'Peta Rute & Navigasi 1-Klik Google Maps',
    spotlightStep4Desc: 'Visualisasikan sebaran titik wisata harian dan jalur jalan secara geografis. Di setiap hari dan pin peta, ada tombol 1-klik untuk langsung membuka rute turn-by-turn di aplikasi Google Maps ponselmu.',
    spotlightStep5Title: 'Bawa Rencana Traveling Offline',
    spotlightStep5Desc: 'Unduh dokumen resmi PDF siap cetak, simpan jadwal ke Google atau Apple Calendar (.ics), atau bagikan ringkasan rute langsung ke WhatsApp teman perjalananmu sebelum berangkat!',
    spotlightNext: 'Lanjut',
    spotlightPrev: 'Sebelumnya',
    spotlightFinish: 'Mulai Rencanakan',
    spotlightSkip: 'Lewati',
    spotlightStepBadge: 'Langkah {step}',

    // Tutorial Modal
    tutorialHeaderTitle: 'Panduan Menggunakan Rute',
    tutorialHeaderSubtitle: 'Kuasai fitur perencanaan perjalanan dalam hitungan menit',
    tutorialTabTour: 'Panduan Fitur',
    tutorialTabPrompts: 'Contoh Prompt',
    tutorialSpotlightBtn: 'Coba Tur Spotlight di Layar',
    tutorialMobileTourBtn: 'Tur Layar',
    tutorialDontShow: 'Jangan tampilkan otomatis lagi',

    // Auth & Trips Modal
    tripsModalTitle: 'Perjalanan Saya',
    tripsModalSubtitle: 'Itinerary tersimpan di akunmu, terbaru di atas.',
    tripsEmpty: 'Belum ada perjalanan tersimpan di akun ini.',
    tripsLoading: 'Memuat perjalanan…',
    authModalLoginTitle: 'Masuk ke Akun',
    authModalRegisterTitle: 'Daftar Akun Baru',
  },

  en: {
    // Navbar
    searchPlaceholder: 'Search destinations, beaches, food…',
    searchInDest: 'Search places in {dest}…',
    searchAriaLabel: 'Search places or activities',
    clearSearch: 'Clear search query',
    shareWa: 'WhatsApp',
    shareWaTitle: 'Share travel itinerary to WhatsApp',
    packing: 'Packing',
    packingTitle: 'Open traveler packing checklist',
    guide: 'Guide',
    guideTitle: 'Usage guide & prompt examples',
    reportPdf: 'PDF',
    reportPdfTitle: 'Download travel report (PDF)',
    calendar: 'Calendar',
    calendarTitle: 'Export to calendar (.ics)',
    newSession: 'New Trip',
    newSessionTitle: 'Start a new session and create an itinerary from scratch',
    themeLightTooltip: 'Switch to Light Mode',
    themeDarkTooltip: 'Switch to Dark Mode',
    langSwitchTooltip: 'Ganti ke Bahasa Indonesia',
    userMenu: 'User menu',
    signInOrRegister: 'Sign In / Register',
    myTrips: 'My Trips',
    spotlightTour: 'Interactive Spotlight Tour',
    savedPreferences: 'Saved Preferences',
    signOut: 'Sign Out',

    // Chat Panel Header & Starter
    assistantTitle: 'Rute Assistant',
    assistantSubtitleReady: 'Ready to plan your journey',
    assistantSubtitleDrafting: 'Drafting itinerary…',
    memoryBtn: 'Memory',
    memoryTitle: 'Manage remembered travel preferences',
    reportBtn: 'Report',
    reportBtnTitle: 'Download Printable Travel Report',
    menuBtn: 'Menu',
    menuBtnAria: 'Back to Menu / Schedule',
    newToRute: 'New to Rute? See how it works & features',
    openGuideBtn: 'Open Guide ➔',
    tryStartingWith: 'Try starting with:',
    interactiveTourBtn: 'Interactive Tour',
    interactiveTourTitle: 'Start interactive on-screen spotlight tour',
    chatPlaceholder: 'Where do you want to travel?',
    chatDisclaimer: 'Always verify tickets & opening hours before departing',
    greeting: 'Hello! Where would you like to travel? Mention your destination (e.g. Bali, Bandung, Labuan Bajo), duration in days, and preferred travel style. Rute will craft a complete itinerary with map routes and budget estimates!',

    // Starter Prompts
    starter1Label: 'Labuan Bajo, 5 days',
    starter1Hint: 'Island hopping + bike rental',
    starter1Prompt: 'Create a 5-day 4-night itinerary in Labuan Bajo starting next week, with top attractions, 3 meals a day, and scooter rental',
    starter2Label: 'Bali, 3 days',
    starter2Hint: 'Beach & dining, moderate budget',
    starter2Prompt: 'Create a 3-day travel itinerary to Bali next week, beach & culinary focus, moderate budget',
    starter3Label: 'Bandung, weekend',
    starter3Hint: 'Culinary & nature, budget friendly',
    starter3Prompt: 'Create a 2-day weekend itinerary for culinary and nature in Bandung, budget friendly',

    // Memory Panel
    memoryHeader: 'Things Rute remembers about you',
    memoryEmpty: 'None yet. Mention things like “loves beach” or “budget friendly” in chat.',
    memoryNoticeSaved: 'Preference saved.',
    memoryNoticeDeleted: 'Preference removed from memory.',

    // Finished Trip Card
    tripReadyBadge: 'COMPLETED',
    tripReadyTitle: '{dest} Travel Report ({days} Days) Ready!',
    tripReadyDesc: 'Your trip plan is ready. Click below to download the official PDF report, or explore the schedule, interactive map, and budget breakdown:',
    btnFullReport: 'Full Report (PDF)',
    btnShareWa: 'Share to WhatsApp',
    btnPackingList: 'Packing Checklist',
    btnCalendar: 'Calendar (.ics)',

    // Follow-up Questions
    followupTitle: 'Follow-up questions:',
    qCulinary: 'Top authentic & halal local dining recommendations',
    qTransport: 'Daily scooter rental & most efficient route',
    qSunset: 'Best sunset view spots & photo panoramas',
    qPacking: 'Traveler packing checklist & essentials',

    // Workspace
    workspaceSchedule: 'Schedule',
    workspaceMap: 'Map',
    workspaceExpenses: 'Expenses',
    workspaceTitleDefault: 'Where are we heading?',
    workspaceSubtitleDefault: 'Start planning your dream vacation',
    emptyTitle: 'Tell us about your dream trip.',
    emptyDesc: 'Type your destination, number of days, and travel style. Rute searches real places on OpenStreetMap, checks weather, and crafts a daily schedule.',
    emptyGuideLink: 'Learn features guide & prompt examples ➔',
    savedBadge: 'Saved',
    explorationDays: '{days} days exploration · Integrated schedule',
    clickCardHint: 'Click a day card to focus map & route',
    allDays: 'All days',
    dayNumber: 'Day {num}',
    dayActivitiesCount: '{days} days · {activities} planned activities',
    editDay: 'Edit',
    editDayPromptPrefix: 'Change itinerary for day {day}: ',
    routeInMaps: 'View Day Route in Google Maps',
    reviewsCount: '{count}k',

    // Expenses View
    expensesTitle: 'Budget Calculator & Cost Transparency',
    expensesSubtitle: 'Realistic cost estimates tailored to your destination and trip duration.',
    budgetModeLabel: 'Budget Mode',
    budgetHemat: 'Budget',
    budgetStandar: 'Standard',
    budgetNyaman: 'Comfort',
    travelersLabel: 'Travelers',
    travelerUnit: 'Person(s)',
    itemFlightTrain: 'Main Transport (Roundtrip)',
    itemLodging: 'Lodging ({days} nights)',
    itemTransport: 'Scooter Rental & Fuel',
    itemFood: 'Meals & Dining ({meals} meals)',
    itemAttraction: 'Sightseeing & Entrance Tickets',
    totalEstimatedCost: 'Estimated Total Cost',
    perPerson: 'per person',

    // Packing List Modal
    packingTitleModal: 'Travel Packing Checklist',
    packingSubtitle: 'Recommended packing list for {days} days in {dest}',
    packingCatClothing: 'Clothing & Apparel',
    packingCatDocs: 'Documents & Money',
    packingCatGadget: 'Gadgets & Electronics',
    packingCatHealth: 'Health & Personal Care',
    packingCatSpecific: 'Destination Specific ({dest})',
    packingProgress: '{completed} of {total} items ready ({percent}%)',
    packingReset: 'Reset',
    packingClose: 'Done',

    // Spotlight Tour
    spotlightStep1Title: 'Consult & Describe Your Travel Plans',
    spotlightStep1Desc: 'Type your destination, trip length, group size, and travel style here (e.g., "3 days in Bali with friends on a budget"). Rute AI automatically matches real places and live weather.',
    spotlightStep2Title: 'Integrated Plan Workspace',
    spotlightStep2Desc: 'Once AI finishes planning, this right-hand workspace shows a structured daily timeline complete with activity hours, place photos, and Google ratings.',
    spotlightStep3Title: 'Budget Calculator & Cost Transparency',
    spotlightStep3Desc: 'Open this tab to view estimated roundtrip transport, accommodation, bike rental, 3x meals daily, and attraction tickets. Toggle budget modes (Budget/Standard/Comfort) instantly.',
    spotlightStep4Title: 'Interactive Route Map & 1-Click Google Maps',
    spotlightStep4Desc: 'Visualize daily stops and road routes geographically. Each day and map pin includes a 1-click button to launch turn-by-turn navigation in your phone Google Maps app.',
    spotlightStep5Title: 'Take Your Travel Plan Offline',
    spotlightStep5Desc: 'Download printable official PDF reports, sync events into Google or Apple Calendar (.ics), or share route summaries directly to WhatsApp with your travel companions!',
    spotlightNext: 'Next',
    spotlightPrev: 'Previous',
    spotlightFinish: 'Start Planning',
    spotlightSkip: 'Skip',
    spotlightStepBadge: 'Step {step}',

    // Tutorial Modal
    tutorialHeaderTitle: 'Rute User Guide',
    tutorialHeaderSubtitle: 'Master itinerary planning features in just minutes',
    tutorialTabTour: 'Feature Guide',
    tutorialTabPrompts: 'Sample Prompts',
    tutorialSpotlightBtn: 'Try On-Screen Spotlight Tour',
    tutorialMobileTourBtn: 'Tour Screen',
    tutorialDontShow: 'Do not show automatically again',

    // Auth & Trips Modal
    tripsModalTitle: 'My Trips',
    tripsModalSubtitle: 'Saved itineraries on your account, latest on top.',
    tripsEmpty: 'No saved trips on this account yet.',
    tripsLoading: 'Loading trips…',
    authModalLoginTitle: 'Sign In to Account',
    authModalRegisterTitle: 'Create New Account',
  },
} as const

export type TranslationKey = keyof typeof dictionaries.id

type LanguageContextType = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: 'id',
  setLang: () => {},
  t: (key) => dictionaries.id[key] || String(key),
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'id'
    try {
      const saved = localStorage.getItem('rute_language_preference') as Language | null
      if (saved === 'en' || saved === 'id') return saved
      // Detect browser language
      const navLang = navigator.language.toLowerCase()
      return navLang.startsWith('id') ? 'id' : 'en'
    } catch {
      return 'id'
    }
  })

  const setLang = (next: Language) => {
    setLangState(next)
    try {
      localStorage.setItem('rute_language_preference', next)
      document.documentElement.lang = next
    } catch {
      // Ignore storage error
    }
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    const dict = dictionaries[lang] || dictionaries.id
    let text: string = dict[key] || dictionaries.id[key] || String(key)
    if (vars) {
      for (const [vKey, vVal] of Object.entries(vars)) {
        text = text.replaceAll(`{${vKey}}`, String(vVal))
      }
    }
    return text
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
