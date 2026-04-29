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
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex gap-3 items-start">
      <FileSpreadsheet className="h-4 w-4 text-[#0054A6] shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-700 truncate">{nombre}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatBytes(tamanio)}
          {filas !== undefined && ` · ${filas} filas`}
        </p>
        {hojas && hojas.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {hojas.map((h) => (
              <span key={h} className="text-xs bg-white text-gray-500 rounded px-1.5 py-0.5 border border-gray-200">
                {h}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
