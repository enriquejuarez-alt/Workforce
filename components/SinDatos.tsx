"use client";

import Link from "next/link";
import { UploadCloud } from "lucide-react";

export function SinDatos() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
        <UploadCloud className="h-6 w-6 text-gray-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700">Sin datos procesados</p>
        <p className="text-xs text-gray-400 mt-1">Cargá los archivos y procesalos para ver esta vista.</p>
      </div>
      <Link
        href="/"
        className="text-xs font-medium text-[#0054A6] hover:underline"
      >
        Ir a carga de archivos
      </Link>
    </div>
  );
}
