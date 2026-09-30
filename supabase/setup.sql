-- =====================================================
-- EXTENSIONES
-- =====================================================

create extension if not exists "pgcrypto";


-- =====================================================
-- TABLA PROFILES
-- =====================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  employee_number text unique,
  avatar_url text,
  role text not null default 'user',
  created_at timestamptz not null default now()
);


-- =====================================================
-- TABLA ATTENDANCE
-- =====================================================

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('entrada', 'salida')),
  status text not null default 'validated',
  device_id text,
  created_at timestamptz not null default now()
);


-- =====================================================
-- TABLA ANNOUNCEMENTS
-- =====================================================

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);


-- =====================================================
-- TABLA DISPLAY DEVICES
-- =====================================================

create table if not exists public.display_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  device_key text unique,
  active boolean not null default true,
  last_connection timestamptz,
  created_at timestamptz not null default now()
);


-- =====================================================
-- CREAR PERFIL AUTOMATICAMENTE
-- =====================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    name
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.email
    )
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();


-- =====================================================
-- FUNCION: ES DISPLAY
-- =====================================================

create or replace function public.is_display_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'display'
  );
$$;

revoke all
on function public.is_display_user()
from public;

grant execute
on function public.is_display_user()
to authenticated;


-- =====================================================
-- FUNCION: ES ADMIN
-- =====================================================

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all
on function public.is_admin_user()
from public;

grant execute
on function public.is_admin_user()
to authenticated;


-- =====================================================
-- RPC REGISTRAR ASISTENCIA
-- =====================================================

create or replace function public.register_attendance(
  p_type text,
  p_device_id text default 'mobile'
)
returns public.attendance
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
  v_last_type text;
  v_result public.attendance;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'No existe una sesión autenticada';
  end if;

  if p_type not in ('entrada', 'salida') then
    raise exception 'Tipo de asistencia inválido';
  end if;

  select role
  into v_role
  from public.profiles
  where id = v_user_id;

  if v_role is null then
    raise exception 'Perfil de usuario no encontrado';
  end if;

  if v_role not in ('user', 'admin') then
    raise exception 'Este usuario no puede registrar asistencia';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text, 0)
  );

  select type
  into v_last_type
  from public.attendance
  where user_id = v_user_id
  order by created_at desc
  limit 1;

  if v_last_type is null and p_type <> 'entrada' then
    raise exception 'Primero debes registrar una entrada';
  end if;

  if v_last_type = 'entrada' and p_type = 'entrada' then
    raise exception 'Ya existe una entrada. Debes registrar una salida';
  end if;

  if v_last_type = 'salida' and p_type = 'salida' then
    raise exception 'Ya existe una salida. Debes registrar una entrada';
  end if;

  insert into public.attendance (
    user_id,
    type,
    status,
    device_id
  )
  values (
    v_user_id,
    p_type,
    'validated',
    p_device_id
  )
  returning *
  into v_result;

  return v_result;
end;
$$;

revoke all
on function public.register_attendance(text, text)
from public;

grant execute
on function public.register_attendance(text, text)
to authenticated;


-- =====================================================
-- EVITAR AUTO-CAMBIO DE ROL
-- =====================================================

create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if
    old.id = auth.uid()
    and old.role <> new.role
  then
    raise exception 'No puedes modificar tu propio rol';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_self_role_change_trigger
on public.profiles;

create trigger prevent_self_role_change_trigger
before update on public.profiles
for each row
execute function public.prevent_self_role_change();


-- =====================================================
-- ACTIVAR RLS
-- =====================================================

alter table public.profiles
enable row level security;

alter table public.attendance
enable row level security;

alter table public.announcements
enable row level security;

alter table public.display_devices
enable row level security;


-- =====================================================
-- POLICIES PROFILES
-- =====================================================

drop policy if exists "Users can view their profile"
on public.profiles;

create policy "Users can view their profile"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
);


drop policy if exists "Display can view profiles"
on public.profiles;

create policy "Display can view profiles"
on public.profiles
for select
to authenticated
using (
  public.is_display_user()
);


drop policy if exists "Admin can view profiles"
on public.profiles;

create policy "Admin can view profiles"
on public.profiles
for select
to authenticated
using (
  public.is_admin_user()
);


drop policy if exists "Admin can update profiles"
on public.profiles;

create policy "Admin can update profiles"
on public.profiles
for update
to authenticated
using (
  public.is_admin_user()
)
with check (
  public.is_admin_user()
);


-- =====================================================
-- POLICIES ATTENDANCE
-- =====================================================

drop policy if exists "Users can view their attendance"
on public.attendance;

create policy "Users can view their attendance"
on public.attendance
for select
to authenticated
using (
  auth.uid() = user_id
);


drop policy if exists "Display can view attendance"
on public.attendance;

create policy "Display can view attendance"
on public.attendance
for select
to authenticated
using (
  public.is_display_user()
);


drop policy if exists "Admin can view attendance"
on public.attendance;

create policy "Admin can view attendance"
on public.attendance
for select
to authenticated
using (
  public.is_admin_user()
);


-- =====================================================
-- POLICIES ANNOUNCEMENTS
-- =====================================================

drop policy if exists "Display can view announcements"
on public.announcements;

create policy "Display can view announcements"
on public.announcements
for select
to authenticated
using (
  public.is_display_user()
);


drop policy if exists "Admin can view announcements"
on public.announcements;

create policy "Admin can view announcements"
on public.announcements
for select
to authenticated
using (
  public.is_admin_user()
);


drop policy if exists "Admin can create announcements"
on public.announcements;

create policy "Admin can create announcements"
on public.announcements
for insert
to authenticated
with check (
  public.is_admin_user()
);


drop policy if exists "Admin can update announcements"
on public.announcements;

create policy "Admin can update announcements"
on public.announcements
for update
to authenticated
using (
  public.is_admin_user()
)
with check (
  public.is_admin_user()
);


drop policy if exists "Admin can delete announcements"
on public.announcements;

create policy "Admin can delete announcements"
on public.announcements
for delete
to authenticated
using (
  public.is_admin_user()
);


-- =====================================================
-- REALTIME
-- =====================================================

do $$
begin
  begin
    alter publication supabase_realtime
    add table public.attendance;
  exception
    when duplicate_object then
      null;
  end;

  begin
    alter publication supabase_realtime
    add table public.announcements;
  exception
    when duplicate_object then
      null;
  end;
end
$$;