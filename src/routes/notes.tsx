import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { NotebookPen, Search } from "lucide-react";

import { SiteShell, Reveal, Stat, SignInNotice } from "@/components/site/chrome";
import { NotesBoard, BOARD_META } from "@/components/site/notes-board";
import { useSession } from "@/lib/use-session";
import {
  type Board,
  type Note,
  bulkAddNotes,
  deleteNote,
  listNotes,
  moveNote,
  upsertNote,
} from "@/lib/notes.functions";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Recon notes — live hosts, findings & AI sites | Chaos" },
      {
        name: "description",
        content:
          "A private workspace to track live subdomains, interesting data and AI-generated sites. Add notes, tag hosts, open them over http or https, copy and export.",
      },
      { property: "og:title", content: "Recon notes — live hosts, findings & AI sites | Chaos" },
      {
        property: "og:description",
        content:
          "Keep your own boards of live subdomains, interesting findings and AI-generated sites, with copy and export built in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { user, loading } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const list = useServerFn(listNotes);
  const upsert = useServerFn(upsertNote);
  const bulk = useServerFn(bulkAddNotes);
  const remove = useServerFn(deleteNote);
  const move = useServerFn(moveNote);

  const notesQuery = useQuery({
    queryKey: ["notes", user?.id],
    queryFn: () => list(),
    enabled: !!user,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["notes", user?.id] });
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Something went wrong");

  const saveMutation = useMutation({
    mutationFn: (input: {
      id?: string;
      board: Board;
      host: string;
      scheme: "http" | "https" | "both";
      body: string;
      tags: string[];
    }) => upsert({ data: input }),
    onSuccess: () => {
      toast.success("Saved");
      refresh();
    },
    onError: fail,
  });

  const bulkMutation = useMutation({
    mutationFn: (input: { board: Board; text: string }) =>
      bulk({ data: { board: input.board, text: input.text, scheme: "https" } }),
    onSuccess: (r) => {
      toast.success(`Added ${r.added} hosts`);
      refresh();
    },
    onError: fail,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => refresh(),
    onError: fail,
  });

  const moveMutation = useMutation({
    mutationFn: (input: { id: string; board: Board }) => move({ data: input }),
    onSuccess: () => refresh(),
    onError: fail,
  });

  const notes: Note[] = notesQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        (n.host ?? "").toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [notes, search]);

  const byBoard = (board: Board) => filtered.filter((n) => n.board === board);
  const disabled = !user || saveMutation.isPending;

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <Reveal>
          <p className="label-mono flex items-center gap-2 text-muted-foreground">
            <NotebookPen className="h-3.5 w-3.5" /> Workspace
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Recon notes</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Your private boards for live subdomains, interesting data, AI-generated sites and
            anything else worth remembering. Hosts open over http or https in one click.
          </p>
        </Reveal>

        <div className="mt-8">
          <SignInNotice />
        </div>

        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BOARD_META.map((b, i) => (
            <Stat
              key={b.key}
              index={i}
              label={b.title}
              value={notes.filter((n) => n.board === b.key).length}
              hint={b.blurb}
            />
          ))}
        </div>

        <Reveal className="mt-8 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hosts, notes and tags…"
            className="w-full bg-transparent text-sm outline-none"
          />
          {search && (
            <span className="label-mono text-muted-foreground">{filtered.length} matches</span>
          )}
        </Reveal>

        {loading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
        ) : !user ? (
          <Reveal className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Notes are private to your account.{" "}
              <Link to="/auth" className="story-link font-semibold text-foreground">
                Sign in
              </Link>{" "}
              to start collecting hosts and findings.
            </p>
          </Reveal>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {BOARD_META.map((meta) => (
              <NotesBoard
                key={meta.key}
                meta={meta}
                notes={byBoard(meta.key)}
                disabled={disabled}
                onCreate={(input) => saveMutation.mutate(input)}
                onUpdate={(input) => saveMutation.mutate(input)}
                onDelete={(id) => deleteMutation.mutate(id)}
                onMove={(id, board) => moveMutation.mutate({ id, board })}
                onBulk={(board, text) => bulkMutation.mutate({ board, text })}
              />
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
