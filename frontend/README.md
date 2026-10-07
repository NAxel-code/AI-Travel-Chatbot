# Frontend Rute

Antarmuka React/Vite untuk AI Travel Planner. Dokumentasi lengkap, setup backend, API, migrasi, dan deployment ada di [`../README.md`](../README.md).

## Lokal

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

`VITE_API_BASE` harus berisi URL API Worker dengan suffix `/api` dan tanpa trailing slash. Default aplikasi adalah `http://localhost:8787/api`.

## Verifikasi

```powershell
npm run lint
npm test
npm run build
```
