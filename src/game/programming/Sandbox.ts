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
    this.runtime.setMemoryLimit(1024 * 1024 * 10);
    this.runtime.setMaxStackSize(1024 * 512);
    this.rebuildContext(state);
    this.ready = true;
  }

  execute(code: string, state: GameState): ConsoleEntry[] {
    this.consoleBuffer = [];
    if (!this.ready) {
      return [{ type: 'error', text: 'Sandbox not initialized yet.' }];
    }

    this.rebuildContext(state);

    const result = this.ctx!.evalCode(code, '<user>');
    if (result.error) {
      const err = this.ctx!.dump(result.error);
      result.error.dispose();
      this.consoleBuffer.push({ type: 'error', text: String(err) });
    } else {
      const val = this.ctx!.dump(result.value);
      result.value.dispose();
      if (val !== undefined) {
        this.consoleBuffer.push({ type: 'result', text: this.stringify(val) });
      }
    }

    return [...this.consoleBuffer];
  }

  private rebuildContext(state: GameState): void {
    if (this.ctx) {
      this.ctx.dispose();
    }
    this.ctx = this.runtime!.newContext();
    this.injectAPI(this.ctx, state);
  }

  private stringify(val: unknown): string {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  private injectAPI(ctx: QuickJSContext, state: GameState): void {
    const consoleObj = ctx.newObject();
    const logFn = ctx.newFunction('log', (...args) => {
      const texts = args.map(a => this.stringify(ctx.dump(a)));
      this.consoleBuffer.push({ type: 'log', text: texts.join(' ') });
    });
    ctx.setProp(consoleObj, 'log', logFn);
    ctx.setProp(ctx.global, 'console', consoleObj);
    logFn.dispose();
    consoleObj.dispose();

    const printFn = ctx.newFunction('print', (...args) => {
      const texts = args.map(a => this.stringify(ctx.dump(a)));
      this.consoleBuffer.push({ type: 'log', text: texts.join(' ') });
    });
    ctx.setProp(ctx.global, 'print', printFn);
    printFn.dispose();

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

    const getStocks = ctx.newFunction('getStocks', () => {
      const data = state.stockMarket.stocks.map(s => ({
        symbol: s.symbol,
        price: Math.round(s.price * 100) / 100,
      }));
      return ctx.newString(JSON.stringify(data));
    });
    ctx.setProp(gameObj, 'getStocks', getStocks);
    getStocks.dispose();

    const buyFn = ctx.newFunction('buy', (symHandle, qtyHandle) => {
      const symbol = ctx.dump(symHandle) as string;
      const qty = ctx.dump(qtyHandle) as number;
      if (typeof symbol !== 'string' || typeof qty !== 'number') {
        return ctx.newString('Usage: game.buy("SYMBOL", quantity)');
      }
      const sym = symbol.toUpperCase();
      const stock = state.stockMarket.getStock(sym);
      if (!stock) return ctx.newString(`Unknown stock: ${sym}`);
      const cost = stock.price * qty;
      if (cost > state.money) return ctx.newString(`Not enough money. Need $${cost.toFixed(2)}`);
      state.money -= cost;
      const current = state.portfolio.get(stock.symbol) ?? 0;
      state.portfolio.set(stock.symbol, current + qty);
      return ctx.newString(`Bought ${qty} ${stock.symbol} @ $${stock.price.toFixed(2)}`);
    });
    ctx.setProp(gameObj, 'buy', buyFn);
    buyFn.dispose();

    const sellFn = ctx.newFunction('sell', (symHandle, qtyHandle) => {
      const symbol = ctx.dump(symHandle) as string;
      const qty = ctx.dump(qtyHandle) as number;
      if (typeof symbol !== 'string' || typeof qty !== 'number') {
        return ctx.newString('Usage: game.sell("SYMBOL", quantity)');
      }
      const sym = symbol.toUpperCase();
      const owned = state.portfolio.get(sym) ?? 0;
      if (owned < qty) return ctx.newString(`Only own ${owned} shares of ${sym}`);
      const stock = state.stockMarket.getStock(sym);
      if (!stock) return ctx.newString(`Unknown stock: ${sym}`);
      state.money += stock.price * qty;
      state.portfolio.set(sym, owned - qty);
      return ctx.newString(`Sold ${qty} ${sym} @ $${stock.price.toFixed(2)}`);
    });
    ctx.setProp(gameObj, 'sell', sellFn);
    sellFn.dispose();

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

  isReady(): boolean {
    return this.ready;
  }

  dispose(): void {
    this.ctx?.dispose();
    this.runtime?.dispose();
  }
}
