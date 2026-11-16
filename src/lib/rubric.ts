/**
 * Bảng tiêu chí đánh giá của trưởng nhóm – theo mẫu sheet "Team leader's assessment" của nhóm.
 * Muốn đổi câu chữ cho khớp đúng sheet gốc: sửa trực tiếp các mô tả dưới đây (không cần đổi database).
 */
export const LEVELS = [4, 3, 2, 1] as const;
export const LEVEL_LABELS: Record<number, string> = {
  4: "Xuất sắc",
  3: "Tốt",
  2: "Chấp nhận",
  1: "Cần cải thiện",
};

export interface Criterion {
  key: string;
  label: string;
  levels: Record<number, string>;
}

export const LEADER_RUBRIC: Criterion[] = [
  {
    key: "contribution",
    label: "Sự đóng góp vào kết quả công việc",
    levels: {
      4: "Thường xuyên đưa ra ý tưởng hữu ích khi thảo luận; hoàn thành phần việc với chất lượng cao, chủ động giải quyết vấn đề phát sinh.",
      3: "Thường đưa ra ý tưởng hữu ích; hoàn thành tốt phần việc được giao.",
      2: "Thỉnh thoảng có đóng góp ý tưởng; hoàn thành phần việc ở mức cơ bản, cần nhắc nhở.",
      1: "Hiếm khi đóng góp ý tưởng; phần việc chưa hoàn thành hoặc chất lượng thấp.",
    },
  },
  {
    key: "attitude",
    label: "Thái độ làm việc",
    levels: {
      4: "Luôn tích cực, có trách nhiệm, chủ động nhận việc và đúng hạn.",
      3: "Thường tích cực và có trách nhiệm với nhiệm vụ.",
      2: "Thỉnh thoảng thiếu chủ động, đôi khi trễ hạn.",
      1: "Hiếm khi tích cực, thường trễ hạn hoặc bỏ việc.",
    },
  },
  {
    key: "collaboration",
    label: "Sự phối hợp làm việc với các thành viên khác",
    levels: {
      4: "Luôn lắng nghe, chia sẻ và hỗ trợ người khác; giúp nhóm làm việc ăn ý.",
      3: "Thường lắng nghe, chia sẻ và hỗ trợ người khác.",
      2: "Thỉnh thoảng lắng nghe, chia sẻ; ít hỗ trợ người khác.",
      1: "Hiếm khi lắng nghe, chia sẻ hay hỗ trợ người khác.",
    },
  },
];

/** Điểm trung bình 1..4 (chỉ tính tiêu chí đã chấm) */
export function rubricAverage(scores: Record<string, number>): number {
  const vals = LEADER_RUBRIC.map((c) => scores[c.key]).filter((v): v is number => typeof v === "number");
  return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : 0;
}
