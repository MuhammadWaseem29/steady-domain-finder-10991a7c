import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession, displayNameOf } from "@/lib/use-session";
import { SiteShell, Reveal, Stat } from "@/components/site/chrome";
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  revokeApiKey,
} from "@/lib/api-keys.functions";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account & API keys — Chaos Subdomain Monitor" },
      {
        name: "description",
        content:
          "Manage your Chaos account and issue API tokens for programmatic access to domains, subdomains and scan data.",
      },
      { property: "og:title", content: "Account & API keys — Chaos" },
      {
        property: "og:description",
        content: "Create and revoke API tokens for the Chaos subdomain API.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);

  const list = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const remove = useServerFn(deleteApiKey);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { next: "/account" }, replace: true });
  }, [loading, user, navigate]);

  const keysQuery = useQuery({
    queryKey: ["api-keys", user?.id],
    queryFn: () => list(),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (keyName: string) => create({ data: { name: keyName } }),
    onSuccess: (res) => {
      setFresh(res.key);
      setName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created — copy it now, it won't be shown again");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Key revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("Key deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const keys = keysQuery.data ?? [];
  const active = keys.filter((k) => !k.revoked).length;

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <Reveal>
          <p className="label-mono text-muted-foreground">Account</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            {displayNameOf(user ?? null) || "Your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.email} · API tokens authenticate every request to{" "}
            <Link to="/docs/api" className="story-link text-foreground">
              the Chaos API
            </Link>
            .
          </p>
          <button
            onClick={signOut}
            className="mt-4 rounded-full border border-border px-4 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            Sign out
          </button>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Stat label="Active keys" value={active} index={0} />
          <Stat label="Total keys" value={keys.length} index={1} />
          <Stat label="API version" value={<span className="font-mono text-2xl">v1</span>} index={2} />
        </div>

        <Reveal className="mt-8 rounded-lg border border-border bg-card p-5">
          <h2 className="text-lg font-bold tracking-tight">Create an API key</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The full token is shown once. Store it somewhere safe.
          </p>
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                toast.error("Give the key a name");
                return;
              }
              createMutation.mutate(name.trim());
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. recon-laptop"
              className="min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {createMutation.isPending ? "Creating…" : "Create key"}
            </button>
          </form>

          {fresh && (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4">
              <p className="label-mono text-muted-foreground">Your new key</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-background px-2 py-1 font-mono text-sm">
                  {fresh}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(fresh);
                    toast.success("Copied");
                  }}
                  className="rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-accent"
                >
                  Copy
                </button>
                <button
                  onClick={() => setFresh(null)}
                  className="rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </Reveal>

        <Reveal className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Your keys</h2>
          </div>
          {keysQuery.isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="label-mono text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-2 text-left font-normal">Name</th>
                  <th className="px-5 py-2 text-left font-normal">Prefix</th>
                  <th className="px-5 py-2 text-left font-normal">Last used</th>
                  <th className="px-5 py-2 text-left font-normal">Status</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2.5">{k.name}</td>
                    <td className="px-5 py-2.5 font-mono text-xs">{k.key_prefix}…</td>
                    <td className="px-5 py-2.5 text-muted-foreground">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                    </td>
                    <td className="px-5 py-2.5">
                      {k.revoked ? (
                        <span className="label-mono text-destructive">revoked</span>
                      ) : (
                        <span className="label-mono text-muted-foreground">active</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {!k.revoked && (
                        <button
                          onClick={() => revokeMutation.mutate(k.id)}
                          className="rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-accent"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(k.id)}
                        className="ml-2 rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Reveal>
      </div>
    </SiteShell>
  );
}
