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
  ScoringConfig,
  WeatherCondition,
  WeatherRule,
} from "./types";
import { DEFAULT_SCORING_CONFIG } from "./types";
import {
  CURRENT_POSITION,
  MOCK_CITIES,
  MOCK_CONVERSIONS_BY_TYPE,
  MOCK_FUNNEL,
  MOCK_INTENT_BREAKDOWN,
  MOCK_INTENT_DISTRIBUTION,
  MOCK_LOW_MED_CONVERTED,
  MOCK_METRICS,
  MOCK_POPUPS,
  MOCK_POPUP_TYPES,
  MOCK_WEATHER_RULE,
  POSITION_BENCHMARKS,
} from "./mock-data";

const wait = <T,>(value: T, ms = 0): Promise<T> =>
  new Promise((r) => setTimeout(() => r(value), ms));

export const mockApi = {
  getMetrics: (): Promise<DashboardMetrics> => wait(MOCK_METRICS),
  getPopups: (): Promise<PopupSummary[]> => wait(MOCK_POPUPS),

  getCurrentPosition: (): Promise<Position> => wait(CURRENT_POSITION),
  getPositionBenchmarks: (): Promise<PositionBenchmark[]> => wait(POSITION_BENCHMARKS),
  applyPositionToAll: (position: Position) => wait({ ok: true as const, position }, 400),

  getCities: (): Promise<City[]> => wait(MOCK_CITIES),
  toggleCity: (_code: string, _enabled: boolean) => wait({ ok: true as const }, 200),

  getWeatherRule: (): Promise<WeatherRule> => wait(MOCK_WEATHER_RULE),
  setWeatherRule: (_conditions: WeatherCondition[]) => wait({ ok: true as const }, 200),

  getPopupTypes: (): Promise<PopupTypeCard[]> => wait(MOCK_POPUP_TYPES),
  togglePopupType: (_id: string, _enabled: boolean) => wait({ ok: true as const }, 200),

  getIntentBreakdown: (): Promise<IntentBreakdown[]> => wait(MOCK_INTENT_BREAKDOWN),
  getIntentDistribution: () =>
    wait({
      distribution: MOCK_INTENT_DISTRIBUTION,
      lowMedConverted: MOCK_LOW_MED_CONVERTED,
    }),
  getConversionsByType: (): Promise<BarDatum[]> => wait(MOCK_CONVERSIONS_BY_TYPE),
  getFunnel: (): Promise<FunnelStage[]> => wait(MOCK_FUNNEL),

  uploadBanner: (_file: File) =>
    wait(
      {
        ok: true as const,
        id: crypto.randomUUID(),
        url: `https://mock-cdn.example/banners/${crypto.randomUUID()}.webp`,
      },
      700,
    ),

  setPopupBanner: (_popupId: string, _bannerUrl: string) =>
    wait({ ok: true as const }, 200),

  setPopupPosition: (_popupId: string, _position: Position) =>
    wait({ ok: true as const }, 200),

  setPopupStatus: (_popupId: string, _status: "active" | "paused") =>
    wait({ ok: true as const }, 200),

  getScoringConfig: (): Promise<ScoringConfig> => wait(DEFAULT_SCORING_CONFIG),
  setScoringConfig: (_config: ScoringConfig) =>
    wait({ ok: true as const }, 300),
};

export type ApiShape = typeof mockApi;
