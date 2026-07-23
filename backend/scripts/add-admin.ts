import { PrismaClient, Rol } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash(Math.random().toString(36), 10)

  const user = await prisma.usuario.upsert({
    where: { email: 'enrique.juarez@konecta.com' },
    update: { rol: Rol.ADMINISTRADOR, activo: true },
    create: {
      nombre: 'Enrique Juarez',
      email: 'enrique.juarez@konecta.com',
      password_hash: hash,
      rol: Rol.ADMINISTRADOR,
      activo: true,
    },
  })

  console.log(`✅ Admin creado/actualizado: ${user.email} (rol: ${user.rol})`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
