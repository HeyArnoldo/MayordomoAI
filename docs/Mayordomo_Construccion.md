# Mayordomo — Plan de Construcción sobre template-fullstack

> Une tres piezas: el **design de Claude Design** (UI completa), el **template-fullstack** (base técnica con tus convenciones) y los docs previos (`Mayordomo_Arquitectura.md`, `Mayordomo_Plan.md`).
> Estado: aprobado, **re-priorizado por el hackathon** (ver sección 0). Las etapas 1–6 originales quedan como roadmap post-hackathon.

---

## 0. ⚡ Modo Hackathon — Agents League (submit: 14 jun, 11:59 PM PT)

> Fuente: `Mayordomo_Hackathon.md`. Track: **Reasoning Agents** (el agente DEBE correr sobre Microsoft Foundry / Azure OpenAI). Quedan ~3.5 días. El jurado puntúa: Accuracy 20% · Reasoning multi-step 20% · Reliability & Safety 20% · Creativity 15% · UX/Presentation 15% · Discord 10%.

### 0.1 Cambios de decisión forzados por el hackathon

| #    | Cambio                                                                 | Detalle                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D2′  | **Refresh rotation → diferida a post-hackathon**                       | ✅ Confirmado por usuario (11 jun). Hackathon usa la cookie httpOnly del template (JWT único `app_session`, `JWT_EXPIRES_IN=7d`). La rotación completa (tabla, familias, revocación, reuso) es la primera tarea del backlog post-submit.                                                                                                                                                                     |
| D11  | **Provider IA = Azure OpenAI (Foundry)**                               | Requisito del track, no opcional. AI SDK con `@ai-sdk/azure` en vez de `@ai-sdk/openai` (swap de una línea). Modelos: `gpt-4o-mini` (parseo/fast-path) y `gpt-4o` (agente) desplegados en Foundry con los $100 de Azure for Students. Transcripción: deployment de `gpt-4o-transcribe`/whisper en Azure. Los modelos gpt-5.x del plan original quedan para después.                                          |
| D12′ | **Reproducibilidad para jueces (versión barata, sin mock del agente)** | Decisión usuario (11 jun): el producto real desplegado en `mayordomoai.xyz` + WhatsApp real en video es mejor evidencia que un mock. Se mantiene solo lo barato: seeds con datos del design, `docker compose up` + `.env.example` claro (juez pone su key de Azure), y la app bootea sin credenciales de IA (dashboard/CRUD funcionan; chat pide key con gracia). Se corta el agente determinístico offline. |
| D13  | **Reasoning trail visible**                                            | `audit_tools` se muestra en el dashboard como "historial de razonamiento" paso a paso (patrón Motia-Atlas, puntúa Reasoning 20%). Era Etapa 5 invisible; ahora es feature de UI prioritaria.                                                                                                                                                                                                                 |
| D14  | **Narrativa multi-agente**                                             | README + diagrama presentan el pipeline como 3 agentes especializados (Categorizador / Consultor / Registrador) y patrones nombrados (Planner-Executor, Adaptive clarification loop, Critic/Verifier). Solo naming y docs, no reescribe código.                                                                                                                                                              |

### 0.2 Qué se CORTA del sprint (→ backlog post-hackathon)

Refresh rotation (D2) · verificación de número por código WhatsApp · MinIO/storage de archivos · NotifSheet · vista Empresa · reportes completos (el mini-report del chat basta) · multiusuario/panel admin · backups automatizados · PWA offline. Nada de esto suma puntos en 3 días.

### 0.3 Sprint (11 → 14 jun)

**Día 1 — hoy 11 jun: Cimientos + dominio.**
Bootstrap del template (`--clean`, rename, tokens del design básicos, fonts). Migración: `users` (+estado), `cajas`, `movimientos`, `conversaciones`, `mensajes`, `pendientes`, `audit_tools`, `wa_inbound_log`. Módulos cajas + movimientos (CRUD, saldo por SUM, split snapshot, fecha contable Lima, soft delete). **Seeds = los datos mock del design** (doble uso: dev + modo demo). Tests de dominio mínimos (reparto, saldo). Auth template simple.

**Día 2 — 12 jun: El agente (corazón del puntaje).**
⚠️ **ANTES DE 2 PM Lima: registro en el hackathon + activar perfil por email** (cierra ese día). Deploy de modelos en Foundry. Capa AI con AI SDK + `@ai-sdk/azure`: tools scopeadas a `user_id` (`consultar_movimientos`, `agregar_gastos`, `top_gastos`, `saldo_cajas`, `registrar_movimiento` con confirmación), guardrails (máx 5 iteraciones, input=datos, cero invención), `audit_tools` en cada llamada. Chat web con `useChat` streaming: ChatThread, Composer, ConfirmCard, chips, empty state del design.

**Día 3 — 13 jun: WhatsApp + voz + UI que se ve en el video.**
Webhook Evolution (dedup, `fromMe`, sin cola — síncrono simple, BullMQ es post-hackathon) + `sendText`. Nota de voz → transcripción Azure → mismo pipeline (el "wow" del video). Dashboard del design (hero Disponible, cajas con badges, recientes, RegistroSheet). Reasoning trail en UI. Cierre nocturno simplificado (ingesta con `pendientes`: registra claras, pregunta dudosas en una tanda) — el mejor momento de "reasoning" del demo.

**Día 4 — 14 jun: Submission.**
Deploy a `mayordomoai.xyz` verificado + repo reproducible (`docker compose up` con `.env.example`, bootea sin key de IA). README estructura sección 7.7 del dossier. Diagrama de arquitectura con Foundry explícito. Video ≤5 min: pregunta multi-step visible → cierre nocturno → nota de voz → guardrails en 20s. Discord (presentarse en canal Reasoning Agents). Submit en tab Projects + usernames Microsoft Learn + globalai.community.

### 0.4 Acciones que solo VOS podés hacer (no postergables)

1. **Registro + activación de perfil: antes del 12 jun 2 PM Lima** (mañana).
2. Crear el recurso Azure OpenAI / proyecto Foundry con tu cuenta de estudiante (te paso los nombres de deployments exactos cuando lleguemos).
3. Username de Microsoft Learn + cuenta globalai.community.
4. Discord: unirte y presentarte (10% del puntaje).
5. Grabar el video (yo te armo el guion).

---

## 1. Qué tenemos sobre la mesa

### 1.1 El design (export de Claude Design)

- **UI completa y funcional en JSX**: 40+ componentes, store con reducer, chat engine simulado.
- **Pantallas mobile (11)**: Login, Verify (código WhatsApp), Dashboard, Movimientos, Detalle de caja, Detalle de movimiento, Chat (con drawer de conversaciones), Cajas (editor de %), Reportes, Ajustes, Empresa. Más 2 sheets: RegistroSheet (keypad numérico) y NotifSheet.
- **Pantallas desktop (5)**: Onboarding split-screen, Dashboard (grid 3-col + panel asistente), Movimientos (tabla), Conversaciones (layout 3 zonas con rail fijable/flotante/oculto), Reportes.
- **Sistema de diseño**:
  - Tipografía: **Hanken Grotesk** (UI) + **IBM Plex Mono** (montos, `tabular-nums`).
  - 3 acentos (verde `#0E7A4D`/`#34D399`, teal, indigo) × light/dark.
  - Neutrales light: bg `#F2F5F2`, card `#FFFFFF`, ink `#16211A`, border `#E3E8E3`.
  - Neutrales dark: bg `#0C120F`, card `#141C17`, ink `#EDF3EE`.
  - 8 colores por caja (Ahorro, Varios, Pasajes, Ocio, Diezmo, Snacks, Ofrenda, Empresa), cada uno con par light/dark.
  - 50+ iconos SVG propios (sin librería externa), logo "Mark" (sobre con solapa).
- **Conceptos UX clave**: EnvelopeCard con solapa, badges de alerta (sobregiro/queda poco/agotada), ConfirmCard en chat ("−S/30 en Ocio · Te quedan S/34.34"), VoiceNote con transcript, sesiones de chat estilo ChatGPT con hilo principal de WhatsApp fijado, selector de tono (Neutro/Cercano/Formal).

### 1.2 El template (HeyArnoldo/template-fullstack)

- Monorepo pnpm: `apps/api` (NestJS 11 + TypeORM 0.3 + Postgres 16), `apps/web` (React 19 + Vite 7 + **Tailwind v4** + shadcn + TanStack Query 5 + React Router 7), `packages/contracts` (Zod 4, dual CJS/ESM), `packages/tsconfig`.
- Auth env-driven: Google OAuth y/o email+password, JWT en **cookie httpOnly** (`app_session`), guards por flags, seed idempotente de admin.
- `synchronize: false` + migraciones; ZodValidationPipe; módulo `notes` como patrón CRUD de referencia.
- Dockerfiles multi-stage (api con entrypoint que corre migraciones; web con nginx), docker-compose dev y prod, CI (lint → typecheck → build → test), husky + commitlint convencional.
- Script `node scripts/init.mjs <nombre> --clean` para renombrar y quitar el demo de notes.

### 1.3 Encaje con los docs previos

El plan original (`Mayordomo_Plan.md`) ya define modelo de datos, edge cases y fases. Este documento **no lo reemplaza**: lo aterriza sobre el template y le agrega el scope concreto de frontend que el design definió.

---

## 2. Decisiones de integración (las que importan)

| #   | Tema               | Decisión propuesta                                                                                                                                                                                                                            | Por qué                                                                                                        |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| D1  | **Base del repo**  | Generar desde template (`init.mjs mayordomo --clean`) y traer el contenido a este repo (`MayordomoAI`), conservando `docs/`.                                                                                                                  | Hereda CI, Docker, auth, contracts y convenciones sin retrabajo.                                               |
| D2  | **Sesión**         | ✅ Confirmado: **access token corto (~15 min) + refresh token httpOnly con rotación** desde Etapa 1, como define el plan original. Incluye tabla `refresh_tokens` (hash, familia, revocación, detección de reuso) y endpoint `/auth/refresh`. | Decisión del usuario (2026-06-11). Se extiende el módulo auth del template.                                    |
| D3  | **Allowlist**      | Extender `users` con `estado ('pendiente'                                                                                                                                                                                                     | 'activa'                                                                                                       | 'suspendida')`sobre el patrón ADMIN_EMAIL del template. Guard global: solo`activa` pasa. | El template ya valida ADMIN_EMAIL en seed; solo falta el estado. |
| D4  | **UI kit**         | ✅ Confirmado: primitivos del design como componentes propios en Tailwind v4. shadcn donde ahorre tiempo y sume calidad (Dialog, DropdownMenu, Sheet, Form, Sonner/toasts, Skeleton…).                                                        | Decisión del usuario (2026-06-11). Identidad visual propia + accesibilidad resuelta en overlays.               |
| D5  | **Tokens**         | Mapear la paleta hex del design a CSS variables en `index.css` con `@theme` de Tailwind v4 (light/dark + acento via `data-accent`). Reemplaza los oklch genéricos del template.                                                               | Misma mecánica que el template ya usa; solo cambian los valores.                                               |
| D6  | **Responsive**     | Una sola app responsive. El design muestra frames fijos (402×874 / 1360×860); en real: mobile-first con breakpoint `lg` que cambia TabBar→Sidebar y apila→grid.                                                                               | Dos layouts separados = doble mantenimiento. Los componentes del design ya son compartidos entre ambos frames. |
| D7  | **PWA**            | `vite-plugin-pwa` con manifest + iconos del Mark. Service worker básico (cache estático), sin offline de datos en MVP.                                                                                                                        | Instalable en el celu desde el día 1; offline de datos financieros es un pozo de complejidad.                  |
| D8  | **Mock → real**    | El `store.jsx` del design (reducer + seeds) se descarta: React Query contra la API es la fuente de datos. Los seeds del design sirven como fixture de desarrollo/tests.                                                                       | El design es spec visual, no arquitectura de datos.                                                            |
| D9  | **Estructura web** | Mantener convenciones del template (`pages/`, `hooks/`, `services/`, `lib/`) y agregar `components/mayordomo/` (UI kit) + `features/` por dominio (cajas, movimientos, chat, reportes).                                                       | Sigue el patrón notes pero escala por feature.                                                                 |
| D10 | **Contracts**      | Todo schema de dominio (caja, movimiento, registro, chat) vive en `@app/contracts` (Zod), consumido por API y web.                                                                                                                            | Es la gracia del template: tipo único punta a punta.                                                           |

Lo ya decidido en `Mayordomo_Plan.md` se mantiene: Postgres `numeric(12,2)`, UTC + fecha contable `America/Lima`, soft delete, saldo por `SUM()`, snapshot de split en ingresos, MinIO con presigned URLs, Evolution API, AI SDK con OpenAI.

---

## 3. Estructura objetivo

```
MayordomoAI/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── auth/            (del template + estado de cuenta)
│   │       ├── users/           (del template + numeros vinculados)
│   │       ├── cajas/           (nuevo — patrón notes)
│   │       ├── movimientos/     (nuevo — saldo, split, fecha contable)
│   │       ├── whatsapp/        (nuevo — webhook Evolution + sender)    [Etapa 4]
│   │       ├── storage/         (nuevo — MinIO presigned)               [Etapa 4]
│   │       ├── transcription/   (nuevo — audio → texto)                 [Etapa 4]
│   │       ├── ai/ + agent/     (nuevo — AI SDK, tools, conversaciones) [Etapa 5]
│   │       └── reports/         (nuevo)                                 [Etapa 6]
│   └── web/
│       └── src/
│           ├── components/mayordomo/   (UI kit del design)
│           ├── features/{cajas,movimientos,registro,chat,reportes,ajustes}/
│           ├── pages/ · hooks/ · services/ · lib/   (convención template)
│           └── index.css               (tokens del design, Tailwind v4)
├── packages/contracts/          (+ cajas.ts, movimientos.ts, chat.ts)
└── docs/                        (se conserva, + design de referencia)
```

Infra que se suma al compose: **redis** (Etapa 4, BullMQ), Evolution corre aparte en Coolify (ya existente), MinIO externo (`s3.groowtech.com`, bucket `mayordomo-files`).

---

## 4. Etapas de construcción

> Cada etapa termina con la app corriendo, CI verde y algo usable. Mapeo con el plan original entre paréntesis.

### Etapa 1 — Bootstrap (Fase 0a)

1. Generar proyecto desde template (`--clean`), integrar a este repo conservando `docs/` y git history.
2. Renombrar paquetes (`@mayordomo/api|web|contracts`), ajustar `.env.example` con vars del proyecto.
3. Tokens del design en `index.css`: paleta light/dark, 3 acentos, colores por caja, radios, sombras. Fonts via `@fontsource` (Hanken Grotesk, IBM Plex Mono).
4. UI kit base: Icon (SVG del design), Money, Card, Btn, Badge, Progress, Avatar, Toggle, Mark, Wordmark.
5. PWA: manifest + iconos.
6. Verificar: login Google funciona (allowlist con tu correo), dark mode y acentos cambian en vivo, CI pasa.

### Etapa 2 — Dominio backend (Fase 0b)

1. Migración: extender `users` (estado, rol), crear `numeros`, `cajas`, `movimientos` según el modelo del plan.
2. Contracts: schemas Zod de caja, movimiento, registro de ingreso/gasto/tránsito.
3. Módulo `cajas`: CRUD + validación %=100 + seeding por defecto (las 7 del design).
4. Módulo `movimientos`: crear/listar/anular (soft delete), split snapshot en ingresos, saldo por consulta, fecha contable `America/Lima`.
5. **Tests de dominio**: reparto por %, saldo, fecha contable, anulación. (Dinero sin tests = corrupción silenciosa.)
6. Guard de `estado='activa'` global.

### Etapa 3 — Frontend core (Fase 0c)

1. Layout responsive: TabBar (mobile) / Sidebar colapsable (desktop), MobileHeader / DeskTopBar.
2. Dashboard: hero "Disponible", spotlight Ahorro, lista de cajas con badges de alerta, recientes. Desktop: grid 3-col.
3. Movimientos: filtros (Todos/Gastos/Ingresos/Tránsito), agrupado por día, detalle de movimiento, detalle de caja.
4. RegistroSheet: tabs tipo, keypad, selector de caja, nota. Con **optimistic update**.
5. CajasScreen: editor de % (±5, validación 100%), info "aplica a futuros".
6. Ajustes: perfil, dark toggle, selector de acento, logout.
7. React Query: hooks por feature siguiendo el patrón `use-notes` del template.

**→ Hito MVP usable: registrás y ves tu plata desde la PWA.**

### Etapa 4 — WhatsApp + voz (Fase 1)

1. Redis + BullMQ al compose; webhook `POST /webhook/whatsapp` (dedup `wa_message_id`, filtro `fromMe`, encola y responde 200).
2. Verificación de número desde el dashboard (código por WhatsApp) — pantalla Verify del design.
3. Fast-path regex + respuesta vía Evolution `sendText`.
4. Módulo `storage` (MinIO presigned) + tabla `archivos`; media entrante.
5. Transcripción de audio (mismo pipeline que texto).
6. Persistir todo en `mensajes` desde ya (el historial del chat web lo necesita).

### Etapa 5 — Agente + chat (Fase 2)

1. Capa AI con AI SDK: tools de lectura scopeadas a `user_id`, guardrails (máx 5 iteraciones, confirmación de escrituras, auditoría).
2. Chat web con `useChat` + streaming: ChatThread, Composer (tono, adjuntos, mic), ConfirmCard, ChatMiniReport, VoiceNote, empty state con chips — todo según el design.
3. Sesiones de conversación: rail con hilo WhatsApp fijado + sesiones nuevas (pin/rename/archive), drawer mobile, rail fijable/flotante desktop.
4. Pendientes con expiración + cierre nocturno.

### Etapa 6 — Reportes y producto (Fase 3/4 parcial)

1. Reportes: cards ingresos/gastos, barras por semana, gasto por caja (mobile + desktop).
2. NotifSheet + alertas de sobregiro/80%.
3. Vista Empresa (ámbito).
4. Deploy completo en Coolify: dominios, backups Postgres + restore probado, monitoreo de instancia Evolution.

---

## 5. Riesgos y puntos abiertos

1. ~~D2 (refresh tokens)~~ Resuelto: rotación completa desde Etapa 1.
2. **Tailwind v4**: el design fue pensado como CSS vars genéricas; el mapeo a `@theme` es directo pero el selector de acento en runtime requiere `data-accent` en `<html>` + vars por acento. Resuelto en diseño de Etapa 1, sin bloqueo.
3. **Modelos OpenAI** citados en docs (gpt-5.4-mini / gpt-5.5): verificar nombres/precios vigentes al llegar a Etapa 5.
4. **Evolution expuesta**: sigue el pendiente de `AUTHENTICATION_API_KEY` fuerte (checklist del plan original).
5. El design trae screenshots y JSX fuente — propongo copiar el export a `docs/design/` como referencia versionada (pesa poco sin screenshots, o con ellos ~2MB).

---

## 6. Aprobación

- [x] D2: refresh token con rotación desde Etapa 1 (usuario, 2026-06-11).
- [x] D4: UI kit propio + shadcn donde ahorre tiempo (usuario, 2026-06-11).
- [x] Resto de decisiones D1–D10 y orden de etapas.

La Etapa 1 incluye además: copiar el design export a `docs/design/` como referencia versionada, y la migración inicial suma la tabla `refresh_tokens`.
