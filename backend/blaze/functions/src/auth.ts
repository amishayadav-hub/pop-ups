import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";
import type { ApiKeyDoc } from "./types";

export type ValidatedKey = {
  hash: string;
  doc: ApiKeyDoc;
};

export async function validateApiKey(
  apiKey: string | undefined,
  origin: string | undefined,
): Promise<{ ok: true; key: ValidatedKey } | { ok: false; status: number; error: string }> {
  if (!apiKey || typeof apiKey !== "string") {
    return { ok: false, status: 401, error: "Missing API key" };
  }
  if (!apiKey.startsWith("ank_live_") && !apiKey.startsWith("ank_test_")) {
    return { ok: false, status: 401, error: "Malformed API key" };
  }

  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  const snap = await getFirestore().doc(`apiKeys/${hash}`).get();
  if (!snap.exists) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  const doc = snap.data() as ApiKeyDoc;
  if (!doc.enabled) {
    return { ok: false, status: 403, error: "API key disabled" };
  }

  if (origin && doc.allowedOrigins && doc.allowedOrigins.length > 0) {
    const allowed = doc.allowedOrigins.some((o) => origin === o);
    if (!allowed) {
      return { ok: false, status: 403, error: "Origin not allowed" };
    }
  }

  getFirestore()
    .doc(`apiKeys/${hash}`)
    .update({ lastUsedAt: FieldValue.serverTimestamp() })
    .catch(() => undefined);

  return { ok: true, key: { hash, doc } };
}

export function isOriginAllowed(origin: string | undefined, doc: ApiKeyDoc): boolean {
  if (!origin || !doc.allowedOrigins) return false;
  return doc.allowedOrigins.includes(origin);
}
