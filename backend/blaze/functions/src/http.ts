import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { validateApiKey } from "./auth";
import type { EventDoc, PopupDoc } from "./types";

function setCorsHeaders(res: any, origin: string | undefined, allowed: string[]) {
  const allowOrigin =
    origin && allowed.includes(origin) ? origin : allowed[0] ?? "*";
  res.set("Access-Control-Allow-Origin", allowOrigin);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Api-Key");
  res.set("Access-Control-Max-Age", "3600");
}

function extractKey(req: any): string | undefined {
  const header = req.get("X-Api-Key");
  if (header) return header.trim();
  const q = req.query.key;
  if (typeof q === "string") return q.trim();
  return undefined;
}

export const getConfig = onRequest(
  { cors: false, region: "asia-south1", maxInstances: 20 },
  async (req, res) => {
    const origin = req.get("Origin");

    if (req.method === "OPTIONS") {
      setCorsHeaders(res, origin, ["*"]);
      res.status(204).send("");
      return;
    }
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = extractKey(req);
    const auth = await validateApiKey(apiKey, origin);
    if (!auth.ok) {
      setCorsHeaders(res, origin, ["*"]);
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    setCorsHeaders(res, origin, auth.key.doc.allowedOrigins);

    const db = getFirestore();
    const [popupsSnap, configSnap, popupTypesSnap] = await Promise.all([
      db.collection("popups").orderBy("order").get(),
      db.doc("config/global").get(),
      db.collection("popupTypes").get(),
    ]);

    const enabledTypes = new Set(
      popupTypesSnap.docs
        .filter((d) => d.data().enabled === true)
        .map((d) => d.id),
    );

    const popups = popupsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as PopupDoc)
      .filter((p) => p.status === "active" && enabledTypes.has(p.id));

    res.set("Cache-Control", "public, max-age=60");
    res.status(200).json({
      version: 1,
      serverTime: Date.now(),
      popups,
      config: configSnap.data() ?? {},
    });
  },
);

const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const b = RATE_BUCKETS.get(ip);
  if (!b || b.resetAt < now) {
    RATE_BUCKETS.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_LIMIT) return false;
  b.count += 1;
  return true;
}

export const recordEvent = onRequest(
  { cors: false, region: "asia-south1", maxInstances: 50 },
  async (req, res) => {
    const origin = req.get("Origin");

    if (req.method === "OPTIONS") {
      setCorsHeaders(res, origin, ["*"]);
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = extractKey(req);
    const auth = await validateApiKey(apiKey, origin);
    if (!auth.ok) {
      setCorsHeaders(res, origin, ["*"]);
      res.status(auth.status).json({ error: auth.error });
      return;
    }
    setCorsHeaders(res, origin, auth.key.doc.allowedOrigins);

    const ip = (req.get("X-Forwarded-For")?.split(",")[0] ?? req.ip ?? "unknown").trim();
    if (!rateLimit(ip)) {
      res.status(429).json({ error: "Rate limit" });
      return;
    }

    const body = req.body ?? {};
    const { popupId, type, conversionKind, intent, city, position, visitorId, sessionId, page, device } = body;

    if (!popupId || typeof popupId !== "string") {
      res.status(400).json({ error: "popupId required" });
      return;
    }
    if (!["impression", "click", "convert"].includes(type)) {
      res.status(400).json({ error: "Invalid type" });
      return;
    }

    const event: EventDoc = {
      popupId,
      type,
      ...(conversionKind && { conversionKind }),
      ...(intent && { intent }),
      ...(city && { city }),
      ...(position && { position }),
      ...(visitorId && { visitorId: String(visitorId).slice(0, 64) }),
      ...(sessionId && { sessionId: String(sessionId).slice(0, 64) }),
      ...(page && { page: String(page).slice(0, 256) }),
      ...(device && { device }),
      ts: Timestamp.now(),
    };

    const ref = await getFirestore().collection("events").add(event);
    res.status(200).json({ ok: true, id: ref.id });
  },
);
