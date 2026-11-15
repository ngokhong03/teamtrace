import type { Store } from "@/lib/types";
import { createFileStore } from "./file";
import { createSupabaseStore } from "./supabase";

let instance: Store | null = null;

/**
 * - Có SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  -> dùng Supabase (bắt buộc khi deploy)
 * - Không có (chạy local)                         -> dùng file JSON trong .data/
 */
export function getStore(): Store {
  if (instance) return instance;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    instance = createSupabaseStore(url, key);
  } else if (process.env.VERCEL) {
    throw new Error(
      "Chưa cấu hình Supabase: hãy thêm SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY vào Environment Variables của Vercel rồi Redeploy."
    );
  } else {
    instance = createFileStore();
  }
  return instance;
}

export function storeMode(): "supabase" | "file" {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "file";
}
