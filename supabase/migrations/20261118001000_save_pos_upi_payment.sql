drop function if exists public.create_visit(uuid, text, text, uuid[], text, text, text, boolean);

create function public.create_visit(
  p_saloon_id uuid,
  p_customer_name text,
  p_phone text,
  p_service_ids uuid[],
  p_payment_mode text,
  p_stylist_name text,
  p_status text,
  p_sanitation_verified boolean,
  p_utr_number text default null
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
  if p_payment_mode = 'UPI' and p_utr_number is not null and p_utr_number !~ '^[0-9]{12}$' then
    raise exception 'UPI reference must contain exactly 12 digits.' using errcode = '22023';
  end if;
  if p_payment_mode <> 'UPI' and p_utr_number is not null then
    raise exception 'A UTR number can only be recorded for UPI payments.' using errcode = '22023';
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
    sanitation_verified,
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
    p_payment_mode,
    p_status,
    trim(p_stylist_name),
    p_sanitation_verified,
    case when p_payment_mode = 'UPI' then 'upi' else null end,
    case when p_payment_mode = 'UPI' then 'paid' else null end,
    p_utr_number,
    case when p_payment_mode = 'UPI' then calculated_total else 0 end
  )
  returning visits.id, visits.created_at into visit_id, visit_created_at;

  return query select visit_id, calculated_total, service_snapshot, visit_created_at;
end;
$$;

revoke all on function public.create_visit(uuid, text, text, uuid[], text, text, text, boolean, text)
  from public, anon;
grant execute on function public.create_visit(uuid, text, text, uuid[], text, text, text, boolean, text)
  to authenticated;
