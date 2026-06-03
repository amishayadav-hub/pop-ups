# 🔥 Blaze plan code (inactive)

Everything in this folder is **Cloud-Functions-era code** that's currently NOT used. The project runs on Firebase **Spark** (free plan) which doesn't allow Cloud Functions, so all this code is parked here.

When you upgrade to Blaze (pay-as-you-go), follow the activation guide at the bottom to swap from the current "direct Firestore" (spark) architecture back to the proper Cloud-Functions architecture.

## What's in here

```
backend/blaze/
├── sdk/                              Storefront SDK that talks to Cloud Functions
│   ├── package.json, tsconfig.json, build.mjs
│   ├── src/
│   │   ├── api.ts                    fetch → /getConfig + /recordEvent
│   │   ├── index.ts                  reads data-api-key + data-endpoint from script tag
│   │   ├── intent.ts, render.ts, storage.ts, visitor.ts, types.ts
│   │   └── popup.css
│   └── public/
│
├── functions/                        Cloud Functions source (TypeScript)
│   ├── package.json, tsconfig.json
│   └── src/
│       ├── index.ts                  function exports
│       ├── http.ts                   getConfig + recordEvent HTTPS endpoints
│       ├── auth.ts                   SHA-256 API key validation
│       ├── aggregate.ts              Firestore trigger → metrics/summary increment
│       ├── benchmarks.ts             daily cron 02:00 IST → 30-day position CTR
│       └── types.ts
│
└── frontend-overlays/
    └── firebase-api.ts               Dashboard API variant that reads pre-aggregated
                                      metrics/summary (instead of computing from events)
```

## What the Blaze version gives you vs the current Spark version

| Aspect | Spark (current) | Blaze (this folder) |
|---|---|---|
| Storefront → backend communication | Direct Firestore REST | Through Cloud Function endpoints |
| API key validation | None (rules check shape only) | Server-side SHA-256 check + origin allowlist |
| Rate limiting | Firestore quotas only | 60 req/min per IP enforced by function |
| Analytics aggregation | Computed on every dashboard load (slow at scale) | Pre-aggregated via Firestore trigger (instant) |
| Daily position benchmarks | Manual / never | Auto-recomputed daily at 02:00 IST |
| Required Firebase plan | Spark (free) | Blaze (pay-as-you-go, free tier covers most) |
| Storefront install snippet attributes | `data-project`, `data-web-key` | `data-api-key`, `data-endpoint` |

## When to activate

You'd want Blaze when:
- Anveshan traffic crosses ~2000 visitors/day (analytics on Spark gets slow)
- You want a real per-IP rate limit
- You want proper API key rotation
- You want offline analytics dashboards (no event scanning on each load)

Practical Blaze cost for Anveshan-scale traffic: ~₹0/month. Free tier (2M function invocations + 5M Firestore reads/day) is way more than needed.

---

## Activation guide — Spark → Blaze switch

### 1. Upgrade Firebase project to Blaze

- Console → ⚙️ Settings → Usage and billing → **Modify plan** → Blaze
- Add a payment method

### 2. Restore frontend Cloud-Functions API variant

```powershell
# Copy the dashboard API back into place
cp backend\blaze\frontend-overlays\firebase-api.ts frontend\lib\firebase-api.ts
```

Then edit `frontend/lib/api.ts`:

```diff
- import { firebaseSparkApi } from "./firebase-api-spark";
+ import { firebaseApi } from "./firebase-api";

- export const api = USE_FIREBASE ? firebaseSparkApi : mockApi;
+ export const api = USE_FIREBASE ? firebaseApi : mockApi;
```

### 3. Swap hosting source in `backend/firebase.json`

```diff
  "hosting": {
-   "public": "sdk-spark/public",
+   "public": "blaze/sdk/public",
    ...
  }
```

(`functions.source` already points at `blaze/functions` — no change needed.)

### 4. Tighten Firestore events rule

`backend/firestore.rules` currently allows clients to write events directly (Spark mode). Change it back to:

```diff
  match /events/{eventId} {
    allow read: if isAdmin();
-   allow create: if
-     request.resource.data.keys().hasAll(['popupId', 'type', 'ts'])
-     && ...
+   allow create, update, delete: if false;
  }
```

Now only the Cloud Function (running as admin) can write events.

### 5. Install function deps + build the Blaze SDK

```powershell
cd backend\blaze\functions
npm install

cd ..\sdk
npm install
npm run build
```

### 6. Deploy everything

```powershell
cd backend
firebase deploy --only firestore:rules,functions,hosting
```

You should see all 4 functions deploy:
- `getConfig` (HTTPS)
- `recordEvent` (HTTPS)
- `aggregateEvent` (Firestore trigger)
- `computePositionBenchmarks` (Scheduler)

### 7. Update the Shopify storefront script tag

The script tag changes back to using API key + endpoint:

```html
<script async
        src="https://anveshan-popups.web.app/v1/popup.js"
        data-api-key="ank_live_851745e5e79ad06b63a110331cbf0217e81130a8"
        data-endpoint="https://asia-south1-anveshan-popups.cloudfunctions.net"></script>
```

That API key was minted by the original seed run — still valid (stored as SHA-256 hash in `apiKeys/` collection in Firestore).

### 8. Verify

- Open https://anveshan-popups.web.app/test.html in incognito
- DevTools → Network → look for `getConfig` (should be 200 from cloudfunctions.net, not Firestore)
- DevTools → Network → click CTA → look for `recordEvent` POST (200)
- Firebase Console → Functions → check logs for `getConfig`/`recordEvent` invocations
- Dashboard → metrics should now update in real-time after each storefront event

---

## Activation checklist (TL;DR)

- [ ] Upgrade to Blaze in Firebase console
- [ ] Copy `frontend-overlays/firebase-api.ts` → `frontend/lib/firebase-api.ts`
- [ ] Edit `frontend/lib/api.ts` import + export to use `firebaseApi`
- [ ] Edit `backend/firebase.json` hosting public path to `blaze/sdk/public`
- [ ] Edit `backend/firestore.rules` events rule back to admin-only
- [ ] `npm install` in `blaze/functions/` and `blaze/sdk/`
- [ ] `npm run build` in `blaze/sdk/`
- [ ] `firebase deploy --only firestore:rules,functions,hosting`
- [ ] Update Shopify script tag with `data-api-key` + `data-endpoint`

## Rolling back to Spark

Reverse of above:
- Change hosting back to `sdk-spark/public`
- Change `api.ts` back to `firebaseSparkApi`
- Loosen events rule to allow validated client writes
- `firebase deploy --only firestore:rules,hosting` (don't need to redeploy functions — they stay but aren't called)
