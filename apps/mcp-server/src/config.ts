import 'dotenv/config.js';
import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  MAYORDOMO_API_BASE_URL: z.string().url(),
  AGENT_TOOL_INTERNAL_KEY: z.string().min(1),
  MCP_AUTH_TOKEN: z.string().min(1),
});

type Config = z.infer<typeof Env>;

let _config: Config | undefined;

/**
 * Returns the validated config singleton.
 * Exits the process on the first call if any required env var is missing.
 * Calling this function in tests is safe as long as the test supplies
 * the required env vars (or mocks this module).
 */
export function getConfig(): Config {
  if (_config) return _config;

  const parsed = Env.safeParse(process.env);

  if (!parsed.success) {
    const missingFields = parsed.error.issues.map((i) => i.path.join('.'));
    console.error(
      '[mcp-server] Missing or invalid environment variables:',
      missingFields.join(', '),
    );
    console.error('[mcp-server] Check .env.example for the required variables.');
    process.exit(1);
  }

  _config = parsed.data;
  return _config;
}
