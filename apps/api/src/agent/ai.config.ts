import { createAzure } from '@ai-sdk/azure';
import type { LanguageModel } from 'ai';

/**
 * Provider IA — Azure OpenAI (Microsoft Foundry), requisito del track
 * Reasoning Agents. La app bootea sin credenciales: el chat responde 503
 * amable hasta que AZURE_API_KEY exista (reproducibilidad para jueces).
 */
export function isAiEnabled(): boolean {
  return Boolean(process.env.AZURE_RESOURCE_NAME && process.env.AZURE_API_KEY);
}

function provider() {
  return createAzure({
    resourceName: process.env.AZURE_RESOURCE_NAME,
    apiKey: process.env.AZURE_API_KEY,
  });
}

/** Modelo del agente (razonamiento + tools). Deployment en Foundry: gpt-4o. */
export function agentModel(): LanguageModel {
  return provider()(process.env.AZURE_AGENT_DEPLOYMENT ?? 'gpt-4o');
}

/** Modelo barato para parseo/fast-path. Deployment: gpt-4o-mini. */
export function parserModel(): LanguageModel {
  return provider()(process.env.AZURE_PARSER_DEPLOYMENT ?? 'gpt-4o-mini');
}
