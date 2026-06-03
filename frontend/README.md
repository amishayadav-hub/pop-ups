# NexCent Frontend

Next.js 14 (App Router) + TypeScript + Tailwind CSS dashboard with a banner uploader.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Structure

- [app/page.tsx](app/page.tsx) — dashboard page (sidebar + main section).
- [components/Sidebar.tsx](components/Sidebar.tsx) — 3-button sidebar nav.
- [components/BannerUploader.tsx](components/BannerUploader.tsx) — upload + replace + submit flow.
- [components/ui/button.tsx](components/ui/button.tsx) — shadcn-style Button primitive.

Accepted upload types: `.jpg`, `.jpeg`, `.pdf`.
