import prisma from '../prisma'

interface AuditParams {
  usuario_id?: number
  accion: string
  entidad?: string
  entidad_id?: string
  servicio_id?: number
  nomina_mensual_id?: number
  agente_id?: number
  campo_modificado?: string
  valor_anterior?: string
  valor_nuevo?: string
  ip?: string
  user_agent?: string
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditoria.create({ data: params })
  } catch (err) {
    console.error('Audit log error:', err)
  }
}

export function auditChanges(
  original: Record<string, any>,
  updated: Record<string, any>,
  allowedFields: string[]
): Array<{ campo: string; anterior: string; nuevo: string }> {
  const changes: Array<{ campo: string; anterior: string; nuevo: string }> = []
  for (const field of allowedFields) {
    if (original[field] !== updated[field]) {
      changes.push({
        campo: field,
        anterior: String(original[field] ?? ''),
        nuevo: String(updated[field] ?? ''),
      })
    }
  }
  return changes
}
