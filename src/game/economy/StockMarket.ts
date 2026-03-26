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
  history: number[];
  candles: Candle[];
  /** Current candle being formed (accumulates ticks) */
  currentCandle: Candle;
  ticksInCandle: number;
}

const TICKS_PER_CANDLE = 5;

export class StockMarket {
  stocks: Stock[] = [];
  private tickCount = 0;
  selectedSymbol = 'CPUX';

  constructor() {
    const init = (symbol: string, name: string, price: number, volatility: number, trend: number): Stock => ({
      symbol, name, price, volatility, trend,
      history: [price],
      candles: [{ open: price, high: price, low: price, close: price, volume: 100 }],
      currentCandle: { open: price, high: price, low: price, close: price, volume: 0 },
      ticksInCandle: 0,
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
      stock.price = Math.max(0.01, stock.price + change);
      stock.history.push(stock.price);
      if (stock.history.length > 200) stock.history.shift();

      // Update current candle
      const c = stock.currentCandle;
      c.close = stock.price;
      c.high = Math.max(c.high, stock.price);
      c.low = Math.min(c.low, stock.price);
      c.volume += Math.round(50 + Math.random() * 200);
      stock.ticksInCandle++;

      // Close candle and start new one
      if (stock.ticksInCandle >= TICKS_PER_CANDLE) {
        stock.candles.push({ ...c });
        if (stock.candles.length > 60) stock.candles.shift();
        stock.currentCandle = {
          open: stock.price, high: stock.price, low: stock.price,
          close: stock.price, volume: 0,
        };
        stock.ticksInCandle = 0;
      }
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
