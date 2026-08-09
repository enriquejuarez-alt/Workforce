"use client";

import { create } from "zustand";
import type { ModoReductor } from "@/lib/domain/types";

const DB_NAME = "plani-uploads";
const DB_VERSION = 1;
const STORE_NAME = "files";
const META_KEY = "__meta";

interface UploadsState {
  archivoCP: File | null;
  archivoReductores: File | null;
  archivoNomina: File | null;
  hojaNomina: string | null;
  hojasNomina: string[];
  modoReductor: ModoReductor;
  topeFacturacion: number;

  setArchivoCP: (f: File | null) => void;
  setArchivoReductores: (f: File | null) => void;
  setArchivoNomina: (f: File | null, hojas: string[]) => void;
  setHojaNomina: (h: string) => void;
  setModoReductor: (m: ModoReductor) => void;
  setTopeFacturacion: (v: number) => void;
  reset: () => void;

  todosSubidos: () => boolean;
}

interface StoredFile {
  name: string;
  type: string;
  lastModified: number;
  buffer: ArrayBuffer;
}

interface StoredMeta {
  hojaNomina: string | null;
  hojasNomina: string[];
  modoReductor: ModoReductor;
  topeFacturacion: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function idbClear(): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function saveFile(key: string, file: File | null): Promise<StoredFile | null> {
  if (!file) {
    await idbDelete(key);
    return null;
  }
  const stored: StoredFile = {
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    buffer: await file.arrayBuffer(),
  };
  await idbSet(key, stored);
  return stored;
}

function toFile(stored: StoredFile | null): File | null {
  if (!stored) return null;
  return new File([stored.buffer], stored.name, {
    type: stored.type,
    lastModified: stored.lastModified,
  });
}

function saveMeta(state: Pick<UploadsState, "hojaNomina" | "hojasNomina" | "modoReductor" | "topeFacturacion">) {
  void idbSet(META_KEY, {
    hojaNomina: state.hojaNomina,
    hojasNomina: state.hojasNomina,
    modoReductor: state.modoReductor,
    topeFacturacion: state.topeFacturacion,
  } satisfies StoredMeta);
}

export const useUploads = create<UploadsState>((set, get) => ({
  archivoCP: null,
  archivoReductores: null,
  archivoNomina: null,
  hojaNomina: null,
  hojasNomina: [],
  modoReductor: "multiplicativo",
  topeFacturacion: 103,

  setArchivoCP: (f) => {
    set({ archivoCP: f });
    // Tras el primer read (para persistir en IndexedDB), reemplazamos el File
    // original (atado al disco) por uno reconstruido en memoria desde el
    // buffer ya leido. Evita releer el File original al Procesar — si el
    // archivo original quedo inaccesible mientras tanto (ej: OneDrive lo
    // "deshidrato" a solo-nube), un segundo read tira NotReadableError.
    void saveFile("archivoCP", f).then((stored) => {
      if (stored && get().archivoCP === f) set({ archivoCP: toFile(stored) });
    });
  },
  setArchivoReductores: (f) => {
    set({ archivoReductores: f });
    void saveFile("archivoReductores", f).then((stored) => {
      if (stored && get().archivoReductores === f) set({ archivoReductores: toFile(stored) });
    });
  },
  setArchivoNomina: (f, hojas) => {
    set({
      archivoNomina: f,
      hojasNomina: hojas,
      hojaNomina: hojas[0] ?? null,
    });
    void saveFile("archivoNomina", f).then((stored) => {
      if (stored && get().archivoNomina === f) set({ archivoNomina: toFile(stored) });
    });
    saveMeta(get());
  },
  setHojaNomina: (h) => {
    set({ hojaNomina: h });
    saveMeta(get());
  },
  setModoReductor: (m) => {
    set({ modoReductor: m });
    saveMeta(get());
  },
  setTopeFacturacion: (v) => {
    set({ topeFacturacion: v });
    saveMeta(get());
  },

  reset: () => {
    set({
      archivoCP: null,
      archivoReductores: null,
      archivoNomina: null,
      hojaNomina: null,
      hojasNomina: [],
      modoReductor: "multiplicativo",
      topeFacturacion: 103,
    });
    void idbClear();
  },

  todosSubidos: () => {
    const { archivoCP, archivoReductores, archivoNomina, hojaNomina } = get();
    return !!(archivoCP && archivoReductores && archivoNomina && hojaNomina);
  },
}));

if (typeof window !== "undefined") {
  void (async () => {
    try {
      const [archivoCP, archivoReductores, archivoNomina, meta] = await Promise.all([
        idbGet<StoredFile>("archivoCP"),
        idbGet<StoredFile>("archivoReductores"),
        idbGet<StoredFile>("archivoNomina"),
        idbGet<StoredMeta>(META_KEY),
      ]);

      useUploads.setState({
        archivoCP: toFile(archivoCP),
        archivoReductores: toFile(archivoReductores),
        archivoNomina: toFile(archivoNomina),
        hojaNomina: meta?.hojaNomina ?? null,
        hojasNomina: meta?.hojasNomina ?? [],
        modoReductor: meta?.modoReductor ?? "multiplicativo",
        topeFacturacion: meta?.topeFacturacion ?? 103,
      });
    } catch {
      // Si IndexedDB falla, la app sigue funcionando con estado en memoria.
    }
  })();
}
