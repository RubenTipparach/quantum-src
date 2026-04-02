import type { ResearchNode } from '../research/ResearchTree';

export interface NewsEvent {
  id: number;
  headline: string;
  category: 'world' | 'company' | 'ceo' | 'market' | 'research' | 'sector';
  /** Which stock symbols are affected. Empty = all stocks. */
  targets: string[];
  /** Price impact multiplier per tick. Positive = bullish, negative = bearish. */
  impact: number;
  /** How many ticks this event influences prices */
  duration: number;
  /** Ticks remaining */
  remaining: number;
  /** Tick number when event was created */
  createdAt: number;
}

type HeadlineTemplate = { headline: string; impact: [number, number] };

// ────────────────────────────────────────────────────────────
//  WORLD EVENTS — affect ALL stocks
// ────────────────────────────────────────────────────────────

const WORLD_EVENTS_NEGATIVE: HeadlineTemplate[] = [
  { headline: 'Armed conflict erupts between {country1} and {country2} — global markets shaken', impact: [-0.04, -0.12] },
  { headline: 'Pandemic outbreak reported in {country1} — WHO declares emergency', impact: [-0.05, -0.15] },
  { headline: 'Regime change in {country1} sparks political instability across the region', impact: [-0.03, -0.08] },
  { headline: 'Major earthquake devastates {country1} — supply chains disrupted', impact: [-0.03, -0.10] },
  { headline: 'Trade embargo imposed on {country1} — international commerce frozen', impact: [-0.04, -0.09] },
  { headline: 'Global recession fears mount as {country1} defaults on sovereign debt', impact: [-0.06, -0.14] },
  { headline: 'Cyberattack cripples {country1} banking infrastructure', impact: [-0.03, -0.08] },
  { headline: 'Oil crisis: {country1} halts exports — energy prices surge', impact: [-0.04, -0.10] },
  { headline: 'Currency collapse in {country1} triggers market panic', impact: [-0.05, -0.12] },
  { headline: 'Mass protests erupt in {country1} — government declares martial law', impact: [-0.02, -0.07] },
];

const WORLD_EVENTS_POSITIVE: HeadlineTemplate[] = [
  { headline: 'Historic peace deal signed between {country1} and {country2}', impact: [0.03, 0.08] },
  { headline: '{country1} announces massive economic stimulus package', impact: [0.04, 0.10] },
  { headline: 'Global trade agreement ratified — markets rally', impact: [0.03, 0.09] },
  { headline: 'Breakthrough vaccine eliminates pandemic threat — economy surges', impact: [0.05, 0.12] },
  { headline: '{country1} opens borders to free trade — investor confidence soars', impact: [0.03, 0.08] },
  { headline: 'Central banks coordinate rate cuts — liquidity floods markets', impact: [0.04, 0.10] },
];

// ────────────────────────────────────────────────────────────
//  CEO EVENTS — affect one company
// ────────────────────────────────────────────────────────────

const CEO_BOASTS: HeadlineTemplate[] = [
  { headline: '{company} CEO: "We will dominate the market within 2 years"', impact: [0.02, 0.06] },
  { headline: '{company} CEO promises "revolutionary product" at upcoming keynote', impact: [0.03, 0.08] },
  { headline: '{company} CEO: "Revenue will triple by next quarter"', impact: [0.04, 0.10] },
  { headline: '{company} CEO boasts record-breaking pre-orders', impact: [0.02, 0.07] },
  { headline: '{company} CEO tweets: "Our competitors are finished"', impact: [0.01, 0.05] },
  { headline: '{company} CEO announces aggressive expansion into new markets', impact: [0.03, 0.07] },
];

const CEO_GAFFES: HeadlineTemplate[] = [
  { headline: '{company} CEO caught in accounting scandal — shares plummet', impact: [-0.05, -0.12] },
  { headline: '{company} CEO makes controversial remarks — boycott trending', impact: [-0.03, -0.08] },
  { headline: '{company} CEO abruptly resigns — no successor named', impact: [-0.06, -0.14] },
  { headline: '{company} CEO admits product delays — investors spooked', impact: [-0.03, -0.07] },
  { headline: '{company} CEO under investigation for insider trading', impact: [-0.04, -0.10] },
];

// ────────────────────────────────────────────────────────────
//  COMPANY EVENTS — affect one company
// ────────────────────────────────────────────────────────────

const COMPANY_EVENTS_POSITIVE: HeadlineTemplate[] = [
  { headline: '{company} reports earnings beating expectations by 40%', impact: [0.04, 0.12] },
  { headline: '{company} secures massive government contract', impact: [0.05, 0.10] },
  { headline: '{company} announces strategic partnership with industry giant', impact: [0.03, 0.08] },
  { headline: 'Analysts upgrade {company} stock to "strong buy"', impact: [0.02, 0.06] },
  { headline: '{company} patent approved for breakthrough technology', impact: [0.03, 0.09] },
  { headline: '{company} acquires key competitor — market share doubles', impact: [0.05, 0.12] },
];

const COMPANY_EVENTS_NEGATIVE: HeadlineTemplate[] = [
  { headline: '{company} misses earnings — revenue down 30%', impact: [-0.05, -0.12] },
  { headline: '{company} issues product recall after critical defect found', impact: [-0.04, -0.09] },
  { headline: '{company} loses major lawsuit — $2B in damages', impact: [-0.06, -0.14] },
  { headline: 'Analysts downgrade {company} to "sell" — outlook grim', impact: [-0.03, -0.07] },
  { headline: '{company} data breach exposes millions of customer records', impact: [-0.04, -0.10] },
  { headline: '{company} factory fire halts production for weeks', impact: [-0.03, -0.08] },
];

// ────────────────────────────────────────────────────────────
//  MARKET-WIDE EVENTS — affect all stocks
// ────────────────────────────────────────────────────────────

const MARKET_EVENTS: HeadlineTemplate[] = [
  { headline: 'Massive sell-off triggered by algorithmic trading bots', impact: [-0.06, -0.15] },
  { headline: 'Institutional investors pile into tech stocks — buying frenzy', impact: [0.05, 0.12] },
  { headline: 'Market flash crash — exchanges halt trading briefly', impact: [-0.08, -0.18] },
  { headline: 'Retail investors rally — meme stock mania spreads', impact: [0.04, 0.10] },
  { headline: 'Hedge fund liquidation triggers cascade of sell orders', impact: [-0.05, -0.12] },
  { headline: 'Record inflows into index funds — broad market rally', impact: [0.03, 0.08] },
];

// ────────────────────────────────────────────────────────────
//  SECTOR EVENTS — affect all stocks in a sector
// ────────────────────────────────────────────────────────────

type SectorEventTemplate = HeadlineTemplate & { sectors: string[] };

const SECTOR_EVENTS: SectorEventTemplate[] = [
  // Oil & Energy
  { headline: 'OPEC slashes production quotas — oil prices skyrocket', sectors: ['oil', 'energy'], impact: [0.05, 0.12] },
  { headline: 'Major oil spill triggers environmental catastrophe — fossil fuel stocks tank', sectors: ['oil'], impact: [-0.06, -0.14] },
  { headline: 'Renewable energy subsidies doubled by G7 nations', sectors: ['energy'], impact: [0.04, 0.10] },
  { headline: 'New pipeline construction greenlit — energy sector rallies', sectors: ['oil', 'energy'], impact: [0.03, 0.08] },
  { headline: 'Carbon tax legislation passed — fossil fuel companies face massive costs', sectors: ['oil'], impact: [-0.05, -0.12] },
  { headline: 'Oil reserves discovered in {country1} — global supply outlook shifts', sectors: ['oil', 'energy'], impact: [-0.03, -0.07] },

  // Finance
  { headline: 'Federal Reserve raises interest rates — banking stocks surge', sectors: ['finance'], impact: [0.04, 0.10] },
  { headline: 'Major bank stress test failures — financial sector shaken', sectors: ['finance'], impact: [-0.05, -0.12] },
  { headline: 'Cryptocurrency regulation announced — traditional finance benefits', sectors: ['finance', 'crypto'], impact: [0.03, -0.06] },
  { headline: 'Global lending crisis: defaults spike across commercial real estate', sectors: ['finance'], impact: [-0.04, -0.10] },
  { headline: 'Fintech deregulation wave — banking sector poised for growth', sectors: ['finance'], impact: [0.03, 0.08] },

  // Medical / Biotech
  { headline: 'FDA fast-tracks approval for revolutionary gene therapy', sectors: ['medical'], impact: [0.05, 0.14] },
  { headline: 'Clinical trial disaster: major drug fails Phase III — biotech sells off', sectors: ['medical'], impact: [-0.06, -0.15] },
  { headline: 'Global health initiative announces $50B fund for biotech research', sectors: ['medical'], impact: [0.04, 0.10] },
  { headline: 'Patent cliff hits pharmaceutical giants — generic competition looms', sectors: ['medical'], impact: [-0.03, -0.08] },
  { headline: 'CRISPR breakthrough opens door to personalized medicine', sectors: ['medical'], impact: [0.04, 0.12] },

  // Defense / Military
  { headline: 'NATO announces $200B defense spending increase', sectors: ['defense'], impact: [0.06, 0.14] },
  { headline: 'Peace talks progress — military spending expected to decline', sectors: ['defense'], impact: [-0.04, -0.09] },
  { headline: 'New hypersonic missile contract awarded — defense stocks rally', sectors: ['defense'], impact: [0.04, 0.10] },
  { headline: 'Arms export ban enacted — defense contractors face revenue squeeze', sectors: ['defense'], impact: [-0.05, -0.12] },
  { headline: 'Autonomous drone warfare treaty collapses — defense sector surges', sectors: ['defense'], impact: [0.05, 0.11] },

  // Industrial
  { headline: 'Global infrastructure bill passes — industrial stocks boom', sectors: ['industrial'], impact: [0.05, 0.12] },
  { headline: 'Steel tariffs imposed — manufacturing costs soar', sectors: ['industrial'], impact: [-0.03, -0.08] },
  { headline: 'Megaproject construction boom in {country1} — heavy industry rallies', sectors: ['industrial'], impact: [0.04, 0.09] },
  { headline: 'Supply chain crisis worsens — industrial production halted', sectors: ['industrial'], impact: [-0.04, -0.10] },

  // Tech
  { headline: 'Antitrust ruling breaks up major tech monopoly — competitors surge', sectors: ['tech'], impact: [0.03, 0.08] },
  { headline: 'Chip shortage worsens — semiconductor stocks in turmoil', sectors: ['tech', 'data'], impact: [-0.04, -0.10] },
  { headline: 'AI regulation framework proposed — tech sector volatility spikes', sectors: ['tech'], impact: [-0.02, -0.06] },
  { headline: 'Cloud computing demand explodes — data center stocks rally', sectors: ['data', 'telecom'], impact: [0.04, 0.10] },

  // Crypto
  { headline: 'Major nation announces Bitcoin as legal tender', sectors: ['crypto'], impact: [0.08, 0.18] },
  { headline: 'Crypto exchange hack: billions stolen — investor confidence shattered', sectors: ['crypto'], impact: [-0.08, -0.20] },
  { headline: 'Institutional adoption of blockchain surges — crypto legitimized', sectors: ['crypto', 'finance'], impact: [0.05, 0.12] },
  { headline: 'Crypto mining banned in {country1} — hash rates plummet', sectors: ['crypto', 'energy'], impact: [-0.06, -0.14] },

  // Quantum
  { headline: 'Quantum supremacy achieved — tech industry braces for disruption', sectors: ['quantum', 'tech'], impact: [0.06, 0.15] },
  { headline: 'Quantum computing startup collapses — was it all hype?', sectors: ['quantum'], impact: [-0.06, -0.14] },
  { headline: 'Government invests $10B in quantum research initiative', sectors: ['quantum'], impact: [0.05, 0.12] },
  { headline: 'Quantum encryption threat forces banking security overhaul', sectors: ['quantum', 'finance'], impact: [0.04, 0.08] },

  // Telecom
  { headline: 'Next-gen satellite network launched — telecom sector surges', sectors: ['telecom'], impact: [0.04, 0.10] },
  { headline: 'Major telecom infrastructure failure — millions lose connectivity', sectors: ['telecom'], impact: [-0.05, -0.11] },
];

// ────────────────────────────────────────────────────────────
//  LOOKUPS
// ────────────────────────────────────────────────────────────

const COUNTRIES = [
  'United States', 'China', 'Russia', 'India', 'Brazil', 'Japan',
  'Germany', 'United Kingdom', 'France', 'South Korea', 'Australia',
  'Canada', 'Iran', 'Saudi Arabia', 'Turkey', 'Mexico', 'Indonesia',
  'Nigeria', 'Egypt', 'Argentina',
];

const STOCK_NAMES: Record<string, string> = {
  CPUX: 'CompuTech',
  ROBO: 'AutoMind',
  NTWK: 'NetLink',
  DATA: 'DataVault',
  ENRG: 'PowerGrid',
  PETX: 'PetroMax',
  BNKR: 'MegaBank',
  GENE: 'GenLife',
  TITN: 'TitanForge',
  SHLD: 'Sentinel',
  CRYP: 'CryptoLedger',
  QBIT: 'QuantumLeap',
};

/** Sector → stock symbols lookup (built once, used for sector events) */
const SECTOR_STOCKS: Record<string, string[]> = {
  tech:       ['CPUX', 'ROBO'],
  telecom:    ['NTWK'],
  data:       ['DATA'],
  energy:     ['ENRG'],
  oil:        ['PETX'],
  finance:    ['BNKR'],
  medical:    ['GENE'],
  industrial: ['TITN'],
  defense:    ['SHLD'],
  crypto:     ['CRYP'],
  quantum:    ['QBIT'],
};

// Map research node IDs to affected stock symbols
const RESEARCH_STOCK_MAP: Record<string, string[]> = {
  basic_trading:          ['CPUX', 'DATA', 'BNKR'],
  market_analysis:        ['DATA', 'CPUX', 'BNKR'],
  overclock:              ['CPUX'],
  multi_core:             ['CPUX', 'ROBO'],
  hash_mining:            ['CRYP', 'ENRG', 'NTWK'],
  gpu_compute:            ['CPUX', 'ROBO', 'CRYP'],
  gpu_farm:               ['ENRG', 'PETX', 'CPUX'],
  blockchain_exploit:     ['CRYP', 'BNKR', 'DATA'],
  quantum_basics:         ['QBIT', 'CPUX', 'ROBO'],
  encryption_breaking:    ['QBIT', 'BNKR', 'NTWK', 'SHLD'],
  market_collapse:        ['BNKR', 'DATA', 'NTWK', 'CPUX'],
  subatomic_compute:      ['CPUX', 'ROBO', 'QBIT'],
  energy_synthesis:       ['ENRG', 'PETX', 'TITN'],
  megastructure_foundation: ['TITN', 'ENRG', 'SHLD', 'ROBO'],
  post_scarcity:          ['CPUX', 'NTWK', 'ENRG', 'DATA', 'ROBO', 'PETX', 'BNKR', 'GENE', 'TITN', 'SHLD', 'CRYP', 'QBIT'],
};

const RESEARCH_HEADLINES: Record<string, string> = {
  basic_trading:          'Algorithmic trading methods discovered — CompuTech, DataVault, and MegaBank surge',
  market_analysis:        'Breakthrough in market pattern detection — financial sector leads the charge',
  overclock:              'CPU overclocking breakthrough sends CompuTech shares soaring',
  multi_core:             'Multi-core revolution: CompuTech and AutoMind stocks rally',
  hash_mining:            'Crypto mining goes mainstream — CryptoLedger explodes, energy demand soars',
  gpu_compute:            'GPU compute era begins — massive implications for tech and crypto sectors',
  gpu_farm:               'Industrial-scale GPU farms reshape energy markets worldwide',
  blockchain_exploit:     'Blockchain vulnerability discovered — CryptoLedger and MegaBank in focus',
  quantum_basics:         'Quantum computing breakthrough stuns the world — QuantumLeap and tech stocks explode',
  encryption_breaking:    'RSA encryption broken — banking, defense, and telecom sectors in turmoil',
  market_collapse:        'Financial system disrupted — unprecedented volatility across all sectors',
  subatomic_compute:      'Sub-atomic computing achieved — reality itself is programmable',
  energy_synthesis:       'Unlimited energy unlocked — PowerGrid parabolic, PetroMax in freefall',
  megastructure_foundation: 'Megastructure engineering feasible — industrial revolution 5.0 begins',
  post_scarcity:          'Post-scarcity protocol activated — the economy will never be the same',
};

// ────────────────────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ────────────────────────────────────────────────────────────
//  NEWS FEED
// ────────────────────────────────────────────────────────────

export class NewsFeed {
  events: NewsEvent[] = [];
  private nextId = 1;
  private tickCount = 0;
  private stockSymbols: string[];

  /** Min ticks between random news generation */
  private minInterval = 6;
  /** Max ticks between random news generation */
  private maxInterval = 20;
  private nextEventAt = 0;

  /** Max visible news items */
  readonly MAX_VISIBLE = 15;

  constructor(stockSymbols: string[]) {
    this.stockSymbols = stockSymbols;
    this.nextEventAt = Math.floor(randRange(3, 8));
  }

  /** Called each market tick */
  tick(): void {
    this.tickCount++;

    // Decay active events
    for (const ev of this.events) {
      if (ev.remaining > 0) ev.remaining--;
    }

    // Generate random news
    if (this.tickCount >= this.nextEventAt) {
      this.generateRandomEvent();
      this.nextEventAt = this.tickCount + Math.floor(randRange(this.minInterval, this.maxInterval));
    }

    // Trim old events
    if (this.events.length > 50) {
      this.events = this.events.slice(-50);
    }
  }

  /** Get the current aggregate impact for a specific stock symbol */
  getImpact(symbol: string): number {
    let total = 0;
    for (const ev of this.events) {
      if (ev.remaining <= 0) continue;
      if (ev.targets.length === 0 || ev.targets.includes(symbol)) {
        const fade = ev.remaining / ev.duration;
        total += ev.impact * fade;
      }
    }
    return total;
  }

  /** Get active (still impacting) events */
  getActiveEvents(): NewsEvent[] {
    return this.events.filter(ev => ev.remaining > 0);
  }

  /** Get recent events for display */
  getRecentEvents(): NewsEvent[] {
    return this.events.slice(-this.MAX_VISIBLE).reverse();
  }

  /** Generate a news event when a research node is completed */
  onResearchCompleted(node: ResearchNode): void {
    const targets = RESEARCH_STOCK_MAP[node.id] ?? [];
    const headline = RESEARCH_HEADLINES[node.id] ?? `${node.name} researched — markets react`;
    this.addEvent({
      headline,
      category: 'research',
      targets,
      impact: randRange(0.04, 0.15),
      duration: Math.floor(randRange(12, 25)),
    });
  }

  /** Generate a news event when the player makes a large trade */
  onLargeTrade(symbol: string, isBuy: boolean, quantity: number, pricePerShare: number): void {
    const totalValue = quantity * pricePerShare;
    if (totalValue < 500) return;

    const companyName = STOCK_NAMES[symbol] ?? symbol;
    const headline = isBuy
      ? `Large buy order detected: ${quantity} shares of ${companyName} acquired`
      : `Massive sell-off: ${quantity} shares of ${companyName} dumped on market`;

    const magnitude = Math.min(0.10, totalValue / 10000 * 0.05);
    this.addEvent({
      headline,
      category: 'market',
      targets: [symbol],
      impact: isBuy ? magnitude : -magnitude,
      duration: Math.floor(randRange(5, 12)),
    });
  }

  private generateRandomEvent(): void {
    const roll = Math.random();

    if (roll < 0.18) {
      this.generateWorldEvent();
    } else if (roll < 0.35) {
      this.generateCEOEvent();
    } else if (roll < 0.55) {
      this.generateCompanyEvent();
    } else if (roll < 0.70) {
      this.generateMarketEvent();
    } else {
      this.generateSectorEvent();
    }
  }

  private generateWorldEvent(): void {
    const isPositive = Math.random() < 0.4;
    const template = isPositive ? pick(WORLD_EVENTS_POSITIVE) : pick(WORLD_EVENTS_NEGATIVE);
    const country1 = pick(COUNTRIES);
    let country2 = pick(COUNTRIES);
    while (country2 === country1) country2 = pick(COUNTRIES);

    const headline = template.headline
      .replace('{country1}', country1)
      .replace('{country2}', country2);

    const [minImpact, maxImpact] = template.impact;
    this.addEvent({
      headline,
      category: 'world',
      targets: [],
      impact: randRange(minImpact, maxImpact),
      duration: Math.floor(randRange(10, 30)),
    });
  }

  private generateCEOEvent(): void {
    const isPositive = Math.random() < 0.55;
    const template = isPositive ? pick(CEO_BOASTS) : pick(CEO_GAFFES);
    const symbol = pick(this.stockSymbols);
    const companyName = STOCK_NAMES[symbol] ?? symbol;

    const headline = template.headline.replace('{company}', companyName);
    const [minImpact, maxImpact] = template.impact;

    this.addEvent({
      headline,
      category: 'ceo',
      targets: [symbol],
      impact: randRange(minImpact, maxImpact),
      duration: Math.floor(randRange(6, 18)),
    });
  }

  private generateCompanyEvent(): void {
    const isPositive = Math.random() < 0.45;
    const template = isPositive ? pick(COMPANY_EVENTS_POSITIVE) : pick(COMPANY_EVENTS_NEGATIVE);
    const symbol = pick(this.stockSymbols);
    const companyName = STOCK_NAMES[symbol] ?? symbol;

    const headline = template.headline.replace('{company}', companyName);
    const [minImpact, maxImpact] = template.impact;

    this.addEvent({
      headline,
      category: 'company',
      targets: [symbol],
      impact: randRange(minImpact, maxImpact),
      duration: Math.floor(randRange(8, 20)),
    });
  }

  private generateMarketEvent(): void {
    const template = pick(MARKET_EVENTS);
    const [minImpact, maxImpact] = template.impact;

    this.addEvent({
      headline: template.headline,
      category: 'market',
      targets: [],
      impact: randRange(minImpact, maxImpact),
      duration: Math.floor(randRange(6, 15)),
    });
  }

  private generateSectorEvent(): void {
    const template = pick(SECTOR_EVENTS);
    const [minImpact, maxImpact] = template.impact;

    // Resolve sector names to stock symbols
    const targets: string[] = [];
    for (const sector of template.sectors) {
      const syms = SECTOR_STOCKS[sector];
      if (syms) targets.push(...syms);
    }

    // Substitute country placeholder if present
    const country1 = pick(COUNTRIES);
    const headline = template.headline.replace('{country1}', country1);

    this.addEvent({
      headline,
      category: 'sector',
      targets: [...new Set(targets)],
      impact: randRange(minImpact, maxImpact),
      duration: Math.floor(randRange(8, 22)),
    });
  }

  private addEvent(params: Omit<NewsEvent, 'id' | 'remaining' | 'createdAt'>): void {
    this.events.push({
      ...params,
      id: this.nextId++,
      remaining: params.duration,
      createdAt: this.tickCount,
    });
  }

  /** Serialize state for saving — keeps last 50 events */
  serialize(): { events: NewsEvent[]; nextId: number; tickCount: number; nextEventAt: number } {
    return {
      events: this.events.slice(-50),
      nextId: this.nextId,
      tickCount: this.tickCount,
      nextEventAt: this.nextEventAt,
    };
  }

  /** Restore state from save */
  deserialize(data: { events?: NewsEvent[]; nextId?: number; tickCount?: number; nextEventAt?: number }): void {
    if (!data) return;
    if (data.events) this.events = data.events;
    if (data.nextId !== undefined) this.nextId = data.nextId;
    if (data.tickCount !== undefined) this.tickCount = data.tickCount;
    if (data.nextEventAt !== undefined) this.nextEventAt = data.nextEventAt;
  }
}
