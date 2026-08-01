# AFIE V2B — Intelligence Sources

**Version:** 2B  
**Status:** Under review — not yet locked.  
**Depends on:** V1 (locked), V2A (locked)

---

## What V2B Adds

V2B answers one question:

> "Where did AFIE obtain this intelligence, how trustworthy is it,
> and does it have sufficient evidence before reasoning?"

It introduces five capabilities, all implemented as extensions to the
existing architecture. Nothing in V1 or V2A is redesigned.

| Capability | What it does |
|---|---|
| **Provider Management** | Configurable news source layer — enable, disable, prioritise, replace |
| **AI Provider Abstraction** | Switch AI models and providers without touching reasoning code |
| **Evidence Enrichment Layer** | Gated intelligence gathering between Pass 1 and Pass 2 |
| **Source Intelligence** | Enriched metadata, trust scores, health tracking per source |
| **Re-analysis Capability** | Independent second-model review of any completed story |

---

## What V2B Does Not Change

- Pass 1 (ArticleCollector, ArticleCleaner, DuplicateDetector, StoryClusterer, FactExtractor) — **unchanged**
- Pass 2 (ReasoningEngine, ContradictionScanner, Pass2Runner) — **unchanged**
- V2A Narrative Intelligence module — **unchanged**
- V1 StoryStore write operations — **unchanged**
- AnalysedStory JSON schema — **unchanged**
- MorningBrief JSON schema — **unchanged**
- All locked architecture documents — **unchanged**

The only existing files modified:
- `utils/AIClient.js` — retrofitted to delegate to AIProviderRegistry (call signature identical)
- `core/Pipeline.js` — enrichment step inserted between Pass 1 and Pass 2

---

## Folder Structure

```
afie-engine/
│
├── providers/
│   ├── ai/
│   │   ├── BaseAIProvider.js        Abstract contract for all AI providers
│   │   ├── AnthropicProvider.js     Production-ready (default)
│   │   ├── ProviderPlaceholders.js  OpenAI, Google, OpenRouter, Local (ready to fill)
│   │   └── AIProviderRegistry.js   Routes callAI() to configured provider
│   │
│   └── news/
│       └── NewsProviderRegistry.js  Priority-ordered news collection layer
│
├── enrichment/
│   ├── EnrichmentGatekeeper.js      Decides WHEN to enrich (trigger evaluation)
│   ├── EvidenceFinders.js           Four finders: support, contradiction, official, context
│   └── EvidenceEnrichmentOrchestrator.js  Coordinates enrichment per FKO
│
├── sources/
│   └── SourceRegistry.js            Enriched source metadata + trust weights + health
│
├── reanalysis/
│   └── ReanalysisEngine.js          Independent re-analysis + ReanalysisStore
│
├── config/
│   └── providers.config.js          All V2B configuration in one file
│
└── tests/v2b/
    └── v2b.test.js                  Full V2B test suite
```

---

## Configuration

All V2B behaviour is controlled from `config/providers.config.js`.

### Switch AI provider

```js
// config/providers.config.js
ai: {
  primaryProvider: 'openai',   // was 'anthropic'
```

No engine code changes needed.

### Enable a new AI provider

```js
openai: {
  enabled: true,   // was false
  // Requires OPENAI_API_KEY environment variable
```

### Disable a news source

```js
// config/sources.config.js
forexlive: {
  active: false,
```

### Disable Evidence Enrichment

```js
enrichment: {
  enabled: false,
```

### Tune enrichment triggers

```js
enrichment: {
  triggers: {
    lowSourceCount: { enabled: true, threshold: 3 },  // require 3+ sources before skipping
    hasContestedFacts: { enabled: false },             // disable this trigger
```

---

## How Evidence Enrichment Works

Evidence Enrichment inserts between Pass 1 and Pass 2.
For each FKO, the EnrichmentGatekeeper evaluates five trigger conditions:

| Trigger | Condition |
|---|---|
| `lowSourceCount` | Fewer than N source articles |
| `hasContestedFacts` | Any `isContested: true` facts |
| `missingOfficialSource` | No tier-1 official source + story is significant |
| `highImpactAssets` | 2+ high-impact symbols (XAUUSD, NAS100, etc.) |
| `breakingStatus` | First articles within 2 hours from 3+ publishers |

If **no trigger fires**, the FKO passes through unchanged. No search occurs.

If **any trigger fires**, the Orchestrator runs the appropriate finders:
- `SupportingEvidenceFinder` — looks for corroborating sources
- `ContradictionEvidenceFinder` — looks for conflicting reports  
- `OfficialStatementLocator` — looks for official body confirmation
- `ContextEnricher` — looks for macro background context

Enrichment results are attached to the FKO as an optional `enrichment` field.
Pass 2 reads this field if present. Enrichment failures never block the pipeline.

### Search providers

The default `searchProvider: 'internal'` searches the existing V1 StoryStore.
This requires no external API and works in all environments.

To enable external web search, set `searchProvider: 'web'` in
`providers.config.js` and implement the web search calls in
`enrichment/EvidenceFinders.js` (each placeholder is annotated with the exact
integration point).

---

## How AI Provider Switching Works

All AI calls in AFIE pass through `utils/AIClient.js`. In V2B, that file
delegates to `providers/ai/AIProviderRegistry.js`, which routes to the
configured provider.

```
callAI() → AIProviderRegistry.dispatchAICall() → AnthropicProvider.complete()
```

Changing `primaryProvider` in `providers.config.js` reroutes all calls.
No calling code changes. No engine changes.

To activate a placeholder provider:
1. Set `enabled: true` in `providers.config.js`
2. Set the required environment variable
3. Install the provider SDK (`npm install openai`, etc.)
4. Replace the `complete()` body in `ProviderPlaceholders.js` — each body
   is pre-annotated with the exact implementation

---

## How Re-analysis Works

Re-analysis is an on-demand capability — it does not run automatically.

```js
import { reanalyseStory } from './reanalysis/ReanalysisEngine.js';

const result = await reanalyseStory({
  storyId:  'story_fed_001',
  watchlist: ['XAUUSD', 'EURUSD', 'USDJPY'],
  providerId: 'openai',    // optional — uses reanalysis.defaultProvider if omitted
  model:      'gpt-4o',    // optional — uses reanalysis.defaultModel if omitted
});
```

The second model receives only the Pass 1 facts from the original story.
The original model's reasoning is deliberately excluded to ensure independence.

Results are stored in `./data/reanalysis/` (separate from V1 StoryStore).
If `autoCompare: true` (default), a comparison object is attached showing
where the two models agree or disagree on asset direction.

---

## Source Intelligence

`SourceRegistry.js` enriches every source with:
- `baseReliabilityScore` — editorial quality (0–1)
- `isOfficial` / `officialBody` — official body classification
- `historicalAccuracy` — updated over time
- `confidenceContribution` — how much this source improves story confidence
- `isPremium` — paid/licensed source flag
- `allowsFullText` — whether full bodies are available
- `health` — collection success/error rates (runtime)

### Set user trust weights

```js
import { setUserTrustWeight } from './sources/SourceRegistry.js';

setUserTrustWeight('forexlive', 0.8);  // reduce trust to 80%
setUserTrustWeight('reuters_markets', 1.2);  // increase trust to 120% of base
```

Trust weights multiply the base score (capped at 1.0 effective score).

---

## Running Tests

```bash
npm test -- tests/v2b/
```

All V2B tests are deterministic — no live API calls, no network.

---

## Extending V2B

### Add a new AI provider

1. Add an entry to `PROVIDERS_CONFIG.ai.registry` in `providers.config.js`
2. Create a class in `providers/ai/ProviderPlaceholders.js` extending `BaseAIProvider`
3. Register the class name in `AIProviderRegistry.ADAPTER_MAP`
4. Set `enabled: true` and provide the API key environment variable

### Add a new news source

1. Add an entry to `SOURCE_REGISTRY` in `config/sources.config.js`
2. Add enriched metadata to `SOURCE_INTELLIGENCE` in `sources/SourceRegistry.js`
3. Add the source id to the appropriate priority group in `providers.config.js`

### Enable web search for enrichment

1. Set `searchProvider: 'web'` in `providers.config.js`
2. In `enrichment/EvidenceFinders.js`, implement the commented-out web search
   blocks inside each finder function. Each block includes the full
   integration specification.

### Add a new enrichment trigger

1. Add the trigger to the `triggers` object in `providers.config.js`
2. Evaluate the trigger in `EnrichmentGatekeeper.js`
3. Map the trigger name to a finder in `EvidenceEnrichmentOrchestrator.js`
