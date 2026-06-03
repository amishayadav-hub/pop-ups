import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";

const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  path.join(__dirname, "service-account.json");

if (!fs.existsSync(KEY_PATH)) {
  console.error(
    `Service account key not found at ${KEY_PATH}.\n` +
      `Download one from Firebase console → Project settings → Service accounts → Generate new private key,\n` +
      `then save it as backend/scripts/service-account.json (or set GOOGLE_APPLICATION_CREDENTIALS).`,
  );
  process.exit(1);
}

initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore(undefined as any, "default");

const POPUPS = [
  {
    id: "entry",
    name: "Welcome — new user",
    status: "active",
    position: "center",
    order: 0,
    headline: "Welcome to Anveshan!",
    subheadline: "Flat 10% off on your first purchase of A2 ghee, oils & more.",
    ctaText: "Claim 10% off",
    discountCode: "FIRST10",
    redirectPath: "/collections/all",
    frequency: "once-per-visitor",
    ctr: 5.2,
    conversions: 287,
  },
  {
    id: "exit-intent",
    name: "Exit intent — last chance",
    status: "active",
    position: "center",
    order: 1,
    headline: "Wait — don't leave empty-handed",
    subheadline: "Grab an extra 15% off on your order before you go.",
    ctaText: "Apply 15% off",
    discountCode: "WAIT15",
    redirectPath: "/cart",
    frequency: "once-per-session",
    ctr: 8.4,
    conversions: 412,
  },
  {
    id: "promotional",
    name: "Promotional — slow movers",
    status: "active",
    position: "bottom-right",
    order: 2,
    headline: "Try our cold-pressed groundnut oil",
    subheadline: "Wood-pressed, single-origin. 20% off today.",
    ctaText: "Get 20% off",
    discountCode: "PROMO20",
    redirectPath: "/products/groundnut-oil",
    targetUrlPatterns: ["/products/groundnut-oil", "/collections/oils"],
    frequency: "once-per-session",
    ctr: 4.1,
    conversions: 198,
  },
  {
    id: "countdown",
    name: "Flash sale — countdown",
    status: "active",
    position: "top-center",
    order: 3,
    headline: "Flash sale ends soon",
    subheadline: "15% off everything. Limited time.",
    ctaText: "Shop the sale",
    discountCode: "FLASH15",
    redirectPath: "/collections/all",
    frequency: "once-per-session",
    ctr: 11.6,
    conversions: 304,
  },
  {
    id: "weather",
    name: "Weather-based",
    status: "paused",
    position: "middle-right",
    order: 4,
    headline: "Rainy day special",
    subheadline: "Stay warm with our A2 ghee + turmeric combo.",
    ctaText: "Shop combo",
    discountCode: "RAINY10",
    redirectPath: "/collections/all",
    frequency: "once-per-session",
    ctr: 7.3,
    conversions: 82,
  },
];

const POPUP_TYPES = [
  { id: "exit-intent", name: "Exit intent", description: "Detect cursor heading to the tab bar or back-button on mobile.", enabled: true, order: 0 },
  { id: "entry", name: "Entry / new user", description: "First-visit welcome popup with onboarding hook.", enabled: true, order: 1 },
  { id: "promotional", name: "Promotional", description: "Push slow-moving products on specific product/collection pages.", enabled: true, order: 2 },
  { id: "countdown", name: "Countdown", description: "Limited-time offer with live timer.", enabled: true, order: 3, expiresAt: new Date(Date.now() + 2 * 3600_000 + 34 * 60_000).toISOString() },
];

const CITIES = [
  { code: "BLR", name: "Bengaluru", region: "Karnataka", enabled: true, order: 0 },
  { code: "BOM", name: "Mumbai", region: "Maharashtra", enabled: true, order: 1 },
  { code: "DEL", name: "New Delhi", region: "Delhi NCR", enabled: true, order: 2 },
  { code: "GGN", name: "Gurugram", region: "Haryana", enabled: true, order: 3 },
  { code: "HYD", name: "Hyderabad", region: "Telangana", enabled: true, order: 4 },
  { code: "PNQ", name: "Pune", region: "Maharashtra", enabled: true, order: 5 },
  { code: "MAA", name: "Chennai", region: "Tamil Nadu", enabled: false, order: 6 },
  { code: "IXC", name: "Chandigarh", region: "Punjab/Haryana", enabled: false, order: 7 },
];

const POSITION_BENCHMARKS = [
  { position: "top-left", ctr: 11 },
  { position: "top-center", ctr: 18 },
  { position: "top-right", ctr: 14 },
  { position: "middle-left", ctr: 10 },
  { position: "center", ctr: 22 },
  { position: "middle-right", ctr: 13 },
  { position: "bottom-left", ctr: 9 },
  { position: "bottom-center", ctr: 16 },
  { position: "bottom-right", ctr: 12 },
];

const SCORING_CONFIG = {
  threshold: 75,
  decayRate: 5,
  decayIntervalMs: 10_000,
  evalIntervalMs: 1_000,
  scoreMin: 0,
  scoreMax: 120,
  bouncerThresholdSec: 9,
  powerConverterMin: 5,
  cartUiGraceSec: 60,
  purchaseLockDays: 30,
  weights: {
    popstate: 40,
    mouseleave_top: 30,
    visibility_hidden: 30,
    tab_blur: 20,
    rapid_scroll_up: 25,
    touch_idle_25s: 20,
    pdp_hesitation_20s: 30,
    reviews_section_seen: 15,
    multiple_pdps_2plus: 15,
    many_pdps_4plus: 20,
    time_30s: 5,
    time_60s: 5,
    scroll_depth_50: 10,
    cart_has_items: 20,
    variant_tap_1: 15,
    variant_tap_2: 10,
    add_to_cart_clicked: -50,
    pinch_zoom: -15,
  },
};

const CONFIG_GLOBAL = {
  currentPosition: "bottom-left",
  weatherRule: {
    id: "rainy-day-special",
    name: "Rainy day special",
    conditions: ["rainy", "cold"],
  },
};

const METRICS_SUMMARY = {
  impressions: 184_293,
  clicks: 12_847,
  ctr: 6.97,
  conversions: 1_283,
  intentDistribution: [
    { tier: "high", percent: 71 },
    { tier: "medium", percent: 46 },
    { tier: "low", percent: 18 },
  ],
  lowMedConverted: 312,
  intentBreakdown: [
    { tier: "low", count: 412 },
    { tier: "medium", count: 587 },
    { tier: "high", count: 284 },
  ],
  conversionsByType: [
    { label: "Countdown", value: 304 },
    { label: "Exit intent", value: 412 },
    { label: "Entry", value: 287 },
    { label: "Promotional", value: 198 },
    { label: "Weather", value: 82 },
  ],
  funnel: [
    { label: "Impressions", count: 184_293 },
    { label: "Clicks", count: 12_847 },
    { label: "Converted", count: 1_283 },
  ],
  updatedAt: Timestamp.now(),
};

function generateApiKey(): { plain: string; hash: string; prefix: string } {
  const plain = `ank_live_${crypto.randomBytes(20).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(plain).digest("hex");
  const prefix = plain.substring(0, 16);
  return { plain, hash, prefix };
}

async function seed() {
  const batch = db.batch();

  for (const p of POPUPS) batch.set(db.doc(`popups/${p.id}`), p);
  for (const t of POPUP_TYPES) batch.set(db.doc(`popupTypes/${t.id}`), t);
  for (const c of CITIES) batch.set(db.doc(`cities/${c.code}`), c);

  batch.set(db.doc("config/global"), CONFIG_GLOBAL);
  batch.set(db.doc("scoringConfig/global"), SCORING_CONFIG);
  batch.set(db.doc("benchmarks/positions"), {
    positions: POSITION_BENCHMARKS,
    computedAt: Timestamp.now(),
  });
  batch.set(db.doc("metrics/summary"), METRICS_SUMMARY);

  const key = generateApiKey();
  batch.set(db.doc(`apiKeys/${key.hash}`), {
    prefix: key.prefix,
    allowedOrigins: [
      "https://www.anveshan.farm",
      "https://anveshan.farm",
      "http://localhost:3000",
    ],
    enabled: true,
    createdAt: Timestamp.now(),
    label: "Anveshan production",
  });

  await batch.commit();

  console.log("\nSeed complete.");
  console.log(`  popups       : ${POPUPS.length}`);
  console.log(`  popupTypes   : ${POPUP_TYPES.length}`);
  console.log(`  cities       : ${CITIES.length}`);
  console.log(`  config/global, benchmarks/positions, metrics/summary`);
  console.log("\n=================================================");
  console.log("  API KEY (save this — not shown again):");
  console.log("  " + key.plain);
  console.log("=================================================\n");
  console.log("Paste this into the Shopify theme.liquid just before </body>:");
  console.log(
    `  <script async\n` +
      `    src="https://YOUR-PROJECT.web.app/v1/popup.js"\n` +
      `    data-api-key="${key.plain}"\n` +
      `    data-endpoint="https://asia-south1-YOUR-PROJECT.cloudfunctions.net"></script>\n`,
  );
  console.log("Replace YOUR-PROJECT with the project id from .firebaserc.\n");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
