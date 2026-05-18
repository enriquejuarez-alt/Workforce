"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UploadCloud,
  LayoutDashboard,
  TrendingUp,
  Sliders,
  CalendarOff,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/", label: "Carga de archivos", icon: UploadCloud },
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/curvas", label: "Curvas", icon: TrendingUp },
  { href: "/simulador", label: "Simulador", icon: Sliders },
  { href: "/franco", label: "Franco", icon: CalendarOff },
  { href: "/configuracion", label: "Configuración", icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-56 flex flex-col" style={{ backgroundColor: '#001E50' }}>
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#0054A6' }}>
            <span className="text-white font-black text-sm">K</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Konecta</p>
            <p className="text-xs" style={{ color: '#95B8D8' }}>Planificación HC</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: 'rgba(149,184,216,0.5)' }}>
          Módulos
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                active
                  ? "text-white"
                  : "hover:text-white"
              )}
              style={
                active
                  ? { backgroundColor: '#0054A6' }
                  : undefined
              }
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = '#003070';
              }}
              onMouseLeave={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = '';
              }}
            >
              <Icon
                className="h-4 w-4 shrink-0"
                style={{ color: active ? 'white' : '#95B8D8' }}
              />
              <span style={{ color: active ? 'white' : '#95B8D8' }}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/10">
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(149,184,216,0.5)' }}>
          Soporte · Konecta AR
        </p>
      </div>
    </aside>
  );
}
