"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const ERROR_MESSAGES: Record<string, string> = {
  google_cancelled:    "Cancelaste el inicio de sesión con Google.",
  google_token_failed: "No se pudo obtener acceso de Google. Intentá de nuevo.",
  google_no_email:     "Tu cuenta de Google no tiene email verificado.",
  google_server_error: "Error en el servidor al procesar el login.",
  user_inactive:       "Tu usuario está desactivado. Contactá al administrador.",
  unknown:             "Ocurrió un error inesperado.",
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error || !token) {
      const msg = encodeURIComponent(ERROR_MESSAGES[error ?? "unknown"] ?? ERROR_MESSAGES.unknown);
      router.replace(`/login?oauth_error=${msg}`);
      return;
    }

    // Guardar token temporalmente para que authApi.me() lo use
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token);
    }

    authApi
      .me()
      .then((res) => {
        setAuth(res.data, token);
        router.replace("/dashboard");
      })
      .catch(() => {
        if (typeof window !== "undefined") localStorage.removeItem("token");
        router.replace("/login?oauth_error=" + encodeURIComponent(ERROR_MESSAGES.unknown));
      });
  }, [searchParams, router, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-3">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto" />
        <p className="text-sm text-gray-500 font-medium">Verificando tu cuenta de Google...</p>
      </div>
    </div>
  );
}
