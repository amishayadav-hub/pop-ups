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
  BarDatum,
  City,
  DashboardMetrics,
  FunnelStage,
  IntentBreakdown,
  IntentDistribution,
  IntentTier,
  PopupSummary,
  PopupTypeCard,
  Position,
  PositionBenchmark,
  ScoringConfig,
  WeatherCondition,
  WeatherRule,
} from "./types";
import { DEFAULT_SCORING_CONFIG } from "./types";

// -----------------------------------------------------------------------------
// Live-events helpers
// -----------------------------------------------------------------------------

type EventType = "impression" | "click" | "convert" | "dismiss";

type EventDoc = {
  type: EventType;
  popupId?: string;
  intent?: IntentTier;
  dismissReason?: "x_button" | "backdrop";
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
    await updateDoc(doc(db(), `popups/${popupId}`), { bannerUrl });
    return { ok: true as const };
  },

  setPopupPosition: async (popupId: string, position: Position) => {
    await updateDoc(doc(db(), `popups/${popupId}`), { position });
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
};
