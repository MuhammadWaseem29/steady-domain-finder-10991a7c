import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BOARDS = ["live", "interesting", "ai", "other"] as const;
export type Board = (typeof BOARDS)[number];

export const SCHEMES = ["https", "http", "both"] as const;
export type Scheme = (typeof SCHEMES)[number];

export type Note = {
  id: string;
  board: Board;
  host: string | null;
  scheme: Scheme;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

const hostSchema = z
  .string()
  .trim()
  .max(253)
  .regex(/^[a-zA-Z0-9._:/-]*$/, "invalid host")
  .optional()
  .nullable();

const noteInput = z.object({
  id: z.string().uuid().optional(),
  board: z.enum(BOARDS),
  host: hostSchema,
  scheme: z.enum(SCHEMES).default("https"),
  body: z.string().trim().max(4000).default(""),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
});

function normalizeHost(raw: string | null | undefined): { host: string | null; scheme?: Scheme } {
  if (!raw) return { host: null };
  const trimmed = raw.trim();
  if (!trimmed) return { host: null };
  if (/^https:\/\//i.test(trimmed))
    return { host: trimmed.replace(/^https:\/\//i, "").replace(/\/+$/, ""), scheme: "https" };
  if (/^http:\/\//i.test(trimmed))
    return { host: trimmed.replace(/^http:\/\//i, "").replace(/\/+$/, ""), scheme: "http" };
  return { host: trimmed.replace(/\/+$/, "") };
}

export const listNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notes")
      .select("id, board, host, scheme, body, tags, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as Note[];
  });

export const upsertNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => noteInput.parse(data))
  .handler(async ({ data, context }) => {
    const norm = normalizeHost(data.host);
    const row = {
      board: data.board,
      host: norm.host,
      scheme: norm.scheme ?? data.scheme,
      body: data.body,
      tags: data.tags,
    };

    if (!row.host && !row.body) throw new Error("Add a host or a note first");

    if (data.id) {
      const { error } = await context.supabase
        .from("notes")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await context.supabase
      .from("notes")
      .insert({ ...row, user_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const bulkAddNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        board: z.enum(BOARDS),
        text: z.string().min(1).max(200000),
        scheme: z.enum(SCHEMES).default("https"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const lines = Array.from(
      new Set(
        data.text
          .split(/[\s,]+/)
          .map((l) => l.trim())
          .filter(Boolean),
      ),
    ).slice(0, 2000);

    const rows = lines
      .map((line) => {
        const norm = normalizeHost(line);
        if (!norm.host) return null;
        return {
          user_id: context.userId,
          board: data.board,
          host: norm.host,
          scheme: norm.scheme ?? data.scheme,
          body: "",
          tags: [] as string[],
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (!rows.length) return { added: 0 };

    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await context.supabase.from("notes").insert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
    return { added: rows.length };
  });

export const moveNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), board: z.enum(BOARDS) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notes")
      .update({ board: data.board })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notes")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
