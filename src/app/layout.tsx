import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "TeamTrace – Làm việc minh bạch, đánh giá công bằng",
  description: "Ghi nhận, phân tích và đánh giá đóng góp thực tế của từng thành viên trong bài tập nhóm.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
