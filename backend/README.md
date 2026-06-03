# NexCent — Firebase backend

Backend for the intent-based popup platform. Powers the admin dashboard (`frontend/`) and serves the storefront SDK that runs on the Shopify site (anveshan.farm).

## What's here

```
backend/
├── firebase.json           Firebase project config (rules, hosting, functions)
├── .firebaserc             Project alias — edit with your real project id
├── firestore.rules         Firestore security rules
├── firestore.indexes.json  Composite indexes for events queries
├── storage.rules           Cloud Storage rules (banner uploads)
│
├── functions/              Cloud Functions (TypeScript) — region: asia-south1
│   └── src/
│       ├── index.ts        Function exports
│       ├── http.ts         HTTPS: getConfig + recordEvent (SDK talks to these)
│       ├── auth.ts         API-key validation (hash, origin, enabled)
│       ├── aggregate.ts    Firestore trigger: rolls events → metrics + popups
│       ├── benchmarks.ts   Daily cron: 30-day CTR by position
│       └── types.ts
│
├── sdk/                    Storefront SDK that runs on anveshan.farm
│   ├── build.mjs           esbuild config — outputs public/v1/popup.{js,css}
│   ├── src/
│   │   ├── index.ts        SDK entry: bootstrap, schedule, fire events
│   │   ├── intent.ts       Intent triggers (entry, exit, delay) — mobile + desktop
│   │   ├── render.ts       Popup DOM + discount-redirect handler
│   │   ├── api.ts          Talks to Cloud Functions
│   │   ├── visitor.ts      Visitor/session ids, first-visit detection
│   │   ├── storage.ts      Frequency cap (localStorage / sessionStorage)
│   │   ├── popup.css       Styling (mobile-first bottom sheet, desktop modal)
│   │   └── types.ts
│   └── public/v1/          Built output (served by Firebase Hosting)
│
└── scripts/
    └── seed.ts             One-shot Firestore seed + generates an API key
```

## One-time setup

1. **Install the Firebase CLI** globally:
   ```
   npm i -g firebase-tools
   firebase login
   ```

2. **Create a Firebase project** at https://console.firebase.google.com → write its project ID into `.firebaserc` (replace `your-firebase-project-id`).

3. **Enable services** in the console:
   - Firestore (Production mode, region `asia-south1` Mumbai)
   - Cloud Storage
   - Hosting (enable for this project)
   - Authentication → Email/Password provider

4. **Install dependencies** (three folders):
   ```
   cd backend/functions && npm install
   cd backend/scripts   && npm install
   cd backend/sdk       && npm install
   ```

5. **Generate a service account key** (for the seed script only):
   - Firebase console → Project settings → Service accounts → "Generate new private key"
   - Save as `backend/scripts/service-account.json` (gitignored)

6. **Seed Firestore + mint an API key**:
   ```
   cd backend/scripts
   npm run seed
   ```
   The output prints an API key — **save it immediately**, it is never shown again. It also prints the exact `<script>` snippet to paste into Shopify.

7. **Build the storefront SDK**:
   ```
   cd backend/sdk
   npm run build
   ```
   Outputs minified `public/v1/popup.js` + `popup.css`.

## Deploy

From `backend/`:

```
firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting
```

Or piecemeal:

```
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
firebase deploy --only functions       # deploys getConfig, recordEvent, aggregateEvent, computePositionBenchmarks
firebase deploy --only hosting         # serves popup.js + popup.css from PROJECT.web.app
```

After hosting deploys you'll see:
```
Hosting URL: https://YOUR-PROJECT.web.app
```
The SDK is live at `https://YOUR-PROJECT.web.app/v1/popup.js`.

## Install on Shopify (Anveshan)

In the Shopify admin:

1. **Online Store → Themes → Edit code** on the live theme.
2. Open `layout/theme.liquid`.
3. Paste this just before `</body>`:

```html
<script async
  src="https://YOUR-PROJECT.web.app/v1/popup.js"
  data-api-key="ank_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  data-endpoint="https://asia-south1-YOUR-PROJECT.cloudfunctions.net"></script>
```

Replace both `YOUR-PROJECT` with your project id and `data-api-key` with the value printed by `npm run seed`.

The SDK then:
- Detects new visitors → entry popup with first-purchase discount after 4s
- Detects exit intent → desktop mouseleave-top, mobile back-button + scroll-up
- Delays promotional popup 25s on matching pages (e.g. `/products/groundnut-oil`)
- On CTA click → redirects via `/discount/CODE?redirect=/path` (Shopify auto-applies the discount to the cart)
- Fires impression/click/convert events to `recordEvent` → aggregated live into the dashboard

## Local development

### Run the emulator suite
```
cd backend
firebase emulators:start
```
Emulator UI: http://localhost:4000 — Firestore + Functions + Storage + Hosting all local.

### Watch-rebuild the SDK
```
cd backend/sdk
npm run watch
```

## Connect the frontend dashboard

1. Firebase console → Project settings → General → Your apps → register a **Web app**, copy the config.
2. In `frontend/`, copy `.env.local.example` → `.env.local` and fill in:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR-PROJECT.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR-PROJECT
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR-PROJECT.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   NEXT_PUBLIC_USE_FIREBASE=true
   ```
3. Restart `npm run dev` — `frontend/lib/api.ts` switches from mock to live Firestore.

## Make yourself admin

Security rules require `request.auth.token.admin == true` for writes. Set the custom claim once via the Admin SDK from `backend/scripts/`:

```
node -e "const a=require('firebase-admin');a.initializeApp({credential:a.credential.cert('./service-account.json')});a.auth().setCustomUserClaims('USER_UID',{admin:true}).then(()=>console.log('ok'))"
```

Replace `USER_UID` with the uid from Firebase Auth → Users.

## Data model

| Collection | Doc id | Shape |
|---|---|---|
| `popups/{popupId}` | `exit-intent`, `entry`, `promotional`, `countdown`, `weather` | `PopupDoc` |
| `popupTypes/{typeId}` | 4 ids (no `weather`) | `PopupTypeCard` |
| `cities/{code}` | IATA code (`BLR`, `BOM`, …) | `City` |
| `config/global` | `global` | `{ currentPosition, weatherRule }` |
| `benchmarks/positions` | `positions` | `{ positions: PositionBenchmark[], computedAt }` |
| `metrics/summary` | `summary` | impressions / clicks / conversions + intent + funnel |
| `events/{eventId}` | auto-id | `EventDoc` — written only by `recordEvent` function |
| `apiKeys/{sha256(key)}` | hash of plaintext key | `ApiKeyDoc` — never readable from client |

## Event flow

```
Anveshan storefront
       │
       │ <script src=".../popup.js" data-api-key=ank_live_...>
       ▼
   popup.js (SDK)
       │
       ├──── GET /getConfig?key=…  ──▶  validates key → reads popups/cities/config
       │
       │   (intent fires: entry / exit / delay)
       │
       ├──── shows popup → fires impression
       ├──── CTA click   → fires click + convert → redirect /discount/CODE?redirect=…
       │
       └──── POST /recordEvent ─▶ writes events/{id} ─▶ aggregateEvent trigger
                                                      │
                                                      ├─▶ metrics/summary  (counters)
                                                      └─▶ popups/{id}      (per-popup CTR)

daily 02:00 cron ──read events (30d)──▶ benchmarks/positions
```

## API surface

### `GET /getConfig?key=<API_KEY>`
- Returns active popups + config for that site.
- Validates: key exists, enabled, origin matches `allowedOrigins`.
- Cached `Cache-Control: public, max-age=60`.

### `POST /recordEvent?key=<API_KEY>`
- Body: `{ popupId, type, conversionKind?, intent?, position?, visitorId, sessionId, page, device }`
- Validates: same as above, plus 60 req/min per-IP rate limit.
- Writes to `events/{id}` → triggers aggregator.

## Rotating an API key

```
node -e "..."   # see scripts/seed.ts generateApiKey() for the format
```
Or just rerun `npm run seed` (it will mint a fresh key and overwrite seed data — only use in dev).
