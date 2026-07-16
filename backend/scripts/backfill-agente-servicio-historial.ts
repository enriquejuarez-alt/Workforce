import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Backfill de una sola pasada: crea la primera fila de historial de
// servicio (vigente, sin fecha_hasta) para cada agente que ya tiene
// servicio_id pero todavia no tiene ninguna fila en agenteServicioHistorial.
// Usa fecha_creacion del agente como mejor fecha_desde disponible (no hay
// fecha historica real de inicio de servicio antes de este modulo).
// Idempotente: si el agente ya tiene una fila vigente, se salta.
async function main() {
  const adminUser = await prisma.usuario.findFirst({ where: { rol: 'ADMINISTRADOR' }, orderBy: { id: 'asc' } })
  if (!adminUser) {
    console.error('No se encontró ningún usuario ADMINISTRADOR para asignar como creador del backfill.')
    process.exit(1)
  }

  const agentes = await prisma.agente.findMany({ where: { servicio_id: { not: null } } })

  let creados = 0
  let saltados = 0

  for (const agente of agentes) {
    const vigente = await prisma.agenteServicioHistorial.findFirst({
      where: { agente_id: agente.id, fecha_hasta: null },
    })
    if (vigente) {
      saltados++
      continue
    }

    await prisma.agenteServicioHistorial.create({
      data: {
        agente_id: agente.id,
        servicio_id: agente.servicio_id,
        modalidad: agente.modalidad,
        superior: agente.superior,
        jefe: agente.jefe,
        segmento: agente.segmento,
        sitio: agente.sitio,
        contrato: agente.contrato,
        horarios: agente.horarios,
        fecha_desde: agente.fecha_creacion,
        motivo: 'Backfill inicial (historial de agentes)',
        creado_por: adminUser.id,
      },
    })
    creados++
  }

  const sinServicio = await prisma.agente.count({ where: { servicio_id: null } })

  console.log(`Backfill completo.`)
  console.log(`  Agentes con servicio_id: ${agentes.length}`)
  console.log(`  Filas de historial creadas: ${creados}`)
  console.log(`  Agentes ya con historial vigente (saltados): ${saltados}`)
  console.log(`  Agentes sin servicio_id (no procesados): ${sinServicio}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
