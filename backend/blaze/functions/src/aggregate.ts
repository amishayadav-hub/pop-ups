import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import type { EventDoc } from "./types";

const COUNTER: Record<EventDoc["type"], "impressions" | "clicks" | "conversions"> = {
  impression: "impressions",
  click: "clicks",
  convert: "conversions",
};

export const aggregateEvent = onDocumentCreated(
  "events/{eventId}",
  async (event) => {
    const data = event.data?.data() as EventDoc | undefined;
    if (!data) return;

    const db = getFirestore();
    const key = COUNTER[data.type];

    const summary: Record<string, FirebaseFirestore.FieldValue> = {
      [key]: FieldValue.increment(1),
    };
    if (data.intent) summary[`intent.${data.intent}`] = FieldValue.increment(1);
    if (data.device) summary[`device.${data.device}`] = FieldValue.increment(1);

    const popup: Record<string, FirebaseFirestore.FieldValue> = {
      [key]: FieldValue.increment(1),
    };

    await Promise.all([
      db.doc("metrics/summary").set(summary, { merge: true }),
      db.doc(`popups/${data.popupId}`).set(popup, { merge: true }),
    ]);
  },
);
