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
r = await log(A, { task: "Khảo sát đối thủ", description: "Khảo sát 5 đối thủ, lập bảng so sánh giá và kênh phân phối, rút ra 3 khoảng trống thị trường để định vị.", link: "https://docs.google.com/d/1", percent: 100 });
assert(r.status === 200, "log A1");
r = await log(A, { task: "Slide", description: "Thiết kế 12 slide thuyết trình bằng Canva, thống nhất bộ nhận diện và biểu đồ.", link: "canva.com/design/x", category: "Thiết kế", percent: 90 });
assert(r.status === 200 && r.data.log.link.startsWith("https://"), "log A2 (tự thêm https)");
r = await log(Bm, { task: "Viết nội dung", description: "Viết phần phân tích SWOT và đề xuất chiến lược, kèm số liệu nguồn Statista.", link: "https://docs.google.com/d/2", category: "Viết nội dung", percent: 80 });
assert(r.status === 200, "log B1");
r = await log(C, { task: "Làm gì đó", description: "làm một chút việc", percent: 30 });
assert(r.status === 200, "log C1 (không link)");
assert((await log(C, { task: "x", description: "ngắn", percent: 30 })).status === 400, "mô tả quá ngắn -> 400");
const del = await log(C, { task: "Xoá thử", description: "việc để xoá thử nghiệm", percent: 10 });
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
const bRep = R.members.find((m) => m.id === ids.B);
assert(bRep.comments.includes("làm rất tốt, nhiệt tình"), "thành viên khác (C) đọc được nhận xét ẩn danh về B");
const leak = JSON.stringify(R.members.map((m) => m.comments));
assert(!/Minh Anh|Anh Thư|Gia Huy|Bảo Ngọc|K6500/.test(leak) && R.members.every((m) => m.comments.every((c) => typeof c === "string")), "nhận xét không kèm tên/MSSV người viết");
assert(R.members.find((m) => m.id === ids.D).stats.logCount === 0 && R.members.find((m) => m.id === ids.D).flags.length > 0, "D không có log -> bị flag");
assert(R.warnings.length > 0, "có cảnh báo (chưa đủ người nộp): " + R.warnings[0]);
assert(R.ai.source === "heuristic" && R.ai.available === false, "AI heuristic, chưa có API key");
console.log("Insight mẫu:", JSON.stringify(R.members[0].insight, null, 1));

const an = await j(`/api/projects/${code}/analyze`, { method: "POST", body: {}, s: Bm });
assert(an.status === 403, "member thường không chạy được AI -> 403");
const an2 = await j(`/api/projects/${code}/analyze`, { method: "POST", body: {}, s: A });
assert(an2.status === 400, "leader chạy AI khi chưa có key -> 400 thông báo rõ: " + an2.data.error);

// ---- Giao việc (chỉ trưởng nhóm) + ghi chú ----
const tk = (path = "", o = {}) => j(`/api/projects/${code}/tasks${path}`, o);
r = await tk("", { body: { title: "Khảo sát sinh viên", description: "50 bạn", assigneeId: Bm.memberId, dueDate: dl }, s: A });
assert(r.status === 200 && r.data.task.status === "todo" && r.data.task.assigneeId === Bm.memberId, "trưởng nhóm giao việc cho B");
const tid = r.data.task.id;
r = await tk("", { body: { title: "Giao bậy", assigneeId: A.memberId }, s: Bm });
assert(r.status === 403, "thành viên giao việc cho người khác -> 403");
r = await tk("", { body: { title: "Tự nhận việc" }, s: Bm });
assert(r.status === 403, "thành viên tự nhận việc -> 403 (chỉ trưởng nhóm giao)");
r = await tk("", { body: { title: "Người lạ", assigneeId: "00000000-0000-0000-0000-000000000000" }, s: A });
assert(r.status === 400, "giao cho người không thuộc nhóm -> 400");
r = await tk("/" + tid + "/notes", { body: { content: "Đã làm xong form, đang thu phản hồi" }, s: Bm });
assert(r.status === 200, "người được giao ghi chú vào nhiệm vụ");
r = await tk("/" + tid + "/notes", { body: { content: "chen ngang" }, s: C });
assert(r.status === 403, "người không được giao ghi chú -> 403");
r = await tk("/" + tid, { method: "PATCH", body: { status: "doing" }, s: C });
assert(r.status === 403, "người không được giao đổi trạng thái -> 403");
r = await tk("/" + tid, { method: "PATCH", body: { status: "bay" }, s: Bm });
assert(r.status === 400, "trạng thái không hợp lệ -> 400");
r = await tk("/" + tid, { method: "PATCH", body: { status: "doing" }, s: Bm });
assert(r.status === 200 && r.data.task.status === "doing", "người được giao bắt đầu làm");
r = await tk("/" + tid, { method: "PATCH", body: { status: "done" }, s: Bm });
assert(r.status === 200 && r.data.task.status === "done" && r.data.task.doneAt, "người được giao hoàn thành (có doneAt)");
r = await tk("/" + tid, { method: "PATCH", body: { title: "Sửa lén" }, s: Bm });
assert(r.status === 403, "người được giao không sửa được tên việc -> 403");
r = await tk("/" + tid, { method: "PATCH", body: { assigneeId: C.memberId }, s: Bm });
assert(r.status === 403, "thành viên đổi người được giao -> 403");
r = await tk("/" + tid, { method: "PATCH", body: { assigneeId: C.memberId, title: "Khảo sát 50 sinh viên" }, s: A });
assert(r.status === 200 && r.data.task.assigneeId === C.memberId, "trưởng nhóm đổi người được giao + sửa tên");
r = await tk("/" + tid, { method: "DELETE", s: Bm });
assert(r.status === 403, "thành viên xoá việc của trưởng nhóm -> 403");

// ---- Trạng thái: ẩn ai đã/chưa đánh giá, có ghi chú + lịch sử ----
r = await j(`/api/projects/${code}/state`, { s: C });
assert(r.data.tasks.length === 1 && r.data.tasks[0].assigneeId === C.memberId, "state trả đúng nhiệm vụ cho C");
assert(r.data.members.every((m) => !("submitted" in m)), "không lộ trạng thái đánh giá của từng người");
assert(r.data.submittedCount === 3, "chỉ có số tổng đã nộp đánh giá: " + r.data.submittedCount);
assert(r.data.notes.length === 1 && r.data.notes[0].content.includes("form"), "state có ghi chú nhiệm vụ");
const types = new Set(r.data.activities.map((a) => a.type));
assert(["member_joined", "task_assigned", "task_status", "task_note", "log_added"].every((t) => types.has(t)), "lịch sử có đủ loại sự kiện: " + [...types].join(","));
assert(!types.has("log_deleted"), "thành viên thường không thấy sự kiện xoá công việc");
r = await j(`/api/projects/${code}/state`, { s: A });
const delAct = r.data.activities.find((a) => a.type === "log_deleted");
assert(delAct && delAct.detail.task === "Xoá thử", "trưởng nhóm thấy công việc đã xoá kèm nội dung cũ");

// ---- Đọc link minh chứng ----
r = await log(A, { task: "Trang tham khảo", description: "Đọc tài liệu tham khảo về định dạng tên miền", link: "https://example.com", percent: 100 });
assert(r.status === 200 && ["ok", "limited"].includes(r.data.log.evidenceStatus), "đọc được link công khai: " + r.data.log.evidenceStatus);
const evId = r.data.log.id;
r = await j(`/api/projects/${code}/logs/${evId}`, { s: A });
assert(r.status === 200 && /Example Domain/i.test(r.data.log.evidenceTitle + r.data.log.evidenceText), "người ghi xem được nội dung AI đọc");
r = await j(`/api/projects/${code}/logs/${evId}`, { s: C });
assert(r.status === 403, "thành viên khác không xem được nội dung minh chứng -> 403");
r = await log(A, { task: "Link nội bộ", description: "thử link trỏ vào máy chủ nội bộ", link: "http://127.0.0.1/admin", percent: 10 });
assert(r.status === 200 && r.data.log.evidenceStatus === "error", "chặn link nội bộ (chống SSRF): " + r.data.log.evidenceStatus);
r = await log(A, { task: "Link metadata", description: "thử link metadata của máy chủ đám mây", link: "http://169.254.169.254/latest/meta-data", percent: 10 });
assert(r.status === 200 && r.data.log.evidenceStatus === "error", "chặn địa chỉ metadata đám mây");
r = await j(`/api/projects/${code}/logs/${evId}`, { method: "PATCH", body: { recheck: true }, s: C });
assert(r.status === 403, "thành viên khác không đọc lại được link của người khác -> 403");
r = await j(`/api/projects/${code}/logs/${evId}`, { method: "PATCH", body: { recheck: true }, s: A });
assert(r.status === 200, "người ghi đọc lại link");

// ---- Mẫu Progress Tracker: yêu cầu, người hỗ trợ, giờ hạn, duyệt ----
r = await tk("", { body: { title: "Làm video micro", requirements: "1. Đọc kỹ nội dung\n2) Bổ sung ví dụ\n\nNộp bản nháp", assigneeId: Bm.memberId, supporterIds: [C.memberId, Bm.memberId], dueDate: dl, dueTime: "23:00" }, s: A });
assert(r.status === 200 && r.data.task.requirements.length === 3 && r.data.task.requirements[0] === "Đọc kỹ nội dung", "nhiệm vụ có danh sách yêu cầu (tự bỏ số thứ tự): " + JSON.stringify(r.data.task.requirements));
assert(r.data.task.supporterIds.length === 1 && r.data.task.supporterIds[0] === C.memberId, "người hỗ trợ (bỏ trùng với người phụ trách)");
assert(r.data.task.dueTime === "23:00" && r.data.task.approval === "none", "có giờ hạn nộp 23:00, chưa duyệt");
const t2 = r.data.task.id;
r = await tk("", { body: { title: "Sai giờ", dueDate: dl, dueTime: "25:99" }, s: A });
assert(r.status === 400, "giờ hạn không hợp lệ -> 400");
r = await tk("/" + t2 + "/notes", { body: { content: "Mình hỗ trợ phần dựng video" }, s: C });
assert(r.status === 200, "người hỗ trợ ghi chú được vào nhiệm vụ");
r = await tk("/" + t2, { method: "PATCH", body: { approval: "approved" }, s: A });
assert(r.status === 400, "không duyệt được việc chưa hoàn thành -> 400");
r = await tk("/" + t2, { method: "PATCH", body: { status: "done", productLink: "drive.google.com/x" }, s: Bm });
assert(r.status === 200 && r.data.task.status === "done" && r.data.task.productLink === "https://drive.google.com/x", "người phụ trách nộp link sản phẩm + hoàn thành");
r = await tk("/" + t2, { method: "PATCH", body: { approval: "approved" }, s: Bm });
assert(r.status === 403, "thành viên tự duyệt -> 403");
r = await tk("/" + t2, { method: "PATCH", body: { approval: "revise" }, s: A });
assert(r.status === 200 && r.data.task.approval === "revise" && r.data.task.status === "doing", "trưởng nhóm yêu cầu sửa -> quay lại Đang làm");
r = await tk("/" + t2, { method: "PATCH", body: { status: "done" }, s: Bm });
assert(r.status === 200 && r.data.task.approval === "none", "nộp lại -> chờ duyệt lại");
r = await tk("/" + t2, { method: "PATCH", body: { approval: "approved" }, s: A });
assert(r.status === 200 && r.data.task.approval === "approved" && r.data.task.approvedAt, "trưởng nhóm duyệt: Completed & Approved");

// ---- Mẫu Team leader's assessment: bảng tiêu chí 4 mức ----
const sc = { contribution: 4, attitude: 3, collaboration: 3 };
r = await j(`/api/projects/${code}/assessments`, { method: "PUT", body: { memberId: C.memberId, scores: sc }, s: Bm });
assert(r.status === 403, "thành viên chấm theo bảng tiêu chí -> 403");
r = await j(`/api/projects/${code}/assessments`, { method: "PUT", body: { memberId: A.memberId, scores: sc }, s: A });
assert(r.status === 400, "trưởng nhóm tự chấm mình -> 400");
r = await j(`/api/projects/${code}/assessments`, { method: "PUT", body: { memberId: Bm.memberId, scores: { contribution: 4 } }, s: A });
assert(r.status === 400, "chấm thiếu tiêu chí -> 400");
r = await j(`/api/projects/${code}/assessments`, { method: "PUT", body: { memberId: Bm.memberId, scores: { ...sc, attitude: 5 } }, s: A });
assert(r.status === 400, "điểm ngoài 1–4 -> 400");
r = await j(`/api/projects/${code}/assessments`, { method: "PUT", body: { memberId: Bm.memberId, scores: sc, comment: "Làm tốt phần nội dung" }, s: A });
assert(r.status === 200, "trưởng nhóm chấm B theo bảng tiêu chí");
r = await j(`/api/projects/${code}/assessments`, { method: "PUT", body: { memberId: C.memberId, scores: { contribution: 2, attitude: 2, collaboration: 3 } }, s: A });
assert(r.status === 200, "trưởng nhóm chấm C");
r = await j(`/api/projects/${code}/state`, { s: Bm });
assert(r.data.assessments.length === 1 && r.data.assessments[0].memberId === Bm.memberId, "thành viên chỉ thấy đánh giá về chính mình");
r = await j(`/api/projects/${code}/report`, { s: Bm });
const bSelf = r.data.members.find((m) => m.id === Bm.memberId), cOther = r.data.members.find((m) => m.id === C.memberId);
assert(bSelf.leaderAssessment && Math.abs(bSelf.leaderAssessment.average - 3.33) < 0.01, "báo cáo: B thấy điểm trưởng nhóm của mình (3.33/4)");
assert(cOther.leaderAssessment === null, "báo cáo: B không thấy điểm trưởng nhóm của C");
r = await j(`/api/projects/${code}/report`, { s: A });
assert(r.data.members.filter((m) => m.leaderAssessment).length === 2, "báo cáo: trưởng nhóm thấy đánh giá của mọi người");

// ---- Khoá sau 5 lần sai (dùng riêng tài khoản D, đặt cuối) ----
let last;
for (let i = 0; i < 5; i++) last = await j(`/api/projects/${code}/join`, { body: { name: "Bảo Ngọc", studentId: "K65004", pin: "0000" } });
assert(last.status === 429, "sai 5 lần -> khoá 429: " + last.data.error);
r = await j(`/api/projects/${code}/join`, { body: { name: "Bảo Ngọc", studentId: "K65004", pin: "1234" } });
assert(r.status === 429, "đang khoá: đúng PIN vẫn bị chặn");
console.log("CODE", code);
