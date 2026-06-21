import { z } from 'zod';

const boolFlag = (defaultValue: boolean) =>
  z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default(defaultValue);

// Schema de variables de entorno. Se valida una sola vez al arrancar:
// si falta algo requerido, la API no levanta (mejor fallar temprano).
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  API_PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  FRONTEND_URL: z.string().min(1).default('http://localhost:5173'),

  AUTH_LOCAL_ENABLED: boolFlag(true),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  COOKIE_SECURE: boolFlag(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),

  // Google OAuth: opcional. Si CLIENT_ID + CLIENT_SECRET existen, se activa solo.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  // Admin inicial (seed). Ver README: con password = admin local; sin password = whitelist Google.
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  ADMIN_NAME: z.string().optional(),

  // Internal MCP / agent-tools API. Both are optional so existing deployments
  // that do not set them still boot. Endpoints are fail-closed by the guard
  // (401) when AGENT_TOOL_INTERNAL_KEY is absent, and the context service throws
  // a SERVICE_UNAVAILABLE error when FOUNDRY_DEMO_USER_ID is absent.
  AGENT_TOOL_INTERNAL_KEY: z.string().optional(),
  FOUNDRY_DEMO_USER_ID: z.string().optional(),

  // Azure AI Foundry OpenAI-compatible endpoint (e.g. Grok from xAI).
  // When FOUNDRY_API_KEY + FOUNDRY_BASE_URL are set, the agent routes to Foundry
  // regardless of whether OPENAI_API_KEY is also present (transcription decoupling).
  FOUNDRY_API_KEY: z.string().optional(),
  FOUNDRY_BASE_URL: z.string().optional(),
  FOUNDRY_AGENT_MODEL: z.string().optional(),
  FOUNDRY_PARSER_MODEL: z.string().optional(),

  // Evolution API (WhatsApp outbound). Opcionales para no romper despliegues
  // que no usan WhatsApp; cuando se usan, las tres deben estar para que el
  // envío salga del modo dev (ver EvolutionClient.enabled()).
  EVOLUTION_URL: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),
  // Token compartido del webhook inbound de WhatsApp.
  WA_WEBHOOK_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Usado por ConfigModule.forRoot({ validate })
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return parsed.data;
}
