import type { Metadata, Viewport } from "next";
import { LazyMotion, domMax } from "framer-motion";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

// Runs synchronously before first paint so the correct theme class is set
// before hydration — avoids a flash of the wrong theme. Mirrors the
// resolution logic in lib/theme.tsx (explicit localStorage choice, else OS
// preference).
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('no-face-theme');
    var isDark = stored === 'dark' || (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;

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
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <LazyMotion features={domMax} strict>
              {children}
            </LazyMotion>
            <ServiceWorkerRegistration />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
