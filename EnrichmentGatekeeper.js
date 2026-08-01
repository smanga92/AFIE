/**
 * AFIE EnrichmentGatekeeper (V2B)
 *
 * Decides WHETHER evidence enrichment should run for a given FKO.
 *
 * This is the most important module in the Evidence Enrichment Layer.
 * Its purpose is to prevent unnecessary API calls while ensuring enrichment
 * activates when it would materially improve reasoning quality.
 *
 * Enrichment only runs when at least one trigger condition is met.
 * If no trigger fires, the FKO passes through the pipeline unchanged.
 *
 * Each trigger is individually configurable in providers.config.js.
 *
 * Design principle — conservative by default:
 *   A well-evidenced story from multiple reputable sources should not
 *   trigger enrichment. Enrichment is for stories where evidence gaps,
 *   contradictions, or high-stakes claims justify additional investigation.
 */

import { PROVIDERS_CONFIG } from '../../config/providers.config.js';
import { Logger }           from '../../core/Logger.js';

const logger = new Logger('EnrichmentGatekeeper');

/**
 * @typedef {Object} GatekeeperDecision
 * @property {boolean}  shouldEnrich   - Whether enrichment should run
 * @property {string[]} firedTriggers  - Names of triggers that fired
 * @property {string}   reasoning      - Plain-language explanation of the decision
 */

/**
 * Evaluates an FKO against all configured triggers.
 *
 * @param {import('../../pass1/FactExtractor.js').FactualKnowledgeObject} fko
 * @returns {GatekeeperDecision}
 */
export function evaluateEnrichmentNeed(fko) {
  const enrichCfg = PROVIDERS_CONFIG.enrichment;

  if (!enrichCfg.enabled) {
    return {
      shouldEnrich:  false,
      firedTriggers: [],
      reasoning:     'Evidence enrichment is globally disabled in providers.config.js.',
    };
  }

  const triggers = enrichCfg.triggers;
  const firedTriggers = [];
  const reasons = [];

  // ── Trigger 1: Low source count ───────────────────────────────────
  if (triggers.lowSourceCount?.enabled) {
    const threshold = triggers.lowSourceCount.threshold ?? 2;
    if ((fko.articleCount ?? 0) < threshold) {
      firedTriggers.push('lowSourceCount');
      reasons.push(
        `Story has only ${fko.articleCount} source article${fko.articleCount !== 1 ? 's' : ''} ` +
        `(threshold: ${threshold}). Additional corroboration would strengthen confidence.`
      );
    }
  }

  // ── Trigger 2: Contested facts ────────────────────────────────────
  if (triggers.hasContestedFacts?.enabled) {
    const contestedCount = (fko.facts ?? []).filter(f => f.isContested).length;
    if (contestedCount > 0) {
      firedTriggers.push('hasContestedFacts');
      reasons.push(
        `${contestedCount} contested fact${contestedCount !== 1 ? 's' : ''} detected. ` +
        `Enrichment can search for evidence that resolves or confirms the disagreement.`
      );
    }
  }

  // ── Trigger 3: Missing official source ────────────────────────────
  if (triggers.missingOfficialSource?.enabled) {
    const hasOfficial = (fko.facts ?? []).some(f => f.isOfficial);
    const minConf     = triggers.missingOfficialSource.minConfidence ?? 60;
    const storyIsSignificant = (fko.articleCount ?? 0) >= 2;

    if (!hasOfficial && storyIsSignificant) {
      firedTriggers.push('missingOfficialSource');
      reasons.push(
        `No official source (government, central bank, or regulatory body) has confirmed ` +
        `information in this story. Enrichment can search for official statements or releases.`
      );
    }
  }

  // ── Trigger 4: High-impact assets ────────────────────────────────
  if (triggers.highImpactAssets?.enabled) {
    const minCount = triggers.highImpactAssets.minImpactCount ?? 2;
    // Count candidate symbols that map to high-sensitivity assets
    const highImpactSymbols = (fko.candidateSymbols ?? []).filter(sym =>
      HIGH_IMPACT_SYMBOLS.has(sym)
    );
    if (highImpactSymbols.length >= minCount) {
      firedTriggers.push('highImpactAssets');
      reasons.push(
        `Story is flagged as potentially affecting ${highImpactSymbols.length} high-impact assets ` +
        `(${highImpactSymbols.join(', ')}). Additional evidence would improve the quality of ` +
        `impact assessments for these assets.`
      );
    }
  }

  // ── Trigger 5: Breaking status ────────────────────────────────────
  // Note: FKOs don't carry status directly — we infer from high article velocity
  // A cluster with a very recent first article and multiple rapid-fire sources
  // is treated as a potential breaking story.
  if (triggers.breakingStatus?.enabled) {
    const isVeryRecent = isWithinHours(fko.latestPublished, 2);
    const hasMultipleSources = (fko.publishersSeen ?? []).length >= 3;
    if (isVeryRecent && hasMultipleSources) {
      firedTriggers.push('breakingStatus');
      reasons.push(
        `Story appears to be breaking — first articles published within the last 2 hours ` +
        `from multiple sources. Enrichment can gather early official confirmation.`
      );
    }
  }

  const shouldEnrich = firedTriggers.length > 0;

  if (shouldEnrich) {
    logger.info(
      `Enrichment APPROVED for "${fko.representativeHeadline}". ` +
      `Triggers: [${firedTriggers.join(', ')}]`
    );
  } else {
    logger.debug(
      `Enrichment skipped for "${fko.representativeHeadline}". ` +
      `No triggers met. Story appears well-evidenced.`
    );
  }

  return {
    shouldEnrich,
    firedTriggers,
    reasoning: shouldEnrich
      ? reasons.join(' ')
      : 'No enrichment triggers were met. The story has sufficient evidence for standard reasoning.',
  };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

// Symbols where high-quality evidence is especially important due to
// the significance of the assets or the complexity of their macro relationships
const HIGH_IMPACT_SYMBOLS = new Set([
  'XAUUSD', 'BTCUSD', 'ETHUSD', 'EURUSD', 'USDJPY', 'GBPUSD',
  'NAS100', 'SPX500', 'US30', 'OIL', 'NATGAS', 'GBPJPY',
]);

function isWithinHours(isoTimestamp, hours) {
  if (!isoTimestamp) return false;
  const ms = Date.now() - new Date(isoTimestamp).getTime();
  return ms <= hours * 3_600_000;
}
