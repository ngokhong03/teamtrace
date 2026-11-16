-- Migration 004: theo 2 mẫu sheet của nhóm (Progress Tracker + Team leader's assessment).
-- Chạy trong Supabase > SQL Editor TRƯỚC khi deploy bản code tương ứng. An toàn khi chạy lại.

-- Nhiệm vụ: yêu cầu đánh số, người hỗ trợ, giờ hạn nộp, link sản phẩm, trưởng nhóm duyệt
alter table tasks add column if not exists requirements jsonb not null default '[]'::jsonb;
alter table tasks add column if not exists supporter_ids jsonb not null default '[]'::jsonb;
alter table tasks add column if not exists due_time text not null default '';
alter table tasks add column if not exists product_link text not null default '';
alter table tasks add column if not exists approval text not null default 'none';
alter table tasks add column if not exists approved_at timestamptz;

-- Đánh giá của trưởng nhóm theo bảng tiêu chí 4 mức (1 dòng / thành viên)
create table if not exists leader_assessments (
  project_id uuid not null references projects(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  comment text not null default '',
  updated_at timestamptz not null default now(),
  primary key (project_id, member_id)
);
alter table leader_assessments enable row level security;
