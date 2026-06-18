# ⚡ DownSosmed v11 — SaveFrom Edition

Download video, foto & audio dari TikTok, Instagram, YouTube, Facebook, Twitter, dan 20+ platform lainnya.

## 🏗️ Struktur Project

```
uploads/
├── index.html          ← Frontend (buka langsung)
├── style.css           ← Styling utama
├── enhance.css         ← Animasi & enhancement
├── script.js           ← Frontend logic
├── api/
│   ├── download.js     ← Vercel Serverless: SaveFrom + Ikyy fallback
│   └── proxy.js        ← Vercel Serverless: CORS proxy for download
├── package.json        ← Dependencies (jsdom)
├── vercel.json         ← Vercel routing config
└── README.md
```

## 🚀 Deploy ke Vercel

### 1. Push ke GitHub
```bash
cd uploads
git init
git add .
git commit -m "DownSosmed v11"
git remote add origin https://github.com/YOUR_USERNAME/downsosmed.git
git push -u origin main
```

### 2. Deploy
1. Buka [vercel.com](https://vercel.com)
2. Import repository GitHub
3. **Framework Preset**: Other
4. **Root Directory**: `./` (default)
5. Klik Deploy ✅

### 3. Selesai!
- Frontend: `https://your-project.vercel.app`
- API: `https://your-project.vercel.app/api/download?url=<url>`

## 🔧 Development Lokal

```bash
# Install dependencies
npm install

# Jalankan dengan Vercel CLI
npx vercel dev

# Atau buka index.html langsung + API terpisah
```

## 📡 API Endpoints

### `GET /api/download?url=<encoded_url>`
Download media dari URL social media.

**Response:**
```json
{
  "status": true,
  "provider": "fallback",
  "result": {
    "source": "TikTok",
    "title": "Video title...",
    "thumb": "https://...",
    "medias": [
      { "url": "https://...", "type": "video", "quality": "HD", "extension": "mp4" },
      { "url": "https://...", "type": "audio", "quality": "", "extension": "mp3" }
    ]
  },
  "runtime": "2340ms"
}
```

### `GET /api/proxy?url=<encoded_media_url>`
Proxy download file (bypass CORS).

## ⚙️ Strategi API (Hybrid)

```
User Request
    ↓
┌─────────────┐
│  SaveFrom   │ ← Primary (works from residential IP)
│  Engine     │
└──────┬──────┘
       │ gagal?
       ↓
┌─────────────┐
│  Ikyy API   │ ← Fallback (race: TikWM + Ikyy v3/v4)
│  + TikWM    │
└──────┬──────┘
       │
       ↓
    Response
```

## 🌐 Platform Didukung
TikTok, Instagram, YouTube, Facebook, Twitter/X, Pinterest, Reddit, Vimeo, Dailymotion, LinkedIn, Snapchat, dan lainnya.

---
Made with 💜 by **RizkyMaxz**
