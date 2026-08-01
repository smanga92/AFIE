/**
 * AFIE MorningBriefGenerator (V2A)
 *
 * Orchestrates the full Morning Intelligence Brief generation.
 *
 * Sequence:
 *   1. Load BriefingContext from V1 (via StoryReader)
 *   2. Run all synthesizers (pure data — no AI)
 *   3. Assemble structured context for AI
 *   4. Make ONE AI synthesis call to generate narrative prose
 *   5. Merge AI prose with structured synthesizer data
 *   6. Validate against MorningBrief schema
 *   7. Persist and return
 *
 * The AI's role here is ONLY prose generation — it writes institutional
 * narrative from pre-structured intelligence. It is not permitted to
 * introduce new analysis, new facts, or new story interpretations.
 *
 * V1 is never modified. V1 is only read.
 */

import { loadBriefingContext, loadPriorBrief } from '../interfaces/StoryReader.js';
import { classifyNarratives }                  from '../synthesizers/NarrativeClassifier.js';
import { analyseContinuity }                   from '../synthesizers/ContinuityAnalyser.js';
import { inferMarketExpectations }             from '../synthesizers/MarketExpectationInferrer.js';
import { summariseAssets }                     from '../synthesizers/AssetNarrativeSummariser.js';
import { identifyNarrativeRisks }              from '../synthesizers/NarrativeRiskIdentifier.js';
import { validateBrief }                       from './BriefValidator.js';
import { callAI }                              from '../../utils/AIClient.js';
import { NARRATIVE_CONFIG }                    from '../config/narrative.config.js';
import { EventBus }                            from '../../core/EventBus.js';
import { Logger }                              from '../../core/Logger.js';
import { writeFile, mkdir, readFile }          from 'fs/promises';
import { join }                                from 'path';

const logger = new Logger('MorningBriefGenerator');

/**
 * Generates the Morning Intelligence Brief.
 *
 * @param {Object} options
 * @param {string[]} [options.watchlist]    - User's asset symbols
 * @param {boolean}  [options.dryRun]       - Skip AI call, return structured data only
 * @returns {Promise<Object>} MorningBrief JSON
 */
export async function generateMorningBrief(options = {}) {
  const { watchlist = [], dryRun = false } = options;
  const startTime = Date.now();
  const briefId = buildBriefId();

  logger.info('');
  logger.info('╔══════════════════════════════════════════════════════╗');
  logger.info('║  AFIE — Morning Intelligence Brief Generation        ║');
  logger.info('╚══════════════════════════════════════════════════════╝');
  logger.info('');

  EventBus.emit('brief:generation:start', { briefId });

  try {
    // ── Step 1: Load V1 intelligence ───────────────────────────────
    const context   = await loadBriefingContext(watchlist);
    const priorBrief = await loadPriorBrief();
    logger.info(`Step 1 complete: ${context.activeStories.length} active stories loaded.`);

    if (context.activeStories.length === 0) {
      logger.warn('No active stories available. Generating minimal brief.');
      return generateMinimalBrief(briefId, context, watchlist, startTime);
    }

    // ── Step 2: Run all synthesizers ────────────────────────────────
    logger.info('Step 2: Running synthesizers...');

    const themeClassification = classifyNarratives(context);
    const continuityAssessment = analyseContinuity(context, priorBrief);
    const expectationsResult  = inferMarketExpectations(context);
    const assetSummaries      = summariseAssets(context);
    const narrativeRisks      = identifyNarrativeRisks(context, themeClassification);

    // Collect all monitoring items from active story watch points
    const monitoringItems = buildMonitoringItems(context);

    logger.info(`Step 2 complete: ${themeClassification.themes.length} themes, ${monitoringItems.length} monitoring items, ${narrativeRisks.length} risks.`);

    // ── Step 3: AI synthesis call (prose generation only) ───────────
    let aiProse = null;
    if (!dryRun) {
      logger.info('Step 3: AI narrative synthesis...');
      aiProse = await synthesiseNarrativeProse({
        themeClassification,
        continuityAssessment,
        expectationsResult,
        context,
        narrativeRisks,
      });
      logger.info('Step 3 complete.');
    } else {
      logger.info('Step 3: SKIPPED (dryRun=true)');
      aiProse = buildDryRunProse(themeClassification, context);
    }

    // ── Step 4: Assemble final brief ────────────────────────────────
    logger.info('Step 4: Assembling brief...');
    const brief = assembleBrief({
      briefId,
      context,
      themeClassification,
      continuityAssessment,
      expectationsResult,
      assetSummaries,
      narrativeRisks,
      monitoringItems,
      aiProse,
      watchlist,
      priorBrief,
      startTime,
    });

    // ── Step 5: Validate ────────────────────────────────────────────
    const validation = validateBrief(brief);
    if (!validation.valid) {
      logger.warn(`Brief validation warnings: ${validation.errors.join('; ')}`);
    }

    // ── Step 6: Persist ─────────────────────────────────────────────
    await persistBrief(brief);

    const durationMs = Date.now() - startTime;
    logger.info(`Morning Brief generated in ${durationMs}ms. ID: ${briefId}`);
    EventBus.emit('brief:generation:complete', { briefId, durationMs });

    return brief;

  } catch (error) {
    logger.error('Morning Brief generation failed:', error);
    EventBus.emit('brief:generation:error', { briefId, error: error.message });
    throw error;
  }
}

// ─── AI Synthesis ──────────────────────────────────────────────────────────────

async function synthesiseNarrativeProse({ themeClassification, continuityAssessment, expectationsResult, context, narrativeRisks }) {
  const systemPrompt = buildSynthesisSystemPrompt();
  const userPrompt   = buildSynthesisUserPrompt({
    themeClassification,
    continuityAssessment,
    expectationsResult,
    context,
    narrativeRisks,
  });

  const response = await callAI({
    model:          NARRATIVE_CONFIG.ai.synthesisModel,
    systemPrompt,
    userPrompt,
    maxTokens:      NARRATIVE_CONFIG.ai.maxOutputTokens,
    temperature:    NARRATIVE_CONFIG.ai.temperature,
    responseFormat: 'json',
  });

  return response;
}

function buildSynthesisSystemPrompt() {
  return `
You are the narrative synthesis module of AFIE (AI Fundamental Intelligence Engine).

Your role is to WRITE institutional narrative prose from pre-structured intelligence data.

You are a professional macroeconomic research writer at an institutional investment firm.

CRITICAL CONSTRAINTS:
1. You do NOT generate new analysis. All analysis has already been performed.
2. You do NOT introduce new facts. All facts come from the structured data provided.
3. You do NOT generate trading signals, price predictions, or directional recommendations.
4. You WRITE — converting structured intelligence into coherent, professional prose.
5. You maintain the AFIE institutional voice throughout.

VOICE RULES:
- AFIE is the active analyst. Write from AFIE's perspective.
- Use: "AFIE is monitoring...", "AFIE continues to assess...", "Current evidence suggests..."
- Never: "Watch for...", "Traders should...", "Be aware that..."
- Explain mechanisms, not just outcomes.
- Probability language throughout. Never certainty.

WRITING QUALITY:
- Professional, measured, analytical.
- No hype, no sensationalism, no urgency for its own sake.
- Reads like a research desk morning note, not a news alert.
- Flowing prose — not bullet points within prose sections.

OUTPUT FORMAT:
Return a single valid JSON object with these exact fields:
{
  "executiveSummaryHeadline": "Single declarative sentence.",
  "executiveSummaryBody": "Three to five sentence prose overview of the current macro environment.",
  "macroNarrativeBody": "Multi-paragraph prose explaining the dominant macro themes. This is the flagship section — minimum 200 words. Explain the narrative, not individual stories."
}

Return ONLY this JSON object. No markdown. No code fences. No additional text.
`.trim();
}

function buildSynthesisUserPrompt({ themeClassification, continuityAssessment, expectationsResult, context, narrativeRisks }) {
  const { activeStories, breakingCount, totalActiveCount } = context;

  return `
## INTELLIGENCE SUMMARY

Active stories: ${totalActiveCount}
Breaking stories: ${breakingCount}
Sentiment assessment: ${themeClassification.sentimentLabel}
Sentiment reasoning: ${themeClassification.sentimentReasoning}

## DOMINANT THEMES (pre-classified — do not change)

${themeClassification.themes.map(t =>
  `Theme: ${t.theme}\nStrength: ${t.strength}\nDescription: ${t.description}\nContributing stories: ${t.storyIds.length}`
).join('\n\n')}

## STORY CONTINUITY

Continuing stories: ${continuityAssessment.continuingStories.length}
New stories: ${continuityAssessment.newStories.length}
Resolved stories: ${continuityAssessment.resolvedStories.length}

${continuityAssessment.continuingStories.slice(0, 5).map(s =>
  `Story: "${s.title}" — Trajectory: ${s.trajectory} — ${s.continuityNote}`
).join('\n')}

## MARKET EXPECTATIONS (inferred from V1 reasoning)

${expectationsResult.summaryBody}

${expectationsResult.expectationItems.slice(0, 5).map(e =>
  `[${e.certainty}] ${e.expectation}`
).join('\n')}

## NARRATIVE RISKS

${narrativeRisks.slice(0, 4).map(r =>
  `Risk: ${r.risk}\nMechanism: ${r.mechanism}\nLikelihood: ${r.likelihood}`
).join('\n\n')}

## YOUR TASK

Using ONLY the intelligence above, write the three prose sections requested in the system prompt.

The executiveSummaryHeadline must capture the dominant macro condition in one sentence.
The executiveSummaryBody must expand it in three to five sentences.
The macroNarrativeBody must explain the current market environment as a coherent, flowing narrative — not a list.

Remember: AFIE is the analytical voice. Use AFIE-voice throughout.
Do not introduce any facts, stories, or analysis not present in the structured data above.
`.trim();
}

// ─── Assembly ─────────────────────────────────────────────────────────────────

function assembleBrief({ briefId, context, themeClassification, continuityAssessment,
    expectationsResult, assetSummaries, narrativeRisks, monitoringItems,
    aiProse, watchlist, priorBrief, startTime }) {

  const durationMs = Date.now() - startTime;

  return {
    id:              briefId,
    schemaVersion:   '1.0',
    briefType:       'morning',
    generatedAt:     new Date().toISOString(),
    dataAsOf:        context.dataAsOf,
    storiesAnalysed: context.activeStories.length,

    sentimentLabel:    themeClassification.sentimentLabel,
    sentimentReasoning: themeClassification.sentimentReasoning,

    executiveSummary: {
      headline:   aiProse?.executiveSummaryHeadline || 'AFIE Morning Intelligence Brief',
      body:       aiProse?.executiveSummaryBody || themeClassification.sentimentReasoning,
      keyThemes:  themeClassification.themes.slice(0, 5).map(t => t.theme),
    },

    macroNarrative: {
      dominantThemes: themeClassification.themes.map(({ weightScore, ...rest }) => rest),
      narrativeBody:  aiProse?.macroNarrativeBody || themeClassification.themes.map(t => t.description).join(' '),
    },

    storyContinuity: continuityAssessment,

    marketExpectations: {
      body:             expectationsResult.summaryBody,
      expectationItems: expectationsResult.expectationItems,
    },

    assetSummaries,

    afieIsMonitoring: monitoringItems,

    narrativeRisks,

    metadata: {
      engineVersion:          '1.0',
      narrativeVersion:       '2A',
      aiModelUsed:            NARRATIVE_CONFIG.ai.synthesisModel,
      generationDurationMs:   durationMs,
      v1StoriesConsumed:      context.activeStories.length,
      watchlistSymbols:       watchlist,
      priorBriefId:           priorBrief?.id || null,
      isTestOutput:           false,
    },
  };
}

// ─── Monitoring Items ─────────────────────────────────────────────────────────

function buildMonitoringItems(context) {
  const items = [];
  const max = NARRATIVE_CONFIG.brief.maxMonitoringItems;

  for (const story of context.activeStories) {
    for (const wp of (story.pass2?.futureWatchPoints || [])) {
      if (!wp.event) continue;
      items.push({
        item:             wp.event,
        storyId:          story.id,
        affectedAssets:   wp.affectedAssets || [],
        significance:     (story.confidence?.overallScore ?? 50) >= 65 ? 'high' : 'medium',
        expectedTiming:   wp.expectedDate || 'Near-term',
      });
      if (items.length >= max) break;
    }
    if (items.length >= max) break;
  }

  return items;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistBrief(brief) {
  const dir = NARRATIVE_CONFIG.storage.briefStoreDir;
  await mkdir(dir, { recursive: true });

  // Write brief file
  const briefPath = join(dir, `${brief.id}.json`);
  await writeFile(briefPath, JSON.stringify(brief, null, 2), 'utf-8');

  // Update index
  const indexPath = join(dir, '_brief_index.json');
  let index = { latestBriefId: null, briefs: {} };
  try {
    const raw = await readFile(indexPath, 'utf-8');
    index = JSON.parse(raw);
  } catch { /* first run */ }

  index.latestBriefId = brief.id;
  index.briefs[brief.id] = {
    id:          brief.id,
    generatedAt: brief.generatedAt,
    briefType:   brief.briefType,
    sentiment:   brief.sentimentLabel,
    storyCount:  brief.storiesAnalysed,
  };

  await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  logger.info(`Brief persisted: ${briefPath}`);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function buildBriefId() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `brief_${date}_morning`;
}

function buildDryRunProse(themeClassification, context) {
  const theme = themeClassification.themes[0];
  return {
    executiveSummaryHeadline: `[DRY RUN] AFIE Morning Brief — ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`,
    executiveSummaryBody: `[DRY RUN — AI prose skipped] ${themeClassification.sentimentReasoning}`,
    macroNarrativeBody: `[DRY RUN — AI prose skipped] Dominant theme: ${theme?.theme || 'None'}. ${theme?.description || ''}`,
  };
}

async function generateMinimalBrief(briefId, context, watchlist, startTime) {
  const brief = {
    id:             briefId,
    schemaVersion:  '1.0',
    briefType:      'morning',
    generatedAt:    new Date().toISOString(),
    dataAsOf:       new Date().toISOString(),
    storiesAnalysed: 0,
    sentimentLabel: 'awaiting_catalyst',
    sentimentReasoning: 'No active stories are currently available in the intelligence store. AFIE is monitoring for new developments.',
    executiveSummary: {
      headline: 'AFIE has not detected active stories requiring narrative synthesis at this time.',
      body: 'The intelligence store does not contain active stories that meet the minimum confidence threshold for inclusion in the Morning Brief. AFIE continues to monitor incoming news feeds and will generate a narrative synthesis when qualifying stories are available.',
      keyThemes: [],
    },
    macroNarrative:     { dominantThemes: [], narrativeBody: 'No active stories.' },
    storyContinuity:    { continuingStories: [], newStories: [], resolvedStories: [] },
    marketExpectations: { body: 'No active stories.', expectationItems: [] },
    assetSummaries:     [],
    afieIsMonitoring:   [],
    narrativeRisks:     [],
    metadata: {
      engineVersion: '1.0', narrativeVersion: '2A',
      aiModelUsed: 'none', generationDurationMs: Date.now() - startTime,
      v1StoriesConsumed: 0, watchlistSymbols: watchlist, isTestOutput: false,
    },
  };
  await persistBrief(brief);
  return brief;
}
