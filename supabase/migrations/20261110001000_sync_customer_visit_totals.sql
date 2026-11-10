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
      ), 0)
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
    ), 0)
  where customer.id = customer_to_refresh;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_customer_visit_totals on public.visits;
create trigger refresh_customer_visit_totals
after insert or update of customer_id, total_amount, status or delete
on public.visits
for each row
execute function public.refresh_customer_visit_totals();

update public.customers as customer
set
  total_visits = coalesce(visit_totals.completed_visits, 0),
  total_spent = coalesce(visit_totals.completed_spend, 0)
from (
  select
    visits.customer_id,
    count(*)::integer as completed_visits,
    sum(visits.total_amount) as completed_spend
  from public.visits
  where visits.status = 'Completed'
  group by visits.customer_id
) as visit_totals
where customer.id = visit_totals.customer_id;

update public.customers as customer
set total_visits = 0, total_spent = 0
where not exists (
  select 1
  from public.visits
  where visits.customer_id = customer.id
    and visits.status = 'Completed'
);
