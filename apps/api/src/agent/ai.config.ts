import { createAzure } from '@ai-sdk/azure';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/**
 * Provider IA — OpenAI directo (dev/pruebas) o Azure OpenAI (Microsoft
 * Foundry, requisito del track Reasoning Agents). Si OPENAI_API_KEY existe
 * se usa OpenAI; si no, Azure. La app bootea sin credenciales: el chat
 * responde 503 amable hasta que haya una key (reproducibilidad para jueces).
 */
export function isAiEnabled(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY || (process.env.AZURE_RESOURCE_NAME && process.env.AZURE_API_KEY),
  );
}

export function usesOpenAi(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function provider() {
  if (usesOpenAi()) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return createAzure({
    resourceName: process.env.AZURE_RESOURCE_NAME,
    apiKey: process.env.AZURE_API_KEY,
  });
}

/** Modelo del agente (razonamiento + tools). En Foundry: deployment gpt-4o. */
export function agentModel(): LanguageModel {
  const model = usesOpenAi()
    ? (process.env.OPENAI_AGENT_MODEL ?? 'gpt-4o')
    : (process.env.AZURE_AGENT_DEPLOYMENT ?? 'gpt-4o');
  return provider()(model);
}

/** Modelo barato para parseo/fast-path. En Foundry: deployment gpt-4o-mini. */
export function parserModel(): LanguageModel {
  const model = usesOpenAi()
    ? (process.env.OPENAI_PARSER_MODEL ?? 'gpt-4o-mini')
    : (process.env.AZURE_PARSER_DEPLOYMENT ?? 'gpt-4o-mini');
  return provider()(model);
}
