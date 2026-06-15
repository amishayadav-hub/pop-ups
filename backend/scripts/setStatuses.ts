import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as path from "path";
import * as fs from "fs";

const KEY_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ??
  path.join(__dirname, "service-account.json");

if (!fs.existsSync(KEY_PATH)) {
  console.error(`Service account key not found at ${KEY_PATH}`);
  process.exit(1);
}

initializeApp({ credential: cert(KEY_PATH) });
// Match the SDK side which uses the "default" named database (Enterprise edition).
const db = getFirestore(undefined as any, "default");

const STATUSES: Record<string, "active" | "paused"> = {
  "exit-intent": "active",
  "abandonment-exit-intent": "active",
  promotional: "paused",
  weather: "paused",
};

async function main() {
  for (const [id, status] of Object.entries(STATUSES)) {
    await db.doc(`popups/${id}`).update({ status });
    console.log(`✓ popups/${id} → ${status}`);
  }
  console.log("\nDone. Only exit-intent is live on Anveshan now.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
