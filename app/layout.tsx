import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "カオナシ No Face - 用 Emoji 隐藏照片里的人脸",
  description: "隐私优先的人脸遮罩工具：用 Emoji 替换照片中的人脸，所有处理都在浏览器本地完成，图片不会上传到任何服务器。",
  openGraph: {
    title: "カオナシ No Face - 用 Emoji 隐藏照片里的人脸",
    description: "隐私优先的人脸遮罩工具，所有处理都在浏览器本地完成。",
    type: "website",
    locale: "zh_CN",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
