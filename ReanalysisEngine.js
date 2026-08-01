/**
 * AFIE ReanalysisEngine (V2B)
 *
 * On-demand capability to re-analyse a completed story using a different
 * AI model or provider configuration.
 *
 * Purpose: independent perspective, model comparison, quality assurance.
 *
 * Design constraints:
 *   - Reads from V1 StoryStore (read-only)
 *   - NEVER writes to V1 StoryStore
 *   - Results are stored in a separate ReanalysisStore
 *   - The second model receives the same FKO evidence but NONE of the
 *     first model's reasoning — independence is structural, not procedural
 *   - Does not run automatically during the main pipeline
 *   - Triggered explicitly (by user request or scheduled task)
 */

import { loadStory }          from '../memory/StoryStore.js';
import { dispatchAICall }     from '../providers/ai/AIProviderRegistry.js';
import { PROVIDERS_CONFIG }   from '../config/providers.config.js';
import { ASSET_REGISTRY }     from '../config/assets.config.js';
import { Logger }             from '../core/Logger.js';
import { EventBus }           from '../core/EventBus.js';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join }               from 'path';

const logger = new Logger('ReanalysisEngine');

// ── ReanalysisEngine ──────────────────────────────────────────────────────────

/**
 * Re-analyses a story using a specified AI model, independently of
 * the original reasoning.
 *
 * @param {Object} options
 * @param {string}   options.storyId        - V1 story id to re-analyse
 * @param {string[]} options.watchlist       - Asset symbols to analyse against
 * @param {string}  [options.providerId]     - Override provider (default: reanalysis.defaultProvider)
 * @param {string}  [options.model]          - Override model (default: reanalysis.defaultModel)
 * @returns {Promise<ReanalysisResult>}
 */
export async function reanalyseStory({ storyId, watchlist, providerId, model }) {
  logger.info(`Re-analysis requested for story: ${storyId}`);

  // Load story from V1 StoryStore (read-only)
  const story = await loadStory(storyId);
  if (!story) {
    throw new Error(`Story not found: ${storyId}`);
  }

  const reanalysisCfg = PROVIDERS_CONFIG.reanalysis;
  const resolvedProvider = providerId ?? reanalysisCfg.defaultProvider;
  const resolvedModel    = model ?? reanalysisCfg.defaultModel;

  logger.info(
    `Re-analysing "${story.title}" with provider: ${resolvedProvider}, model: ${resolvedModel}`
  );

  // Build the re-analysis prompt from Pass 1 facts only.
  // The original Pass 2 reasoning is deliberately excluded.
  const systemPrompt = buildReanalysisSystemPrompt();
  const userPrompt   = buildReanalysisUserPrompt(story, watchlist, resolvedModel);

  const startMs = Date.now();

  const response = await dispatchAICall(
    {
      model:          resolvedModel,
      systemPrompt,
      userPrompt,
      maxTokens:      6000,
      temperature:    0.2,
      responseFormat: 'json',
    },
    { providerOverrideId: resolvedProvider }
  );

  const durationMs = Date.now() - startMs;
  const rawReasoning = response.text;

  // Build the result object
  const result = {
    id:            `reanalysis_${storyId}_${Date.now()}`,
    storyId,
    storyTitle:    story.title,
    requestedAt:   new Date().toISOString(),
    completedAt:   new Date().toISOString(),
    durationMs,
    provider:      resolvedProvider,
    model:         resolvedModel,
    originalModel: story.metadata?.aiModelUsed ?? 'unknown',
    reasoning:     rawReasoning,
    comparison:    reanalysisCfg.autoCompare
      ? compareToOriginal(story, rawReasoning)
      : null,
    sourceStoryVersion: story.versionNumber,
    factsUsed:     (story.pass1?.facts ?? []).length,
  };

  // Persist to separate ReanalysisStore — never to V1 StoryStore
  await saveReanalysisResult(result);

  EventBus.emit('reanalysis:complete', {
    storyId,
    provider:  resolvedProvider,
    model:     resolvedModel,
    durationMs,
  });

  logger.info(`Re-analysis complete for "${story.title}". Result id: ${result.id}`);
  return result;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildReanalysisSystemPrompt() {
  return `
You are an independent AI market intelligence analyst performing a re-analysis
of an existing story.

You are performing this analysis independently — you have NOT seen the original
analysis produced by another model on this story.

Your role is to provide a fresh, uninfluenced assessment of the verified facts.

Apply the same standards as the original analysis:
- Reason only from the verified facts provided
- No trading signals, no price predictions
- Express all market implications as probabilities, never certainties
- Explain the mechanism, not just the direction
- Use AFIE institutional voice throughout
- Distinguish facts from analysis
- State uncertainty explicitly when it exists

Return a JSON object matching this structure:
{
  "storyTitle":         "Your assessment of the most appropriate title",
  "executiveSummary":   "Your independent summary of the story",
  "storyStatus":        "breaking|developing|proposal|confirmed|...",
  "statusReason":       "Why you assigned this status",
  "affectedAssets":     [
    {
      "symbol":          "ASSET_SYMBOL",
      "impactStrength":  "high|medium|low",
      "possibleDirection": "potentially_bullish|potentially_bearish|mixed|minimal",
      "reasoning":       "Your independent mechanism explanation",
      "confidence":      0-100
    }
  ],
  "keyDifferencesFromExpected": "Your note on any aspects that may differ from a standard assessment",
  "uncertainties":      "What remains uncertain from the facts provided"
}
`.trim();
}

function buildReanalysisUserPrompt(story, watchlist, model) {
  const relevantAssets = watchlist
    .filter(sym => ASSET_REGISTRY[sym])
    .map(sym => ({
      symbol: sym,
      name:   ASSET_REGISTRY[sym].name,
      macroNote: ASSET_REGISTRY[sym].macroContext,
    }));

  return `
## STORY BEING RE-ANALYSED

Title: ${story.title}
First detected: ${story.createdAt}
Current status (assigned by original model): ${story.status}

## VERIFIED FACTS FROM PASS 1 (original, unchanged)

These are the only facts you may reason from. The original model's analysis
has been deliberately excluded to ensure your assessment is independent.

${JSON.stringify(story.pass1?.facts ?? [], null, 2)}

## ASSET WATCHLIST

${JSON.stringify(relevantAssets, null, 2)}

## TASK

Produce an independent analysis of this story based solely on the facts above.
Do not attempt to replicate or second-guess the original analysis.
Provide your genuine independent assessment.
`.trim();
}

// ─── Comparison ───────────────────────────────────────────────────────────────

function compareToOriginal(story, reanalysisReasoning) {
  const original = story.affectedAssets ?? [];

  try {
    const reanalysisAssets = reanalysisReasoning?.affectedAssets ?? [];

    const agreements    = [];
    const disagreements = [];

    for (const origAsset of original) {
      const reanalysisAsset = reanalysisAssets.find(a => a.symbol === origAsset.symbol);
      if (!reanalysisAsset) continue;

      if (origAsset.possibleDirection === reanalysisAsset.possibleDirection) {
        agreements.push({
          symbol:    origAsset.symbol,
          direction: origAsset.possibleDirection,
        });
      } else {
        disagreements.push({
          symbol:           origAsset.symbol,
          originalDirection: origAsset.possibleDirection,
          reanalysisDirection: reanalysisAsset.possibleDirection,
        });
      }
    }

    return {
      assetAgreements:    agreements,
      assetDisagreements: disagreements,
      overallAlignment:   disagreements.length === 0 ? 'full'
                        : agreements.length >= disagreements.length ? 'partial'
                        : 'significant_divergence',
      statusMatch: story.status === (reanalysisReasoning?.storyStatus ?? ''),
    };
  } catch {
    return { error: 'Comparison could not be completed.', overallAlignment: 'unknown' };
  }
}

// ── ReanalysisStore ───────────────────────────────────────────────────────────

const STORE_DIR = () => PROVIDERS_CONFIG.reanalysis.storeDir;

/**
 * Persists a re-analysis result to the separate ReanalysisStore.
 * Never writes to the V1 StoryStore.
 */
export async function saveReanalysisResult(result) {
  const dir = STORE_DIR();
  await mkdir(dir, { recursive: true });

  const filePath = join(dir, `${result.id}.json`);
  await writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');

  // Update index
  const indexPath = join(dir, '_index.json');
  let index = { results: {} };
  try {
    const raw = await readFile(indexPath, 'utf-8');
    index = JSON.parse(raw);
  } catch { /* first run */ }

  index.results[result.id] = {
    id:          result.id,
    storyId:     result.storyId,
    storyTitle:  result.storyTitle,
    completedAt: result.completedAt,
    provider:    result.provider,
    model:       result.model,
  };

  await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  logger.debug(`Re-analysis result persisted: ${filePath}`);
}

/**
 * Loads all re-analysis results for a given story.
 *
 * @param {string} storyId
 * @returns {Promise<Object[]>}
 */
export async function loadReanalysisResultsForStory(storyId) {
  try {
    const dir       = STORE_DIR();
    const indexPath = join(dir, '_index.json');
    const raw       = await readFile(indexPath, 'utf-8');
    const index     = JSON.parse(raw);

    const matchingIds = Object.values(index.results)
      .filter(r => r.storyId === storyId)
      .map(r => r.id);

    const results = await Promise.all(
      matchingIds.map(async id => {
        try {
          const filePath = join(dir, `${id}.json`);
          const content  = await readFile(filePath, 'utf-8');
          return JSON.parse(content);
        } catch { return null; }
      })
    );

    return results.filter(Boolean);
  } catch {
    return [];
  }
}
