/**
 * AFIE Pass1Runner
 *
 * Orchestrates all Pass 1 stages in the correct sequence.
 * This is the only module that knows the full Pass 1 pipeline order.
 *
 * Pipeline:
 *   collectArticles → cleanArticles → detectDuplicates → clusterArticles → extractFacts
 *
 * Returns: FactualKnowledgeObject[]
 *
 * Pass 2 begins only after this function resolves.
 * The boundary between Pass 1 and Pass 2 is the return value of this function.
 */

import { collectArticles }  from './ArticleCollector.js';
import { cleanArticles }    from './ArticleCleaner.js';
import { detectDuplicates } from './DuplicateDetector.js';
import { clusterArticles }  from './StoryClusterer.js';
import { extractFacts }     from './FactExtractor.js';
import { EventBus }         from '../core/EventBus.js';
import { Logger }           from '../core/Logger.js';

const logger = new Logger('Pass1Runner');

/**
 * Runs the complete Pass 1 pipeline.
 *
 * @param {Object} options
 * @param {Date}   [options.since]   - Collect articles published after this date
 * @param {boolean}[options.dryRun]  - If true, runs but returns before AI fact extraction
 * @returns {Promise<{
 *   fkos: import('./FactExtractor.js').FactualKnowledgeObject[],
 *   metrics: Pass1Metrics
 * }>}
 */
export async function runPass1(options = {}) {
  const runId = `p1_${Date.now()}`;
  const startTime = Date.now();

  logger.info(`=== Pass 1 BEGIN [${runId}] ===`);
  EventBus.emit('pass1:start', { runId });

  const metrics = {
    runId,
    startedAt:          new Date().toISOString(),
    articlesCollected:  0,
    articlesCleaned:    0,
    articlesAfterDedup: 0,
    storyClusters:      0,
    fkosProduced:       0,
    durationMs:         0,
    stages: {},
  };

  try {
    // ── Stage 1: Collection ─────────────────────────────────────────
    let stageStart = Date.now();
    const rawArticles = await collectArticles({ since: options.since });
    metrics.articlesCollected = rawArticles.length;
    metrics.stages.collection = { durationMs: Date.now() - stageStart, count: rawArticles.length };
    logger.info(`Stage 1 complete: ${rawArticles.length} raw articles collected`);

    if (rawArticles.length === 0) {
      logger.warn('No articles collected. Ending Pass 1 early.');
      return finalise([], metrics, startTime);
    }

    // ── Stage 2: Cleaning ───────────────────────────────────────────
    stageStart = Date.now();
    const cleanedArticles = cleanArticles(rawArticles);
    metrics.articlesCleaned = cleanedArticles.length;
    metrics.stages.cleaning = { durationMs: Date.now() - stageStart, count: cleanedArticles.length };
    logger.info(`Stage 2 complete: ${cleanedArticles.length} clean articles`);

    // ── Stage 3: Deduplication ──────────────────────────────────────
    stageStart = Date.now();
    const uniqueArticles = detectDuplicates(cleanedArticles);
    metrics.articlesAfterDedup = uniqueArticles.length;
    metrics.stages.deduplication = {
      durationMs: Date.now() - stageStart,
      count: uniqueArticles.length,
      removed: cleanedArticles.length - uniqueArticles.length,
    };
    logger.info(`Stage 3 complete: ${uniqueArticles.length} unique articles (${cleanedArticles.length - uniqueArticles.length} duplicates removed)`);

    // ── Stage 4: Clustering ─────────────────────────────────────────
    stageStart = Date.now();
    const clusters = clusterArticles(uniqueArticles);
    metrics.storyClusters = clusters.length;
    metrics.stages.clustering = { durationMs: Date.now() - stageStart, count: clusters.length };
    logger.info(`Stage 4 complete: ${clusters.length} story clusters`);

    if (options.dryRun) {
      logger.info('Dry run — skipping fact extraction (Stage 5)');
      return finalise([], metrics, startTime);
    }

    // ── Stage 5: Fact Extraction ────────────────────────────────────
    stageStart = Date.now();
    const fkos = await extractFacts(clusters);
    metrics.fkosProduced = fkos.length;
    metrics.stages.factExtraction = { durationMs: Date.now() - stageStart, count: fkos.length };
    logger.info(`Stage 5 complete: ${fkos.length} Factual Knowledge Objects produced`);

    // ── Pass 1 Complete ─────────────────────────────────────────────
    logger.info(`=== Pass 1 COMPLETE [${runId}] — ${fkos.length} FKOs ready for Pass 2 ===`);
    return finalise(fkos, metrics, startTime);

  } catch (error) {
    logger.error(`Pass 1 FAILED [${runId}]:`, error);
    EventBus.emit('pass1:error', { runId, error: error.message });
    throw error;
  }
}

function finalise(fkos, metrics, startTime) {
  metrics.durationMs = Date.now() - startTime;
  metrics.completedAt = new Date().toISOString();
  EventBus.emit('pass1:complete', metrics);
  return { fkos, metrics };
}
