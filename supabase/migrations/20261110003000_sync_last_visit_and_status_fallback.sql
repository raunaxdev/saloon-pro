create or replace function public.refresh_customer_visit_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_to_refresh uuid;
begin
  if tg_op = 'DELETE' then
    customer_to_refresh := old.customer_id;
  else
    customer_to_refresh := new.customer_id;
  end if;

  if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id then
    update public.customers as customer
    set
      total_visits = (
        select count(*)::integer
        from public.visits as visit
        where visit.customer_id = old.customer_id
          and visit.status = 'Completed'
      ),
      total_spent = coalesce((
        select sum(visit.total_amount)
        from public.visits as visit
        where visit.customer_id = old.customer_id
          and visit.status = 'Completed'
      ), 0),
      last_visit = (
        select max(visit.created_at)
        from public.visits as visit
        where visit.customer_id = old.customer_id
          and visit.status = 'Completed'
      )
    where customer.id = old.customer_id;
  end if;

  update public.customers as customer
  set
    total_visits = (
      select count(*)::integer
      from public.visits as visit
      where visit.customer_id = customer_to_refresh
        and visit.status = 'Completed'
    ),
    total_spent = coalesce((
      select sum(visit.total_amount)
      from public.visits as visit
      where visit.customer_id = customer_to_refresh
        and visit.status = 'Completed'
    ), 0),
    last_visit = (
      select max(visit.created_at)
      from public.visits as visit
      where visit.customer_id = customer_to_refresh
        and visit.status = 'Completed'
    )
  where customer.id = customer_to_refresh;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

update public.customers as customer
set last_visit = (
  select max(visit.created_at)
  from public.visits as visit
  where visit.customer_id = customer.id
    and visit.status = 'Completed'
);

create or replace function public.enforce_visit_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (old.status = 'Waiting' and new.status not in ('Waiting', 'In-Progress'))
    or (old.status = 'In-Progress' and new.status not in ('In-Progress', 'Completed'))
    or (old.status = 'Completed' and new.status <> 'Completed') then
    raise exception 'Visit status transition is not allowed.' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_visit_status_transition on public.visits;
create trigger enforce_visit_status_transition
before update of status on public.visits
for each row
execute function public.enforce_visit_status_transition();

grant update (status) on public.visits to authenticated;
create policy visits_member_status_update on public.visits
  for update to authenticated
  using (public.is_saloon_member(saloon_id))
  with check (public.is_saloon_member(saloon_id));
