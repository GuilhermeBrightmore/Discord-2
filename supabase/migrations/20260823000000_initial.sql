create extension if not exists pgcrypto;

do $$ begin
  create type public.member_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.channel_kind as enum ('text', 'voice');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.presence_status as enum ('online', 'idle', 'dnd', 'offline');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{2,32}$'),
  display_name text not null check (char_length(display_name) between 1 and 64),
  avatar_url text,
  status public.presence_status not null default 'offline',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.servers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  icon_url text,
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.server_members (
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (server_id, user_id)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind public.channel_kind not null,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (server_id, name, kind)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  attachment_url text,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists messages_channel_created_idx on public.messages(channel_id, created_at desc);

create table if not exists public.invites (
  code text primary key default encode(gen_random_bytes(6), 'hex'),
  server_id uuid not null references public.servers(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  max_uses integer check (max_uses is null or max_uses > 0),
  uses integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  pair_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.direct_members (
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  attachment_url text,
  created_at timestamptz not null default now()
);
create index if not exists direct_messages_conversation_created_idx on public.direct_messages(conversation_id, created_at desc);

create or replace function public.is_server_member(target_server uuid, target_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.server_members where server_id = target_server and user_id = target_user); $$;

create or replace function public.can_manage_server(target_server uuid, target_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.server_members where server_id = target_server and user_id = target_user and role in ('owner', 'admin')); $$;

create or replace function public.is_channel_member(target_channel uuid, target_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.channels c join public.server_members m on m.server_id = c.server_id where c.id = target_channel and m.user_id = target_user); $$;

create or replace function public.is_direct_member(target_conversation uuid, target_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.direct_members where conversation_id = target_conversation and user_id = target_user); $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare base_name text;
begin
  base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1), 'user'), '[^a-zA-Z0-9_.]', '', 'g'));
  if char_length(base_name) < 2 then base_name := 'user'; end if;
  insert into public.profiles(id, username, display_name)
  values (new.id, left(base_name, 24) || '_' || substr(new.id::text, 1, 6), coalesce(new.raw_user_meta_data->>'display_name', base_name));
  return new;
end; $$;
drop trigger if exists auth_user_created on auth.users;
create trigger auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

insert into public.profiles(id, username, display_name)
select
  account.id,
  left(case when char_length(candidate.base_name) >= 2 then candidate.base_name else 'user' end, 24) || '_' || substr(account.id::text, 1, 6),
  left(coalesce(nullif(account.raw_user_meta_data->>'display_name', ''), nullif(split_part(account.email, '@', 1), ''), 'Usuario'), 64)
from auth.users account
cross join lateral (
  select lower(regexp_replace(coalesce(account.raw_user_meta_data->>'username', split_part(account.email, '@', 1), 'user'), '[^a-zA-Z0-9_.]', '', 'g')) as base_name
) candidate
where not exists (select 1 from public.profiles profile where profile.id = account.id)
on conflict (id) do nothing;

create or replace function public.create_server(server_name text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare new_server uuid;
begin
  if auth.uid() is null then raise exception 'Nao autenticado'; end if;
  insert into public.servers(name, owner_id) values (trim(server_name), auth.uid()) returning id into new_server;
  insert into public.server_members(server_id, user_id, role) values (new_server, auth.uid(), 'owner');
  insert into public.channels(server_id, name, kind, position) values
    (new_server, 'geral', 'text', 0), (new_server, 'Bate-papo', 'voice', 1);
  return new_server;
end; $$;

create or replace function public.join_server(invite_code text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare target_server uuid;
begin
  if auth.uid() is null then raise exception 'Nao autenticado'; end if;
  select server_id into target_server from public.invites where code = invite_code and (expires_at is null or expires_at > now()) and (max_uses is null or uses < max_uses) for update;
  if target_server is null then raise exception 'Convite invalido ou expirado'; end if;
  insert into public.server_members(server_id, user_id) values (target_server, auth.uid()) on conflict do nothing;
  update public.invites set uses = uses + 1 where code = invite_code;
  return target_server;
end; $$;

create or replace function public.open_direct(other_user uuid) returns uuid
language plpgsql security definer set search_path = public
as $$
declare conversation uuid; key text;
begin
  if auth.uid() is null or other_user = auth.uid() then raise exception 'Destinatario invalido'; end if;
  key := least(auth.uid()::text, other_user::text) || ':' || greatest(auth.uid()::text, other_user::text);
  insert into public.direct_conversations(pair_key) values (key) on conflict (pair_key) do update set pair_key = excluded.pair_key returning id into conversation;
  insert into public.direct_members(conversation_id, user_id) values (conversation, auth.uid()), (conversation, other_user) on conflict do nothing;
  return conversation;
end; $$;

alter table public.profiles enable row level security;
alter table public.servers enable row level security;
alter table public.server_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.invites enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_members enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "profiles_read" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "servers_read_member" on public.servers;
drop policy if exists "servers_update_manager" on public.servers;
drop policy if exists "members_read_member" on public.server_members;
drop policy if exists "members_delete_manager" on public.server_members;
drop policy if exists "channels_read_member" on public.channels;
drop policy if exists "channels_write_manager" on public.channels;
drop policy if exists "channels_update_manager" on public.channels;
drop policy if exists "channels_delete_manager" on public.channels;
drop policy if exists "messages_read_member" on public.messages;
drop policy if exists "messages_insert_self" on public.messages;
drop policy if exists "messages_update_author" on public.messages;
drop policy if exists "messages_delete_author" on public.messages;
drop policy if exists "invites_read_member" on public.invites;
drop policy if exists "invites_insert_manager" on public.invites;
drop policy if exists "invites_delete_manager" on public.invites;
drop policy if exists "direct_conversations_read" on public.direct_conversations;
drop policy if exists "direct_members_read" on public.direct_members;
drop policy if exists "direct_messages_read" on public.direct_messages;
drop policy if exists "direct_messages_insert" on public.direct_messages;
drop policy if exists "direct_messages_delete" on public.direct_messages;

create policy "profiles_read" on public.profiles for select to authenticated using (true);
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "servers_read_member" on public.servers for select to authenticated using (public.is_server_member(id));
create policy "servers_update_manager" on public.servers for update to authenticated using (public.can_manage_server(id));
create policy "members_read_member" on public.server_members for select to authenticated using (public.is_server_member(server_id));
create policy "members_delete_manager" on public.server_members for delete to authenticated using (public.can_manage_server(server_id) and role <> 'owner');
create policy "channels_read_member" on public.channels for select to authenticated using (public.is_server_member(server_id));
create policy "channels_write_manager" on public.channels for insert to authenticated with check (public.can_manage_server(server_id));
create policy "channels_update_manager" on public.channels for update to authenticated using (public.can_manage_server(server_id));
create policy "channels_delete_manager" on public.channels for delete to authenticated using (public.can_manage_server(server_id));
create policy "messages_read_member" on public.messages for select to authenticated using (public.is_channel_member(channel_id));
create policy "messages_insert_self" on public.messages for insert to authenticated with check (author_id = auth.uid() and public.is_channel_member(channel_id));
create policy "messages_update_author" on public.messages for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "messages_delete_author" on public.messages for delete to authenticated using (author_id = auth.uid());
create policy "invites_read_member" on public.invites for select to authenticated using (public.is_server_member(server_id));
create policy "invites_insert_manager" on public.invites for insert to authenticated with check (creator_id = auth.uid() and public.can_manage_server(server_id));
create policy "invites_delete_manager" on public.invites for delete to authenticated using (public.can_manage_server(server_id));
create policy "direct_conversations_read" on public.direct_conversations for select to authenticated using (public.is_direct_member(id));
create policy "direct_members_read" on public.direct_members for select to authenticated using (public.is_direct_member(conversation_id));
create policy "direct_messages_read" on public.direct_messages for select to authenticated using (public.is_direct_member(conversation_id));
create policy "direct_messages_insert" on public.direct_messages for insert to authenticated with check (author_id = auth.uid() and public.is_direct_member(conversation_id));
create policy "direct_messages_delete" on public.direct_messages for delete to authenticated using (author_id = auth.uid());

grant execute on function public.create_server(text), public.join_server(text), public.open_direct(uuid) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit) values ('avatars', 'avatars', true, 5242880), ('attachments', 'attachments', false, 26214400) on conflict do nothing;
drop policy if exists "avatar_public_read" on storage.objects;
drop policy if exists "avatar_own_write" on storage.objects;
drop policy if exists "attachment_member_read" on storage.objects;
drop policy if exists "attachment_own_write" on storage.objects;
create policy "avatar_public_read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatar_own_write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachment_member_read" on storage.objects for select to authenticated using (bucket_id = 'attachments');
create policy "attachment_own_write" on storage.objects for insert to authenticated with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

do $$
declare relation_name text;
begin
  foreach relation_name in array array['messages', 'direct_messages', 'profiles', 'server_members', 'channels'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end $$;
