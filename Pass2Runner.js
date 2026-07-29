/**
 * AFIE Pass2Runner
 *
 * Orchestrates all Pass 2 stages for every Factual Knowledge Object
 * produced by Pass 1.
 *
 * For each FKO:
 *   1. Check StoryMatcher — does this belong to an existing story?
 *   2. Load existing story context if updating
 *   3. Scan for contradictions
 *   4. Compute confidence score
 *   5. Run AI reasoning (ReasoningEngine)
 *   6. Validate output against schema
 *   7. Save to StoryStore
 *
 * Returns the complete set of AnalysedStory objects for the UI.
 */

import { findMatchingStory }  from '../memory/StoryMatcher.js';
import { runReasoning }       from './ReasoningEngine.js';
import { scanContradictions } from './ContradictionScanner.js';
import { scoreConfidence }    from '../scoring/ConfidenceScorer.js';
import { detectStatusChange } from '../scoring/StatusMachine.js';
import { saveStory }          from '../memory/StoryStore.js';
import { validateOutput }     from '../output/SchemaValidator.js';
import { EventBus }           from '../core/EventBus.js';
import { Logger }             from '../core/Logger.js';
import { PIPELINE_CONFIG }    from '../config/pipeline.config.js';

const logger = new Logger('Pass2Runner');

/**
 * Runs the complete Pass 2 pipeline for all FKOs from Pass 1.
 *
 * @param {Object} params
 * @param {import('../pass1/FactExtractor.js').FactualKnowledgeObject[]} params.fkos
 * @param {string[]} params.watchlist - User's asset watchlist
 * @returns {Promise<{
 *   stories: import('../output/schema/types.js').AnalysedStory[],
 *   metrics: Pass2Metrics
 * }>}
 */
export async function runPass2({ fkos, watchlist }) {
  const runId = `p2_${Date.now()}`;
  const startTime = Date.now();

  logger.info(`=== Pass 2 BEGIN [${runId}] — ${fkos.length} FKOs to analyse ===`);
  EventBus.emit('pass2:start', { runId, fkoCount: fkos.length });

  const metrics = {
    runId,
    startedAt:      new Date().toISOString(),
    fkosReceived:   fkos.length,
    storiesCreated: 0,
    storiesUpdated: 0,
    storiesSkipped: 0,
    errors:         0,
    durationMs:     0,
  };

  const analysedStories = [];

  // Filter FKOs to only those that touch at least one watchlist asset
  const relevantFkos = fkos.filter(fko => {
    const hasWatchlistAsset = fko.candidateSymbols?.some(s => watchlist.includes(s));
    if (!hasWatchlistAsset) {
      logger.debug(`FKO "${fko.representativeHeadline}" has no watchlist assets. Skipping.`);
      metrics.storiesSkipped++;
    }
    return hasWatchlistAsset;
  });

  logger.info(`${relevantFkos.length} of ${fkos.length} FKOs are relevant to watchlist.`);

  // Process each FKO sequentially to avoid overwhelming the AI API
  // In production: use a queue with configurable concurrency
  for (const fko of relevantFkos) {
    try {
      const story = await processOneFko(fko, watchlist, metrics);
      if (story) {
        analysedStories.push(story);
      }
    } catch (err) {
      logger.error(`Pass 2 failed for FKO "${fko.representativeHeadline}":`, err.message);
      metrics.errors++;
    }
  }

  metrics.durationMs = Date.now() - startTime;
  metrics.completedAt = new Date().toISOString();

  logger.info(
    `=== Pass 2 COMPLETE [${runId}] — ` +
    `${metrics.storiesCreated} created, ${metrics.storiesUpdated} updated, ` +
    `${metrics.storiesSkipped} skipped, ${metrics.errors} errors ` +
    `in ${metrics.durationMs}ms ===`
  );

  EventBus.emit('pass2:complete', metrics);

  return { stories: analysedStories, metrics };
}

// ─── Per-FKO Processing ───────────────────────────────────────────────────────

async function processOneFko(fko, watchlist, metrics) {
  logger.debug(`Processing FKO: "${fko.representativeHeadline}"`);

  // Stage 1: Story memory check
  const matchResult = await findMatchingStory(fko);
  const existingStory = matchResult.matchedStory;
  const isUpdate = matchResult.decision === 'update_existing';

  // Stage 2: Contradiction detection
  const contradictions = scanContradictions(fko);

  // Stage 3: Confidence scoring
  const confidence = scoreConfidence({ fko, existingStory, contradictions });

  // Stage 4: AI reasoning
  const ctx = { fko, watchlist, matchResult, existingStory, contradictions, confidence };
  const story = await runReasoning(ctx);

  // Stage 5: Status machine — apply automatic status transitions
  const resolvedStatus = detectStatusChange(story, existingStory);
  story.status = resolvedStatus.status;
  story.statusReason = resolvedStatus.reason;

  // Stage 6: Schema validation
  const validation = validateOutput(story);
  if (!validation.valid) {
    logger.warn(
      `Schema validation warnings for "${story.slug}": ` +
      validation.errors.join('; ')
    );
    if (PIPELINE_CONFIG.output.rejectInvalidOutput && validation.critical) {
      logger.error(`Rejecting story "${story.slug}" due to critical schema violations.`);
      metrics.errors++;
      return null;
    }
  }

  // Stage 7: Persist to StoryStore
  await saveStory(story);

  if (isUpdate) {
    metrics.storiesUpdated++;
    EventBus.emit('story:updated', { storyId: story.id, slug: story.slug, version: story.versionNumber });
  } else {
    metrics.storiesCreated++;
    EventBus.emit('story:created', { storyId: story.id, slug: story.slug });
  }

  logger.info(
    `[${isUpdate ? 'UPDATE' : 'NEW'}] "${story.slug}" — ` +
    `status: ${story.status}, confidence: ${confidence.overallScore}/100, ` +
    `assets: ${story.affectedAssets?.map(a => a.symbol).join(', ')}`
  );

  return story;
}
