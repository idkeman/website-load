create table if not exists public.admin_chat_reads (
  admin_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_message_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (admin_id, user_id)
);

alter table public.admin_chat_reads enable row level security;
revoke all on table public.admin_chat_reads from anon, authenticated;

create or replace function public.admin_get_unread_counts()
returns table(user_id uuid, unread_count bigint)
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  admin_user uuid := auth.uid();
begin
  if admin_user is null or not private.is_admin() then
    raise exception 'admin access required';
  end if;

  return query
  select m.user_id, count(*)::bigint
  from public.admin_messages m
  left join public.admin_chat_reads r
    on r.admin_id = admin_user and r.user_id = m.user_id
  where m.sender_id = m.user_id
    and m.id > coalesce(r.last_read_message_id, 0)
  group by m.user_id;
end;
$$;

create or replace function public.admin_mark_chat_read(p_user_id uuid, p_through_message_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  admin_user uuid := auth.uid();
  read_through bigint;
begin
  if admin_user is null or not private.is_admin() then
    raise exception 'admin access required';
  end if;
  if p_user_id is null or p_through_message_id is null then
    raise exception 'user and message ID are required';
  end if;

  select coalesce(max(m.id), 0) into read_through
  from public.admin_messages m
  where m.user_id = p_user_id
    and m.sender_id = p_user_id
    and m.id <= p_through_message_id;

  insert into public.admin_chat_reads(admin_id, user_id, last_read_message_id, updated_at)
  values (admin_user, p_user_id, read_through, now())
  on conflict (admin_id, user_id) do update
    set last_read_message_id = greatest(public.admin_chat_reads.last_read_message_id, excluded.last_read_message_id),
        updated_at = now();

  return read_through;
end;
$$;

revoke all on function public.admin_get_unread_counts() from public, anon;
revoke all on function public.admin_mark_chat_read(uuid, bigint) from public, anon;
grant execute on function public.admin_get_unread_counts() to authenticated;
grant execute on function public.admin_mark_chat_read(uuid, bigint) to authenticated;
