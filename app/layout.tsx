import type { Metadata, Viewport } from "next";
import { LazyMotion, domMax } from "framer-motion";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { LanguageProvider } from "@/lib/i18n";

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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "No Face",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e293b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <LanguageProvider>
          <LazyMotion features={domMax} strict>
            {children}
          </LazyMotion>
          <ServiceWorkerRegistration />
        </LanguageProvider>
      </body>
    </html>
  );
}
