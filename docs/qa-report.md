# Báo Cáo QA Toàn Diện Trên Môi Trường Production (Vercel)

- **Domain kiểm thử:** https://teamtrace-pi.vercel.app
- **Ngày kiểm thử:** 16/11/2026
- **Môi trường:** Production (Vercel + Supabase)
- **Viewport kiểm tra:** Mobile (375x812) và Desktop (1280x800)
- **Mã dự án test tự động:** `694093` (script E2E) và `790362` (QA thủ công)

---

## 1. Kết Quả Kiểm Thử Tính Năng (Feature Checklist)

| Tính năng | Viewport Mobile | Viewport Desktop | Trạng thái |
| :--- | :---: | :---: | :---: |
| **Tạo nhóm & Sinh mã 6 số** | ✅ PASS | ✅ PASS | Mã sinh chuẩn, link mời tự động |
| **Tham gia nhóm (Join bằng Tên + MSSV)** | ✅ PASS | ✅ PASS | Hoạt động tốt |
| **Validation Mô tả < 10 ký tự** | ✅ PASS | ✅ PASS | Chặn đúng, hiện thông báo rõ |
| **Validation Số giờ > 40** | ✅ PASS | ✅ PASS | Chặn đúng quy định |
| **Ghi nhận công việc (Có/Không link)** | ✅ PASS | ✅ PASS | Lưu chuẩn vào Supabase `work_logs` |
| **Đánh giá chéo ẩn danh (Peer Review)** | ✅ PASS | ✅ PASS | Chấm 3 tiêu chí x 5 sao + nhận xét |
| **Chặn nộp đánh giá lần 2** | ✅ PASS | ✅ PASS | Banner đỏ chặn nghiêm ngặt |
| **Biểu đồ Radar 5 năng lực** | ✅ PASS | ✅ PASS | SVG render đẹp, chuyển tab mượt |
| **Bảng xếp hạng & AI Insights** | ✅ PASS | ✅ PASS | Tính điểm và % đóng góp chuẩn |
| **Nút "Sao chép tóm tắt"** | ✅ PASS | ✅ PASS | Copy format chuyên nghiệp vào Clipboard |
| **Nút "In / Lưu PDF"** | ✅ PASS | ✅ PASS | Bật print dialog chuẩn A4 |

---

## 2. Danh Sách Lỗi Phát Hiện (Bugs & Observations)

### 🔴 Lỗi 1: [Chặn] Next.js Data Cache lưu đệm kết quả `GET /api/projects/[code]/state`
- **Mức độ:** [Chặn] (High / Blocker)
- **Mô tả:** Khi thành viên mới tham gia nhóm qua `/api/projects/[code]/join`, bản ghi đã lưu vào DB Supabase, nhưng API `GET /api/projects/[code]/state` bị Next.js App Router Data Cache lưu đệm kết quả cũ (lúc mới có 1 người).
- **Hệ quả:**
  - Trang Tổng quan hiển thị sai số lượng thành viên mới tham gia.
  - Trang Đánh giá chéo (`/review`) báo *"Nhóm chưa có thành viên nào khác"*, làm người dùng không thể đánh giá chéo ngay lập tức nếu chưa xóa cache server.
- **Bước tái hiện:**
  1. Tạo nhóm mới, nhận mã 6 số.
  2. Mở tab ẩn danh / thiết bị khác join nhóm với Tên + MSSV mới.
  3. Mở lại trang Tổng quan / Đánh giá -> Không thấy thành viên mới.
- **Đề xuất khắc phục:** Trong `src/app/api/projects/[code]/state/route.ts`, bổ sung `export const dynamic = 'force-dynamic';` hoặc `export const revalidate = 0;`.

### 🟡 Lỗi 2: [Khó chịu] Cột "Nhật ký của bạn" không tự động cập nhật ngay sau khi bấm ghi nhận
- **Mức độ:** [Khó chịu] (Medium)
- **Mô tả:** Sau khi điền form và bấm "Ghi nhận công việc", form đã xóa trắng (dữ liệu vào Supabase), nhưng danh sách "Nhật ký của bạn" bên cạnh vẫn hiển thị "0 việc · 0 giờ - Bạn chưa ghi nhận công việc nào" nếu chưa F5 lại trang.
- **Bước tái hiện:**
  1. Vào `/p/[code]/log`.
  2. Nhập một đầu việc hợp lệ và bấm "Ghi nhận công việc".
  3. Quan sát phần "Nhật ký của bạn".
- **Đề xuất khắc phục:** Cập nhật state lạc quan (optimistic state) hoặc đảm bảo hàm `refresh()` fetch lại dữ liệu không cache.

### 🟢 Lỗi 3: [Thẩm mỹ / Giao diện] Thiếu thuộc tính `id` hoặc `name` trên một số trường form
- **Mức độ:** [Thẩm mỹ / Giao diện] (Low / Polish)
- **Mô tả:** Console trình duyệt xuất hiện cảnh báo `A form field element should have an id or name attribute (count: 6)` trên một số thẻ `<input>`.
- **Đề xuất khắc phục:** Bổ sung `id` và `name` tương ứng cho các input.

---

## 3. Đánh Giá Trải Nghiệm Người Dùng (UX Review)

- **Mobile Viewport (375x812):**
  - Giao diện thân thiện ngón tay cái nhờ Bottom Navigation 4 tab.
  - Phản hồi form nhanh, font chữ hiển thị rõ ràng, không bị tràn màn hình ngang.
- **Desktop Viewport (1280x800):**
  - Bố cục 2-3 cột cân đối, thanh cố định trên cùng hiển thị đầy đủ ngữ cảnh dự án.
  - Biểu đồ và bảng xếp hạng thể hiện chuyên nghiệp, tạo độ tin cậy cao cho sinh viên và giảng viên FTU.

---

## 4. Danh Sách Ảnh Chụp Màn Hình (Screenshots)
Toàn bộ ảnh chụp màn hình trong quá trình test mobile và desktop đã được lưu trữ tại:
`file:///C:/Users/trong/.gemini/antigravity/brain/da0d6b9e-ef71-4ab6-9d39-5d59e8f2c0a5/.system_generated/steps/`
