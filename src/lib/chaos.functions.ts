import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const runScanNow = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ domainId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { scanDomain } = await import("@/lib/chaos.server");

    const { data: domain } = await supabaseAdmin
      .from("domains")
      .select("id, domain")
      .eq("id", data.domainId)
      .maybeSingle();

    if (!domain) return { status: "error" as const, error: "Domain not found" };
    return await scanDomain(domain, "manual");
  });

export const addDomains = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        domains: z.string().min(1).max(200000),
        platformSlug: z.string().min(1).max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const list = Array.from(
      new Set(
        data.domains
          .split(/[\s,]+/)
          .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
          .filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)),
      ),
    ).slice(0, 5000);

    if (list.length === 0) return { added: 0 };

    let platformId: string | null = null;
    if (data.platformSlug) {
      const { data: platform } = await supabaseAdmin
        .from("platforms")
        .select("id")
        .eq("slug", data.platformSlug)
        .maybeSingle();
      platformId = platform?.id ?? null;
    }

    for (let i = 0; i < list.length; i += 500) {
      const batch = list.slice(i, i + 500);
      const { error } = await supabaseAdmin
        .from("domains")
        .upsert(
          batch.map((domain) => ({ domain, platform_id: platformId })),
          { onConflict: "domain", ignoreDuplicates: !platformId },
        );
      if (error) throw new Error(error.message);
    }

    return { added: list.length };
  });

export const savePlatform = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(60),
        slug: z
          .string()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9-]+$/, "slug must be lowercase letters, numbers or dashes"),
        color: z.string().max(20).optional(),
        website: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = {
      name: data.name.trim(),
      slug: data.slug.trim(),
      color: data.color?.trim() || "#6ee7b7",
      website: data.website?.trim() || null,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("platforms").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, updated: true };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("platforms")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id, updated: false };
  });

export const deletePlatform = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        deleteDomains: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.deleteDomains) {
      const { data: domains, error: listError } = await supabaseAdmin
        .from("domains")
        .select("id")
        .eq("platform_id", data.id);
      if (listError) throw new Error(listError.message);
      const ids = (domains ?? []).map((d) => d.id);
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200);
        await supabaseAdmin.from("subdomains").delete().in("domain_id", batch);
        await supabaseAdmin.from("scans").delete().in("domain_id", batch);
        const { error } = await supabaseAdmin.from("domains").delete().in("id", batch);
        if (error) throw new Error(error.message);
      }
    } else {
      const { error } = await supabaseAdmin
        .from("domains")
        .update({ platform_id: null })
        .eq("platform_id", data.id);
      if (error) throw new Error(error.message);
    }

    const { error } = await supabaseAdmin.from("platforms").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateDomain = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        domain: z
          .string()
          .min(3)
          .max(253)
          .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "invalid domain")
          .optional(),
        platformId: z.string().uuid().nullable().optional(),
        enabled: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.domain !== undefined) patch.domain = data.domain.trim().toLowerCase();
    if (data.platformId !== undefined) patch.platform_id = data.platformId;
    if (data.enabled !== undefined) patch.enabled = data.enabled;

    const { error } = await supabaseAdmin.from("domains").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDomain = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subdomains").delete().eq("domain_id", data.id);
    await supabaseAdmin.from("scans").delete().eq("domain_id", data.id);
    const { error } = await supabaseAdmin.from("domains").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
