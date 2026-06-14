import 'dotenv/config.js';
import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  MAYORDOMO_API_BASE_URL: z.string().url(),
  AGENT_TOOL_INTERNAL_KEY: z.string().min(1),
  MCP_AUTH_TOKEN: z.string().min(1),
});

const parsed = Env.safeParse(process.env);

if (!parsed.success) {
  // List which fields are missing/invalid without printing their values.
  const missingFields = parsed.error.issues.map((i) => i.path.join('.'));
  console.error('[mcp-server] Missing or invalid environment variables:', missingFields.join(', '));
  console.error('[mcp-server] Check .env.example for the required variables.');
  process.exit(1);
}

export const config = parsed.data;
