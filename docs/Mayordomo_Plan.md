# Mayordomo — Plan de Construcción

> Plan final para empezar a construir. Extiende y consolida el documento de arquitectura.
> Estado: 1 usuario (tú, joaosouzareyna@gmail.com), diseñado para escalar a multiusuario.

---

## 1. Decisiones confirmadas

- **Auth dashboard:** Google OAuth. Al inicio, **allowlist** (solo tu correo, cuenta `activa`). Los demás quedan `pendiente` hasta activarlos.
- **Sesión:** access token JWT corto (~15 min) + **refresh token en cookie httpOnly** con rotación. La PWA renueva sola; no re-logueás cada vez que abrís la app.
- **Evolution expuesta** (`evolution.mayordomoai.xyz`) por ahora: obligatorio `AUTHENTICATION_API_KEY` fuerte. Revisar exposición si esto escala.
- **Multiusuario (cuando escale):** una sola instancia Evolution = el **número-bot**. Cada usuario, desde el dashboard, **registra y verifica el número desde el cual escribirá**. El bot identifica a la persona por su número remitente.
- **Cuenta "activa":** estados `pendiente | activa | suspendida`. Solo `activa` puede usar el bot y el dashboard completo.
- **Frontend:** React + Vite + TS + TailwindCSS + **shadcn/ui** + **React Query (TanStack)**.
- **Backend:** NestJS + TypeORM con **migraciones siempre** (`synchronize: false`).
- **IA:** OpenAI vía **AI SDK** (GPT-5.4 mini para parseo, GPT-5.5 para el agente, gpt-4o-mini-transcribe para voz).
- **Dinero:** una sola moneda por ahora (S/ / PEN). Montos en `numeric(12,2)`, nunca float.
- **Zona horaria:** todo en UTC en BD, se muestra en `America/Lima`.
- **Gestor de paquetes:** **pnpm** con workspace (monorepo `apps/api`, `apps/web`, `packages/shared`).
- **Deploy:** **Dockerfile por app** (api y web), orquestado con docker-compose en Coolify.
- **Dominios:**
  - `mayordomoai.xyz` → frontend (PWA)
  - `api.mayordomoai.xyz` → backend NestJS
  - `evolution.mayordomoai.xyz` → Evolution API
- **Archivos (imágenes, PDFs, audios):** **MinIO** (S3-compatible, `s3.groowtech.com`) vía SDK de S3. **Bucket dedicado para este proyecto** (ej. `mayordomo-files`), no compartido con otros. Acceso por **URLs prefirmadas** (presigned), nunca bucket público.

---

## 2. Edge cases analizados (con resolución)

### Identidad y acceso
1. **Vincular Google (email) ↔ número de WhatsApp.** Son dos identidades distintas. → El dashboard es la fuente: inicias sesión con Google, y ahí registras tu número. El número es la llave para WhatsApp.
2. **Hijack de número.** Si alguien registra un número que no es suyo, recibiría/atribuiría mensajes ajenos. → **Verificación obligatoria:** al registrar un número, el sistema envía un código por WhatsApp a ese número (o pides que el usuario mande un código al bot). Solo tras verificar, el número queda activo. Un número solo puede pertenecer a una cuenta (constraint único).
3. **Mensaje de un número desconocido / no registrado.** → El bot responde una vez con "no encuentro tu cuenta, regístrate en [link]" y **no procesa nada**. Rate-limit para no responder spam en bucle.
4. **Mensajes del propio bot (`fromMe`).** → Filtrar `fromMe = true` en el webhook para no auto-procesarse y entrar en loop.
5. **Allowlist inicial.** → Tabla `users.estado`; signup queda `pendiente`; tú (admin) activas. Hoy solo tu correo está `activa`.
6. **Un usuario con varios números** (personal + trabajo) → soportado (tabla `numeros`, 1:N). **Mismo número en dos cuentas** → bloqueado por unique.

### Dinero y dominio
7. **Cierre y zona horaria.** La "fecha contable" de un movimiento se calcula en `America/Lima` (un gasto 11:58pm cuenta para ese día, no para UTC del día siguiente).
8. **Reinicio vs acumulación al cierre de mes.** Cajas `tipo='gasto'` (pasajes, ocio) **reinician** cada mes; cajas `tipo='fondo'` (ahorro, diezmo apartado) **acumulan**. Esto evita "perder" el ahorro cada mes.
9. **Saldo: calculado al leer, no almacenado.** El saldo se computa con `SUM()` sobre movimientos del periodo. Así evitas condiciones de carrera cuando llegan dos mensajes a la vez. (Cachéalo en lectura si hace falta, pero la verdad siempre es el SUM.)
10. **Cambio de % a mitad de mes.** → Se guarda un **snapshot del reparto** en cada ingreso (`movimientos.split`). Cambiar los % afecta solo a ingresos futuros; el historial no se reescribe.
11. **Reembolsos / dinero de tránsito** (los DALE que reenvías). → `movimientos.tipo='transito'`: entra y sale sin tocar tus cajas ni tus %. El bot puede preguntar "¿esto es tuyo o lo reenvías?".
12. **Correcciones / borrados** ("eran 30, no 300"). → Edición y anulación con `estado='anulado'` (soft delete, `deleted_at`), nunca borrado físico. Recalcula saldo. El agente lo hace solo con confirmación.
13. **Sobregiro.** Permitido; el saldo se pone en rojo y el bot avisa. No bloquea.
14. **Transferencias entre cajas** (mover de Ocio a Pasajes). → Operación explícita (dos movimientos internos) — fase posterior, pero el modelo ya lo soporta.
15. **Multi-moneda.** Fuera de alcance ahora (todo S/). El campo `moneda` queda en el modelo para el futuro.
16. **Empresa vs personal.** `cajas.ambito='personal'|'empresa'`. Modelado desde ya, simple: el ingreso de cliente puede marcarse como ámbito empresa; el "sueldo" que pasas a personal es lo que alimenta tus % personales.

### WhatsApp / Evolution
17. **Webhooks duplicados** (Evolution reintenta). → `wa_message_id` único + `wa_inbound_log`; idempotente.
18. **Mensajes no-texto** (imagen, sticker, ubicación, contacto). → Manejar audio (transcribir) e imagen de recibo (visión, fase posterior); el resto se ignora con un mensaje amable.
19. **Audio: formato y descarga.** WhatsApp manda OGG/Opus; verificar si tu Evolution lo entrega en base64 en el webhook o hay que pedir el media aparte. ffmpeg en el contenedor por si hay que transcodificar.
20. **Instancia caída** (Baileys se desconecta / pide QR). → Monitoreo del estado de conexión + alerta para re-escanear. Sin esto, "el bot dejó de responder" y no sabes por qué.
21. **Riesgo de baneo** del número (Baileys). → Asumido para MVP; plan de migración a Cloud API si crece.

### Agente / IA
22. **Cifras inventadas.** → El agente responde solo con lo que devuelven las herramientas; nunca inventa montos.
23. **Aislamiento por usuario.** → El `user_id` lo inyecta el backend desde el número/sesión; **jamás** el modelo. Toda herramienta va scopeada.
24. **Loop de herramientas / costo.** → Tope de iteraciones (máx ~5) por turno.
25. **Inyección de prompts** (texto del banco como instrucción). → Tratar todo input como datos; escrituras siempre con confirmación.
26. **Pendientes que quedan colgados.** Si el bot pregunta algo y nunca respondes, el `pendiente` no debe vivir para siempre. → `pendientes.expira_at`; al expirar se descarta o se reanuda con un recordatorio.
27. **Confirmación de escrituras.** → Automática en montos altos, ambiguos o por voz; los gastos chicos y claros se registran directo (menos fricción).
28. **Memoria de conversación.** → Ventana de últimos N mensajes + timeout de sesión, para no inflar tokens ni arrastrar contexto viejo.

### Archivos / storage
36. **Tipos y tamaño de archivos.** Allowlist de MIME (jpeg, png, webp, pdf, ogg/opus) + límite de tamaño (ej. 10 MB imagen/PDF, audio según WhatsApp). Rechazar lo demás con mensaje amable.
37. **Acceso a archivos.** Nunca bucket público. El backend genera **URLs prefirmadas** con expiración corta; todo descarga pasa por autorización del `user_id` dueño.
38. **Archivos huérfanos.** Si la subida llega pero el movimiento/mensaje nunca se confirma, el objeto queda colgado. → Job periódico que limpia `archivos` sin referencia tras X días.
39. **Credenciales MinIO.** Solo en `.env` del servidor; jamás en el repo ni en el frontend. El frontend sube vía backend (o presigned PUT emitido por el backend).

### Datos / backend
29. **Precisión monetaria.** `numeric(12,2)`, nunca float (el Excel usaba floats; en BD no).
30. **Soft delete + auditoría.** Movimientos anulados, no borrados. Log de llamadas a herramientas del agente.
31. **Backups de Postgres.** Es data financiera: backups automáticos + restore probado.
32. **Seeding de cajas** para una cuenta nueva (set por defecto con sus %).

### Frontend
33. **Frescura del dashboard.** Si WhatsApp agrega un movimiento mientras el dashboard está abierto, debe reflejarse. → React Query con `refetch`/invalidación; opcional polling cada X seg o websocket más adelante.
34. **Actualizaciones optimistas** en el chat y al registrar, para que se sienta instantáneo.
35. **Historial de conversaciones en el dashboard.** Quieres ver en la interfaz todo lo que hablaste con el agente por WhatsApp. → Como ya guardamos cada mensaje en `mensajes` (con `canal`), el dashboard solo lo lee y lo muestra. **Diseño recomendado: un único hilo por usuario, con badge de canal** (WhatsApp / web), en una sola línea de tiempo. Bonus: así puedes **continuar desde la web** una conversación que empezaste en WhatsApp. Para que esto funcione desde temprano, registra los mensajes (entrante + respuesta) en `mensajes` ya desde la Fase 1, aunque el agente completo llegue en la Fase 2. Privacidad: el historial va scopeado a tu `user_id`.

---

## 3. Decisiones que te recomiendo así (confírmame si cambias algo)

- **A. Verificación de número:** código enviado por WhatsApp al número que registras. → *recomendado: sí, obligatorio.*
- **B. Caja/– tipo "tránsito"** para reembolsos. → *recomendado: sí.*
- **C. Reinicio mensual:** gasto reinicia, fondo acumula. → *recomendado: sí.*
- **D. Confirmación de escrituras:** solo en montos altos/ambiguos/voz. → *recomendado: sí.*
- **E. Empresa/personal:** incluir `ambito` desde ya, pero usarlo simple. → *recomendado: sí.*
- **F. Multi-moneda:** fuera de alcance ahora. → *recomendado: sí (solo S/).*
- **G. % por ingreso:** snapshot al momento del ingreso. → *recomendado: sí.*

> ✅ **Confirmado todo lo anterior.** Además: el **primer periodo arranca en la fecha de tu primer movimiento**; de ahí en adelante, corte por **mes calendario** en `America/Lima`.

---

## 4. Modelo de datos final

```
users          (id uuid pk, google_sub text unique, email text unique, nombre,
                estado['pendiente'|'activa'|'suspendida'] default 'pendiente',
                rol['user'|'admin'] default 'user', created_at, updated_at)

numeros        (id uuid pk, user_id fk, e164 text unique, verificado bool default false,
                verif_code text, verif_expira_at, created_at)

cajas          (id uuid pk, user_id fk, nombre, porcentaje numeric(5,4),
                tipo['gasto'|'fondo'], ambito['personal'|'empresa'],
                orden int, activa bool, created_at, updated_at)

movimientos    (id uuid pk, user_id fk, tipo['ingreso'|'gasto'|'transito'],
                caja_id fk null, monto numeric(12,2), moneda default 'PEN',
                fecha date, ocurrido_at timestamptz, nota,
                origen['whatsapp'|'pwa'|'import'],
                estado['confirmado'|'pendiente'|'anulado'] default 'confirmado',
                split jsonb null,         -- snapshot del reparto por % (ingresos)
                wa_message_id text unique null,
                created_at, updated_at, deleted_at)

periodos       (id, user_id, año, mes, cerrado bool, cerrado_at)         -- opcional

conversaciones (id, user_id, canal['whatsapp'|'web'], abierta, last_at)
mensajes       (id, conversacion_id fk, rol['user'|'assistant'|'tool'],
                contenido, tool_calls jsonb, created_at)
pendientes     (id, user_id, conversacion_id, descripcion, payload jsonb,
                estado['abierto'|'resuelto'|'expirado'], expira_at, created_at)

archivos       (id uuid pk, user_id fk, movimiento_id fk null, mensaje_id fk null,
                tipo['imagen'|'pdf'|'audio'], mime, bucket, object_key text unique,
                size_bytes int, origen['whatsapp'|'pwa'], created_at, deleted_at)

wa_inbound_log (wa_message_id pk, payload jsonb, processed_at)           -- idempotencia
audit_tools    (id, user_id, tool, args jsonb, resultado jsonb, created_at)
```

**Saldo de caja** (vista/consulta, no columna):
```
asignado = SUM(ingresos del periodo) * caja.porcentaje      (o suma de split si snapshot)
gastado  = SUM(gastos del periodo WHERE caja_id = caja.id, estado='confirmado')
saldo    = asignado - gastado
```

---

## 5. Plan por fases (tareas concretas)

### Fase 0 — Cimientos (sin IA)
- [ ] Monorepo **pnpm workspace** (`apps/api`, `apps/web`, `packages/shared`).
- [ ] **Dockerfile por app** (api, web) + Docker Compose (api, postgres, redis, web) en Coolify.
- [ ] Dominios apuntados: `mayordomoai.xyz` (web), `api.mayordomoai.xyz` (api), `evolution.mayordomoai.xyz` (Evolution).
- [ ] NestJS + TypeORM, **migraciones configuradas** (`synchronize:false`), conexión a Postgres.
- [ ] Entidades + primera migración: `users, numeros, cajas, movimientos`.
- [ ] **Google OAuth** + JWT; guard de rutas; allowlist (tu correo `activa`).
- [ ] CRUD de `cajas` (con validación de que % sumen 100) + seeding por defecto.
- [ ] `movimientos`: crear/listar; cálculo de saldo por consulta.
- [ ] Frontend: Vite + Tailwind + shadcn/ui + React Query; login Google; dashboard de cajas + registro manual.
- [ ] **Tests de dominio:** reparto por %, cálculo de saldo, fecha contable en `America/Lima`. (Lógica de dinero sin tests = corrupción silenciosa.)
- [ ] Backups de Postgres configurados y **restore probado** (no postergar).
- [ ] **CI (GitHub Actions):** lint + tests + build en cada push.

### Fase 1 — WhatsApp + voz (parser)
- [ ] Módulo `whatsapp`: webhook `POST /webhook/whatsapp` (valida, dedup, filtra `fromMe`).
- [ ] Registro y **verificación de número** desde el dashboard (código por WhatsApp).
- [ ] Resolver `numero remitente → user_id`; rechazar desconocidos.
- [ ] Fast-path regex ("gasté 8 en pasajes") + respuesta vía Evolution `sendText`.
- [ ] Transcripción de audio (gpt-4o-mini-transcribe) → mismo pipeline.
- [ ] Procesamiento asíncrono (cola Redis/BullMQ) para no dar timeout en el webhook.
- [ ] Guardar cada mensaje (entrante + respuesta) en `mensajes` con su `canal`, para que el historial exista desde ya.
- [ ] Módulo `storage` (MinIO/S3): guardar media entrante de WhatsApp (audio, imagen, PDF) en bucket dedicado + fila en `archivos`; URLs prefirmadas para lectura.

### Fase 2 — Agente + chat web
- [ ] Capa IA con **AI SDK** (abstracción de proveedor) + herramientas de lectura scopeadas a `user_id`.
- [ ] Memoria (`conversaciones`/`mensajes`) + `pendientes` con expiración.
- [ ] Preguntas libres + aclaraciones + **cierre nocturno** (ingesta con pendientes).
- [ ] Chat en la PWA (`useChat` + AI Elements) con texto y voz, mismo agente.
- [ ] **Vista "Conversaciones"** en el dashboard: historial unificado WhatsApp + web en una línea de tiempo, con badge de canal y opción de continuar el hilo desde la web.
- [ ] Subida de archivos desde la PWA (imagen/PDF de recibos) → `storage` + adjuntar a movimientos; vista previa con URL prefirmada.
- [ ] Guardrails: tope de iteraciones, confirmación de escrituras, auditoría de tools.

### Fase 3 — Multiusuario real
- [ ] Estados de cuenta (`pendiente/activa/suspendida`) + panel admin para activar.
- [ ] Cortes de mes (`periodos`), fondos acumulativos, snapshot de %.
- [ ] Rate-limit por usuario; monitoreo de la instancia Evolution.

### Fase 4 — Producto
- [ ] Reportes/export, gráficos, recordatorios proactivos ("80% de tu caja de Ocio").
- [ ] Lectura de recibos por imagen (visión). Evaluar WhatsApp Cloud API.

---

## 6. Checklist de setup técnico
- [ ] `synchronize:false` + scripts de migración (`migration:generate/run/revert`).
- [ ] Secretos solo en `.env` del servidor: `OPENAI_API_KEY`, Google OAuth client id/secret, JWT secret, `EVOLUTION_*`, Postgres, `MINIO_*`.
- [ ] MinIO: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` (dedicado, ej. `mayordomo-files`), `MINIO_PUBLIC_URL`. Valores reales SOLO en `.env` del servidor.
- [ ] pnpm workspace configurado (`pnpm-workspace.yaml`); Dockerfiles usan `corepack enable` + `pnpm fetch` para caché de capas.
- [ ] shadcn/ui inicializado; React Query provider en la raíz.
- [ ] Webhook de Evolution apuntando a **esta** app (instancia dedicada recomendada).
- [ ] ffmpeg en la imagen del backend.
- [ ] Backups automáticos de Postgres + restore probado.
- [ ] Zona horaria `America/Lima` para fechas contables; `numeric(12,2)` para dinero.
- [ ] **Tope de gasto mensual** configurado en el dashboard de OpenAI (hard limit).
- [ ] `AUTHENTICATION_API_KEY` fuerte en Evolution (está expuesta públicamente).
