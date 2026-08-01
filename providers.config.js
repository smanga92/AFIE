/**
 * AFIE V2B — Provider Configuration
 *
 * Single source of truth for all news and AI provider settings.
 *
 * Adding or switching a provider requires only editing this file.
 * No engine, pipeline, or reasoning code changes are needed.
 *
 * ── AI Provider priority ──────────────────────────────────────────────────
 *
 * The engine uses providers in this order:
 *   1. primaryProvider   — used for all Pass 2 reasoning calls
 *   2. classificationProvider — used for faster/cheaper classification tasks
 *   3. fallbackProvider  — used if primary fails (optional)
 *
 * To switch AI providers, change `primaryProvider` to any registered id.
 *
 * ── News Provider enable/disable ─────────────────────────────────────────
 *
 * Set `enabled: false` on any news provider to disable it without removing it.
 * Priority determines collection order; higher priority sources are collected
 * first and get preference in duplicate resolution.
 */

export const PROVIDERS_CONFIG = {

  // ── AI Providers ──────────────────────────────────────────────────────────

  ai: {
    // Which registered AI provider to use for Pass 2 reasoning
    primaryProvider: 'anthropic',

    // Which registered AI provider to use for Pass 1 classification tasks
    // (cheaper/faster model preferred)
    classificationProvider: 'anthropic',

    // Fallback provider if primary fails — set to null to disable fallback
    fallbackProvider: null,

    // Whether to attempt fallback automatically on primary failure
    autoFallback: false,

    // Registry of all configured AI providers
    // To add a new provider: add an entry here and implement its adapter in providers/ai/
    registry: {

      anthropic: {
        id:       'anthropic',
        name:     'Anthropic Claude',
        adapter:  'AnthropicProvider',
        enabled:  true,
        models: {
          primary:        'claude-opus-4-6',
          classification: 'claude-haiku-4-5-20251001',
          narrative:      'claude-opus-4-6',
        },
        auth: {
          // Read from environment — never hardcode keys
          apiKeyEnv: 'ANTHROPIC_API_KEY',
        },
        limits: {
          maxTokens:    180_000,
          maxOutputTokens: 8_000,
          requestsPerMinute: 60,
        },
        defaults: {
          temperature: 0.2,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelayMs: 3_000,
        },
      },

      openai: {
        id:       'openai',
        name:     'OpenAI',
        adapter:  'OpenAIProvider',
        enabled:  false,        // placeholder — enable when API key is configured
        models: {
          primary:        'gpt-4o',
          classification: 'gpt-4o-mini',
          narrative:      'gpt-4o',
        },
        auth: {
          apiKeyEnv: 'OPENAI_API_KEY',
        },
        limits: {
          maxTokens:       128_000,
          maxOutputTokens: 4_096,
          requestsPerMinute: 60,
        },
        defaults: {
          temperature: 0.2,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelayMs: 3_000,
        },
      },

      google: {
        id:       'google',
        name:     'Google Gemini',
        adapter:  'GoogleProvider',
        enabled:  false,        // placeholder
        models: {
          primary:        'gemini-1.5-pro',
          classification: 'gemini-1.5-flash',
          narrative:      'gemini-1.5-pro',
        },
        auth: {
          apiKeyEnv: 'GOOGLE_AI_API_KEY',
        },
        limits: {
          maxTokens:       1_000_000,
          maxOutputTokens: 8_192,
          requestsPerMinute: 60,
        },
        defaults: {
          temperature: 0.2,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelayMs: 3_000,
        },
      },

      openrouter: {
        id:       'openrouter',
        name:     'OpenRouter',
        adapter:  'OpenRouterProvider',
        enabled:  false,        // placeholder — enables access to many models via one endpoint
        models: {
          primary:        'anthropic/claude-opus-4-6',
          classification: 'anthropic/claude-haiku-4-5',
          narrative:      'anthropic/claude-opus-4-6',
        },
        auth: {
          apiKeyEnv: 'OPENROUTER_API_KEY',
          baseUrl:   'https://openrouter.ai/api/v1',
        },
        limits: {
          maxTokens:       200_000,
          maxOutputTokens: 8_000,
          requestsPerMinute: 20,
        },
        defaults: {
          temperature: 0.2,
          retryOnFailure: true,
          maxRetries: 2,
          retryDelayMs: 5_000,
        },
      },

      local: {
        id:       'local',
        name:     'Local Model (Ollama)',
        adapter:  'LocalModelProvider',
        enabled:  false,        // placeholder — for air-gapped or cost-free operation
        models: {
          primary:        'llama3.1:70b',
          classification: 'llama3.1:8b',
          narrative:      'llama3.1:70b',
        },
        auth: {
          baseUrl: 'http://localhost:11434',
        },
        limits: {
          maxTokens:       32_000,
          maxOutputTokens: 4_000,
          requestsPerMinute: 10,
        },
        defaults: {
          temperature: 0.2,
          retryOnFailure: true,
          maxRetries: 1,
          retryDelayMs: 5_000,
        },
      },

    }, // end registry
  }, // end ai

  // ── News Providers ────────────────────────────────────────────────────────
  // Full source definitions remain in config/sources.config.js.
  // This section controls provider-level behaviour.

  news: {
    // Global defaults applied to all news providers unless overridden
    defaults: {
      timeoutMs:         10_000,
      maxArticleAgeHours: 72,
      minBodyLengthChars: 200,
    },

    // Circuit breaker — shared settings for all news providers
    circuitBreaker: {
      failureThreshold:      3,
      pauseDurationMinutes: 15,
      failureWindowMinutes:   5,
    },

    // Provider priority groups (higher = collected first, wins duplicate resolution)
    // Add new provider IDs here when registering them in sources.config.js
    priorityGroups: {
      tier1: ['federal_reserve', 'ecb', 'bank_of_england', 'bank_of_japan', 'bls_gov', 'sec_gov'],
      tier2: ['reuters_markets', 'bloomberg_markets', 'financial_times', 'newsapi_financial'],
      tier3: ['cnbc_markets', 'marketwatch', 'forexlive', 'coindesk', 'kitco_news', 'investing_com'],
    },
  },

  // ── Evidence Enrichment ───────────────────────────────────────────────────

  enrichment: {
    // Whether the Evidence Enrichment Layer is active
    enabled: true,

    // Which AI provider to use for enrichment reasoning
    // Can differ from the primary reasoning provider
    aiProvider: 'anthropic',

    // Triggers that activate enrichment for an FKO
    // Each can be individually disabled
    triggers: {
      lowSourceCount:       { enabled: true,  threshold: 2 },   // fewer than N sources
      hasContestedFacts:    { enabled: true },                   // any isContested: true
      missingOfficialSource:{ enabled: true,  minConfidence: 60 }, // no tier-1 source + high-conf story
      highImpactAssets:     { enabled: true,  minImpactCount: 2 }, // 2+ high-strength asset impacts
      breakingStatus:       { enabled: true },                   // status === 'breaking'
    },

    // Maximum enrichment searches per FKO (prevents runaway calls)
    maxSearchesPerFko: 4,

    // Search provider for evidence gathering
    // 'web' uses a web search API; 'internal' searches existing story store only
    searchProvider: 'internal',    // safe default — no external API required

    // Timeout for each enrichment search
    searchTimeoutMs: 8_000,
  },

  // ── Re-analysis ───────────────────────────────────────────────────────────

  reanalysis: {
    // Which AI provider to use for re-analysis
    // Should differ from primary to provide independent perspective
    defaultProvider: 'anthropic',

    // Default model for re-analysis (can override per request)
    // Set to a different model than primary for genuine independence
    defaultModel: 'claude-opus-4-6',

    // Store location for re-analysis results
    storeDir: process.env.AFIE_REANALYSIS_DIR || './data/reanalysis',

    // Whether to automatically compare re-analysis to original
    autoCompare: true,
  },

};

/**
 * Returns the configuration for the currently active AI provider.
 * @param {'primary'|'classification'|'fallback'} [role='primary']
 */
export function getActiveAIProvider(role = 'primary') {
  const cfg = PROVIDERS_CONFIG.ai;
  const id  = role === 'classification' ? cfg.classificationProvider
            : role === 'fallback'       ? cfg.fallbackProvider
            : cfg.primaryProvider;
  if (!id) return null;
  return cfg.registry[id] ?? null;
}

/**
 * Returns the model string for a given role.
 * @param {'primary'|'classification'|'narrative'} modelRole
 * @param {'primary'|'classification'} [providerRole='primary']
 */
export function getModelForRole(modelRole = 'primary', providerRole = 'primary') {
  const provider = getActiveAIProvider(providerRole);
  return provider?.models?.[modelRole] ?? null;
}
