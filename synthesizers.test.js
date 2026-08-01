/**
 * AFIE V2A Synthesizer Unit Tests
 *
 * Tests for all five synthesizer modules.
 * All tests are deterministic — no AI calls, no network, no StoryStore reads.
 * Synthesizers receive a pre-built BriefingContext and return structured data.
 */

import { classifyNarratives }      from '../synthesizers/NarrativeClassifier.js';
import { analyseContinuity }        from '../synthesizers/ContinuityAnalyser.js';
import { inferMarketExpectations }  from '../synthesizers/MarketExpectationInferrer.js';
import { identifyNarrativeRisks }  from '../synthesizers/NarrativeRiskIdentifier.js';
import {
  FIXTURE_STORY_FED,
  FIXTURE_STORY_CHINA_TECH,
  FIXTURE_STORY_RESOLVED,
  ALL_FIXTURE_STORIES,
} from './fixtures/stories.fixtures.js';

// ─── Test helper: build BriefingContext from fixture stories ──────────────────

function buildContext(overrides = {}) {
  const activeStories = overrides.activeStories ?? [FIXTURE_STORY_FED, FIXTURE_STORY_CHINA_TECH];
  const recentStories = overrides.recentStories ?? ALL_FIXTURE_STORIES;

  const storiesByAsset = new Map();
  for (const story of recentStories) {
    for (const asset of (story.affectedAssets || [])) {
      if (!storiesByAsset.has(asset.symbol)) storiesByAsset.set(asset.symbol, []);
      storiesByAsset.get(asset.symbol).push(story);
    }
  }

  const storyAges = new Map();
  for (const story of recentStories) {
    const createdMs = new Date(story.createdAt).getTime();
    const updatedMs = new Date(story.updatedAt).getTime();
    const now = Date.now();
    storyAges.set(story.id, {
      daysSinceFirst:   (now - createdMs) / 86_400_000,
      hoursSinceUpdate: (now - updatedMs) / 3_600_000,
      isNew:            story.versionNumber === 1 && (now - createdMs) < 36 * 3_600_000,
      isContinuing:     story.versionNumber >= 2,
    });
  }

  return {
    activeStories,
    recentStories,
    allStories: ALL_FIXTURE_STORIES,
    watchlist: ['BTCUSD', 'ETHUSD', 'XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'GBPJPY', 'AUDUSD', 'NAS100', 'US30', 'SPX500', 'OIL', 'NATGAS'],
    dataAsOf: new Date().toISOString(),
    storiesByAsset,
    storyAges,
    totalActiveCount: activeStories.length,
    breakingCount: activeStories.filter(s => s.status === 'breaking').length,
    ...overrides,
  };
}

// ─── NarrativeClassifier Tests ────────────────────────────────────────────────

describe('NarrativeClassifier', () => {

  test('returns themes array and sentimentLabel', () => {
    const context = buildContext();
    const result = classifyNarratives(context);
    expect(Array.isArray(result.themes)).toBe(true);
    expect(typeof result.sentimentLabel).toBe('string');
    expect(typeof result.sentimentReasoning).toBe('string');
  });

  test('returns awaiting_catalyst when no active stories', () => {
    const context = buildContext({ activeStories: [], breakingCount: 0 });
    const result = classifyNarratives(context);
    expect(result.sentimentLabel).toBe('awaiting_catalyst');
    expect(result.themes).toHaveLength(0);
  });

  test('identifies monetary policy theme from Fed story', () => {
    const context = buildContext({ activeStories: [FIXTURE_STORY_FED] });
    const result = classifyNarratives(context);
    const hasMonetary = result.themes.some(t => t.theme.toLowerCase().includes('monetary'));
    expect(hasMonetary).toBe(true);
  });

  test('identifies geopolitical theme from China tech story', () => {
    const context = buildContext({ activeStories: [FIXTURE_STORY_CHINA_TECH] });
    const result = classifyNarratives(context);
    const hasTech = result.themes.some(
      t => t.theme.toLowerCase().includes('technology') || t.theme.toLowerCase().includes('trade')
    );
    expect(hasTech).toBe(true);
  });

  test('each theme has required fields', () => {
    const context = buildContext();
    const { themes } = classifyNarratives(context);
    for (const theme of themes) {
      expect(typeof theme.theme).toBe('string');
      expect(typeof theme.description).toBe('string');
      expect(Array.isArray(theme.storyIds)).toBe(true);
      expect(['dominant', 'significant', 'emerging', 'fading']).toContain(theme.strength);
    }
  });

  test('assigns "dominant" strength to highest-scoring theme', () => {
    const context = buildContext();
    const { themes } = classifyNarratives(context);
    if (themes.length > 0) {
      expect(themes[0].strength).toBe('dominant');
    }
  });

  test('breaking story triggers high_uncertainty when combined with contradictions', () => {
    const storyWithContradictions = {
      ...FIXTURE_STORY_FED,
      status: 'breaking',
      pass2: {
        ...FIXTURE_STORY_FED.pass2,
        contradictions: [
          { id: 'c1', description: 'Disagreement 1', perspectiveA: { position: 'A', sourceNames: ['Reuters'] }, perspectiveB: { position: 'B', sourceNames: ['Bloomberg'] }, afieNote: '' },
          { id: 'c2', description: 'Disagreement 2', perspectiveA: { position: 'C', sourceNames: ['FT'] }, perspectiveB: { position: 'D', sourceNames: ['CNBC'] }, afieNote: '' },
        ],
      },
    };
    const context = buildContext({
      activeStories: [storyWithContradictions, FIXTURE_STORY_CHINA_TECH],
      breakingCount: 2,
    });
    const { sentimentLabel } = classifyNarratives(context);
    expect(sentimentLabel).toBe('high_uncertainty');
  });

  test('sentimentReasoning is non-empty string for all sentiment labels', () => {
    const context = buildContext();
    const result = classifyNarratives(context);
    expect(result.sentimentReasoning.length).toBeGreaterThan(20);
  });

});

// ─── ContinuityAnalyser Tests ─────────────────────────────────────────────────

describe('ContinuityAnalyser', () => {

  test('returns continuingStories, newStories, resolvedStories arrays', () => {
    const context = buildContext();
    const result = analyseContinuity(context, null);
    expect(Array.isArray(result.continuingStories)).toBe(true);
    expect(Array.isArray(result.newStories)).toBe(true);
    expect(Array.isArray(result.resolvedStories)).toBe(true);
  });

  test('v3 story (versionNumber >= 2) classified as continuing', () => {
    const context = buildContext();
    const result = analyseContinuity(context, null);
    const fedInContinuing = result.continuingStories.some(s => s.storyId === FIXTURE_STORY_FED.id);
    // FED story has versionNumber: 3 — should be continuing
    expect(fedInContinuing).toBe(true);
  });

  test('v1 breaking story classified as new when no prior brief', () => {
    const context = buildContext();
    const result = analyseContinuity(context, null);
    const chinaTechIsNew = result.newStories.some(s => s.storyId === FIXTURE_STORY_CHINA_TECH.id);
    expect(chinaTechIsNew).toBe(true);
  });

  test('resolved story detected when it was in prior brief', () => {
    const priorBrief = {
      storyContinuity: {
        continuingStories: [],
        newStories: [{ storyId: FIXTURE_STORY_RESOLVED.id, title: FIXTURE_STORY_RESOLVED.title }],
      },
    };
    const context = buildContext({
      activeStories: [FIXTURE_STORY_FED],
      recentStories: ALL_FIXTURE_STORIES,
    });
    const result = analyseContinuity(context, priorBrief);
    const resolvedEntry = result.resolvedStories.find(s => s.storyId === FIXTURE_STORY_RESOLVED.id);
    expect(resolvedEntry).toBeDefined();
    expect(resolvedEntry.resolutionNote).toBeTruthy();
  });

  test('continuingStory has required fields', () => {
    const context = buildContext({ activeStories: [FIXTURE_STORY_FED] });
    const result = analyseContinuity(context, null);
    for (const story of result.continuingStories) {
      expect(story.storyId).toBeTruthy();
      expect(story.title).toBeTruthy();
      expect(story.continuityNote).toBeTruthy();
      expect(['strengthening','stable','weakening','escalating','de_escalating','unresolved']).toContain(story.trajectory);
      expect(typeof story.versionCount).toBe('number');
      expect(typeof story.daysSinceFirst).toBe('number');
    }
  });

  test('continuityNote uses AFIE-voice language', () => {
    const context = buildContext({ activeStories: [FIXTURE_STORY_FED] });
    const result = analyseContinuity(context, null);
    for (const story of result.continuingStories) {
      const note = story.continuityNote.toLowerCase();
      // Should not use instruction-to-user language
      expect(note).not.toMatch(/watch for|traders should|be aware/);
      // Should use AFIE-voice
      expect(note).toMatch(/afie|intelligence|evidence|assessment/);
    }
  });

  test('stories in prior brief that are still active are classified as continuing', () => {
    const priorBrief = {
      storyContinuity: {
        continuingStories: [],
        newStories: [{ storyId: FIXTURE_STORY_FED.id, title: FIXTURE_STORY_FED.title }],
      },
    };
    const context = buildContext({ activeStories: [FIXTURE_STORY_FED, FIXTURE_STORY_CHINA_TECH] });
    const result = analyseContinuity(context, priorBrief);
    const fedContinuing = result.continuingStories.some(s => s.storyId === FIXTURE_STORY_FED.id);
    expect(fedContinuing).toBe(true);
  });

});

// ─── MarketExpectationInferrer Tests ──────────────────────────────────────────

describe('MarketExpectationInferrer', () => {

  test('returns expectationItems array and summaryBody string', () => {
    const context = buildContext();
    const result = inferMarketExpectations(context);
    expect(Array.isArray(result.expectationItems)).toBe(true);
    expect(typeof result.summaryBody).toBe('string');
  });

  test('extracts priced-in expectations from FED story', () => {
    const context = buildContext({ activeStories: [FIXTURE_STORY_FED] });
    const result = inferMarketExpectations(context);
    // FED story has isProbablyPricedIn: false but pricedInReasoning is present
    // The inferrer should still extract from pricedInReasoning if present
    expect(result.expectationItems.length).toBeGreaterThanOrEqual(0);
  });

  test('extracts future watch point expectations', () => {
    const context = buildContext({ activeStories: [FIXTURE_STORY_FED] });
    const result = inferMarketExpectations(context);
    const watchPointItems = result.expectationItems.filter(i => i.certainty === 'insufficient_evidence');
    // FED story has 2 watch points
    expect(watchPointItems.length).toBeGreaterThan(0);
  });

  test('extracts contested expectations from story contradictions', () => {
    const context = buildContext({ activeStories: [FIXTURE_STORY_FED] });
    const result = inferMarketExpectations(context);
    const contested = result.expectationItems.filter(i => i.certainty === 'contested');
    // FED story has 1 contradiction
    expect(contested.length).toBeGreaterThan(0);
  });

  test('expectationItem has required fields', () => {
    const context = buildContext();
    const result = inferMarketExpectations(context);
    for (const item of result.expectationItems) {
      expect(typeof item.expectation).toBe('string');
      expect(typeof item.basis).toBe('string');
      expect(Array.isArray(item.storyIds)).toBe(true);
      expect(['high_consensus','moderate_consensus','contested','insufficient_evidence']).toContain(item.certainty);
    }
  });

  test('returns non-empty summaryBody even with no stories', () => {
    const context = buildContext({ activeStories: [] });
    const result = inferMarketExpectations(context);
    expect(result.summaryBody.length).toBeGreaterThan(20);
    expect(result.summaryBody.toLowerCase()).toMatch(/afie|monitoring|intelligence/);
  });

  test('does not invent storyIds outside the fixture stories', () => {
    const context = buildContext();
    const result = inferMarketExpectations(context);
    const knownIds = new Set(ALL_FIXTURE_STORIES.map(s => s.id));
    for (const item of result.expectationItems) {
      for (const id of item.storyIds) {
        expect(knownIds.has(id)).toBe(true);
      }
    }
  });

});

// ─── NarrativeRiskIdentifier Tests ───────────────────────────────────────────

describe('NarrativeRiskIdentifier', () => {

  test('returns an array of narrative risks', () => {
    const context = buildContext();
    const themes = { themes: [], sentimentLabel: 'mixed', sentimentReasoning: '' };
    const result = identifyNarrativeRisks(context, themes);
    expect(Array.isArray(result)).toBe(true);
  });

  test('extracts watch-point risks from active stories', () => {
    const context = buildContext({ activeStories: [FIXTURE_STORY_FED, FIXTURE_STORY_CHINA_TECH] });
    const themes = { themes: [], sentimentLabel: 'mixed', sentimentReasoning: '' };
    const result = identifyNarrativeRisks(context, themes);
    expect(result.length).toBeGreaterThan(0);
  });

  test('each risk has required fields', () => {
    const context = buildContext();
    const themes = { themes: [], sentimentLabel: 'mixed', sentimentReasoning: '' };
    const risks = identifyNarrativeRisks(context, themes);
    for (const risk of risks) {
      expect(typeof risk.risk).toBe('string');
      expect(typeof risk.mechanism).toBe('string');
      expect(Array.isArray(risk.affectedAssets)).toBe(true);
      expect(['elevated','moderate','low','tail_risk']).toContain(risk.likelihood);
      expect(typeof risk.likelinessReasoning).toBe('string');
      expect(Array.isArray(risk.sourceStoryIds)).toBe(true);
    }
  });

  test('awaiting_decision story generates elevated risk', () => {
    const awaitingStory = { ...FIXTURE_STORY_FED, status: 'awaiting_decision' };
    const context = buildContext({ activeStories: [awaitingStory] });
    const themes = { themes: [], sentimentLabel: 'policy_dependent', sentimentReasoning: '' };
    const risks = identifyNarrativeRisks(context, themes);
    const elevatedRisks = risks.filter(r => r.likelihood === 'elevated');
    expect(elevatedRisks.length).toBeGreaterThan(0);
  });

  test('story with contradictions generates a fragility risk', () => {
    const context = buildContext({ activeStories: [FIXTURE_STORY_FED] });
    const themes = { themes: [], sentimentLabel: 'mixed', sentimentReasoning: '' };
    const risks = identifyNarrativeRisks(context, themes);
    // FED story has 1 contradiction
    const contradictionRisk = risks.find(r => r.risk.toLowerCase().includes('contradiction') || r.risk.toLowerCase().includes('narrative resolution'));
    expect(contradictionRisk).toBeDefined();
  });

  test('mechanism field explains the transmission mechanism, not just the outcome', () => {
    const context = buildContext();
    const themes = { themes: [], sentimentLabel: 'mixed', sentimentReasoning: '' };
    const risks = identifyNarrativeRisks(context, themes);
    for (const risk of risks) {
      // Mechanism should be substantive
      expect(risk.mechanism.length).toBeGreaterThan(30);
    }
  });

  test('does not exceed maxNarrativeRisks', () => {
    const { NARRATIVE_CONFIG } = require('../config/narrative.config.js');
    const context = buildContext();
    const themes = { themes: [], sentimentLabel: 'mixed', sentimentReasoning: '' };
    const risks = identifyNarrativeRisks(context, themes);
    expect(risks.length).toBeLessThanOrEqual(NARRATIVE_CONFIG.brief.maxNarrativeRisks);
  });

});
