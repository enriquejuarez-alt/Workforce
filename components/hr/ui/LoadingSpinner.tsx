interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullPage?: boolean
}

const SIZE_MAP = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-2', lg: 'w-12 h-12 border-3' }

export default function LoadingSpinner({ size = 'md', text, fullPage = false }: LoadingSpinnerProps) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className={`${SIZE_MAP[size]} rounded-full border-gray-200 border-t-konecta animate-spin`} />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  )

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }
  return spinner
}

export function PageLoading({ text = 'Cargando...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-24">
      <LoadingSpinner size="lg" text={text} />
    </div>
  )
}
