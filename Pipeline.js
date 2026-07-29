/**
 * AFIE Pipeline
 *
 * Top-level orchestrator.
 * This is the single entry point that external code calls to run the full engine.
 *
 * Sequence:
 *   1. Run Pass 1 (Fact Collection Engine)
 *   2. Pass the FKOs to Pass 2 (Market Reasoning Engine)
 *   3. Return the final AnalysedStory[]
 *
 * The boundary between Pass 1 and Pass 2 is enforced here.
 * Pass 2 receives FKOs only — never raw articles.
 */

import { runPass1 } from '../pass1/Pass1Runner.js';
import { runPass2 } from '../pass2/Pass2Runner.js';
import { loadAllStories } from '../memory/StoryStore.js';
import { EventBus } from './EventBus.js';
import { Logger }   from './Logger.js';

const logger = new Logger('Pipeline');

/**
 * Runs the complete AFIE intelligence pipeline.
 *
 * @param {Object} options
 * @param {string[]} options.watchlist    - User's asset symbols
 * @param {Date}   [options.since]        - Collect articles since this date
 * @param {boolean}[options.dryRun]       - Skip AI calls (for testing)
 * @returns {Promise<{
 *   newAndUpdatedStories: AnalysedStory[],
 *   allStories: AnalysedStory[],
 *   metrics: { pass1: Object, pass2: Object, totalDurationMs: number }
 * }>}
 */
export async function runPipeline(options = {}) {
  const pipelineStart = Date.now();
  const { watchlist = [], since, dryRun = false } = options;

  logger.info('╔═══════════════════════════════════════════╗');
  logger.info('║  AFIE Intelligence Engine — Pipeline Run  ║');
  logger.info('╚═══════════════════════════════════════════╝');
  logger.info(`Watchlist: ${watchlist.join(', ')}`);

  EventBus.emit('pipeline:start', { watchlist, since });

  // ── PASS 1 ───────────────────────────────────────────────────────────
  logger.info('');
  logger.info('── PASS 1: Fact Collection Engine ──────────');
  const { fkos, metrics: pass1Metrics } = await runPass1({ since, dryRun });

  if (fkos.length === 0) {
    logger.info('Pass 1 produced no FKOs. Pipeline complete (no new stories).');
    const allStories = await loadAllStories();
    return {
      newAndUpdatedStories: [],
      allStories,
      metrics: { pass1: pass1Metrics, pass2: null, totalDurationMs: Date.now() - pipelineStart },
    };
  }

  // ── PASS 1 → PASS 2 BOUNDARY ─────────────────────────────────────────
  // Only FKOs cross this boundary. Raw articles are not passed forward.
  logger.info('');
  logger.info(`── PASS 1 → PASS 2 BOUNDARY: ${fkos.length} FKOs handed off ──`);
  logger.info('');

  // ── PASS 2 ───────────────────────────────────────────────────────────
  logger.info('── PASS 2: Market Reasoning Engine ─────────');
  const { stories: newAndUpdated, metrics: pass2Metrics } = await runPass2({
    fkos,
    watchlist,
  });

  // Load all stories from store (includes historical ones not touched this run)
  const allStories = await loadAllStories();

  const totalDurationMs = Date.now() - pipelineStart;

  logger.info('');
  logger.info(`Pipeline complete in ${totalDurationMs}ms.`);
  logger.info(`New/updated this run: ${newAndUpdated.length}`);
  logger.info(`Total stories in store: ${allStories.length}`);

  EventBus.emit('pipeline:complete', {
    newAndUpdated: newAndUpdated.length,
    total: allStories.length,
    totalDurationMs,
  });

  return {
    newAndUpdatedStories: newAndUpdated,
    allStories,
    metrics: { pass1: pass1Metrics, pass2: pass2Metrics, totalDurationMs },
  };
}

/**
 * Convenience: returns all stored stories without running the pipeline.
 * Used by the UI to load current state.
 */
export async function getCurrentStories() {
  return loadAllStories();
}
