import { Response } from 'express'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

const ROLES_VALIDOS = ['ADMINISTRADOR', 'WORKFORCE', 'USUARIO', 'LIDER', 'CAPACITADOR'] as const

const createUserSchema = z.object({
  nombre:   z.string({ error: 'El nombre es requerido' }).min(2, 'El nombre debe tener al menos 2 caracteres').max(100).trim(),
  email:    z.string({ error: 'El email es requerido' }).email('Email inválido').max(254).toLowerCase(),
  password: z.string({ error: 'La contraseña es requerida' }).min(8, 'La contraseña debe tener al menos 8 caracteres').max(128),
  rol:      z.enum(ROLES_VALIDOS).optional(),
})

const updateUserSchema = z.object({
  nombre:   z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100).trim().optional(),
  email:    z.string().email('Email inválido').max(254).toLowerCase().optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(128).optional(),
  rol:      z.enum(ROLES_VALIDOS).optional(),
})

export const listUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.usuario.findMany({
      select: {
        id: true, nombre: true, email: true, rol: true, activo: true,
        fecha_creacion: true, ultimo_acceso: true,
        permisos: { include: { servicio: true } },
      },
      orderBy: { nombre: 'asc' },
    })
    return res.json(users)
  } catch {
    return res.status(500).json({ error: 'Error al listar usuarios' })
  }
}

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const { nombre, email, password, rol } = parsed.data

    const existing = await prisma.usuario.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'El email ya está en uso' })

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.usuario.create({
      data: { nombre, email, password_hash: hash, rol: rol ?? 'USUARIO' },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CREAR_USUARIO',
      entidad: 'Usuario',
      entidad_id: String(user.id),
      valor_nuevo: email,
    })

    const { password_hash, ...safe } = user
    return res.status(201).json(safe)
  } catch {
    return res.status(500).json({ error: 'Error al crear usuario' })
  }
}

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (!id || id < 1) return res.status(400).json({ error: 'ID de usuario inválido' })

    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const { nombre, email, password, rol } = parsed.data

    const existing = await prisma.usuario.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' })

    const data: Record<string, unknown> = {}
    if (nombre) data.nombre = nombre
    if (email && email !== existing.email) {
      const dup = await prisma.usuario.findUnique({ where: { email } })
      if (dup) return res.status(409).json({ error: 'El email ya está en uso' })
      data.email = email
    }
    if (password) data.password_hash = await bcrypt.hash(password, 10)
    if (rol) data.rol = rol

    const user = await prisma.usuario.update({ where: { id }, data })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'EDITAR_USUARIO',
      entidad: 'Usuario',
      entidad_id: String(id),
    })

    const { password_hash, ...safe } = user
    return res.json(safe)
  } catch {
    return res.status(500).json({ error: 'Error al actualizar usuario' })
  }
}

export const toggleUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const user = await prisma.usuario.findUnique({ where: { id } })
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const updated = await prisma.usuario.update({
      where: { id },
      data: { activo: !user.activo },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: updated.activo ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO',
      entidad: 'Usuario',
      entidad_id: String(id),
    })

    return res.json({ activo: updated.activo })
  } catch {
    return res.status(500).json({ error: 'Error al cambiar estado' })
  }
}

export const getUserPermissions = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const permisos = await prisma.usuarioServicioPermiso.findMany({
      where: { usuario_id: id },
      include: { servicio: true },
    })
    return res.json(permisos)
  } catch {
    return res.status(500).json({ error: 'Error al obtener permisos' })
  }
}

export const setUserPermission = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id)
    const servicioId = parseInt(req.params.servicioId)
    const permisoData = req.body

    const permiso = await prisma.usuarioServicioPermiso.upsert({
      where: { usuario_id_servicio_id: { usuario_id: userId, servicio_id: servicioId } },
      update: { ...permisoData, actualizado_por: req.user!.userId },
      create: { usuario_id: userId, servicio_id: servicioId, ...permisoData, actualizado_por: req.user!.userId },
      include: { servicio: true },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CAMBIO_PERMISOS',
      entidad: 'UsuarioServicioPermiso',
      entidad_id: String(permiso.id),
      servicio_id: servicioId,
      valor_nuevo: JSON.stringify(permisoData),
    })

    return res.json(permiso)
  } catch {
    return res.status(500).json({ error: 'Error al guardar permisos' })
  }
}

export const getUserSecciones = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const record = await prisma.usuarioSeccion.findUnique({ where: { usuario_id: id } })
    return res.json(record ? record.paths : null)
  } catch {
    return res.status(500).json({ error: 'Error al obtener secciones' })
  }
}

export const setUserSecciones = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { paths } = req.body
    if (!Array.isArray(paths)) return res.status(400).json({ error: 'paths debe ser un array' })
    await prisma.usuarioSeccion.upsert({
      where: { usuario_id: id },
      update: { paths },
      create: { usuario_id: id, paths },
    })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al guardar secciones' })
  }
}

export const deleteUserSecciones = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.usuarioSeccion.deleteMany({ where: { usuario_id: id } })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al restablecer secciones' })
  }
}

export const deleteUserPermission = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id)
    const servicioId = parseInt(req.params.servicioId)

    await prisma.usuarioServicioPermiso.deleteMany({
      where: { usuario_id: userId, servicio_id: servicioId },
    })

    return res.json({ message: 'Permiso eliminado' })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar permiso' })
  }
}
