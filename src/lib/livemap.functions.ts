import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const filterSchema = z.object({
  platformSlug: z.string().trim().toLowerCase().max(60).optional(),
});

export type ProgramLiveRow = {
  domain: string;
  platform_name: string | null;
  platform_slug: string | null;
  platform_color: string | null;
  live_hosts: number;
  takeover_count: number;
  ok_count: number;
  auth_count: number;
  last_probed_at: string | null;
};

export const liveDashboardStats = createServerFn({ method: "GET" })
  .inputValidator((input) => filterSchema.parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const slug = data.platformSlug ?? null;
    const [programs, statuses] = await Promise.all([
      sb.rpc("live_program_stats", { _limit: 40, _platform_slug: slug }),
      sb.rpc("live_status_stats", { _platform_slug: slug }),
    ]);
    if (programs.error) throw new Error(programs.error.message);
    if (statuses.error) throw new Error(statuses.error.message);

    const rows = (programs.data ?? []) as ProgramLiveRow[];
    const codes = ((statuses.data ?? []) as { status_code: number; c: number }[]).map((r) => ({
      code: r.status_code,
      count: Number(r.c),
    }));

    const totals = {
      liveHosts: codes.reduce((a, c) => a + c.count, 0),
      programs: rows.length,
      takeover: rows.reduce((a, r) => a + Number(r.takeover_count), 0),
      ok: codes.filter((c) => c.code >= 200 && c.code < 300).reduce((a, c) => a + c.count, 0),
    };

    return { programs: rows, codes, totals };
  });

type Geo = { lat: number; lon: number; country: string | null; city: string | null; org: string | null };

const geoCache = new Map<string, Geo | null>();

async function geolocate(ips: string[]): Promise<Map<string, Geo>> {
  const out = new Map<string, Geo>();
  const missing: string[] = [];
  for (const ip of ips) {
    const hit = geoCache.get(ip);
    if (hit === undefined) missing.push(ip);
    else if (hit) out.set(ip, hit);
  }

  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100);
    try {
      const res = await fetch("http://ip-api.com/batch?fields=status,query,lat,lon,country,city,org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as Array<{
        status: string;
        query: string;
        lat?: number;
        lon?: number;
        country?: string;
        city?: string;
        org?: string;
      }>;
      for (const r of json) {
        if (r.status === "success" && typeof r.lat === "number" && typeof r.lon === "number") {
          const geo: Geo = {
            lat: r.lat,
            lon: r.lon,
            country: r.country ?? null,
            city: r.city ?? null,
            org: r.org ?? null,
          };
          geoCache.set(r.query, geo);
          out.set(r.query, geo);
        } else {
          geoCache.set(r.query, null);
        }
      }
    } catch {
      // Fallback: resolve a smaller slice one by one over https.
      await Promise.all(
        chunk.slice(0, 40).map(async (ip) => {
          try {
            const res = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(6000) });
            const j = (await res.json()) as {
              success?: boolean;
              latitude?: number;
              longitude?: number;
              country?: string;
              city?: string;
              connection?: { org?: string };
            };
            if (j.success && typeof j.latitude === "number" && typeof j.longitude === "number") {
              const geo: Geo = {
                lat: j.latitude,
                lon: j.longitude,
                country: j.country ?? null,
                city: j.city ?? null,
                org: j.connection?.org ?? null,
              };
              geoCache.set(ip, geo);
              out.set(ip, geo);
            } else {
              geoCache.set(ip, null);
            }
          } catch {
            /* leave uncached so it retries later */
          }
        }),
      );
    }
  }
  return out;
}

export type MapPoint = {
  ip: string;
  hosts: number;
  takeover: number;
  host: string;
  domain: string | null;
  platform: string | null;
  color: string | null;
  lat: number;
  lon: number;
  country: string | null;
  city: string | null;
  org: string | null;
};

export const liveIpMap = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    filterSchema.extend({ limit: z.number().int().min(20).max(300).default(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows, error } = await sb.rpc("live_ip_points", {
      _limit: data.limit,
      _platform_slug: data.platformSlug ?? null,
    });
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Array<{
      ip: string;
      hosts: number;
      takeover_count: number;
      sample_host: string;
      sample_domain: string | null;
      platform_name: string | null;
      platform_color: string | null;
    }>;

    const geos = await geolocate(list.map((r) => r.ip));
    const points: MapPoint[] = [];
    for (const r of list) {
      const g = geos.get(r.ip);
      if (!g) continue;
      points.push({
        ip: r.ip,
        hosts: Number(r.hosts),
        takeover: Number(r.takeover_count),
        host: r.sample_host,
        domain: r.sample_domain,
        platform: r.platform_name,
        color: r.platform_color,
        lat: g.lat,
        lon: g.lon,
        country: g.country,
        city: g.city,
        org: g.org,
      });
    }

    const countries = new Map<string, number>();
    for (const p of points) {
      if (p.country) countries.set(p.country, (countries.get(p.country) ?? 0) + p.hosts);
    }

    return {
      points,
      totalIps: list.length,
      mapped: points.length,
      countries: [...countries.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    };
  });
