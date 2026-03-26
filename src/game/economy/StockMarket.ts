export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  volatility: number;
  trend: number;
  /** Every tick (1 second) produces one candle */
  candles: Candle[];
}

/** Max candles to retain per stock (10 minutes worth) */
const MAX_CANDLES = 600;

export class StockMarket {
  stocks: Stock[] = [];
  private tickCount = 0;
  selectedSymbol = 'CPUX';

  constructor() {
    const init = (symbol: string, name: string, price: number, volatility: number, trend: number): Stock => ({
      symbol, name, price, volatility, trend,
      candles: [{ open: price, high: price, low: price, close: price, volume: 100 }],
    });

    this.stocks = [
      init('CPUX', 'CompuTech Corp', 12.50, 0.05, 0.02),
      init('NTWK', 'NetLink Systems', 8.00, 0.08, 0.01),
      init('ENRG', 'PowerGrid Inc', 25.00, 0.03, 0.005),
      init('DATA', 'DataVault Ltd', 5.00, 0.12, -0.01),
      init('ROBO', 'AutoMind AI', 3.00, 0.15, 0.03),
    ];
  }

  tick(): void {
    this.tickCount++;
    for (const stock of this.stocks) {
      const random = (Math.random() - 0.5) * 2 * stock.volatility;
      const trendEffect = stock.trend;
      const change = stock.price * (random + trendEffect);
      const newPrice = Math.max(0.01, stock.price + change);

      // Each tick = 1 candle (1 second)
      const candle: Candle = {
        open: stock.price,
        high: Math.max(stock.price, newPrice),
        low: Math.min(stock.price, newPrice),
        close: newPrice,
        volume: Math.round(50 + Math.random() * 200),
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

  getQuotes(): string {
    return this.stocks
      .map(s => `${s.symbol}: $${s.price.toFixed(2)}`)
      .join(' | ');
  }
}
