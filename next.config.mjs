/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Không cho trang khác nhúng TeamTrace vào iframe (chống clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Không gửi đường dẫn đầy đủ (có mã nhóm) sang trang khác khi bấm link ngoài
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
