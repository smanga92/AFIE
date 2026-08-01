# AFIE Intelligence Engine — Architecture Reference
**Version:** 1.0  
**Classification:** Internal Design Document  
**Purpose:** Authoritative specification for every component, data flow, and design decision in the AFIE engine.

---

## 1. System Philosophy

AFIE is **not** a prediction engine.  
AFIE is **not** a signal generator.  
AFIE is **not** an automated trading system.

AFIE is an **AI market intelligence analyst** that:
- Reads financial news from trusted sources
- Understands and connects related stories
- Maintains persistent memory of evolving events
- Extracts verified facts, separated from interpretation
- Reasons about possible market implications from those facts
- Presents evidence-based analysis with full source transparency

The guiding principle: **a professional institutional research desk, not a trading algorithm.**

---

## 2. Two-Pass Architecture — Core Design Principle

Every article that enters AFIE travels through exactly two independent analytical passes. These passes must never be collapsed into one.

```
RAW ARTICLES
     │
     ▼
┌─────────────────────────────────────────┐
│  PASS 1 — FACT COLLECTION ENGINE        │
│  "What objectively happened?"           │
│                                         │
│  • Collection      • Deduplication      │
│  • Clustering      • Fact extraction    │
│  • Timeline        • Source tracing     │
│                                         │
│  OUTPUT: FactualKnowledgeObject (FKO)   │
└─────────────────────────────────────────┘
     │
     │  Only FKO passes through. Raw articles stop here.
     ▼
┌─────────────────────────────────────────┐
│  PASS 2 — MARKET REASONING ENGINE       │
│  "What might this mean for markets?"    │
│                                         │
│  • Story memory    • Asset matching     │
│  • Impact analysis • Contradiction scan │
│  • Confidence      • Evidence binding   │
│                                         │
│  OUTPUT: AnalysedStory (JSON schema)    │
└─────────────────────────────────────────┘
     │
     ▼
  STORY STORE  →  UI RENDERER
```

**Why this separation matters:**
- Facts cannot be contaminated by financial interpretation
- Reasoning can be audited independently of collection
- Debugging is isolated to one pass at a time
- Users can trust the fact/analysis boundary
- Hallucinations in Pass 2 cannot forge facts from Pass 1

---

## 3. Folder Structure

```
afie-engine/
│
├── ARCHITECTURE.md          ← This document
│
├── config/
│   ├── sources.config.js    ← All news provider definitions
│   ├── watchlist.config.js  ← Default asset watchlist
│   ├── assets.config.js     ← Asset metadata + macro relationships
│   └── pipeline.config.js   ← Tuning parameters for each stage
│
├── adapters/                ← Data ingestion adapters (one per source type)
│   ├── BaseAdapter.js
│   ├── RssAdapter.js
│   ├── RestApiAdapter.js
│   ├── CentralBankAdapter.js
│   └── GovernmentReleaseAdapter.js
│
├── pass1/                   ← PASS 1: Fact Collection Engine
│   ├── ArticleCollector.js  ← Orchestrates all adapters
│   ├── ArticleCleaner.js    ← Normalise raw articles
│   ├── DuplicateDetector.js ← Exact + near-duplicate removal
│   ├── StoryClusterer.js    ← Group articles into stories
│   ├── FactExtractor.js     ← Extract structured facts from text
│   └── Pass1Runner.js       ← Orchestrates all Pass 1 stages
│
├── pass2/                   ← PASS 2: Market Reasoning Engine
│   ├── StoryMemoryLoader.js ← Load/update persistent story state
│   ├── AssetMatcher.js      ← Match stories to watchlist assets
│   ├── ImpactAnalyser.js    ← Generate impact analysis per asset
│   ├── ContradictionScanner.js ← Detect analyst disagreement
│   ├── EvidenceBinder.js    ← Link conclusions to source facts
│   ├── ReasoningEngine.js   ← Core AI reasoning orchestrator
│   └── Pass2Runner.js       ← Orchestrates all Pass 2 stages
│
├── memory/                  ← Persistent story memory
│   ├── StoryStore.js        ← CRUD operations on stories
│   ├── StoryMatcher.js      ← "Does this belong to existing story?"
│   ├── TimelineManager.js   ← Append-only timeline management
│   └── ChangeDetector.js    ← What's new since last update?
│
├── scoring/
│   ├── ConfidenceScorer.js  ← Multi-factor confidence calculation
│   ├── SourceReliability.js ← Publisher trust tier registry
│   └── StatusMachine.js     ← Story lifecycle state management
│
├── core/
│   ├── Pipeline.js          ← Top-level pipeline orchestrator
│   ├── EventBus.js          ← Internal pub/sub for stage communication
│   └── Logger.js            ← Structured logging throughout
│
├── output/
│   ├── SchemaValidator.js   ← Validate output against JSON schema
│   ├── OutputBuilder.js     ← Assemble final AnalysedStory objects
│   └── schema/
│       └── AnalysedStory.schema.json ← Authoritative output schema
│
├── utils/
│   ├── TextSimilarity.js    ← String similarity algorithms
│   ├── DateNormaliser.js    ← Consistent datetime handling
│   ├── AssetKeywords.js     ← Asset → keyword expansion maps
│   └── RateLimiter.js       ← API rate limiting utility
│
└── tests/
    ├── pass1/               ← Unit tests for each Pass 1 module
    ├── pass2/               ← Unit tests for each Pass 2 module
    ├── integration/         ← End-to-end pipeline tests
    └── fixtures/            ← Sample articles for deterministic testing
```

---

## 4. Module Responsibilities

### config/

| File | Responsibility |
|------|---------------|
| `sources.config.js` | Defines every news provider: URL, type (RSS/REST/scrape), category, reliability tier, rate limits, auth tokens |
| `watchlist.config.js` | Default watchlist assets; user overrides applied at runtime |
| `assets.config.js` | For each asset: category, sensitivity map (which macro events affect it, and how), keyword triggers |
| `pipeline.config.js` | Similarity thresholds, clustering window sizes, confidence weights, AI model choices |

### adapters/

Each adapter converts a raw data source into a normalised `RawArticle` object. No analysis occurs here. Adapters are the only code that touches external APIs.

### pass1/

| Module | Input | Output |
|--------|-------|--------|
| `ArticleCollector` | Source configs | `RawArticle[]` |
| `ArticleCleaner` | `RawArticle[]` | `CleanArticle[]` |
| `DuplicateDetector` | `CleanArticle[]` | `UniqueArticle[]` |
| `StoryClusterer` | `UniqueArticle[]` | `ArticleCluster[]` |
| `FactExtractor` | `ArticleCluster[]` | `FactualKnowledgeObject[]` |
| `Pass1Runner` | Trigger signal | `FactualKnowledgeObject[]` |

### pass2/

| Module | Input | Output |
|--------|-------|--------|
| `StoryMemoryLoader` | FKO + StoryStore | `StoryWithHistory` |
| `AssetMatcher` | FKO + watchlist | `AssetMatch[]` |
| `ImpactAnalyser` | `AssetMatch[]` + FKO | `ImpactAnalysis[]` |
| `ContradictionScanner` | FKO | `Contradiction[]` |
| `EvidenceBinder` | Conclusions + FKO | `EvidencedConclusion[]` |
| `ReasoningEngine` | All above | `AnalysedStory` |

### memory/

Persistent, append-only story records. Nothing in this layer is ever overwritten. Updates always produce a new version entry.

### scoring/

Pure functions. No side effects. Input facts → output numeric scores with explanations.

### output/

Assembles and validates the final JSON output. Nothing leaves the engine without passing schema validation.

---

## 5. Data Flow Diagram

```
EXTERNAL SOURCES
┌──────────────────────────────────────────────────────┐
│  RSS Feeds  │  REST APIs  │  Gov Sites  │  CB Pubs   │
└──────┬───────┴──────┬──────┴──────┬──────┴─────┬─────┘
       │              │              │             │
       └──────────────┴──────────────┴─────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  ArticleCollector  │  → RawArticle[]
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   ArticleCleaner   │  → CleanArticle[]
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  DuplicateDetector │  → UniqueArticle[]
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   StoryClusterer   │  → ArticleCluster[]
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   FactExtractor    │  → FactualKnowledgeObject[]
                    └─────────┬──────────┘
                              │
              ════════════════╪════════════════
               PASS 1 / PASS 2 BOUNDARY
              ════════════════╪════════════════
                              │
                    ┌─────────▼──────────┐
                    │  StoryMemoryLoader │  ←→ StoryStore (DB)
                    └─────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼──┐  ┌─────────▼──┐  ┌────────▼────────┐
    │AssetMatcher│  │Contradiction│  │  ChangeDetector │
    └─────────┬──┘  │  Scanner   │  └────────┬────────┘
              │     └─────────┬──┘           │
              └───────────────┼───────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  ImpactAnalyser    │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  EvidenceBinder    │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  ConfidenceScorer  │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │   OutputBuilder    │  → AnalysedStory (JSON)
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  SchemaValidator   │  → Validated or rejected
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │     StoryStore     │  → Persisted
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │    UI Renderer     │  (reads JSON only)
                    └────────────────────┘
```

---

## 6. Story Memory Architecture

Each story is stored as an immutable-history document. New information is always appended, never overwritten.

```
StoryRecord {
  id:              stable UUID, never changes
  slug:            human-readable identifier ("us-china-trade-2026")
  createdAt:       ISO timestamp of first article
  status:          current lifecycle state
  
  versions: [                    ← append-only array
    {
      versionNumber: 1,
      timestamp: "...",
      triggerArticleIds: [...],
      summary: "...",
      facts: [...],
      reasoning: "...",
      confidence: { score, breakdown, explanation },
      affectedAssets: [...],
      timelineEntry: { date, event, type }
    },
    {
      versionNumber: 2,          ← next update appends here
      ...
      whatChanged: "..."         ← delta from version 1
    }
  ],
  
  timeline: [                    ← denormalised for UI convenience
    { date, event, type, sourceArticleIds }
  ],
  
  allSourceArticleIds: [...],    ← every article ever associated
  currentSummary: "...",         ← always points to latest version
  currentFacts: [...],
  currentReasoning: "...",
  currentAffectedAssets: [...],
  currentConfidence: {...},
}
```

---

## 7. AI Reasoning Architecture

The ReasoningEngine receives a fully assembled context object and produces structured reasoning. It never receives raw articles.

```
ReasoningContext {
  story: StoryWithHistory,
  facts: VerifiedFact[],
  assetMatches: AssetMatch[],
  contradictions: Contradiction[],
  previousVersions: StoryVersion[],
  watchlist: string[],
  marketConditions: MacroContext    ← optional enrichment
}
```

The reasoning prompt is assembled from this context. The AI model responds in structured JSON. The response is then validated, evidence-bound, and scored before becoming output.

**Reasoning prompt structure:**
1. System role: "You are a professional macroeconomic research analyst. You reason only from provided facts."
2. Verified facts block (from Pass 1 FKO)
3. Asset watchlist
4. Previous story context (if update)
5. Specific reasoning questions (why, who, what changed, what to watch)
6. Output format instruction (strict JSON)

---

## 8. Database / Storage Strategy

**Development / single-user:** JSON file store (stories persisted as `{storyId}.json`)

**Production / multi-user:**
- **Primary store:** PostgreSQL — story records, article metadata, user watchlists
- **Search index:** Elasticsearch or Typesense — fast story lookup by keyword/entity
- **Cache:** Redis — recent article hashes (for deduplication), rate limit counters
- **Object store:** S3-compatible — full article body archive, audit logs

**Schema (PostgreSQL):**
```sql
stories          (id, slug, status, created_at, updated_at, current_version)
story_versions   (id, story_id, version_number, timestamp, summary, facts_json,
                  reasoning_json, confidence_json, assets_json, what_changed)
story_timeline   (id, story_id, event_date, event_text, event_type, source_ids)
articles         (id, story_id, url_hash, headline, publisher, published_at,
                  reliability_tier, body_text, pass1_facts_json)
asset_impacts    (id, story_id, version_id, asset_symbol, strength, direction,
                  confidence, reasoning, evidence_ids)
contradictions   (id, story_id, version_id, description, source_a, source_b,
                  perspective_a, perspective_b)
```

---

## 9. API Strategy

**Inbound (news collection):**
- NewsAPI.org — general financial news
- AlphaVantage News API — market-specific news
- RSS feeds — Reuters, FT, Bloomberg, CNBC, ForexLive, CoinDesk, Kitco
- Central bank websites — Fed, ECB, BoJ, BoE, RBA (scraped/RSS)
- Government portals — BLS, ONS, Eurostat (official releases)

**Outbound (AI reasoning):**
- Anthropic Claude API (claude-opus-4-6 for reasoning, claude-haiku-4-5 for classification)
- Model choice is config-driven — swappable without code changes

**Rate limiting strategy:**
- Per-source configurable rate limits
- Exponential backoff on 429/503
- Circuit breaker pattern: if source fails 3× in 5 min, pause for 15 min

---

## 10. Scalability Plan

| Phase | Deployment | Notes |
|-------|-----------|-------|
| Phase 1 (now) | Single Node.js process, JSON file store | Suitable for personal use |
| Phase 2 | Docker containerised, PostgreSQL, scheduled cron | Small team |
| Phase 3 | Queue-based (BullMQ/Redis), worker pool | Multiple users, parallel processing |
| Phase 4 | Microservices: Collector, Analyser, Store, API | Production SaaS |

**Extension points designed in from day one:**
- `adapters/` — add new source by dropping in a new adapter file
- `assets.config.js` — add new asset with zero engine changes
- `scoring/` — swap or tune confidence models independently
- `pass1/` and `pass2/` are independent — either can be upgraded separately
- Output schema is versioned — UI can handle multiple schema versions

---

*End of Architecture Reference*
