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
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  const allowed = useMemo(() => {
    if (!user) return false;
    return canAccess(user.rol, pathname);
  }, [pathname, user]);

  // El store arranca sin sesion (igual en server y en el primer render del
  // cliente) para evitar mismatch de hidratacion; recien aca se lee
  // localStorage y se actualiza el estado real.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    if (!allowed) {
      router.replace("/acceso-denegado");
    }
  }, [allowed, hydrated, isAuthenticated, router, user]);

  if (!hydrated || !isAuthenticated || !user || !allowed) return <PageLoading />;

  return <>{children}</>;
}
