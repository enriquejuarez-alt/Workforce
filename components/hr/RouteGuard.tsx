"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageLoading } from "@/components/hr/ui/LoadingSpinner";
import { useAuthStore } from "@/store/auth";
import { canAccess } from "@/lib/utils/roles";

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const allowed = useMemo(() => {
    if (!user) return false;
    return canAccess(user.rol, pathname);
  }, [pathname, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    if (!allowed) {
      router.replace("/acceso-denegado");
    }
  }, [allowed, isAuthenticated, router, user]);

  if (!isAuthenticated || !user || !allowed) return <PageLoading />;

  return <>{children}</>;
}
