import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

const hostSchema = z.string().trim().toLowerCase().max(253).regex(HOST_RE, "Invalid hostname");

export const listLiveHosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("live_hosts")
      .select("id, host, note, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20000);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addLiveHosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        hosts: z.array(hostSchema).min(1).max(5000),
        note: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const unique = Array.from(new Set(data.hosts));
    const rows = unique.map((host) => ({
      user_id: context.userId,
      host,
      note: data.note?.length ? data.note : null,
    }));

    const { data: inserted, error } = await context.supabase
      .from("live_hosts")
      .upsert(rows, { onConflict: "user_id,host", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);

    const added = inserted?.length ?? 0;
    return { added, skipped: unique.length - added, submitted: unique.length };
  });

export const updateLiveHostNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().trim().max(120) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("live_hosts")
      .update({ note: data.note || null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLiveHosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(5000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("live_hosts")
      .delete()
      .in("id", data.ids)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { deleted: data.ids.length };
  });

export const clearLiveHosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("live_hosts")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
