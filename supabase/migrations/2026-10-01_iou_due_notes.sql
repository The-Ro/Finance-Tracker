-- Lent & borrowed pay-back dates now land in the bell (and so on phones) on
-- the day, like money reminders: the daily run's file_money_reminder_notifications
-- also files one note per open record due today. (The daily digest still
-- mentions overdue ones for people with reminders on.)
create or replace function public.file_money_reminder_notifications(p_today date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_ious integer;
begin
  insert into public.notifications (owner_user_id, kind, title, body, url, ref)
  select r.owner_user_id, 'money_reminder',
         'Time to send ' || coalesce(public.push_money(r.amount, coalesce(us.currency, 'INR')), 'money') || ': ' || btrim(r.title),
         r.note, '/bills', 'send:' || r.id || ':' || r.due_date
    from public.money_reminders r
    left join public.user_settings us on us.owner_user_id = r.owner_user_id
   where r.done_at is null and r.due_date = p_today
  on conflict (owner_user_id, ref) do nothing;
  get diagnostics v_count = row_count;

  insert into public.notifications (owner_user_id, kind, title, body, url, ref)
  select i.owner_user_id, 'money_reminder',
         case when i.direction = 'lent'
              then btrim(i.person) || ' should pay you back ' || public.push_money(i.left_amount, coalesce(us.currency, 'INR')) || ' today'
              else 'Pay back ' || btrim(i.person) || ' ' || public.push_money(i.left_amount, coalesce(us.currency, 'INR')) || ' today' end,
         i.note, '/lent', 'iou:' || i.id || ':' || i.due_date
    from (
      select x.*, x.amount - coalesce((select sum(p.amount) from public.iou_payments p where p.iou_id = x.id), 0) as left_amount
        from public.ious x
       where x.due_date = p_today
    ) i
    left join public.user_settings us on us.owner_user_id = i.owner_user_id
   where i.left_amount > 0
  on conflict (owner_user_id, ref) do nothing;
  get diagnostics v_ious = row_count;
  return v_count + v_ious;
end;
$$;
revoke execute on function public.file_money_reminder_notifications(date) from public, anon, authenticated;
grant execute on function public.file_money_reminder_notifications(date) to service_role;
