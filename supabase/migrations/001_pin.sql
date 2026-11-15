-- Migration 001: thêm mã PIN cho thành viên.
-- Chạy trong Supabase > SQL Editor TRƯỚC khi deploy bản code có PIN. An toàn khi chạy lại nhiều lần.
alter table members add column if not exists pin_hash text;
alter table members add column if not exists failed_attempts int not null default 0;
alter table members add column if not exists locked_until timestamptz;
