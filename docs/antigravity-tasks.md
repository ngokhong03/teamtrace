# Nhiệm vụ cho Antigravity (dán từng khối vào Manager view, mỗi khối một agent)

Đọc `AGENTS.md` trước. Mỗi agent làm xong thì báo cáo: đã đổi file nào, kết quả build, ảnh chụp trước/sau.

## 1. QA end-to-end trên trình duyệt (agent test)
Chạy `npm run dev`. Dùng trình duyệt tự động, viewport 375x812 rồi 1280x800:
1. Tạo nhóm mới ở trang chủ, ghi lại mã 6 số.
2. Mở cửa sổ ẩn danh khác, vào bằng mã đó với 3 thành viên khác nhau (tên + MSSV).
3. Mỗi thành viên ghi 2 công việc (có và không có link), thử mô tả quá ngắn và số giờ > 40 để xem thông báo lỗi.
4. Mỗi thành viên nộp đánh giá chéo; thử nộp lần 2 (phải bị chặn).
5. Mở tab Báo cáo: kiểm tra bảng xếp hạng, radar, nút Sao chép tóm tắt, In/Lưu PDF.
Chỉ ĐƯỢC báo lỗi, không tự sửa logic. Ghi danh sách lỗi theo mức độ (chặn / khó chịu / thẩm mỹ), kèm ảnh chụp và bước tái hiện, vào `docs/qa-report.md`.

## 2. Hoàn thiện giao diện mobile (agent UI)
Phạm vi: `src/components/*`, `src/app/**/page.tsx`, `globals.css`. Rà từng màn hình ở 375px: chữ chồng nhau, nút khó bấm (< 44px), bảng xếp hạng tràn, thanh nav dưới che nội dung. Sửa nhỏ, giữ phong cách hiện tại. Không đổi API hay logic.

## 3. Màn hình in báo cáo (agent UI)
Trang `/p/[code]/report` khi in (Ctrl+P): bố cục A4 gọn, không có nav/nút, bảng và radar không bị cắt giữa trang. Dùng lớp `no-print` và `print-card` đã có.

## 4. Dữ liệu demo (agent script)
Viết `scripts/seed-demo.mjs` gọi API local để tạo 1 nhóm demo 5 thành viên với dữ liệu thực tế (một người làm nhiều, một người ít, một người không làm) để dùng khi thuyết trình. In ra mã nhóm.

## Việc KHÔNG giao cho Antigravity
Triển khai Vercel, tạo project Supabase, nhập khóa bí mật: người dùng tự làm (xem README).
