# AFIE V2A — Narrative Intelligence Module

**Version:** 2A  
**Status:** Extension of V1. V1 architecture is entirely unchanged.  
**Dependency:** AFIE V1 Intelligence Engine must be installed and have produced at least one pipeline run.

---

## What V2A Does

V2A synthesizes the intelligence already produced by V1 into a single coherent narrative document — the **Morning Intelligence Brief**.

V2A answers: **"What is the market's current narrative?"**  
V1 answers: **"What happened, and what might it mean for each asset?"**

These are complementary, non-overlapping responsibilities.

---

## What V2A Does Not Do

- Does not fetch news
- Does not call external APIs (beyond one AI synthesis call)
- Does not write to or modify V1's StoryStore
- Does not re-analyse articles or generate new factual intelligence
- Does not introduce analysis beyond what V1 has already produced
- Does not generate trading signals

---

## Architecture

```
V1 StoryStore (read-only)
        │
        ▼
StoryReader.loadBriefingContext()
        │
        ├──▶ NarrativeClassifier      → macro themes + sentiment label
        ├──▶ ContinuityAnalyser       → story evolution across sessions
        ├──▶ MarketExpectationInferrer → expectations from V1 reasoning
        ├──▶ AssetNarrativeSummariser → per-asset narrative digest
        └──▶ NarrativeRiskIdentifier  → narrative-altering risks
                │
                ▼
        AI synthesis call (prose generation from structured data)
                │
                ▼
        BriefValidator.validate()
                │
                ▼
        MorningBrief JSON
        ./data/briefs/brief_YYYYMMDD_morning.json
```

### The AI's Role in V2A

The AI makes **one** call per brief — and its role is **writing**, not reasoning.

All reasoning has already been done by V1. The five synthesizer modules extract and structure that intelligence into typed data objects. The AI receives those structured objects and converts them into institutional prose.

The AI in V2A cannot introduce new analysis, new facts, or new story interpretations. It can only write.

---

## Folder Structure

```
narrative/
├── index.js                         Entry point / public API
├── NARRATIVE_ARCHITECTURE.md        Design reference
├── config/
│   └── narrative.config.js          All tunable parameters
├── interfaces/
│   └── StoryReader.js               Read-only V1 interface
├── synthesizers/
│   ├── NarrativeClassifier.js       Macro themes + sentiment
│   ├── ContinuityAnalyser.js        Story evolution detection
│   ├── MarketExpectationInferrer.js Expectation extraction
│   ├── AssetNarrativeSummariser.js  Per-asset narrative digest
│   └── NarrativeRiskIdentifier.js  Narrative risk identification
├── briefings/
│   ├── MorningBriefGenerator.js     Orchestrator
│   ├── BriefValidator.js            Schema validation
│   └── schema/
│       └── MorningBrief.schema.json Output schema
└── tests/
    ├── fixtures/
    │   └── stories.fixtures.js      Sample V1 stories for tests
    ├── synthesizers.test.js         Synthesizer unit tests
    └── brief.integration.test.js   Integration + validator tests
```

---

## Usage

### Run standalone (after V1 has populated stories)

```bash
node narrative/index.js
```

### Dry run (skip AI synthesis call)

```bash
node narrative/index.js --dry-run
```

### Triggered automatically after V1 pipeline

In `index.js` (V1 entry point), add:

```js
import { generateMorningBrief } from './narrative/index.js';
import { getAllSymbols } from './config/assets.config.js';

EventBus.on('pipeline:complete', () => {
  generateMorningBrief({ watchlist: getAllSymbols() })
    .catch(err => logger.error('Brief generation failed:', err));
});
```

### Run tests

```bash
npm test -- narrative/tests/
```

---

## Morning Brief Sections

| Section | Purpose |
|---------|---------|
| `executiveSummary` | 60-second macro overview. Headline + prose. |
| `macroNarrative` | Dominant themes + flagship narrative prose |
| `storyContinuity` | Continuing, new, and resolved stories |
| `marketExpectations` | Expectations inferred from V1 reasoning |
| `assetSummaries` | Per-asset narrative digest for every watchlist symbol |
| `afieIsMonitoring` | What the intelligence engine is actively tracking |
| `narrativeRisks` | Developments that could alter the current narrative |

---

## Extending V2A

### Add a new brief type

1. Create `briefings/WeeklyOutlookGenerator.js` (copy MorningBriefGenerator structure)
2. Create `briefings/schema/WeeklyOutlook.schema.json`
3. Create `briefings/WeeklyBriefValidator.js`
4. Add `weekly_outlook` to the `briefType` enum in MorningBrief.schema.json
5. All five synthesizers are reusable unchanged

### Add a new synthesizer

1. Create `synthesizers/YourSynthesizer.js`
2. Import and call it in `MorningBriefGenerator.js`
3. Add its output to the brief assembly step

No V1 code is ever modified.

---

## Output Location

```
./data/briefs/
├── _brief_index.json          Index of all generated briefs
├── brief_20260731_morning.json
├── brief_20260730_morning.json
└── ...
```

---

## Disclaimer

V2A inherits V1's disclaimer. All content is market context only. No trading signals. No financial advice. All trading decisions remain with the user.
