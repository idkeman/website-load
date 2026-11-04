create or replace function public.admin_mark_chat_read(p_user_id uuid, p_through_message_id bigint default null)
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
  if p_user_id is null then
    raise exception 'user is required';
  end if;

  -- NULL means the admin opened the conversation: mark every message that
  -- exists at this moment as read, even if older history is not in the UI batch.
  select coalesce(max(m.id), 0) into read_through
  from public.admin_messages m
  where m.user_id = p_user_id
    and m.sender_id = p_user_id
    and (p_through_message_id is null or m.id <= p_through_message_id);

  insert into public.admin_chat_reads(admin_id, user_id, last_read_message_id, updated_at)
  values (admin_user, p_user_id, read_through, now())
  on conflict (admin_id, user_id) do update
    set last_read_message_id = greatest(public.admin_chat_reads.last_read_message_id, excluded.last_read_message_id),
        updated_at = now();

  return read_through;
end;
$$;

revoke all on function public.admin_mark_chat_read(uuid, bigint) from public, anon;
grant execute on function public.admin_mark_chat_read(uuid, bigint) to authenticated;
