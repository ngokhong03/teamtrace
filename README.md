# TeamTrace – MVP Pilot

Nền tảng ghi nhận và đánh giá đóng góp trong bài tập nhóm: **WorkTrace** (nhật ký + minh chứng) → **Đánh giá chéo ẩn danh** → **Báo cáo đóng góp** (điểm 0–100, radar 5 trục, % đóng góp, AI Insights).

Stack: Next.js 14 (App Router) · Tailwind · Lucide · Recharts · Supabase (PostgreSQL) · Claude API (tùy chọn).

---

## Chạy thử local (2 phút, không cần cài database)

```bash
npm install
npm run dev
```

Mở http://localhost:3000. Khi chưa có biến môi trường Supabase, app tự lưu dữ liệu vào file `.data/db.json`.
(Chế độ này **chỉ để chạy local** – không dùng được trên Vercel.)

---

## Deploy lên Vercel cho sinh viên dùng (≈15 phút)

> Vercel là serverless nên cần database thật để mọi người dùng chung dữ liệu. Dùng Supabase (miễn phí).

### Bước 1 – Tạo database Supabase (5 phút)
1. Vào https://supabase.com → **New project** (chọn vùng Singapore cho nhanh). Chờ ~1 phút.
2. Vào **SQL Editor → New query**, dán toàn bộ nội dung file [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. Vào **Project Settings → API** và copy 2 giá trị:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (mục *Project API keys*) → `SUPABASE_SERVICE_ROLE_KEY`
   
   ⚠️ `service_role` là khóa bí mật, chỉ dán vào Vercel, **không** commit lên GitHub, không gửi vào nhóm chat.

> **Đã deploy bản cũ (trước khi có PIN)?** Chạy thêm các file trong [`supabase/migrations/`](supabase/migrations) theo thứ tự (`001_pin.sql` rồi `002_tasks.sql`) trong SQL Editor **trước** khi push bản mới. Tài khoản cũ chưa có PIN sẽ nhận PIN đầu tiên họ nhập khi vào lại.

### Bước 2 – Đưa code lên GitHub (3 phút)
```bash
git init && git add . && git commit -m "TeamTrace MVP"
# tạo repo rỗng trên github.com rồi:
git remote add origin https://github.com/<ban>/teamtrace.git
git push -u origin main
```
(`.gitignore` đã loại `node_modules`, `.data`, `.env`.)

### Bước 3 – Deploy trên Vercel (5 phút)
1. https://vercel.com → **Add New → Project** → chọn repo `teamtrace` → Framework tự nhận Next.js.
2. Mở **Environment Variables**, thêm:
   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL ở bước 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key ở bước 1 |
   | `ANTHROPIC_API_KEY` | *(tùy chọn)* key Claude để bật nút "Phân tích bằng Claude" |
3. **Deploy**. Xong bạn có domain dạng `teamtrace-xxx.vercel.app` để gửi cho sinh viên.

### Bước 4 – Kiểm tra trước giờ G (trước ngày 19/11)
- [ ] Mở domain trên **điện thoại**, tạo nhóm thử, lấy mã 6 số.
- [ ] Dùng 2–3 thiết bị/trình duyệt khác nhau join bằng Tên + MSSV, ghi vài công việc.
- [ ] Nộp đánh giá chéo, mở trang Báo cáo, bấm **In / Lưu PDF**.
- [ ] Nếu báo lỗi "Chưa cấu hình Supabase": kiểm tra 2 biến môi trường rồi **Redeploy**.
- [ ] Xóa dữ liệu thử: Supabase → Table Editor → xóa các dòng trong `projects` (các bảng khác tự xóa theo).

---

## Luồng sử dụng cho sinh viên
1. **Trưởng nhóm** vào trang chủ → *Tạo nhóm mới* (tên dự án, môn, deadline, tên + MSSV) → nhận **mã 6 số** và link mời.
2. **Thành viên** mở link (hoặc nhập mã) → nhập Tên + MSSV + **PIN 4–6 số tự đặt** → vào dự án. Vào lại trên máy khác bằng đúng MSSV + PIN.
3. Trang **Tổng quan** hiện ngay mục **Nhiệm vụ của bạn**: trưởng nhóm giao việc (kèm hạn nộp) cho từng người, thành viên cũng có thể **tự nhận việc**; mỗi người bấm Bắt đầu / Hoàn thành. Thiết bị đã vào một lần sẽ được nhớ: trang chủ có mục **Dự án của bạn** để bấm vào lại, không cần nhập mã và PIN.
4. Trong quá trình làm: tab **Ghi nhận** – điền đầu việc, mô tả, link minh chứng (Docs/Canva/Slides/GitHub…), số giờ, % hoàn thành.
5. Cuối dự án: tab **Đánh giá** – chấm 1–5 sao × 3 tiêu chí cho từng bạn + nhận xét (ẩn danh, chỉ nộp 1 lần).
6. Tab **Báo cáo**: bảng xếp hạng, % đóng góp, radar, AI Insights; nút **Sao chép tóm tắt** / **In / Lưu PDF** để nộp kèm bài.

## Cách tính điểm (`src/lib/scoring.ts`)
**Contribution Score = 40% WorkTrace + 40% Peer Review + 20% AI** (nếu chưa ai nộp đánh giá: 67% WorkTrace + 33% AI).

- **WorkTrace (0–100)** = 55% khối lượng quy đổi (giờ × %hoàn thành, so với người làm nhiều nhất; việc thiếu link chỉ tính 60%) + 25% tỷ lệ việc có link minh chứng + 20% độ chi tiết của mô tả.
- **Peer (0–100)** = trung bình 3 tiêu chí / 5 × 100, **điều chỉnh theo minh chứng**: người gần như không có minh chứng trên WorkTrace chỉ được tính tối đa 20% điểm Peer (tránh việc bạn bè chấm nể che lấp free-rider). Từ WorkTrace ≥ 60 thì tính đủ.
- **AI (0–100)**: mặc định là thuật toán heuristic (độ chi tiết, tính đều đặn, chất lượng theo đồng đội, sắc thái nhận xét). Nếu có `ANTHROPIC_API_KEY`, trưởng nhóm bấm *Phân tích bằng Claude*; điểm Claude bị giới hạn lệch tối đa ±25 so với điểm heuristic để chống "dẫn dắt" bằng nội dung sinh viên nhập.
- **% đóng góp** = điểm của từng người / tổng điểm cả nhóm. Ô "Điểm nhóm" trên trang Báo cáo quy đổi ra điểm cá nhân tham khảo (0,5–1,15 × điểm nhóm, tối đa 10).
- **Radar 5 trục**: Chủ động, Chiều sâu, Đúng hạn, Sáng tạo, Hỗ trợ đồng đội – tổng hợp từ cả số liệu WorkTrace và đánh giá đồng đội.

> Các trọng số/ngưỡng là giả định ban đầu của MVP, nên hiệu chỉnh sau pilot dựa trên so sánh với điểm giảng viên.

## Ẩn danh hoạt động thế nào
- Bảng `reviews` **không có cột người chấm và không có timestamp**; bảng `review_submissions` chỉ ghi "ai đã nộp" để chống nộp 2 lần. Không thể truy ngược ai chấm ai, kể cả khi xem trực tiếp database.
- Nhận xét văn bản chỉ hiển thị cho **chính người được nhận xét** (kể cả trưởng nhóm cũng không xem được nhận xét về người khác) và được xáo thứ tự.
- Hạn chế thực tế: nhóm ≤ 3 người dễ đoán ra người chấm – app có cảnh báo.
- Khi gọi Claude, tên thật được thay bằng "Thành viên A, B, C…".

## Giới hạn đã biết (pilot)
- **PIN thay cho mật khẩu**: PIN 4–6 số được băm (scrypt + salt), sai 5 lần liên tiếp thì khoá tài khoản 10 phút. Chưa có chức năng quên PIN: nếu sinh viên quên, cần xoá/sửa dòng `pin_hash` của thành viên đó trong Supabase (đặt về null để họ đặt PIN mới).
- Chưa giới hạn số lần thử theo địa chỉ IP, và mã nhóm 6 số vẫn có thể bị dò; PIN chỉ bảo vệ từng tài khoản.
- Chưa có quản trị viên/giảng viên riêng, chưa có đóng/mở giai đoạn đánh giá; chưa tự xóa dữ liệu theo thời hạn.
- Dữ liệu sinh viên (tên, MSSV) được lưu trên Supabase: nên thông báo và xin đồng ý của sinh viên tham gia pilot.

## Cấu trúc thư mục
```
src/
  app/
    page.tsx                        Trang chủ: tạo nhóm / nhập mã
    p/[code]/page.tsx               Tổng quan + Timeline nhóm
    p/[code]/log/page.tsx           WorkTrace Logger
    p/[code]/review/page.tsx        Đánh giá chéo ẩn danh
    p/[code]/report/page.tsx        Báo cáo đóng góp + AI Insights
    api/projects/...                REST API (tạo nhóm, join, logs, reviews, report, analyze)
  components/                       TaskForm, PeerReviewForm, RadarChartCard, HoursChart, Timeline, ...
  lib/
    scoring.ts                      Công thức điểm, radar
    ai.ts                           Heuristic insights + gọi Claude
    report.ts                       Ghép dữ liệu thành báo cáo
    store/                          file.ts (local) · supabase.ts (production)
supabase/schema.sql                 Schema database
```
