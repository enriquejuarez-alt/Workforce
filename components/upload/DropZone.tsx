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
        "group rounded-xl border-2 border-dashed transition-all cursor-pointer select-none",
        dragging
          ? "border-[#0054A6] bg-blue-50"
          : hasFile
          ? "border-green-300 bg-green-50/60"
          : error
          ? "border-red-300 bg-red-50"
          : "border-gray-200 hover:border-[#0054A6]/40 bg-gray-50/50 hover:bg-blue-50/20"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !loading && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept={accepted} className="hidden" onChange={onInputChange} />

      <div className="flex flex-col items-center justify-center gap-2.5 p-5 text-center">
        {loading ? (
          <div className="h-8 w-8 rounded-full border-2 border-[#0054A6]/30 border-t-[#0054A6] animate-spin" />
        ) : hasFile ? (
          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
            <FileCheck className="h-[18px] w-[18px] text-green-600" />
          </div>
        ) : error ? (
          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-[18px] w-[18px] text-red-500" />
          </div>
        ) : (
          <div className="h-8 w-8 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center group-hover:border-[#0054A6]/30 group-hover:bg-blue-50 transition-all">
            <UploadCloud className="h-4 w-4 text-gray-400 group-hover:text-[#0054A6] transition-colors" />
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-700">{label}</p>
          {sublabel && <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{sublabel}</p>}
          {fileName && <p className="text-[11px] text-[#0054A6] mt-0.5 font-mono truncate max-w-[160px]">{fileName}</p>}
        </div>

        {error && <p className="text-xs text-red-500 max-w-[200px] leading-relaxed">{error}</p>}

        {!hasFile && !error && !loading && (
          <p className="text-[11px] text-gray-400">Arrastrá o hacé clic</p>
        )}
      </div>
    </div>
  );
}
