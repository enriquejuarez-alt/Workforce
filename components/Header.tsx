"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useUploads } from "@/store/useUploads";
import { useResultados } from "@/store/useResultados";
import { useSimulador } from "@/store/useSimulador";

export function Header() {
  const { modoReductor, setModoReductor, reset: resetUploads } = useUploads();
  const { resultado, reset: resetResultados } = useResultados();
  const { resetAjustes } = useSimulador();

  const handleReset = () => {
    resetUploads();
    resetResultados();
    resetAjustes();
  };

  const esMultiplicativo = modoReductor === "multiplicativo";

  return (
    <header className="fixed top-0 left-56 right-0 z-40 h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-gray-800">
          Sistema de Cumplimiento de Dotación
        </h1>
        {resultado && (
          <span className="text-xs text-gray-500 border border-gray-200 rounded-md px-2 py-0.5 bg-gray-50">
            {resultado.mes}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Aditivo</span>
          <Switch
            checked={esMultiplicativo}
            onCheckedChange={(v) =>
              setModoReductor(v ? "multiplicativo" : "aditivo")
            }
          />
          <span className={esMultiplicativo ? "text-gray-800 font-medium" : ""}>
            Multiplicativo
          </span>
        </div>

        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </header>
  );
}
