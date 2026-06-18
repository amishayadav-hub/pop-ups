import type {
  AbandonmentScoringConfig,
  City,
  DashboardMetrics,
  FunnelStage,
  PopupAnalyticsMetrics,
  PopupSummary,
  PopupTypeCard,
  Position,
  PositionBenchmark,
  ScoringConfig,
  WeatherCondition,
  WeatherRule,
  WeeklyDataPoint,
} from "./types";
import { DEFAULT_ABANDONMENT_CONFIG, DEFAULT_SCORING_CONFIG } from "./types";
import {
  CURRENT_POSITION,
  MOCK_ABANDONMENT_METRICS,
  MOCK_ABANDONMENT_WEEKLY,
  MOCK_CITIES,
  MOCK_FUNNEL,
  MOCK_METRICS,
  MOCK_NORMAL_EXIT_WEEKLY,
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

  setPopupRedirect: (_popupId: string, _redirectPath: string) =>
    wait({ ok: true as const }, 200),

  setPopupStatus: (_popupId: string, _status: "active" | "paused") =>
    wait({ ok: true as const }, 200),

  getScoringConfig: (): Promise<ScoringConfig> => wait(DEFAULT_SCORING_CONFIG),
  setScoringConfig: (_config: ScoringConfig) =>
    wait({ ok: true as const }, 300),

  getAbandonmentScoringConfig: (): Promise<AbandonmentScoringConfig> =>
    wait(DEFAULT_ABANDONMENT_CONFIG),
  setAbandonmentScoringConfig: (_config: AbandonmentScoringConfig) =>
    wait({ ok: true as const }, 300),

  getPopupAnalytics: (popupId: string): Promise<PopupAnalyticsMetrics> => {
    if (popupId === "abandonment-exit-intent") {
      return wait(MOCK_ABANDONMENT_METRICS);
    }
    return wait({
      impressions: 12_847,
      clicks: 1_024,
      ctr: 7.97,
      closed: 8_234,
    });
  },

  getWeeklyImpressionsForPopup: (popupId: string): Promise<WeeklyDataPoint[]> =>
    wait(
      popupId === "abandonment-exit-intent"
        ? MOCK_ABANDONMENT_WEEKLY
        : MOCK_NORMAL_EXIT_WEEKLY,
    ),
};

export type ApiShape = typeof mockApi;
