/**
 * Bảng tiêu chí đánh giá của trưởng nhóm – theo mẫu sheet "Team leader's assessment" của nhóm.
 * Câu chữ lấy nguyên văn từ sheet gốc. Muốn đổi: sửa trực tiếp các mô tả dưới đây (không cần đổi database).
 * Lưu ý: khoá tiêu chí (key) được lưu trong database, đừng đổi tên key đã dùng.
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
    label: "Sự đóng góp vào bài tập nhóm / công việc",
    levels: {
      4: "Thường xuyên cung cấp các ý tưởng hữu ích khi tham gia vào nhóm và thảo luận trong lớp học. Một nhà lãnh đạo nhóm đóng góp rất nhiều nỗ lực. Chủ động tìm kiếm và đề xuất các giải pháp cho vấn đề.",
      3: "Thường cung cấp các ý tưởng hữu ích khi tham gia vào nhóm và thảo luận trong lớp học. Một thành viên mạnh đã cố gắng hoạt động rất tích cực. Đánh giá và chọn lọc các giải pháp được đề xuất bởi những người khác.",
      2: "Thỉnh thoảng cung cấp các ý tưởng hữu ích khi tham gia vào nhóm và thảo luận trong lớp học. Một thành viên đạt yêu cầu khi hoàn thành những nhiệm vụ được giao. Không đề xuất hoặc đánh giá, chọn lọc các giải pháp, nhưng sẵn sàng trải nghiệm các giải pháp được đề xuất bởi những người khác.",
      1: "Hiếm khi cung cấp các ý tưởng hữu ích khi tham gia vào nhóm và thảo luận trong lớp học. Một thành viên có thể từ chối tham gia hoặc hoàn thành nhiệm vụ được giao. Không cố gắng giải quyết vấn đề hoặc giúp người khác giải quyết vấn đề. Đùn đẩy công việc này cho những người khác.",
    },
  },
  {
    key: "attitude",
    label: "Thái độ làm việc",
    levels: {
      4: "Luôn đưa ra những phản hồi mang tính xây dựng và tích cực đối với sản phẩm hoặc công việc của thành viên khác. Luôn có thái độ tích cực khi nhận nhiệm vụ. Luôn luôn tập trung vào nhiệm vụ và những gì cần phải làm. Có sự tự định hướng rất tốt.",
      3: "Thường đưa ra những phản hồi mang tính xây dựng và tích cực đối với sản phẩm hoặc công việc của thành viên khác. Thường có thái độ tích cực khi nhận nhiệm vụ. Thường tập trung vào nhiệm vụ và những gì cần phải thực hiện. Các thành viên khác trong nhóm có thể tin tưởng vào người này.",
      2: "Thỉnh thoảng đưa ra những phản hồi mang tính xây dựng và tích cực đối với sản phẩm hoặc công việc của thành viên khác. Thường có thái độ tích cực khi nhận nhiệm vụ. Thỉnh thoảng tập trung vào nhiệm vụ và những gì cần phải được thực hiện. Các thành viên nhóm khác đôi khi phải nhắc nhở để cho người này hoàn thành nhiệm vụ.",
      1: "Hiếm khi đưa ra những phản hồi mang tính xây dựng và tích cực đối với sản phẩm hoặc công việc của thành viên khác. Thường có thái độ tiêu cực khi nhận nhiệm vụ. Hiếm khi tập trung vào nhiệm vụ và những gì cần phải làm. Đùn đẩy công việc này cho những người khác.",
    },
  },
  {
    key: "collaboration",
    label: "Sự phối hợp làm việc với các thành viên khác",
    levels: {
      4: "Hầu như luôn lắng nghe, chia sẻ và hỗ trợ người khác. Cố gắng giữ cho mọi người làm việc tốt cùng nhau.",
      3: "Thường lắng nghe, chia sẻ và hỗ trợ người khác. Không tạo ra hiềm khích, mâu thuẫn trong nhóm.",
      2: "Thường lắng nghe, chia sẻ và hỗ trợ người khác. Thỉnh thoảng không phải là thành viên tích cực, cần nhắc nhở gắn kết.",
      1: "Hiếm khi lắng nghe, chia sẻ và hỗ trợ người khác. Thường là một thành viên không hợp tác, gây khó khăn cho nhóm.",
    },
  },
];

/** Điểm trung bình 1..4 (chỉ tính tiêu chí đã chấm) */
export function rubricAverage(scores: Record<string, number>): number {
  const vals = LEADER_RUBRIC.map((c) => scores[c.key]).filter((v): v is number => typeof v === "number");
  return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : 0;
}
