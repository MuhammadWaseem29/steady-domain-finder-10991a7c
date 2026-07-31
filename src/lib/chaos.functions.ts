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
    z.object({ domains: z.string().min(1).max(20000) }).parse(data),
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
    ).slice(0, 500);

    if (list.length === 0) return { added: 0 };

    const { error } = await supabaseAdmin
      .from("domains")
      .upsert(
        list.map((domain) => ({ domain })),
        { onConflict: "domain", ignoreDuplicates: true },
      );

    if (error) throw new Error(error.message);
    return { added: list.length };
  });
