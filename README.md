# PokéGrade MVP (Vercel-ready)

A lightweight Next.js MVP that lets users upload Pokémon card images and receive a **non-official pre-grade estimate** based on image quality and visual heuristics.

## Features
- Batch upload for one or more front images.
- Image quality checks (size, blur, glare, framing, resolution).
- Subscores for centering, corners, edges, and surface.
- Overall grade band (`10`, `9`, `8`, `7 or below`).
- Confidence level and recommendation.
- Defect overlays on the front preview.
- Clipboard summary export for quick comparison across uploaded cards.

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Vercel
1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Vercel, click **Add New Project** and import your repo.
3. Framework should auto-detect as **Next.js**.
4. Keep defaults and click **Deploy**.

Or with Vercel CLI:
```bash
npm i -g vercel
vercel
```

## Notes
This MVP is intentionally a pre-screening tool. It does **not** issue official grades or certificates.
