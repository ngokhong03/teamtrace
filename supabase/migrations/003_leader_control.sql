-- Migration 003: đọc nội dung link minh chứng, ghi chú nhiệm vụ, lịch sử hoạt động.
-- Chạy trong Supabase > SQL Editor TRƯỚC khi deploy bản code tương ứng. An toàn khi chạy lại.

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
