"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type SignInResult = { ok: true } | { ok: false; error: string };

type AuthState = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  refreshClaims: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth(), async (u) => {
      setUser(u);
      if (u) {
        try {
          // forceRefresh = true so newly set custom claims show up immediately.
          const token = await u.getIdTokenResult(true);
          setIsAdmin(token.claims.admin === true);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      try {
        await signInWithEmailAndPassword(auth(), email, password);
        return { ok: true };
      } catch (e: unknown) {
        const code = (e as { code?: string })?.code ?? "";
        let error = "Sign in failed. Try again.";
        if (
          code === "auth/invalid-credential" ||
          code === "auth/wrong-password" ||
          code === "auth/user-not-found"
        ) {
          error = "Wrong email or password.";
        } else if (code === "auth/invalid-email") {
          error = "That's not a valid email.";
        } else if (code === "auth/too-many-requests") {
          error = "Too many attempts. Wait a minute and try again.";
        } else if (code === "auth/network-request-failed") {
          error = "Network problem. Check your connection.";
        }
        return { ok: false, error };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await fbSignOut(auth());
  }, []);

  const refreshClaims = useCallback(async () => {
    const u = auth().currentUser;
    if (!u) return;
    const token = await u.getIdTokenResult(true);
    setIsAdmin(token.claims.admin === true);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, loading, signIn, signOut, refreshClaims }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
