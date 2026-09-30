-- 1.14.0: money reminders, blurred private rows for viewers, and a "Today" period.

-- ===== "Today" in the period filter =====
alter table public.user_settings drop constraint user_settings_selected_period_check;
alter table public.user_settings add constraint user_settings_selected_period_check check (
  selected_period in ('all-time', 'today', 'this-month', 'last-month', 'last-3-months', 'last-6-months', 'this-year')
);

-- ===== Money reminders: "send ₹500 to Mom on the 5th" =====
-- Own-only (not shared with viewers), like budgets. A note lands in the bell
-- (and so on phones) on the due day, filed by the daily 9 AM run.
create table if not exists public.money_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  amount numeric(14, 2) check (amount is null or amount > 0),
  due_date date not null,
  note text check (note is null or char_length(note) <= 200),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists money_reminders_owner_due_idx on public.money_reminders (owner_user_id, due_date);

alter table public.money_reminders enable row level security;
drop policy if exists money_reminders_own on public.money_reminders;
create policy money_reminders_own on public.money_reminders for all to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
revoke all on public.money_reminders from anon, authenticated;
grant select, insert, update, delete on public.money_reminders to authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind = any (array[
  'access_request', 'access_approved', 'access_declined', 'feedback_reply', 'split_added', 'split_settled',
  'budget', 'bill_overdue', 'reminder', 'salary', 'birthday', 'announcement', 'money_reminder'
]));

-- Called by send-reminders' daily run. One note per reminder, on its due day.
create or replace function public.file_money_reminder_notifications(p_today date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
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
  return v_count;
end;
$$;
revoke execute on function public.file_money_reminder_notifications(date) from public, anon, authenticated;
grant execute on function public.file_money_reminder_notifications(date) to service_role;

-- ===== Private entries show as blurred rows to the people who share with you =====
-- An entry its owner kept to themselves (transactions.shared = false) stays
-- unreadable (RLS); this returns only that one exists: its id, owner and date
-- -- never the merchant, amount, category or account.
create or replace function public.private_entries_shared_with_me(p_from date, p_to date)
returns table (id uuid, owner_user_id uuid, date date)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.owner_user_id, t.date
    from public.transactions t
    join public.viewer_access va
      on va.owner_user_id = t.owner_user_id and va.requester_user_id = auth.uid() and va.status = 'approved'
   where not t.shared
     and (p_from is null or t.date >= p_from)
     and t.date <= p_to
   order by t.date desc
   limit 300
$$;
revoke execute on function public.private_entries_shared_with_me(date, date) from public, anon;
grant execute on function public.private_entries_shared_with_me(date, date) to authenticated;
