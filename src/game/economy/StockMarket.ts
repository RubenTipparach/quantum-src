import type { NewsFeed } from './NewsFeed';

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Sector = 'tech' | 'telecom' | 'data' | 'energy' | 'oil' | 'finance' | 'medical' | 'industrial' | 'defense' | 'crypto' | 'quantum';

export interface Stock {
  symbol: string;
  name: string;
  sector: Sector;
  price: number;
  volatility: number;
  /** Base drift removed — price is now pure random walk + news. */
  momentum: number;
  /** Every tick produces one candle */
  candles: Candle[];
}

/** Max candles to retain per stock (10 minutes worth at 1.5s ticks = 400) */
const MAX_CANDLES = 600;

/** Mean-reversion strength — pulls momentum back toward 0 */
const MOMENTUM_DECAY = 0.92;
/** How much random shock feeds into momentum */
const MOMENTUM_SENSITIVITY = 0.3;

export class StockMarket {
  stocks: Stock[] = [];
  private tickCount = 0;
  selectedSymbol = 'CPUX';
  newsFeed: NewsFeed | null = null;

  constructor() {
    const init = (symbol: string, name: string, sector: Sector, price: number, volatility: number): Stock => ({
      symbol, name, sector, price, volatility,
      momentum: 0,
      candles: [{ open: price, high: price, low: price, close: price, volume: 100 }],
    });

    this.stocks = [
      // Tech — competing hardware/software giants
      init('CPUX', 'CompuTech Corp',        'tech',       12.50, 0.04),
      init('ROBO', 'AutoMind AI',           'tech',        3.00, 0.10),
      // Telecom & Data
      init('NTWK', 'NetLink Systems',       'telecom',     8.00, 0.06),
      init('DATA', 'DataVault Ltd',         'data',        5.00, 0.08),
      // Energy & Oil
      init('ENRG', 'PowerGrid Inc',         'energy',     25.00, 0.03),
      init('PETX', 'PetroMax Global',       'oil',        42.00, 0.035),
      // Finance
      init('BNKR', 'MegaBank Corp',         'finance',    35.00, 0.04),
      // Medical / Biotech
      init('GENE', 'GenLife Pharma',         'medical',    18.00, 0.09),
      // Industrial / Manufacturing
      init('TITN', 'TitanForge Industries',  'industrial', 20.00, 0.035),
      // Defense / Military
      init('SHLD', 'Sentinel Defense',       'defense',    30.00, 0.05),
      // Crypto — volatile, ties to crypto era
      init('CRYP', 'CryptoLedger Inc',      'crypto',      1.50, 0.14),
      // Quantum — speculative, ties to quantum era
      init('QBIT', 'QuantumLeap Labs',      'quantum',     0.80, 0.12),
    ];
  }

  setNewsFeed(feed: NewsFeed): void {
    this.newsFeed = feed;
  }

  tick(): void {
    this.tickCount++;
    for (const stock of this.stocks) {
      // Pure random walk component — symmetric, zero-mean
      const shock = (Math.random() - 0.5) * 2 * stock.volatility;

      // Momentum: accumulates shocks so stocks can trend for short bursts,
      // but decays back toward zero (mean-reverting)
      stock.momentum = stock.momentum * MOMENTUM_DECAY + shock * MOMENTUM_SENSITIVITY;

      // News-driven component
      let newsEffect = 0;
      if (this.newsFeed) {
        newsEffect = this.newsFeed.getImpact(stock.symbol);
      }

      // Occasional large random jumps (fat tails) — ~5% chance per tick
      let fatTail = 0;
      if (Math.random() < 0.05) {
        fatTail = (Math.random() - 0.5) * stock.volatility * 4;
      }

      // Combine: random walk + momentum + news + fat tail
      const change = stock.price * (shock + stock.momentum + newsEffect + fatTail);
      const newPrice = Math.max(0.01, stock.price + change);

      // Volume correlates with volatility and news activity
      const baseVolume = 50 + Math.random() * 150;
      const newsVolumeMult = 1 + Math.abs(newsEffect) * 20;
      const volume = Math.round(baseVolume * newsVolumeMult);

      const candle: Candle = {
        open: stock.price,
        high: Math.max(stock.price, newPrice),
        low: Math.min(stock.price, newPrice),
        close: newPrice,
        volume,
      };

      stock.price = newPrice;
      stock.candles.push(candle);
      if (stock.candles.length > MAX_CANDLES) stock.candles.shift();
    }
  }

  getStock(symbol: string): Stock | undefined {
    return this.stocks.find(s => s.symbol === symbol);
  }

  getSelectedStock(): Stock {
    return this.stocks.find(s => s.symbol === this.selectedSymbol) ?? this.stocks[0]!;
  }

  /** Market emotion: -1 (fear) to +1 (greed), based on recent price trends */
  getMarketEmotion(): number {
    let totalChange = 0;
    let count = 0;
    for (const stock of this.stocks) {
      const candles = stock.candles;
      if (candles.length < 10) continue;
      const recent = candles.slice(-10);
      const first = recent[0]!.open;
      const last = recent[recent.length - 1]!.close;
      totalChange += (last - first) / first;
      count++;
    }
    if (count === 0) return 0;
    const avg = totalChange / count;
    return Math.max(-1, Math.min(1, avg * 20));
  }

  getQuotes(): string {
    return this.stocks
      .map(s => `${s.symbol}: $${s.price.toFixed(2)}`)
      .join(' | ');
  }
}
