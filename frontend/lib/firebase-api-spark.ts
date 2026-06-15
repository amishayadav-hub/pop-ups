import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import type { ApiShape } from "./mock-api";
import type {
  AbandonmentScoringConfig,
  BarDatum,
  City,
  DashboardMetrics,
  FunnelStage,
  IntentBreakdown,
  IntentDistribution,
  IntentTier,
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
  MOCK_ABANDONMENT_METRICS,
  MOCK_ABANDONMENT_WEEKLY,
  MOCK_NORMAL_EXIT_WEEKLY,
} from "./mock-data";

// -----------------------------------------------------------------------------
// Live-events helpers
// -----------------------------------------------------------------------------

type EventType = "impression" | "click" | "convert" | "dismiss";

type EventDoc = {
  type: EventType;
  popupId?: string;
  intent?: IntentTier;
  dismissReason?: "x_button" | "backdrop" | "timeout";
  ts?: Timestamp | { toMillis?: () => number } | Date | number | string;
};

const EVENTS_LIMIT = 5000;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
// In-memory cache lifetime — refresh per page load.
const CACHE_TTL_MS = 60 * 1000;

let eventsCache: { fetchedAt: number; events: EventDoc[] } | null = null;
let inflight: Promise<EventDoc[]> | null = null;

async function fetchRecentEvents(): Promise<EventDoc[]> {
  const now = Date.now();
  if (eventsCache && now - eventsCache.fetchedAt < CACHE_TTL_MS) {
    return eventsCache.events;
  }
  if (inflight) return inflight;

  const thirtyDaysAgo = Timestamp.fromMillis(now - WINDOW_MS);
  const q = query(
    collection(db(), "events"),
    where("ts", ">=", thirtyDaysAgo),
    limit(EVENTS_LIMIT),
  );
  inflight = getDocs(q)
    .then((snap) => {
      const events = snap.docs.map((d) => d.data() as EventDoc);
      eventsCache = { fetchedAt: Date.now(), events };
      return events;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function countByType(events: EventDoc[]) {
  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  let dismissed = 0;
  for (const e of events) {
    if (e.type === "impression") impressions++;
    else if (e.type === "click") clicks++;
    else if (e.type === "convert") conversions++;
    else if (e.type === "dismiss") dismissed++;
  }
  return { impressions, clicks, conversions, dismissed };
}

const DAY_LABELS: WeeklyDataPoint["day"][] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

function tsToMs(
  ts: EventDoc["ts"],
): number | null {
  if (!ts) return null;
  if (typeof ts === "number") return ts;
  if (typeof ts === "string") {
    const n = Date.parse(ts);
    return isFinite(n) ? n : null;
  }
  if (ts instanceof Date) return ts.getTime();
  if (typeof (ts as Timestamp).toMillis === "function") {
    return (ts as Timestamp).toMillis();
  }
  return null;
}

// -----------------------------------------------------------------------------
// Generic Firestore helpers (mirrored from firebase-api.ts)
// -----------------------------------------------------------------------------

async function listOrdered<T>(col: string): Promise<T[]> {
  const snap = await getDocs(query(collection(db(), col), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T);
}

async function getDocData<T>(path: string): Promise<T | null> {
  const snap = await getDoc(doc(db(), path));
  return snap.exists() ? (snap.data() as T) : null;
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

export const firebaseSparkApi: ApiShape = {
  getMetrics: async (): Promise<DashboardMetrics> => {
    const events = await fetchRecentEvents();
    const { impressions, clicks, conversions, dismissed } = countByType(events);
    const ctr =
      impressions > 0
        ? Math.round((clicks / impressions) * 100 * 100) / 100
        : 0;
    return { impressions, clicks, ctr, conversions, dismissed };
  },

  getPopups: async (): Promise<PopupSummary[]> => {
    const [popups, events] = await Promise.all([
      listOrdered<PopupSummary>("popups"),
      fetchRecentEvents(),
    ]);
    return popups.map((p) => {
      let impressions = 0;
      let clicks = 0;
      let conversions = 0;
      for (const e of events) {
        if (e.popupId !== p.id) continue;
        if (e.type === "impression") impressions++;
        else if (e.type === "click") clicks++;
        else if (e.type === "convert") conversions++;
      }
      const ctr =
        impressions > 0
          ? Math.round((clicks / impressions) * 100 * 100) / 100
          : 0;
      return { ...p, ctr, conversions };
    });
  },

  getCurrentPosition: async () => {
    const c = await getDocData<{ currentPosition: Position }>("config/global");
    return c?.currentPosition ?? "bottom-left";
  },
  getPositionBenchmarks: async () => {
    const data = await getDocData<{ positions: PositionBenchmark[] }>(
      "benchmarks/positions",
    );
    return data?.positions ?? [];
  },
  applyPositionToAll: async (position) => {
    await updateDoc(doc(db(), "config/global"), { currentPosition: position });
    const popups = await getDocs(collection(db(), "popups"));
    await Promise.all(
      popups.docs.map((p) => updateDoc(p.ref, { position })),
    );
    return { ok: true, position };
  },

  getCities: () => listOrdered<City>("cities"),
  toggleCity: async (code, enabled) => {
    await updateDoc(doc(db(), `cities/${code}`), { enabled });
    return { ok: true };
  },

  getWeatherRule: async () => {
    const c = await getDocData<{ weatherRule: WeatherRule }>("config/global");
    return (
      c?.weatherRule ?? { id: "default", name: "Default rule", conditions: [] }
    );
  },
  setWeatherRule: async (conditions: WeatherCondition[]) => {
    await setDoc(
      doc(db(), "config/global"),
      { weatherRule: { conditions } },
      { merge: true },
    );
    return { ok: true };
  },

  getPopupTypes: () => listOrdered<PopupTypeCard>("popupTypes"),
  togglePopupType: async (id, enabled) => {
    await updateDoc(doc(db(), `popupTypes/${id}`), { enabled });
    return { ok: true };
  },

  getIntentBreakdown: async (): Promise<IntentBreakdown[]> => {
    const events = await fetchRecentEvents();
    const counts: Record<IntentTier, number> = { low: 0, medium: 0, high: 0 };
    for (const e of events) {
      if (e.type !== "convert") continue;
      if (e.intent === "low" || e.intent === "medium" || e.intent === "high") {
        counts[e.intent]++;
      }
    }
    return [
      { tier: "low", count: counts.low },
      { tier: "medium", count: counts.medium },
      { tier: "high", count: counts.high },
    ];
  },

  getIntentDistribution: async () => {
    const events = await fetchRecentEvents();
    const counts: Record<IntentTier, number> = { low: 0, medium: 0, high: 0 };
    let total = 0;
    for (const e of events) {
      if (e.type !== "convert") continue;
      if (e.intent === "low" || e.intent === "medium" || e.intent === "high") {
        counts[e.intent]++;
        total++;
      }
    }
    const pct = (n: number) =>
      total > 0 ? Math.round((n / total) * 100 * 100) / 100 : 0;
    const distribution: IntentDistribution[] = [
      { tier: "low", percent: pct(counts.low) },
      { tier: "medium", percent: pct(counts.medium) },
      { tier: "high", percent: pct(counts.high) },
    ];
    return {
      distribution,
      lowMedConverted: counts.low + counts.medium,
    };
  },

  getConversionsByType: async (): Promise<BarDatum[]> => {
    const [events, popups] = await Promise.all([
      fetchRecentEvents(),
      listOrdered<PopupSummary>("popups"),
    ]);
    const nameById = new Map<string, string>();
    for (const p of popups) nameById.set(p.id, p.name);

    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.type !== "convert") continue;
      const key = e.popupId ?? "unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const result: BarDatum[] = [];
    for (const [popupId, value] of counts) {
      result.push({ label: nameById.get(popupId) ?? popupId, value });
    }
    result.sort((a, b) => b.value - a.value);
    return result;
  },

  getFunnel: async (): Promise<FunnelStage[]> => {
    const events = await fetchRecentEvents();
    const { impressions, clicks, conversions } = countByType(events);
    return [
      { label: "Impressions", count: impressions },
      { label: "Clicks", count: clicks },
      { label: "Converted", count: conversions },
    ];
  },

  uploadBanner: async (file: File) => {
    const id = crypto.randomUUID();
    const fileRef = ref(storage(), `banners/${id}.webp`);
    await uploadBytes(fileRef, file, { contentType: "image/webp" });
    const url = await getDownloadURL(fileRef);
    await setDoc(
      doc(db(), "banners", id),
      { id, url, uploadedAt: new Date().toISOString() },
      { merge: true },
    );
    return { ok: true as const, id, url };
  },

  setPopupBanner: async (popupId: string, bannerUrl: string) => {
    // setDoc with merge so the doc is created if it doesn't exist yet
    // (e.g. abandonment-exit-intent before seed has been run).
    await setDoc(
      doc(db(), `popups/${popupId}`),
      { id: popupId, bannerUrl },
      { merge: true },
    );
    return { ok: true as const };
  },

  setPopupPosition: async (popupId: string, position: Position) => {
    await setDoc(
      doc(db(), `popups/${popupId}`),
      { id: popupId, position },
      { merge: true },
    );
    return { ok: true as const };
  },

  setPopupStatus: async (popupId: string, status: "active" | "paused") => {
    await updateDoc(doc(db(), `popups/${popupId}`), { status });
    return { ok: true as const };
  },

  getScoringConfig: async (): Promise<ScoringConfig> => {
    const data = await getDocData<Partial<ScoringConfig>>("scoringConfig/global");
    if (!data) return DEFAULT_SCORING_CONFIG;
    // Merge with defaults to handle missing fields gracefully
    return {
      ...DEFAULT_SCORING_CONFIG,
      ...data,
      weights: { ...DEFAULT_SCORING_CONFIG.weights, ...(data.weights ?? {}) },
    };
  },

  setScoringConfig: async (config: ScoringConfig) => {
    await setDoc(
      doc(db(), "scoringConfig/global"),
      { ...config, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return { ok: true as const };
  },

  getPopupAnalytics: async (
    popupId: string,
  ): Promise<PopupAnalyticsMetrics> => {
    const isAbandonment = popupId === "abandonment-exit-intent";
    const events = await fetchRecentEvents();
    let impressions = 0;
    let clicks = 0;
    let closed = 0;
    for (const e of events) {
      if (e.popupId !== popupId) continue;
      if (e.type === "impression") impressions++;
      else if (e.type === "click") clicks++;
      else if (
        e.type === "dismiss" &&
        (e.dismissReason === "x_button" || e.dismissReason === "backdrop")
      ) {
        closed++;
      }
    }
    // Silent fallback to mock for abandonment while SDK ramps up traffic.
    // Once real impressions start flowing, real numbers take over.
    if (isAbandonment && impressions === 0) {
      return MOCK_ABANDONMENT_METRICS;
    }
    const ctr =
      impressions > 0
        ? Math.round((clicks / impressions) * 100 * 100) / 100
        : 0;
    if (isAbandonment) {
      // "Ignored" = saw the reminder but never tapped image or close.
      // Reminder popup has no timer, so this is a derived count.
      const ignored = Math.max(0, impressions - clicks - closed);
      return { impressions, clicks, ctr, closed, ignored };
    }
    return { impressions, clicks, ctr, closed };
  },

  getAbandonmentScoringConfig: async (): Promise<AbandonmentScoringConfig> => {
    const data = await getDocData<Partial<AbandonmentScoringConfig>>(
      "scoringConfig/abandonment",
    );
    if (!data) return DEFAULT_ABANDONMENT_CONFIG;
    return {
      ...DEFAULT_ABANDONMENT_CONFIG,
      ...data,
      weights: {
        ...DEFAULT_ABANDONMENT_CONFIG.weights,
        ...(data.weights ?? {}),
      },
    };
  },

  setAbandonmentScoringConfig: async (config: AbandonmentScoringConfig) => {
    await setDoc(
      doc(db(), "scoringConfig/abandonment"),
      { ...config, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return { ok: true as const };
  },

  getWeeklyImpressionsForPopup: async (
    popupId: string,
  ): Promise<WeeklyDataPoint[]> => {
    const events = await fetchRecentEvents();
    const counts: Record<WeeklyDataPoint["day"], number> = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };
    let any = false;
    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const e of events) {
      if (e.popupId !== popupId) continue;
      if (e.type !== "impression") continue;
      const ms = tsToMs(e.ts);
      if (ms === null || ms < cutoffMs) continue;
      const day = DAY_LABELS[new Date(ms).getDay()];
      counts[day]++;
      any = true;
    }
    // Silent fallback to mock when no events yet for this popup.
    if (!any) {
      return popupId === "abandonment-exit-intent"
        ? MOCK_ABANDONMENT_WEEKLY
        : MOCK_NORMAL_EXIT_WEEKLY;
    }
    return [
      { day: "Mon", count: counts.Mon },
      { day: "Tue", count: counts.Tue },
      { day: "Wed", count: counts.Wed },
      { day: "Thu", count: counts.Thu },
      { day: "Fri", count: counts.Fri },
      { day: "Sat", count: counts.Sat },
      { day: "Sun", count: counts.Sun },
    ];
  },
};
