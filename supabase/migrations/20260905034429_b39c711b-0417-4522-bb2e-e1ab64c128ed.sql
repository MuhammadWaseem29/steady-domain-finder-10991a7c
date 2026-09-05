create or replace function public.platform_subdomains_page(
  _platform_id uuid,
  _after_domain uuid default null,
  _after_host text default null,
  _lim int default 1000,
  _active_only boolean default true
)
returns table(domain_id uuid, domain text, host text, is_active boolean, first_seen_at timestamptz, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.domain, s.host, s.is_active, s.first_seen_at, s.last_seen_at
  from public.domains d
  join public.subdomains s on s.domain_id = d.id
  where d.platform_id = _platform_id
    and (not _active_only or s.is_active)
    and (
      _after_domain is null
      or (d.id, s.host) > (_after_domain, coalesce(_after_host, ''))
    )
  order by d.id, s.host
  limit least(greatest(coalesce(_lim, 1000), 1), 10000)
$$;

grant execute on function public.platform_subdomains_page(uuid, uuid, text, int, boolean) to service_role, authenticated;