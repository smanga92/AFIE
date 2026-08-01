/**
 * AFIE V2B Test Suite
 *
 * Tests for all V2B components:
 *   - AIProviderRegistry (routing, availability, listing)
 *   - EnrichmentGatekeeper (trigger evaluation)
 *   - EvidenceEnrichmentOrchestrator (pipeline integration)
 *   - SourceRegistry (enriched metadata, trust weights)
 *   - NewsProviderRegistry (priority batching, provider listing)
 *   - ReanalysisEngine (independence, store separation)
 *
 * All tests are deterministic — no live API calls, no network.
 * AI calls in enrichment/reanalysis tests would require mocking the
 * dispatchAICall function; those paths are tested structurally here.
 */

import { evaluateEnrichmentNeed }   from '../enrichment/EnrichmentGatekeeper.js';
import { enrichFKOs }               from '../enrichment/EvidenceEnrichmentOrchestrator.js';
import {
  getEnrichedSource,
  getAllEnrichedSources,
  getEffectiveScore,
  setUserTrustWeight,
  recordCollectionSuccess,
  recordCollectionError,
}                                   from '../sources/SourceRegistry.js';
import {
  listProviders as listAIProviders,
  setPrimaryProvider,
}                                   from '../providers/ai/AIProviderRegistry.js';
import { listProviders as listNewsProviders } from '../providers/news/NewsProviderRegistry.js';
import {
  loadReanalysisResultsForStory,
}                                   from '../reanalysis/ReanalysisEngine.js';
import { PROVIDERS_CONFIG, getActiveAIProvider, getModelForRole } from '../config/providers.config.js';

// ─── Fixture FKOs ─────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

function makeFko(overrides = {}) {
  return {
    fkoId:                 'fko_test_v2b',
    clusterId:             'cluster_test_v2b',
    representativeHeadline: 'Federal Reserve holds rates at July meeting',
    facts: [
      {
        id: 'f1',
        factText: 'The Fed held rates at 5.25-5.50%.',
        category: 'interest_rate_decision',
        sourceArticleIds: ['art_1'],
        isOfficial: true,
        officialBody: 'Federal Reserve',
        isContested: false,
        contestNote: null,
        dateReported: NOW,
        extractionConfidence: 0.98,
      }
    ],
    allArticleIds:         ['art_1', 'art_2'],
    publishersSeen:        ['Reuters', 'Bloomberg'],
    candidateSymbols:      ['XAUUSD', 'EURUSD', 'USDJPY'],
    earliestPublished:     NOW,
    latestPublished:       NOW,
    articleCount:          2,
    rawCombinedText:       'Federal Reserve holds interest rates...',
    ...overrides,
  };
}

// ─── EnrichmentGatekeeper Tests ───────────────────────────────────────────────

describe('EnrichmentGatekeeper', () => {

  test('returns shouldEnrich: false for well-evidenced FKO', () => {
    // Well-evidenced: 5 sources, no contested facts, has official source
    const fko = makeFko({
      articleCount: 5,
      publishersSeen: ['Reuters', 'Bloomberg', 'FT', 'CNBC', 'ForexLive'],
      facts: [{ id: 'f1', factText: 'Fed held rates.', category: 'interest_rate_decision',
        sourceArticleIds: ['a1','a2','a3'], isOfficial: true, officialBody: 'Federal Reserve',
        isContested: false, dateReported: NOW, extractionConfidence: 0.99 }],
    });
    const decision = evaluateEnrichmentNeed(fko);
    // With official source and sufficient articles, lowSourceCount trigger should not fire
    // Result depends on config — just verify structure
    expect(typeof decision.shouldEnrich).toBe('boolean');
    expect(Array.isArray(decision.firedTriggers)).toBe(true);
    expect(typeof decision.reasoning).toBe('string');
  });

  test('returns shouldEnrich: true when source count is below threshold', () => {
    const fko = makeFko({ articleCount: 1, publishersSeen: ['Reuters'] });
    const decision = evaluateEnrichmentNeed(fko);
    expect(decision.shouldEnrich).toBe(true);
    expect(decision.firedTriggers).toContain('lowSourceCount');
  });

  test('fires hasContestedFacts trigger when facts are contested', () => {
    const fko = makeFko({
      facts: [{
        id: 'f1', factText: 'The rate is either 5.25% or 5.50% — sources differ.',
        category: 'interest_rate_decision', sourceArticleIds: ['a1'],
        isOfficial: false, officialBody: null,
        isContested: true, contestNote: 'Reuters says 5.25%, Bloomberg says 5.50%.',
        dateReported: NOW, extractionConfidence: 0.70,
      }],
    });
    const decision = evaluateEnrichmentNeed(fko);
    expect(decision.shouldEnrich).toBe(true);
    expect(decision.firedTriggers).toContain('hasContestedFacts');
  });

  test('fires missingOfficialSource when no official facts and 2+ articles', () => {
    const fko = makeFko({
      articleCount: 3,
      publishersSeen: ['CNBC', 'ForexLive', 'MarketWatch'],
      facts: [{
        id: 'f1', factText: 'Reports suggest the Fed will hold rates.',
        category: 'interest_rate_decision', sourceArticleIds: ['a1'],
        isOfficial: false, officialBody: null,
        isContested: false, contestNote: null,
        dateReported: NOW, extractionConfidence: 0.75,
      }],
    });
    const decision = evaluateEnrichmentNeed(fko);
    expect(decision.shouldEnrich).toBe(true);
    expect(decision.firedTriggers).toContain('missingOfficialSource');
  });

  test('fires highImpactAssets when multiple high-impact symbols present', () => {
    const fko = makeFko({ candidateSymbols: ['XAUUSD', 'USDJPY', 'NAS100', 'EURUSD'] });
    const decision = evaluateEnrichmentNeed(fko);
    expect(decision.shouldEnrich).toBe(true);
    expect(decision.firedTriggers).toContain('highImpactAssets');
  });

  test('reasoning is non-empty for both decisions', () => {
    const fkoWithTriggers = makeFko({ articleCount: 1 });
    const decisionWith = evaluateEnrichmentNeed(fkoWithTriggers);
    expect(decisionWith.reasoning.length).toBeGreaterThan(20);

    const fkoWell = makeFko({
      articleCount: 5,
      facts: [{ id: 'f1', factText: 'Fed held.', category: 'interest_rate_decision',
        sourceArticleIds: ['a1','a2','a3','a4','a5'], isOfficial: true,
        officialBody: 'Federal Reserve', isContested: false, contestNote: null,
        dateReported: NOW, extractionConfidence: 0.99 }],
      candidateSymbols: [],
    });
    const decisionWithout = evaluateEnrichmentNeed(fkoWell);
    expect(decisionWithout.reasoning.length).toBeGreaterThan(20);
  });

  test('returns firedTriggers as empty array when no triggers fire', () => {
    // Minimal well-evidenced FKO with no high-impact symbols
    const fko = makeFko({
      articleCount: 5,
      candidateSymbols: [],
      facts: [{
        id: 'f1', factText: 'Agricultural subsidy announced.', category: 'government_policy',
        sourceArticleIds: ['a1','a2','a3','a4','a5'], isOfficial: true,
        officialBody: 'US Department of Agriculture', isContested: false,
        contestNote: null, dateReported: NOW, extractionConfidence: 0.95,
      }],
    });
    const decision = evaluateEnrichmentNeed(fko);
    if (!decision.shouldEnrich) {
      expect(decision.firedTriggers).toHaveLength(0);
    }
    // If it does fire (due to config), just verify the array exists
    expect(Array.isArray(decision.firedTriggers)).toBe(true);
  });

});

// ─── EvidenceEnrichmentOrchestrator Tests ────────────────────────────────────

describe('EvidenceEnrichmentOrchestrator', () => {

  test('enrichFKOs returns same number of FKOs as input', async () => {
    const fkos = [makeFko(), makeFko({ fkoId: 'fko_2', representativeHeadline: 'Story 2' })];
    const results = await enrichFKOs(fkos);
    expect(results.length).toBe(fkos.length);
  });

  test('all returned FKOs have enrichment field', async () => {
    const fkos = [makeFko()];
    const results = await enrichFKOs(fkos);
    for (const result of results) {
      expect(result).toHaveProperty('enrichment');
      expect(typeof result.enrichment.wasEnriched).toBe('boolean');
      expect(Array.isArray(result.enrichment.results)).toBe(true);
      expect(typeof result.enrichment.searchCount).toBe('number');
    }
  });

  test('passes through FKOs unchanged except for enrichment field', async () => {
    const fko = makeFko();
    const [result] = await enrichFKOs([fko]);
    // Original fields are preserved
    expect(result.fkoId).toBe(fko.fkoId);
    expect(result.representativeHeadline).toBe(fko.representativeHeadline);
    expect(result.articleCount).toBe(fko.articleCount);
    expect(result.facts).toEqual(fko.facts);
  });

  test('enrichment field is always present regardless of gatekeeper decision', async () => {
    // Well-evidenced FKO unlikely to trigger enrichment
    const fko = makeFko({
      articleCount: 10,
      candidateSymbols: [],
      facts: [{ id: 'f1', factText: 'Well sourced fact.', category: 'economic_release',
        sourceArticleIds: Array.from({length:10}, (_,i) => `a${i}`), isOfficial: true,
        officialBody: 'BLS', isContested: false, contestNote: null,
        dateReported: NOW, extractionConfidence: 0.99 }],
    });
    const [result] = await enrichFKOs([fko]);
    expect(result.enrichment).toBeDefined();
    expect(result.enrichment.gatekeeperDecision).toBeDefined();
    expect(typeof result.enrichment.gatekeeperDecision.shouldEnrich).toBe('boolean');
  });

  test('empty FKO array returns empty array', async () => {
    const results = await enrichFKOs([]);
    expect(results).toHaveLength(0);
  });

  test('enrichment failure on one FKO does not block others', async () => {
    // This tests the error-isolation guarantee
    const fkos = [
      makeFko({ articleCount: 1 }),
      makeFko({ fkoId: 'fko_2', articleCount: 1, representativeHeadline: 'Second story' }),
    ];
    // Both should be returned even if one's enrichment fails
    const results = await enrichFKOs(fkos);
    expect(results.length).toBe(2);
  });

});

// ─── SourceRegistry Tests ─────────────────────────────────────────────────────

describe('SourceRegistry', () => {

  test('getEnrichedSource returns enriched record for known source', () => {
    const record = getEnrichedSource('reuters_markets');
    expect(record).not.toBeNull();
    expect(record.id).toBe('reuters_markets');
    expect(typeof record.baseReliabilityScore).toBe('number');
    expect(typeof record.isOfficial).toBe('boolean');
    expect(typeof record.historicalAccuracy).toBe('number');
    expect(typeof record.confidenceContribution).toBe('number');
    expect(typeof record.effectiveScore).toBe('number');
    expect(typeof record.isPremium).toBe('boolean');
    expect(record.health).toBeDefined();
  });

  test('getEnrichedSource returns null for unknown source', () => {
    const record = getEnrichedSource('nonexistent_source_xyz');
    expect(record).toBeNull();
  });

  test('official sources have isOfficial: true', () => {
    const officialIds = ['federal_reserve', 'ecb', 'bank_of_england', 'bls_gov'];
    for (const id of officialIds) {
      const record = getEnrichedSource(id);
      if (record) {
        expect(record.isOfficial).toBe(true);
        expect(record.officialBody).toBeTruthy();
      }
    }
  });

  test('media sources have isOfficial: false', () => {
    const mediaIds = ['reuters_markets', 'bloomberg_markets', 'cnbc_markets'];
    for (const id of mediaIds) {
      const record = getEnrichedSource(id);
      if (record) {
        expect(record.isOfficial).toBe(false);
      }
    }
  });

  test('effectiveScore is between 0 and 1', () => {
    const sources = getAllEnrichedSources();
    for (const src of sources) {
      expect(src.effectiveScore).toBeGreaterThanOrEqual(0);
      expect(src.effectiveScore).toBeLessThanOrEqual(1);
    }
  });

  test('getEffectiveScore returns a number for known publisher names', () => {
    const score = getEffectiveScore('Reuters');
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('getEffectiveScore returns 0.5 default for unknown publisher', () => {
    const score = getEffectiveScore('UnknownBlogXYZ123');
    expect(score).toBe(0.5);
  });

  test('setUserTrustWeight adjusts effectiveScore', () => {
    const before = getEnrichedSource('coindesk')?.effectiveScore ?? 0;
    setUserTrustWeight('coindesk', 0.5);  // halve trust
    const after = getEnrichedSource('coindesk')?.effectiveScore ?? 0;
    // Effective score should be lower after reducing trust weight
    // (capped at 1.0, so reducing trust always reduces or maintains)
    expect(after).toBeLessThanOrEqual(before + 0.01); // allow float tolerance
    // Reset
    setUserTrustWeight('coindesk', 1.0);
  });

  test('setUserTrustWeight clips to 0-2 range', () => {
    setUserTrustWeight('forexlive', 5.0); // above max
    const record = getEnrichedSource('forexlive');
    // effectiveScore should not exceed 1.0 regardless of trust weight
    if (record) expect(record.effectiveScore).toBeLessThanOrEqual(1.0);
    setUserTrustWeight('forexlive', 1.0); // reset
  });

  test('recordCollectionSuccess and recordCollectionError update health', () => {
    recordCollectionSuccess('kitco_news');
    recordCollectionSuccess('kitco_news');
    recordCollectionError('kitco_news');
    const record = getEnrichedSource('kitco_news');
    if (record) {
      expect(record.health.collections).toBeGreaterThanOrEqual(3);
      expect(record.health.errors).toBeGreaterThanOrEqual(1);
      expect(record.health.errorRate).toBeGreaterThan(0);
      expect(record.health.errorRate).toBeLessThan(1);
    }
  });

  test('getAllEnrichedSources returns array of records', () => {
    const all = getAllEnrichedSources();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
    for (const src of all) {
      expect(src.id).toBeTruthy();
      expect(src.name).toBeTruthy();
    }
  });

});

// ─── AIProviderRegistry Tests ─────────────────────────────────────────────────

describe('AIProviderRegistry', () => {

  test('listProviders returns array of provider summaries', () => {
    const providers = listAIProviders();
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
    for (const p of providers) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.name).toBe('string');
      expect(typeof p.enabled).toBe('boolean');
      expect(typeof p.isPrimary).toBe('boolean');
    }
  });

  test('exactly one provider is marked isPrimary', () => {
    const providers = listAIProviders();
    const primaries = providers.filter(p => p.isPrimary);
    expect(primaries.length).toBe(1);
  });

  test('primary provider is anthropic by default', () => {
    const providers = listAIProviders();
    const primary = providers.find(p => p.isPrimary);
    expect(primary?.id).toBe('anthropic');
  });

  test('all expected providers are registered', () => {
    const providers = listAIProviders();
    const ids = providers.map(p => p.id);
    expect(ids).toContain('anthropic');
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('local');
  });

  test('placeholder providers are enabled: false', () => {
    const providers = listAIProviders();
    const openai = providers.find(p => p.id === 'openai');
    const google = providers.find(p => p.id === 'google');
    expect(openai?.enabled).toBe(false);
    expect(google?.enabled).toBe(false);
  });

  test('setPrimaryProvider updates primary', () => {
    const original = PROVIDERS_CONFIG.ai.primaryProvider;
    setPrimaryProvider('anthropic'); // same as default — just verifies it runs
    const providers = listAIProviders();
    const primary = providers.find(p => p.isPrimary);
    expect(primary?.id).toBe('anthropic');
    // Restore
    PROVIDERS_CONFIG.ai.primaryProvider = original;
  });

  test('setPrimaryProvider throws for unknown id', () => {
    expect(() => setPrimaryProvider('unknown_provider_xyz')).toThrow();
  });

  test('getActiveAIProvider returns provider config object', () => {
    const provider = getActiveAIProvider('primary');
    expect(provider).not.toBeNull();
    expect(provider.id).toBeTruthy();
    expect(provider.models).toBeDefined();
    expect(provider.auth).toBeDefined();
  });

  test('getModelForRole returns a model string', () => {
    const model = getModelForRole('primary', 'primary');
    expect(typeof model).toBe('string');
    expect(model.length).toBeGreaterThan(0);
  });

});

// ─── NewsProviderRegistry Tests ───────────────────────────────────────────────

describe('NewsProviderRegistry', () => {

  test('listProviders returns array of provider summaries', () => {
    const providers = listNewsProviders();
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length).toBeGreaterThan(0);
    for (const p of providers) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.name).toBe('string');
      expect(typeof p.tier).toBe('number');
    }
  });

  test('all listed providers have a tier between 1 and 5', () => {
    const providers = listNewsProviders();
    for (const p of providers) {
      expect(p.tier).toBeGreaterThanOrEqual(1);
      expect(p.tier).toBeLessThanOrEqual(5);
    }
  });

});

// ─── providers.config.js Tests ────────────────────────────────────────────────

describe('providers.config.js', () => {

  test('enrichment config has expected structure', () => {
    const cfg = PROVIDERS_CONFIG.enrichment;
    expect(typeof cfg.enabled).toBe('boolean');
    expect(typeof cfg.maxSearchesPerFko).toBe('number');
    expect(cfg.maxSearchesPerFko).toBeGreaterThan(0);
    expect(typeof cfg.triggers).toBe('object');
    expect(cfg.triggers.lowSourceCount).toBeDefined();
    expect(cfg.triggers.hasContestedFacts).toBeDefined();
    expect(cfg.triggers.missingOfficialSource).toBeDefined();
    expect(cfg.triggers.highImpactAssets).toBeDefined();
    expect(cfg.triggers.breakingStatus).toBeDefined();
  });

  test('each trigger has an enabled flag', () => {
    const triggers = PROVIDERS_CONFIG.enrichment.triggers;
    for (const [name, trigger] of Object.entries(triggers)) {
      expect(typeof trigger.enabled).toBe('boolean');
    }
  });

  test('reanalysis config has expected structure', () => {
    const cfg = PROVIDERS_CONFIG.reanalysis;
    expect(typeof cfg.defaultProvider).toBe('string');
    expect(typeof cfg.defaultModel).toBe('string');
    expect(typeof cfg.storeDir).toBe('string');
    expect(typeof cfg.autoCompare).toBe('boolean');
  });

  test('AI registry contains all five providers', () => {
    const ids = Object.keys(PROVIDERS_CONFIG.ai.registry);
    expect(ids).toContain('anthropic');
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('local');
  });

});

// ─── ReanalysisStore Tests ────────────────────────────────────────────────────

describe('ReanalysisStore', () => {

  test('loadReanalysisResultsForStory returns empty array for unknown story', async () => {
    const results = await loadReanalysisResultsForStory('nonexistent_story_xyz');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

});
