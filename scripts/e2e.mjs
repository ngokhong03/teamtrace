const B = (process.argv[2] || "http://localhost:3000").replace(/[/]+$/, "");
const today = new Date().toISOString().slice(0, 10);
const j = async (path, { method, body, s } = {}) => {
  const r = await fetch(B + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(s ? { "x-member-id": s.memberId, "x-member-token": s.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
};
const assert = (c, m) => { if (!c) { console.log("FAIL:", m); process.exitCode = 1; } else console.log("ok  :", m); };

const dl = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
const c = await j("/api/projects", { body: { name: "[TEST] xoá được", course: "Marketing căn bản", deadline: dl, leaderName: "Minh Anh", leaderStudentId: "K65001", leaderPin: "1234" } });
assert(c.status === 200 && /^\d{6}$/.test(c.data.code), "tạo project, mã 6 số: " + c.data.code);
const code = c.data.code;
const A = { memberId: c.data.memberId, token: c.data.token };
// Đọc trạng thái TRƯỚC khi ghi: bắt lỗi cache đọc-sau-ghi (Next.js fetch cache)
await j(`/api/projects/${code}/state`, { s: A });

const jb = await j(`/api/projects/${code}/join`, { body: { name: "Anh Thư", studentId: "K65002", pin: "1234" } });
const jc = await j(`/api/projects/${code}/join`, { body: { name: "Gia Huy", studentId: "K65003", pin: "1234" } });
const jd = await j(`/api/projects/${code}/join`, { body: { name: "Bảo Ngọc", studentId: "K65004", pin: "1234" } });
const Bm = jb.data, C = jc.data, D = jd.data;
assert(jb.status === 200 && jc.status === 200 && jd.status === 200, "3 thành viên join");
const re = await j(`/api/projects/${code}/join`, { body: { name: "xx", studentId: "k65002", pin: "1234" } }); // ok
assert(re.data.memberId === Bm.memberId && re.data.rejoined, "rejoin bằng MSSV (không phân biệt hoa thường)");

let r;
// ---- PIN ----
r = await j(`/api/projects/${code}/join`, { body: { name: "Ai Do", studentId: "K65002", pin: "9999" } });
assert(r.status === 401 && /còn 4 lần/.test(r.data.error), "sai PIN -> 401, còn 4 lần: " + r.data.error);
r = await j(`/api/projects/${code}/join`, { body: { name: "Ai Do", studentId: "K65002", pin: "12" } });
assert(r.status === 400, "PIN quá ngắn -> 400");
r = await j(`/api/projects/${code}/join`, { body: { name: "Ai Do", studentId: "K65002", pin: "abcd" } });
assert(r.status === 400, "PIN không phải số -> 400");
r = await j(`/api/projects/${code}/join`, { body: { name: "Anh Thư", studentId: "K65002", pin: "1234" } });
assert(r.status === 200 && r.data.memberId === Bm.memberId, "đúng PIN -> vào lại, reset đếm sai");
r = await j("/api/projects", { body: { name: "x y", course: "", deadline: "", leaderName: "No Pin", leaderStudentId: "ZZZ1" } });
assert(r.status === 400, "tạo nhóm không có PIN -> 400");
const bad = await j(`/api/projects/${code}/state`, { s: { memberId: A.memberId, token: "sai" } });
assert(bad.status === 401, "token sai -> 401");

const log = (s, o) => j(`/api/projects/${code}/logs`, { body: { category: "Nghiên cứu", workDate: today, ...o }, s });
r = await log(A, { task: "Khảo sát đối thủ", description: "Khảo sát 5 đối thủ, lập bảng so sánh giá và kênh phân phối, rút ra 3 khoảng trống thị trường để định vị.", link: "https://docs.google.com/d/1", hours: 6, percent: 100 });
assert(r.status === 200, "log A1");
r = await log(A, { task: "Slide", description: "Thiết kế 12 slide thuyết trình bằng Canva, thống nhất bộ nhận diện và biểu đồ.", link: "canva.com/design/x", category: "Thiết kế", hours: 5, percent: 90 });
assert(r.status === 200 && r.data.log.link.startsWith("https://"), "log A2 (tự thêm https)");
r = await log(Bm, { task: "Viết nội dung", description: "Viết phần phân tích SWOT và đề xuất chiến lược, kèm số liệu nguồn Statista.", link: "https://docs.google.com/d/2", category: "Viết nội dung", hours: 4, percent: 80 });
assert(r.status === 200, "log B1");
r = await log(C, { task: "Làm gì đó", description: "làm một chút việc", hours: 1, percent: 30 });
assert(r.status === 200, "log C1 (không link)");
assert((await log(C, { task: "x", description: "ngắn", hours: 1, percent: 30 })).status === 400, "mô tả quá ngắn -> 400");
assert((await log(C, { task: "xx", description: "mô tả đủ dài rồi nhé", hours: 99, percent: 30 })).status === 400, "giờ > 40 -> 400");
const del = await log(C, { task: "Xoá thử", description: "việc để xoá thử nghiệm", hours: 1, percent: 10 });
assert((await j(`/api/projects/${code}/logs/${del.data.log.id}`, { method: "DELETE", s: Bm })).status === 404, "không xoá được log người khác");
assert((await j(`/api/projects/${code}/logs/${del.data.log.id}`, { method: "DELETE", s: C })).status === 200, "xoá log của mình");

const st = await j(`/api/projects/${code}/state`, { s: A });
assert(st.data.members.length === 4 && st.data.logs.length === 4, "state: 4 members, 4 logs");

// Peer review
const rv = (targets, vals, cm) => targets.map((t, i) => ({ revieweeId: t.memberId, responsibility: vals[0], quality: vals[1], collaboration: vals[2], comment: cm?.[i] ?? "" }));
const all = { A, B: Bm, C, D };
const ids = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.memberId]));
r = await j(`/api/projects/${code}/reviews`, { body: { reviews: rv([Bm, C], [5, 5, 5]) }, s: A });
assert(r.status === 400, "thiếu người đánh giá -> 400");
r = await j(`/api/projects/${code}/reviews`, { body: { reviews: rv([Bm, C, D], [5, 4, 5], ["làm rất tốt, nhiệt tình", "", "chủ động"]) }, s: A });
assert(r.status === 200, "A nộp đánh giá");
r = await j(`/api/projects/${code}/reviews`, { body: { reviews: rv([Bm, C, D], [5, 4, 5]) }, s: A });
assert(r.status === 409, "A nộp lần 2 -> 409");
r = await j(`/api/projects/${code}/reviews`, { body: { reviews: rv([A, C, D], [4, 4, 4], ["", "nộp trễ, thiếu trách nhiệm", ""]) }, s: Bm });
assert(r.status === 200, "B nộp đánh giá");
r = await j(`/api/projects/${code}/reviews`, { body: { reviews: rv([A, Bm, D], [4, 3, 4], ["", "", ""]) }, s: C });
assert(r.status === 200, "C nộp đánh giá");

const rep = await j(`/api/projects/${code}/report`, { s: C });
const R = rep.data;
assert(rep.status === 200 && R.members.length === 4, "report có 4 thành viên");
console.log(R.members.map((m) => `${m.rank}. ${m.name} total=${m.total} share=${m.share}% work=${m.workScore} peer=${m.peerScore} ai=${m.aiScore}`).join("\n"));
const share = R.members.reduce((s, m) => s + m.share, 0);
assert(Math.abs(share - 100) < 0.5, "tổng % đóng góp ≈ 100 (" + share.toFixed(1) + ")");
assert(R.members.every((m) => m.total >= 0 && m.total <= 100), "điểm trong 0-100");
const me = R.members.find((m) => m.id === ids.C);
assert(Array.isArray(me.comments) && me.comments.length === 1, "C thấy 1 nhận xét ẩn danh của chính mình: " + JSON.stringify(me.comments));
assert(R.members.filter((m) => m.id !== ids.C).every((m) => m.comments === null), "không lộ nhận xét của người khác");
assert(R.members.find((m) => m.id === ids.D).stats.logCount === 0 && R.members.find((m) => m.id === ids.D).flags.length > 0, "D không có log -> bị flag");
assert(R.warnings.length > 0, "có cảnh báo (chưa đủ người nộp): " + R.warnings[0]);
assert(R.ai.source === "heuristic" && R.ai.available === false, "AI heuristic, chưa có API key");
console.log("Insight mẫu:", JSON.stringify(R.members[0].insight, null, 1));

const an = await j(`/api/projects/${code}/analyze`, { method: "POST", body: {}, s: Bm });
assert(an.status === 403, "member thường không chạy được AI -> 403");
const an2 = await j(`/api/projects/${code}/analyze`, { method: "POST", body: {}, s: A });
assert(an2.status === 400, "leader chạy AI khi chưa có key -> 400 thông báo rõ: " + an2.data.error);

// ---- Khoá sau 5 lần sai (dùng riêng tài khoản D, đặt cuối) ----
let last;
for (let i = 0; i < 5; i++) last = await j(`/api/projects/${code}/join`, { body: { name: "Bảo Ngọc", studentId: "K65004", pin: "0000" } });
assert(last.status === 429, "sai 5 lần -> khoá 429: " + last.data.error);
r = await j(`/api/projects/${code}/join`, { body: { name: "Bảo Ngọc", studentId: "K65004", pin: "1234" } });
assert(r.status === 429, "đang khoá: đúng PIN vẫn bị chặn");
console.log("CODE", code);
