export interface Stock {
  symbol: string;
  name: string;
  price: number;
  volatility: number;
  trend: number; // -1 to 1
  history: number[];
}

export class StockMarket {
  stocks: Stock[] = [];
  private tickCount = 0;

  constructor() {
    this.stocks = [
      { symbol: 'CPUX', name: 'CompuTech Corp', price: 12.50, volatility: 0.05, trend: 0.02, history: [12.50] },
      { symbol: 'NTWK', name: 'NetLink Systems', price: 8.00, volatility: 0.08, trend: 0.01, history: [8.00] },
      { symbol: 'ENRG', name: 'PowerGrid Inc', price: 25.00, volatility: 0.03, trend: 0.005, history: [25.00] },
      { symbol: 'DATA', name: 'DataVault Ltd', price: 5.00, volatility: 0.12, trend: -0.01, history: [5.00] },
      { symbol: 'ROBO', name: 'AutoMind AI', price: 3.00, volatility: 0.15, trend: 0.03, history: [3.00] },
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
      if (stock.history.length > 100) stock.history.shift();
    }
  }

  getStock(symbol: string): Stock | undefined {
    return this.stocks.find(s => s.symbol === symbol);
  }

  getQuotes(): string {
    return this.stocks
      .map(s => `${s.symbol}: $${s.price.toFixed(2)}`)
      .join(' | ');
  }
}
