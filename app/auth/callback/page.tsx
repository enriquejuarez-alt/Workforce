"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const ERROR_MESSAGES: Record<string, string> = {
  google_cancelled:    "Cancelaste el inicio de sesión con Google.",
  google_token_failed: "No se pudo obtener acceso de Google. Intentá de nuevo.",
  google_no_email:     "Tu cuenta de Google no tiene email verificado.",
  google_server_error: "Error en el servidor al procesar el login.",
  user_not_found:      "Tu cuenta no tiene acceso al sistema. Contactá al administrador.",
  user_inactive:       "Tu usuario está desactivado. Contactá al administrador.",
  unknown:             "Ocurrió un error inesperado.",
};

type Stage = "loading" | "welcome";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [stage, setStage] = useState<Stage>("loading");
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    const code  = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      const msg = encodeURIComponent(ERROR_MESSAGES[error ?? "unknown"] ?? ERROR_MESSAGES.unknown);
      router.replace(`/login?oauth_error=${msg}`);
      return;
    }

    // Canjear el código efímero por el JWT real (el token nunca estuvo en la URL)
    fetch("/api/auth/exchange", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then(({ token }: { token: string }) => {
        localStorage.setItem("token", token);
        return authApi.me().then((res) => {
          setAuth(res.data, token);
          const name = (res.data.nombre ?? "").split(" ")[0];
          setFirstName(name);
          setStage("welcome");
          setTimeout(() => router.replace("/planificacion"), 2200);
        });
      })
      .catch(() => {
        localStorage.removeItem("token");
        router.replace("/login?oauth_error=" + encodeURIComponent(ERROR_MESSAGES.unknown));
      });
  }, [searchParams, router, setAuth]);

  if (stage === "welcome") {
    return (
      <div
        className="min-h-screen flex items-center justify-center overflow-hidden"
        style={{ background: "linear-gradient(150deg, #020818 0%, #050f24 40%, #071530 100%)" }}
      >
        <style>{`
          @keyframes starDrift {
            from { background-position: 0 0, 40px 70px, 0 0; }
            to { background-position: 240px -160px, -120px 220px, 0 0; }
          }
          @keyframes welcomeIn {
            0% { opacity: 0; transform: translateY(16px) scale(0.97); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes checkPop {
            0% { opacity: 0; transform: scale(0.5); }
            60% { transform: scale(1.15); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes ringPulse {
            0% { opacity: 0.8; transform: scale(1); }
            100% { opacity: 0; transform: scale(1.9); }
          }
          @keyframes beamSweep {
            0%, 100% { transform: translateX(-12%) rotate(-9deg); opacity: 0.10; }
            50% { transform: translateX(12%) rotate(-9deg); opacity: 0.22; }
          }
          .welcome-card { animation: welcomeIn 0.5s cubic-bezier(0.22,1,0.36,1) both; }
          .check-pop { animation: checkPop 0.55s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
          .ring-pulse { animation: ringPulse 1.4s ease-out 0.2s infinite; }
          .welcome-stars {
            background-image:
              radial-gradient(circle, rgba(255,255,255,0.18) 0 1px, transparent 1px),
              radial-gradient(circle, rgba(96,165,250,0.18) 0 1px, transparent 1px);
            background-size: 120px 120px, 180px 180px;
            animation: starDrift 28s linear infinite;
          }
          .welcome-beam {
            animation: beamSweep 16s ease-in-out infinite;
            background: linear-gradient(90deg, transparent, rgba(56,189,248,0.14), rgba(129,140,248,0.08), transparent);
          }
        `}</style>

        <div className="welcome-stars fixed inset-0 opacity-60 pointer-events-none" />
        <div className="welcome-beam fixed left-[-20%] top-[22%] h-40 w-[140%] blur-2xl pointer-events-none" />
        <div
          className="fixed left-1/2 top-1/2 h-[480px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px] pointer-events-none opacity-50"
          style={{ background: "radial-gradient(ellipse, rgba(0,84,166,0.40), rgba(79,70,229,0.14) 50%, transparent 75%)" }}
        />

        <div className="welcome-card relative z-10 flex flex-col items-center gap-6 text-center px-6">
          {/* Check icon with ring */}
          <div className="relative flex items-center justify-center">
            <div className="ring-pulse absolute h-24 w-24 rounded-full bg-emerald-400/20" />
            <div className="check-pop flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/30">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" strokeWidth={1.5} />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-1.5">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">Walt · Konecta</p>
            <h1 className="text-3xl font-black text-white tracking-tight">
              {firstName ? `Bienvenido, ${firstName}` : "Bienvenido"}
            </h1>
            <p className="text-white/35 text-sm">Tu sesión está lista. Ingresando al sistema…</p>
          </div>

          {/* Loading dots */}
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-blue-400/60"
                style={{ animation: `pulse 1.1s ease-in-out ${i * 0.18}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "linear-gradient(150deg, #020818 0%, #050f24 40%, #071530 100%)" }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
        <p className="text-sm text-white/40 font-medium">Verificando tu cuenta de Google…</p>
      </div>
    </div>
  );
}

const authCallbackFallback = (
  <div
    className="min-h-screen flex items-center justify-center"
    style={{ background: "linear-gradient(150deg, #020818 0%, #050f24 40%, #071530 100%)" }}
  >
    <div className="flex flex-col items-center gap-4 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
      <p className="text-sm text-white/40 font-medium">Verificando tu cuenta de Google…</p>
    </div>
  </div>
);

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={authCallbackFallback}>
      <AuthCallbackInner />
    </Suspense>
  );
}
