# AFIE Version 2A — Narrative Intelligence Architecture
**Status:** LOCKED — Architecturally complete. Extend; do not redesign.  
**Classification:** Internal Design Document — Permanent Architectural Reference  
**Locked:** 31 July 2026  

---

## 1. Relationship to Version 1

Version 2A is a **reporting layer** that sits downstream of the complete V1 intelligence pipeline.

```
VERSION 1 (unchanged)
┌───────────────────────────────────────────────────────┐
│  News Sources → Pass 1 → FKOs → Pass 2 → StoryStore  │
│                                                       │
│  Output: AnalysedStory[] (JSON, persisted)            │
└───────────────────────────────┬───────────────────────┘
                                │
                    Read-only interface
                    (StoryStore.loadAllStories,
                     loadActiveStories,
                     loadRecentStories)
                                │
VERSION 2A (new)
┌───────────────────────────────▼───────────────────────┐
│  NARRATIVE INTELLIGENCE MODULE                        │
│                                                       │
│  StoryReader → NarrativeSynthesizer → BriefBuilder    │
│                                                       │
│  Output: MorningBrief (JSON, separate store)          │
└───────────────────────────────────────────────────────┘
```

V2A makes **no changes** to:
- Pass 1 or Pass 2 engines
- StoryStore write operations
- The AnalysedStory schema
- Pipeline.js orchestration
- Any existing config or utility

V2A only **reads** from V1 through three existing public functions:
- `StoryStore.loadAllStories()`
- `StoryStore.loadActiveStories()`
- `StoryStore.loadRecentStories(days)`

---

## 2. Design Principle

V2A does not reason from raw articles. It does not call news APIs. It does not re-analyse facts.

It synthesizes the intelligence that V1 has already produced — across multiple stories, across multiple versions — into a single coherent narrative document.

The question V2A answers: **"What is the market's current narrative?"**

The question V1 answers: **"What happened, and what might it mean for each asset?"**

These are complementary and non-overlapping responsibilities.

---

## 2A. Narrative Integrity Principle

**This principle is a permanent architectural rule for Version 2A and all future reporting layers.**

Version 2A never introduces new facts.

Every narrative, market context statement, continuity assessment, expectation, and intelligence brief must be traceable to intelligence that has already been produced by the Version 1 engine.

Version 2A is permitted to synthesise, connect, explain, prioritise, and organise intelligence, but it must never invent new evidence or create unsupported conclusions.

If sufficient evidence does not exist, AFIE must explicitly communicate uncertainty rather than speculate.

### Implications for all V2A components

**StoryReader** — may only load and pre-organise intelligence already stored in V1's StoryStore. It may not enrich, augment, or modify that intelligence during loading.

**Synthesizers** — may only process and structure intelligence present in the `BriefingContext` they receive. A synthesizer that detects an absence of evidence must communicate that absence explicitly (`hasNoActiveStories`, `insufficient_evidence`, `awaiting_catalyst`) rather than filling the gap with inference.

**AI synthesis call** — the single AI prose-generation call in `MorningBriefGenerator` receives only structured synthesizer outputs. Its system prompt prohibits the introduction of new analysis, new facts, or new story interpretations. The AI writes from structured intelligence; it does not extend it.

**BriefValidator** — schema validation enforces that every `expectationItem` carries a `certainty` label, every `narrativeRisk` carries a `likelinessReasoning` traced to a `sourceStoryId`, and every `afieIsMonitoring` item carries a `storyId`. These constraints exist to make traceability mechanically enforceable, not merely aspirational.

**Future reporting layers** — any module added under `briefings/` or `synthesizers/` inherits this principle unconditionally. A new brief type that introduces facts from outside V1's intelligence store would violate the principle regardless of whether those facts are accurate.

### When evidence is insufficient

AFIE uses the following patterns when evidence does not support a conclusion:

- `"AFIE has not yet observed sufficient evidence to conclude..."` — used in brief prose when a narrative direction cannot be established
- `sentimentLabel: "awaiting_catalyst"` — used when active stories do not support a characterisation of the macro environment
- `certainty: "insufficient_evidence"` — used on expectation items derived from single-source or unconfirmed watch points
- `hasNoActiveStories: true` — used on asset summaries when V1 has produced no active stories affecting that asset
- `confidence: 0` — used on asset summaries when no impact assessment exists

Explicit uncertainty is always preferred over speculative completeness.

---

## 3. Folder Structure

```
afie-engine/narrative/
│
├── NARRATIVE_ARCHITECTURE.md    ← This document
│
├── interfaces/
│   └── StoryReader.js           ← Read-only adapter over V1 StoryStore
│
├── synthesizers/
│   ├── NarrativeClassifier.js   ← Determine dominant macro themes
│   ├── ContinuityAnalyser.js    ← Detect story evolution across sessions
│   ├── AssetNarrativeSummariser.js ← Per-asset narrative digest
│   ├── NarrativeRiskIdentifier.js  ← Identify narrative-altering risks
│   └── MarketExpectationInferrer.js ← Infer expectations from story reasoning
│
├── briefings/
│   ├── MorningBriefGenerator.js ← Orchestrates all synthesizers → MorningBrief
│   ├── BriefValidator.js        ← Schema validation for brief output
│   └── schema/
│       └── MorningBrief.schema.json ← Authoritative output schema
│
├── config/
│   └── narrative.config.js      ← Tunable parameters for V2A
│
└── tests/
    ├── fixtures/
    │   └── stories.fixtures.js  ← Sample AnalysedStory objects for tests
    ├── synthesizers.test.js     ← Unit tests for all synthesizer modules
    └── brief.integration.test.js ← End-to-end brief generation test
```

---

## 4. Data Flow

```
StoryStore (V1, read-only)
        │
        ▼
StoryReader.loadBriefingContext()
        │
        │  Returns: BriefingContext {
        │    activeStories: AnalysedStory[],
        │    recentStories: AnalysedStory[],
        │    allAffectedAssets: string[],
        │    watchlist: string[],
        │    dataAsOf: ISO timestamp
        │  }
        │
        ▼
MorningBriefGenerator.generate(context)
        │
        ├──▶ NarrativeClassifier      → dominant themes + sentiment label
        ├──▶ ContinuityAnalyser       → story evolution since prior session
        ├──▶ MarketExpectationInferrer → inferred expectations from reasoning
        ├──▶ AssetNarrativeSummariser  → per-asset digest for each watchlist symbol
        └──▶ NarrativeRiskIdentifier  → narrative-altering risk factors
                │
                ▼
        AI synthesis call (assembles all synthesizer outputs into prose)
                │
                ▼
        BriefValidator.validate()
                │
                ▼
        MorningBrief JSON
                │
                ▼
        Persisted to ./data/briefs/YYYY-MM-DD-morning.json
```

---

## 5. AI Role in V2A

V2A makes **one** AI call per brief generation — the narrative synthesis call inside `MorningBriefGenerator`. This is fundamentally different from V1's AI usage:

| Dimension | V1 AI Usage | V2A AI Usage |
|-----------|-------------|--------------|
| Input | Raw article text + structured facts | Structured synthesizer outputs only |
| Role | Extract facts, reason from facts | Write coherent narrative prose from pre-structured data |
| Temperature | 0.2 (analytical) | 0.3 (slightly more fluid prose) |
| No-invent rule | Cannot invent facts | Cannot invent story developments |
| Grounding | Facts from Pass 1 FKO | AnalysedStory objects from V1 |

The AI in V2A writes — it does not reason. All reasoning has already been done by V1. The synthesizers extract and structure the intelligence; the AI converts that structure into institutional prose.

---

## 6. Extensibility

The `briefings/` folder is designed to host multiple brief types. Adding a new brief type (e.g. `AfternoonUpdateGenerator.js`, `WeeklyOutlookGenerator.js`) requires:
- A new generator module in `briefings/`
- A new schema in `briefings/schema/`
- Reuse of all existing synthesizers unchanged

The synthesizers are brief-type-agnostic. They produce structured data objects. Any brief type can consume them.

---

## 7. Version Boundary

V2A is triggered **after** the V1 pipeline completes, or on demand (e.g. on a morning schedule independent of the collection cycle).

V2A is never triggered mid-pipeline. It always reads a complete, persisted V1 output.

```
V1 Pipeline completes → EventBus.emit('pipeline:complete') 
        → MorningBriefGenerator listens (optional trigger)
        → OR: separate cron at 06:00 daily triggers independently
```
