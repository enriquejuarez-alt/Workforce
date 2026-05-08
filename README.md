# Nomina Konecta — Sistema de Gestión de Nómina de Call Center

Sistema web profesional para administrar nóminas mensuales de agentes de call center.

## Stack tecnológico

- **Backend**: Node.js + Express + TypeScript + Prisma ORM + PostgreSQL + JWT
- **Frontend**: React + TypeScript + Vite + TailwindCSS + TanStack Table + React Query
- **Excel**: xlsx (parse) + exceljs (export)

---

## Requisitos previos

- Node.js 18+
- PostgreSQL 14+
- npm o pnpm

---

## Instalación

### 1. Clonar y preparar base de datos

Crear una base de datos PostgreSQL:
```sql
CREATE DATABASE nomina_konecta;
```

### 2. Backend

```bash
cd backend
npm install

# Copiar y configurar variables de entorno
cp .env.example .env
# Editar .env con tu DATABASE_URL

# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:push

# Cargar datos iniciales
npm run db:seed

# Iniciar servidor de desarrollo
npm run dev
```

El backend corre en `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El frontend corre en `http://localhost:5173`

---

## Credenciales iniciales

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | admin@konecta.com | admin123 |
| Supervisor Soporte | supervisor.soporte@konecta.com | supervisor123 |
| Supervisor Ventas | supervisor.ventas@konecta.com | supervisor123 |

---

## Variables de entorno — Backend (.env)

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/nomina_konecta"
JWT_SECRET="konecta-nomina-super-secret-key-2024"
JWT_EXPIRES_IN="24h"
PORT=3001
NODE_ENV=development
UPLOADS_DIR="./uploads"
FRONTEND_URL="http://localhost:5173"
```

---

## Funcionalidades implementadas

### Autenticación y permisos
- Login con JWT
- Roles: Administrador y Supervisor
- Permisos granulares por usuario + servicio
- Validación en frontend y backend

### Gestión de servicios
- CRUD completo de servicios
- Color visual por servicio
- Activar/desactivar servicios
- Conteo de agentes y nóminas por servicio

### Nóminas mensuales
- Carga desde Excel (.xlsx / .xls)
- Validación de columnas obligatorias
- Previsualización antes de confirmar
- Snapshot histórico por mes (AgenteNominaMensual)
- Estados: Borrador, Activa, Cerrada, Archivada
- Bloqueo de edición para meses anteriores (usuarios comunes)
- Admin puede editar cualquier nómina

### Tabla de nómina
- Filtros avanzados (búsqueda, estado, modalidad, horario, etc.)
- Paginación configurable
- Ordenamiento por columna
- Indicador Editable / Solo lectura
- Exportación a Excel

### Licencias
- Registro de licencias por agente
- Estados calculados: Vigente, Programada, Finalizada
- Historial de licencias por agente
- Filtrado por estado

### Cambios temporales de servicio
- Registro de cambios temporales
- Historial completo
- Badge visual en tabla de nómina

### Dashboard
- KPIs de agentes y operaciones
- Gráfico de agentes por servicio
- Información de última importación
- Métricas adaptadas al rol del usuario

### Comparación de nóminas
- Comparar dos períodos del mismo servicio
- Agentes nuevos, no presentes y con cambios
- Detalle de campos modificados

### Auditoría
- Registro de todas las acciones importantes
- Filtros por acción, entidad, fecha
- Paginación

---

## Estructura del proyecto

```
Nomina/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma     # Modelos de base de datos
│   │   └── seed.ts           # Datos iniciales
│   └── src/
│       ├── controllers/      # Lógica de negocio
│       ├── middleware/        # Auth, upload
│       ├── routes/            # Definición de endpoints
│       └── utils/             # JWT, audit, permissions
└── frontend/
    └── src/
        ├── components/        # Componentes reutilizables
        │   ├── layout/        # Sidebar, Header, Layout
        │   ├── ui/            # Badge, Modal, KpiCard, etc.
        │   └── agents/        # Modales de agente
        ├── pages/             # Páginas de la aplicación
        ├── lib/               # API calls, axios
        ├── store/             # Estado global (Zustand)
        ├── hooks/             # Hooks personalizados
        └── types/             # TypeScript types
```

---

## API Endpoints principales

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Usuario actual |
| GET | /api/servicios | Listar servicios |
| GET | /api/nominas | Listar nóminas |
| GET | /api/nominas/:id/agentes | Agentes de una nómina |
| PATCH | /api/nominas/agentes/:id | Editar agente en nómina |
| POST | /api/excel/validar | Validar Excel |
| POST | /api/excel/confirmar | Confirmar importación |
| GET | /api/export/nomina/:id | Exportar nómina |
| GET | /api/dashboard | Dashboard data |
| GET | /api/auditoria | Logs de auditoría |

---

## Notas importantes

- Las nóminas históricas no pueden ser editadas por usuarios comunes
- Solo el administrador puede editar nóminas de meses anteriores
- Toda edición queda registrada en la auditoría con valor anterior y nuevo
- Los snapshots mensuales (AgenteNominaMensual) preservan el historial exacto del agente en cada período
- Los permisos se validan tanto en frontend como en backend
