/**
 * Public, unauthenticated raw host lists.
 *
 *   /raw/tesla.com              every host for one root domain
 *   /raw/tesla.com/new          hosts first seen in the last N hours (default 24)
 *   /raw/hackerone              every host across a platform
 *   /raw/hackerone/tesla        every host for one program on that platform
 *
 * Optional query params: format=txt|csv|json, hours=<n>, scope=all|new|inactive,
 * active=false to include retired hosts in platform dumps.
 */

const PAGE = 1000;
const PLATFORM_PAGE = 10000;

type Row = {
  host: string;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
};

type Format = "txt" | "csv" | "json";

function textResponse(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function contentType(format: Format) {
  return format === "json"
    ? "application/json; charset=utf-8"
    : format === "csv"
      ? "text/csv; charset=utf-8"
      : "text/plain; charset=utf-8";
}

function makeWriter(format: Format, controller: ReadableStreamDefaultController, enc: TextEncoder) {
  let emitted = 0;
  return {
    write(rows: Row[]) {
      if (!rows.length) return;
      if (format === "csv") {
        if (emitted === 0) enc && controller.enqueue(enc.encode("host,first_seen_at,last_seen_at,is_active\n"));
        controller.enqueue(
          enc.encode(
            rows.map((r) => `${r.host},${r.first_seen_at},${r.last_seen_at},${r.is_active}`).join("\n") + "\n",
          ),
        );
      } else if (format === "json") {
        const body = rows.map((r) => JSON.stringify(r)).join(",\n");
        controller.enqueue(enc.encode((emitted === 0 ? "[\n" : ",\n") + body));
      } else {
        controller.enqueue(enc.encode(rows.map((r) => r.host).join("\n") + "\n"));
      }
      emitted += rows.length;
    },
    finish() {
      if (format === "json") controller.enqueue(enc.encode(emitted === 0 ? "[]\n" : "\n]\n"));
    },
    get count() {
      return emitted;
    },
  };
}

export async function handleRawExport(request: Request, splat: string): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const url = new URL(request.url);
  const segments = splat
    .split("/")
    .map((s) => decodeURIComponent(s).trim().toLowerCase())
    .filter(Boolean);

  if (segments.length === 0) {
    return textResponse(
      [
        "# Chaos raw lists — plain text, no authentication",
        "",
        "/raw/{domain}                 all hosts for one root domain",
        "/raw/{domain}/new             hosts first seen in the last 24h (?hours=N)",
        "/raw/{platform}               all hosts across a platform",
        "/raw/{platform}/{program}     all hosts for one program on that platform",
        "",
        "Optional: ?format=txt|csv|json  ?hours=N  ?scope=all|new|inactive  ?active=false",
        "",
      ].join("\n"),
      200,
    );
  }

  const rawFormat = (url.searchParams.get("format") ?? "").toLowerCase();
  const format: Format = rawFormat === "csv" || rawFormat === "json" ? rawFormat : "txt";
  const hours = Number(url.searchParams.get("hours") ?? 24);
  const sinceIso = new Date(
    Date.now() - (Number.isFinite(hours) && hours > 0 ? hours : 24) * 3600_000,
  ).toISOString();

  const [first, second] = segments;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const encoder = new TextEncoder();

  // ---- domain list -------------------------------------------------------
  const looksLikeDomain = first.includes(".");
  if (looksLikeDomain) {
    const { data: domainRow } = await supabaseAdmin
      .from("domains")
      .select("id, domain")
      .eq("domain", first)
      .maybeSingle();
    if (!domainRow) return textResponse("", 404);

    const rawScope = (second ?? url.searchParams.get("scope") ?? "all").toLowerCase();
    const scope = rawScope === "new" || rawScope === "inactive" ? rawScope : "all";

    const stream = new ReadableStream({
      async start(controller) {
        const w = makeWriter(format, controller, encoder);
        try {
          let from = 0;
          for (let page = 0; page < 5000; page++) {
            let q = supabaseAdmin
              .from("subdomains")
              .select("host, first_seen_at, last_seen_at, is_active")
              .eq("domain_id", domainRow.id)
              .order("host", { ascending: true })
              .range(from, from + PAGE - 1);
            if (scope === "inactive") q = q.eq("is_active", false);
            if (scope === "new") q = q.gte("first_seen_at", sinceIso);
            const { data, error } = await q;
            if (error) throw new Error(error.message || "database error");
            if (!data || data.length === 0) break;
            w.write(data as Row[]);
            if (data.length < PAGE) break;
            from += PAGE;
          }
        } catch (e) {
          controller.enqueue(
            encoder.encode(`\n# error: ${e instanceof Error ? e.message : String(e)}\n`),
          );
        }
        w.finish();
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": contentType(format),
        "Access-Control-Allow-Origin": "*",
        "X-Chaos-Source": `domain:${domainRow.domain}`,
      },
    });
  }

  // ---- platform (optionally one program) ---------------------------------
  const { data: platform } = await supabaseAdmin
    .from("platforms")
    .select("id, slug")
    .eq("slug", first)
    .maybeSingle();
  if (!platform) return textResponse("", 404);

  const program = second ?? url.searchParams.get("program")?.trim().toLowerCase() ?? null;
  const activeOnly = url.searchParams.get("active") !== "false";

  const stream = new ReadableStream({
    async start(controller) {
      const w = makeWriter(format, controller, encoder);
      try {
        let afterDomain: string | null = null;
        let afterHost = "";
        for (let page = 0; page < 5000; page++) {
          const { data, error } = await supabaseAdmin.rpc("platform_subdomains_page", {
            _platform_id: platform.id,
            _lim: PLATFORM_PAGE,
            _active_only: activeOnly,
            ...(program ? { _domain_filter: program } : {}),
            ...(afterDomain ? { _after_domain: afterDomain, _after_host: afterHost } : {}),
          });
          if (error) throw new Error(error.message || "database error");
          const rows = (data ?? []) as Array<Row & { domain_id: string }>;
          if (rows.length === 0) break;
          w.write(rows);
          if (rows.length < PLATFORM_PAGE) break;
          const last = rows[rows.length - 1]!;
          afterDomain = last.domain_id;
          afterHost = last.host;
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(`\n# error: ${e instanceof Error ? e.message : String(e)}\n`),
        );
      }
      w.finish();
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": contentType(format),
      "Access-Control-Allow-Origin": "*",
      "X-Chaos-Source": program ? `program:${platform.slug}/${program}` : `platform:${platform.slug}`,
    },
  });
}
