# Warframe Void Fissure - LFG Platform

## Objetivo del Proyecto
Plataforma web especializada para que jugadores de Warframe coordinen,
publiquen y se inscriban en misiones de Fisura del Vacío (Void Fissures)
para abrir Reliquias. Busca eliminar las ineficiencias del chat de
reclutamiento in-game, agregando:

- Sistema de publicación de squads con filtros por era y reliquia.
- Verificación de Radshare (4 radiantes iguales).
- Sistema de reputación entre jugadores.
- Historial de runs completados.
- Sincronización en tiempo real del estado de grupos.
- Sistema de reportes y baneos para mantener la calidad de la comunidad.

---

## Stack Tecnológico Propuesto

| Capa | Tecnología | Justificación |
|---|---|---|
| **Frontend** | React 19 + TypeScript + Vite | Ecosistema maduro, tipado fuerte, virtual DOM para listas en tiempo real. Bundle pequeño para deploys rápidos |
| **Estado / Tiempo Real** | Socket.io (WebSocket) | Necesitamos actualizaciones en vivo de lobbies, joins, leaves, confirms. Polling HTTP no sirve para esto |
| **Backend** | Node.js (Fastify) + TypeScript | Mismo lenguaje que frontend, event-driven nativo ideal para WebSockets. Fastify es más performante que Express y pesa menos |
| **Base de datos principal** | PostgreSQL (neon.tech free tier) | Datos relacionales bien definidos. Neon ofrece PostgreSQL serverless con 500MB gratis, ideal para arrancar |
| **Cache / Estado efímero** | Redis (Upstash free tier) | Almacenamiento de sesiones, presencia online/offline, colas de matchmaking, rate limiting. Upstash da 256MB gratis con API REST |
| **ORM** | Prisma 6 | Modelado declarativo, migrations automáticas, type-safety con TypeScript, funciona perfecto con Neon |
| **Autenticación** | JWT + Discord OAuth | Discord es la red social principal de la comunidad Warframe. OAuth gratuito y sin costos |
| **Despliegue Frontend** | Cloudflare Pages o Vercel free tier | Builds gratuitos, CDN global, dominio custom gratis |
| **Despliegue Backend** | Railway o Fly.io free tier | Railway da $5 de crédito mensual sin tarjeta. Fly.io tiene 3 apps gratuitas con recursos limitados |
| **Contenedores** | Docker | Para desarrollo local y despliegue consistente |

**Consideraciones de free tier:**
- Neon (PostgreSQL serverless): 500MB storage, 100h de compute mensual. Para un MVP con pocos usuarios sobra.
- Upstash (Redis): 256MB, 10k comandos/día. Para sesiones y lobbies activos es suficiente.
- Railway: $5 de crédito gratis (no expira). Alcanza para 1 servicio backend con 512MB RAM.
- Cloudflare Pages: ancho de banda ilimitado, builds ilimitados. 0 drama.
- Si escalamos, migramos a instancias pagas sin cambiar código (todo está containerizado).

**Por qué no X:**
- No MongoDB: las relaciones entre Usuario <-> Lobby <-> Run son estrictamente relacionales. Un document store nos haría llorar con joins manuales.
- No Firebase: vendor lock-in, costos impredecibles que explotan al escalar, y control limitado sobre la lógica de matchmaking en tiempo real.
- No GraphQL: en este dominio las queries son bastante planas (listar lobbies, crear lobby, unirse). REST + WebSocket es más simple y predecible.

---

## Modelo de Datos Inicial

```prisma
// ============================================
// ENUMS
// ============================================

enum RelicEra {
  Lith
  Meso
  Neo
  Axi
  Requiem
}

enum Refinement {
  Intact
  Exceptional
  Flawless
  Radiant
}

enum LobbyStatus {
  OPEN
  CONFIRMING
  IN_PROGRESS
  CLOSED
  CANCELLED
}

enum MissionType {
  Capture
  Exterminate
  Rescue
  Spy
  Sabotage
  Defense
  Survival
  Interception
  Excavation
  Disruption
  VoidFlood
  VoidCascade
  VoidArmageddon
}

enum Platform {
  PC
  PS4
  PS5
  XB1
  XSX
  SWITCH
}

enum ReportReason {
  LEECHING         // No llevó la reliquia acordada
  ABANDON          // Se fue del squad sin aviso
  TOXICITY         // Comportamiento tóxico en chat
  SCAM             // Estafa o promesa falsa de radshare
  MULTI_ACCOUNT    // Misma persona en múltiples cuentas para llenar squad
  OTHER
}

enum ReportStatus {
  PENDING
  DISMISSED
  ACTION_TAKEN
}

// ============================================
// MODELS
// ============================================

model User {
  id            String         @id @default(cuid())
  discordId     String?        @unique
  username      String         @unique
  platform      Platform       @default(PC)
  masteryRank   Int            @default(0)
  reputation    Int            @default(0)
  isBanned      Boolean        @default(false)
  banReason     String?
  bannedUntil   DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  hosts              Lobby[]              @relation("Host")
  participants       LobbyParticipant[]
  runsCompleted      Run[]
  reportsMade        Report[]             @relation("Reporter")
  reportsReceived    Report[]             @relation("ReportedUser")
  bans               Ban[]                @relation("BannedByUser")
  banAppeals         BanAppeal[]

  @@index([discordId])
  @@index([username])
}

model Relic {
  id        String     @id @default(cuid())
  era       RelicEra
  name      String     // ej: "A5", "B6", "C1"
  // Nota: no almacenamos refinement aquí porque la reliquia como
  // objeto tiene un refinement, pero la "receta" es la misma.
  // El refinement lo maneja LobbyParticipant.

  @@unique([era, name])
  @@index([era])
}

model Lobby {
  id            String       @id @default(cuid())
  title         String       // Título visible, ej: "NEO A5 Rad | Capture"
  status        LobbyStatus  @default(OPEN)
  missionType   MissionType  @default(Capture)
  squadSize     Int          @default(4)
  isRadshare    Boolean      @default(false)
  relicEra      RelicEra
  relicName     String?      // null si es casual (solo era)
  refinement    Refinement?  // null si es casual
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  hostId       String
  host         User              @relation("Host", fields: [hostId], references: [id])
  participants LobbyParticipant[]

  @@index([status])
  @@index([relicEra])
  @@index([missionType])
  @@index([createdAt])
}

model LobbyParticipant {
  id            String      @id @default(cuid())
  joinedAt      DateTime    @default(now())
  confirmed     Boolean     @default(false) // confirmó tener la reliquia?
  ready         Boolean     @default(false) // listo para arrancar?
  refinement    Refinement? // con qué refinement entró realmente

  userId  String
  user    User    @relation(fields: [userId], references: [id])
  lobbyId String
  lobby   Lobby   @relation(fields: [lobbyId], references: [id])

  @@unique([userId, lobbyId])
  @@index([lobbyId])
}

model Run {
  id          String    @id @default(cuid())
  completed   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  completedAt DateTime?

  lobbyId String?
  lobby   Lobby?  @relation(fields: [lobbyId], references: [id])
  userId  String
  user    User    @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([lobbyId])
}

// ============================================
// REPORTES Y BANEOS
// ============================================

model Report {
  id          String       @id @default(cuid())
  reason      ReportReason
  description String?      // Texto libre adicional
  createdAt   DateTime     @default(now())
  status      ReportStatus @default(PENDING)
  resolvedAt  DateTime?

  reporterId   String
  reporter     User   @relation("Reporter", fields: [reporterId], references: [id])
  reportedId   String
  reportedUser User   @relation("ReportedUser", fields: [reportedId], references: [id])
  lobbyId      String?
  lobby        Lobby? @relation(fields: [lobbyId], references: [id])
  runId        String?
  run          Run?   @relation(fields: [runId], references: [id])

  @@index([reportedId])
  @@index([status])
}

model Ban {
  id          String    @id @default(cuid())
  reason      String    // Motivo del ban
  isPermanent Boolean   @default(false)
  expiresAt   DateTime? // null si es permanente
  createdAt   DateTime  @default(now())

  userId     String
  user       User   @relation("BannedByUser", fields: [userId], references: [id])
  bannedById String
  bannedBy   User   @relation(fields: [bannedById], references: [id])
  reportId   String?
  report     Report? @relation(fields: [reportId], references: [id])
}

model BanAppeal {
  id          String   @id @default(cuid())
  message     String   // Texto del apelante
  status      String   @default("PENDING") // PENDING, APPROVED, DENIED
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?

  userId String
  user   User   @relation(fields: [userId], references: [id])
  banId  String
  ban    Ban    @relation(fields: [banId], references: [id])

  @@unique([userId, banId])
}
```

---

## Roadmap de Desarrollo

### Hito 0 - Fundación (Sprints 1-2)
- [x] Inicializar monorepo (npm workspaces)
- [x] Configurar React + Vite + TypeScript + TailwindCSS en `packages/web`
- [x] Configurar Fastify + Prisma + Neon PostgreSQL + Upstash Redis en `packages/api`
- [x] Configurar Socket.io en frontend y backend
- [x] Dockerizar entornos dev
- [x] Scripts de CI básico (lint + typecheck)
- [ ] Deploy inicial a Cloudflare Pages + Railway (free tier) — *pendiente de API keys*
- [ ] Discord OAuth en producción (registrar app en Discord Developers)

### Hito 1 - MVP (Sprints 3-5)
- [x] Migraciones de Prisma + seed de datos (307 reliquias reales)
- [x] API REST: CRUD de lobbies + endpoints de reliquias y usuarios
- [x] WebSocket: eventos de lobby (created, updated, joined, left)
- [x] Frontend: Listado de lobbies con filtros (era, misión, estado)
- [x] Frontend: Creación de lobby (modal funcional con selector de reliquias desde API)
- [x] Frontend: Unirse / salir de lobby
- [x] Frontend: Vista de detalle del lobby con info de participantes
- [x] Flujo completo: crear -> unirse -> estado -> completar (con auto-registro de Runs)
- [x] Registro de runs al completar misión
- [x] Radshare: confirmación de reliquias y ready check con countdown

### Hito 2 - Radshare & Ready Check (Sprints 5)
- [x] Lógica de Radshare: validación de 4 reliquias idénticas radiant
- [x] Confirmación individual de reliquia por participante
- [x] Ready check con countdown (30s)
- [x] Server-authoritative: el backend valida que todos confirmaron antes de liberar

### Hito 3 - Autenticación (Sprint 6)
- [x] Discord OAuth login (con dev login mode)
- [x] JWT stateless sessions
- [x] Perfil de jugador desde token (/auth/me)
- [x] AuthContext en frontend + login button + sesión persistente

### Hito 4 - Reputación, Reportes & Baneos (Sprint 7)
- [x] Sistema de reputación post-run (+1 por run completado, -1 por reporte confirmado)
- [x] Reportes post-run (6 razones: leeching, abandono, toxicidad, etc.)
- [x] Panel de administración de reportes (ver, resolver, banear)
- [x] Sistema de baneos (temporales/permanentes) con apelaciones
- [x] Kick de jugadores del lobby por el host
- [x] Usuario baneado no puede crear ni unirse a lobbies

### Hito 5 - Calidad de Vida (Sprints 9-13)
- [x] Staggered runs: plan de 4 rotaciones con tracking de host y auto-advance
- [x] Estadísticas personales: perfil de jugador con stats, streaks, charts y runs history
- [x] Notificaciones in-app en tiempo real via WebSocket
- [x] Ready check timeout fix (30s timer server-authoritative)
- [x] Notification events global emit (io.emit para eventos del lobby)
- [x] Panel de Administración (admin role, reports/bans/appeals management)
- [x] User Settings (platform, masteryRank, language switcher)
- [x] Búsqueda avanzada de lobbies (texto libre en filtros combinados)
- [x] Soporte multi-idioma (i18n, ES + EN con switcher en settings)

### Hito 6 - Administración y Usuario (Sprints 12-13)
- [x] `isAdmin` field en User + `requireAdmin` decorator en rutas
- [x] Admin API endpoints: check, reports list, bans CRUD, ban-appeals resolve
- [x] AdminPanel frontend: 3 tabs (reports/bans/appeals) con filtros y acciones
- [x] User Settings: PATCH /api/users/settings (platform + masteryRank)
- [x] UserSettings modal: platform dropdown, MR input, language toggle ES/EN
- [x] Settings navigation: gear icon en header + gear icon en perfil propio

---

## Decisiones Arquitectónicas Clave

1. **Server-authoritative**: Toda la lógica de validación de radshare, ready check y finalización de run corre en el backend. El frontend solo muestra datos.
2. **Lobbies efímeros**: Los lobbies activos se cachean en Redis con TTL (ej: 30 min sin actividad = auto-cancel). PostgreSQL es el source of truth final.
3. **WebSocket como canal principal**: Para listado de lobbies y actualizaciones, el frontend se suscribe a un room global y rooms por era. No hay polling.
4. **Rate limiting**: Endpoints sensibles (crear lobby, confirmar radshare) tienen rate limiting por usuario via Redis para evitar spam/abuso.
5. **Free-tier friendly**: Neon (DB serverless), Upstash (Redis serverless), Railway (backend), Cloudflare Pages (frontend). Todo tiene tiers gratuitos viables para un MVP.

---

## Estado Actual
**Fase**: 6 - Sprint 13 - User Settings (COMPLETADA ✅)
**Última acción**: Sprint 13 completado:
- **PATCH /api/users/settings**: endpoint protegido que acepta `platform` y `masteryRank` con validación. Devuelve 401 sin auth, 400 si datos inválidos.
- **UserSettings.tsx**: modal con selector de plataforma (PC/PS4/PS5/XB1/XSX/SWITCH), input de Maestría (0-30), language switcher ES/EN, info de cuenta. Botón Guardar actualiza vía API + AuthContext.updateUser.
- **Navegación**: gear icon en header visible siempre que hay sesión. gear icon en perfil solo cuando es el propio perfil.
- **Language Switcher**: toggle ES/EN dentro de settings, cambia i18n al instante y persiste en localStorage.
- **Traducciones**: claves `settings.*` agregadas en ES y EN.

**Historial de Sprints previos:**
- **Sprint 12 (Admin Panel)**: `isAdmin` field en User, `requireAdmin` decorator, rutas `/api/admin/*`, AdminPanel frontend con 3 tabs (reports/bans/appeals), botón Admin en header condicional a `user.isAdmin`.
- **Sprint 11 (Notificaciones)**: NotificationContext, NotificationBell, auto-toast, socket como state para provider.
- **Sprint 10 (Perfil)**: `GET /api/users/:username/profile` con stats agregadas, streaks, runs paginados. PlayerProfile con charts CSS.
- **Sprint 9 (Rotaciones)**: RotationGroup model, start-rotation, auto-advance en CLOSED con host rotativo.
- **Fixes**: Ready check timeout server-side (30s), notificaciones globales via io.emit.

**Siguiente paso**: Deploy a producción (Railway + Cloudflare Pages).

---

## Notas Técnicas Complementarias
- Toda la lógica de radshare debe ser server-authoritative. El frontend jamás decide si un run es válido.
- El estado de lobbies activos vive en Redis con TTL para limpieza automática.
- Las misiones de Captura y Exterminio son las más demandadas por su rapidez; la UI debe priorizarlas.
- Staggered runs: implementado con RotationGroup, auto-creación de siguiente ronda al hacer CLOSED, host rotado secuencialmente entre participantes.
- Los reportes requieren un lobby o run asociado para contexto (evitar reportes fantasmas).
- El sistema de apelaciones permite al usuario apelar UN ban por ban (unique constraint en BanAppeal).
- Perfil de jugador: `GET /api/users/:username/profile` devuelve stats agregadas (runsByEra, runsByMission, topRelic, streaks). El frontend muestra gráficos de barras CSS y cards de stats.
- Runs paginados: `GET /api/users/:username/runs?page=1&limit=20` con `hasMore` para paginación infinita.
- Notificaciones in-app: sistema basado en eventos WebSocket. NotificationProvider escucha `lobby:participant-joined`, `lobby:participant-left`, `lobby:participant-confirmed`, `lobby:participant-ready`, `lobby:status-changed`, `lobby:rotation-advanced` y genera notificaciones con badge + dropdown. Eventos emitidos globalmente para que el provider los reciba sin necesidad de estar en el room del lobby.
- Ready check timeout: 30s via `setTimeout` map en memoria (se pierde al reiniciar server, se recupera en el próximo WS event). Lógica en `startReadyCheckTimeout` / `cancelReadyCheckTimeout` en lobbies.ts.
- Admin role: `isAdmin` boolean en User (no tabla separada). JWT incluye `isAdmin`. Dev-login y Discord OAuth retornan `isAdmin`. Para promover: `UPDATE "User" SET "isAdmin" = true WHERE username = '...';`.
- `requireAdmin`: decorator de Fastify que verifica JWT + `isAdmin: true`. Retorna 401 sin token, 403 si no admin. Usado como `preHandler` en todas las rutas de admin y moderación.
- AdminPanel frontend: modal con 3 tabs. Reports list con acciones (dismiss/ban 3d). Bans list + create-ban form inline. Appeals list con approve (auto-unban) / deny.
- User Settings: `PATCH /api/users/settings` protegido con `authenticate`. Valida Platform enum y masteryRank 0-30. Retorna `{ user }` actualizado.
- Language preference: manejado 100% en frontend via i18next + localStorage. No se persiste en DB.
- PLATFORMS importado desde `@warframe/shared` tanto en backend como frontend para consistencia.
- Build monorepo: `npm run build` (shared→api). Web build separado con `cd packages/web && npm run build`.
- Login sin contraseña (dev-login): Endpoint `POST /api/auth/dev-login` que busca o crea usuario por username. Solo para desarrollo. En producción se usa Discord OAuth.

## Deployments & URLs
- **Backend (Railway)**: `https://warframeweb-production.up.railway.app`
- **Frontend (Cloudflare Pages)**: `https://warframeweb.pages.dev`
- **API Base**: Se resuelve en RUNTIME (no build-time) via `window.location.hostname`:
  - `localhost` o `127.0.0.1` → `/api` (proxy Vite)
  - Cualquier otro dominio → `https://warframeweb-production.up.railway.app/api`
- **WebSocket**: Misma lógica, apunta a Railway en producción

## Despliegue (producción)
### Backend - Railway
- **Estrategia**: Dockerfile en raíz del repo. Railway forzado a usar Docker via `railway.json`:
  ```json
  { "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" } }
  ```
- **Dockerfile**: Build de `shared` + `api` con `npx tsc -b`. Antes de `npm ci`, filtra `web` del workspace list para evitar errores de workspace faltante.
- **Puerto**: Railway asigna `PORT` automáticamente (usar el que asigna, no hardcodear).
- **Env vars requeridas**:
  - `DATABASE_URL` — PostgreSQL (Neon)
  - `JWT_SECRET` — para firmar tokens
  - `CORS_ORIGIN` — `http://localhost:5173,https://*.warframeweb.pages.dev`
  - `FRONTEND_URL` — para redirect de Discord OAuth
- **CORS**: Implementado con wildcard via regex. Permite cualquier subdominio `*.warframeweb.pages.dev`.

### Frontend - Cloudflare Pages
- **Build**: Cloudflare Pages corre `npm run build` desde la raíz (build shared + api). Luego Vite build del web por separado.
- **Build output**: `packages/web/dist/`.
- **NO necesita env vars**: La URL del backend se resuelve en runtime. No más `VITE_API_URL`.
- **Proxy dev**: Vite proxy `/api` y `/socket.io` a `localhost:3001`.

### Discord OAuth
- **Producción**: Registrar app en https://discord.com/developers/applications
- **Redirect URI**: `https://midominio.railway.app/api/auth/discord/callback`
- **Env vars**: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `FRONTEND_URL`

## Errores comunes y soluciones
| Error | Causa | Solución |
|-------|-------|----------|
| `405 Method Not Allowed` al hacer login | Frontend apunta a Cloudflare Pages en vez de Railway | Verificar `resolveBaseUrl()` en `client.ts`, `AuthContext.tsx`, `useSocket.ts` |
| `No workspaces found: --workspace=@warframe/web` | Railway/Nixpacks escanea workspaces y no encuentra web | Usar Dockerfile + filtrar web del workspace antes de `npm ci` |
| `ERR_MODULE_NOT_FOUND: @warframe/shared/src/index.ts` | `shared/package.json` exporta `.ts` en vez de `.js` | Usar conditional exports: `module` → `.ts` (Vite), `import` → `.js` (Node.js) |
| `Could not load --schema from provided path` | Ruta relativa a `cwd`, y Railway corre desde `packages/api/` | Usar `import.meta.url` para resolver ruta absoluta al schema |
