# Plan: Internacionalización (i18n) — Español + Inglés + Moneda configurable

> Estado: **aprobado — pendiente de implementación**
> Autor: Joao Souza · Fecha: 2026-06-11
> Veredicto de factibilidad: **FACTIBLE, riesgo medio-bajo**. Sin bloqueos arquitectónicos;
> el volumen está en la extracción de strings, la complejidad en el prompt del agente.

---

## 1. Resumen ejecutivo

Hoy la app está 100% en español hardcodeado y la moneda (`S/`, soles) fija. El objetivo:

1. **Idioma**: soportar **español e inglés** (`Locale = 'es' | 'en'`). Default
   **derivado del navegador al registrarse** (es/en; otro idioma → `'en'`), persistido en DB.
2. **Moneda**: el usuario elige **su** moneda (ISO 4217). Default **derivado del país
   del teléfono al verificarlo** (+51→PEN, +1→USD, ...); sin teléfono ni elección →
   `'USD'`. Una sola moneda por usuario, sin conversión de datos históricos.

Ambas son preferencias **independientes** (en + PEN válido, es + USD válido) y ambas
se persisten en base de datos. La decisión que condiciona todo el diseño: estas
preferencias **NO pueden vivir solo en localStorage** (como el theme). WhatsApp bot,
recordatorios recurrentes y el agente IA corren server-side, sin browser — necesitan
resolver idioma y moneda del usuario desde la DB.

**Fuera de scope explícito:** multi-currency real — transacciones en monedas mezcladas,
contabilidad con tipos de cambio, conversión de históricos. La tool de tipo de cambio
que ya existe en el agente (`agent-tools.ts:290`) cubre el caso "gasté 10 dólares":
convierte al registrar, el dato queda en la moneda del usuario.

---

## 2. Superficie actual (relevamiento 2026-06-11)

| Zona                               | Volumen                                                                                                                                                             | Archivos clave                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/web` — strings UI            | ~470 strings en ~40+ archivos                                                                                                                                       | `src/pages` (~120), `src/features` (~180), `src/components/mayordomo` (~80), `src/components/ai-elements` (~60) |
| `apps/api` — mensajes              | ~50 strings                                                                                                                                                         | `boxes.service.ts`, `auth/strategies/*`, `agent-tools.ts`                                                       |
| WhatsApp bot                       | ~10 mensajes                                                                                                                                                        | `whatsapp/whatsapp.service.ts`, `whatsapp/recurring-reminder.service.ts`                                        |
| Prompt del agente                  | ~30 líneas, 100% español                                                                                                                                            | `apps/api/src/agent/agent.service.ts:33-63`                                                                     |
| Validación Zod compartida          | ~10 mensajes custom                                                                                                                                                 | `packages/contracts/src/common.ts`                                                                              |
| Locale `Intl` hardcodeado `es-PE`  | ~12 archivos                                                                                                                                                        | `money.tsx`, `transaction-detail.tsx`, `whatsapp.service.ts`, `common/money.ts`, etc.                           |
| `S/` hardcodeado (símbolo)         | web: `money.tsx:23`, `home.tsx:64,85`, `envelope-card.tsx:72,94`, `registro-dialog.tsx:48,83` · api: `whatsapp.service.ts` (×7), `recurring-reminder.service.ts:44` | + prompt y tools del agente                                                                                     |
| Parser WhatsApp con prefijo `S/`   | regex `EXPENSE_RE`                                                                                                                                                  | `whatsapp/parser.ts:14` (+ `parser.spec.ts`)                                                                    |
| Umbral de confirmación en soles    | `CONFIRMATION_THRESHOLD`                                                                                                                                            | `agent.service.ts:48`, `agent-tools.ts:237,259`                                                                 |
| Tool de tipo de cambio (ya existe) | FX para input en otra moneda                                                                                                                                        | `agent-tools.ts:290-293` (destino hoy implícito: PEN)                                                           |
| Cajas default en español           | 'Varios', 'Pasajes', 'Diezmo'...                                                                                                                                    | `boxes.service.ts:19-24`, `admin.service.ts`, seeds                                                             |

Estado de infraestructura: **cero**. Sin librería i18n, sin `t()`, sin locale files,
sin campos `language` ni `currency` en la entidad `User`. Theme/sidebar/accent hoy van
a localStorage sin endpoint de preferencias.

---

## 3. Decisiones

### 3.1 Librería

| Opción                | Tradeoff                                                                      | Veredicto   |
| --------------------- | ----------------------------------------------------------------------------- | ----------- |
| `react-i18next`       | Madura, runtime ~15kb, lazy por namespace, tipado de keys vía TS augmentation | **Elegida** |
| Lingui                | Bundle menor, extracción por macros; paso de compilación, ecosistema menor    | Descartada  |
| Paraglide (inlang)    | Compile-time, type-safe, casi cero runtime; joven, menos batalla probada      | Descartada  |
| FormatJS / react-intl | ICU potente; verboso, DX inferior para este caso                              | Descartada  |

> **Decisión:** `react-i18next` en web. En la API, `i18next` core como `t(locale, key)`
> liviano — **NO** `nestjs-i18n` (sobredimensionado para ~50 strings). Mismo motor y
> mismos JSON en ambos lados = una sola fuente de verdad.

### 3.2 Persistencia del idioma

- Columna `language` en `users`: `varchar(5)`, NOT NULL, default `'es'` + migración
  TypeORM. Usuarios existentes quedan en `'es'`.
- **Al registrarse**: la web manda `language` derivado de `navigator.language`
  (`es`/`en`; cualquier otro → `'en'`) en el payload de registro y se persiste.
  Todo usuario nace por web (WhatsApp NO crea usuarios — solo atiende teléfonos
  verificados de usuarios ACTIVOS, `whatsapp.service.ts:81-87`), así que el navegador
  siempre está disponible en ese momento.
- Endpoint `PATCH` siguiendo el patrón existente del update de nombre.
- Resolución en web: `user.language` (logueado) → `navigator.language` (es/en;
  otro → `'en'`) (pantallas pre-login: login/registro). Misma función de mapeo que
  usa el registro — un solo criterio.
- Resolución server-side (WhatsApp, recordatorios, agente): siempre `user.language` de DB.

### 3.3 Arquitectura de recursos

Nuevo paquete `packages/i18n` (implementado con **módulos TS, no JSON** — ver nota):

```
packages/i18n/
├── src/
│   ├── locales/
│   │   ├── es/        # common.ts, settings.ts, ... (fuente de verdad de keys)
│   │   └── en/        # espejo tipado: `satisfies typeof es`
│   ├── format.ts      # formatMoney(amount, currency, locale) + getIntlLocale(language)
│   └── index.ts       # `resources` para i18next + defaultNS
```

- Web lo consume vía `react-i18next` (namespaces = archivos por dominio).
- API lo consume vía instancia `i18next` core inicializada en un módulo Nest.
- Keys en inglés, semánticas, no literales: `boxes.errors.notFound`, no `caja_no_encontrada`.
- **Nota TS vs JSON**: cada archivo de `en/` se tipa `satisfies typeof es` → una key
  faltante o sobrante entre idiomas es error de compilación. Esto reemplaza el check
  de CI de drift es/en planificado en Fase 5 (el compilador lo hace gratis).
  El tipo `Locale` y `DEFAULT_LOCALE` viven en `packages/contracts` (preferences.ts),
  junto a los schemas — una sola fuente para validación y tipos.

### 3.4 Casos especiales

1. **Prompt del agente** (`agent.service.ts:33-63`): no alcanza con agregar
   "respond in English" — el prompt tiene ejemplos literales ("✓ Anotado S/8 en
   Pasajes") y define tono. Se crea `buildSystemPrompt(locale)` con **template completo
   por idioma**. Más mantenimiento, comportamiento confiable.
2. **Zod en `packages/contracts`**: los schemas se validan en web y api. Estrategia:
   - Zod 4 trae locales nativos (`z.config(z.locales.es())`) → borrar mensajes custom
     donde el default sirva ('Mínimo 2 caracteres', etc.).
   - Keys i18n solo para mensajes de dominio ('Formato E.164: +51987654321').
3. **`Intl` hardcodeado**: helper central `getIntlLocale(language)` →
   `es → 'es-PE'`, `en → 'en-US'`. OJO: cambia también el formato de números
   (1.234,56 vs 1,234.56). ~12 archivos, cambio mecánico.
4. **Saludos por hora** (`chat-thread.tsx:96-98`) y **sugerencias del chat**: pasan a
   keys con interpolación normal.

### 3.5 Moneda configurable

**Modelo:** una moneda por usuario. Cambiarla **NO convierte** montos históricos —
solo cambia símbolo y formato. El selector en settings lo advierte explícitamente.

- Columna `currency` en `users`: `char(3)` ISO 4217, **NULLABLE, sin default**.
  Semántica: `NULL` = "nunca eligió" → se resuelve como `'USD'` y queda abierta a
  derivación. Helper `resolveCurrency(user) = user.currency ?? 'USD'`.
  Mismo endpoint de preferencias que `language` (o endpoints hermanos).
- **Derivación por teléfono**: al **verificar** un teléfono (`phone-verification.service`),
  si `user.currency IS NULL` → se deriva del prefijo E.164 y se persiste. Si el usuario
  ya eligió (manual o derivada antes), NO se pisa. El teléfono llega después del
  registro (`POST /me/phone` + verify), por eso el gancho va en la verificación, no
  en el registro.
- Mapa `PHONE_PREFIX_TO_CURRENCY` en `packages/contracts`: prefijos de la lista curada
  (+51→PEN, +1→USD, +52→MXN, +57→COP, +54→ARS, +56→CLP, +55→BRL, +591→BOB, +598→UYU,
  +595→PYG, +44→GBP, zona euro→EUR) con **longest-prefix match** (prefijos de largo
  variable: +1 vs +51 vs +595). Prefijo no mapeado (ej. +81 Japón) → no deriva
  (queda NULL ⇒ USD). Sin libphonenumber — mapa curado alcanza.
- **Backfill en la migración**: usuarios existentes con teléfono verificado → moneda
  derivada del prefijo; sin teléfono → queda `NULL` (resuelve USD y deriva si verifica
  uno después). `language` de existentes → `'es'`.
- Lista curada de monedas (no las ~180 ISO): `PEN, USD, EUR, MXN, COP, ARS, CLP, BRL,
BOB, UYU, PYG, GBP`. Vive en `packages/contracts` para validar en ambos lados.
- Helper compartido `formatMoney(amount, currency, locale)` sobre
  `Intl.NumberFormat(locale, { style: 'currency', currency })` — resuelve símbolo,
  posición y decimales (JPY/CLP sin decimales) gratis. Reemplaza TODOS los
  `'S/' + toFixed(2)` manuales de web y los `fmt()` de api.
- `<Money>` (`money.tsx`) toma la moneda del contexto de usuario, deja de hardcodear `S/`.
- **Parser WhatsApp** (`parser.ts:14`): generalizar regex de prefijo — acepta `S/`,
  `$`, `€`, código ISO o sin prefijo. El monto se asume en la moneda del usuario.
- **Agente**: `buildSystemPrompt(locale, currency)` — ejemplos y regla de formato
  parametrizados. Tool descriptions (`'Monto en soles (S/)'` en `agent-tools.ts:242`)
  parametrizadas. Tool de FX apunta a `user.currency` como destino.
- **Tool `update_preferences`** (nueva, en `agent-tools.ts`): permite cambiar
  `language` y/o `currency` por chat — cubre al usuario WhatsApp-only que nunca abre
  settings web ("háblame en inglés", "usa dólares"). Valida contra `Locale` y
  `SUPPORTED_CURRENCIES`. Detalles:
  - El system prompt ya está construido cuando la tool corre a mitad de conversación:
    el resultado de la tool instruye al agente "responde en {idioma} de ahora en
    adelante"; la siguiente conversación ya arma el prompt con el locale nuevo.
  - Cambio de moneda: la descripción de la tool obliga al agente a advertir que los
    montos históricos NO se convierten (misma advertencia que el selector de settings).
- **`CONFIRMATION_THRESHOLD`**: v1 mantiene el valor numérico único interpretado en la
  moneda del usuario (50 PEN ≠ 50 USD en valor real — limitación conocida, ver riesgos).
  Si molesta en la práctica: mapa por moneda en v2.

---

## 4. Fases

### Fase 1 — Fundación ✅ (2026-06-11)

- [x] Crear `packages/i18n` con estructura de locales y tipo `Locale`.
- [x] Instalar y configurar `react-i18next` en `apps/web` (init en `lib/i18n.ts`,
      side-effect import en `main.tsx`, `<LocaleSync />` en el root).
- [x] Migración: `language` varchar(5) NOT NULL default `'es'` + `currency` char(3)
      NULL en `users`, con **backfill**: derivar `currency` del prefijo del teléfono
      verificado de usuarios existentes; sin teléfono → NULL.
      (`1781260000000-UserPreferences.ts` — mapa congelado inline, no importa el vivo.)
- [x] Mapa `PHONE_PREFIX_TO_CURRENCY` (longest-prefix match) + helper
      `deriveCurrencyFromE164(e164)` en `packages/contracts` (`preferences.ts`).
- [x] Registro: payload acepta `language` (`'es' | 'en'`, opcional; si falta → `'es'`,
      igual que el default de columna); la web lo deriva de `navigator.language`
      (es/en; otro → `'en'`) y lo manda siempre.
- [x] Gancho en `phone-verification.service` (verify): si `user.currency IS NULL` →
      derivar del prefijo y persistir (`deriveCurrencyIfUnset`).
- [x] Endpoint `PATCH /me/preferences` con `{ language?, currency? }` (espejo del patrón update-name).
- [x] Lista curada `SUPPORTED_CURRENCIES` en `packages/contracts` + schema Zod.
- [x] Helper `resolveCurrency(user) = user.currency ?? 'USD'` (api y web).
- [x] Selectores de idioma y moneda en `settings.tsx` (sección "Idioma y moneda";
      nombres de moneda vía `Intl.DisplayNames`; advierte que no convierte históricos).
- [x] Hook `useLocale()` que resuelve user → navigator → default.
- [x] Helper compartido `formatMoney(amount, currency, locale)` en `packages/i18n`.
- [x] `authUserSchema` expone `language` y `currency` (el front los lee de `useMe()`).

### Fase 2 — Extracción masiva web (mecánica, por lotes) ✅ (2026-06-11)

- [x] `src/pages` (10 páginas, ~165 keys) + `lib/accent.ts` (labels → `labelKey`).
- [x] `src/features` (~115 keys) — toasts, diálogos, chat completo + `lib/boxes.ts`
      (`boxAlert` devuelve `labelKey`).
- [x] `src/components/mayordomo` + `layouts/app-layout.tsx` (~45 keys; nav y títulos
      de página en `common.nav.*`).
- [x] `src/components/ai-elements`: solo **6 de 47 archivos se usan** (conversation,
      message, prompt-input, chain-of-thought, suggestion, shimmer) — 17 keys bajo
      `chat.ai.*`. Los otros **41 son código muerto, sin tocar** (candidatos a borrar).
- [x] Sugerencias del chat + saludos por hora (`chat-thread.tsx`) — `chat.greetings.*`,
      `chat.suggestions.*`. También labels de tools (`chat.tools.*`, adelanta el ítem
      de Fase 4).
- [x] Tipado de keys (TS augmentation en `apps/web/src/types/i18next.d.ts`) — `tsc`
      falla con key inexistente. Keys dinámicas tipadas con `as const` /
      `ParseKeys<'ns'>` / `TFunction<ns>`.

> Pendiente diferido a Fase 5: `features/phone/countries.ts` (~200 nombres de país en
> español) — usar `Intl.DisplayNames(locale, { type: 'region' })` en vez de ~400 keys.

### Fase 3 — API ✅ (2026-06-11)

- [x] Módulo i18n en Nest (`apps/api/src/i18n/` — `@Global()`, i18next core,
      `t(locale, key, params)`, defaultNS `api`).
- [x] Errores de servicios con usuario en contexto (`boxes.service.ts` +
      `boxes.controller.ts` pasan `user.language`). Pendientes sin locale en contexto:
      strategies pre-auth (`jwt`/`google`), `transactions.service.ts`, errores HTTP de
      `phone-verification` — siguen en español, candidatos a lote de seguimiento.
- [x] Mensajes WhatsApp (`whatsapp.service.ts` ×7, `recurring-reminder.service.ts`,
      código de verificación) — `user.language` + `formatMoney(resolveCurrency(user.currency))`.
      Keys en namespace `api` (`whatsapp.*`, `reminders.*`).
- [x] Parser WhatsApp: `EXPENSE_RE` acepta `S/`, `$`, `€`, `£`, código ISO o sin
      prefijo. `parser.spec.ts`: 24/24 verdes con casos nuevos por símbolo.
- [x] Estrategia Zod: web sigue el idioma activo (`z.config(z.locales.*)` en
      `languageChanged`); borrados customs redundantes de `common.ts`. Mensajes de
      dominio (E.164, código 6 dígitos) quedan custom — flag v2. API server-side sin
      config de locale Zod (v1).
- [x] Cajas default por idioma al activar cuenta (`defaultBoxes.*` en ns `api`;
      `admin.service` usa el idioma del usuario aprobado). Existentes intactas.
      Seed dev queda en español a propósito (data demo).

### Fase 4 — Agente

- [ ] `buildSystemPrompt(locale, currency)` con template completo es/en y ejemplos de
      monto en la moneda del usuario.
- [ ] Tool descriptions y mensajes de error de tools por idioma y moneda
      (`agent-tools.ts:242,259`).
- [ ] Tool de FX (`agent-tools.ts:290`): destino = `user.currency`.
- [ ] Tool `update_preferences` ({ language?, currency? }) en `agent-tools.ts`:
      valida contra `Locale`/`SUPPORTED_CURRENCIES`, persiste en `users`, resultado
      instruye al agente a responder en el idioma nuevo; al cambiar moneda advierte
      que no convierte históricos.
- [x] Labels de tools en web (`chat-thread.tsx`) a keys i18n — hecho en Fase 2
      (`chat.tools.*`, `TOOL_META` con `labelKey`).

### Fase 5 — Intl dinámico + QA

- [ ] Helper `getIntlLocale(language)` y reemplazo en los ~12 sitios con `'es-PE'`.
- [ ] Reemplazar `S/` hardcodeado en web por `formatMoney`/`<Money>`:
      `money.tsx:23`, `home.tsx:64,85`, `envelope-card.tsx:72,94`, `registro-dialog.tsx:48,83`.
- [ ] Detección de keys faltantes en runtime (`saveMissing`/warning en dev). El drift
      es/en ya lo garantiza el compilador (`satisfies typeof es` en cada namespace).
- [ ] `pnpm typecheck` + `pnpm build` verdes.
- [ ] Prueba manual: cambio de idioma en settings, persistencia tras reload,
      WhatsApp responde en el idioma del usuario, agente responde en el idioma del usuario.
- [ ] Prueba manual moneda: cambiar a USD → símbolo y formato cambian en home, cajas,
      registro, WhatsApp y respuestas del agente; montos históricos conservan su valor
      numérico; "gasté 10 soles" con moneda USD dispara la tool de FX.

---

## 5. Riesgos

| Riesgo                                                       | Mitigación                                                                                                                          |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Prompt en inglés degrada comportamiento del agente           | Template completo por idioma + probar flujos críticos (registrar gasto, confirmación de umbral) en ambos idiomas                    |
| Drift entre `es/` y `en/` (keys faltantes)                   | Check en CI que compara estructuras de ambos árboles JSON                                                                           |
| Extracción masiva introduce regresiones visuales             | Por lotes pequeños, `tsc` con keys tipadas, revisión por módulo                                                                     |
| Mensajes Zod cambian textos existentes al usar locale nativo | Revisar diff de mensajes antes de borrar los custom                                                                                 |
| Usuario de WhatsApp sin sesión web nunca configura idioma    | Tool `update_preferences` del agente: cambia idioma/moneda por chat ("háblame en inglés"); defaults `'es'` + `'PEN'` mientras tanto |
| Cambio de moneda malinterpretado como conversión             | Advertencia explícita en el selector: "no convierte montos existentes"                                                              |
| `CONFIRMATION_THRESHOLD` único pierde sentido entre monedas  | Limitación conocida y documentada en v1; mapa por moneda en v2 si molesta                                                           |
| Parser WhatsApp generalizado acepta símbolos ambiguos        | Tests en `parser.spec.ts` por cada símbolo soportado                                                                                |
| Prefijo +1 cubre USA/Canadá/Caribe → todos caen en USD       | Aceptado: USD razonable para +1; el usuario corrige en settings o por chat                                                          |
| Derivación pisa una elección manual del usuario              | Imposible por diseño: solo deriva cuando `currency IS NULL`                                                                         |

---

## 6. Fuera de scope

- **Multi-currency real** — transacciones en monedas mezcladas, contabilidad con tipos
  de cambio, conversión de montos históricos al cambiar de moneda. La preferencia de
  moneda (sección 3.5) NO es esto: es una sola moneda por usuario, sin conversión.
- Más idiomas (portugués, etc.) — la arquitectura los soporta agregando carpeta de locale,
  pero no se traducen ahora.
- Detección automática de idioma del mensaje entrante de WhatsApp — se usa la preferencia
  del usuario, no detección por mensaje.
- Localización de emails transaccionales — no existen hoy.
