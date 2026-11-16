/**
 * Quảng cáo cho gói Free (nhóm sinh viên).
 * - Chỉ hiện ở trang Tổng quan và Ghi nhận; KHÔNG hiện ở Đánh giá và Báo cáo.
 * - Không gửi dữ liệu cá nhân cho bên quảng cáo: đường dẫn chỉ có tham số utm.
 * - Các gói trả phí (Team, Business) sau này sẽ đặt PLAN khác "free" để tắt quảng cáo.
 */
export const PLAN: "free" | "team" | "business" = "free";

export interface Ad {
  id: string;
  label: string; // nhãn nhỏ phía trên tiêu đề
  title: string;
  description: string;
  cta: string;
  url: string;
  tags: string[];
}

export const ADS: Ad[] = [
  {
    id: "mechanicalbka",
    label: "Dành cho sinh viên kỹ thuật",
    title: "MechanicalBKA – Tài liệu & công cụ kỹ thuật cơ khí",
    description:
      "Kho file kỹ thuật cơ khí, đồ án chi tiết máy, dịch vụ in 3D và cắt laser kim loại tấm. Nhận thiết kế và gia công theo yêu cầu tại Việt Nam.",
    cta: "Xem MechanicalBKA",
    url: "https://mechanicalbka-web.vercel.app/?utm_source=teamtrace&utm_medium=free_ad&utm_campaign=student_teams",
    tags: ["Tài liệu CAD", "Đồ án chi tiết máy", "In 3D", "Cắt laser"],
  },
];
