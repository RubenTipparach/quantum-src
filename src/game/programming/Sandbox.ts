import { getQuickJS, type QuickJSContext, type QuickJSRuntime } from 'quickjs-emscripten';
import type { GameState } from '../GameState';

export interface ConsoleEntry {
  type: 'log' | 'error' | 'system' | 'result';
  text: string;
}

export class Sandbox {
  private runtime: QuickJSRuntime | null = null;
  private ctx: QuickJSContext | null = null;
  private ready = false;
  private consoleBuffer: ConsoleEntry[] = [];

  async init(state: GameState): Promise<void> {
    const QuickJS = await getQuickJS();
    this.runtime = QuickJS.newRuntime();
    this.runtime.setMemoryLimit(1024 * 1024 * 10); // 10MB
    this.runtime.setMaxStackSize(1024 * 512); // 512KB stack
    this.rebuildContext(state);
    this.ready = true;
  }

  private rebuildContext(state: GameState): void {
    if (this.ctx) {
      this.ctx.dispose();
    }
    this.ctx = this.runtime!.newContext();
    this.injectAPI(this.ctx, state);
  }

  private injectAPI(ctx: QuickJSContext, state: GameState): void {
    // console.log
    const consoleObj = ctx.newObject();
    const logFn = ctx.newFunction('log', (...args) => {
      const texts = args.map(a => {
        const str = ctx.getString(a);
        return str;
      });
      this.consoleBuffer.push({ type: 'log', text: texts.join(' ') });
    });
    ctx.setProp(consoleObj, 'log', logFn);
    ctx.setProp(ctx.global, 'console', consoleObj);
    logFn.dispose();
    consoleObj.dispose();

    // print (alias)
    const printFn = ctx.newFunction('print', (...args) => {
      const texts = args.map(a => ctx.getString(a));
      this.consoleBuffer.push({ type: 'log', text: texts.join(' ') });
    });
    ctx.setProp(ctx.global, 'print', printFn);
    printFn.dispose();

    // game.money, game.year, etc.
    const gameObj = ctx.newObject();

    const getMoney = ctx.newFunction('getMoney', () => ctx.newNumber(state.money));
    ctx.setProp(gameObj, 'getMoney', getMoney);
    getMoney.dispose();

    const getYear = ctx.newFunction('getYear', () => ctx.newNumber(state.year));
    ctx.setProp(gameObj, 'getYear', getYear);
    getYear.dispose();

    const getEnergy = ctx.newFunction('getEnergy', () => ctx.newNumber(state.energy));
    ctx.setProp(gameObj, 'getEnergy', getEnergy);
    getEnergy.dispose();

    // game.stocks() — returns JSON string of current quotes
    const getStocks = ctx.newFunction('getStocks', () => {
      const data = state.stockMarket.stocks.map(s => ({
        symbol: s.symbol,
        price: Math.round(s.price * 100) / 100,
      }));
      return ctx.newString(JSON.stringify(data));
    });
    ctx.setProp(gameObj, 'getStocks', getStocks);
    getStocks.dispose();

    // game.buy(symbol, qty)
    const buyFn = ctx.newFunction('buy', (symHandle, qtyHandle) => {
      const symbol = ctx.getString(symHandle).toUpperCase();
      const qty = ctx.getNumber(qtyHandle);
      const stock = state.stockMarket.getStock(symbol);
      if (!stock) return ctx.newString(`Unknown stock: ${symbol}`);
      const cost = stock.price * qty;
      if (cost > state.money) return ctx.newString(`Not enough money`);
      state.money -= cost;
      const current = state.portfolio.get(stock.symbol) ?? 0;
      state.portfolio.set(stock.symbol, current + qty);
      return ctx.newString(`Bought ${qty} ${stock.symbol} @ $${stock.price.toFixed(2)}`);
    });
    ctx.setProp(gameObj, 'buy', buyFn);
    buyFn.dispose();

    // game.sell(symbol, qty)
    const sellFn = ctx.newFunction('sell', (symHandle, qtyHandle) => {
      const symbol = ctx.getString(symHandle).toUpperCase();
      const qty = ctx.getNumber(qtyHandle);
      const owned = state.portfolio.get(symbol) ?? 0;
      if (owned < qty) return ctx.newString(`Only own ${owned} shares of ${symbol}`);
      const stock = state.stockMarket.getStock(symbol);
      if (!stock) return ctx.newString(`Unknown stock: ${symbol}`);
      state.money += stock.price * qty;
      state.portfolio.set(symbol, owned - qty);
      return ctx.newString(`Sold ${qty} ${symbol} @ $${stock.price.toFixed(2)}`);
    });
    ctx.setProp(gameObj, 'sell', sellFn);
    sellFn.dispose();

    // game.getPortfolio()
    const getPortfolio = ctx.newFunction('getPortfolio', () => {
      const data: Record<string, number> = {};
      for (const [sym, qty] of state.portfolio) {
        if (qty > 0) data[sym] = qty;
      }
      return ctx.newString(JSON.stringify(data));
    });
    ctx.setProp(gameObj, 'getPortfolio', getPortfolio);
    getPortfolio.dispose();

    ctx.setProp(ctx.global, 'game', gameObj);
    gameObj.dispose();
  }

  execute(code: string, state: GameState): ConsoleEntry[] {
    this.consoleBuffer = [];
    if (!this.ready || !this.ctx) {
      return [{ type: 'error', text: 'Sandbox not initialized yet.' }];
    }

    // Rebuild context each run to pick up latest game state
    this.rebuildContext(state);

    const result = this.ctx.evalCode(code);
    if (result.error) {
      const err = this.ctx.getString(result.error);
      result.error.dispose();
      this.consoleBuffer.push({ type: 'error', text: err });
    } else {
      const val = this.ctx.getString(result.value);
      result.value.dispose();
      if (val !== 'undefined') {
        this.consoleBuffer.push({ type: 'result', text: val });
      }
    }

    return [...this.consoleBuffer];
  }

  isReady(): boolean {
    return this.ready;
  }

  dispose(): void {
    this.ctx?.dispose();
    this.runtime?.dispose();
  }
}
