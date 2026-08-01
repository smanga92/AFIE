/**
 * AFIE EvidenceEnrichmentOrchestrator (V2B)
 *
 * The entry point for the Evidence Enrichment Layer.
 *
 * Called by Pipeline.js between Pass 1 and Pass 2.
 * Takes FKO[] from Pass 1, returns EnrichedFKO[] for Pass 2.
 *
 * For each FKO:
 *   1. EnrichmentGatekeeper evaluates whether enrichment is needed
 *   2. If yes: runs the appropriate finders (based on which triggers fired)
 *   3. Merges findings into the FKO as an optional `enrichment` field
 *   4. Pass 2 reads enrichment data if present; ignores it if absent
 *
 * FKOs that do not trigger enrichment pass through unchanged.
 * The pipeline always continues regardless of enrichment outcomes.
 *
 * Architecture constraints:
 *   - This module does NOT modify Pass 1 or Pass 2
 *   - It does NOT generate market analysis
 *   - It does NOT call the AI reasoning model
 *   - It only locates and attaches evidence
 *   - Enrichment failures never block the pipeline
 */

import { evaluateEnrichmentNeed }     from './EnrichmentGatekeeper.js';
import {
  findSupportingEvidence,
  findContradictingEvidence,
  findOfficialStatement,
  findMacroContext,
}                                      from './EvidenceFinders.js';
import { PROVIDERS_CONFIG }            from '../config/providers.config.js';
import { EventBus }                    from '../core/EventBus.js';
import { Logger }                      from '../core/Logger.js';

const logger = new Logger('EvidenceEnrichmentOrchestrator');

/**
 * @typedef {import('../pass1/FactExtractor.js').FactualKnowledgeObject} FKO
 *
 * EnrichedFKO is an FKO with an optional enrichment field.
 * Pass 2 reads it if present; the FKO schema is otherwise unchanged.
 *
 * @typedef {FKO & {
 *   enrichment?: {
 *     wasEnriched:       boolean,
 *     gatekeeperDecision: import('./EnrichmentGatekeeper.js').GatekeeperDecision,
 *     results:           import('./EvidenceFinders.js').EvidenceResult[],
 *     enrichedAt:        string,
 *     searchCount:       number,
 *   }
 * }} EnrichedFKO
 */

/**
 * Runs the Evidence Enrichment Layer across all FKOs.
 *
 * @param {FKO[]} fkos
 * @returns {Promise<EnrichedFKO[]>}
 */
export async function enrichFKOs(fkos) {
  if (!PROVIDERS_CONFIG.enrichment.enabled) {
    logger.info('Evidence Enrichment Layer is disabled. Passing FKOs through unchanged.');
    return fkos;
  }

  logger.info(`Evidence Enrichment: evaluating ${fkos.length} FKOs...`);
  const startTime = Date.now();

  let enrichedCount = 0;
  let skippedCount  = 0;
  let errorCount    = 0;

  const results = await Promise.all(
    fkos.map(async fko => {
      try {
        const enriched = await enrichOneFKO(fko);
        if (enriched.enrichment?.wasEnriched) enrichedCount++;
        else skippedCount++;
        return enriched;
      } catch (err) {
        logger.error(`Enrichment failed for FKO "${fko.representativeHeadline}":`, err.message);
        errorCount++;
        return fko; // pass through unchanged — never block the pipeline
      }
    })
  );

  const durationMs = Date.now() - startTime;
  logger.info(
    `Evidence Enrichment complete: ${enrichedCount} enriched, ${skippedCount} skipped, ` +
    `${errorCount} errors, ${durationMs}ms total.`
  );

  EventBus.emit('enrichment:complete', { enrichedCount, skippedCount, errorCount, durationMs });

  return results;
}

// ─── Per-FKO enrichment ───────────────────────────────────────────────────────

async function enrichOneFKO(fko) {
  // Step 1: Gatekeeper decides whether to enrich
  const decision = evaluateEnrichmentNeed(fko);

  if (!decision.shouldEnrich) {
    return {
      ...fko,
      enrichment: {
        wasEnriched:        false,
        gatekeeperDecision: decision,
        results:            [],
        enrichedAt:         new Date().toISOString(),
        searchCount:        0,
      },
    };
  }

  // Step 2: Run the finders that correspond to fired triggers
  const maxSearches = PROVIDERS_CONFIG.enrichment.maxSearchesPerFko ?? 4;
  const evidenceResults = [];
  let searchCount = 0;

  // Map trigger names to finder functions
  const triggerFinderMap = {
    lowSourceCount:        () => findSupportingEvidence(fko),
    hasContestedFacts:     () => findContradictingEvidence(fko),
    missingOfficialSource: () => findOfficialStatement(fko),
    highImpactAssets:      () => findSupportingEvidence(fko),
    breakingStatus:        () => findOfficialStatement(fko),
  };

  // Deduplicate: if multiple triggers map to the same finder, run it once
  const scheduledFinders = new Set();
  for (const trigger of decision.firedTriggers) {
    const finder = triggerFinderMap[trigger];
    if (finder && !scheduledFinders.has(finder)) {
      scheduledFinders.add(finder);
    }
  }

  // Always try context enrichment for breaking stories
  if (decision.firedTriggers.includes('breakingStatus')) {
    scheduledFinders.add(() => findMacroContext(fko));
  }

  // Run finders up to maxSearches limit
  for (const finder of scheduledFinders) {
    if (searchCount >= maxSearches) break;
    try {
      const result = await finder();
      evidenceResults.push(result);
      searchCount++;
    } catch (err) {
      logger.warn(`Finder failed during enrichment of "${fko.representativeHeadline}":`, err.message);
    }
  }

  logger.debug(
    `Enriched "${fko.representativeHeadline}": ` +
    `${evidenceResults.filter(r => r.found).length}/${searchCount} searches found evidence.`
  );

  return {
    ...fko,
    enrichment: {
      wasEnriched:        true,
      gatekeeperDecision: decision,
      results:            evidenceResults,
      enrichedAt:         new Date().toISOString(),
      searchCount,
    },
  };
}
