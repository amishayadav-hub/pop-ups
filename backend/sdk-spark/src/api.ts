import type { ConfigResponse, EventInput, PopupId, Popup } from "./types";

type Options = {
  projectId: string;
  webApiKey: string;
  databaseId: string;
  visitorId: string;
  sessionId: string;
  device: "mobile" | "desktop";
};

function parseFields(fields: any): any {
  if (!fields) return {};
  const out: any = {};
  for (const k of Object.keys(fields)) {
    const v = fields[k];
    if ("stringValue" in v) out[k] = v.stringValue;
    else if ("integerValue" in v) out[k] = Number(v.integerValue);
    else if ("doubleValue" in v) out[k] = Number(v.doubleValue);
    else if ("booleanValue" in v) out[k] = v.booleanValue;
    else if ("nullValue" in v) out[k] = null;
    else if ("arrayValue" in v) {
      out[k] = (v.arrayValue.values || []).map((x: any) => {
        if ("stringValue" in x) return x.stringValue;
        if ("integerValue" in x) return Number(x.integerValue);
        return x;
      });
    } else if ("mapValue" in v) out[k] = parseFields(v.mapValue.fields);
    else if ("timestampValue" in v) out[k] = v.timestampValue;
  }
  return out;
}

function encodeValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") {
    const fields: any = {};
    for (const k of Object.keys(v)) fields[k] = encodeValue(v[k]);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function encodeFields(obj: Record<string, any>): any {
  const fields: any = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) fields[k] = encodeValue(obj[k]);
  }
  return fields;
}

function parseDoc(d: any): any {
  const id = d.name.split("/").pop();
  return { id, ...parseFields(d.fields) };
}

export class Api {
  private base: string;

  constructor(private opts: Options) {
    this.base = `https://firestore.googleapis.com/v1/projects/${opts.projectId}/databases/${opts.databaseId}/documents`;
  }

  async getConfig(): Promise<ConfigResponse | null> {
    try {
      const queryBody = JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "popups" }],
          orderBy: [{ field: { fieldPath: "order" }, direction: "ASCENDING" }],
        },
      });
      const [popupsResp, configResp] = await Promise.all([
        fetch(`${this.base}:runQuery?key=${encodeURIComponent(this.opts.webApiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: queryBody,
        }),
        fetch(`${this.base}/config/global?key=${encodeURIComponent(this.opts.webApiKey)}`),
      ]);
      if (!popupsResp.ok) return null;
      const popupsJson = await popupsResp.json();
      const configJson = configResp.ok ? await configResp.json() : { fields: {} };
      const popups = ((popupsJson as any[]) ?? [])
        .filter((row) => row && row.document)
        .map((row) => parseDoc(row.document))
        .filter((p: any) => p.status === "active") as Popup[];
      return {
        version: 1,
        serverTime: Date.now(),
        popups,
        config: parseFields(configJson.fields),
      };
    } catch {
      return null;
    }
  }

  // Fetches the scoring config from Firestore. Returns null if missing —
  // callers should fall back to hardcoded defaults in that case.
  async getScoringConfig(): Promise<Record<string, any> | null> {
    try {
      const r = await fetch(
        `${this.base}/scoringConfig/global?key=${encodeURIComponent(this.opts.webApiKey)}`,
      );
      if (!r.ok) return null;
      const json = await r.json();
      return parseFields(json.fields);
    } catch {
      return null;
    }
  }

  sendEvent(ev: EventInput, position?: string): void {
    const event = {
      popupId: ev.popupId,
      type: ev.type,
      ...(ev.conversionKind && { conversionKind: ev.conversionKind }),
      ...(ev.dismissReason && { dismissReason: ev.dismissReason }),
      ...(ev.intent && { intent: ev.intent }),
      ...(typeof ev.score === "number" && { score: ev.score }),
      ...(typeof ev.threshold === "number" && { threshold: ev.threshold }),
      ...(typeof ev.timeOnPageMs === "number" && { timeOnPageMs: ev.timeOnPageMs }),
      ...(ev.signals && { signals: ev.signals }),
      ...(position && { position }),
      visitorId: this.opts.visitorId,
      sessionId: this.opts.sessionId,
      page: location.pathname,
      device: this.opts.device,
      ts: new Date(),
    };
    const body = JSON.stringify({ fields: encodeFields(event) });
    const url = `${this.base}/events?key=${encodeURIComponent(this.opts.webApiKey)}`;
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch {
      /* fall through */
    }
    fetch(url, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }
}

export function matchesUrl(patterns: string[] | undefined, path: string): boolean {
  if (!patterns || patterns.length === 0) return true;
  return patterns.some((p) => {
    if (p === "*") return true;
    if (p.endsWith("*")) return path.startsWith(p.slice(0, -1));
    return p === path;
  });
}

export function nextIntentBucket(id: PopupId): "low" | "medium" | "high" {
  if (id === "exit-intent" || id === "countdown") return "high";
  if (id === "promotional" || id === "weather") return "medium";
  return "low";
}
