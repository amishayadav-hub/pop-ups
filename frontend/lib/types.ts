export type PopupTypeId =
  | "exit-intent"
  | "abandonment-exit-intent"
  | "promotional"
  | "weather";

export type WeeklyDataPoint = {
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
  count: number;
};

export type PopupAnalyticsMetrics = {
  impressions: number;
  clicks: number;
  ctr: number;
  closed: number;
  ignored?: number;
};

export type Position =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export type IntentTier = "low" | "medium" | "high";

export type WeatherCondition =
  | "rainy"
  | "sunny"
  | "cold"
  | "hot"
  | "windy"
  | "cloudy";

export type DashboardMetrics = {
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  dismissed: number;
};

export type PopupSummary = {
  id: PopupTypeId;
  name: string;
  status: "active" | "paused";
  ctr: number;
  conversions: number;
  position: Position;
  headline?: string;
  subheadline?: string;
  ctaText?: string;
  discountCode?: string;
  redirectPath?: string;
  targetUrlPatterns?: string[];
  bannerUrl?: string;
};

export type PositionBenchmark = {
  position: Position;
  ctr: number;
};

// Redirect destination picker (Upload section). Collection/Product are
// chosen from a live dropdown; page/custom are typed manually.
export type RedirectKind = "collection" | "product" | "page" | "custom";

export type ShopifyCatalogItem = { handle: string; title: string };

export type ShopifyCatalog = {
  domain: string;
  products: ShopifyCatalogItem[];
  collections: ShopifyCatalogItem[];
};

export type City = {
  code: string;
  name: string;
  region: string;
  enabled: boolean;
};

export type IntentDistribution = {
  tier: IntentTier;
  percent: number;
};

export type WeatherRule = {
  id: string;
  name: string;
  conditions: WeatherCondition[];
};

export type PopupTypeCard = {
  id: Exclude<PopupTypeId, "weather">;
  name: string;
  description: string;
  enabled: boolean;
};

export type IntentBreakdown = {
  tier: IntentTier;
  count: number;
};

export type BarDatum = {
  label: string;
  value: number;
};

export type FunnelStage = {
  label: string;
  count: number;
};

export type SignalWeights = {
  // Exit signals
  popstate: number;
  mouseleave_top: number;
  visibility_hidden: number;
  tab_blur: number;
  rapid_scroll_up: number;
  touch_idle_25s: number;
  // Engagement signals
  pdp_hesitation_20s: number;
  reviews_section_seen: number;
  multiple_pdps_2plus: number;
  many_pdps_4plus: number;
  time_30s: number;
  time_60s: number;
  scroll_depth_50: number;
  cart_has_items: number;
  variant_tap_1: number;
  variant_tap_2: number;
  // Negative signals
  add_to_cart_clicked: number;
  search_active: number;
};

export type ScoringConfig = {
  threshold: number;
  decayRate: number;
  decayIntervalMs: number;
  scoreMin: number;
  scoreMax: number;
  evalIntervalMs: number;
  bouncerThresholdSec: number;
  powerConverterMin: number;
  cartUiGraceSec: number;
  purchaseLockDays: number;
  autoDismissSec: number;
  weights: SignalWeights;
};

// ──────────────────────────────────────────────────────────────────
// Abandonment Exit Intent — parallel engine config
// ──────────────────────────────────────────────────────────────────

export type AbandonmentScenario =
  | "post_add_to_cart" // Add-to-cart happened, exit from any page
  | "checkout_started" // User reached /checkouts/... then exit
  | "cart_page"; // User on /cart then exit

export type AbandonmentSignalWeights = {
  // Positive (push toward fire)
  popstate: number;
  mouseleave_top: number;
  visibility_hidden: number;
  tab_blur: number;
  rapid_scroll_up: number;
  touch_idle_25s: number;
  // Negative (1-10, push away from fire — user is still engaged)
  reviews_section_seen: number;
  time_30s: number;
  time_60s: number;
  variant_tap_1: number;
};

export type AbandonmentScoringConfig = {
  threshold: number;
  decayRate: number;
  scoreMax: number;
  weights: AbandonmentSignalWeights;
};

export const DEFAULT_ABANDONMENT_CONFIG: AbandonmentScoringConfig = {
  threshold: 50,
  decayRate: 2,
  scoreMax: 120,
  weights: {
    popstate: 40,
    mouseleave_top: 30,
    visibility_hidden: 30,
    tab_blur: 20,
    rapid_scroll_up: 25,
    touch_idle_25s: 20,
    reviews_section_seen: -5,
    time_30s: -3,
    time_60s: -5,
    variant_tap_1: -5,
  },
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  threshold: 75,
  decayRate: 5,
  decayIntervalMs: 10_000,
  scoreMin: 0,
  scoreMax: 120,
  evalIntervalMs: 1_000,
  bouncerThresholdSec: 9,
  powerConverterMin: 5,
  cartUiGraceSec: 60,
  purchaseLockDays: 30,
  autoDismissSec: 60,
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
    search_active: -20,
  },
};
