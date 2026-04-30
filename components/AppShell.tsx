"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [embedded, setEmbedded] = useState<boolean | null>(null);

  useEffect(() => {
    // URL param set by Nómina on first load (?embedded=1)
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("embedded") === "1";

    if (fromParam) {
      sessionStorage.setItem("plani_embedded", "1");
    }

    // Persisted across Plani-internal navigation (Link clicks don't carry the param)
    const fromSession = sessionStorage.getItem("plani_embedded") === "1";

    // Native iframe detection as last fallback
    let fromIframe = false;
    try {
      fromIframe = window.self !== window.top;
    } catch {
      fromIframe = true;
    }

    setEmbedded(fromParam || fromSession || fromIframe);
  }, []);

  if (embedded === null) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  if (embedded) {
    return <main className="min-h-screen bg-[#F8F9FA]">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <Header />
      <main className="ml-56 pt-14 min-h-screen">{children}</main>
    </>
  );
}
