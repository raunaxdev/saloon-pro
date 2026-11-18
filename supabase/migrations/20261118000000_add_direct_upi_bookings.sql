alter table public.saloons
  add column if not exists upi_id text,
  add column if not exists upi_payee_name text;

alter table public.visits
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('upi', 'pay_at_salon')),
  add column if not exists payment_status text
    check (payment_status is null or payment_status in ('unpaid', 'verification_pending', 'paid')),
  add column if not exists utr_number text
    check (utr_number is null or utr_number ~ '^[0-9]{12}$'),
  add column if not exists amount_paid numeric not null default 0
    check (amount_paid >= 0);

create policy saloons_public_upi_select on public.saloons
  for select to anon
  using (upi_id is not null and length(trim(upi_id)) > 0);

grant select (id, upi_id, upi_payee_name) on public.saloons to anon;
grant select on public.services to anon;
create policy services_public_menu_select on public.services
  for select to anon
  using (true);

create or replace function public.create_public_booking(
  p_saloon_id uuid,
  p_customer_name text,
  p_phone text,
  p_service_ids uuid[],
  p_expected_total numeric,
  p_payment_method text,
  p_utr_number text,
  p_booking_date date,
  p_time_slot text
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
  if length(trim(coalesce(p_customer_name, ''))) not between 1 and 120
    or p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a customer name and valid 10-digit Indian mobile number.' using errcode = '22023';
  end if;
  if p_booking_date is null or p_booking_date < current_date
    or p_time_slot is null or p_time_slot not in (
      '9:30 AM', '10:30 AM', '11:30 AM', '12:30 PM', '1:30 PM', '2:30 PM',
      '3:30 PM', '4:30 PM', '5:30 PM', '6:30 PM', '7:30 PM', '8:30 PM'
    ) then
    raise exception 'Choose a valid future booking date and time.' using errcode = '22023';
  end if;
  if p_payment_method is null or p_payment_method not in ('upi', 'pay_at_salon') then
    raise exception 'Choose a valid payment method.' using errcode = '22023';
  end if;
  if p_payment_method = 'upi' then
    if p_utr_number is null or p_utr_number !~ '^[0-9]{12}$' then
      raise exception 'UPI bookings require a 12-digit UTR number.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.saloons as saloon
      where saloon.id = p_saloon_id
        and saloon.upi_id is not null
        and length(trim(saloon.upi_id)) > 0
    ) then
      raise exception 'Direct UPI payments are not configured for this saloon.' using errcode = '22023';
    end if;
  elsif p_utr_number is not null then
    raise exception 'A UTR number is only accepted for UPI payments.' using errcode = '22023';
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
  if p_expected_total is null or calculated_total <> p_expected_total then
    raise exception 'Service prices have changed. Refresh the menu and review your total.' using errcode = '22023';
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
    sanitation_verified,
    notes,
    payment_method,
    payment_status,
    utr_number,
    amount_paid
  )
  values (
    p_saloon_id,
    customer_id,
    service_snapshot,
    calculated_total,
    case when p_payment_method = 'upi' then 'UPI' else 'Cash' end,
    'Waiting',
    null,
    false,
    'Online booking requested for ' || p_booking_date::text || ' at ' || p_time_slot,
    p_payment_method,
    case when p_payment_method = 'upi' then 'verification_pending' else 'unpaid' end,
    p_utr_number,
    case when p_payment_method = 'upi' then calculated_total else 0 end
  )
  returning visits.id, visits.created_at into visit_id, visit_created_at;

  return query select visit_id, calculated_total, service_snapshot, visit_created_at;
end;
$$;

create or replace function public.verify_visit_payment(
  p_saloon_id uuid,
  p_visit_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_saloon_member(p_saloon_id, array['owner', 'admin']) then
    raise exception 'Not authorized to verify payments for this saloon.' using errcode = '42501';
  end if;

  update public.visits as visit
  set payment_status = 'paid'
  where visit.id = p_visit_id
    and visit.saloon_id = p_saloon_id
    and visit.payment_method = 'upi'
    and visit.payment_status = 'verification_pending';

  if not found then
    raise exception 'No verification-pending UPI payment was found for this visit.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.create_public_booking(uuid, text, text, uuid[], numeric, text, text, date, text)
  from public, anon, authenticated;
grant execute on function public.create_public_booking(uuid, text, text, uuid[], numeric, text, text, date, text)
  to anon, authenticated;
revoke all on function public.verify_visit_payment(uuid, uuid) from public, anon;
grant execute on function public.verify_visit_payment(uuid, uuid) to authenticated;
