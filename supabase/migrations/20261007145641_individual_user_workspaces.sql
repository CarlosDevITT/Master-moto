-- User-owned application snapshots; credentials stay exclusively in Supabase Auth.
create table public.mm_user_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint workspace_format check (
    coalesce(jsonb_typeof(payload) = 'object' and payload->>'schemaVersion' = '1'
    and jsonb_typeof(payload->'values') = 'object'
    and octet_length(payload::text) <= 10485760, false)
  )
);
alter table public.mm_user_workspaces enable row level security;
revoke all on public.mm_user_workspaces from public, anon, authenticated;
grant select, insert, update on public.mm_user_workspaces to authenticated;
create policy workspace_read_own on public.mm_user_workspaces for select to authenticated
  using ((select auth.uid()) = user_id);
create policy workspace_insert_own on public.mm_user_workspaces for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy workspace_update_own on public.mm_user_workspaces for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Compare-and-swap: stale devices cannot silently replace newer cloud data.
create function public.mm_save_workspace(p_payload jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.mm_user_workspaces%rowtype;
begin
  if v_user is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'invalid_revision'; end if;
  if p_expected_revision = 0 then
    insert into public.mm_user_workspaces(user_id, payload) values(v_user, p_payload)
      on conflict (user_id) do nothing returning * into v_row;
  else
    update public.mm_user_workspaces set payload = p_payload, revision = revision + 1, updated_at = now()
      where user_id = v_user and revision = p_expected_revision returning * into v_row;
  end if;
  if not found then raise exception 'workspace_conflict' using errcode = 'P0001'; end if;
  return jsonb_build_object('revision', v_row.revision, 'updated_at', v_row.updated_at);
end;
$$;
revoke all on function public.mm_save_workspace(jsonb, bigint) from public, anon;
grant execute on function public.mm_save_workspace(jsonb, bigint) to authenticated;
comment on table public.mm_user_workspaces is 'Master Motos: isolated catalog, notes, star ratings, pricing and preferences for each authenticated user.';
