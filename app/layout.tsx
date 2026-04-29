import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

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
        <Sidebar />
        <Header />
        <main className="ml-56 pt-14 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
