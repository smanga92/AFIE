# AFIE Intelligence Engine

**AI Fundamental Intelligence Engine — v1.0**

A professional market intelligence analyst, not a trading signal generator.

---

## What AFIE Does

AFIE reads hundreds of financial news articles, understands them, connects related stories across days and weeks, extracts verified facts, and reasons about possible market implications — all presented with full source transparency.

**AFIE never:**
- Generates buy, sell, or hold signals
- Predicts prices or price targets
- States future market direction as certainty
- Invents information not present in source articles

**AFIE always:**
- Separates verified facts from AI reasoning
- Cites source articles for every conclusion
- Expresses market implications as probabilities
- Surfaces disagreements between analysts
- Maintains a persistent memory of evolving stories

---

## Architecture Summary

```
NEWS SOURCES → PASS 1 (Fact Collection) → FKOs → PASS 2 (Market Reasoning) → AnalysedStory JSON → UI
```

**Pass 1** behaves as an investigative researcher: collects, cleans, deduplicates, clusters, and extracts verified facts.

**Pass 2** behaves as a macroeconomic research analyst: reasons from those facts to explain possible market implications.

The boundary between Pass 1 and Pass 2 is strictly enforced. Raw articles never enter Pass 2.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
NEWSAPI_KEY=your_newsapi_key          # optional
BLOOMBERG_API_KEY=your_bloomberg_key  # optional
AFIE_STORE_DIR=./data/stories
AFIE_LOG_LEVEL=info
```

### 3. Run once

```bash
node index.js --once
```

### 4. Run continuously (every 15 minutes)

```bash
node index.js
```

### 5. Run tests

```bash
npm test
```

---

## Output

After each pipeline run, the full output is written to:

```
./data/output/latest.json
```

This file contains an array of `AnalysedStory` objects conforming to the JSON schema at:

```
output/schema/AnalysedStory.schema.json
```

The AFIE UI (separate package) reads this file and renders the intelligence feed.

---

## Folder Structure

```
afie-engine/
├── index.js                    Entry point / scheduler
├── core/
│   ├── Pipeline.js             Top-level orchestrator
│   ├── EventBus.js             Internal pub/sub
│   └── Logger.js               Structured logging
├── config/
│   ├── assets.config.js        Asset registry + macro sensitivity maps
│   ├── sources.config.js       News provider definitions
│   └── pipeline.config.js      All tunable parameters
├── adapters/
│   ├── BaseAdapter.js          Abstract base for all adapters
│   ├── RssAdapter.js           RSS/Atom feed adapter
│   └── RestApiAdapter.js       REST API adapter
├── pass1/                      PASS 1: Fact Collection Engine
│   ├── ArticleCollector.js
│   ├── ArticleCleaner.js
│   ├── DuplicateDetector.js
│   ├── StoryClusterer.js
│   ├── FactExtractor.js
│   └── Pass1Runner.js
├── pass2/                      PASS 2: Market Reasoning Engine
│   ├── ReasoningEngine.js
│   ├── ContradictionScanner.js
│   └── Pass2Runner.js
├── memory/
│   ├── StoryStore.js
│   ├── StoryMatcher.js
│   └── TimelineManager.js
├── scoring/
│   ├── ConfidenceScorer.js
│   ├── SourceReliability.js
│   └── StatusMachine.js
├── output/
│   ├── SchemaValidator.js
│   └── schema/
│       └── AnalysedStory.schema.json
├── utils/
│   ├── AIClient.js
│   └── RateLimiter.js
└── tests/
    ├── fixtures/
    │   └── articles.fixtures.js
    ├── pass1/
    │   └── pass1.test.js
    ├── pass2/
    │   └── pass2.test.js
    └── integration/
        └── pipeline.integration.test.js
```

---

## Extending AFIE

### Add a new news source

Add an entry to `config/sources.config.js`. No engine code changes needed.

### Add a new watchlist asset

Add an entry to `config/assets.config.js` with:
- `keywords` — terms that indicate this asset may be relevant
- `sensitivity` — which macro event categories affect it and how
- `macroContext` — narrative explanation for the reasoning engine

### Change the AI model

Edit `PIPELINE_CONFIG.reasoning.primaryModel` in `config/pipeline.config.js`.

### Tune clustering sensitivity

Adjust `PIPELINE_CONFIG.clustering.storyMergeThreshold` in `config/pipeline.config.js`.
Higher values = fewer, larger clusters. Lower values = more, smaller clusters.

---

## Design Decisions

**Why two passes?**
Separating fact collection from market reasoning prevents hallucination contamination, makes debugging tractable, and lets users clearly see what is fact and what is interpretation.

**Why append-only story memory?**
Stories evolve over days and weeks. Overwriting history would lose the ability to track how a story changed, which is precisely what makes fundamental analysis valuable.

**Why conservative clustering?**
A missed merge (two cards for the same story) is recoverable. A false merge (one card mixing two unrelated stories) corrupts the analysis. When in doubt, separate.

**Why is confidence about the story, not the AI?**
Confidence in "will gold go up" is unknowable. Confidence in "is this information well-sourced" is measurable and honest.

---

## Disclaimer

AFIE provides market context only. It does not issue trading signals. All information is sourced from published articles. No content constitutes financial advice. All trading decisions remain entirely with the user.
