import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
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
  PopupSummary,
  PopupTypeCard,
  Position,
  PositionBenchmark,
  WeatherCondition,
  WeatherRule,
} from "./types";

async function listOrdered<T>(col: string): Promise<T[]> {
  const snap = await getDocs(query(collection(db(), col), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as unknown as T);
}

async function getDocData<T>(path: string): Promise<T | null> {
  const snap = await getDoc(doc(db(), path));
  return snap.exists() ? (snap.data() as T) : null;
}

export const firebaseApi: ApiShape = {
  getMetrics: async () => {
    const data = (await getDocData<any>("metrics/summary")) ?? {};
    return {
      impressions: data.impressions ?? 0,
      clicks: data.clicks ?? 0,
      ctr: data.ctr ?? 0,
      conversions: data.conversions ?? 0,
    } as DashboardMetrics;
  },

  getPopups: () => listOrdered<PopupSummary>("popups"),

  getCurrentPosition: async () => {
    const c = await getDocData<{ currentPosition: Position }>("config/global");
    return c?.currentPosition ?? "bottom-left";
  },
  getPositionBenchmarks: async () => {
    const data = await getDocData<{ positions: PositionBenchmark[] }>("benchmarks/positions");
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
    return c?.weatherRule ?? { id: "default", name: "Default rule", conditions: [] };
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

  getIntentBreakdown: async () => {
    const data = await getDocData<{ intentBreakdown: IntentBreakdown[] }>("metrics/summary");
    return data?.intentBreakdown ?? [];
  },
  getIntentDistribution: async () => {
    const data = await getDocData<{
      intentDistribution: IntentDistribution[];
      lowMedConverted: number;
    }>("metrics/summary");
    return {
      distribution: data?.intentDistribution ?? [],
      lowMedConverted: data?.lowMedConverted ?? 0,
    };
  },
  getConversionsByType: async () => {
    const data = await getDocData<{ conversionsByType: BarDatum[] }>("metrics/summary");
    return data?.conversionsByType ?? [];
  },
  getFunnel: async () => {
    const data = await getDocData<{ funnel: FunnelStage[] }>("metrics/summary");
    return data?.funnel ?? [];
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
};
