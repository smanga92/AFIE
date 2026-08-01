# AFIE Version 2B — Intelligence Sources Architecture
**Status:** Under review — not yet locked.
**Classification:** Internal Design Document
**Depends on:** V1 (locked), V2A (locked)

---

## 1. Objective

Version 2B answers one question:

> "Where did AFIE obtain this intelligence, how trustworthy is it,
> and does it have sufficient evidence before reasoning?"

This version introduces no new market analysis, no new reasoning philosophy,
and no new report types. It improves the quality, flexibility, and
transparency of intelligence *entering* the Reasoning Engine.

---

## 2. What V2B Adds — Overview

| Capability | New Location | Touches V1? |
|---|---|---|
| Provider Management (news) | `providers/news/` | No |
| AI Provider Abstraction | `providers/ai/` | No — `AIClient.js` delegates |
| Evidence Enrichment Layer | `enrichment/` | No — inserted between passes in `Pipeline.js` |
| Source Intelligence metadata | `sources/SourceRegistry.js` | No — extends config |
| Re-analysis Capability | `reanalysis/` | No — reads StoryStore |
| Config extensions | `config/providers.config.js` (new) | No |

**Nothing in Pass 1, Pass 2, V2A, or the locked schema files is modified.**
The only existing file modified is `utils/AIClient.js` — it is retrofitted to
delegate to the new AI registry while preserving its call signature exactly,
so every existing caller (`FactExtractor`, `ReasoningEngine`, `MorningBriefGenerator`)
continues to work without change.

---

## 3. Architecture Diagram

```
EXTERNAL NEWS SOURCES
  └─▶  providers/news/NewsProviderRegistry
         ├─ RssNewsProvider
         ├─ RestNewsProvider
         ├─ CentralBankProvider
         └─ [future: PremiumProvider, CustomProvider]
              │
              ▼
         ArticleCollector (unchanged — receives RawArticle[])

PASS 1  (unchanged)
  └─▶  FKO[]

══════════════════════════════════════
  EVIDENCE ENRICHMENT LAYER (NEW)
══════════════════════════════════════
  EvidenceEnrichmentOrchestrator
    ├─ EnrichmentGatekeeper  ← decides IF enrichment runs
    ├─ SupportingEvidenceFinder
    ├─ ContradictionEvidenceFinder
    ├─ OfficialStatementLocator
    └─ ContextEnricher
              │
              ▼ EnrichedFKO[]

PASS 2  (unchanged — receives EnrichedFKO)

AI CALL  ──────────────────────────────────────
  providers/ai/AIProviderRegistry
    ├─ AnthropicAdapter     (active)
    ├─ OpenAIAdapter        (placeholder)
    ├─ GoogleAdapter        (placeholder)
    ├─ OpenRouterAdapter    (placeholder)
    └─ LocalModelAdapter    (placeholder)
         └─▶  utils/AIClient.js (delegates here — call signature unchanged)

RE-ANALYSIS (on demand, separate from main pipeline)
  reanalysis/ReanalysisEngine
    ├─ reads StoryStore (V1, read-only)
    ├─ calls AIProviderRegistry with DIFFERENT model
    └─ stores independent ReanalysisResult alongside story
```

---

## 4. Folder Structure

```
afie-engine/
│
├── providers/
│   ├── ai/
│   │   ├── AIProviderRegistry.js    ← routes callAI() to configured provider
│   │   ├── BaseAIProvider.js        ← abstract base, defines the provider contract
│   │   ├── AnthropicProvider.js     ← production-ready (wraps existing logic)
│   │   ├── OpenAIProvider.js        ← placeholder, full contract
│   │   ├── GoogleProvider.js        ← placeholder, full contract
│   │   ├── OpenRouterProvider.js    ← placeholder, full contract
│   │   └── LocalModelProvider.js   ← placeholder, Ollama-compatible
│   │
│   └── news/
│       ├── NewsProviderRegistry.js  ← replaces hard-coded adapter factory
│       ├── BaseNewsProvider.js      ← wraps BaseAdapter with V2B metadata
│       ├── RssNewsProvider.js       ← wraps RssAdapter
│       └── RestNewsProvider.js      ← wraps RestApiAdapter
│
├── enrichment/
│   ├── EvidenceEnrichmentOrchestrator.js  ← entry point; decides & coordinates
│   ├── EnrichmentGatekeeper.js            ← WHEN to enrich (gate logic)
│   ├── SupportingEvidenceFinder.js        ← finds corroborating sources
│   ├── ContradictionEvidenceFinder.js     ← finds conflicting reports
│   ├── OfficialStatementLocator.js        ← targets official bodies
│   └── ContextEnricher.js                 ← adds macro context
│
├── sources/
│   └── SourceRegistry.js           ← unified source intelligence layer
│
├── reanalysis/
│   ├── ReanalysisEngine.js         ← orchestrates independent re-analysis
│   └── ReanalysisStore.js          ← persists re-analysis results separately
│
└── config/
    └── providers.config.js         ← all V2B provider configuration
```

---

## 5. Key Design Decisions

### 5.1 AIClient.js is preserved, not replaced

Every existing caller uses `callAI()` from `utils/AIClient.js`. Rather than
updating every call site, `AIClient.js` is retrofitted to delegate to the
`AIProviderRegistry`. The call signature is identical. Callers are unaware
of the change. This is the minimum-disruption path.

### 5.2 Evidence Enrichment inserts between passes in Pipeline.js only

`Pass1Runner.js` and `Pass2Runner.js` are not modified. `Pipeline.js`
(the only file that calls both) is updated to run enrichment between them:

```
runPass1() → EvidenceEnrichmentOrchestrator.enrich(fkos) → runPass2()
```

The FKO schema gains an optional `enrichment` field. Pass 2 uses it if
present; ignores it if absent. This makes enrichment additive and backwards
compatible.

### 5.3 Evidence Enrichment only activates when justified

The `EnrichmentGatekeeper` evaluates each FKO against trigger criteria before
any search occurs. If no trigger fires, the FKO passes through unchanged.
This prevents unnecessary API calls and keeps the pipeline fast for
well-evidenced stories.

### 5.4 Re-analysis is fully independent of the main pipeline

`ReanalysisEngine` is a standalone on-demand capability. It reads from
`StoryStore` (V1, read-only) and writes to `ReanalysisStore` (separate store).
It never writes to `StoryStore`. It never runs automatically during the
pipeline. It is triggered explicitly — by the user or by a scheduled task.

### 5.5 News provider registry replaces the adapter factory in ArticleCollector

`ArticleCollector.js` currently contains an inline `createAdapter()` factory.
V2B replaces that factory call with `NewsProviderRegistry.getProvider()`.
`ArticleCollector.js` itself is otherwise unchanged — it still receives
`RawArticle[]` and passes them on identically.
