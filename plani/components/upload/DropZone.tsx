"use client";

import { useRef, useState, useCallback } from "react";
import { UploadCloud, FileCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DropZoneProps {
  label: string;
  sublabel?: string;
  step?: number;
  onFile: (file: File, buffer: ArrayBuffer) => void | Promise<void>;
  accepted?: string;
  hasFile?: boolean;
  fileName?: string;
  error?: string;
  loading?: boolean;
}

export function DropZone({
  label,
  sublabel,
  step,
  onFile,
  accepted = ".xlsx",
  hasFile,
  fileName,
  error,
  loading,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      await onFile(file, buffer);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      className={cn(
        "relative group rounded-xl border-2 border-dashed transition-all cursor-pointer select-none",
        dragging
          ? "border-[#0054A6] bg-blue-50"
          : hasFile
          ? "border-green-400 bg-green-50"
          : error
          ? "border-red-300 bg-red-50"
          : "border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept={accepted} className="hidden" onChange={onInputChange} />

      {/* Step badge */}
      {step && (
        <div className={cn(
          "absolute -top-3 -left-3 h-6 w-6 rounded-full border-2 flex items-center justify-center text-[11px] font-bold shadow",
          hasFile
            ? "bg-green-500 border-green-400 text-white"
            : "bg-white border-gray-300 text-gray-500"
        )}>
          {hasFile ? "✓" : step}
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-3 p-7 text-center">
        {loading ? (
          <div className="h-9 w-9 rounded-full border-2 border-[#0054A6]/30 border-t-[#0054A6] animate-spin" />
        ) : hasFile ? (
          <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
            <FileCheck className="h-5 w-5 text-green-600" />
          </div>
        ) : error ? (
          <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
        ) : (
          <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
            <UploadCloud className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          {sublabel && <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{sublabel}</p>}
          {fileName && <p className="text-[11px] text-[#0054A6] mt-1 font-mono truncate max-w-[180px]">{fileName}</p>}
        </div>

        {error && <p className="text-xs text-red-500 max-w-[220px] leading-relaxed">{error}</p>}

        {!hasFile && !error && !loading && (
          <p className="text-[11px] text-gray-400">Arrastrá o hacé clic para seleccionar</p>
        )}
      </div>
    </div>
  );
}
