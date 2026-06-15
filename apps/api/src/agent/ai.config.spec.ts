import { activeProvider, isAiEnabled, agentModelName, parserModelName } from './ai.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EnvSnapshot = Record<string, string | undefined>;

const FOUNDRY_VARS = [
  'FOUNDRY_API_KEY',
  'FOUNDRY_BASE_URL',
  'FOUNDRY_AGENT_MODEL',
  'FOUNDRY_PARSER_MODEL',
];
const AZURE_VARS = ['AZURE_RESOURCE_NAME', 'AZURE_API_KEY'];
const OPENAI_VARS = ['OPENAI_API_KEY'];
const ALL_PROVIDER_VARS = [...FOUNDRY_VARS, ...AZURE_VARS, ...OPENAI_VARS];

function snapshotEnv(keys: string[]): EnvSnapshot {
  return Object.fromEntries(keys.map((k) => [k, process.env[k]]));
}

function restoreEnv(snapshot: EnvSnapshot): void {
  for (const [k, v] of Object.entries(snapshot)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

function clearProviderVars(): void {
  ALL_PROVIDER_VARS.forEach((k) => delete process.env[k]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ai.config', () => {
  let snapshot: EnvSnapshot;

  beforeEach(() => {
    snapshot = snapshotEnv(ALL_PROVIDER_VARS);
    clearProviderVars();
  });

  afterEach(() => {
    restoreEnv(snapshot);
  });

  // ── activeProvider() ─────────────────────────────────────────────────────

  describe('activeProvider()', () => {
    it('returns "foundry" when FOUNDRY_API_KEY + FOUNDRY_BASE_URL are set, even if OPENAI_API_KEY is also present', () => {
      // This is the key decoupling test: transcription may use OPENAI_API_KEY
      // but the agent must route to Foundry when Foundry vars are present.
      process.env.FOUNDRY_API_KEY = 'foundry-key';
      process.env.FOUNDRY_BASE_URL = 'https://mayordomoai.services.ai.azure.com/openai/v1';
      process.env.OPENAI_API_KEY = 'sk-openai-also-set';

      expect(activeProvider()).toBe('foundry');
    });

    it('returns "azure" when only Azure vars are set', () => {
      process.env.AZURE_RESOURCE_NAME = 'my-resource';
      process.env.AZURE_API_KEY = 'azure-key';

      expect(activeProvider()).toBe('azure');
    });

    it('returns "openai" when only OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-openai';

      expect(activeProvider()).toBe('openai');
    });

    it('returns "none" when no provider vars are set', () => {
      expect(activeProvider()).toBe('none');
    });

    it('returns "foundry" when FOUNDRY vars are set even if AZURE vars are also set', () => {
      process.env.FOUNDRY_API_KEY = 'foundry-key';
      process.env.FOUNDRY_BASE_URL = 'https://mayordomoai.services.ai.azure.com/openai/v1';
      process.env.AZURE_RESOURCE_NAME = 'my-resource';
      process.env.AZURE_API_KEY = 'azure-key';

      expect(activeProvider()).toBe('foundry');
    });

    it('requires BOTH FOUNDRY_API_KEY and FOUNDRY_BASE_URL — missing one falls through to next provider', () => {
      // Only one Foundry var → not enough; should fall through to none
      process.env.FOUNDRY_API_KEY = 'foundry-key';
      // FOUNDRY_BASE_URL intentionally omitted

      expect(activeProvider()).toBe('none');
    });
  });

  // ── isAiEnabled() ────────────────────────────────────────────────────────

  describe('isAiEnabled()', () => {
    it('returns false when no provider vars are set', () => {
      expect(isAiEnabled()).toBe(false);
    });

    it('returns true when Foundry vars are set', () => {
      process.env.FOUNDRY_API_KEY = 'foundry-key';
      process.env.FOUNDRY_BASE_URL = 'https://mayordomoai.services.ai.azure.com/openai/v1';

      expect(isAiEnabled()).toBe(true);
    });

    it('returns true when only OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'sk-openai';

      expect(isAiEnabled()).toBe(true);
    });
  });

  // ── agentModelName() ─────────────────────────────────────────────────────

  describe('agentModelName()', () => {
    it('returns default "grok-4.3" when Foundry is active and FOUNDRY_AGENT_MODEL is not set', () => {
      process.env.FOUNDRY_API_KEY = 'foundry-key';
      process.env.FOUNDRY_BASE_URL = 'https://mayordomoai.services.ai.azure.com/openai/v1';

      expect(agentModelName()).toBe('grok-4.3');
    });

    it('returns the custom model when FOUNDRY_AGENT_MODEL is set', () => {
      process.env.FOUNDRY_API_KEY = 'foundry-key';
      process.env.FOUNDRY_BASE_URL = 'https://mayordomoai.services.ai.azure.com/openai/v1';
      process.env.FOUNDRY_AGENT_MODEL = 'grok-3';

      expect(agentModelName()).toBe('grok-3');
    });

    it('returns "gpt-4o" default when Azure is active', () => {
      process.env.AZURE_RESOURCE_NAME = 'my-resource';
      process.env.AZURE_API_KEY = 'azure-key';

      expect(agentModelName()).toBe('gpt-4o');
    });

    it('returns "gpt-4o" default when OpenAI is active', () => {
      process.env.OPENAI_API_KEY = 'sk-openai';

      expect(agentModelName()).toBe('gpt-4o');
    });
  });

  // ── parserModelName() ────────────────────────────────────────────────────

  describe('parserModelName()', () => {
    it('returns default "grok-4.3" when Foundry is active and FOUNDRY_PARSER_MODEL is not set', () => {
      process.env.FOUNDRY_API_KEY = 'foundry-key';
      process.env.FOUNDRY_BASE_URL = 'https://mayordomoai.services.ai.azure.com/openai/v1';

      expect(parserModelName()).toBe('grok-4.3');
    });

    it('returns the custom parser model when FOUNDRY_PARSER_MODEL is set', () => {
      process.env.FOUNDRY_API_KEY = 'foundry-key';
      process.env.FOUNDRY_BASE_URL = 'https://mayordomoai.services.ai.azure.com/openai/v1';
      process.env.FOUNDRY_PARSER_MODEL = 'grok-3-mini';

      expect(parserModelName()).toBe('grok-3-mini');
    });

    it('returns "gpt-4o-mini" default when Azure is active', () => {
      process.env.AZURE_RESOURCE_NAME = 'my-resource';
      process.env.AZURE_API_KEY = 'azure-key';

      expect(parserModelName()).toBe('gpt-4o-mini');
    });

    it('returns "gpt-4o-mini" default when OpenAI is active', () => {
      process.env.OPENAI_API_KEY = 'sk-openai';

      expect(parserModelName()).toBe('gpt-4o-mini');
    });
  });
});
