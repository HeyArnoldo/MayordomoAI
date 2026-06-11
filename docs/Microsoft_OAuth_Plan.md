# Plan: Login con Microsoft / Outlook (Azure Entra ID)

> Estado: **propuesta — pendiente de aprobación**
> Autor: Joao Souza · Fecha: 2026-06-11
> Veredicto de factibilidad: **FACTIBLE, riesgo bajo**. Es espejar el patrón de Google que ya existe.

---

## 1. Resumen ejecutivo

Agregar login con cuenta Microsoft (personal `@outlook.com` / `@hotmail.com` / `@live.com`
**y** corporativas Microsoft 365 / Entra ID) reutilizando el patrón OAuth2/OIDC que el
proyecto ya tiene andando para Google.

**No es magia distinta a Google.** Es el mismo flujo OAuth2:
`redirect → consent → callback → token → perfil → upsert usuario → cookie de sesión`.
Cambian endpoints, credenciales (Azure Portal en vez de Google Cloud Console), scopes y `tenant`.

El auth actual está bien diseñado para esto: estrategia condicional por flag, guard que
devuelve 404 si está apagado, upsert que vincula por email. Microsoft entra sin tocar nada
de lo existente — solo se **suma**.

---

## 2. Factibilidad — ¿se puede usar?

| Pregunta                                  | Respuesta                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| ¿Existe estrategia Passport?              | Sí: `passport-microsoft` (wrapper OAuth2 sobre endpoints de Microsoft). |
| ¿Cubre cuentas personales Y corporativas? | Sí, con `tenant: 'common'`.                                             |
| ¿Es gratis?                               | Sí. Registrar la app en Azure (Entra ID) es gratuito.                   |
| ¿Choca con el auth actual?                | No. Patrón aislado por flag, igual que Google.                          |
| ¿Requiere reescribir algo?                | No. Solo se generaliza `googleId` → opcional refactor a `provider`.     |

### Alternativas de librería

| Opción               | Cubre                  | Recomendación                                                                    |
| -------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `passport-microsoft` | Personal + work/school | **Elegida** — mismo estilo que `passport-google-oauth20`, fricción mínima.       |
| `passport-azure-ad`  | Entra ID oficial       | Descartada — **deprecada** por Microsoft.                                        |
| `@azure/msal-node`   | Todo                   | Descartada para esto — no es Passport, rompería el patrón uniforme del proyecto. |

> **Decisión:** `passport-microsoft`. Mantiene consistencia con `GoogleStrategy` y el
> resto del módulo `auth`. Si en el futuro se necesita refresh de tokens de Graph API,
> reevaluar MSAL.

---

## 3. Pre-requisitos externos (Azure Portal)

Antes de tocar código, registrar la app:

1. Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. **Supported account types**: _Accounts in any organizational directory and personal
   Microsoft accounts_ (= `tenant: 'common'`).
3. **Redirect URI** (Web): `http://localhost:3000/api/auth/microsoft/callback` (dev) y la
   URL de prod.
4. Copiar **Application (client) ID** → `MICROSOFT_CLIENT_ID`.
5. **Certificates & secrets** → **New client secret** → copiar valor → `MICROSOFT_CLIENT_SECRET`.
6. **API permissions**: `openid`, `profile`, `email`, `User.Read` (Microsoft Graph,
   delegated). Suficiente para leer email + nombre.

> ⚠️ El client secret de Azure **expira** (máx 24 meses). Anotar fecha de expiración —
> es un punto de mantenimiento que Google no tiene de la misma forma.

---

## 4. Cambios de código (mapa archivo por archivo)

Cada archivo nuevo/modificado tiene su equivalente Google ya en el repo — usar como molde.

### 4.1 Backend (`apps/api`)

| #   | Archivo                                          | Acción                                                                                                                               | Molde Google              |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| 1   | `src/auth/strategies/microsoft.strategy.ts`      | **Nuevo** — `MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft')`. `validate()` mapea perfil → `MicrosoftProfileData`. | `google.strategy.ts`      |
| 2   | `src/config/auth-flags.ts`                       | Agregar `isMicrosoftEnabled()`.                                                                                                      | `isGoogleEnabled()`       |
| 3   | `src/auth/guards/auth-flags.guards.ts`           | Agregar `MicrosoftEnabledGuard`.                                                                                                     | `GoogleEnabledGuard`      |
| 4   | `src/auth/auth.controller.ts`                    | Agregar rutas `GET /auth/microsoft` y `GET /auth/microsoft/callback`.                                                                | rutas `google`            |
| 5   | `src/auth/auth.service.ts`                       | Agregar `loginWithMicrosoft(profile)`.                                                                                               | `loginWithGoogle()`       |
| 6   | `src/users/users.service.ts`                     | Agregar `upsertFromMicrosoft(profile)` + interfaz `MicrosoftProfileData`.                                                            | `upsertFromGoogle()`      |
| 7   | `src/users/user.entity.ts`                       | Agregar columna `microsoftId` (varchar, nullable, unique).                                                                           | columna `googleId`        |
| 8   | `src/auth/auth.module.ts`                        | Registrar `MicrosoftStrategy` condicional: `...(isMicrosoftEnabled() ? [MicrosoftStrategy] : [])`.                                   | registro `GoogleStrategy` |
| 9   | `src/config/env.validation.ts`                   | Agregar `MICROSOFT_CLIENT_ID/SECRET/CALLBACK_URL` (opcionales).                                                                      | vars `GOOGLE_*`           |
| 10  | `src/database/migrations/<ts>-AddMicrosoftId.ts` | **Nueva migración** — `ALTER TABLE users ADD COLUMN microsoftId ... UNIQUE`.                                                         | columna en `InitSchema`   |

### 4.2 Contracts (`packages/contracts`)

| #   | Archivo       | Acción                                              |
| --- | ------------- | --------------------------------------------------- |
| 11  | `src/auth.ts` | `AuthConfig` → agregar `microsoftEnabled: boolean`. |

### 4.3 Frontend (`apps/web`)

| #   | Archivo                    | Acción                                                                       |
| --- | -------------------------- | ---------------------------------------------------------------------------- |
| 12  | `src/services/auth.api.ts` | Agregar `microsoftAuthUrl` (espejo de `googleAuthUrl`).                      |
| 13  | Componente de login        | Renderizar botón "Continuar con Microsoft" cuando `config.microsoftEnabled`. |

### 4.4 Config / env

| #   | Archivo        | Acción                                                                                 |
| --- | -------------- | -------------------------------------------------------------------------------------- |
| 14  | `.env.example` | Documentar `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_CALLBACK_URL`. |

---

## 5. Decisión de diseño: `microsoftId` vs refactor a `provider`

Dos caminos. Hay un fork real acá:

### Opción A — `microsoftId` separado (rápido, espejo exacto de Google)

```ts
@Column({ type: 'varchar', length: 64, nullable: true, unique: true })
microsoftId: string | null;
```

- ✅ Cambio mínimo, sigue el patrón existente al pie de la letra.
- ✅ Cero riesgo sobre datos/usuarios Google actuales.
- ❌ Cada provider nuevo (GitHub, Apple…) = otra columna. No escala elegante.

### Opción B — tabla/columna `provider` genérica (escalable)

```ts
// ej: enum provider + providerId, o tabla user_identities (1 user → N identidades)
provider: 'google' | 'microsoft' | 'local';
providerId: string | null;
```

- ✅ Escala a N providers sin tocar el esquema cada vez.
- ❌ Requiere migrar `googleId` existente → más trabajo y riesgo en datos actuales.

> **Recomendación: Opción A para este sprint** (hackathon = velocidad, riesgo bajo).
> Dejar Opción B como deuda técnica anotada si se agrega un tercer provider.

---

## 6. Esqueleto de la estrategia (referencia)

```ts
// apps/api/src/auth/strategies/microsoft.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-microsoft';
import { MicrosoftProfileData } from '../../users/users.service';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
  constructor() {
    super({
      clientID: process.env.MICROSOFT_CLIENT_ID ?? '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      callbackURL:
        process.env.MICROSOFT_CALLBACK_URL ?? 'http://localhost:3000/api/auth/microsoft/callback',
      scope: ['user.read'],
      tenant: 'common', // cualquier cuenta Microsoft (personal + corporativa)
    });
  }

  validate(_at: string, _rt: string, profile: any, done: Function): void {
    const email =
      profile.emails?.[0]?.value ?? profile._json?.mail ?? profile._json?.userPrincipalName;
    if (!email) {
      done(new Error('La cuenta de Microsoft no expone un email'), undefined);
      return;
    }
    const data: MicrosoftProfileData = {
      microsoftId: profile.id,
      email,
      name: profile.displayName ?? email,
      avatarUrl: null, // Graph no devuelve foto en este scope básico
    };
    done(null, data);
  }
}
```

> ⚠️ **Gotcha de Microsoft (no pasa con Google):** el email puede venir en `mail`,
> en `userPrincipalName`, o en `emails[]` según el tipo de cuenta. Hay que cubrir los
> tres. Cuentas corporativas a veces NO tienen `mail` poblado — caen en `userPrincipalName`.

---

## 7. Dependencia

```bash
pnpm --filter @app/api add passport-microsoft
pnpm --filter @app/api add -D @types/passport-microsoft   # si existe; si no, declarar módulo
```

---

## 8. Plan de pruebas (manual, hackathon)

1. Sin credenciales en `.env` → `GET /api/auth/microsoft` devuelve **404** (guard).
2. `GET /api/auth/config` → `microsoftEnabled: false`.
3. Con credenciales → redirect a Microsoft, consent, callback setea cookie, vuelve al frontend.
4. Login con `@outlook.com` personal → crea usuario `pendiente`.
5. Login con cuenta corporativa M365 → email vía `userPrincipalName`, crea usuario.
6. Usuario local existente con mismo email → se **vincula** `microsoftId` (no duplica).
7. `ADMIN_EMAIL` con login Microsoft → recibe rol admin.

---

## 9. Riesgos y mitigaciones

| Riesgo                                                       | Severidad | Mitigación                                                   |
| ------------------------------------------------------------ | --------- | ------------------------------------------------------------ |
| Client secret de Azure expira                                | Media     | Anotar fecha; alerta de renovación.                          |
| Email ausente en cuentas corporativas                        | Media     | Fallback `mail → userPrincipalName → emails[]`.              |
| `@types/passport-microsoft` puede no existir                 | Baja      | Declaración de módulo manual en `*.d.ts`.                    |
| Colisión de email entre Google y Microsoft del mismo usuario | Baja      | El upsert por email ya vincula identidades.                  |
| Redirect URI mal configurada en Azure                        | Baja      | Documentar exacto en §3; error claro de Azure si no matchea. |

---

## 10. Estimación

| Bloque                       | Esfuerzo                           |
| ---------------------------- | ---------------------------------- |
| Registro en Azure Portal     | 15–20 min                          |
| Backend (archivos 1–10)      | 1–1.5 h (es copiar/adaptar Google) |
| Contracts + Frontend (11–13) | 30 min                             |
| Pruebas manuales (§8)        | 30 min                             |
| **Total**                    | **~2.5–3 h**                       |

---

## 11. Definición de "listo"

- [ ] App registrada en Azure, credenciales en `.env` (no commiteadas).
- [ ] `GET /api/auth/config` expone `microsoftEnabled`.
- [ ] Flujo completo funciona con cuenta personal y corporativa.
- [ ] Usuario local existente se vincula por email (sin duplicar).
- [ ] Migración de `microsoftId` aplicada.
- [ ] Botón "Continuar con Microsoft" visible solo si el flag está activo.
- [ ] `.env.example` documenta las nuevas vars.
