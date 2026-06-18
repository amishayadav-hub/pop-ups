import type {
  City,
  DashboardMetrics,
  FunnelStage,
  PopupAnalyticsMetrics,
  PopupSummary,
  PopupTypeCard,
  Position,
  PositionBenchmark,
  WeatherRule,
  WeeklyDataPoint,
} from "./types";

export const MOCK_METRICS: DashboardMetrics = {
  impressions: 184_293,
  clicks: 12_847,
  ctr: 6.97,
  conversions: 1_283,
  dismissed: 41_872,
};

export const MOCK_POPUPS: PopupSummary[] = [
  {
    id: "exit-intent",
    name: "Exit intent",
    status: "active",
    ctr: 8.4,
    conversions: 412,
    position: "bottom-left",
  },
  {
    id: "promotional",
    name: "Promotional",
    status: "active",
    ctr: 4.1,
    conversions: 198,
    position: "bottom-right",
  },
  {
    id: "weather",
    name: "Weather-based",
    status: "paused",
    ctr: 7.3,
    conversions: 82,
    position: "middle-right",
  },
];

export const POSITION_BENCHMARKS: PositionBenchmark[] = [
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

export const CURRENT_POSITION: Position = "bottom-left";

export const MOCK_CITIES: City[] = [
  { code: "BLR", name: "Bengaluru", region: "Karnataka", enabled: true },
  { code: "BOM", name: "Mumbai", region: "Maharashtra", enabled: true },
  { code: "DEL", name: "New Delhi", region: "Delhi NCR", enabled: true },
  { code: "GGN", name: "Gurugram", region: "Haryana", enabled: true },
  { code: "HYD", name: "Hyderabad", region: "Telangana", enabled: true },
  { code: "PNQ", name: "Pune", region: "Maharashtra", enabled: true },
  { code: "MAA", name: "Chennai", region: "Tamil Nadu", enabled: false },
  { code: "IXC", name: "Chandigarh", region: "Punjab/Haryana", enabled: false },
];

export const MOCK_WEATHER_RULE: WeatherRule = {
  id: "rainy-day-special",
  name: "Rainy day special",
  conditions: ["rainy", "cold"],
};

export const MOCK_POPUP_TYPES: PopupTypeCard[] = [
  {
    id: "exit-intent",
    name: "Exit intent",
    description: "Detect cursor heading to the tab bar or idle session.",
    enabled: true,
  },
  {
    id: "promotional",
    name: "Promotional",
    description: "Standing promo for featured products.",
    enabled: false,
  },
];

export const MOCK_FUNNEL: FunnelStage[] = [
  { label: "Impressions", count: 184_293 },
  { label: "Clicks", count: 12_847 },
  { label: "Converted", count: 1_283 },
];

// ──────────────────────────────────────────────────────────────────
// Abandonment Exit Intent — placeholder card + analytics (frontend
// only; backend integration deferred).
// ──────────────────────────────────────────────────────────────────

export const ABANDONMENT_PLACEHOLDER: PopupSummary = {
  id: "abandonment-exit-intent",
  name: "Abandonment Exit Intent",
  status: "active",
  ctr: 11.2,
  conversions: 924,
  position: "center",
};

export const ABANDONMENT_POPUP_TYPE: PopupTypeCard = {
  id: "abandonment-exit-intent",
  name: "Abandonment Exit Intent",
  description:
    "Reminder popup for visitors who added items to cart then tried to leave.",
  enabled: true,
};

export const MOCK_ABANDONMENT_METRICS: PopupAnalyticsMetrics = {
  impressions: 8_234,
  clicks: 924,
  ctr: 11.22,
  ignored: 4_102,
  closed: 3_208,
};

export const MOCK_ABANDONMENT_WEEKLY: WeeklyDataPoint[] = [
  { day: "Mon", count: 1_240 },
  { day: "Tue", count: 1_110 },
  { day: "Wed", count: 1_380 },
  { day: "Thu", count: 1_205 },
  { day: "Fri", count: 980 },
  { day: "Sat", count: 1_150 },
  { day: "Sun", count: 1_169 },
];

// Fallback for Normal Exit Intent when real Firestore data unavailable.
export const MOCK_NORMAL_EXIT_WEEKLY: WeeklyDataPoint[] = [
  { day: "Mon", count: 100 },
  { day: "Tue", count: 120 },
  { day: "Wed", count: 80 },
  { day: "Thu", count: 90 },
  { day: "Fri", count: 85 },
  { day: "Sat", count: 130 },
  { day: "Sun", count: 95 },
];
