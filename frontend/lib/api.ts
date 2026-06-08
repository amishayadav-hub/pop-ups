import { USE_FIREBASE } from "./firebase";
import { mockApi } from "./mock-api";
// Spark variant: computes analytics live from events collection.
// Use this while on Firebase free plan (no Cloud Functions aggregator).
import { firebaseSparkApi } from "./firebase-api-spark";
// To switch to the Cloud Functions variant after Blaze upgrade:
// 1. Copy backend/blaze/frontend-overlays/firebase-api.ts → frontend/lib/firebase-api.ts
// 2. Import { firebaseApi } from "./firebase-api"
// 3. Export `firebaseApi` instead of `firebaseSparkApi` below
// See backend/blaze/README.md for the full activation guide.

export const api = USE_FIREBASE ? firebaseSparkApi : mockApi;
