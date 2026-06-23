import Link from "next/link";

export default function NotFound() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-4xl font-black text-gray-300">404</span>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Página no encontrada
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          La página que buscás no existe o fue movida. Verificá la URL o volvé
          al inicio.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
