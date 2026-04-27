import { Response } from 'express'
import bcrypt from 'bcrypt'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

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
    const { nombre, email, password, rol } = req.body
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' })
    }

    const existing = await prisma.usuario.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'El email ya está en uso' })

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.usuario.create({
      data: { nombre, email, password_hash: hash, rol: rol || 'USUARIO' },
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
    const { nombre, email, password, rol } = req.body

    const existing = await prisma.usuario.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' })

    const data: any = {}
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
