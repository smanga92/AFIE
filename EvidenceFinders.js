/**
 * AFIE Evidence Finders (V2B)
 *
 * Four focused evidence-gathering modules, each with a single responsibility.
 * All are called by EvidenceEnrichmentOrchestrator when the EnrichmentGatekeeper
 * approves enrichment for an FKO.
 *
 * Current implementation uses the 'internal' search provider by default —
 * searching the existing V1 StoryStore for related evidence without making
 * external API calls. This is safe for all environments.
 *
 * When providers.config.js sets searchProvider: 'web', the modules would
 * call an external search API. That integration is wired as a placeholder
 * below — the interface is complete, the external call body is annotated.
 *
 * Every finder returns an EvidenceResult — a structured, typed object
 * that the EvidenceEnrichmentOrchestrator merges into the enriched FKO.
 *
 * Design principle: these modules do NOT generate market analysis.
 * They locate and return evidence. Analysis is Pass 2's responsibility.
 */

import { loadAllStories }   from '../memory/StoryStore.js';
import { PROVIDERS_CONFIG } from '../config/providers.config.js';
import { Logger }           from '../core/Logger.js';

const logger = new Logger('EvidenceFinders');

/**
 * @typedef {Object} EvidenceResult
 * @property {string}   type          - 'supporting' | 'contradicting' | 'official' | 'context'
 * @property {string}   summary       - What was found (or not found)
 * @property {Object[]} items         - Individual evidence items
 * @property {string}   searchedFor   - What the finder searched for
 * @property {string}   provider      - 'internal' | 'web'
 * @property {boolean}  found         - Whether any evidence was found
 */

// ── SupportingEvidenceFinder ──────────────────────────────────────────────────

/**
 * Searches for evidence that corroborates the facts already in the FKO.
 * Primary use case: FKO has low source count — look for additional coverage
 * in the existing story store that was not yet merged into this cluster.
 *
 * @param {import('../pass1/FactExtractor.js').FactualKnowledgeObject} fko
 * @returns {Promise<EvidenceResult>}
 */
export async function findSupportingEvidence(fko) {
  const provider = PROVIDERS_CONFIG.enrichment.searchProvider;
  logger.debug(`SupportingEvidenceFinder: searching for corroboration of "${fko.representativeHeadline}"`);

  if (provider === 'internal') {
    return searchInternalForSupport(fko);
  }

  // ── WEB SEARCH PLACEHOLDER ────────────────────────────────────────────────
  // When searchProvider === 'web', replace this with a real search API call:
  //
  //   const query = buildSupportQuery(fko);
  //   const results = await callWebSearchAPI(query);
  //   return {
  //     type: 'supporting',
  //     summary: `Found ${results.length} potentially corroborating web sources.`,
  //     items: results.map(r => ({ title: r.title, url: r.url, snippet: r.snippet, source: r.domain })),
  //     searchedFor: query,
  //     provider: 'web',
  //     found: results.length > 0,
  //   };
  // ─────────────────────────────────────────────────────────────────────────

  return notImplementedResult('supporting', fko.representativeHeadline);
}

// ── ContradictionEvidenceFinder ───────────────────────────────────────────────

/**
 * Searches for evidence that contradicts or adds nuance to the FKO's facts.
 * Primary use case: FKO has contested facts — look for sources taking the
 * opposing view, to ensure both perspectives are represented.
 *
 * @param {import('../pass1/FactExtractor.js').FactualKnowledgeObject} fko
 * @returns {Promise<EvidenceResult>}
 */
export async function findContradictingEvidence(fko) {
  const provider = PROVIDERS_CONFIG.enrichment.searchProvider;
  logger.debug(`ContradictionEvidenceFinder: searching for contradictions to "${fko.representativeHeadline}"`);

  if (provider === 'internal') {
    return searchInternalForContradiction(fko);
  }

  // ── WEB SEARCH PLACEHOLDER ────────────────────────────────────────────────
  // When searchProvider === 'web':
  //
  //   const query = buildContradictionQuery(fko);
  //   const results = await callWebSearchAPI(query);
  //   const contradictingItems = results.filter(r => appearsToContradict(r, fko));
  //   return {
  //     type: 'contradicting',
  //     summary: `Found ${contradictingItems.length} potentially contradicting source(s).`,
  //     items: contradictingItems,
  //     searchedFor: query,
  //     provider: 'web',
  //     found: contradictingItems.length > 0,
  //   };
  // ─────────────────────────────────────────────────────────────────────────

  return notImplementedResult('contradicting', fko.representativeHeadline);
}

// ── OfficialStatementLocator ──────────────────────────────────────────────────

/**
 * Searches for official statements from government bodies, central banks,
 * or regulatory agencies that confirm or deny the FKO's claims.
 * Primary use case: FKO has no official source — look for one.
 *
 * @param {import('../pass1/FactExtractor.js').FactualKnowledgeObject} fko
 * @returns {Promise<EvidenceResult>}
 */
export async function findOfficialStatement(fko) {
  const provider = PROVIDERS_CONFIG.enrichment.searchProvider;
  logger.debug(`OfficialStatementLocator: searching for official confirmation of "${fko.representativeHeadline}"`);

  if (provider === 'internal') {
    return searchInternalForOfficial(fko);
  }

  // ── WEB SEARCH PLACEHOLDER ────────────────────────────────────────────────
  // When searchProvider === 'web':
  //
  //   // Target official domains specifically
  //   const officialDomains = [
  //     'federalreserve.gov', 'ecb.europa.eu', 'bankofengland.co.uk',
  //     'boj.or.jp', 'bls.gov', 'sec.gov', 'treasury.gov',
  //     'whitehouse.gov', 'europa.eu', 'imf.org', 'worldbank.org',
  //   ];
  //   const query = buildOfficialQuery(fko, officialDomains);
  //   const results = await callWebSearchAPI(query);
  //   const officialResults = results.filter(r =>
  //     officialDomains.some(d => r.url.includes(d))
  //   );
  //   return {
  //     type: 'official',
  //     summary: officialResults.length > 0
  //       ? `Located ${officialResults.length} official statement(s) relevant to this story.`
  //       : 'No official statements located in this search.',
  //     items: officialResults,
  //     searchedFor: query,
  //     provider: 'web',
  //     found: officialResults.length > 0,
  //   };
  // ─────────────────────────────────────────────────────────────────────────

  return notImplementedResult('official', fko.representativeHeadline);
}

// ── ContextEnricher ───────────────────────────────────────────────────────────

/**
 * Searches for additional macro context that would materially improve
 * the Reasoning Engine's understanding of the story's significance.
 * Primary use case: breaking story with limited background context.
 *
 * @param {import('../pass1/FactExtractor.js').FactualKnowledgeObject} fko
 * @returns {Promise<EvidenceResult>}
 */
export async function findMacroContext(fko) {
  const provider = PROVIDERS_CONFIG.enrichment.searchProvider;
  logger.debug(`ContextEnricher: searching for macro context for "${fko.representativeHeadline}"`);

  if (provider === 'internal') {
    return searchInternalForContext(fko);
  }

  // ── WEB SEARCH PLACEHOLDER ────────────────────────────────────────────────
  // When searchProvider === 'web':
  //
  //   const contextQuery = buildContextQuery(fko);
  //   const results = await callWebSearchAPI(contextQuery);
  //   return {
  //     type: 'context',
  //     summary: `Found ${results.length} background context source(s).`,
  //     items: results.map(r => ({
  //       title: r.title, url: r.url, snippet: r.snippet,
  //       relevance: scoreContextRelevance(r, fko),
  //     })),
  //     searchedFor: contextQuery,
  //     provider: 'web',
  //     found: results.length > 0,
  //   };
  // ─────────────────────────────────────────────────────────────────────────

  return notImplementedResult('context', fko.representativeHeadline);
}

// ─── Internal (provider === 'internal') ──────────────────────────────────────

async function searchInternalForSupport(fko) {
  try {
    const allStories = await loadAllStories();
    const fkoText = buildSearchText(fko).toLowerCase();
    const fkoKws  = extractKeywords(fkoText);

    const related = allStories.filter(story => {
      if (fko.allArticleIds?.includes(story.id)) return false; // already in this FKO
      const storyText = `${story.title} ${story.executiveSummary}`.toLowerCase();
      const storyKws  = extractKeywords(storyText);
      const overlap   = fkoKws.filter(k => storyKws.includes(k));
      return overlap.length >= 2;
    }).slice(0, 3);

    return {
      type:        'supporting',
      summary:     related.length > 0
        ? `Found ${related.length} related existing ${related.length === 1 ? 'story' : 'stories'} in the intelligence store that may provide additional corroboration.`
        : 'No related stories found in the existing intelligence store.',
      items:       related.map(s => ({ storyId: s.id, title: s.title, confidence: s.confidence?.overallScore, status: s.status })),
      searchedFor: fkoKws.slice(0, 5).join(', '),
      provider:    'internal',
      found:       related.length > 0,
    };
  } catch (err) {
    logger.error('Internal support search failed:', err.message);
    return errorResult('supporting');
  }
}

async function searchInternalForContradiction(fko) {
  try {
    const allStories = await loadAllStories();
    const fkoKws = extractKeywords(buildSearchText(fko).toLowerCase());

    // Look for stories with contradictions touching the same keywords
    const withContradictions = allStories.filter(story => {
      const hasContradictions = (story.pass2?.contradictions?.length ?? 0) > 0;
      if (!hasContradictions) return false;
      const storyText = `${story.title} ${story.executiveSummary}`.toLowerCase();
      const overlap = fkoKws.filter(k => storyText.includes(k));
      return overlap.length >= 2;
    }).slice(0, 3);

    return {
      type:        'contradicting',
      summary:     withContradictions.length > 0
        ? `Found ${withContradictions.length} existing ${withContradictions.length === 1 ? 'story' : 'stories'} with recorded contradictions on related topics.`
        : 'No contradicting evidence found in the existing intelligence store.',
      items:       withContradictions.map(s => ({
        storyId: s.id, title: s.title,
        contradictionCount: s.pass2?.contradictions?.length ?? 0,
      })),
      searchedFor: fkoKws.slice(0, 5).join(', '),
      provider:    'internal',
      found:       withContradictions.length > 0,
    };
  } catch (err) {
    logger.error('Internal contradiction search failed:', err.message);
    return errorResult('contradicting');
  }
}

async function searchInternalForOfficial(fko) {
  try {
    const allStories = await loadAllStories();
    const fkoKws = extractKeywords(buildSearchText(fko).toLowerCase());

    const officialStories = allStories.filter(story => {
      const hasOfficialFacts = (story.pass1?.facts ?? []).some(f => f.isOfficial);
      if (!hasOfficialFacts) return false;
      const storyText = `${story.title} ${story.executiveSummary}`.toLowerCase();
      return fkoKws.filter(k => storyText.includes(k)).length >= 2;
    }).slice(0, 3);

    return {
      type:        'official',
      summary:     officialStories.length > 0
        ? `Found ${officialStories.length} existing ${officialStories.length === 1 ? 'story' : 'stories'} with official source confirmation on related topics.`
        : 'No official-source confirmation found in the existing intelligence store for this topic.',
      items:       officialStories.map(s => ({
        storyId: s.id, title: s.title,
        officialBodies: (s.pass1?.facts ?? [])
          .filter(f => f.isOfficial && f.officialBody)
          .map(f => f.officialBody),
      })),
      searchedFor: fkoKws.slice(0, 5).join(', '),
      provider:    'internal',
      found:       officialStories.length > 0,
    };
  } catch (err) {
    logger.error('Internal official search failed:', err.message);
    return errorResult('official');
  }
}

async function searchInternalForContext(fko) {
  try {
    const allStories = await loadAllStories();
    const fkoKws = extractKeywords(buildSearchText(fko).toLowerCase());

    // Look for mature, high-confidence stories on the same topics
    const contextStories = allStories.filter(story => {
      if ((story.confidence?.overallScore ?? 0) < 60) return false;
      if ((story.versionNumber ?? 1) < 2) return false;
      const storyText = `${story.title} ${story.executiveSummary}`.toLowerCase();
      return fkoKws.filter(k => storyText.includes(k)).length >= 2;
    }).slice(0, 3);

    return {
      type:        'context',
      summary:     contextStories.length > 0
        ? `Found ${contextStories.length} mature related ${contextStories.length === 1 ? 'story' : 'stories'} in the intelligence store that provide historical context.`
        : 'No relevant historical context found in the existing intelligence store.',
      items:       contextStories.map(s => ({
        storyId: s.id, title: s.title,
        versionCount: s.versionNumber,
        confidence: s.confidence?.overallScore,
      })),
      searchedFor: fkoKws.slice(0, 5).join(', '),
      provider:    'internal',
      found:       contextStories.length > 0,
    };
  } catch (err) {
    logger.error('Internal context search failed:', err.message);
    return errorResult('context');
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function buildSearchText(fko) {
  return [
    fko.representativeHeadline,
    (fko.facts ?? []).map(f => f.factText).join(' '),
  ].join(' ');
}

function extractKeywords(text) {
  const STOP_WORDS = new Set(['the','a','an','is','are','was','were','has','have',
    'had','be','been','being','this','that','these','those','it','its','for','of',
    'to','in','on','at','by','from','with','and','or','but','not','as','up','if']);
  return text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !STOP_WORDS.has(w))
    .slice(0, 20);
}

function notImplementedResult(type, headline) {
  return {
    type,
    summary:     `Web search not configured. Set searchProvider: 'web' in providers.config.js to enable external evidence gathering.`,
    items:       [],
    searchedFor: headline,
    provider:    'not_configured',
    found:       false,
  };
}

function errorResult(type) {
  return {
    type,
    summary:  'Evidence search encountered an error and could not complete.',
    items:    [],
    searchedFor: '',
    provider: 'internal',
    found:    false,
  };
}
