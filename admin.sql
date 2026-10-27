-- ============ Кабинет администратора ============
-- 1. Профили: имя, email, роль (student/admin), последняя активность
create table if not exists profiles(id uuid primary key references auth.users on delete cascade);
alter table profiles add column if not exists email text;
alter table profiles add column if not exists name text default '';
alter table profiles add column if not exists grp text default '';
alter table profiles add column if not exists role text not null default 'student';
alter table profiles add column if not exists last_active_at timestamptz;
alter table profiles add column if not exists created_at timestamptz default now();
do $$ begin
  alter table profiles add constraint profiles_role_check check (role in ('student','admin'));
exception when duplicate_object then null; end $$;

-- заполняем профили для уже зарегистрированных пользователей (имя и группа берутся из регистрации)
insert into profiles(id,email,name,grp)
  select u.id,u.email,coalesce(u.raw_user_meta_data->>'full_name',''),coalesce(u.raw_user_meta_data->>'group','')
  from auth.users u
  on conflict (id) do update set email=excluded.email,
    name=case when coalesce(profiles.name,'')='' then excluded.name else profiles.name end,
    grp=case when coalesce(profiles.grp,'')='' then excluded.grp else profiles.grp end;
-- те, кто раньше был админом, остаются админами
do $$ begin
  if to_regclass('public.admins') is not null then
    update profiles set role='admin' where id in (select user_id from admins);
  end if;
end $$;

-- профиль создаётся автоматически при регистрации
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into profiles(id,email,name,grp)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'group',''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- 2. Проверка роли теперь берётся из profiles (политики для тестов и вопросов подхватят её сами)
create or replace function is_admin() returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from profiles where id=auth.uid() and role='admin')
$$;

-- 3. Защита: роль может менять только админ
create or replace function protect_role() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not is_admin() then
    raise exception 'Роль может менять только администратор';
  end if;
  return new;
end $$;
drop trigger if exists protect_role_trg on profiles;
create trigger protect_role_trg before update on profiles for each row execute function protect_role();

alter table profiles enable row level security;
drop policy if exists "profiles read" on profiles;
drop policy if exists "profiles update own" on profiles;
drop policy if exists "profiles admin update" on profiles;
drop policy if exists "profiles insert own" on profiles;
create policy "profiles read" on profiles for select using (id=auth.uid() or is_admin());
create policy "profiles update own" on profiles for update using (id=auth.uid()) with check (id=auth.uid());
create policy "profiles admin update" on profiles for update using (is_admin()) with check (is_admin());
create policy "profiles insert own" on profiles for insert with check (id=auth.uid() and role='student');

-- 4. Админ может читать и менять попытки и историю ошибок любого студента
drop policy if exists "admin all attempts" on attempts;
drop policy if exists "admin all mistakes" on mistakes;
create policy "admin all attempts" on attempts for all using (is_admin()) with check (is_admin());
create policy "admin all mistakes" on mistakes for all using (is_admin()) with check (is_admin());

-- 5. Кто сейчас проходит тест (приложение обновляет строку при каждом вопросе)
create table if not exists live_sessions(
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  test_title text, mode text, q_index int, q_total int,
  updated_at timestamptz not null default now());
alter table live_sessions enable row level security;
drop policy if exists "own live" on live_sessions;
drop policy if exists "admin read live" on live_sessions;
create policy "own live" on live_sessions for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "admin read live" on live_sessions for select using (is_admin());
do $$ begin
  alter publication supabase_realtime add table live_sessions;
exception when others then null; end $$;

-- 6. Рейтинг считает сама база (не клиент). Функция работает только для админа.
create or replace function admin_rating() returns table(
  uid uuid, full_name text, mail text, user_role text,
  avg_percent numeric, avg_seconds numeric, attempts_total bigint, tests_unique bigint, last_active timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'Только для администратора'; end if;
  return query
    select p.id, p.name, p.email, p.role,
           coalesce(round(avg(a.percent)::numeric,1),0),
           coalesce(round(avg(a.seconds)::numeric),0),
           count(a.id), count(distinct a.test_id),
           greatest(p.last_active_at, max(a.created_at))
    from profiles p left join attempts a on a.user_id=p.id
    group by p.id;
end $$;
