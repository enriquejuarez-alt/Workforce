"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  // null = unknown (SSR / first paint), true = embedded, false = standalone
  const [embedded, setEmbedded] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      // cross-origin iframe blocks access to window.top
      setEmbedded(true);
    }
  }, []);

  // While detecting, render invisible to avoid flash
  if (embedded === null) {
    return <div className="opacity-0 pointer-events-none">{children}</div>;
  }

  if (embedded) {
    return (
      <main className="min-h-screen bg-[#F8F9FA]">
        {children}
      </main>
    );
  }

  return (
    <>
      <Sidebar />
      <Header />
      <main className="ml-56 pt-14 min-h-screen">{children}</main>
    </>
  );
}
