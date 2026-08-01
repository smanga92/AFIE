/**
 * AFIE ContinuityAnalyser (V2A)
 *
 * Detects story evolution across sessions. This is the module that gives
 * the Morning Brief its sense of institutional memory.
 *
 * It compares the current BriefingContext against the prior brief's story state
 * and produces a structured continuity assessment:
 *
 *   - Which stories are continuing from previous sessions
 *   - What trajectory each continuing story is on
 *   - Which stories are newly detected
 *   - Which stories have resolved since the last brief
 *
 * This module does NOT call AI. It is pure data comparison.
 *
 * The output is passed to MorningBriefGenerator, which passes it to the
 * AI synthesis step to be written into institutional prose.
 */

import { NARRATIVE_CONFIG } from '../config/narrative.config.js';
import { Logger }           from '../../core/Logger.js';

const logger = new Logger('ContinuityAnalyser');

const {
  minVersionsForContinuity,
  newStoryWindowHours,
  trajectoryStrengthThreshold,
  trajectoryWeakenThreshold,
} = NARRATIVE_CONFIG.continuity;

/**
 * @typedef {Object} ContinuityAssessment
 * @property {ContinuingStory[]} continuingStories
 * @property {NewStory[]}        newStories
 * @property {ResolvedStory[]}   resolvedStories
 *
 * @typedef {Object} ContinuingStory
 * @property {string}   storyId
 * @property {string}   title
 * @property {string}   continuityNote   - AFIE-voice narrative of evolution
 * @property {string}   trajectory       - strengthening|stable|weakening|escalating|de_escalating|unresolved
 * @property {number}   versionCount
 * @property {number}   daysSinceFirst
 *
 * @typedef {Object} NewStory
 * @property {string} storyId
 * @property {string} title
 * @property {string} significance
 *
 * @typedef {Object} ResolvedStory
 * @property {string} storyId
 * @property {string} title
 * @property {string} resolutionNote
 */

/**
 * Analyses story continuity between the prior brief and the current context.
 *
 * @param {import('../interfaces/StoryReader.js').BriefingContext} context
 * @param {Object|null} priorBrief - The prior MorningBrief JSON, if available
 * @returns {ContinuityAssessment}
 */
export function analyseContinuity(context, priorBrief) {
  const { activeStories, recentStories, storyAges } = context;

  const priorStoryIds = new Set(
    priorBrief?.storyContinuity?.continuingStories?.map(s => s.storyId) ?? []
  );
  const priorNewIds = new Set(
    priorBrief?.storyContinuity?.newStories?.map(s => s.storyId) ?? []
  );
  const priorAllKnown = new Set([...priorStoryIds, ...priorNewIds]);

  const continuingStories = [];
  const newStories        = [];

  for (const story of activeStories) {
    const age = storyAges.get(story.id);
    const isKnownFromPrior = priorAllKnown.has(story.id);

    if (isKnownFromPrior || (age && age.isContinuing)) {
      continuingStories.push(buildContinuingStory(story, age, priorBrief));
    } else if (age?.isNew || !isKnownFromPrior) {
      newStories.push(buildNewStory(story, context));
    }
  }

  // Find resolved stories: stories that were in the prior brief but are now resolved/cancelled
  const resolvedStories = [];
  for (const story of recentStories) {
    if (
      priorAllKnown.has(story.id) &&
      ['resolved', 'cancelled'].includes(story.status)
    ) {
      resolvedStories.push(buildResolvedStory(story));
    }
  }

  logger.info(
    `Continuity analysis: ${continuingStories.length} continuing, ` +
    `${newStories.length} new, ${resolvedStories.length} resolved.`
  );

  return { continuingStories, newStories, resolvedStories };
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildContinuingStory(story, age, priorBrief) {
  const trajectory = computeTrajectory(story, priorBrief);
  const continuityNote = buildContinuityNote(story, age, trajectory, priorBrief);

  return {
    storyId:        story.id,
    title:          story.title,
    continuityNote,
    trajectory,
    versionCount:   story.versionNumber ?? 1,
    daysSinceFirst: age?.daysSinceFirst ?? 0,
  };
}

function buildNewStory(story, context) {
  const topAssets = (story.affectedAssets || [])
    .slice(0, 3)
    .map(a => a.symbol)
    .join(', ');

  const significance = topAssets
    ? `AFIE has detected a new story affecting ${topAssets}. ${story.executiveSummary || ''}`
    : `AFIE has detected a new story. ${story.executiveSummary || ''}`;

  return {
    storyId:      story.id,
    title:        story.title,
    significance: significance.slice(0, 400),
  };
}

function buildResolvedStory(story) {
  const note = story.status === 'cancelled'
    ? `This story has been assessed as cancelled. AFIE has closed active monitoring.`
    : `This story has reached a resolved state. AFIE has updated the record accordingly and continues to monitor for any reversal indicators.`;

  return {
    storyId:        story.id,
    title:          story.title,
    resolutionNote: note,
  };
}

/**
 * Computes the trajectory of a continuing story by comparing
 * current confidence to the prior brief's record of that story.
 */
function computeTrajectory(story, priorBrief) {
  if (!priorBrief) return 'unresolved';

  // Find this story in the prior brief's story summaries
  const priorEntry = [
    ...(priorBrief?.storyContinuity?.continuingStories ?? []),
    ...(priorBrief?.storyContinuity?.newStories ?? []),
  ].find(s => s.storyId === story.id);

  // Compare to prior version's confidence if we have history
  const history = story.versionHistory || [];
  if (history.length < 2) return 'unresolved';

  const currentConf = story.confidence?.overallScore ?? 50;
  const previousConf = history[history.length - 2]?.confidenceAtVersion ?? currentConf;
  const delta = currentConf - previousConf;

  // Status escalation
  const priorStatus = history[history.length - 2]?.statusAtVersion;
  if (story.status === 'breaking' && priorStatus !== 'breaking') return 'escalating';
  if (story.status === 'resolved' && priorStatus !== 'resolved') return 'de_escalating';
  if (story.status === 'confirmed' && priorStatus === 'developing') return 'de_escalating';

  if (delta >= trajectoryStrengthThreshold) return 'strengthening';
  if (delta <= trajectoryWeakenThreshold)   return 'weakening';
  return 'stable';
}

/**
 * Builds the AFIE-voice continuity narrative note for a story.
 */
function buildContinuityNote(story, age, trajectory, priorBrief) {
  const days = age?.daysSinceFirst ?? 0;
  const versions = story.versionNumber ?? 1;
  const daysStr = days < 1 ? 'earlier today' : days === 1 ? 'yesterday' : `${Math.round(days)} days ago`;

  const trajectoryPhrases = {
    strengthening: `AFIE has observed increasing confirmation of this narrative since initial detection ${daysStr}. The story has strengthened across ${versions} updates, with source coverage expanding and confidence improving.`,
    stable:        `This story remains active and stable since first detected ${daysStr}. AFIE has tracked ${versions} update${versions > 1 ? 's' : ''} without a material change in the analytical assessment.`,
    weakening:     `AFIE has observed a reduction in source confirmation for this story since its detection ${daysStr}. While the story remains active, confidence has declined and the analytical assessment has been revised accordingly.`,
    escalating:    `This story has escalated to breaking status since the prior session. AFIE is actively assessing the new developments and their implications for affected assets.`,
    de_escalating: `This story has de-escalated since the prior session. The situation appears to be moving toward resolution, though AFIE continues to monitor for reversal indicators.`,
    unresolved:    `This story remains unresolved since detection ${daysStr}. AFIE has tracked ${versions} update${versions > 1 ? 's' : ''} and continues to monitor for new developments that would alter the current analytical assessment.`,
  };

  return trajectoryPhrases[trajectory] || trajectoryPhrases.unresolved;
}
