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
const db = getFirestore(undefined as any, "default");

type Frequency =
  | "once-per-visitor"
  | "once-per-day"
  | "once-per-session"
  | "always";

const FREQUENCIES: Record<string, Frequency> = {
  "exit-intent": "once-per-session",
  "abandonment-exit-intent": "once-per-session",
  promotional: "once-per-session",
  weather: "once-per-session",
};

async function main() {
  for (const [id, frequency] of Object.entries(FREQUENCIES)) {
    await db.doc(`popups/${id}`).update({ frequency });
    console.log(`✓ popups/${id}.frequency → ${frequency}`);
  }
  console.log(
    "\nDone. Exit-intent now resets every new tab session " +
      "(reload within same tab = no re-show, close+reopen tab = shows again).\n",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
