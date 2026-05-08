import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'warning'
  loading?: boolean
}

export default function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = 'Confirmar', variant = 'warning', loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-4 items-start">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          variant === 'danger' ? 'bg-red-100' : 'bg-yellow-100'
        }`}>
          <AlertTriangle size={20} className={variant === 'danger' ? 'text-red-600' : 'text-yellow-600'} />
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
      </div>
    </Modal>
  )
}
