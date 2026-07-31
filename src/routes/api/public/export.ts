import { createFileRoute } from "@tanstack/react-router";

const PAGE = 1000;

export const Route = createFileRoute("/api/public/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const platform = url.searchParams.get("platform");
        const domain = url.searchParams.get("domain");
        const scope = url.searchParams.get("scope") === "new" ? "new" : "all";
        const hours = Number(url.searchParams.get("hours") ?? 24);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let domainIds: string[] | null = null;
        if (domain) {
          const { data } = await supabaseAdmin
            .from("domains")
            .select("id")
            .eq("domain", domain.toLowerCase());
          domainIds = (data ?? []).map((d) => d.id);
        } else if (platform) {
          const { data: p } = await supabaseAdmin
            .from("platforms")
            .select("id")
            .eq("slug", platform)
            .maybeSingle();
          if (!p) return new Response("Unknown platform", { status: 404 });
          const ids: string[] = [];
          for (let page = 0; page < 100; page++) {
            const { data } = await supabaseAdmin
              .from("domains")
              .select("id")
              .eq("platform_id", p.id)
              .range(page * PAGE, page * PAGE + PAGE - 1);
            ids.push(...(data ?? []).map((d) => d.id));
            if (!data || data.length < PAGE) break;
          }
          domainIds = ids;
        }

        if (domainIds && domainIds.length === 0) {
          return new Response("", { headers: { "Content-Type": "text/plain" } });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              let from = 0;
              for (let page = 0; page < 5000; page++) {
                let q = supabaseAdmin
                  .from("subdomains")
                  .select("host")
                  .order("host", { ascending: true })
                  .range(from, from + PAGE - 1);
                if (domainIds) q = q.in("domain_id", domainIds);
                if (scope === "new")
                  q = q.gte(
                    "first_seen_at",
                    new Date(Date.now() - hours * 3600_000).toISOString(),
                  );
                const { data, error } = await q;
                if (error) throw new Error(error.message);
                if (!data || data.length === 0) break;
                controller.enqueue(encoder.encode(data.map((r) => r.host).join("\n") + "\n"));
                if (data.length < PAGE) break;
                from += PAGE;
              }
            } catch (e) {
              controller.enqueue(
                encoder.encode(`\n# export error: ${e instanceof Error ? e.message : e}\n`),
              );
            }
            controller.close();
          },
        });

        const name = domain ?? platform ?? "all";
        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${name}-${scope}-subdomains.txt"`,
          },
        });
      },
    },
  },
});
