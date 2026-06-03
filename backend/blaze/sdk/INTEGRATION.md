# Anveshan Shopify integration

## The snippet

Paste this **once** into `Online Store → Themes → Edit code → theme.liquid`, just before the closing `</body>` tag:

```html
<script async
        src="https://YOUR-PROJECT.web.app/v1/popup.js"
        data-api-key="ank_live_..."></script>
```

Replace `YOUR-PROJECT` with your Firebase project ID and `ank_live_...` with the key printed by the seed script.

That's it. Save the theme. No other code changes needed on Shopify.

## What runs on the storefront

| Popup | Trigger | Frequency |
|---|---|---|
| **Entry (new user)** | First visit, 2.5s after page load | Once per visitor |
| **Exit intent** | Desktop: cursor leaves top edge. Mobile: back button or tab-switch after 8s engagement | Once per day |
| **Promotional** | URL matches `targetUrlPatterns` on the popup doc | Once per session |
| **Countdown** | 5.5s after load if not shown this session | Once per session |
| **Weather** | (paused — weather provider not wired yet) | — |

Only **one** popup shows at a time. Highest-priority match wins.

## What happens on click

1. Fires `click` event and `convert` event (`conversionKind: "click"`)
2. Sets a 24h attribution flag in `localStorage`
3. Navigates to `/discount/<CODE>?redirect=<redirectPath>` — Shopify auto-applies the discount and lands the user on the redirect page

## Add-to-cart attribution

The SDK monkey-patches `fetch` and `XMLHttpRequest` to detect Shopify's `/cart/add.js` calls. If a user adds to cart within 24h of clicking a popup CTA, a second `convert` event (`conversionKind: "add_to_cart"`) fires.

No checkout-completed tracking yet — that needs a Shopify Web Pixel (planned Phase 7).

## Testing locally

From `backend/`:

```bash
firebase emulators:start
```

Then open http://localhost:5000/test.html. Hit "Reset all popups" between runs.

## Tuning popups

Edit the docs in Firestore directly, or use the seed script. Per-popup fields:

| Field | Notes |
|---|---|
| `headline`, `subheadline`, `ctaText` | Copy shown on the popup |
| `discountCode` | Shopify discount code (auto-applied on CTA click) |
| `redirectPath` | Where the user lands after the discount is applied |
| `targetUrlPatterns` | (promotional only) Array of `/path/prefix` strings — popup only fires when `location.pathname` starts with one of them |
| `frequency` | `once-per-visitor` / `once-per-day` / `once-per-session` / `always` |
| `bannerUrl` | Optional `.webp` URL uploaded via the dashboard |
| `status` | `active` or `paused` |
| `position` | Desktop placement (mobile is always a bottom sheet) |

## Debug mode

Add `data-debug="true"` to the script tag to log every config fetch and event to the console.

## Removing the snippet

Delete the `<script>` line from `theme.liquid`. No data is lost; events stop flowing immediately.
