create table if not exists public.saloon_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  saloon_id uuid not null references public.saloons (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (user_id, saloon_id)
);

do $$
begin
  if exists (
    select 1
    from public.customers
    group by saloon_id, phone
    having count(*) > 1
  ) then
    raise exception 'Duplicate customer phone numbers exist within a saloon. Resolve duplicates before applying this migration.';
  end if;
end;
$$;

create unique index if not exists customers_saloon_phone_key
  on public.customers (saloon_id, phone);
create unique index if not exists customers_id_saloon_key
  on public.customers (id, saloon_id);
create index if not exists visits_saloon_created_at_key
  on public.visits (saloon_id, created_at desc);
create index if not exists visits_customer_status_key
  on public.visits (customer_id, status);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'visits_customer_saloon_fkey'
      and conrelid = 'public.visits'::regclass
  ) then
    alter table public.visits
      add constraint visits_customer_saloon_fkey
      foreign key (customer_id, saloon_id)
      references public.customers (id, saloon_id)
      on delete restrict;
  end if;
end;
$$;

create or replace function public.is_saloon_member(p_saloon_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.saloon_members as membership
    where membership.user_id = (select auth.uid())
      and membership.saloon_id = p_saloon_id
      and (p_roles is null or membership.role = any (p_roles))
  );
$$;

revoke all on function public.is_saloon_member(uuid, text[]) from public, anon;
grant execute on function public.is_saloon_member(uuid, text[]) to authenticated;

create table if not exists public.ai_analytics_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0)
);
alter table public.ai_analytics_rate_limits enable row level security;
revoke all on public.ai_analytics_rate_limits from public, anon, authenticated;

create or replace function public.claim_ai_analytics_rate_limit()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_window timestamptz := date_trunc('minute', now());
  new_count integer;
begin
  if current_user_id is null then
    return false;
  end if;

  insert into public.ai_analytics_rate_limits (user_id, window_start, request_count)
  values (current_user_id, current_window, 1)
  on conflict (user_id) do update
  set
    window_start = case
      when public.ai_analytics_rate_limits.window_start < excluded.window_start then excluded.window_start
      else public.ai_analytics_rate_limits.window_start
    end,
    request_count = case
      when public.ai_analytics_rate_limits.window_start < excluded.window_start then 1
      else public.ai_analytics_rate_limits.request_count + 1
    end
  returning request_count into new_count;

  return new_count <= 10;
end;
$$;

revoke all on function public.claim_ai_analytics_rate_limit() from public, anon;
grant execute on function public.claim_ai_analytics_rate_limit() to authenticated;

create or replace function public.create_visit(
  p_saloon_id uuid,
  p_customer_name text,
  p_phone text,
  p_service_ids uuid[],
  p_payment_mode text,
  p_stylist_name text,
  p_status text,
  p_sanitation_verified boolean
)
returns table (
  id uuid,
  total_amount numeric,
  services_done jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_id uuid;
  visit_id uuid;
  visit_created_at timestamptz;
  service_snapshot jsonb;
  calculated_total numeric;
  service_count integer;
begin
  if not public.is_saloon_member(p_saloon_id, array['owner', 'admin', 'staff']) then
    raise exception 'Not authorized for this saloon.' using errcode = '42501';
  end if;
  if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Phone number must be a valid 10-digit Indian mobile number.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_customer_name, ''))) not between 1 and 120 then
    raise exception 'Customer name must be between 1 and 120 characters.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_stylist_name, ''))) not between 1 and 120 then
    raise exception 'Stylist name must be between 1 and 120 characters.' using errcode = '22023';
  end if;
  if p_payment_mode is null or p_payment_mode not in ('Cash', 'UPI', 'Card')
    or p_status is null or p_status not in ('Waiting', 'Completed')
    or p_sanitation_verified is distinct from true then
    raise exception 'Invalid payment, visit status, or sanitation verification.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_service_ids), 0) not between 1 and 20
    or (select count(distinct requested.service_id) from unnest(p_service_ids) as requested(service_id)) <> cardinality(p_service_ids) then
    raise exception 'Select between 1 and 20 distinct services.' using errcode = '22023';
  end if;

  select count(*)::integer, coalesce(sum(service.price), 0)
  into service_count, calculated_total
  from unnest(p_service_ids) as requested(service_id)
  join public.services as service
    on service.id = requested.service_id
   and service.saloon_id = p_saloon_id
  where service.price >= 0;
  if service_count <> cardinality(p_service_ids) then
    raise exception 'One or more selected services are invalid for this saloon.' using errcode = '22023';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id', service.id,
      'service_name', service.service_name,
      'price', service.price,
      'category', service.category
    ) order by requested.ordinality
  )
  into service_snapshot
  from unnest(p_service_ids) with ordinality as requested(service_id, ordinality)
  join public.services as service
    on service.id = requested.service_id
   and service.saloon_id = p_saloon_id;

  perform pg_advisory_xact_lock(hashtextextended(p_saloon_id::text || ':' || p_phone, 0));
  select customer.id into customer_id
  from public.customers as customer
  where customer.saloon_id = p_saloon_id
    and customer.phone = p_phone
  limit 1
  for update;

  if customer_id is null then
    insert into public.customers (saloon_id, name, phone, total_visits, total_spent, last_visit)
    values (p_saloon_id, trim(p_customer_name), p_phone, 0, 0, null)
    returning customers.id into customer_id;
  end if;

  insert into public.visits (
    saloon_id,
    customer_id,
    services_done,
    total_amount,
    payment_mode,
    status,
    stylist_name,
    sanitation_verified
  )
  values (
    p_saloon_id,
    customer_id,
    service_snapshot,
    calculated_total,
    p_payment_mode,
    p_status,
    trim(p_stylist_name),
    p_sanitation_verified
  )
  returning visits.id, visits.created_at into visit_id, visit_created_at;

  return query select visit_id, calculated_total, service_snapshot, visit_created_at;
end;
$$;

create or replace function public.update_visit_status(
  p_saloon_id uuid,
  p_visit_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  if not public.is_saloon_member(p_saloon_id, array['owner', 'admin', 'staff']) then
    raise exception 'Not authorized for this saloon.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('Waiting', 'In-Progress', 'Completed') then
    raise exception 'Invalid visit status.' using errcode = '22023';
  end if;

  select visit.status into current_status
  from public.visits as visit
  where visit.id = p_visit_id
    and visit.saloon_id = p_saloon_id
  for update;
  if not found then
    raise exception 'Visit not found for this saloon.' using errcode = 'P0002';
  end if;
  if (current_status = 'Waiting' and p_status <> 'In-Progress')
    or (current_status = 'In-Progress' and p_status <> 'Completed')
    or (current_status = 'Completed' and p_status <> 'Completed') then
    raise exception 'Visit status transition is not allowed.' using errcode = '22023';
  end if;

  update public.visits as visit
  set status = p_status
  where visit.id = p_visit_id
    and visit.saloon_id = p_saloon_id;
end;
$$;

revoke all on function public.create_visit(uuid, text, text, uuid[], text, text, text, boolean) from public, anon;
grant execute on function public.create_visit(uuid, text, text, uuid[], text, text, text, boolean) to authenticated;
revoke all on function public.update_visit_status(uuid, uuid, text) from public, anon;
grant execute on function public.update_visit_status(uuid, uuid, text) to authenticated;

do $$
declare
  target_table text;
  target_policy text;
begin
  foreach target_table in array array['saloons', 'saloon_members', 'services', 'customers', 'visits']
  loop
    for target_policy in
      select policies.policyname
      from pg_policies as policies
      where policies.schemaname = 'public' and policies.tablename = target_table
    loop
      execute format('drop policy %I on public.%I', target_policy, target_table);
    end loop;
  end loop;
end;
$$;

alter table public.saloons enable row level security;
alter table public.saloon_members enable row level security;
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.visits enable row level security;

revoke all on public.saloons, public.saloon_members, public.services, public.customers, public.visits
  from anon, authenticated;
grant select on public.saloons, public.saloon_members, public.services, public.customers, public.visits
  to authenticated;
grant update on public.saloons to authenticated;
grant insert, update, delete on public.services to authenticated;

create policy saloons_member_select on public.saloons
  for select to authenticated
  using (public.is_saloon_member(id, array['owner', 'admin']));
create policy saloons_admin_update on public.saloons
  for update to authenticated
  using (public.is_saloon_member(id, array['owner', 'admin']))
  with check (public.is_saloon_member(id, array['owner', 'admin']));

create policy saloon_members_self_or_admin_select on public.saloon_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_saloon_member(saloon_id, array['owner', 'admin'])
  );

create policy services_member_select on public.services
  for select to authenticated
  using (public.is_saloon_member(saloon_id));
create policy services_admin_insert on public.services
  for insert to authenticated
  with check (public.is_saloon_member(saloon_id, array['owner', 'admin']));
create policy services_admin_update on public.services
  for update to authenticated
  using (public.is_saloon_member(saloon_id, array['owner', 'admin']))
  with check (public.is_saloon_member(saloon_id, array['owner', 'admin']));
create policy services_admin_delete on public.services
  for delete to authenticated
  using (public.is_saloon_member(saloon_id, array['owner', 'admin']));

create policy customers_member_select on public.customers
  for select to authenticated
  using (public.is_saloon_member(saloon_id));
create policy visits_member_select on public.visits
  for select to authenticated
  using (public.is_saloon_member(saloon_id));
