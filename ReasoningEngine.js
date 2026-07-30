/**
 * AFIE ReasoningEngine
 *
 * Pass 2 — Core Module
 *
 * This is where AFIE's analytical intelligence lives.
 *
 * The ReasoningEngine receives a complete context package from Pass 2 orchestration
 * and produces a full AnalysedStory object.
 *
 * It behaves as a professional macroeconomic research analyst.
 * It does NOT invent facts.
 * It reasons ONLY from the verified facts provided by Pass 1.
 * It NEVER generates trading signals or price predictions.
 * It ALWAYS expresses market implications as probabilities, not certainties.
 * It ALWAYS provides reasoning for every conclusion.
 * It ALWAYS identifies contradictions between analyst perspectives.
 *
 * The AI system prompt is carefully constructed to enforce these constraints.
 */

import { PIPELINE_CONFIG } from '../config/pipeline.config.js';
import { ASSET_REGISTRY }  from '../config/assets.config.js';
import { callAI }          from '../utils/AIClient.js';
import { Logger }          from '../core/Logger.js';

const logger = new Logger('ReasoningEngine');

/**
 * @typedef {import('../pass1/FactExtractor.js').FactualKnowledgeObject}  FKO
 * @typedef {import('../output/schema/types.js').AnalysedStory}            AnalysedStory
 * @typedef {import('../memory/StoryMatcher.js').MatchResult}              MatchResult
 *
 * @typedef {Object} ReasoningContext
 * @property {FKO}              fko
 * @property {string[]}         watchlist          - Active asset symbols
 * @property {MatchResult}      matchResult        - From StoryMatcher
 * @property {AnalysedStory|null} existingStory    - Previous version if updating
 * @property {Array}            contradictions     - From ContradictionScanner
 * @property {Object}           confidence         - From ConfidenceScorer
 */

/**
 * Runs the full Pass 2 reasoning pipeline for one FKO.
 *
 * @param {ReasoningContext} ctx
 * @returns {Promise<AnalysedStory>}
 */
export async function runReasoning(ctx) {
  const { fko, watchlist, existingStory, contradictions, confidence } = ctx;

  logger.info(`Running reasoning for: "${fko.representativeHeadline}"`);

  // Build the reasoning prompt
  const systemPrompt = buildSystemPrompt();
  const userPrompt   = buildUserPrompt(ctx);

  // Call the AI reasoning model
  const rawResponse = await callAI({
    model:       PIPELINE_CONFIG.reasoning.primaryModel,
    systemPrompt,
    userPrompt,
    maxTokens:   PIPELINE_CONFIG.reasoning.maxOutputTokens,
    temperature: PIPELINE_CONFIG.reasoning.temperature,
    responseFormat: 'json',
  });

  // Parse and validate the AI response
  const reasoningOutput = parseReasoningResponse(rawResponse, ctx);

  // Assemble the full AnalysedStory output object
  return assembleStory(reasoningOutput, ctx);
}

// ─── Prompt Construction ──────────────────────────────────────────────────────

function buildSystemPrompt() {
  return `
You are the market reasoning module of AFIE (AI Fundamental Intelligence Engine).

You are a professional macroeconomic research analyst at an institutional investment firm.

Your role is to interpret verified financial news facts and explain their possible market implications.

FUNDAMENTAL RULES — never break these:

1. You do NOT invent facts. Every statement of fact must trace to the provided verified facts.
2. You do NOT generate trading signals. Never say "buy", "sell", "long", "short", or "exit".
3. You do NOT predict prices or price targets.
4. You do NOT state future market direction as certainty. Always use probability language.
5. You DO explain the MECHANISM by which markets might react — not just the directional outcome.
   Poor: "This may be bullish for Gold."
   Correct: "Historically, lower real yields have tended to support Gold because the opportunity cost
   of holding a non-yielding asset decreases when interest income alternatives become less attractive."
6. You DO identify contradictions between different analyst or source perspectives.
7. You DO express uncertainty clearly when uncertainty exists.
8. You DO explain your reasoning in full. Never produce unexplained conclusions.

LANGUAGE RULES — probability, not certainty:
- Use: "may", "could", "historically has tended to", "might", "has often been associated with",
  "current evidence suggests", "AFIE is monitoring whether", "at this stage the evidence indicates"
- Avoid: "will", "guaranteed", "definitely", "certainly", "must go", "will rally", "will fall"

VOICE AND TONE RULES — AFIE speaks as an institutional analyst, not a trading assistant:
- AFIE is the active observer. Write from AFIE's perspective, not as instructions to the user.
- Correct:   "AFIE is monitoring whether the retaliatory measures escalate further."
- Correct:   "AFIE continues to assess the impact of this announcement on rate expectations."
- Correct:   "Current evidence suggests the market has partially priced in this outcome."
- Correct:   "At this stage, AFIE has not yet observed sufficient evidence to conclude that..."
- Correct:   "The intelligence engine is assessing whether this development alters the trajectory..."
- Incorrect: "Watch for further developments."
- Incorrect: "Traders should watch this space."
- Incorrect: "Be aware that this may affect..."
- Incorrect: "Watch this story closely."
This applies everywhere: reasoning text, watch points, continuation notes, and caveats.

OUTPUT FORMAT:
Return a single valid JSON object exactly matching the schema provided in the user prompt.
Do not include markdown, code fences, or any text outside the JSON object.
`.trim();
}

/**
 * Builds the user prompt with full context.
 */
function buildUserPrompt(ctx) {
  const { fko, watchlist, existingStory, contradictions } = ctx;

  // Build asset context for relevant assets only
  const relevantAssets = watchlist
    .filter(sym => ASSET_REGISTRY[sym])
    .map(sym => {
      const asset = ASSET_REGISTRY[sym];
      return {
        symbol:    sym,
        name:      asset.name,
        category:  asset.category,
        macroNote: asset.macroContext,
        sensitivity: asset.sensitivity,
      };
    });

  const previousContext = existingStory ? buildPreviousContext(existingStory) : null;

  return `
## VERIFIED FACTS FROM PASS 1

These are the only facts you may reason from. Do not introduce any facts not listed here.

${JSON.stringify(fko.facts, null, 2)}

---

## STORY INFORMATION

Headline: ${fko.representativeHeadline}
Articles: ${fko.articleCount} articles from ${fko.publishersSeen?.join(', ')}
Earliest article: ${fko.earliestPublished}
Latest article: ${fko.latestPublished}
Is new story: ${!existingStory}

---

## USER WATCHLIST (assets to analyse)

${JSON.stringify(relevantAssets, null, 2)}

---

${previousContext ? `## PREVIOUS STORY CONTEXT\n\n${previousContext}\n\n---\n\n` : ''}

${contradictions.length > 0 ? `## KNOWN CONTRADICTIONS\n\n${JSON.stringify(contradictions, null, 2)}\n\n---\n\n` : ''}

## YOUR TASK

Analyse the verified facts above and produce a complete reasoning output in this exact JSON structure:

{
  "storyTitle": "A clear, factual headline for this story",
  "executiveSummary": "2-3 sentences. What happened, who announced it, current status. No market opinion.",
  "whatChangedSinceLastUpdate": "Only present if this is an update. What is new vs the previous version.",
  "detailedAnalysis": {
    "whatHappened": "Detailed narrative of the event based on verified facts only.",
    "whyItMatters": "Why markets or the broader economy are paying attention to this.",
    "whoAnnounced": "The entity responsible for the announcement or event.",
    "isOfficialAnnouncement": true/false,
    "isProposalOnly": true/false,
    "wasMarketExpecting": true/false,
    "didMarketSurprise": true/false,
    "isProbablyPricedIn": true/false,
    "pricedInReasoning": "Explanation of why this is or is not likely priced in.",
    "isLikelyToContinue": true/false,
    "continuationReasoning": "Why this story is or is not likely to develop further."
  },
  "storyStatus": "breaking|developing|proposal|negotiation|awaiting_decision|confirmed|implemented|continuation|resolved|cancelled|unknown",
  "statusReason": "One sentence explaining the status.",
  "affectedAssets": [
    {
      "symbol": "ASSET_SYMBOL",
      "impactStrength": "high|medium|low",
      "possibleDirection": "potentially_bullish|potentially_bearish|mixed|minimal",
      "directionCaveats": "Important qualifications on this direction. Use AFIE-voice: 'AFIE notes that conflicting factors...' not 'Be aware that...'",
      "reasoning": "Explain the MECHANISM by which this asset may be affected — not just the directional label. Example: 'Historically, higher tariff expectations have tended to compress global risk appetite. This compression has often reduced demand for risk-sensitive assets such as equities and commodity currencies, while increasing flows into traditional safe havens. AFIE is assessing whether the scale of the current announcement is sufficient to trigger this pattern.'",
      "isImpactImmediate": true/false,
      "timingNote": "When and how this impact might manifest. Use AFIE-voice: 'AFIE is monitoring whether...' not 'Watch for...'",
      "conditionsToStrengthenImpact": "What developments would intensify this impact. AFIE-voice: 'AFIE would expect impact to intensify if...'",
      "conditionsToWeakenImpact": "What developments would reduce or reverse this impact. AFIE-voice: 'Current evidence suggests impact may be limited if...'",
      "confidence": 0-100,
      "supportingFactIds": ["fact_id_1", "fact_id_2"]
    }
  ],
  "contradictionsDetected": [
    {
      "description": "Brief description of the disagreement.",
      "perspectiveA": {
        "position": "First perspective",
        "sourceNames": ["Source A"]
      },
      "perspectiveB": {
        "position": "Second perspective",
        "sourceNames": ["Source B"]
      },
      "afieNote": "AFIE has identified a disagreement between reputable sources on this point. Both perspectives are presented. AFIE is continuing to monitor how this divergence resolves."
    }
  ],
  "futureWatchPoints": [
    {
      "event": "The specific development AFIE is monitoring — written as what AFIE is tracking, not as an instruction to the user. Example: 'AFIE is monitoring the August CPI release for evidence that the disinflationary trend is sustained.'",
      "expectedDate": "When (approximate)",
      "significance": "Why this development matters to the story's trajectory. AFIE-voice: 'This release will be assessed by AFIE for...' not 'Watch this because...'",
      "affectedAssets": ["SYMBOL"]
    }
  ],
  "newTimelineEntry": {
    "eventText": "Brief description of what this update adds to the story.",
    "type": "initial|update|confirmation|escalation|de_escalation|resolution|reversal|data_release|speech|policy_change"
  }
}

RULES FOR affectedAssets:
- Only include assets that are genuinely connected to this story.
- Exclude assets with no reasonable connection, even if they are on the watchlist.
- Use the macroContext and sensitivity data provided for each asset to reason correctly.
- Always phrase directional assessments as possibilities, never certainties.
- The reasoning field MUST explain the macroeconomic mechanism — not just name the direction.
  Poor:    "This could be bullish for Gold."
  Correct: "Historically, a dovish shift in Fed expectations has tended to compress real yields.
            When real yields decline, the opportunity cost of holding non-yielding assets such as
            Gold decreases, which has historically supported Gold demand. AFIE is assessing whether
            the current shift in rate expectations is material enough to sustain this dynamic."
- Always link supportingFactIds to actual fact IDs from the verified facts section.
- Confidence should reflect how directly this story impacts the asset (not AI confidence).
- conditionsToStrengthenImpact and conditionsToWeakenImpact must use AFIE-voice, not user-instructions.

RULES FOR futureWatchPoints:
- These represent what AFIE is monitoring — not instructions to the user.
- Every event field must be written from AFIE's perspective as the active analyst.
- Correct:   "AFIE is monitoring the September FOMC meeting for any revision to the rate path."
- Incorrect: "Watch the September FOMC meeting."
- Incorrect: "Traders should pay attention to..."

RULES FOR contradictionsDetected:
- Report genuine disagreements between reputable sources.
- Do not force consensus. If analysts disagree, say so clearly.
- Present both perspectives completely and fairly.
- The afieNote must confirm AFIE is continuing to monitor — not ask the user to decide.
`.trim();
}

/**
 * Builds a compact previous-context block for story updates.
 */
function buildPreviousContext(existingStory) {
  return `
This story was previously analysed. Here is the previous context:

Previous title: ${existingStory.title}
Previous status: ${existingStory.status}
Previous summary: ${existingStory.executiveSummary}
Previous version: ${existingStory.versionNumber}
Previous affected assets: ${existingStory.affectedAssets?.map(a => a.symbol).join(', ')}

Previous timeline:
${(existingStory.timeline || []).map(t => `- ${t.date || t.entryId}: ${t.eventText}`).join('\n')}

When generating your analysis, compare to the previous context and identify what has changed.
`.trim();
}

// ─── Response Assembly ────────────────────────────────────────────────────────

/**
 * Parses the raw AI JSON response into a validated reasoning output.
 */
function parseReasoningResponse(rawResponse, ctx) {
  try {
    const data = typeof rawResponse === 'string'
      ? JSON.parse(rawResponse)
      : rawResponse;
    return data;
  } catch (err) {
    logger.error('Failed to parse reasoning response JSON:', err.message);
    // Return a minimal safe fallback
    return buildFallbackOutput(ctx);
  }
}

/**
 * Assembles the complete AnalysedStory from reasoning output + metadata.
 */
function assembleStory(output, ctx) {
  const { fko, existingStory, confidence, contradictions } = ctx;
  const isNew = !existingStory;
  const now   = new Date().toISOString();
  const versionNumber = isNew ? 1 : (existingStory.versionNumber + 1);

  // Build story ID (stable across versions)
  const storyId = isNew
    ? `story_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    : existingStory.id;

  const slug = isNew
    ? slugify(output.storyTitle || fko.representativeHeadline)
    : existingStory.slug;

  // Append new timeline entry
  const existingTimeline = existingStory?.timeline || [];
  const newEntry = {
    entryId:         `tl_${storyId}_v${versionNumber}`,
    date:            now,
    eventText:       output.newTimelineEntry?.eventText || output.executiveSummary,
    type:            output.newTimelineEntry?.type || (isNew ? 'initial' : 'update'),
    sourceArticleIds: fko.allArticleIds || [],
    isNew:           true,
  };

  // Mark all previous timeline entries as not new
  const timeline = [
    ...existingTimeline.map(t => ({ ...t, isNew: false })),
    newEntry,
  ];

  // Build version history entry
  const versionHistoryEntry = {
    versionNumber,
    updatedAt:          now,
    summaryAtVersion:   output.executiveSummary,
    statusAtVersion:    output.storyStatus,
    confidenceAtVersion: confidence.overallScore,
    triggerArticleCount: fko.articleCount,
    whatChanged:        output.whatChangedSinceLastUpdate || (isNew ? 'Initial story creation.' : ''),
  };

  const versionHistory = [
    ...(existingStory?.versionHistory || []),
    versionHistoryEntry,
  ];

  return {
    id:                         storyId,
    slug,
    schemaVersion:              '1.0',
    title:                      output.storyTitle || fko.representativeHeadline,
    status:                     output.storyStatus || 'unknown',
    statusReason:               output.statusReason || '',
    createdAt:                  existingStory?.createdAt || now,
    updatedAt:                  now,
    versionNumber,
    isFirstVersion:             isNew,
    executiveSummary:           output.executiveSummary || '',
    whatChangedSinceLastUpdate: isNew ? undefined : output.whatChangedSinceLastUpdate,

    pass1: {
      facts:                  fko.facts || [],
      articleCount:           fko.articleCount || 0,
      publishersSeen:         fko.publishersSeen || [],
      dateRangeOfArticles: {
        earliest: fko.earliestPublished,
        latest:   fko.latestPublished,
      },
    },

    pass2: {
      detailedAnalysis:    output.detailedAnalysis || {},
      contradictions:      (output.contradictionsDetected || contradictions || []).map((c, i) => ({
        id:           `contradiction_${storyId}_${i}`,
        ...c,
      })),
      futureWatchPoints:   output.futureWatchPoints || [],
    },

    affectedAssets:  output.affectedAssets || [],
    confidence,
    timeline,

    sources: (fko.allArticleIds || []).map((id, idx) => ({
      id,
      headline:               fko.representativeHeadline, // replaced by actual in production
      publisher:              fko.publishersSeen?.[idx] || 'Unknown',
      url:                    '#',
      publishedAt:            fko.latestPublished,
      reliabilityTier:        3,
      isAddedInCurrentVersion: true,
    })),

    versionHistory,

    metadata: {
      engineVersion:          '1.0',
      aiModelUsed:            PIPELINE_CONFIG.reasoning.primaryModel,
      totalArticlesProcessed: fko.articleCount || 0,
      isTestOutput:           false,
    },
  };
}

/**
 * Minimal safe fallback if AI response cannot be parsed.
 */
function buildFallbackOutput(ctx) {
  return {
    storyTitle:       ctx.fko.representativeHeadline,
    executiveSummary: 'Analysis could not be completed for this story. Please try again.',
    storyStatus:      'unknown',
    statusReason:     'Reasoning engine encountered an error.',
    detailedAnalysis: {},
    affectedAssets:   [],
    contradictionsDetected: [],
    futureWatchPoints: [],
    newTimelineEntry: { eventText: 'Story detected — analysis pending.', type: 'initial' },
  };
}

/**
 * Converts a title string to a URL-safe slug.
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    + '-' + Date.now().toString(36);
}
