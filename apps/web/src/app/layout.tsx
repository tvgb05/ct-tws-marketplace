import type { Metadata } from "next";
import { Be_Vietnam_Pro, Lora } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const serif = Lora({
  subsets: ["vietnamese", "latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
});

const themeScript = `
  try {
    const saved = localStorage.getItem("tws-theme");
    const theme = saved === "dark" || saved === "light"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = "light";
  }
`;

export const metadata: Metadata = {
  title: "TWS Community Market",
  description: "Chợ mua bán tử tế dành cho cộng đồng TWS",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${sans.variable} ${serif.variable}`}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
