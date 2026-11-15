# TeamTrace – quy ước cho agent (Antigravity / Claude Code)

Dự án: Next.js 14 (App Router) + Tailwind + Recharts + Supabase. Giao diện tiếng Việt. Xem README.md để biết cách chạy và công thức điểm.

## Quy tắc chung
- Chạy `npm run typecheck` và `npm run build` trước khi báo xong. Không để lỗi.
- Không đổi công thức điểm (`src/lib/scoring.ts`), schema (`supabase/schema.sql`) hay cơ chế ẩn danh (bảng `reviews` KHÔNG được có cột người chấm/timestamp) nếu chưa có yêu cầu rõ ràng.
- Không commit `.env`, `.data`, `node_modules`. Không đưa `SUPABASE_SERVICE_ROLE_KEY` hay `ANTHROPIC_API_KEY` vào code hoặc log.
- Không sửa file ngoài phạm vi nhiệm vụ. Mỗi agent làm trên branch riêng (`agent/<tên-việc>`), không sửa cùng file với agent khác.
- Mobile-first: kiểm tra ở 375px và desktop; không có cuộn ngang.

## Phân vai
- **Antigravity**: giao diện, kiểm thử trên trình duyệt, báo lỗi kèm ảnh chụp.
- **Claude Code**: logic điểm, API, schema, review code.

## Chạy local
```
npm install
npm run dev      # http://localhost:3000, dữ liệu lưu ở .data/db.json
```
