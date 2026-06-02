import { FileSpreadsheet } from "lucide-react";

interface FilePreviewProps {
  nombre: string;
  tamanio: number;
  hojas?: string[];
  filas?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePreview({ nombre, tamanio, hojas, filas }: FilePreviewProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
        <FileSpreadsheet className="h-3.5 w-3.5 text-[#0054A6]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-800">{nombre}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {formatBytes(tamanio)}
          {filas !== undefined && ` · ${filas} filas`}
          {hojas && hojas.length > 0 && ` · ${hojas.length} hoja${hojas.length > 1 ? "s" : ""}`}
        </p>
        {hojas && hojas.length > 1 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {hojas.map((h) => (
              <span key={h} className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                {h}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
