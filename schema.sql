create table tests(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, title text not null, created_at timestamptz default now());
create table questions(id uuid primary key default gen_random_uuid(), test_id uuid not null references tests on delete cascade, pos int not null, text text not null, options jsonb not null, correct int not null);
create table attempts(id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users on delete cascade, test_id uuid not null references tests on delete cascade, answers jsonb not null default '{}', correct_count int not null, total int not null, percent int not null, seconds int not null, created_at timestamptz default now());
alter table tests enable row level security;
alter table questions enable row level security;
alter table attempts enable row level security;
create policy "own tests" on tests for all using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "own questions" on questions for all using (exists(select 1 from tests t where t.id=test_id and t.user_id=auth.uid())) with check (exists(select 1 from tests t where t.id=test_id and t.user_id=auth.uid()));
create policy "own attempts" on attempts for all using (user_id=auth.uid()) with check (user_id=auth.uid());
