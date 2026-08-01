/**
 * AFIE SourceRegistry (V2B)
 *
 * Unified source intelligence layer.
 *
 * Extends the existing SOURCE_REGISTRY from sources.config.js with V2B
 * source intelligence metadata:
 *   - Historical credibility tracking
 *   - Official vs media classification
 *   - Confidence contribution weight
 *   - User-configurable trust weights (future)
 *   - Premium provider support (future)
 *   - Per-source collection health metrics
 *
 * This module is the single authoritative source for all source metadata.
 * The ConfidenceScorer, EvidenceEnrichmentOrchestrator, and future ranking
 * systems all read from here.
 *
 * Existing V1 modules that read SOURCE_REGISTRY directly continue to work.
 * V2B modules use this richer registry instead.
 */

import { SOURCE_REGISTRY, getActiveSources } from '../config/sources.config.js';
import { Logger }                             from '../core/Logger.js';

const logger = new Logger('SourceRegistry');

/**
 * V2B source intelligence metadata.
 * Keyed by source id — matches keys in SOURCE_REGISTRY.
 *
 * Fields:
 *   baseReliabilityScore  — 0.0–1.0, editorial quality judgement
 *   isOfficial            — true if this is a primary government/CB/regulator source
 *   officialBody          — name of the official body (if isOfficial)
 *   historicalAccuracy    — 0.0–1.0, updated over time as AFIE tracks claim outcomes
 *   confidenceContribution — 0.0–1.0, how much this source improves story confidence
 *   isPremium             — true for paid/licensed data sources
 *   allowsFullText        — whether full article bodies are available (vs summaries)
 *   userTrustWeight       — null = use default; 0.0–2.0 = user multiplier
 *   collectionsTotal      — lifetime collection count (runtime, not persisted here)
 *   collectionErrors      — lifetime error count (runtime, not persisted here)
 */
const SOURCE_INTELLIGENCE = {

  // ── Official Tier 1 ───────────────────────────────────────────────
  federal_reserve:     { baseReliabilityScore: 1.00, isOfficial: true,  officialBody: 'Federal Reserve',              historicalAccuracy: 1.00, confidenceContribution: 0.95, isPremium: false, allowsFullText: true,  userTrustWeight: null },
  ecb:                 { baseReliabilityScore: 1.00, isOfficial: true,  officialBody: 'European Central Bank',         historicalAccuracy: 1.00, confidenceContribution: 0.95, isPremium: false, allowsFullText: true,  userTrustWeight: null },
  bank_of_england:     { baseReliabilityScore: 1.00, isOfficial: true,  officialBody: 'Bank of England',              historicalAccuracy: 1.00, confidenceContribution: 0.95, isPremium: false, allowsFullText: true,  userTrustWeight: null },
  bank_of_japan:       { baseReliabilityScore: 1.00, isOfficial: true,  officialBody: 'Bank of Japan',                historicalAccuracy: 1.00, confidenceContribution: 0.95, isPremium: false, allowsFullText: true,  userTrustWeight: null },
  bls_gov:             { baseReliabilityScore: 1.00, isOfficial: true,  officialBody: 'US Bureau of Labor Statistics', historicalAccuracy: 1.00, confidenceContribution: 0.90, isPremium: false, allowsFullText: true,  userTrustWeight: null },
  sec_gov:             { baseReliabilityScore: 1.00, isOfficial: true,  officialBody: 'US Securities and Exchange Commission', historicalAccuracy: 1.00, confidenceContribution: 0.90, isPremium: false, allowsFullText: true,  userTrustWeight: null },

  // ── Tier 2 Wire Services ──────────────────────────────────────────
  reuters_markets:     { baseReliabilityScore: 0.95, isOfficial: false, officialBody: null, historicalAccuracy: 0.92, confidenceContribution: 0.80, isPremium: false, allowsFullText: false, userTrustWeight: null },
  bloomberg_markets:   { baseReliabilityScore: 0.93, isOfficial: false, officialBody: null, historicalAccuracy: 0.90, confidenceContribution: 0.78, isPremium: true,  allowsFullText: true,  userTrustWeight: null },
  financial_times:     { baseReliabilityScore: 0.88, isOfficial: false, officialBody: null, historicalAccuracy: 0.87, confidenceContribution: 0.72, isPremium: true,  allowsFullText: true,  userTrustWeight: null },
  newsapi_financial:   { baseReliabilityScore: 0.70, isOfficial: false, officialBody: null, historicalAccuracy: 0.70, confidenceContribution: 0.50, isPremium: false, allowsFullText: false, userTrustWeight: null },

  // ── Tier 3 Financial Media ────────────────────────────────────────
  cnbc_markets:        { baseReliabilityScore: 0.75, isOfficial: false, officialBody: null, historicalAccuracy: 0.74, confidenceContribution: 0.55, isPremium: false, allowsFullText: false, userTrustWeight: null },
  marketwatch:         { baseReliabilityScore: 0.73, isOfficial: false, officialBody: null, historicalAccuracy: 0.72, confidenceContribution: 0.52, isPremium: false, allowsFullText: false, userTrustWeight: null },
  forexlive:           { baseReliabilityScore: 0.72, isOfficial: false, officialBody: null, historicalAccuracy: 0.71, confidenceContribution: 0.52, isPremium: false, allowsFullText: true,  userTrustWeight: null },
  coindesk:            { baseReliabilityScore: 0.68, isOfficial: false, officialBody: null, historicalAccuracy: 0.67, confidenceContribution: 0.48, isPremium: false, allowsFullText: true,  userTrustWeight: null },
  kitco_news:          { baseReliabilityScore: 0.67, isOfficial: false, officialBody: null, historicalAccuracy: 0.66, confidenceContribution: 0.46, isPremium: false, allowsFullText: true,  userTrustWeight: null },
  investing_com:       { baseReliabilityScore: 0.62, isOfficial: false, officialBody: null, historicalAccuracy: 0.61, confidenceContribution: 0.42, isPremium: false, allowsFullText: false, userTrustWeight: null },
};

// Runtime collection health — in-memory, not persisted
const _collectionHealth = new Map();

/**
 * @typedef {Object} EnrichedSourceRecord
 * @property {string}  id
 * @property {string}  name
 * @property {number}  reliabilityTier        - 1–5 from SOURCE_REGISTRY
 * @property {number}  baseReliabilityScore   - 0.0–1.0
 * @property {boolean} isOfficial
 * @property {string|null} officialBody
 * @property {number}  historicalAccuracy     - 0.0–1.0
 * @property {number}  confidenceContribution - 0.0–1.0
 * @property {boolean} isPremium
 * @property {boolean} allowsFullText
 * @property {number}  effectiveScore         - baseReliabilityScore × userTrustWeight
 * @property {Object}  health                 - { errors, collections, errorRate }
 */

/**
 * Returns the enriched record for a source by id.
 * Merges SOURCE_REGISTRY base config with V2B intelligence metadata.
 *
 * @param {string} sourceId
 * @returns {EnrichedSourceRecord|null}
 */
export function getEnrichedSource(sourceId) {
  const base = SOURCE_REGISTRY[sourceId];
  if (!base) return null;

  const intel = SOURCE_INTELLIGENCE[sourceId] ?? defaultIntelligence(base.reliabilityTier);
  const health = _collectionHealth.get(sourceId) ?? { errors: 0, collections: 0 };
  const trustWeight = intel.userTrustWeight ?? 1.0;

  return {
    ...base,
    ...intel,
    effectiveScore: Math.min(1.0, intel.baseReliabilityScore * trustWeight),
    health: {
      ...health,
      errorRate: health.collections > 0 ? health.errors / health.collections : 0,
    },
  };
}

/**
 * Returns enriched records for all active sources.
 */
export function getAllEnrichedSources() {
  return getActiveSources()
    .map(s => getEnrichedSource(s.id))
    .filter(Boolean);
}

/**
 * Returns the effective reliability score for a publisher name.
 * Used by ConfidenceScorer as a richer alternative to SourceReliability.js.
 *
 * @param {string} publisherName
 * @returns {number} 0.0–1.0
 */
export function getEffectiveScore(publisherName) {
  // Try direct id match first
  const byId = Object.values(SOURCE_REGISTRY).find(
    s => s.name.toLowerCase() === publisherName.toLowerCase()
  );
  if (byId) {
    const enriched = getEnrichedSource(byId.id);
    if (enriched) return enriched.effectiveScore;
  }

  // Partial name match
  for (const [id, src] of Object.entries(SOURCE_REGISTRY)) {
    if (src.name.toLowerCase().includes(publisherName.toLowerCase()) ||
        publisherName.toLowerCase().includes(src.name.toLowerCase())) {
      const enriched = getEnrichedSource(id);
      if (enriched) return enriched.effectiveScore;
    }
  }

  return 0.5; // unknown publisher — neutral default
}

/**
 * Records a successful collection cycle for health tracking.
 * Called by NewsProviderRegistry after each successful collection.
 */
export function recordCollectionSuccess(sourceId) {
  const health = _collectionHealth.get(sourceId) ?? { errors: 0, collections: 0 };
  _collectionHealth.set(sourceId, { ...health, collections: health.collections + 1 });
}

/**
 * Records a collection error for health tracking.
 * Called by NewsProviderRegistry after a failed collection.
 */
export function recordCollectionError(sourceId) {
  const health = _collectionHealth.get(sourceId) ?? { errors: 0, collections: 0 };
  _collectionHealth.set(sourceId, {
    errors:      health.errors + 1,
    collections: health.collections + 1,
  });
}

/**
 * Sets a user-defined trust weight for a source.
 * weight 1.0 = default; 0.5 = half trust; 2.0 = double trust (capped at 1.0 effective score).
 *
 * @param {string} sourceId
 * @param {number} weight  - 0.0–2.0
 */
export function setUserTrustWeight(sourceId, weight) {
  if (!SOURCE_INTELLIGENCE[sourceId]) {
    logger.warn(`Cannot set trust weight: source "${sourceId}" not found in intelligence registry.`);
    return;
  }
  SOURCE_INTELLIGENCE[sourceId].userTrustWeight = Math.max(0, Math.min(2.0, weight));
  logger.info(`Trust weight for "${sourceId}" set to ${weight}`);
}

/**
 * Returns a health summary of all active sources.
 * Useful for diagnostics and future UI settings panel.
 */
export function getCollectionHealthSummary() {
  return getAllEnrichedSources().map(s => ({
    id:          s.id,
    name:        s.name,
    enabled:     s.active,
    errorRate:   s.health.errorRate,
    collections: s.health.collections,
    tier:        s.reliabilityTier,
    effectiveScore: s.effectiveScore,
  }));
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function defaultIntelligence(reliabilityTier) {
  const scores = { 1: 1.0, 2: 0.85, 3: 0.65, 4: 0.40, 5: 0.20 };
  const score = scores[reliabilityTier] ?? 0.50;
  return {
    baseReliabilityScore:   score,
    isOfficial:             reliabilityTier === 1,
    officialBody:           null,
    historicalAccuracy:     score,
    confidenceContribution: score * 0.80,
    isPremium:              false,
    allowsFullText:         false,
    userTrustWeight:        null,
  };
}
