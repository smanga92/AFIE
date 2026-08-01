/**
 * AFIE AIProviderRegistry
 *
 * Routes all AI calls to the currently configured provider.
 *
 * This is the single point through which every AI call in AFIE passes.
 * No module knows which provider is active — they call this registry.
 *
 * The registry:
 *   - Selects the active provider from PROVIDERS_CONFIG
 *   - Instantiates and caches provider instances
 *   - Routes to the fallback provider if primary fails and autoFallback is on
 *   - Emits telemetry events for cost tracking and debugging
 *
 * All existing callers (FactExtractor, ReasoningEngine, MorningBriefGenerator)
 * continue to use utils/AIClient.js which now delegates here.
 * They are unaware of this registry's existence.
 */

import { PROVIDERS_CONFIG, getActiveAIProvider } from '../../config/providers.config.js';
import { AnthropicProvider }                      from './AnthropicProvider.js';
import {
  OpenAIProvider,
  GoogleProvider,
  OpenRouterProvider,
  LocalModelProvider,
} from './ProviderPlaceholders.js';
import { EventBus } from '../../core/EventBus.js';
import { Logger }   from '../../core/Logger.js';

const logger = new Logger('AIProviderRegistry');

// Provider adapter factory
const ADAPTER_MAP = {
  AnthropicProvider,
  OpenAIProvider,
  GoogleProvider,
  OpenRouterProvider,
  LocalModelProvider,
};

// Instance cache — one instance per provider id
const _instances = new Map();

/**
 * Returns (or creates) a provider instance for the given provider config.
 */
function getInstance(providerConfig) {
  if (_instances.has(providerConfig.id)) {
    return _instances.get(providerConfig.id);
  }
  const AdapterClass = ADAPTER_MAP[providerConfig.adapter];
  if (!AdapterClass) {
    throw new Error(
      `No adapter found for "${providerConfig.adapter}". ` +
      `Register it in AIProviderRegistry.ADAPTER_MAP.`
    );
  }
  const instance = new AdapterClass(providerConfig);
  _instances.set(providerConfig.id, instance);
  return instance;
}

/**
 * The main entry point — called by utils/AIClient.js (and by ReanalysisEngine directly).
 *
 * @param {import('./BaseAIProvider.js').AIRequest} request
 * @param {Object} [options]
 * @param {string} [options.providerRole] - 'primary' | 'classification' | 'fallback'
 * @param {string} [options.providerOverrideId] - force a specific provider by id
 * @returns {Promise<import('./BaseAIProvider.js').AIResponse>}
 */
export async function dispatchAICall(request, options = {}) {
  const { providerRole = 'primary', providerOverrideId } = options;
  const cfg = PROVIDERS_CONFIG.ai;

  // Resolve provider config
  let providerConfig = providerOverrideId
    ? cfg.registry[providerOverrideId]
    : getActiveAIProvider(providerRole);

  if (!providerConfig) {
    throw new Error(`No AI provider configured for role "${providerRole}".`);
  }

  const provider = getInstance(providerConfig);

  if (!provider.isAvailable()) {
    // Try fallback if configured
    if (cfg.autoFallback && cfg.fallbackProvider) {
      logger.warn(
        `Provider "${providerConfig.id}" is not available. ` +
        `Falling back to "${cfg.fallbackProvider}".`
      );
      const fallbackConfig = cfg.registry[cfg.fallbackProvider];
      if (fallbackConfig) {
        providerConfig = fallbackConfig;
      }
    } else {
      throw new Error(
        `AI provider "${providerConfig.id}" is not available. ` +
        `Check that the required API key environment variable is set ` +
        `and that enabled: true in providers.config.js.`
      );
    }
  }

  const startMs = Date.now();

  try {
    const response = await getInstance(providerConfig).completeWithRetry(request);

    EventBus.emit('ai:call:complete', {
      providerId:   response.providerId,
      model:        response.model,
      inputTokens:  response.inputTokens,
      outputTokens: response.outputTokens,
      durationMs:   Date.now() - startMs,
      role:         providerRole,
    });

    return response;

  } catch (err) {
    EventBus.emit('ai:call:error', {
      providerId: providerConfig.id,
      error:      err.message,
      durationMs: Date.now() - startMs,
    });
    throw err;
  }
}

/**
 * Lists all configured providers with their availability status.
 * Used by diagnostics and the future UI settings panel.
 */
export function listProviders() {
  return Object.values(PROVIDERS_CONFIG.ai.registry).map(cfg => ({
    id:        cfg.id,
    name:      cfg.name,
    enabled:   cfg.enabled,
    available: !!process.env[cfg.auth?.apiKeyEnv || ''],
    isPrimary: cfg.id === PROVIDERS_CONFIG.ai.primaryProvider,
    isClassification: cfg.id === PROVIDERS_CONFIG.ai.classificationProvider,
    models:    cfg.models,
  }));
}

/**
 * Switches the active primary provider at runtime (no restart required).
 * The change persists only for the current process lifetime.
 *
 * @param {string} providerId
 */
export function setPrimaryProvider(providerId) {
  if (!PROVIDERS_CONFIG.ai.registry[providerId]) {
    throw new Error(`Unknown provider id: "${providerId}"`);
  }
  PROVIDERS_CONFIG.ai.primaryProvider = providerId;
  logger.info(`Primary AI provider switched to: ${providerId}`);
  EventBus.emit('ai:provider:switched', { providerId });
}
