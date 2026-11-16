import {
  BookOpen,
  Building2,
  Check,
  ClipboardList,
  EyeOff,
  FileBarChart,
  GraduationCap,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/** Các phần giới thiệu sản phẩm trên trang chủ (nội dung tĩnh). */

const AUDIENCES = [
  {
    icon: GraduationCap,
    title: "Nhóm sinh viên",
    points: [
      "Biết rõ ai làm gì, việc nào đang chậm",
      "Có bằng chứng để bảo vệ công sức của mình",
      "Báo cáo đóng góp nộp kèm bài cho giảng viên",
    ],
  },
  {
    icon: BookOpen,
    title: "Giảng viên & nhà trường",
    points: [
      "Chấm điểm cá nhân trong bài nhóm dựa trên dữ liệu",
      "Phát hiện sớm thành viên không tham gia",
      "Giảm khiếu nại về chia điểm",
    ],
  },
  {
    icon: Building2,
    title: "Doanh nghiệp, agency, startup",
    points: [
      "Đánh giá thực tập sinh và đội dự án bằng minh chứng thật",
      "Phản hồi ẩn danh giữa các thành viên, có AI gợi ý cải thiện",
      "Theo dõi sự phát triển của từng người qua nhiều dự án",
    ],
  },
];

const STEPS = [
  { icon: ClipboardList, title: "Tạo nhóm & giao việc", desc: "Trưởng nhóm tạo dự án, giao nhiệm vụ kèm hạn nộp. Thành viên vào bằng mã 6 số." },
  { icon: FileBarChart, title: "Ghi nhận minh chứng", desc: "Mỗi người ghi lại việc đã làm, số giờ, % hoàn thành và link sản phẩm." },
  { icon: EyeOff, title: "Đánh giá chéo ẩn danh", desc: "Chấm 3 tiêu chí cho từng đồng đội. Hệ thống không lưu ai chấm ai." },
  { icon: Sparkles, title: "Báo cáo & gợi ý cải thiện", desc: "Điểm đóng góp 0–100, biểu đồ 5 năng lực, điểm mạnh và việc cần cải thiện." },
];

const PLANS = [
  {
    name: "Free",
    price: "Miễn phí",
    who: "Nhóm sinh viên",
    features: [
      "Tối đa 5 dự án",
      "Ghi nhận công việc, đánh giá chéo ẩn danh",
      "Nhận xét AI tổng quát",
      "Có quảng cáo công cụ học tập (không hiện ở trang đánh giá và báo cáo)",
    ],
    highlight: false,
  },
  {
    name: "Team",
    price: "Đang hoàn thiện",
    who: "Lớp học, câu lạc bộ, nhóm dự án",
    features: ["Tối đa 15 dự án", "Phân tích và gợi ý cải thiện cho từng người", "Xuất báo cáo cho giảng viên", "Không quảng cáo"],
    highlight: true,
  },
  {
    name: "Business",
    price: "Liên hệ",
    who: "Doanh nghiệp, agency, startup",
    features: [
      "Không giới hạn dự án",
      "Đánh giá thực tập sinh",
      "Bảng theo dõi phát triển nhân sự cho HR",
      "Hỗ trợ triển khai",
    ],
    highlight: false,
  },
];

const PROMISES = [
  { icon: EyeOff, text: "Ẩn danh thật: nội dung đánh giá được lưu không kèm người chấm." },
  { icon: Lock, text: "Mã PIN được mã hoá, khoá tạm khi nhập sai nhiều lần." },
  { icon: ShieldCheck, text: "Không bán hoặc chia sẻ dữ liệu cá nhân cho bên quảng cáo." },
];

function SectionTitle({ kicker, title, desc }: { kicker: string; title: string; desc?: string }) {
  return (
    <div className="mb-6 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{kicker}</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      {desc && <p className="mt-2 text-slate-600">{desc}</p>}
    </div>
  );
}

export default function LandingSections() {
  return (
    <div className="mt-16 space-y-16 sm:mt-20 sm:space-y-20">
      {/* Dành cho ai */}
      <section id="danh-cho-ai" className="scroll-mt-6">
        <SectionTitle
          kicker="Dành cho ai"
          title="Không chỉ bài tập nhóm trên lớp"
          desc="Ở đâu có làm việc nhóm, ở đó cần biết ai đóng góp gì và làm sao để mọi người làm tốt hơn."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <a.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-bold text-slate-900">{a.title}</h3>
              <ul className="mt-2 space-y-1.5">
                {a.points.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Cách hoạt động */}
      <section id="cach-hoat-dong" className="scroll-mt-6">
        <SectionTitle kicker="Cách hoạt động" title="4 bước, từ giao việc đến báo cáo" />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="absolute right-4 top-4 font-mono text-sm font-bold text-slate-300">0{i + 1}</span>
              <s.icon className="h-6 w-6 text-indigo-600" />
              <h3 className="mt-3 font-bold text-slate-900">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-2xl bg-slate-900 p-5 text-sm text-slate-200 sm:p-6">
          <p className="font-semibold text-white">Khác gì Trello, ClickUp hay Notion?</p>
          <p className="mt-1">
            Các công cụ đó giúp quản lý <i>việc</i>. TeamTrace đo <i>đóng góp</i> của từng người dựa trên minh chứng và đánh giá
            chéo, rồi gợi ý cách mỗi người làm việc nhóm tốt hơn qua từng dự án.
          </p>
        </div>
      </section>

      {/* Các gói */}
      <section id="cac-goi" className="scroll-mt-6">
        <SectionTitle
          kicker="Các gói (dự kiến)"
          title="Miễn phí cho sinh viên, trả phí cho tổ chức"
          desc="Giá các gói trả phí đang được hoàn thiện sau giai đoạn thử nghiệm."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${p.highlight ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200"}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold text-slate-900">{p.name}</h3>
                {p.highlight && (
                  <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">Phổ biến</span>
                )}
              </div>
              <p className="text-sm text-slate-500">{p.who}</p>
              <p className="mt-3 text-2xl font-extrabold text-slate-900">{p.price}</p>
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Cam kết dữ liệu */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
        <h2 className="font-bold text-slate-900">Cam kết về dữ liệu</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <li key={p.text} className="flex gap-2 text-sm text-slate-700">
              <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {p.text}
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
        TeamTrace · Dự án khởi nghiệp sinh viên · Phiên bản thử nghiệm
      </footer>
    </div>
  );
}
