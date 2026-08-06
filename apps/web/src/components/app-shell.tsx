"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./footer";
import { Header } from "./header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (
    pathname === "/login" ||
    pathname === "/admin/login" ||
    pathname === "/complete-profile"
  )
    return <>{children}</>;
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
