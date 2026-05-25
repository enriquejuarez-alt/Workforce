import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Konecta — Gestión de Nómina",
  description: "Gestión de nómina y planificación de dotación para equipos de soporte",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full bg-[#F8F9FA] text-gray-800 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
