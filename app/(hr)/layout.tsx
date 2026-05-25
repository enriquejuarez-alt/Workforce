"use client";

import HrSidebar from "@/components/hr/Sidebar";
import RouteGuard from "@/components/hr/RouteGuard";
import { useSidebarStore } from "@/store/sidebar";

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarStore();
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
