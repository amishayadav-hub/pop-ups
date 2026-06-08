import type {
  BarDatum,
  City,
  DashboardMetrics,
  FunnelStage,
  IntentBreakdown,
  IntentDistribution,
  PopupSummary,
  PopupTypeCard,
  Position,
  PositionBenchmark,
  WeatherRule,
} from "./types";

export const MOCK_METRICS: DashboardMetrics = {
  impressions: 184_293,
  clicks: 12_847,
  ctr: 6.97,
  conversions: 1_283,
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
    id: "entry",
    name: "Entry / new user",
    status: "active",
    ctr: 5.2,
    conversions: 287,
    position: "center",
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
    id: "countdown",
    name: "Countdown",
    status: "active",
    ctr: 11.6,
    conversions: 304,
    position: "top-center",
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
    id: "entry",
    name: "Entry / new user",
    description: "First-visit welcome popup with onboarding hook.",
    enabled: true,
  },
  {
    id: "promotional",
    name: "Promotional",
    description: "Standing promo for featured products.",
    enabled: false,
  },
  {
    id: "countdown",
    name: "Countdown",
    description: "Limited-time offer with live timer.",
    enabled: true,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000 + 34 * 60 * 1000).toISOString(),
  },
];

export const MOCK_INTENT_BREAKDOWN: IntentBreakdown[] = [
  { tier: "low", count: 412 },
  { tier: "medium", count: 587 },
  { tier: "high", count: 284 },
];

export const MOCK_INTENT_DISTRIBUTION: IntentDistribution[] = [
  { tier: "high", percent: 71 },
  { tier: "medium", percent: 46 },
  { tier: "low", percent: 18 },
];

export const MOCK_LOW_MED_CONVERTED = 312;

export const MOCK_CONVERSIONS_BY_TYPE: BarDatum[] = [
  { label: "Countdown", value: 304 },
  { label: "Exit intent", value: 412 },
  { label: "Entry", value: 287 },
  { label: "Promotional", value: 198 },
  { label: "Weather", value: 82 },
];

export const MOCK_FUNNEL: FunnelStage[] = [
  { label: "Impressions", count: 184_293 },
  { label: "Clicks", count: 12_847 },
  { label: "Converted", count: 1_283 },
];
