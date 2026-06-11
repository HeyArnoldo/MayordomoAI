# Agents League Hackathon — Dossier para MayordomoAI

> Todo lo investigado sobre el concurso: reglas, criterios de evaluación, el GitHub oficial, qué partes cumple MayordomoAI hoy, y cómo **presentar** (no inventar) el proyecto para que pase mucho mejor al momento de postular.

---

## 1. Datos generales del concurso

| Dato                       | Valor                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Nombre**                 | Agents League Hackathon                                                                               |
| **Organiza**               | Microsoft (dentro del **AI Skills Fest**)                                                             |
| **Formato**                | Online / virtual, estilo "esports" (live battles + community builds)                                  |
| **Premio total**           | $55,000 USD                                                                                           |
| **Costo**                  | Gratis (solo registro)                                                                                |
| **Registro oficial**       | `info.microsoft.com/Agents-League-Hackathon-Registration.html` (alias `aka.ms/agentsleague/register`) |
| **Reglas oficiales**       | `github.com/microsoft/Agents-League-AISF-Regulations` → `OFFICIAL RULES.md`                           |
| **Repo / submissions**     | `github.com/microsoft/agentsleague` (issues = submissions; starter kits por track)                    |
| **Discord**                | `aka.ms/agentsleague/discord` (+ Discord de Foundry: `discord.gg/nTYy5BXMWG`)                         |
| **Badge de participación** | Global AI Community → `globalai.community` (paso aparte, mismo email del registro)                    |

### Timeline crítico

- **Registro:** cierra **viernes 12 jun 2026, 12:00 PM Pacific** (= 2:00 PM Lima).
- **Periodo de hacking:** 4 jun – 14 jun 2026.
- **Submit del proyecto:** hasta **14 jun 2026, 11:59 PM Pacific** (= ~2:59 AM Lima del 15).

> ⚠️ El registro y la **activación del perfil** por email son obligatorios antes de poder submitear. Sin perfil activado, no hay submission.

---

## 2. Los tres tracks

| Track                                   | Herramienta obligatoria                | Para qué                                |
| --------------------------------------- | -------------------------------------- | --------------------------------------- |
| **Creative Apps**                       | GitHub Copilot (durante el desarrollo) | Apps creativas con IA                   |
| 🧠 **Reasoning Agents** ← _recomendado_ | **Microsoft Foundry** (para el agente) | Agentes que razonan en pasos / tool use |
| **Enterprise Agents**                   | Microsoft 365 Copilot                  | Agentes para el workplace               |

**Track recomendado: Reasoning Agents.**
El requisito es que el **agente** corra sobre Foundry / Azure OpenAI — no tu editor. Puedes seguir desarrollando con Claude. Con AI SDK, cambiar el provider de OpenAI directo a Azure OpenAI (Foundry) es prácticamente una línea:

```typescript
// Antes
import { openai } from '@ai-sdk/openai';
const model = openai('gpt-4o-mini');

// Después (Foundry)
import { azure } from '@ai-sdk/azure';
const model = azure('gpt-4o-mini');
```

> Ya tienes los **$100 de crédito de Azure for Students** verificados. Para un agente de finanzas con tool calling, $100 sobran (centavos por request con gpt-4o-mini).

---

## 3. Qué debe incluir la submission (obligatorio)

1. **Descripción del proyecto** — features, problema que resuelve, tecnologías.
2. **Video demo** en YouTube o Vimeo — **máximo 5 minutos**.
3. **Repositorio público en GitHub** con el código fuente.
4. **Diagrama de arquitectura** que muestre cómo usa Microsoft Foundry.
5. **Usernames de Microsoft Learn** de todos los participantes.

Se submitea desde el tab **"Projects"** de la plataforma (o "Create Project" desde el perfil activado).

---

## 4. Criterios de evaluación (cómo te juzgan)

Dos estructuras de premiación: **submissions asíncronas en GitHub** (la mayor parte del pool, juzgadas por ejecución técnica, innovación y alineación al track) y **Live Reactor Battles** (face-offs en vivo).

Pesos del jurado para las submissions:

| Criterio                     | Peso | Qué buscan                                            |
| ---------------------------- | ---- | ----------------------------------------------------- |
| **Accuracy & Relevance**     | 20%  | Problema real, resultados correctos, no demo vacío    |
| **Reasoning & Multi-step**   | 20%  | Razonamiento explícito, tool use encadenado, memoria  |
| **Creativity & Originality** | 15%  | Que no sea "otro chatbot"                             |
| **UX & Presentation**        | 15%  | Demo claro, visual, convincente                       |
| **Reliability & Safety**     | 20%  | Guardrails, auditoría, manejo de errores, aislamiento |
| **Community vote (Discord)** | 10%  | Visibilidad y votos en Discord                        |

> El 10% comunitario es el más fácil de descuidar y el más barato de ganar: presentarte en Discord, ser activo, pedir feedback en el canal de Reasoning Agents.

### Premios a los que MayordomoAI puede aplicar

| Premio                   | Monto                                        | Requisito                                        |
| ------------------------ | -------------------------------------------- | ------------------------------------------------ |
| **Best Reasoning Agent** | $5,000 + Azure Credits + GitHub Copilot Pro+ | Track principal                                  |
| **Best Overall Agent**   | $15,000                                      | Dominar el jurado                                |
| **Top Student Award**    | Badge + Azure Credits + GitHub Pro+          | Eres estudiante (UTP) ✅                         |
| **Hack for Good**        | Badge + Azure Credits                        | Finanzas personales = necesidad real en LATAM ✅ |
| **Accessibility Award**  | —                                            | Si trabajas accesibilidad                        |

---

## 5. El GitHub del concurso — qué aprender de ahí

El repo `github.com/microsoft/agentsleague` tiene:

- **Starter kits por track** en `starter-kits/2-reasoning-agents` (guías de setup de Foundry).
- **Issues = submissions públicas** (~104 de la edición pasada). Útil para ver el nivel y robar patrones de presentación.

### Proyecto ganador anterior — CertPrep Multi-Agent System (Reasoning Agents)

Sistema multi-agente para prep de certificaciones Microsoft. **8 agentes especializados** (Profiling, StudyPlan, LearningPath, ReadinessTracker, MockAssessment, Recommendation, +2). Lo que impresionó:

- **3-tier LLM fallback chain** → corría sin credenciales Azure en modo mock (< 1s).
- **17-rule guardrail pipeline** entre agentes.
- OpenTelemetry visible en Foundry, Adaptive Cards human-in-the-loop, Bicep deploy.

### Submissions destacadas y qué robarles

| Proyecto                  | Diferenciador                                                                     | Aplicación a MayordomoAI                                                                      |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **CertPrepAgents** (#128) | Loop de remediación adaptativa + **zero Azure spend** con GitHub Models free tier | Tu sistema de `pendientes` **ya es** un loop adaptativo. Nómbralo así.                        |
| **SentinelSage** (#126)   | El LLM es **opcional**; modo determinístico sin API key → demo 100% reproducible  | Implementa **modo demo sin credenciales** (datos mock). Crítico para el video.                |
| **Motia-Atlas** (#136)    | **Replayability** — cada decisión trazable y reproducible                         | Tu tabla `audit_tools` **ya es** el replay trail. Muéstrala como "historial de razonamiento". |
| **CertOS** (#125)         | Confidence scoring, dificultad adaptativa                                         | Muestra confianza al parsear voz/montos: _"Entendí S/80 (confianza: alta) — ¿confirmas?"_     |

---

## 6. Qué partes de MayordomoAI **ya cumplen** (autoevaluación honesta)

| Criterio jurado                  | Estado           | Evidencia en el proyecto                                                                                                                                                                                           |
| -------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Accuracy & Relevance** 20%     | ✅ Fuerte        | Tool calling real sobre datos reales; problema real (finanzas personales LATAM), no demo vacío.                                                                                                                    |
| **Reasoning & Multi-step** 20%   | ✅ Fuerte        | Bucle agéntico con herramientas encadenadas (`consultar_movimientos → agregar_gastos → saldo_cajas`); memoria de conversación; `pendientes` (loop adaptativo).                                                     |
| **Creativity & Originality** 15% | ✅ Fuerte        | WhatsApp + voz + mini-cajas es un combo poco visto en hackathons.                                                                                                                                                  |
| **UX & Presentation** 15%        | ✅ Fuerte        | WhatsApp es **muy demostrable** en video (real, no mockup); + PWA con chat y voz.                                                                                                                                  |
| **Reliability & Safety** 20%     | ✅ Fuerte        | Aislamiento por `user_id` (inyectado por backend, nunca por el modelo); soft delete + `deleted_at`; `audit_tools`; confirmaciones en montos altos/voz; tope de iteraciones; anti-prompt-injection (input = datos). |
| **Community vote** 10%           | ⚡ Pendiente     | Hay que trabajar Discord.                                                                                                                                                                                          |
| **Requisito Foundry**            | ⚙️ Falta el swap | Cambiar provider a Azure OpenAI (1 línea con AI SDK).                                                                                                                                                              |

**Brechas reales a cerrar antes del submit:**

1. **Correr el agente sobre Foundry/Azure OpenAI** (no opcional para el track).
2. **Modo demo mock** sin credenciales ni WhatsApp en vivo (para que nada falle en el video).
3. **Diagrama de arquitectura** que muestre Foundry explícitamente.
4. **Presencia en Discord** para el 10% comunitario.

---

## 7. Cómo "maquillar" mejor el proyecto (presentar, no inventar)

> Regla: **no inventas features**. Tomas lo que MayordomoAI **ya hace** y lo nombras/presentas con el vocabulario que los jueces premian. Todo lo de abajo ya existe en tu arquitectura; solo cambia cómo lo cuentas.

### 7.1 Renombra tu lógica como "patrones de razonamiento explícitos"

Los jueces premian nombres concretos. Tu sistema ya implementa estos patrones — declarálos en el README:

- **Planner-Executor** → el agente decide qué herramientas llamar y en qué orden.
- **Adaptive clarification loop** → _"el agente no descarta ambigüedades: las acumula como `pendientes` y las resuelve en una sola tanda antes del cierre del día."_
- **Critic / Verifier** → confirmación en montos altos / transcripciones dudosas antes de escribir.
- **Role-based specialization** → ver 7.2.

### 7.2 Preséntalo como sistema **multi-agente** (sin reescribir nada)

El ganador tenía 8 agentes; eso suma puntos. Tu misma lógica, renombrada como pipeline de 3 agentes especializados:

- **CategorizadorAgent** — clasifica cada movimiento contra las cajas (ingesta nocturna).
- **ConsultorAgent** — responde preguntas libres sobre los datos (tool use de lectura).
- **RegistradorAgent** — escribe movimientos con confirmación.

No cambias el código de fondo: cambias la **narrativa de arquitectura** y el diagrama.

### 7.3 Convierte `audit_tools` en un "Historial de razonamiento" visible

Ya guardas qué herramienta llamó el agente y con qué argumentos. Muéstralo en el dashboard como un **reasoning trail** que el usuario puede ver paso a paso. Eso es exactamente la "replayability" que impresionó en Motia-Atlas.

### 7.4 Modo demo "zero-spend" reproducible

Datos mock hardcodeados + agente que corre offline (sin Azure ni WhatsApp en vivo). Doble beneficio: **nada falla en el video** y muestras buena ingeniería (igual que CertPrep y SentinelSage). Para el demo puedes incluso usar **GitHub Models free tier** y mencionar el zero Azure spend como punto fuerte.

### 7.5 Confidence scoring en voz/montos

Ya confirmas en montos altos. Súbele un escalón mostrando confianza explícita:

> _"Entendí: gasto S/80 en Empresa (confianza: alta) — ¿confirmas?"_
> _"Entendí algo entre S/8 y S/80 (confianza: baja) — ¿cuánto fue exactamente?"_

### 7.6 Lo que el **video** debe mostrar (15% de UX + refuerza Reasoning)

- Una pregunta real que dispare **multi-step visible**: _"¿En qué gasté más esta semana y cuánto me queda en cada caja?"_ → se ve al agente llamar `consultar_movimientos → agregar_gastos → saldo_cajas` en secuencia.
- Narra los pasos en voz alta: _"llamó esta herramienta, procesó el resultado, luego llamó la siguiente..."_. Hazlo **visible**, no solo el resultado final.
- El **cierre nocturno con pendientes** en vivo: 6 claras + 2 dudosas → pregunta → resuelve. Ese es tu mejor momento de "reasoning".
- Una nota de voz de WhatsApp → transcripción → registro. Es el "wow" diferenciador.
- Termina mostrando los **guardrails** (aislamiento por usuario, soft delete, auditoría) en 20 segundos.

### 7.7 README del repo — estructura que los jueces escanean

```markdown
# MayordomoAI 🤖💸

Agente conversacional de finanzas personales vía WhatsApp y PWA.

## Track

Reasoning Agents — Microsoft AI Foundry

## Reasoning patterns

- Planner-Executor (orquestación de herramientas)
- Adaptive clarification loop (pendientes → cierre nocturno)
- Critic/Verifier (confirmación en montos altos / voz)
- Role-based specialization (Categorizador / Consultor / Registrador)

## Safety & Reliability

Aislamiento por user_id · soft delete + auditoría (audit_tools) ·
tope de iteraciones · input tratado como datos (anti prompt-injection)

## Stack

NestJS · React/Vite · PostgreSQL · Evolution API · Azure OpenAI (Foundry) · AI SDK

## Demo mode (zero-spend)

Corre con datos mock sin credenciales Azure ni WhatsApp.

## Architecture

[diagrama con Foundry]

## Demo video

[link YouTube/Vimeo ≤ 5 min]
```

---

## 8. Checklist final de postulación

| #   | Tarea                                                           | Estado |
| --- | --------------------------------------------------------------- | ------ |
| 1   | Registro en página oficial (antes del 12 jun, 2PM Lima)         | ⬜     |
| 2   | Activar perfil por email de confirmación                        | ⬜     |
| 3   | Unirse al Discord + presentarse en canal Reasoning Agents       | ⬜     |
| 4   | Leer starter kit `starter-kits/2-reasoning-agents`              | ⬜     |
| 5   | Swap provider AI SDK → Azure OpenAI (Foundry)                   | ⬜     |
| 6   | Modo demo mock (datos hardcodeados, offline)                    | ⬜     |
| 7   | Repo público con README "maquillado" (sección 7.7)              | ⬜     |
| 8   | Diagrama de arquitectura mostrando Foundry                      | ⬜     |
| 9   | Video demo ≤ 5 min (multi-step visible + cierre nocturno + voz) | ⬜     |
| 10  | Usernames de Microsoft Learn listos                             | ⬜     |
| 11  | Submit en tab "Projects" (antes del 14 jun, 11:59PM PT)         | ⬜     |
| 12  | Cuenta en `globalai.community` para el badge                    | ⬜     |

---

### Resumen en una línea

MayordomoAI ya cumple ~5 de 6 criterios de fondo. Lo que falta no es construir más, sino **(a)** correrlo sobre Foundry, **(b)** un modo demo a prueba de fallos, y **(c)** **renombrar y presentar** lo que ya tienes con el vocabulario de "reasoning patterns + multi-agente + safety" que el jurado premia.
