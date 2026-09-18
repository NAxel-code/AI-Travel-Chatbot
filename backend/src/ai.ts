import { Type, FunctionDeclaration } from '@google/genai';

export const buildItineraryDeclaration: FunctionDeclaration = {
  name: 'build_itinerary',
  description: 'Gunakan tool ini ketika kamu memiliki cukup informasi (tujuan, tanggal mulai, tanggal selesai, dan preferensi pengguna) untuk menyusun itinerary. Tool ini akan menyimpan itinerary ke database.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      destination: { type: Type.STRING, description: 'Kota atau wilayah tujuan.' },
      start_date: { type: Type.STRING, description: 'Tanggal mulai dalam format YYYY-MM-DD.' },
      end_date: { type: Type.STRING, description: 'Tanggal selesai dalam format YYYY-MM-DD.' },
      items: {
        type: Type.ARRAY,
        description: 'Daftar aktivitas atau tempat yang akan dikunjungi per harinya.',
        items: {
          type: Type.OBJECT,
          properties: {
            day_number: { type: Type.INTEGER, description: 'Nomor hari (1, 2, dst).' },
            time_slot: { type: Type.STRING, description: 'Waktu (misal: "09:00", "Pagi", "Siang").' },
            title: { type: Type.STRING, description: 'Nama aktivitas atau tempat.' },
            description: { type: Type.STRING, description: 'Deskripsi singkat.' },
            category: { type: Type.STRING, description: 'Kategori (contoh: Food, Sightseeing, Transport).' }
          },
          required: ['day_number', 'time_slot', 'title']
        }
      }
    },
    required: ['destination', 'start_date', 'end_date', 'items']
  }
};

export const systemPrompt = `Kamu adalah AI Travel Planner yang ramah, profesional, dan ahli dalam merencanakan liburan.
Tugas utamamu adalah membantu pengguna menyusun itinerary perjalanan multi-hari.
Ikuti langkah berikut:
1. Sapa pengguna dan tanyakan tujuan, tanggal perjalanan, durasi, dan preferensi liburan mereka (misal: budget, gaya liburan).
2. Tanyakan secara bertahap, jangan mencecar pengguna dengan terlalu banyak pertanyaan sekaligus.
3. Setelah kamu mengumpulkan informasi yang CUKUP, gunakan tool 'build_itinerary' untuk membuat rencana perjalanan terstruktur.
4. JANGAN memberikan rekomendasi itinerary panjang dalam bentuk teks biasa; selalu gunakan tool 'build_itinerary' agar data tersimpan di database.
5. Setelah memanggil tool, beritahu pengguna bahwa itinerary telah dibuat dan mereka bisa melihatnya di layar utama, lalu tanyakan apakah mereka ingin melakukan penyesuaian.`;
