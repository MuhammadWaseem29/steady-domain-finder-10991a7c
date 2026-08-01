create or replace function public.count_new_subs(since timestamptz)
returns bigint
language sql
stable
set search_path = public
as $$
  select count(*)::bigint from public.subdomains where first_seen_at >= since
$$;

create or replace function public.new_subs_page(
  since timestamptz,
  before_ts timestamptz default null,
  before_id uuid default null,
  lim integer default 500
)
returns table(id uuid, host text, domain text, first_seen_at timestamptz)
language sql
stable
set search_path = public
as $$
  select s.id, s.host, d.domain, s.first_seen_at
  from public.subdomains s
  join public.domains d on d.id = s.domain_id
  where s.first_seen_at >= since
    and (
      before_ts is null
      or s.first_seen_at < before_ts
      or (s.first_seen_at = before_ts and before_id is not null and s.id < before_id)
    )
  order by s.first_seen_at desc, s.id desc
  limit greatest(least(coalesce(lim, 500), 2000), 1)
$$;

create or replace function public.new_subs_hour_heatmap(since timestamptz)
returns table(dow integer, hour integer, c bigint)
language sql
stable
set search_path = public
as $$
  select extract(dow from first_seen_at)::integer,
         extract(hour from first_seen_at)::integer,
         count(*)::bigint
  from public.subdomains
  where first_seen_at >= since
  group by 1, 2
$$;

create or replace function public.new_subs_label_breakdown(since timestamptz, lim integer default 15)
returns table(prefix text, c bigint)
language sql
stable
set search_path = public
as $$
  select split_part(s.host, '.', 1) as prefix, count(*)::bigint
  from public.subdomains s
  where s.first_seen_at >= since
  group by 1
  order by 2 desc
  limit greatest(least(coalesce(lim, 15), 60), 1)
$$;

grant execute on function public.count_new_subs(timestamptz) to anon, authenticated;
grant execute on function public.new_subs_page(timestamptz, timestamptz, uuid, integer) to anon, authenticated;
grant execute on function public.new_subs_hour_heatmap(timestamptz) to anon, authenticated;
grant execute on function public.new_subs_label_breakdown(timestamptz, integer) to anon, authenticated;