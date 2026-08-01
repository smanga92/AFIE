/**
 * AFIE NarrativeClassifier (V2A)
 *
 * Derives the dominant macro themes and the overall sentiment label
 * from the active V1 AnalysedStory objects in the BriefingContext.
 *
 * This module does NOT call AI. It is pure data processing.
 * It groups stories by macro theme, weights them by confidence and impact strength,
 * and produces a structured ThemeSet for the MorningBriefGenerator to use.
 *
 * Theme classification is keyword-driven and category-driven.
 * The resulting structure is passed to the AI synthesis step, which writes
 * the narrative prose. This module only structures — it does not write.
 */

import { NARRATIVE_CONFIG } from '../config/narrative.config.js';
import { Logger }           from '../../core/Logger.js';

const logger = new Logger('NarrativeClassifier');

/**
 * @typedef {Object} MacroTheme
 * @property {string}   theme       - Theme label
 * @property {string}   description - What this theme represents
 * @property {string[]} storyIds    - V1 story IDs contributing to this theme
 * @property {string}   strength    - 'dominant' | 'significant' | 'emerging' | 'fading'
 * @property {number}   weightScore - Internal score used for ranking
 *
 * @typedef {Object} ThemeClassification
 * @property {MacroTheme[]} themes
 * @property {string}       sentimentLabel
 * @property {string}       sentimentReasoning
 */

// Macro theme definitions — each theme has a label, description, and
// detection signals (fact categories and keywords from story content)
const THEME_DEFINITIONS = [
  {
    id: 'monetary_policy',
    label: 'Monetary Policy & Interest Rate Expectations',
    description: 'Central bank policy decisions, rate trajectory signals, and the evolving expectations market participants hold about future rate paths.',
    factCategories: ['interest_rate_decision', 'central_bank_speech'],
    keywords: ['federal reserve', 'ecb', 'boj', 'boe', 'rate', 'inflation', 'monetary', 'fomc', 'quantitative'],
  },
  {
    id: 'geopolitical_risk',
    label: 'Geopolitical Risk & International Security',
    description: 'Active military, diplomatic, or sanctions-related developments with the capacity to alter global trade flows, energy supply, or financial market risk appetite.',
    factCategories: ['geopolitical_event', 'military_event', 'sanctions', 'peace_negotiation'],
    keywords: ['war', 'conflict', 'nato', 'ceasefire', 'sanction', 'russia', 'china', 'middle east', 'israel', 'ukraine'],
  },
  {
    id: 'trade_policy',
    label: 'Trade Policy & Tariff Dynamics',
    description: 'Government trade decisions, tariff announcements, and negotiations that affect global supply chains, corporate earnings, and currency dynamics.',
    factCategories: ['tariff_announcement', 'trade_agreement', 'government_policy'],
    keywords: ['tariff', 'trade war', 'export control', 'import', 'wto', 'sanctions', 'commerce department'],
  },
  {
    id: 'technology_sector',
    label: 'Technology Sector & Regulatory Environment',
    description: 'Developments in technology regulation, semiconductor policy, AI governance, and corporate announcements from major technology companies.',
    factCategories: ['regulation', 'corporate_announcement', 'etf_approval'],
    keywords: ['semiconductor', 'chip', 'ai', 'tech', 'nvidia', 'microsoft', 'google', 'apple', 'antitrust', 'data privacy', 'export control'],
  },
  {
    id: 'inflation_growth',
    label: 'Inflation & Economic Growth',
    description: 'The evolving picture of price stability and economic expansion, including data releases and their implications for the policy outlook.',
    factCategories: ['inflation_data', 'gdp_data', 'employment_data', 'economic_release'],
    keywords: ['inflation', 'cpi', 'pce', 'gdp', 'employment', 'payroll', 'unemployment', 'recession', 'growth'],
  },
  {
    id: 'energy_commodities',
    label: 'Energy Markets & Commodity Supply',
    description: 'Oil, natural gas, and commodity supply developments including OPEC decisions, infrastructure events, and weather-related disruptions.',
    factCategories: ['commodity_supply', 'energy_event'],
    keywords: ['oil', 'crude', 'opec', 'gas', 'lng', 'energy', 'pipeline', 'refinery', 'gold', 'silver', 'copper', 'iron ore'],
  },
  {
    id: 'crypto_digital_assets',
    label: 'Digital Assets & Crypto Regulation',
    description: 'Regulatory developments, ETF flows, and institutional adoption trends affecting cryptocurrency markets.',
    factCategories: ['etf_approval', 'regulation'],
    keywords: ['bitcoin', 'ethereum', 'crypto', 'btc', 'eth', 'digital asset', 'blockchain', 'sec crypto', 'etf'],
  },
  {
    id: 'fiscal_policy',
    label: 'Fiscal Policy & Government Finance',
    description: 'Government spending decisions, debt dynamics, and fiscal credibility developments that affect sovereign bond markets and currency valuations.',
    factCategories: ['government_policy'],
    keywords: ['budget', 'debt ceiling', 'deficit', 'fiscal', 'spending', 'treasury', 'bond yield', 'austerity'],
  },
];

/**
 * Classifies the BriefingContext into macro themes and determines the
 * overall sentiment label.
 *
 * @param {import('../interfaces/StoryReader.js').BriefingContext} context
 * @returns {ThemeClassification}
 */
export function classifyNarratives(context) {
  const { activeStories } = context;

  if (!activeStories.length) {
    logger.info('No active stories — returning neutral classification.');
    return {
      themes: [],
      sentimentLabel: 'awaiting_catalyst',
      sentimentReasoning: 'AFIE has not detected a sufficient volume of active stories to characterise the current macro environment. The intelligence engine is monitoring for new developments.',
    };
  }

  // Score each theme against active stories
  const themeScores = THEME_DEFINITIONS.map(def => ({
    def,
    stories: [],
    weightScore: 0,
  }));

  for (const story of activeStories) {
    const storyText = buildStorySearchText(story);
    const confidence = story.confidence?.overallScore ?? 50;
    const statusMultiplier = { breaking: 1.5, developing: 1.2, confirmed: 1.0, continuation: 0.9 }[story.status] ?? 0.8;

    for (const themeScore of themeScores) {
      const relevance = computeThemeRelevance(story, storyText, themeScore.def);
      if (relevance > 0) {
        themeScore.stories.push(story.id);
        themeScore.weightScore += relevance * (confidence / 100) * statusMultiplier;
      }
    }
  }

  // Sort by weight score, filter to themes with at least one story
  const scored = themeScores
    .filter(t => t.stories.length > 0)
    .sort((a, b) => b.weightScore - a.weightScore);

  // Assign strength labels
  const maxScore = scored[0]?.weightScore ?? 1;
  const themes = scored.map(t => ({
    theme:       t.def.label,
    description: t.def.description,
    storyIds:    [...new Set(t.stories)],
    strength:    assignStrength(t.weightScore, maxScore),
    weightScore: Math.round(t.weightScore * 100) / 100,
  }));

  // Sentiment classification
  const { sentimentLabel, sentimentReasoning } = deriveSentiment(context, themes);

  logger.info(`Classified ${themes.length} themes. Dominant: "${themes[0]?.theme}". Sentiment: ${sentimentLabel}`);

  return { themes, sentimentLabel, sentimentReasoning };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStorySearchText(story) {
  return [
    story.title || '',
    story.executiveSummary || '',
    story.pass2?.detailedAnalysis?.whatHappened || '',
    story.pass2?.detailedAnalysis?.whyItMatters || '',
    (story.pass1?.facts || []).map(f => f.factText).join(' '),
  ].join(' ').toLowerCase();
}

function computeThemeRelevance(story, storyText, def) {
  let score = 0;

  // Category match — strongest signal
  const storyCategories = new Set((story.pass1?.facts || []).map(f => f.category));
  for (const cat of def.factCategories) {
    if (storyCategories.has(cat)) score += 2;
  }

  // Keyword match
  for (const kw of def.keywords) {
    if (storyText.includes(kw)) score += 1;
  }

  return score;
}

function assignStrength(score, maxScore) {
  const ratio = score / maxScore;
  if (ratio >= 0.8) return 'dominant';
  if (ratio >= 0.5) return 'significant';
  if (ratio >= 0.25) return 'emerging';
  return 'fading';
}

function deriveSentiment(context, themes) {
  const { activeStories, breakingCount } = context;
  const { riskOnThreshold, riskOffThreshold, highUncertaintyMinContradictions } = NARRATIVE_CONFIG.sentiment;

  // Count directional signals across all asset impacts
  let bullishSignals = 0;
  let bearishSignals = 0;
  let contradictionCount = 0;

  for (const story of activeStories) {
    for (const asset of (story.affectedAssets || [])) {
      if (asset.possibleDirection === 'potentially_bullish') bullishSignals++;
      if (asset.possibleDirection === 'potentially_bearish') bearishSignals++;
    }
    contradictionCount += (story.pass2?.contradictions || []).length;
  }

  const total = bullishSignals + bearishSignals;
  const bullRatio = total > 0 ? bullishSignals / total : 0.5;

  // High uncertainty check
  if (contradictionCount >= highUncertaintyMinContradictions && breakingCount >= 1) {
    return {
      sentimentLabel: 'high_uncertainty',
      sentimentReasoning: `AFIE has identified ${contradictionCount} analytical contradictions across active stories alongside ${breakingCount} breaking development${breakingCount > 1 ? 's' : ''}. Current evidence does not support a clear directional assessment.`,
    };
  }

  // Breaking stories present but uncertain direction
  if (breakingCount >= 2) {
    return {
      sentimentLabel: 'high_uncertainty',
      sentimentReasoning: `AFIE is currently tracking ${breakingCount} breaking stories. The volume of unresolved developments makes a stable sentiment characterisation premature at this stage.`,
    };
  }

  // Policy-dependent environment
  const hasPolicyTheme = themes.some(t => t.theme.includes('Monetary') && t.strength === 'dominant');
  const hasAwaitingStory = activeStories.some(s => s.status === 'awaiting_decision');
  if (hasPolicyTheme && hasAwaitingStory) {
    return {
      sentimentLabel: 'policy_dependent',
      sentimentReasoning: `The dominant narrative is centred on monetary policy expectations, with at least one story in an awaiting-decision state. Market conditions are currently contingent on forthcoming central bank communications or data releases rather than settled fundamental developments.`,
    };
  }

  // Geopolitical risk dominant → defensive
  const hasGeopolitical = themes.some(t => t.theme.includes('Geopolitical') && ['dominant','significant'].includes(t.strength));
  if (hasGeopolitical && bullRatio < 0.4) {
    return {
      sentimentLabel: 'cautiously_defensive',
      sentimentReasoning: `AFIE has identified elevated geopolitical risk as a significant theme across current active stories. The balance of asset impact signals suggests a cautiously defensive market posture, though the intelligence engine notes that conditions remain fluid.`,
    };
  }

  // Standard directional assessment
  if (bullRatio >= riskOnThreshold) {
    return {
      sentimentLabel: 'risk_on',
      sentimentReasoning: `The balance of impact signals across active stories indicates a predominantly risk-on orientation. ${bullishSignals} bullish signals versus ${bearishSignals} bearish signals across watchlist asset assessments.`,
    };
  }
  if (bullRatio <= riskOffThreshold) {
    return {
      sentimentLabel: 'risk_off',
      sentimentReasoning: `The balance of impact signals across active stories reflects a predominantly risk-off orientation. ${bearishSignals} bearish signals versus ${bullishSignals} bullish signals across watchlist asset assessments.`,
    };
  }
  if (bullRatio > 0.45 && bullRatio < 0.55) {
    return {
      sentimentLabel: 'mixed',
      sentimentReasoning: `Current story evidence presents a balanced mix of bullish and bearish signals across watchlist assets. AFIE assesses this as a mixed macro environment without a dominant directional bias at this stage.`,
    };
  }
  if (bullRatio >= 0.55) {
    return {
      sentimentLabel: 'cautiously_constructive',
      sentimentReasoning: `Story evidence tilts slightly constructive, though AFIE notes sufficient uncertainty across active developments to characterise conditions as cautiously rather than clearly constructive.`,
    };
  }

  return {
    sentimentLabel: 'mixed',
    sentimentReasoning: 'Current story evidence does not present a clear directional bias. AFIE is continuing to monitor developing stories for clearer sentiment signals.',
  };
}
