"use client";

import { useEffect } from "react";
import HrSidebar from "@/components/hr/Sidebar";
import RouteGuard from "@/components/hr/RouteGuard";
import { useSidebarStore } from "@/store/sidebar";
import { useAuthStore } from "@/store/auth";
import { useConfigStore } from "@/store/config";
import { configuracionApi, usersApi } from "@/lib/api";

function ConfigLoader() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setRolPaths = useConfigStore((s) => s.setRolPaths);
  const setCurrentUserOverride = useConfigStore((s) => s.setCurrentUserOverride);
  const reset = useConfigStore((s) => s.reset);

  useEffect(() => {
    if (!isAuthenticated || !user) { reset(); return; }
    configuracionApi.getRolConfig()
      .then((r) => setRolPaths(r.data))
      .catch(() => {});
    if (user.rol !== 'ADMINISTRADOR') {
      usersApi.getSecciones(user.id)
        .then((r) => setCurrentUserOverride(r.data))
        .catch(() => {});
    }
  }, [isAuthenticated, user?.id]);

  return null;
}

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarStore();
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <ConfigLoader />
      <RouteGuard>
        <HrSidebar />
        <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-64'}`}>
          <main className="flex-1 overflow-hidden flex flex-col overflow-y-auto">
            {children}
          </main>
        </div>
      </RouteGuard>
    </div>
  );
}
