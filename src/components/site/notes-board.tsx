import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Download, Plus, Trash2, Pencil, Check, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { EASE_SIGNATURE, springSnappy } from "@/components/site/motion";
import { BOARDS, SCHEMES, type Board, type Note, type Scheme } from "@/lib/notes.functions";

export type BoardMeta = {
  key: Board;
  title: string;
  blurb: string;
  accent: string;
  ring: string;
  chip: string;
};

export const BOARD_META: BoardMeta[] = [
  {
    key: "live",
    title: "Live subdomains",
    blurb: "Hosts you confirmed are responding",
    accent: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    ring: "border-emerald-500/40",
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "interesting",
    title: "Interesting data",
    blurb: "Endpoints, leaks and odd responses",
    accent: "from-sky-500/20 via-sky-500/5 to-transparent",
    ring: "border-sky-500/40",
    chip: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  {
    key: "ai",
    title: "AI generated sites",
    blurb: "Hosts that look machine-built",
    accent: "from-fuchsia-500/20 via-fuchsia-500/5 to-transparent",
    ring: "border-fuchsia-500/40",
    chip: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  },
  {
    key: "other",
    title: "Other notes",
    blurb: "Anything else worth remembering",
    accent: "from-amber-500/20 via-amber-500/5 to-transparent",
    ring: "border-amber-500/40",
    chip: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
];

export const BOARD_TITLES: Record<Board, string> = BOARD_META.reduce(
  (acc, b) => ({ ...acc, [b.key]: b.title }),
  {} as Record<Board, string>,
);

function hostUrl(host: string, scheme: "http" | "https") {
  return `${scheme}://${host}`;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function NotesBoard({
  meta,
  notes,
  disabled,
  onCreate,
  onUpdate,
  onDelete,
  onMove,
  onBulk,
}: {
  meta: BoardMeta;
  notes: Note[];
  disabled: boolean;
  onCreate: (input: { board: Board; host: string; scheme: Scheme; body: string; tags: string[] }) => void;
  onUpdate: (input: { id: string; board: Board; host: string; scheme: Scheme; body: string; tags: string[] }) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, board: Board) => void;
  onBulk: (board: Board, text: string) => void;
}) {
  const [host, setHost] = useState("");
  const [scheme, setScheme] = useState<Scheme>("https");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const hosts = useMemo(
    () => notes.map((n) => n.host).filter((h): h is string => !!h),
    [notes],
  );

  const submit = () => {
    if (!host.trim() && !body.trim()) {
      toast.error("Add a host or a note first");
      return;
    }
    onCreate({
      board: meta.key,
      host: host.trim(),
      scheme,
      body: body.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20),
    });
    setHost("");
    setBody("");
    setTags("");
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.45, ease: EASE_SIGNATURE }}
      className={`flex flex-col overflow-hidden rounded-2xl border ${meta.ring} bg-card`}
    >
      <div className={`bg-gradient-to-br ${meta.accent} px-5 py-4`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">{meta.title}</h2>
            <p className="text-xs text-muted-foreground">{meta.blurb}</p>
          </div>
          <span className={`label-mono rounded-full px-2.5 py-1 tabular-nums ${meta.chip}`}>
            {notes.length}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!hosts.length}
            onClick={() => {
              navigator.clipboard.writeText(hosts.join("\n"));
              toast.success(`Copied ${hosts.length} hosts`);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" /> Copy hosts
          </button>
          {(["txt", "csv", "json"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              disabled={!notes.length}
              onClick={() => {
                const stamp = new Date().toISOString().slice(0, 10);
                if (fmt === "txt")
                  download(`${meta.key}-${stamp}.txt`, hosts.join("\n"), "text/plain");
                else if (fmt === "csv")
                  download(
                    `${meta.key}-${stamp}.csv`,
                    ["host,scheme,note,tags"]
                      .concat(
                        notes.map(
                          (n) =>
                            `${n.host ?? ""},${n.scheme},"${(n.body || "").replace(/"/g, '""')}","${n.tags.join(" ")}"`,
                        ),
                      )
                      .join("\n"),
                    "text/csv",
                  );
                else
                  download(
                    `${meta.key}-${stamp}.json`,
                    JSON.stringify(notes, null, 2),
                    "application/json",
                  );
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium uppercase transition-colors hover:bg-accent disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" /> {fmt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-border p-4">
        <div className="flex gap-2">
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={disabled}
            placeholder="host.example.com or https://host.example.com"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-foreground/40"
          />
          <select
            value={scheme}
            onChange={(e) => setScheme(e.target.value as Scheme)}
            disabled={disabled}
            className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
          >
            {SCHEMES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder="Note — what did you find here?"
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
        />
        <div className="flex gap-2">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={disabled}
            placeholder="tags, comma separated"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={springSnappy}
            type="button"
            disabled={disabled}
            onClick={submit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Plus className="h-4 w-4" /> Add
          </motion.button>
        </div>

        <button
          type="button"
          onClick={() => setBulkOpen((v) => !v)}
          className="label-mono text-muted-foreground transition-colors hover:text-foreground"
        >
          {bulkOpen ? "hide bulk paste" : "bulk paste hosts"}
        </button>
        <AnimatePresence initial={false}>
          {bulkOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                disabled={disabled}
                rows={4}
                placeholder={"one host per line\nhttps://a.example.com\nhttp://b.example.com"}
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground/40"
              />
              <button
                type="button"
                disabled={disabled || !bulkText.trim()}
                onClick={() => {
                  onBulk(meta.key, bulkText);
                  setBulkText("");
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent disabled:opacity-40"
              >
                Add all
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 space-y-2 border-t border-border p-4">
        {notes.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing here yet — add your first entry above.
          </p>
        )}
        <AnimatePresence initial={false}>
          {notes.map((note, i) => (
            <motion.div
              key={note.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.02, ease: EASE_SIGNATURE }}
              className="rounded-xl border border-border bg-background/60 p-3 transition-colors hover:bg-accent/40"
            >
              {editing === note.id ? (
                <EditRow
                  note={note}
                  onCancel={() => setEditing(null)}
                  onSave={(patch) => {
                    onUpdate({ id: note.id, board: note.board, ...patch });
                    setEditing(null);
                  }}
                />
              ) : (
                <>
                  {note.host && (
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="break-all font-mono text-sm font-semibold">{note.host}</code>
                      {(note.scheme === "both"
                        ? (["https", "http"] as const)
                        : ([note.scheme] as const)
                      ).map((s) => (
                        <a
                          key={s}
                          href={hostUrl(note.host!, s as "http" | "https")}
                          target="_blank"
                          rel="noreferrer noopener"
                          className={`label-mono inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${meta.chip}`}
                        >
                          {s} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  )}
                  {note.body && <p className="mt-1.5 whitespace-pre-wrap text-sm">{note.body}</p>}
                  {note.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {note.tags.map((t) => (
                        <span
                          key={t}
                          className="label-mono rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={note.board}
                      onChange={(e) => onMove(note.id, e.target.value as Board)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                    >
                      {BOARDS.map((b) => (
                        <option key={b} value={b}>
                          {BOARD_TITLES[b]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setEditing(note.id)}
                      className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label="Edit note"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(note.id)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function EditRow({
  note,
  onSave,
  onCancel,
}: {
  note: Note;
  onSave: (patch: { host: string; scheme: Scheme; body: string; tags: string[] }) => void;
  onCancel: () => void;
}) {
  const [host, setHost] = useState(note.host ?? "");
  const [scheme, setScheme] = useState<Scheme>(note.scheme);
  const [body, setBody] = useState(note.body);
  const [tags, setTags] = useState(note.tags.join(", "));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm"
        />
        <select
          value={scheme}
          onChange={(e) => setScheme(e.target.value as Scheme)}
          className="rounded-lg border border-border bg-background px-2 text-sm"
        >
          {SCHEMES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
      />
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        placeholder="tags"
        className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            onSave({
              host: host.trim(),
              scheme,
              body: body.trim(),
              tags: tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 20),
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Check className="h-3.5 w-3.5" /> Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </button>
      </div>
    </div>
  );
}
