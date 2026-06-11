# Template Fullstack :3

Template fullstack listo para producción: **React 19 + Vite 7 + Tailwind v4 + shadcn/ui** en el frontend, **NestJS 11 + TypeORM + PostgreSQL 16** en el backend, todo en un **monorepo pnpm** con schemas Zod compartidos y deploy pensado para Coolify.

> **Regla de oro:** `synchronize: false` siempre. El esquema de la base de datos cambia **solo con migraciones**.

---

## 🚀 Crear un proyecto nuevo

```bash
# 1. Crea tu repo desde el template
gh repo create mi-proyecto --template HeyArnoldo/mayordomoai --private --clone
cd mi-proyecto

# 2. Inicialízalo (renombra todo y se autoelimina)
node scripts/init.mjs mi-proyecto          # mantiene el CRUD demo de notas
node scripts/init.mjs mi-proyecto --clean  # sin demo: solo auth + estructura

# 3. Configura el entorno
cp .env.example .env                       # ajusta JWT_SECRET y ADMIN_*

# 4. Levanta todo
pnpm install
pnpm --filter @app/contracts build   # la API importa @app/contracts: sin esto fallan las migraciones
pnpm db:up              # postgres en docker
pnpm migration:run      # aplica las migraciones
pnpm seed               # crea el admin inicial (idempotente)
pnpm dev                # api en :3000, web en :5173
```

Abre **http://localhost:5173** y entra con el `ADMIN_EMAIL` / `ADMIN_PASSWORD` de tu `.env`.

---

## 📦 Estructura

```
├── apps/
│   ├── api/          # NestJS 11 · TypeORM · auth JWT en cookie httpOnly
│   └── web/          # React 19 · Vite 7 · Tailwind v4 · shadcn · TanStack Query
├── packages/
│   ├── contracts/    # Schemas Zod compartidos (única fuente de verdad api ↔ web)
│   └── tsconfig/     # Config TypeScript base
├── docker-compose.yml        # Postgres para desarrollo (+ adminer con --profile tools)
├── docker-compose.prod.yml   # Stack completo para probar los Dockerfiles en local
└── scripts/init.mjs          # Inicializador (se autoelimina)
```

**¿Por qué `packages/contracts`?** El mismo schema Zod valida el body en la API (`ZodValidationPipe`) y el formulario en el frontend (`zodResolver`). Cambias el contrato en un solo lugar y ambos lados se actualizan — con build dual CJS+ESM para que la API (CommonJS) y Vite (ESM) lo consuman sin fricción.

---

## 🛠 Scripts (desde la raíz)

| Comando                                                  | Qué hace                                             |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                                               | API + web + contracts en watch, en paralelo          |
| `pnpm dev:api` / `pnpm dev:web`                          | Solo una app                                         |
| `pnpm build`                                             | Build de todo (contracts → api → web, en orden)      |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`             | Calidad en todos los workspaces                      |
| `pnpm db:up` / `pnpm db:down`                            | Postgres en Docker                                   |
| `pnpm migration:generate src/database/migrations/Nombre` | Genera migración desde los cambios en entities       |
| `pnpm migration:run` / `pnpm migration:revert`           | Aplica / revierte migraciones                        |
| `pnpm seed`                                              | Admin inicial (idempotente, seguro en cada arranque) |

---

## 🔐 Auth: un template, dos modos (sin tocar código)

La auth se controla **100% con variables de entorno**. El frontend consulta `GET /api/auth/config` y renderiza el login según lo que esté activo.

### Modo 1 — Email + password (default)

```env
AUTH_LOCAL_ENABLED=true
ADMIN_EMAIL=admin@miapp.com
ADMIN_PASSWORD=UnPasswordFuerte!
```

El seed crea el admin local. Los usuarios se registran en `/register`.

### Modo 2 — Solo Google

```env
AUTH_LOCAL_ENABLED=false
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=https://api.midominio.com/api/auth/google/callback
ADMIN_EMAIL=admin@miapp.com   # whitelist: recibe rol admin en su primer login
```

Sin `ADMIN_PASSWORD`, el seed no crea usuario: `ADMIN_EMAIL` actúa como whitelist y ese correo se vuelve admin al entrar con Google. Las rutas de login/register local devuelven 404.

### Modo 3 — Ambos

Define todo lo anterior con `AUTH_LOCAL_ENABLED=true`. El login muestra formulario **y** botón de Google. Si un usuario local entra luego con Google (mismo email), las cuentas se vinculan solas.

**Detalles de implementación:** el JWT viaja en una cookie `httpOnly` (`app_session`) — inmune a XSS, el frontend nunca toca el token. `GoogleStrategy` solo se registra en Nest si hay credenciales (instanciarla vacía rompe passport). CORS exige orígenes exactos porque `credentials: true`.

---

## 🗃 Base de datos: migraciones SIEMPRE

```bash
# 1. Edita o crea un *.entity.ts
# 2. Genera la migración (compara entities vs DB real)
pnpm migration:generate src/database/migrations/AgregaCampoX
# 3. Revisa el SQL generado (¡siempre!)
# 4. Aplícala
pnpm migration:run
```

- `synchronize: false` está fijo en `apps/api/src/config/typeorm.config.ts`. **No lo cambies**: pierde datos en producción y rompe el flujo de migraciones.
- En producción, `docker-entrypoint.sh` corre `migration:run` + seed **antes** de arrancar la API: un deploy nuevo siempre tiene el esquema al día.
- Adminer (UI de la DB): `docker compose --profile tools up -d` → http://localhost:8081

---

## 🧩 Agregar una feature (receta)

El CRUD demo de **notas** es la referencia copiable end-to-end:

1. **Contrato** — `packages/contracts/src/mi-feature.ts`: schemas Zod + tipos, exporta en `index.ts`.
2. **API** — `apps/api/src/mi-feature/`: `*.entity.ts`, `*.service.ts`, `*.controller.ts` (con `ZodValidationPipe` + `JwtAuthGuard`), `*.module.ts` registrado en `app.module.ts`. Genera y corre la migración.
3. **Web** — `apps/web/src/`: service en `services/`, hooks TanStack Query en `hooks/`, página en `pages/`, ruta en `router.tsx`.

Componentes shadcn nuevos: `cd apps/web && pnpm dlx shadcn@latest add <componente>`.

---

## 🚢 Deploy en Coolify

Cada app se despliega como recurso independiente usando su Dockerfile (**build context = raíz del repo**):

|             | API                        | Web                   |
| ----------- | -------------------------- | --------------------- |
| Dockerfile  | `apps/api/Dockerfile`      | `apps/web/Dockerfile` |
| Puerto      | 3000                       | 80                    |
| Healthcheck | `/health` (ya configurado) | `/` (ya configurado)  |

**API — variables de entorno en Coolify** (ejemplo completo, ajusta dominios y secretos):

```env
NODE_ENV=production

# Base de datos — si Coolify te da una URL postgres://USER:PASSWORD@HOST:PORT/DBNAME,
# mapea cada parte a su variable:
DB_HOST=mi-postgres-interno
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=el-password-de-la-url
DB_NAME=postgres

CORS_ORIGIN=https://app.midominio.com
FRONTEND_URL=https://app.midominio.com

AUTH_LOCAL_ENABLED=true
JWT_SECRET=<openssl rand -base64 32>
JWT_EXPIRES_IN=7d

COOKIE_SECURE=true
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=.midominio.com   # solo si api y web comparten dominio raíz

ADMIN_EMAIL=admin@midominio.com
ADMIN_PASSWORD=UnPasswordFuerte!
ADMIN_NAME=Admin
```

> `API_PORT` **no se define**: el default es 3000 y el healthcheck del Dockerfile está fijado a ese puerto — cambiarlo haría fallar el healthcheck.

**Web — build arg** (no es variable de runtime: queda horneada en el bundle al compilar):

```env
VITE_API_URL=https://api.midominio.com
```

**Cookies entre dominios:**

| Caso                                      | Config                                                    |
| ----------------------------------------- | --------------------------------------------------------- |
| `app.midominio.com` + `api.midominio.com` | `COOKIE_DOMAIN=.midominio.com` y `COOKIE_SAMESITE=lax`    |
| Dominios distintos                        | `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` obligatorio |

La API ya setea `trust proxy` (necesario para cookies `secure` detrás de Traefik).

**Probar los Dockerfiles en local** antes de subir:

```bash
docker compose -f docker-compose.prod.yml up -d --build
# api → http://localhost:3000/health · web → http://localhost:8090
docker compose -f docker-compose.prod.yml down
```

---

## ✅ Calidad incluida

- **Husky + lint-staged**: prettier automático en cada commit.
- **commitlint**: mensajes en formato [conventional commits](https://www.conventionalcommits.org/es) (`feat: ...`, `fix: ...`) — un commit mal formado no entra.
- **GitHub Actions** (`.github/workflows/ci.yml`): lint → typecheck → build → test en cada push/PR.
- **TypeScript estricto** en todo el monorepo (base compartida en `packages/tsconfig`).

---

## ⚙️ Variables de entorno

Un **solo `.env` en la raíz** alimenta docker-compose, la API y el frontend (Vite lee `VITE_*` vía `envDir`). Todas documentadas en [`.env.example`](.env.example). La API valida el entorno con Zod al arrancar: si falta algo requerido, **no levanta** (mejor fallar temprano que en runtime).

## 📌 Decisiones técnicas (para no pelearse con ellas)

- **pnpm 11 pineado** (`packageManager` + corepack). `pnpm-workspace.yaml` declara `allowBuilds` — sin eso pnpm bloquea los postinstall nativos (esbuild, tailwind oxide).
- **API en CommonJS** (no NodeNext): imports sin sufijo `.js` y la CLI `typeorm-ts-node-commonjs` funciona sin hacks.
- **bcryptjs** (JS puro): cero bindings nativos en Alpine/CI.
- **Cliente axios con guarda anti-HTML**: si la API no responde y vuelve el index.html del dev server, lo convierte en error visible en vez de datos corruptos.
- Código e identificadores en **inglés**, comentarios y docs en **español**.
