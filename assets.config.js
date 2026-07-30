/**
 * AFIE Asset Configuration
 *
 * Defines every watchlist asset with its:
 *  - Category (for grouping in UI)
 *  - Sensitivity map (which macro events affect it and how strongly)
 *  - Keyword triggers (words in articles that suggest this asset may be relevant)
 *  - Macro relationships (narrative explanations for the reasoning engine)
 *
 * This file is the primary source the AssetMatcher and ImpactAnalyser use.
 * Adding a new asset here requires zero engine code changes.
 */

export const ASSET_REGISTRY = {

  // ── CRYPTO ──────────────────────────────────────────────────────────────

  BTCUSD: {
    symbol: 'BTCUSD',
    name: 'Bitcoin / US Dollar',
    category: 'crypto',
    keywords: [
      'bitcoin', 'btc', 'cryptocurrency', 'crypto', 'digital asset',
      'blockchain', 'coinbase', 'binance', 'crypto etf', 'bitcoin etf',
      'sec crypto', 'cftc bitcoin', 'digital currency', 'stablecoin',
      'tether', 'usdt', 'defi', 'web3', 'blackrock bitcoin', 'ibit',
      'fidelity btc', 'spot bitcoin', 'bitcoin regulation',
      'el salvador bitcoin', 'bitcoin treasury', 'microstrategy',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'medium', direction: 'inverse',  note: 'Rate cuts reduce the opportunity cost of holding non-yielding assets such as BTC, because the returns available from interest-bearing alternatives decrease. Rate hikes have the opposite effect, making yield-bearing assets comparatively more attractive and historically suppressing risk appetite.' },
      inflation_data:            { strength: 'medium', direction: 'variable', note: 'Elevated inflation has historically increased the narrative appeal of BTC as a fixed-supply inflation hedge. However, high inflation can also prompt central bank tightening, which reduces risk appetite — a countervailing force that AFIE monitors for each individual release.' },
      etf_approval:              { strength: 'high',   direction: 'positive', note: 'ETF approvals expand the accessible investor base by creating a regulated, custodied vehicle for institutional capital. Historically, the introduction of ETF structures into asset classes has been associated with significant inflow-driven demand increases.' },
      regulation:                { strength: 'high',   direction: 'negative', note: 'Restrictive regulation reduces the addressable market by limiting the entities and jurisdictions that can hold or trade BTC. Conversely, positive regulatory clarity has historically reduced perceived legal risk, which has been associated with increased institutional participation.' },
      geopolitical_event:        { strength: 'medium', direction: 'variable', note: 'During acute risk-off episodes, BTC has historically sold alongside equities as investors reduce exposure to all risk assets simultaneously. However, a separate and growing body of evidence suggests some market participants treat BTC as a geopolitical hedge in contexts of sovereign financial instability — creating a contested directional dynamic that AFIE assesses case by case.' },
      government_policy:         { strength: 'medium', direction: 'variable', note: 'The direction of impact depends entirely on whether the policy is supportive or restrictive of crypto participation. AFIE assesses each announcement individually against these two opposing outcomes.' },
      trade_agreement:           { strength: 'low',    direction: 'positive', note: 'Reduced trade uncertainty historically supports global risk appetite, which has tended to benefit risk-on assets including BTC. The connection is indirect and typically weaker than for directly correlated assets.' },
      sanctions:                 { strength: 'medium', direction: 'variable', note: 'Sanctions on a major economy can increase crypto demand within the affected jurisdiction as an alternative to restricted banking channels. However, the same event can prompt regulatory backlash in unaffected jurisdictions — creating opposing pressures that AFIE monitors simultaneously.' },
    },
    macroContext: `Bitcoin is primarily a risk-on asset, but its macro reactions are more complex than most risk assets.
    During acute risk-off episodes — geopolitical crises, financial stress, recession fears — BTC has historically sold
    alongside equities as investors seek liquidity and reduce broad risk exposure. However, a distinct and growing body
    of institutional behaviour treats BTC as a hedge against sovereign financial instability, particularly in contexts
    involving currency debasement or capital controls. These two forces can conflict, making directional assessment
    dependent on the specific nature of the macro event rather than a single rule. Regulatory developments and ETF
    flow dynamics are currently the highest-impact structural factors. AFIE assesses each development against both
    the risk-on/risk-off dynamic and the institutional access and regulatory framework simultaneously.`,
  },

  ETHUSD: {
    symbol: 'ETHUSD',
    name: 'Ethereum / US Dollar',
    category: 'crypto',
    keywords: [
      'ethereum', 'eth', 'ether', 'smart contract', 'defi', 'nft',
      'ethereum etf', 'eth etf', 'layer 2', 'polygon', 'arbitrum',
      'ethereum staking', 'ethereum regulation', 'eth burn',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'medium', direction: 'inverse',  note: 'ETH follows BTC\'s rate sensitivity through the same opportunity-cost mechanism, but historically with amplified moves due to higher beta. When rate cut expectations increase, the relative attractiveness of non-yielding crypto assets improves, with ETH typically moving more than BTC in percentage terms.' },
      etf_approval:              { strength: 'high',   direction: 'positive', note: 'ETF approvals create a regulated, custodied vehicle for institutional capital that previously faced barriers to direct ETH exposure. Historically, the expansion of regulated access structures has been associated with sustained inflow-driven demand for the underlying asset.' },
      regulation:                { strength: 'high',   direction: 'negative', note: 'ETH carries additional regulatory complexity compared to BTC because its staking mechanism and smart contract utility raise questions around securities classification in some jurisdictions. Adverse regulatory determinations on these points could restrict institutional participation through a different legal channel than applies to BTC.' },
      geopolitical_event:        { strength: 'medium', direction: 'variable', note: 'ETH has historically followed BTC\'s direction during geopolitical risk events, typically with amplified moves in both directions. The mechanism is broad risk-appetite compression rather than any ETH-specific factor. AFIE monitors BTC\'s initial reaction as a leading indicator for ETH during such events.' },
    },
    macroContext: `Ethereum tends to follow Bitcoin\'s directional moves in response to macro events, but historically with
    higher volatility — amplifying both upside and downside moves relative to BTC. Its unique additional sensitivities
    relate to smart contract regulation, staking economics, and DeFi activity. The securities classification question
    around ETH staking is a persistent regulatory risk that has no direct parallel in the Bitcoin framework.
    Institutional ETF flows are an increasingly significant demand driver, though ETH ETF products have historically
    attracted lower inflows than BTC equivalents, reflecting a smaller institutional consensus around ETH as an
    asset class. AFIE continues to monitor the ETH-to-BTC relative demand dynamic as a secondary signal.`,
  },

  // ── PRECIOUS METALS ─────────────────────────────────────────────────────

  XAUUSD: {
    symbol: 'XAUUSD',
    name: 'Gold / US Dollar',
    category: 'metals',
    keywords: [
      'gold', 'xau', 'precious metal', 'safe haven', 'gold price',
      'gold demand', 'central bank gold', 'gold reserves', 'gold etf',
      'gld', 'comex gold', 'bullion', 'gold mining', 'fed rate',
      'real yields', 'dollar strength', 'geopolitical risk',
      'inflation hedge', 'gold rally', 'gold sell-off',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'high',   direction: 'inverse',  note: 'Gold produces no yield. When interest rates rise, the opportunity cost of holding Gold — measured as the income foregone by not holding interest-bearing instruments — increases, which has historically pressured Gold prices. When rates fall or rate cut expectations rise, this opportunity cost decreases, historically supporting Gold demand through the real yield compression mechanism.' },
      inflation_data:            { strength: 'high',   direction: 'positive', note: 'Gold has historically functioned as a store of value during periods of elevated inflation, because its fixed physical supply means its real purchasing power cannot be diluted by monetary expansion in the way that fiat currency can. High inflation prints have historically increased demand for Gold as a portfolio hedge against currency debasement.' },
      geopolitical_event:        { strength: 'high',   direction: 'positive', note: 'During periods of elevated geopolitical risk, market participants have historically reduced exposure to assets with counterparty risk or geographic concentration and increased allocations to Gold, which has no counterparty, is universally recognised, and is not subject to any single jurisdiction\'s policy. This safe-haven flow mechanism tends to activate rapidly at the onset of crises.' },
      military_event:            { strength: 'high',   direction: 'positive', note: 'Military conflict escalation historically accelerates the safe-haven flow mechanism into Gold, both because of immediate risk-off sentiment and because conflicts can threaten supply chains, currency stability, and economic activity in affected regions. AFIE assesses the geographic proximity of the conflict to major economic zones when weighting this factor.' },
      gdp_data:                  { strength: 'medium', direction: 'variable', note: 'Weak GDP data historically supports Gold through two separate channels: recession fears increase safe-haven demand, and weaker growth reduces the likelihood of further rate hikes, compressing real yields. Strong GDP data can pressure Gold through the reverse mechanism, supporting rate expectations and reducing safe-haven demand simultaneously.' },
      employment_data:           { strength: 'medium', direction: 'inverse',  note: 'Strong employment data historically pressures Gold because it reduces recession fears — diminishing safe-haven demand — and simultaneously increases the probability of sustained or higher interest rates, which raises the opportunity cost of holding Gold. AFIE monitors whether the employment print is sufficient to materially shift rate expectations.' },
      central_bank_speech:       { strength: 'high',   direction: 'variable', note: 'Dovish central bank communications historically support Gold by signalling that real yields may decline, reducing the opportunity cost of holding Gold. Hawkish communications produce the reverse effect. AFIE notes that the market\'s reaction depends not just on the content of the speech but on how far the communication deviates from prior expectations.' },
      trade_agreement:           { strength: 'medium', direction: 'negative', note: 'Reductions in geopolitical and trade uncertainty historically reduce safe-haven demand for Gold, because the risk premium that supports Gold prices during periods of conflict or economic disruption diminishes when a resolution is achieved. AFIE assesses the credibility and durability of each agreement before weighting this factor.' },
      sanctions:                 { strength: 'medium', direction: 'positive', note: 'Sanctions escalate geopolitical uncertainty and can prompt sanctioned economies to increase Gold reserves as a mechanism to reduce dependence on USD-denominated assets and SWIFT-connected financial systems. Both the uncertainty premium and potential reserve diversification flows have historically supported Gold prices during major sanctions events.' },
      government_policy:         { strength: 'medium', direction: 'variable', note: 'Fiscal expansion that raises concerns about long-term sovereign debt sustainability or currency debasement has historically supported Gold as a hedge against those outcomes. Fiscal austerity, conversely, can reduce inflation expectations and long-term currency risk, potentially pressuring Gold. AFIE assesses the scale and credibility of each fiscal development.' },
    },
    macroContext: `Gold is the primary global safe-haven asset and a structural inflation hedge. Its two dominant
    drivers are: (1) real yields — the nominal government bond yield minus inflation expectations — and (2) geopolitical
    and financial system risk. When real yields fall, the opportunity cost of holding a non-yielding asset like Gold
    decreases, which historically supports Gold demand. When geopolitical risk rises, Gold benefits from safe-haven
    flows as investors seek assets without counterparty risk or geographic exposure. Central bank gold buying has become
    a significant and persistent structural demand driver since 2022, as several central banks have accelerated
    de-dollarisation strategies. AFIE monitors both the real yield dynamic and the geopolitical risk premium separately,
    as they can reinforce or offset each other depending on the macro environment.`,
  },

  XAGUSD: {
    symbol: 'XAGUSD',
    name: 'Silver / US Dollar',
    category: 'metals',
    keywords: [
      'silver', 'xag', 'precious metal', 'silver price', 'silver demand',
      'silver etf', 'industrial silver', 'solar panel', 'ev battery silver',
      'silver mining', 'comex silver',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'medium', direction: 'inverse',  note: 'Silver follows the same real-yield opportunity-cost mechanism as Gold but with amplified volatility, because its smaller market and lower liquidity mean price moves are more pronounced for equivalent capital flows. AFIE monitors Silver\'s reaction relative to Gold\'s as an indicator of whether industrial or monetary demand is dominating.' },
      inflation_data:            { strength: 'medium', direction: 'positive', note: 'Silver participates in the Gold inflation-hedge mechanism as a monetary metal, historically showing positive correlation with Gold during elevated inflation. However, if inflation is driven by industrial demand rather than monetary expansion, Silver may outperform Gold due to its industrial demand component.' },
      geopolitical_event:        { strength: 'medium', direction: 'positive', note: 'Silver receives safe-haven flows during geopolitical events through its monetary metal heritage, but historically to a less pronounced degree than Gold. Investors seeking safe-haven exposure have tended to favour Gold over Silver in acute risk-off events, making Silver\'s reaction partially dependent on the scale and nature of the event.' },
      commodity_supply:          { strength: 'high',   direction: 'variable', note: 'As an industrial metal used in solar panels, electric vehicles, semiconductors, and medical equipment, Silver is sensitive to supply disruptions in a way Gold is not. Mine supply contractions, refinery disruptions, or trade restrictions on Silver-producing nations can independently move Silver prices regardless of the monetary metal dynamic.' },
    },
    macroContext: `Silver occupies a unique dual position as both a monetary metal and an industrial commodity. Its monetary
    heritage means it historically correlates with Gold in response to interest rate changes, inflation, and geopolitical
    risk. However, its industrial demand — concentrated in solar panels, electric vehicles, electronics, and medical
    devices — means its price can diverge significantly from Gold when industrial supply-demand factors are dominant.
    Green energy infrastructure expansion represents a long-term structural demand driver that has no equivalent in
    Gold. AFIE assesses whether a given macro event is likely to activate Silver\'s monetary or industrial demand
    character, as the two can produce opposing directional pressures.`,
  },

  // ── FOREX MAJORS ────────────────────────────────────────────────────────

  EURUSD: {
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    category: 'forex',
    keywords: [
      'euro', 'eur', 'european central bank', 'ecb', 'lagarde',
      'eurozone', 'euro area', 'eu inflation', 'eu gdp', 'eu employment',
      'ecb rate', 'federal reserve', 'fed', 'powell', 'dollar',
      'usd', 'us inflation', 'us gdp', 'eu trade', 'germany',
      'france', 'italy', 'european economy', 'eu policy',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'high',   direction: 'variable', note: 'The ECB-Fed interest rate differential is the primary structural driver of EURUSD. When the Fed raises rates relative to the ECB — or signals a slower pace of cuts — USD becomes comparatively higher-yielding, attracting capital flows that historically strengthen USD and pressure EURUSD. The reverse applies when the ECB is more hawkish or the Fed more dovish than market expectations.' },
      inflation_data:            { strength: 'high',   direction: 'variable', note: 'The impact depends on which side of the pair the inflation print is from. EU inflation above expectations may prompt ECB hawkishness, supporting EUR. US inflation above expectations may prompt Fed hawkishness, supporting USD. AFIE assesses each release in the context of the current rate expectations embedded in futures markets.' },
      gdp_data:                  { strength: 'high',   direction: 'variable', note: 'EURUSD responds to the relative growth differential between the EU and US economies. Stronger-than-expected US GDP reduces the probability of Fed cuts and strengthens USD, historically pressuring EURUSD. Stronger EU GDP signals ECB rate resilience, historically supporting EUR. AFIE monitors both economies\' trajectories simultaneously.' },
      central_bank_speech:       { strength: 'high',   direction: 'variable', note: 'Both Fed and ECB communications can move EURUSD by shifting expectations around the future rate differential. A hawkish Fed communication strengthens USD; a hawkish ECB communication strengthens EUR. AFIE assesses each communication against the prior rate path already priced into markets to determine whether a repricing is warranted.' },
      geopolitical_event:        { strength: 'medium', direction: 'variable', note: 'Geopolitical risk events near European borders have historically pressured EUR by raising concerns about European economic disruption and energy security. Simultaneously, USD tends to benefit from safe-haven flows during global risk-off events, compounding the downside pressure on EURUSD. The magnitude depends on the geographic proximity and economic severity of the event.' },
      trade_agreement:           { strength: 'medium', direction: 'variable', note: 'EU-US trade tensions historically create uncertainty that can pressure EUR if European export competitiveness is threatened. Trade agreements that reduce this tension remove the risk premium and may support EUR. AFIE monitors the scope of each trade development and its likely impact on European export volumes.' },
      government_policy:         { strength: 'medium', direction: 'variable', note: 'EU fiscal policy — particularly the German fiscal stance, given Germany\'s structural influence on Eurozone financing conditions — can affect EUR by altering the economic growth and inflation outlook. Expansionary fiscal policy can support growth expectations and indirectly support EUR, while fiscal austerity may have the opposite effect.' },
    },
    macroContext: `EURUSD is primarily determined by the interest rate differential between the ECB and the Federal Reserve.
    When the Fed maintains higher rates or signals a slower path to cuts relative to the ECB, USD earns comparatively
    more yield, attracting capital flows that historically strengthen USD and pressure EURUSD. The reverse applies when
    ECB policy is more hawkish. Risk sentiment provides a secondary influence — EUR has historically behaved as a risk
    currency, tending to weaken in global risk-off environments as USD benefits from safe-haven flows. AFIE monitors
    the rate differential expectations embedded in futures markets as the primary EURUSD indicator, and assesses each
    macro development for its capacity to shift that differential.`,
  },

  GBPUSD: {
    symbol: 'GBPUSD',
    name: 'British Pound / US Dollar',
    category: 'forex',
    keywords: [
      'pound', 'gbp', 'sterling', 'bank of england', 'boe', 'bailey',
      'uk inflation', 'uk gdp', 'uk employment', 'boe rate', 'uk budget',
      'hunt', 'reeves', 'uk economy', 'uk trade', 'brexit legacy',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'high',   direction: 'variable', note: 'GBPUSD responds to the BoE-Fed rate differential through the same capital flow mechanism as other dollar pairs. A BoE rate increase, or signals of a slower pace of cuts relative to the Fed, historically supports GBP by improving the relative yield of sterling-denominated assets. Fed hawkishness produces the reverse. AFIE monitors both central banks\' forward guidance simultaneously.' },
      inflation_data:            { strength: 'high',   direction: 'variable', note: 'UK inflation above expectations historically supports GBP by increasing the probability that the BoE will maintain or raise rates. US inflation above expectations has the opposite effect — increasing the probability of sustained Fed rates — which historically supports USD and pressures GBPUSD. The net direction depends on which economy\'s data is more surprising relative to market expectations.' },
      government_policy:         { strength: 'high',   direction: 'variable', note: 'UK fiscal credibility is an unusually significant driver of GBP relative to other major currencies. The 2022 Truss mini-budget demonstrated that markets can rapidly reprice GBP downward when they perceive UK fiscal policy as unsustainable — a dynamic not typical in most G10 currencies. Unfunded spending commitments or political instability can accelerate this risk premium. Credible fiscal consolidation historically has the opposite effect.' },
      gdp_data:                  { strength: 'medium', direction: 'variable', note: 'UK GDP strength supports GBP by reducing the probability of BoE rate cuts and signalling economic health to international investors. Weakness in UK GDP relative to US GDP compresses the growth differential that helps support capital inflows into sterling-denominated assets. AFIE monitors the UK-US growth differential rather than either figure in isolation.' },
      geopolitical_event:        { strength: 'medium', direction: 'negative', note: 'GBP has historically behaved as a risk-sensitive currency in global risk-off events — not a safe haven. When global risk appetite deteriorates, capital tends to flow toward USD and JPY, reducing demand for sterling. The magnitude depends on whether the geopolitical event has a direct economic impact on the UK.' },
    },
    macroContext: `GBP is sensitive to both BoE monetary policy and UK fiscal credibility — a combination that makes it
    unusually reactive to political events relative to other G10 currencies. The 2022 Truss mini-budget collapse
    demonstrated that GBP can reprice sharply and rapidly when fiscal credibility is questioned by bond markets.
    UK-specific data — CPI, labour market, and GDP — is highly market-moving because of its direct implications
    for BoE rate decisions. GBP behaves as a risk currency in global risk-off events, tending to weaken as USD
    and JPY attract safe-haven flows. AFIE continues to monitor the post-Brexit structural trade dynamics as a
    slow-moving but persistent fundamental factor.`,
  },

  GBPJPY: {
    symbol: 'GBPJPY',
    name: 'British Pound / Japanese Yen',
    category: 'forex',
    keywords: [
      'pound yen', 'gbpjpy', 'carry trade', 'yen', 'bank of japan',
      'boj', 'ueda', 'yen intervention', 'japan inflation', 'japan gdp',
      'boe', 'uk rate', 'risk sentiment', 'carry unwind',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'high',   direction: 'variable', note: 'GBPJPY is acutely sensitive to rate differential changes because the pair is a primary carry trade vehicle. A BoE rate increase widens the differential favouring GBP over the low-yielding JPY, historically attracting carry trade inflows. A BoJ rate increase compresses the differential from the other direction, potentially triggering rapid carry trade unwinding and sharp GBPJPY declines. AFIE assesses each central bank decision for its impact on the differential, not in isolation.' },
      central_bank_speech:       { strength: 'high',   direction: 'variable', note: 'BoJ communications are disproportionately impactful on GBPJPY because any credible signal of normalisation suggests the extremely wide BoJ-BoE rate differential may narrow. Historically, even a shift in BoJ language — without a rate move — has caused rapid JPY appreciation as carry positions are partially unwound in anticipation of a reduced differential. AFIE is monitoring the BoJ\'s communications for evidence of accelerating normalisation intent.' },
      geopolitical_event:        { strength: 'high',   direction: 'negative', note: 'Risk-off events are particularly damaging for GBPJPY because both components of the pair move in the same unfavourable direction simultaneously. JPY strengthens as a safe-haven currency, while GBP weakens as a risk-sensitive currency, producing amplified downside moves. Historically, GBPJPY carry trade positions are among the first to be unwound during global risk-off episodes, because the loss from JPY appreciation can quickly exceed the accumulated carry income.' },
      government_policy:         { strength: 'medium', direction: 'variable', note: 'UK fiscal credibility concerns pressure the GBP component of the pair downward. Separately, concerns about Japan\'s fiscal sustainability — given its large debt-to-GDP ratio — could in theory weaken JPY, but historically the BoJ\'s yield curve control policies have dominated JPY direction more than fiscal factors. AFIE assesses both components independently.' },
    },
    macroContext: `GBPJPY is historically one of the most volatile major currency pairs because it combines two opposing
    sensitivity profiles. GBP is a risk-sensitive, carry-recipient currency. JPY is a safe-haven, carry-funding currency.
    The pair thrives in risk-on environments when the wide BoJ-BoE rate differential makes the GBP-over-JPY carry trade
    highly attractive. In risk-off environments, this dynamic reverses sharply — JPY strengthens as a safe haven while
    GBP weakens as a risk currency, producing amplified downside moves. BoJ policy normalisation represents the most
    significant structural risk to GBPJPY, because any sustained reduction in the rate differential removes the
    fundamental carry trade incentive that has historically supported the pair. AFIE continues to monitor BoJ
    communications as the primary structural risk factor for this pair.`,
  },

  USDJPY: {
    symbol: 'USDJPY',
    name: 'US Dollar / Japanese Yen',
    category: 'forex',
    keywords: [
      'yen', 'usdjpy', 'dollar yen', 'bank of japan', 'boj', 'ueda',
      'yen intervention', 'japan rate', 'japan inflation', 'shunto',
      'japanese wage', 'boj policy', 'carry trade', 'yen weakness',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'high',   direction: 'variable', note: 'The Fed-BoJ rate differential is the primary structural driver of USDJPY. The extremely wide differential that developed during the Fed\'s 2022-2023 tightening cycle — while the BoJ maintained near-zero rates — produced historically large USDJPY appreciation. Any narrowing of this differential, whether through Fed cuts or BoJ hikes, removes the fundamental basis for this positioning and has historically triggered significant JPY appreciation. AFIE monitors both sides of the differential.' },
      central_bank_speech:       { strength: 'high',   direction: 'variable', note: 'BoJ communications are exceptionally impactful on USDJPY because markets have been anticipating normalisation for an extended period. Any language shift — even without a rate action — that suggests the BoJ is moving closer to reducing accommodation can trigger significant positioning adjustments in carry trades funded by JPY. AFIE is monitoring BoJ Governor Ueda\'s communications for evidence of accelerating or decelerating normalisation intent.' },
      geopolitical_event:        { strength: 'high',   direction: 'negative', note: 'JPY historically strengthens during geopolitical risk events through the safe-haven mechanism, as investors reduce carry trade positions and seek assets perceived as low-risk. Because USDJPY is one of the world\'s most liquid carry trade pairs, risk-off events cause rapid JPY appreciation as positions are unwound, historically pushing USDJPY lower regardless of the geographical origin of the risk event.' },
      employment_data:           { strength: 'medium', direction: 'positive', note: 'Strong US employment data historically supports USD by reducing the probability of near-term Fed rate cuts, maintaining the rate differential that supports USDJPY upside. Weak employment data increases the probability of Fed cuts, narrowing the expected future differential and historically pressuring USDJPY lower. AFIE assesses each jobs report against current market rate expectations to determine whether a repricing is warranted.' },
    },
    macroContext: `USDJPY is driven by one of the widest sustained interest rate differentials in modern G10 currency
    history, created by the divergence between the Fed\'s aggressive 2022-2023 tightening cycle and the BoJ\'s
    prolonged near-zero rate policy. This differential made JPY one of the world\'s primary carry trade funding
    currencies, creating deep positioning that is sensitive to any credible signal of convergence. JPY also functions
    as a global safe-haven currency — during acute risk-off events, carry trade unwinding and safe-haven demand
    combine to produce rapid JPY appreciation. AFIE monitors the BoJ\'s normalisation path as the primary structural
    risk factor for USDJPY, and the Fed\'s rate cut timeline as the secondary factor, assessing both simultaneously.`,
  },

  AUDUSD: {
    symbol: 'AUDUSD',
    name: 'Australian Dollar / US Dollar',
    category: 'forex',
    keywords: [
      'australian dollar', 'aud', 'aussie', 'rba', 'reserve bank australia',
      'china trade', 'iron ore', 'copper', 'australia', 'australia china',
      'commodity', 'chinese demand', 'rba rate',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'high',   direction: 'variable', note: 'AUDUSD responds to the RBA-Fed rate differential through the standard capital flow mechanism. However, unlike most dollar pairs, AUDUSD carries a significant secondary sensitivity to Chinese economic conditions — because Australia\'s export revenue depends heavily on Chinese commodity demand, which in turn affects Australian economic growth and RBA rate expectations. AFIE monitors both the rate differential and the China growth outlook simultaneously.' },
      trade_agreement:           { strength: 'high',   direction: 'positive', note: 'AUD is particularly sensitive to US-China trade tensions because China is Australia\'s largest trading partner for iron ore, coal, and agricultural exports. When US-China trade friction increases, markets historically anticipate reduced Chinese economic activity and lower commodity demand, which pressures AUD even without any direct Australia-specific economic news. AFIE assesses China growth implications as a primary channel for US-China trade developments on AUDUSD.' },
      commodity_supply:          { strength: 'high',   direction: 'positive', note: 'AUD has historically behaved as a proxy for commodity — particularly iron ore and copper — price dynamics because Australian export revenue and government fiscal receipts are directly tied to commodity prices. Rising iron ore prices have historically supported AUD through improved terms of trade and stronger Australian growth expectations. The mechanism is particularly direct and has historically produced strong correlations.' },
      geopolitical_event:        { strength: 'medium', direction: 'negative', note: 'AUD has historically underperformed in global risk-off events for two compounding reasons: it is a high-beta risk currency that weakens as risk appetite falls, and risk-off events that reduce global growth expectations simultaneously reduce commodity demand — the foundation of Australian export revenue. AFIE assesses whether a given geopolitical event is likely to reduce Chinese growth expectations, as this doubles the typical risk-off pressure on AUD.' },
      sanctions:                 { strength: 'medium', direction: 'negative', note: 'Sanctions on or involving China — Australia\'s primary commodity export destination — can reduce Chinese economic activity and commodity demand through multiple channels simultaneously: reduced industrial production, financial market stress, and supply chain disruption. AFIE is monitoring whether China-related sanctions developments are likely to materially reduce iron ore or coal import volumes.' },
    },
    macroContext: `The Australian Dollar functions as a hybrid currency — it responds to RBA monetary policy like most
    developed-market currencies, but carries an unusually direct exposure to Chinese economic conditions through
    Australia\'s commodity export dependency. When Chinese growth expectations deteriorate — whether from trade
    friction, domestic policy tightening, or global demand weakness — AUD historically weakens even when Australian
    domestic data is stable, because markets are pricing the future impact on Australian export revenue. AUD also
    behaves as a high-beta risk currency in global risk-off events, weakening as risk appetite falls and strengthening
    as it recovers. AFIE monitors Chinese PMI, iron ore demand, and US-China trade developments as primary
    indicators for AUDUSD, in addition to the standard RBA-Fed rate differential framework.`,
  },

  // ── INDICES ─────────────────────────────────────────────────────────────

  NAS100: {
    symbol: 'NAS100',
    name: 'NASDAQ 100',
    category: 'indices',
    keywords: [
      'nasdaq', 'tech stocks', 'technology', 'semiconductor', 'chip',
      'nvidia', 'apple', 'microsoft', 'meta', 'alphabet', 'google',
      'amazon', 'ai stocks', 'growth stocks', 'fed rate tech',
      'us china chip', 'export controls', 'semiconductor export',
      'tech regulation', 'antitrust', 'big tech',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'high',   direction: 'inverse',  note: 'Technology stocks are long-duration growth assets whose valuations depend heavily on discounted future cash flows. When interest rates rise, the discount rate applied to future earnings increases, mechanically reducing the present value of those earnings and compressing valuation multiples. The reverse applies when rates fall — a lower discount rate increases the present value of future growth, historically supporting technology stock valuations disproportionately relative to value stocks.' },
      inflation_data:            { strength: 'high',   direction: 'variable', note: 'Inflation data affects NAS100 primarily through its implications for rate expectations rather than through any direct impact on technology earnings. Higher-than-expected inflation increases the probability of sustained or higher rates, which raises the discount rate applied to future technology earnings and compresses multiples. Lower inflation prints reduce this pressure. AFIE assesses each CPI or PCE release for its capacity to shift the market\'s rate path expectations.' },
      regulation:                { strength: 'high',   direction: 'negative', note: 'Antitrust, data privacy, and AI regulation directly target the largest NAS100 constituents — which together represent a disproportionate share of index weighting. Adverse regulatory outcomes can reduce addressable market sizes, impose compliance costs, or force structural changes in business models, all of which compress earnings expectations and valuations for the affected entities.' },
      trade_agreement:           { strength: 'high',   direction: 'negative', note: 'US semiconductor and chip design software export controls directly reduce the total addressable market for major NAS100 constituents by restricting their ability to sell to Chinese entities. The mechanism is a reduction in forward revenue estimates, which at current valuation multiples produces amplified index-level price impact. AFIE is monitoring the scope and enforceability of each export control announcement.' },
      central_bank_speech:       { strength: 'high',   direction: 'variable', note: 'Fed communications that shift rate expectations have an amplified impact on NAS100 relative to broader indices, because technology companies carry higher duration risk — their valuations are more sensitive to the discount rate than companies with nearer-term earnings. A dovish communication that reduces expected rates historically produces disproportionate NAS100 outperformance.' },
      geopolitical_event:        { strength: 'medium', direction: 'negative', note: 'Acute risk-off events historically reduce equity exposure broadly, with NAS100 often experiencing amplified declines because its high growth multiples make it more vulnerable to sentiment-driven repricing. AFIE also assesses whether the specific geopolitical event has technology supply chain implications — semiconductor manufacturing concentration in Taiwan is a persistent structural factor.' },
      corporate_announcement:    { strength: 'medium', direction: 'variable', note: 'Because the NAS100 is highly concentrated, earnings or guidance from the largest constituents — particularly the five to seven largest by weighting — can produce index-level moves. AFIE assesses major constituent announcements for both their direct weighting impact and their signal value about broader technology sector conditions.' },
    },
    macroContext: `The NASDAQ 100 is dominated by large-cap technology and growth companies, making it distinctly more
    sensitive to interest rate dynamics than the broader market. Because technology valuations rely heavily on
    discounted future earnings — often many years out — even modest changes in the discount rate produce amplified
    multiple compression or expansion. The index also carries unique exposure to US-China technology policy: major
    semiconductor and chip software companies derive significant revenue from Chinese markets, making export control
    escalations a direct earnings risk. AI infrastructure spending, which underpins several major constituents,
    has become a structural demand driver that partially offsets macro headwinds. AFIE is monitoring US-China
    technology policy developments as the primary idiosyncratic risk factor, alongside the standard rate sensitivity framework.`,
  },

  US30: {
    symbol: 'US30',
    name: 'Dow Jones Industrial Average',
    category: 'indices',
    keywords: [
      'dow jones', 'dow', 'us30', 'us equities', 'us stocks',
      'industrial stocks', 'boeing', 'caterpillar', 'jpmorgan',
      'american economy', 'us growth', 'us recession',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'high',   direction: 'variable', note: 'The Dow responds to rate changes through the standard equity valuation mechanism — lower rates reduce discount rates and support prices — but is less rate-sensitive than NAS100 because its constituents are more mature companies with nearer-term earnings rather than long-duration growth assets. The more significant channel for the Dow is the economic growth signal embedded in rate decisions: rate cuts during growth slowdowns can be negative if they signal deteriorating economic conditions.' },
      gdp_data:                  { strength: 'high',   direction: 'positive', note: 'The Dow\'s constituents — industrial, financial, and consumer companies — are more directly exposed to the pace of US economic activity than technology growth companies. Strong GDP data historically supports Dow components through the earnings mechanism: higher economic activity drives revenue growth for industrials, improves loan performance for banks, and increases consumer spending. AFIE monitors the Dow\'s reaction to GDP data as a proxy for broad US corporate earnings health.' },
      employment_data:           { strength: 'high',   direction: 'positive', note: 'Strong employment historically supports the Dow through two mechanisms: it signals sustained consumer spending capacity (supporting consumer-facing companies) and indicates healthy underlying economic activity (reducing recession risk for industrials and financials). AFIE monitors whether employment strength also raises rate expectations enough to create a countervailing valuation headwind.' },
      geopolitical_event:        { strength: 'high',   direction: 'negative', note: 'Geopolitical events pressure the Dow through risk-off equity selling and, for events involving trade disruptions, through direct revenue impacts on industrial companies with significant global supply chains or export exposure. AFIE assesses whether a given geopolitical event has specific implications for major Dow industrial constituents beyond the general risk-off effect.' },
      trade_agreement:           { strength: 'high',   direction: 'positive', note: 'US-China trade tensions directly affect Dow industrial companies through two channels: higher input costs from tariffs on imported components, and reduced revenue from restricted access to Chinese markets. AFIE assesses each trade development for its specific tariff scope and the revenue exposure of major Dow constituents to the affected trade flows.' },
    },
    macroContext: `The Dow Jones Industrial Average is a price-weighted index of 30 large-cap US companies spanning
    industrial, financial, consumer, and healthcare sectors. Unlike NAS100, it is more sensitive to broad economic
    growth conditions and trade policy than to interest rate dynamics, because its constituents earn more immediate,
    cyclical revenues rather than long-duration growth premiums. Trade policy — particularly US-China relations —
    has a direct earnings impact on Dow industrial companies through tariff costs and market access. AFIE monitors
    the Dow primarily as an indicator of broad US corporate earnings health rather than as a technology or
    growth-sentiment vehicle.`,
  },

  SPX500: {
    symbol: 'SPX500',
    name: 'S&P 500',
    category: 'indices',
    keywords: [
      's&p 500', 'spx', 'sp500', 'us equities', 'us stocks', 's&p',
      'american economy', 'us corporate', 'earnings season',
    ],
    sensitivity: {
      interest_rate_decision:    { strength: 'high',   direction: 'variable', note: 'The S&P 500 responds to rate changes through two simultaneous mechanisms: lower rates reduce the discount rate applied to future earnings, directly supporting valuations; and rate changes signal the Fed\'s assessment of economic conditions, affecting corporate earnings expectations. These two mechanisms can reinforce or offset each other — a rate cut that signals recession concern is not necessarily positive for equities, even though lower rates mechanically support valuations. AFIE assesses both channels for each rate decision.' },
      inflation_data:            { strength: 'high',   direction: 'variable', note: 'Inflation data affects the S&P primarily through its implications for Fed rate expectations and secondarily through its direct impact on corporate profit margins — particularly for companies with significant input costs. Higher inflation historically creates the dual headwind of higher discount rates and margin compression. AFIE monitors whether the inflation print is demand-driven (which preserves revenue) or cost-driven (which compresses margins).' },
      gdp_data:                  { strength: 'high',   direction: 'positive', note: 'Economic growth directly supports S&P earnings through the revenue mechanism — stronger economic activity drives higher corporate revenues broadly across sectors. The S&P\'s breadth means GDP strength is more uniformly positive than for sector-specific indices. AFIE monitors whether GDP strength also shifts rate expectations enough to create a countervailing valuation headwind.' },
      employment_data:           { strength: 'high',   direction: 'variable', note: 'Strong employment creates a dual dynamic for the S&P: it supports consumer spending and growth expectations (positive for earnings), but also increases the probability of sustained or higher rates (negative for valuations through higher discount rates). The net direction depends on which effect dominates, which in turn depends on the current rate environment. AFIE assesses employment data in the context of current rate expectations.' },
      geopolitical_event:        { strength: 'high',   direction: 'negative', note: 'Risk-off events historically reduce broad equity exposure across all S&P sectors simultaneously, as investors shift to safe-haven assets. The magnitude depends on the severity of the event and its economic implications. Supply chain disruptions from geopolitical events can also create sector-specific headwinds on top of the general risk-off pressure. AFIE assesses each event for both its sentiment impact and its specific economic transmission channels.' },
      corporate_announcement:    { strength: 'medium', direction: 'variable', note: 'Earnings and guidance from large S&P constituents can produce index-level moves, particularly during earnings seasons when sector sentiment is being repriced. AFIE monitors constituent announcements for their signal value about sector-wide earnings trends, not only their direct weighting impact.' },
    },
    macroContext: `The S&P 500 is the broadest and most widely referenced measure of US large-cap equity performance,
    spanning 11 sectors with approximately 500 constituents. Its breadth means it is sensitive to virtually all
    macro factors, but responds primarily to: Fed monetary policy (through the discount rate and economic signal
    mechanisms), US corporate earnings growth (through GDP and employment conditions), and global risk sentiment
    (through capital flow dynamics during risk-on/risk-off transitions). Technology companies now represent a
    disproportionate weighting, meaning the S&P has partially inherited the NAS100\'s sensitivity to rate dynamics
    and US-China technology policy. AFIE monitors the S&P 500 as the broadest indicator of US equity market health
    and uses sectoral divergence within the index as a signal of which macro factors are currently dominant.`,
  },

  // ── ENERGY ──────────────────────────────────────────────────────────────

  OIL: {
    symbol: 'OIL',
    name: 'Crude Oil (WTI)',
    category: 'energy',
    keywords: [
      'oil', 'crude', 'wti', 'brent', 'opec', 'opec+', 'saudi',
      'oil production', 'oil supply', 'oil demand', 'barrel', 'eia',
      'us oil inventory', 'russia oil', 'iran oil', 'venezuela oil',
      'energy', 'petroleum', 'oil price', 'oil sanction',
    ],
    sensitivity: {
      geopolitical_event:        { strength: 'high',   direction: 'positive', note: 'Geopolitical events in or near major oil-producing regions historically add a risk premium to oil prices because market participants price in the possibility of supply disruption. The Middle East — which accounts for a significant share of global oil transit through the Strait of Hormuz — is particularly sensitive. AFIE assesses each event for its geographic proximity to production infrastructure and transit chokepoints.' },
      military_event:            { strength: 'high',   direction: 'positive', note: 'Military conflict near oil-producing regions or transit routes historically produces immediate and sharp oil price reactions because the supply disruption risk becomes concrete rather than theoretical. The Strait of Hormuz, through which approximately 20% of global oil trade passes, is the most significant geographic risk concentration that AFIE monitors.' },
      sanctions:                 { strength: 'high',   direction: 'positive', note: 'Sanctions on oil-producing nations directly reduce the volume of oil available to global markets by restricting the sanctioned nation\'s ability to export, receive payment, or access shipping insurance. The magnitude of the supply impact depends on the size of the sanctioned country\'s production, the availability of sanction-exempt buyers, and the effectiveness of enforcement. AFIE monitors each sanctions package for its realistic supply reduction estimate.' },
      government_policy:         { strength: 'high',   direction: 'variable', note: 'OPEC+ production decisions are among the most direct and quantifiable drivers of oil prices, because they announce specific changes to the collective output of countries representing a large share of global supply. Production cuts reduce supply and historically support prices; production increases have the opposite effect. AFIE assesses each OPEC+ announcement against current inventory levels and demand forecasts to determine the likely price impact.' },
      commodity_supply:          { strength: 'high',   direction: 'variable', note: 'Supply disruptions — whether from pipeline incidents, refinery outages, extreme weather affecting production infrastructure, or unexpected production shortfalls — directly reduce the available supply of oil, historically producing price increases proportional to the scale of the disruption and the tightness of existing inventory buffers. AFIE monitors US EIA inventory reports as a weekly indicator of the supply-demand balance.' },
      gdp_data:                  { strength: 'medium', direction: 'positive', note: 'Oil demand is fundamentally driven by economic activity — industrial production, transportation, and manufacturing all require energy. Strong GDP data historically increases oil demand expectations and supports prices. Recession fears produce the opposite effect by reducing the growth outlook for oil-consuming activity. AFIE monitors global PMI data alongside GDP releases as a higher-frequency demand signal.' },
      trade_agreement:           { strength: 'medium', direction: 'negative', note: 'US-China trade tensions historically reduce global oil demand expectations through two mechanisms: they directly reduce trade-related transportation activity, and they signal potential deterioration in Chinese industrial production — China being the world\'s largest oil importer. AFIE assesses each trade development for its implied impact on Chinese economic activity, which is the primary transmission channel to oil demand.' },
    },
    macroContext: `Oil pricing is determined by the interaction of three primary forces: OPEC+ production decisions
    (supply management), global economic activity (demand), and geopolitical risk premiums (supply disruption
    probability). China is the world\'s largest oil importer, making Chinese economic conditions a critical demand
    variable. The Middle East and Russia are the dominant supply regions, making geopolitical developments in those
    areas the primary acute price catalysts. AFIE monitors supply-demand balance indicators — including US EIA
    inventory data, OPEC+ compliance rates, and Chinese import volumes — alongside geopolitical developments when
    assessing the directional balance for oil prices.`,
  },

  NATGAS: {
    symbol: 'NATGAS',
    name: 'Natural Gas',
    category: 'energy',
    keywords: [
      'natural gas', 'natgas', 'lng', 'gas pipeline', 'gas supply',
      'russia gas', 'european gas', 'gas price', 'gas inventory',
      'winter gas', 'gas demand', 'nord stream', 'gazprom',
    ],
    sensitivity: {
      geopolitical_event:        { strength: 'high',   direction: 'positive', note: 'European natural gas markets are particularly sensitive to Russia-Europe geopolitical developments because Russia has historically been the primary pipeline gas supplier to Europe. Geopolitical deterioration raises the probability of supply disruption or politically motivated flow reductions, adding a risk premium to European gas prices. AFIE monitors the Russo-European political relationship as a primary structural variable for European gas pricing.' },
      military_event:            { strength: 'high',   direction: 'positive', note: 'Military conflict threatening pipeline infrastructure — whether in Ukraine, the Baltic region, or the Middle East — historically produces immediate gas price reactions because pipeline gas cannot be rapidly rerouted the way seaborne LNG cargoes can. Physical infrastructure damage introduces supply disruptions that cannot be offset in the short term regardless of global LNG availability. AFIE assesses the geographic proximity of military events to major pipeline routes.' },
      commodity_supply:          { strength: 'high',   direction: 'variable', note: 'Natural gas supply is sensitive to storage inventory levels (which reflect the balance between prior production and prior demand), LNG terminal availability (which determines import capacity), and pipeline flows. Unusually low storage heading into winter historically creates a structural price support, while high storage reduces weather-driven demand risk. AFIE monitors European gas storage utilisation rates as a leading indicator of seasonal price sensitivity.' },
      government_policy:         { strength: 'medium', direction: 'variable', note: 'European energy policy decisions — including LNG import agreements, pipeline investment decisions, and renewable energy transition timelines — affect the structural demand and supply balance for natural gas on a multi-year horizon. US LNG export policy decisions can affect global LNG supply availability. AFIE assesses policy announcements for their likely impact on medium-term supply-demand balance.' },
    },
    macroContext: `Natural gas markets are highly regional in their pricing dynamics — European TTF prices and US
    Henry Hub prices can diverge substantially because natural gas is expensive and slow to transport across oceans
    (requiring liquefaction infrastructure). European prices are structurally influenced by the availability of
    Russian pipeline gas, LNG import alternatives, and seasonal storage levels heading into winter demand periods.
    US Henry Hub prices are more influenced by domestic shale production volumes, weather-driven demand, and LNG
    export terminal capacity. AFIE monitors European storage utilisation rates, Russian supply flow volumes, and
    LNG terminal availability as the primary European gas price indicators, and US production data alongside
    weather forecasts for the Henry Hub market.`,
  },

};

/**
 * Returns an array of all watchlist symbols.
 */
export function getAllSymbols() {
  return Object.keys(ASSET_REGISTRY);
}

/**
 * Returns a flat array of all keywords across all assets.
 * Used for quick initial filtering before detailed matching.
 */
export function getAllKeywords() {
  const kwMap = {};
  for (const [sym, asset] of Object.entries(ASSET_REGISTRY)) {
    for (const kw of asset.keywords) {
      if (!kwMap[kw]) kwMap[kw] = [];
      kwMap[kw].push(sym);
    }
  }
  return kwMap;
}

/**
 * Given an article's body text, returns a preliminary set of potentially
 * affected symbols. Used as a fast first-pass filter before AI reasoning.
 */
export function quickSymbolScan(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const kwMap = getAllKeywords();
  const hits = new Set();
  for (const [kw, symbols] of Object.entries(kwMap)) {
    if (lower.includes(kw)) {
      symbols.forEach(s => hits.add(s));
    }
  }
  return [...hits];
}
