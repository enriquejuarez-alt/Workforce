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
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 flex gap-2.5 items-start">
      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
        <FileSpreadsheet className="h-3.5 w-3.5 text-[#0054A6]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-700 truncate">{nombre}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {formatBytes(tamanio)}
          {filas !== undefined && ` · ${filas} filas`}
          {hojas && hojas.length > 0 && ` · ${hojas.length} hoja${hojas.length > 1 ? "s" : ""}`}
        </p>
        {hojas && hojas.length > 1 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {hojas.map((h) => (
              <span key={h} className="text-[10px] bg-gray-50 text-gray-500 rounded px-1.5 py-0.5 border border-gray-200">
                {h}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
