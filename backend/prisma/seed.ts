import { PrismaClient, Rol } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const adminPassword = await bcrypt.hash('admin123', 10)
  const supervisorPassword = await bcrypt.hash('supervisor123', 10)

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@konecta.com' },
    update: {},
    create: {
      nombre: 'Administrador Konecta',
      email: 'admin@konecta.com',
      password_hash: adminPassword,
      rol: Rol.ADMINISTRADOR,
      activo: true,
    },
  })
  console.log(`✅ Admin: ${admin.email}`)

  const supSoporte = await prisma.usuario.upsert({
    where: { email: 'supervisor.soporte@konecta.com' },
    update: {},
    create: {
      nombre: 'Supervisor Soporte Técnico',
      email: 'supervisor.soporte@konecta.com',
      password_hash: supervisorPassword,
      rol: Rol.USUARIO,
      activo: true,
    },
  })

  const supVentas = await prisma.usuario.upsert({
    where: { email: 'supervisor.ventas@konecta.com' },
    update: {},
    create: {
      nombre: 'Supervisor Ventas',
      email: 'supervisor.ventas@konecta.com',
      password_hash: supervisorPassword,
      rol: Rol.USUARIO,
      activo: true,
    },
  })
  console.log(`✅ Supervisores creados`)

  const serviciosData = [
    { nombre: 'Soporte Técnico', descripcion: 'Soporte técnico a clientes', color: '#3B82F6' },
    { nombre: 'Ventas', descripcion: 'Ventas y comercialización', color: '#10B981' },
    { nombre: 'Retención', descripcion: 'Retención de clientes', color: '#F59E0B' },
    { nombre: 'Atención al Cliente', descripcion: 'Atención general al cliente', color: '#6366F1' },
    { nombre: 'Backoffice', descripcion: 'Operaciones de back office', color: '#8B5CF6' },
    { nombre: 'Cobranzas', descripcion: 'Gestión de cobranzas', color: '#EF4444' },
    { nombre: 'Soporte Conectividad', descripcion: 'Soporte técnico de conectividad', color: '#0EA5E9' },
    { nombre: 'Soporte Entretenimiento', descripcion: 'Soporte de entretenimiento', color: '#F97316' },
  ]

  const servicios: any[] = []
  for (const s of serviciosData) {
    const servicio = await prisma.servicio.upsert({
      where: { nombre: s.nombre },
      update: {},
      create: s,
    })
    servicios.push(servicio)
  }
  console.log(`✅ ${servicios.length} servicios creados`)

  const [soporteTecnico, ventas] = servicios

  await prisma.usuarioServicioPermiso.upsert({
    where: { usuario_id_servicio_id: { usuario_id: supSoporte.id, servicio_id: soporteTecnico.id } },
    update: {},
    create: {
      usuario_id: supSoporte.id,
      servicio_id: soporteTecnico.id,
      puede_ver: true,
      puede_usar_filtros: true,
      puede_editar_nomina_mes_corriente: true,
      puede_ver_nominas_historicas: true,
      puede_editar_nominas_historicas: false,
      puede_cargar_excel: false,
      puede_exportar: true,
      puede_exportar_nominas_historicas: false,
      puede_registrar_licencia: true,
      puede_registrar_cambio_servicio: false,
      puede_crear_agente: false,
      puede_desactivar_agente: false,
      puede_comparar_nominas_mensuales: true,
      campos_editables: ['HORARIOS', 'ESTADO', 'MODALIDAD', 'SUPERIOR', 'SEGMENTO'],
    },
  })

  await prisma.usuarioServicioPermiso.upsert({
    where: { usuario_id_servicio_id: { usuario_id: supSoporte.id, servicio_id: ventas.id } },
    update: {},
    create: {
      usuario_id: supSoporte.id,
      servicio_id: ventas.id,
      puede_ver: true,
      puede_usar_filtros: true,
      puede_editar_nomina_mes_corriente: false,
      puede_ver_nominas_historicas: true,
      puede_editar_nominas_historicas: false,
      puede_cargar_excel: false,
      puede_exportar: false,
      puede_exportar_nominas_historicas: false,
      puede_registrar_licencia: false,
      puede_registrar_cambio_servicio: false,
      puede_crear_agente: false,
      puede_desactivar_agente: false,
      puede_comparar_nominas_mensuales: false,
      campos_editables: [],
    },
  })

  await prisma.usuarioServicioPermiso.upsert({
    where: { usuario_id_servicio_id: { usuario_id: supVentas.id, servicio_id: ventas.id } },
    update: {},
    create: {
      usuario_id: supVentas.id,
      servicio_id: ventas.id,
      puede_ver: true,
      puede_usar_filtros: true,
      puede_editar_nomina_mes_corriente: true,
      puede_ver_nominas_historicas: true,
      puede_editar_nominas_historicas: false,
      puede_cargar_excel: false,
      puede_exportar: true,
      puede_exportar_nominas_historicas: false,
      puede_registrar_licencia: true,
      puede_registrar_cambio_servicio: false,
      puede_crear_agente: false,
      puede_desactivar_agente: false,
      puede_comparar_nominas_mensuales: true,
      campos_editables: ['HORARIOS', 'ESTADO', 'MODALIDAD', 'SUPERIOR', 'SEGMENTO'],
    },
  })

  console.log('✅ Permisos asignados')
  console.log('\n🎉 Seed completado')
  console.log('---')
  console.log('👤 Admin:      admin@konecta.com / admin123')
  console.log('👤 Supervisor: supervisor.soporte@konecta.com / supervisor123')
  console.log('👤 Supervisor: supervisor.ventas@konecta.com / supervisor123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
