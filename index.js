/**
 * AFIE Intelligence Engine — Entry Point
 *
 * Runs the pipeline on a schedule or once on demand.
 *
 * Usage:
 *   node index.js           → runs continuously on schedule
 *   node index.js --once    → runs once and exits
 *
 * Environment variables required:
 *   ANTHROPIC_API_KEY       → Claude API key
 *   NEWSAPI_KEY             → NewsAPI key (optional)
 *   AFIE_STORE_DIR          → Path for story persistence (default: ./data/stories)
 *   AFIE_LOG_LEVEL          → debug | info | warn | error (default: info)
 *
 * The pipeline result (AnalysedStory[]) is written to:
 *   ./data/output/latest.json   → always the most recent full output
 *
 * The UI reads from this file. In production, replace with an API server.
 */

import { writeFile, mkdir } from 'fs/promises';
import { runPipeline }      from './core/Pipeline.js';
import { getAllSymbols }     from './config/assets.config.js';
import { PIPELINE_CONFIG }  from './config/pipeline.config.js';
import { EventBus }         from './core/EventBus.js';
import { Logger }           from './core/Logger.js';

const logger  = new Logger('AFIE');
const runOnce = process.argv.includes('--once');

// Default watchlist — all symbols from assets.config
// In production: load from user database
const WATCHLIST = getAllSymbols();

// ─── Event listeners for monitoring ──────────────────────────────────────────

EventBus.on('story:created', ({ slug, storyId }) => {
  logger.info(`📰 NEW STORY: ${slug} [${storyId}]`);
});

EventBus.on('story:updated', ({ slug, version }) => {
  logger.info(`🔄 UPDATED: ${slug} (v${version})`);
});

EventBus.on('pipeline:complete', ({ newAndUpdated, total, totalDurationMs }) => {
  logger.info(`✅ Pipeline complete — ${newAndUpdated} new/updated, ${total} total stories, ${totalDurationMs}ms`);
});

// ─── Output writer ────────────────────────────────────────────────────────────

async function writeOutput(result) {
  await mkdir('./data/output', { recursive: true });

  const output = {
    generatedAt:   new Date().toISOString(),
    storyCount:    result.allStories.length,
    newThisRun:    result.newAndUpdatedStories.length,
    stories:       result.allStories,
    metrics:       result.metrics,
  };

  await writeFile(
    './data/output/latest.json',
    JSON.stringify(output, null, 2),
    'utf-8'
  );

  logger.info(`Output written to ./data/output/latest.json`);
}

// ─── Pipeline runner ──────────────────────────────────────────────────────────

async function run() {
  logger.info('');
  logger.info('╔══════════════════════════════════════════════════════╗');
  logger.info('║  AFIE — AI Fundamental Intelligence Engine v1.0      ║');
  logger.info('║  Institutional market intelligence. Not signals.      ║');
  logger.info('╚══════════════════════════════════════════════════════╝');
  logger.info('');

  try {
    const result = await runPipeline({
      watchlist: WATCHLIST,
    });

    await writeOutput(result);
    return result;

  } catch (err) {
    logger.error('Pipeline run failed:', err);
    throw err;
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

if (runOnce) {
  // Single run
  run()
    .then(() => {
      logger.info('Single run complete. Exiting.');
      process.exit(0);
    })
    .catch(err => {
      logger.error('Fatal error:', err);
      process.exit(1);
    });

} else {
  // Continuous scheduled run
  const intervalMs = PIPELINE_CONFIG.collection.intervalMs;
  logger.info(`Starting scheduled pipeline. Interval: ${intervalMs / 60_000} minutes.`);

  // Run immediately on start, then on schedule
  run().catch(err => logger.error('Initial run error:', err));

  setInterval(() => {
    run().catch(err => logger.error('Scheduled run error:', err));
  }, intervalMs);

  logger.info('Scheduler active. Press Ctrl+C to stop.');
}
