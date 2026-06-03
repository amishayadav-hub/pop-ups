import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import type { Position } from "./types";

const POSITIONS: Position[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export const computePositionBenchmarks = onSchedule(
  "every day 02:00",
  async () => {
    const db = getFirestore();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const eventsSnap = await db
      .collection("events")
      .where("ts", ">=", since)
      .get();

    const buckets: Record<Position, { imp: number; clk: number }> = Object.fromEntries(
      POSITIONS.map((p) => [p, { imp: 0, clk: 0 }]),
    ) as Record<Position, { imp: number; clk: number }>;

    for (const docSnap of eventsSnap.docs) {
      const e = docSnap.data();
      const pos = e.position as Position | undefined;
      if (!pos || !buckets[pos]) continue;
      if (e.type === "impression") buckets[pos].imp += 1;
      else if (e.type === "click") buckets[pos].clk += 1;
    }

    const benchmarks = POSITIONS.map((p) => ({
      position: p,
      ctr: buckets[p].imp > 0 ? Number(((buckets[p].clk / buckets[p].imp) * 100).toFixed(1)) : 0,
    }));

    await db.doc("benchmarks/positions").set({
      positions: benchmarks,
      computedAt: new Date(),
    });
  },
);
