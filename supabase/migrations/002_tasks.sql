-- Migration 002: nhiệm vụ được giao cho thành viên.
-- Chạy trong Supabase > SQL Editor TRƯỚC khi deploy bản code có "Giao việc". An toàn khi chạy lại.
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  assignee_id uuid not null references members(id) on delete cascade,
  created_by uuid references members(id) on delete set null,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);
create index if not exists tasks_project_idx on tasks(project_id);
alter table tasks enable row level security;
