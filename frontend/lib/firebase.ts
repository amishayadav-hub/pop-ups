import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const USE_FIREBASE =
  process.env.NEXT_PUBLIC_USE_FIREBASE === "true" && !!config.projectId;

let app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _auth: Auth | null = null;

function ensureApp(): FirebaseApp {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function db(): Firestore {
  if (!_db) _db = getFirestore(ensureApp(), "default");
  return _db;
}

export function storage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(ensureApp());
  return _storage;
}

export function auth(): Auth {
  if (!_auth) _auth = getAuth(ensureApp());
  return _auth;
}
