// Curated high quality Unsplash travel images optimized for fast rendering
const TRAVEL_COLLECTIONS: Record<string, string[]> = {
  bali: [
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80', // Beach cliff
    'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=800&q=80', // Ubud rice terrace
    'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80', // Temple sea
    'https://images.unsplash.com/photo-1555400038-63f5ba517a47?auto=format&fit=crop&w=800&q=80', // Uluwatu
    'https://images.unsplash.com/photo-1570789210967-2cac24afeb00?auto=format&fit=crop&w=800&q=80', // Nusa Penida
  ],
  bandung: [
    'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=800&q=80', // Tea plantation
    'https://images.unsplash.com/photo-1601058268499-e52658b8bb88?auto=format&fit=crop&w=800&q=80', // Misty volcano
    'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=800&q=80', // Heritage street
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80', // Cozy cafe
  ],
  beach: [
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&w=800&q=80',
  ],
  nature: [
    'https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80',
  ],
  city: [
    'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=800&q=80',
  ],
  temple: [
    'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=800&q=80',
  ],
  food: [
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
  ],
}

const DEFAULT_TRAVEL_IMAGES = [
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
]

export function getDayCoverImage(destination: string, dayNumber: number, activityKeywords: string[] = []): string {
  const destLower = destination.toLowerCase()
  const combinedKeywords = activityKeywords.join(' ').toLowerCase()

  if (destLower.includes('bali')) {
    const list = TRAVEL_COLLECTIONS.bali
    return list[(dayNumber - 1) % list.length]
  }

  if (destLower.includes('bandung')) {
    const list = TRAVEL_COLLECTIONS.bandung
    return list[(dayNumber - 1) % list.length]
  }

  if (combinedKeywords.includes('pantai') || combinedKeywords.includes('beach') || combinedKeywords.includes('laut')) {
    const list = TRAVEL_COLLECTIONS.beach
    return list[(dayNumber - 1) % list.length]
  }

  if (combinedKeywords.includes('pura') || combinedKeywords.includes('candi') || combinedKeywords.includes('temple')) {
    const list = TRAVEL_COLLECTIONS.temple
    return list[(dayNumber - 1) % list.length]
  }

  if (combinedKeywords.includes('gunung') || combinedKeywords.includes('nature') || combinedKeywords.includes('curug') || combinedKeywords.includes('hutan')) {
    const list = TRAVEL_COLLECTIONS.nature
    return list[(dayNumber - 1) % list.length]
  }

  if (combinedKeywords.includes('kuliner') || combinedKeywords.includes('makan') || combinedKeywords.includes('cafe')) {
    const list = TRAVEL_COLLECTIONS.food
    return list[(dayNumber - 1) % list.length]
  }

  if (combinedKeywords.includes('mall') || combinedKeywords.includes('museum') || combinedKeywords.includes('kota')) {
    const list = TRAVEL_COLLECTIONS.city
    return list[(dayNumber - 1) % list.length]
  }

  return DEFAULT_TRAVEL_IMAGES[(dayNumber - 1) % DEFAULT_TRAVEL_IMAGES.length]
}
