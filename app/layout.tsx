import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Planificador — Konecta Soporte",
  description: "Planificador de dotación para equipos de soporte",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full bg-[#F8F9FA] text-gray-800 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
