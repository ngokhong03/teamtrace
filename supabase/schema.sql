-- TeamTrace – Supabase schema. Chạy toàn bộ file này trong Supabase > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  course text not null default '',
  deadline date,
  analysis jsonb,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  student_id text not null,
  token text not null,
  is_leader boolean not null default false,
  joined_at timestamptz not null default now(),
  pin_hash text,                          -- scrypt "salt:hash"; null = tài khoản cũ chưa có PIN
  failed_attempts int not null default 0, -- số lần nhập sai PIN liên tiếp
  locked_until timestamptz,               -- khoá tạm sau khi sai quá nhiều lần
  unique (project_id, student_id)
);

create table if not exists work_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  task text not null,
  description text not null default '',
  link text not null default '',
  category text not null default 'Khác',
  hours numeric(5,2) not null check (hours >= 0 and hours <= 40),
  percent int not null check (percent between 0 and 100),
  work_date date not null,
  created_at timestamptz not null default now()
);
create index if not exists work_logs_project_idx on work_logs(project_id);

-- Ai đã nộp đánh giá (chỉ để chống nộp 2 lần + biết tiến độ)
create table if not exists review_submissions (
  project_id uuid not null references projects(id) on delete cascade,
  reviewer_id uuid not null references members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, reviewer_id)
);

-- Nội dung đánh giá: CỐ Ý không có cột người chấm và không có timestamp
-- => không thể truy ngược ai chấm ai, kể cả khi đọc trực tiếp database.
create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  reviewee_id uuid not null references members(id) on delete cascade,
  responsibility smallint not null check (responsibility between 1 and 5),
  quality smallint not null check (quality between 1 and 5),
  collaboration smallint not null check (collaboration between 1 and 5),
  comment text not null default ''
);
create index if not exists reviews_project_idx on reviews(project_id);

-- Bật RLS và KHÔNG tạo policy nào: trình duyệt không thể đọc/ghi trực tiếp.
-- Chỉ server Next.js (service_role key) truy cập được.
alter table projects enable row level security;
alter table members enable row level security;
alter table work_logs enable row level security;
alter table review_submissions enable row level security;
alter table reviews enable row level security;

-- Nhiệm vụ được giao (xem migrations/002_tasks.sql)
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

-- Đọc link minh chứng, ghi chú nhiệm vụ, lịch sử hoạt động (xem migrations/003_leader_control.sql)
-- Kết quả AI/hệ thống đọc link minh chứng
alter table work_logs add column if not exists evidence_status text not null default 'none';
alter table work_logs add column if not exists evidence_title text not null default '';
alter table work_logs add column if not exists evidence_excerpt text not null default '';
alter table work_logs add column if not exists evidence_text text not null default '';
-- Log cũ có link nhưng chưa được đọc
update work_logs set evidence_status = 'error' where link <> '' and evidence_status = 'none';

-- Ghi chú của thành viên vào nhiệm vụ
create table if not exists task_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists task_notes_project_idx on task_notes(project_id);

-- Lịch sử hoạt động (chỉ thêm, giữ cả khi công việc bị xoá).
-- KHÔNG ghi sự kiện nộp đánh giá chéo để giữ ẩn danh.
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  actor_id uuid references members(id) on delete set null,
  type text not null,
  task_id uuid,
  log_id uuid,
  summary text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activities_project_idx on activities(project_id, created_at desc);

alter table task_notes enable row level security;
alter table activities enable row level security;
