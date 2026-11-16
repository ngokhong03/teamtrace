import type { NewActivity, Store } from "./types";

/**
 * Ghi một dòng lịch sử hoạt động. Không làm hỏng thao tác chính nếu ghi lịch sử lỗi.
 * Lưu ý ẩn danh: KHÔNG bao giờ ghi sự kiện nộp đánh giá chéo.
 */
export async function record(store: Store, a: NewActivity) {
  try {
    await store.addActivity(a);
  } catch (e) {
    console.error("[activity] không ghi được lịch sử:", e);
  }
}
