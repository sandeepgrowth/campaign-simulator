# ⚡ Campaign Performance Simulator

Google Ads App Install Campaign simulator with CPI · CPA · CPRT · CPFT metrics,
Search / YouTube / Display network behavior, bid elasticity, and INR currency.

---

## 🚀 Deploy to Vercel (2 min, free, public URL)

### Step 1 — Install Node.js
Download from https://nodejs.org (choose LTS version)

### Step 2 — Unzip & enter the folder
```bash
cd campaign-simulator
```

### Step 3 — Install dependencies
```bash
npm install
```

### Step 4 — Test locally first (optional)
```bash
npm run dev
# Open http://localhost:5173
```

### Step 5 — Deploy to Vercel
```bash
npm install -g vercel
vercel
```
- Answer the prompts (press Enter for all defaults)
- Vercel will give you a live URL like: `https://campaign-simulator-xyz.vercel.app`

---

## 🌐 Alternative: Deploy to Netlify (drag & drop, no CLI)

### Step 1-3: Same as above (install Node, npm install)

### Step 4 — Build
```bash
npm run build
```
This creates a `/dist` folder.

### Step 5 — Drag & drop
1. Go to https://netlify.com → Log in → "Add new site" → "Deploy manually"
2. Drag the `/dist` folder onto the page
3. Get your live URL instantly ✓

---

## 🔧 Local development
```bash
npm install
npm run dev
# → http://localhost:5173
```

## 📦 Project structure
```
campaign-simulator/
├── index.html          # Entry HTML
├── package.json        # Dependencies
├── vite.config.js      # Vite config
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx        # React root
    └── App.jsx         # ← The simulator (all logic here)
```

## 📦 Dependencies
- React 18
- Recharts 2
- Vite 5 (build tool)
