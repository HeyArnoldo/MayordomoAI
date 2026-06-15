import { createAzure } from '@ai-sdk/azure';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

/**
 * Provider IA — three options in priority order:
 *
 *   1. foundry  — Azure AI Foundry OpenAI-compatible endpoint (e.g. Grok from xAI).
 *                 Uses the `api-key` header (NOT `Authorization: Bearer`).
 *                 Source: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints
 *                 Base URL format: https://<resource>.services.ai.azure.com/openai/v1
 *                 Source: https://learn.microsoft.com/en-us/azure/foundry/how-to/model-inference-to-openai-migration
 *
 *   2. azure    — Azure OpenAI (classic resource, Microsoft-hosted models).
 *
 *   3. openai   — OpenAI direct (dev / testing).
 *
 * The app boots without any credentials; chat responds 503 until a provider is
 * configured (reproducibility for judges). Transcription (OPENAI_API_KEY) is
 * intentionally decoupled: OPENAI_API_KEY alone activates OpenAI transcription
 * but does NOT route the agent to OpenAI when Foundry vars are present.
 */

export type AIProvider = 'foundry' | 'azure' | 'openai' | 'none';

/** Determine the active provider in priority order. */
export function activeProvider(): AIProvider {
  if (process.env.FOUNDRY_API_KEY && process.env.FOUNDRY_BASE_URL) {
    return 'foundry';
  }
  if (process.env.AZURE_RESOURCE_NAME && process.env.AZURE_API_KEY) {
    return 'azure';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  return 'none';
}

export function isAiEnabled(): boolean {
  return activeProvider() !== 'none';
}

/**
 * Kept for backward compatibility: callers that specifically need to know
 * whether the active agent provider is OpenAI (e.g. feature-flag branches).
 */
export function usesOpenAi(): boolean {
  return activeProvider() === 'openai';
}

function provider() {
  const p = activeProvider();

  if (p === 'foundry') {
    // Azure AI Foundry OpenAI-compatible endpoint.
    // Auth: `api-key` header (NOT `Authorization: Bearer`).
    // Source: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/endpoints
    return createOpenAICompatible({
      name: 'foundry',
      baseURL: process.env.FOUNDRY_BASE_URL!,
      apiKey: process.env.FOUNDRY_API_KEY!,
      headers: { 'api-key': process.env.FOUNDRY_API_KEY! },
    });
  }

  if (p === 'azure') {
    return createAzure({
      resourceName: process.env.AZURE_RESOURCE_NAME,
      apiKey: process.env.AZURE_API_KEY,
    });
  }

  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/** Nombre del modelo/deployment del agente (también para registrar costos). */
export function agentModelName(): string {
  const p = activeProvider();
  if (p === 'foundry') return process.env.FOUNDRY_AGENT_MODEL ?? 'grok-4.3';
  if (p === 'azure') return process.env.AZURE_AGENT_DEPLOYMENT ?? 'gpt-4o';
  return process.env.OPENAI_AGENT_MODEL ?? 'gpt-4o';
}

/** Modelo del agente (razonamiento + tools). */
export function agentModel(): LanguageModel {
  return provider()(agentModelName());
}

/** Nombre del modelo/deployment barato (también para registrar costos). */
export function parserModelName(): string {
  const p = activeProvider();
  if (p === 'foundry') return process.env.FOUNDRY_PARSER_MODEL ?? 'grok-4.3';
  if (p === 'azure') return process.env.AZURE_PARSER_DEPLOYMENT ?? 'gpt-4o-mini';
  return process.env.OPENAI_PARSER_MODEL ?? 'gpt-4o-mini';
}

/** Modelo barato para parseo/fast-path. */
export function parserModel(): LanguageModel {
  return provider()(parserModelName());
}
