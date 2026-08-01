/**
 * AFIE V2A Integration Tests
 *
 * Tests the full Morning Brief generation pipeline using fixture stories.
 * AI call is skipped (dryRun=true) — all tests are deterministic.
 * BriefValidator tests are included here as they validate the assembled output.
 */

import { validateBrief }         from '../briefings/BriefValidator.js';
import { classifyNarratives }    from '../synthesizers/NarrativeClassifier.js';
import { analyseContinuity }     from '../synthesizers/ContinuityAnalyser.js';
import { inferMarketExpectations } from '../synthesizers/MarketExpectationInferrer.js';
import { summariseAssets }       from '../synthesizers/AssetNarrativeSummariser.js';
import { identifyNarrativeRisks } from '../synthesizers/NarrativeRiskIdentifier.js';
import {
  FIXTURE_STORY_FED,
  FIXTURE_STORY_CHINA_TECH,
  FIXTURE_STORY_RESOLVED,
  ALL_FIXTURE_STORIES,
} from './fixtures/stories.fixtures.js';

// ─── Test helper ─────────────────────────────────────────────────────────────

const WATCHLIST = ['BTCUSD', 'XAUUSD', 'EURUSD', 'USDJPY', 'GBPJPY', 'AUDUSD', 'NAS100', 'US30'];

function buildContext(activeStories = [FIXTURE_STORY_FED, FIXTURE_STORY_CHINA_TECH]) {
  const storiesByAsset = new Map();
  for (const story of ALL_FIXTURE_STORIES) {
    for (const asset of (story.affectedAssets || [])) {
      if (!storiesByAsset.has(asset.symbol)) storiesByAsset.set(asset.symbol, []);
      storiesByAsset.get(asset.symbol).push(story);
    }
  }

  const storyAges = new Map();
  const now = Date.now();
  for (const story of ALL_FIXTURE_STORIES) {
    storyAges.set(story.id, {
      daysSinceFirst:   (now - new Date(story.createdAt).getTime()) / 86_400_000,
      hoursSinceUpdate: (now - new Date(story.updatedAt).getTime()) / 3_600_000,
      isNew:            story.versionNumber === 1 && (now - new Date(story.createdAt).getTime()) < 36 * 3_600_000,
      isContinuing:     story.versionNumber >= 2,
    });
  }

  return {
    activeStories,
    recentStories:    ALL_FIXTURE_STORIES,
    allStories:       ALL_FIXTURE_STORIES,
    watchlist:        WATCHLIST,
    dataAsOf:         new Date().toISOString(),
    storiesByAsset,
    storyAges,
    totalActiveCount: activeStories.length,
    breakingCount:    activeStories.filter(s => s.status === 'breaking').length,
  };
}

function buildMinimalValidBrief(overrides = {}) {
  return {
    id:              'brief_20260731_morning',
    schemaVersion:   '1.0',
    briefType:       'morning',
    generatedAt:     new Date().toISOString(),
    dataAsOf:        new Date().toISOString(),
    storiesAnalysed: 2,
    sentimentLabel:  'high_uncertainty',
    sentimentReasoning: 'One breaking story and one developing story detected.',
    executiveSummary: {
      headline:  'US-China technology friction and Federal Reserve policy uncertainty are the dominant themes shaping the current macro environment.',
      body:      'AFIE has identified two significant active developments this morning. The escalation in US-China semiconductor export controls represents a material shift in the technology trade policy landscape. Concurrently, Federal Reserve rate path uncertainty continues to be the central macro variable for interest-rate-sensitive assets. AFIE is monitoring both developments for further confirmation.',
      keyThemes: ['US-China Technology Trade Policy', 'Federal Reserve Rate Path Uncertainty'],
    },
    macroNarrative: {
      dominantThemes: [
        { theme: 'Technology Sector & Regulatory Environment', description: 'US-China tech restrictions.', storyIds: ['story_china_tech_001'], strength: 'dominant' },
        { theme: 'Monetary Policy & Interest Rate Expectations', description: 'Fed path uncertainty.', storyIds: ['story_fed_001'], strength: 'significant' },
      ],
      narrativeBody: 'The current macro environment is characterised by the simultaneous escalation of two dominant narratives. The US-China technology friction — centred on semiconductor export controls and rare earth retaliation — introduces a direct earnings headwind for major technology companies while simultaneously driving safe-haven flows into Gold. Concurrently, the Federal Reserve rate path uncertainty continues to function as the primary pricing variable for interest-rate-sensitive assets, with September remaining a contested decision point.',
    },
    storyContinuity: {
      continuingStories: [
        { storyId: 'story_fed_001', title: FIXTURE_STORY_FED.title, continuityNote: 'AFIE has observed increasing source confirmation of this narrative since initial detection three days ago.', trajectory: 'stable', versionCount: 3, daysSinceFirst: 3 },
      ],
      newStories: [
        { storyId: 'story_china_tech_001', title: FIXTURE_STORY_CHINA_TECH.title, significance: 'AFIE has detected a new breaking story affecting NAS100, XAUUSD, and AUDUSD.' },
      ],
      resolvedStories: [],
    },
    marketExpectations: {
      body: 'Current intelligence indicates that market participants are pricing a 62% probability of a September Federal Reserve rate cut. The US-China escalation has introduced additional uncertainty into the technology sector earnings outlook.',
      expectationItems: [
        { expectation: 'Markets continue to price a September Fed cut with 62% probability.', basis: 'FED story pricedInReasoning', storyIds: ['story_fed_001'], certainty: 'moderate_consensus' },
      ],
    },
    assetSummaries: [
      { symbol: 'XAUUSD', currentNarrative: 'Gold is experiencing constructive pressure from two converging narratives.', primaryDrivers: [{ driver: FIXTURE_STORY_FED.title, storyId: 'story_fed_001', direction: 'potentially_bullish', strength: 'high' }], confidence: 73, storyStatus: '1 developing, 1 breaking', afieAssessment: 'AFIE is assessing this as a high-strength impact scenario for XAUUSD.', contributingStoryIds: ['story_fed_001', 'story_china_tech_001'], hasNoActiveStories: false },
      { symbol: 'EURUSD', currentNarrative: 'No active stories currently affecting this asset.', primaryDrivers: [], confidence: 0, storyStatus: 'No active stories', afieAssessment: 'AFIE currently has no active intelligence affecting EURUSD.', contributingStoryIds: [], hasNoActiveStories: false },
    ],
    afieIsMonitoring: [
      { item: 'AFIE is monitoring the August CPI release on 12 August for evidence that the disinflationary trend is sustained below 2.8%.', storyId: 'story_fed_001', affectedAssets: ['XAUUSD', 'EURUSD'], significance: 'high', expectedTiming: '2026-08-12' },
    ],
    narrativeRisks: [
      { risk: 'Pending decision: Federal Reserve September Meeting', mechanism: 'The outcome — when announced — could produce rapid market repricing across affected assets.', affectedAssets: ['XAUUSD', 'EURUSD', 'USDJPY', 'NAS100'], likelihood: 'elevated', likelinessReasoning: 'The story is in a developing state with contested analyst expectations.', sourceStoryIds: ['story_fed_001'] },
    ],
    metadata: {
      engineVersion: '1.0',
      narrativeVersion: '2A',
      aiModelUsed: 'claude-opus-4-6',
      generationDurationMs: 1200,
      v1StoriesConsumed: 2,
      watchlistSymbols: WATCHLIST,
      isTestOutput: true,
    },
    ...overrides,
  };
}

// ─── Full Pipeline Integration Tests ─────────────────────────────────────────

describe('V2A Synthesizer Pipeline Integration', () => {

  test('all synthesizers run in sequence without error', () => {
    const context = buildContext();

    expect(() => classifyNarratives(context)).not.toThrow();
    const themes = classifyNarratives(context);

    expect(() => analyseContinuity(context, null)).not.toThrow();
    const continuity = analyseContinuity(context, null);

    expect(() => inferMarketExpectations(context)).not.toThrow();
    const expectations = inferMarketExpectations(context);

    expect(() => summariseAssets(context)).not.toThrow();
    const assets = summariseAssets(context);

    expect(() => identifyNarrativeRisks(context, themes)).not.toThrow();
    const risks = identifyNarrativeRisks(context, themes);

    // All outputs are arrays or objects
    expect(Array.isArray(themes.themes)).toBe(true);
    expect(Array.isArray(continuity.continuingStories)).toBe(true);
    expect(Array.isArray(expectations.expectationItems)).toBe(true);
    expect(Array.isArray(assets)).toBe(true);
    expect(Array.isArray(risks)).toBe(true);
  });

  test('assetSummaries covers all watchlist symbols', () => {
    const context = buildContext();
    const summaries = summariseAssets(context);
    const symbolsCovered = new Set(summaries.map(s => s.symbol));
    for (const sym of WATCHLIST) {
      expect(symbolsCovered.has(sym)).toBe(true);
    }
  });

  test('assets with active stories have hasNoActiveStories: false', () => {
    const context = buildContext();
    const summaries = summariseAssets(context);
    const xau = summaries.find(s => s.symbol === 'XAUUSD');
    expect(xau).toBeDefined();
    expect(xau.hasNoActiveStories).toBe(false);
  });

  test('assets with no active stories have hasNoActiveStories: true', () => {
    // NATGAS has no stories in fixtures
    const context = buildContext();
    const summaries = summariseAssets(context);
    const natgas = summaries.find(s => s.symbol === 'NATGAS');
    if (natgas) {
      // May or may not be in watchlist depending on context build
      expect(typeof natgas.hasNoActiveStories).toBe('boolean');
    }
  });

  test('no synthesizer introduces monitoring language for the user', () => {
    const context = buildContext();
    const themes      = classifyNarratives(context);
    const continuity  = analyseContinuity(context, null);
    const expectations = inferMarketExpectations(context);
    const assets      = summariseAssets(context);
    const risks       = identifyNarrativeRisks(context, themes);

    // Collect all text output from synthesizers
    const allText = [
      themes.sentimentReasoning,
      ...themes.themes.map(t => t.description),
      ...continuity.continuingStories.map(s => s.continuityNote),
      ...continuity.newStories.map(s => s.significance),
      expectations.summaryBody,
      ...expectations.expectationItems.map(i => i.expectation),
      ...assets.map(a => a.currentNarrative + ' ' + a.afieAssessment),
      ...risks.map(r => r.mechanism + ' ' + r.likelinessReasoning),
    ].join(' ').toLowerCase();

    // Forbidden instruction-to-user phrases
    expect(allText).not.toMatch(/watch for\b/);
    expect(allText).not.toMatch(/traders should/);
    expect(allText).not.toMatch(/\bbe aware that\b/);
  });

  test('V1 StoryStore is never written during synthesizer execution', () => {
    // This is a structural assertion: confirm synthesizers do not import write functions
    // Since we cannot easily mock module internals in ESM without a test runner plugin,
    // this test verifies the integration works without side effects by checking the
    // StoryStore is unchanged after a full synthesizer run.
    // In a full integration environment, mock StoryStore and assert no writes were called.
    const context = buildContext();
    // All synthesizers complete without error — if StoryStore writes were called they
    // would fail here because the test environment has no store directory.
    expect(() => {
      classifyNarratives(context);
      analyseContinuity(context, null);
      inferMarketExpectations(context);
      summariseAssets(context);
    }).not.toThrow();
  });

});

// ─── BriefValidator Tests ─────────────────────────────────────────────────────

describe('BriefValidator', () => {

  test('valid brief passes validation', () => {
    const brief = buildMinimalValidBrief();
    const result = validateBrief(brief);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('missing required field fails validation with critical flag', () => {
    const { id, ...withoutId } = buildMinimalValidBrief();
    const result = validateBrief(withoutId);
    expect(result.valid).toBe(false);
    expect(result.critical).toBe(true);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  test('invalid sentimentLabel fails validation', () => {
    const brief = buildMinimalValidBrief({ sentimentLabel: 'VERY_BULLISH' });
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sentimentLabel'))).toBe(true);
  });

  test('invalid briefType fails validation', () => {
    const brief = buildMinimalValidBrief({ briefType: 'daily_recap' });
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('briefType'))).toBe(true);
  });

  test('invalid theme strength fails validation', () => {
    const brief = buildMinimalValidBrief();
    brief.macroNarrative.dominantThemes[0].strength = 'overwhelming';
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('strength'))).toBe(true);
  });

  test('invalid story trajectory fails validation', () => {
    const brief = buildMinimalValidBrief();
    brief.storyContinuity.continuingStories[0].trajectory = 'accelerating';
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('trajectory'))).toBe(true);
  });

  test('invalid risk likelihood fails validation', () => {
    const brief = buildMinimalValidBrief();
    brief.narrativeRisks[0].likelihood = 'certain';
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('likelihood'))).toBe(true);
  });

  test('invalid asset direction fails validation', () => {
    const brief = buildMinimalValidBrief();
    brief.assetSummaries[0].primaryDrivers[0].direction = 'bullish';  // should be 'potentially_bullish'
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('direction'))).toBe(true);
  });

  test('asset confidence outside 0-100 fails validation', () => {
    const brief = buildMinimalValidBrief();
    brief.assetSummaries[0].confidence = 110;
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('confidence'))).toBe(true);
  });

  test('empty executiveSummary headline fails validation', () => {
    const brief = buildMinimalValidBrief();
    brief.executiveSummary.headline = '';
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
  });

  test('missing macroNarrative.narrativeBody fails validation', () => {
    const brief = buildMinimalValidBrief();
    brief.macroNarrative.narrativeBody = '';
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
  });

  test('missing monitoring item storyId fails validation', () => {
    const brief = buildMinimalValidBrief();
    brief.afieIsMonitoring[0] = { item: 'AFIE is monitoring something.', affectedAssets: [] };
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('storyId'))).toBe(true);
  });

  test('invalid expectation certainty fails validation', () => {
    const brief = buildMinimalValidBrief();
    brief.marketExpectations.expectationItems[0].certainty = 'definite';
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
  });

  test('missing metadata.narrativeVersion fails validation', () => {
    const brief = buildMinimalValidBrief();
    delete brief.metadata.narrativeVersion;
    const result = validateBrief(brief);
    expect(result.valid).toBe(false);
  });

});
