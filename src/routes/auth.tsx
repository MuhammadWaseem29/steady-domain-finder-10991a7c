import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/use-session";
import { SiteShell, Reveal } from "@/components/site/chrome";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — Chaos Subdomain Monitor" },
      {
        name: "description",
        content:
          "Sign in to the Chaos subdomain monitor to run scans, manage programs and issue API tokens for programmatic access.",
      },
      { property: "og:title", content: "Sign in — Chaos Subdomain Monitor" },
      {
        property: "og:description",
        content: "Sign in to run scans, manage programs and create API tokens.",
      },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(72),
});

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const next = safeNext(search.next);

  useEffect(() => {
    if (!loading && user) navigate({ to: next, replace: true });
  }, [loading, user, navigate, next]);

  async function onGoogle() {
    setBusy(true);
    try {
      sessionStorage.setItem("chaos:next", next);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: next, replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid credentials");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast.success("Check your email to confirm your account");
          return;
        }
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Signed in");
      }
      navigate({ to: next, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteShell>
      <div className="mx-auto flex max-w-6xl justify-center px-5 py-16">
        <Reveal className="w-full max-w-md rounded-xl border border-border bg-card p-7">
          <p className="label-mono text-muted-foreground">Account</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
            {mode === "signin" ? "Sign in to Chaos" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browsing stays open to everyone. Sign in to run scans, manage programs and issue API
            tokens.
          </p>

          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
          >
            <GoogleMark />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="label-mono text-muted-foreground">or email</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {sent ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              We sent a confirmation link to <span className="font-mono">{email}</span>. Click it,
              then come back and sign in.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <label className="block">
                <span className="label-mono text-muted-foreground">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="you@company.com"
                  maxLength={255}
                  required
                />
              </label>
              <label className="block">
                <span className="label-mono text-muted-foreground">Password</span>
                <input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="At least 8 characters"
                  maxLength={72}
                  required
                />
              </label>
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
              </motion.button>
            </form>
          )}

          <p className="mt-5 text-sm text-muted-foreground">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="story-link font-medium text-foreground"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setSent(false);
              }}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Need programmatic access? See the{" "}
            <Link to="/docs/api" className="story-link text-foreground">
              API docs
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </SiteShell>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.86-.08-1.5-.24-2.16H12v3.93h6.6c-.13 1.1-.85 2.75-2.45 3.86l-.02.15 3.56 2.76.25.02c2.26-2.09 3.56-5.17 3.56-8.56Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.79-2.93c-1.01.7-2.37 1.2-4.15 1.2-3.17 0-5.86-2.09-6.82-4.98l-.14.01-3.7 2.87-.05.13C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.18 14.39a7.4 7.4 0 0 1-.4-2.39c0-.83.15-1.64.39-2.39l-.01-.16L1.4 6.54l-.12.06A11.99 11.99 0 0 0 0 12c0 1.94.47 3.77 1.28 5.4l3.9-3.01Z"
      />
      <path
        fill="#EB4335"
        d="M12 4.63c2.25 0 3.77.97 4.63 1.79l3.39-3.31C17.95 1.17 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.6l3.89 3.01C6.14 6.72 8.83 4.63 12 4.63Z"
      />
    </svg>
  );
}
