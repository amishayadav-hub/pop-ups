"use client";

import { useState } from "react";
import { Lock, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "./AuthProvider";

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await signIn(email.trim(), password);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
    }
    // success: AuthProvider state changes, parent re-renders, this unmounts.
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader className="space-y-2">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            N
          </div>
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight">
              NexCent
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Sign in to manage Anveshan popups.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Email
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amisha.yadav@anveshan.farm"
                  className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Password
              </label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={busy} className="w-full gap-1.5">
              {busy ? (
                "Signing in…"
              ) : (
                <>
                  <LogIn className="h-3.5 w-3.5" />
                  Sign in
                </>
              )}
            </Button>
          </form>

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Admin-only access. New users are created from the CLI via{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              npm run create-admin
            </code>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function NoAdminScreen({ email }: { email: string }) {
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm shadow-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Access denied
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            You're signed in as{" "}
            <span className="font-medium text-foreground">{email}</span> but
            your account doesn't have admin access.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p>
            Ask whoever runs this project to grant you admin from the CLI:
          </p>
          <pre className="rounded-md bg-muted p-2 text-[11px]">
            cd backend/scripts{"\n"}npm run create-admin {email} &lt;password&gt;
          </pre>
          <Button
            size="sm"
            variant="outline"
            onClick={signOut}
            className="w-full"
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
