import { getQuickJS, type QuickJSContext, type QuickJSRuntime } from 'quickjs-emscripten';
import type { GameState } from '../GameState';

export interface ConsoleEntry {
  type: 'log' | 'error' | 'system' | 'result';
  text: string;
}

export interface ExecutionTrace {
  steps: number[];
  outputs: { entry: ConsoleEntry; stepIndex: number }[];
  error?: ConsoleEntry;
}

/** Max trace steps before we bail out (prevents infinite loops from freezing) */
const MAX_STEPS = 10000;

/** Continuation tokens — lines starting with these are not statement starts */
const CONTINUATION_RE = /^[)\],.+\-?:&|]/;

/** Detect loop headers: for(...){, while(...){, do { */
const LOOP_RE = /^\s*(for\s*\(|while\s*\(|do\s*\{)/;

/**
 * Instrument code with __tick calls.
 * - Every statement-starting line gets a __tick before it.
 * - Loop headers (for/while/do) also get a __tick injected AFTER the opening {
 *   so each iteration re-ticks the loop line.
 */
function instrumentCode(code: string): string {
  const lines = code.split('\n');
  return lines.map((line, i) => {
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (trimmed === '') return `__tick(${lineNum});`;
    if (trimmed.startsWith('//')) return `__tick(${lineNum}); ${line}`;

    // Don't tick continuation lines
    if (CONTINUATION_RE.test(trimmed)) return line;

    // For loop headers ending with {, inject a tick inside the block too
    // so each iteration highlights the loop line
    if (LOOP_RE.test(trimmed) && trimmed.endsWith('{')) {
      return `__tick(${lineNum}); ${line} __tick(${lineNum});`;
    }

    return `__tick(${lineNum}); ${line}`;
  }).join('\n');
}

export class Sandbox {
  private runtime: QuickJSRuntime | null = null;
  private ctx: QuickJSContext | null = null;
  private ready = false;
  private consoleBuffer: ConsoleEntry[] = [];
  private executionTrace: number[] = [];
  private outputMap: { entry: ConsoleEntry; stepIndex: number }[] = [];
  private hitStepLimit = false;

  async init(state: GameState): Promise<void> {
    const QuickJS = await getQuickJS();
    this.runtime = QuickJS.newRuntime();
    this.runtime.setMemoryLimit(1024 * 1024 * 10);
    this.runtime.setMaxStackSize(1024 * 512);
    this.rebuildContext(state);
    this.ready = true;
  }

  executeTraced(code: string, state: GameState): ExecutionTrace {
    this.consoleBuffer = [];
    this.executionTrace = [];
    this.outputMap = [];
    this.hitStepLimit = false;

    if (!this.ready) {
      return {
        steps: [],
        outputs: [],
        error: { type: 'error', text: 'Sandbox not initialized yet.' },
      };
    }

    this.rebuildContext(state);
    this.injectTracing(this.ctx!);

    const instrumented = instrumentCode(code);
    const result = this.ctx!.evalCode(instrumented, '<user>');

    // Clear interrupt handler for future runs
    this.runtime!.setInterruptHandler(() => false);

    let error: ConsoleEntry | undefined;
    if (this.hitStepLimit) {
      error = { type: 'error', text: `Execution halted: exceeded ${MAX_STEPS} steps. Check for infinite loops.` };
      if (result.error) result.error.dispose();
      else result.value?.dispose();
    } else if (result.error) {
      const err = this.ctx!.dump(result.error);
      result.error.dispose();
      error = { type: 'error', text: String(err) };
    } else {
      const val = this.ctx!.dump(result.value);
      result.value.dispose();
      if (val !== undefined) {
        this.outputMap.push({
          entry: { type: 'result', text: this.stringify(val) },
          stepIndex: this.executionTrace.length - 1,
        });
      }
    }

    return {
      steps: [...this.executionTrace],
      outputs: [...this.outputMap],
      error,
    };
  }

  private injectTracing(ctx: QuickJSContext): void {
    const tickFn = ctx.newFunction('__tick', (lineHandle) => {
      if (this.hitStepLimit) return;
      const line = ctx.dump(lineHandle) as number;
      this.executionTrace.push(line);

      if (this.executionTrace.length >= MAX_STEPS) {
        this.hitStepLimit = true;
      }
    });
    ctx.setProp(ctx.global, '__tick', tickFn);
    tickFn.dispose();

    // Use interrupt handler to actually halt execution when step limit hit
    this.runtime!.setInterruptHandler(() => {
      return this.hitStepLimit;
    });
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
      const entry: ConsoleEntry = { type: 'log', text: texts.join(' ') };
      this.consoleBuffer.push(entry);
      this.outputMap.push({ entry, stepIndex: this.executionTrace.length - 1 });
    });
    ctx.setProp(consoleObj, 'log', logFn);
    ctx.setProp(ctx.global, 'console', consoleObj);
    logFn.dispose();
    consoleObj.dispose();

    const printFn = ctx.newFunction('print', (...args) => {
      const texts = args.map(a => this.stringify(ctx.dump(a)));
      const entry: ConsoleEntry = { type: 'log', text: texts.join(' ') };
      this.consoleBuffer.push(entry);
      this.outputMap.push({ entry, stepIndex: this.executionTrace.length - 1 });
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
      state.newsFeed.onLargeTrade(stock.symbol, true, qty, stock.price);
      const entry: ConsoleEntry = { type: 'log', text: `Bought ${qty} ${stock.symbol} @ $${stock.price.toFixed(2)}` };
      this.consoleBuffer.push(entry);
      this.outputMap.push({ entry, stepIndex: this.executionTrace.length - 1 });
      return ctx.newString(entry.text);
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
      state.newsFeed.onLargeTrade(sym, false, qty, stock.price);
      const entry: ConsoleEntry = { type: 'log', text: `Sold ${qty} ${sym} @ $${stock.price.toFixed(2)}` };
      this.consoleBuffer.push(entry);
      this.outputMap.push({ entry, stepIndex: this.executionTrace.length - 1 });
      return ctx.newString(entry.text);
    });
    ctx.setProp(gameObj, 'sell', sellFn);
    sellFn.dispose();

    const getNews = ctx.newFunction('getNews', () => {
      const allStocks = state.stockMarket.stocks;
      const events = state.newsFeed.getRecentEvents().map(ev => {
        const affected = ev.targets.length === 0 ? allStocks : allStocks.filter(s => ev.targets.includes(s.symbol));
        const stockImpacts: Record<string, number> = {};
        for (const s of affected) {
          stockImpacts[s.symbol] = Math.round(s.price * ev.impact * 100) / 100;
        }
        return {
          headline: ev.headline,
          category: ev.category,
          impact: Math.round(ev.impact * 1000) / 1000,
          active: ev.remaining > 0,
          remaining: ev.remaining,
          duration: ev.duration,
          targets: ev.targets,
          stockImpacts,
        };
      });
      return ctx.newString(JSON.stringify(events));
    });
    ctx.setProp(gameObj, 'getNews', getNews);
    getNews.dispose();

    const getPortfolio = ctx.newFunction('getPortfolio', () => {
      const data: Record<string, number> = {};
      for (const [sym, qty] of state.portfolio) {
        if (qty > 0) data[sym] = qty;
      }
      return ctx.newString(JSON.stringify(data));
    });
    ctx.setProp(gameObj, 'getPortfolio', getPortfolio);
    getPortfolio.dispose();

    // ── Sports Betting APIs ──

    const getSports = ctx.newFunction('getSports', () => {
      const data = state.sportsLeague.sports.map(s => ({
        id: s.id,
        name: s.name,
        phase: s.phase,
        seasonNumber: s.seasonNumber,
        bettingTicksLeft: s.phase === 'betting' ? s.phaseTicksLeft : 0,
        currentRound: s.currentRound,
        hasBet: !!s.playerBets,
      }));
      return ctx.newString(JSON.stringify(data));
    });
    ctx.setProp(gameObj, 'getSports', getSports);
    getSports.dispose();

    const getTeams = ctx.newFunction('getTeams', (sportIdHandle) => {
      const sportId = ctx.dump(sportIdHandle) as string;
      const sport = state.sportsLeague.getSport(sportId);
      if (!sport) return ctx.newString(JSON.stringify({ error: `Unknown sport: ${sportId}` }));
      const data = sport.teams.map(t => ({
        id: t.id,
        name: t.name,
        rating: t.rating,
        seed: t.seed,
        wins: t.wins,
        losses: t.losses,
      }));
      return ctx.newString(JSON.stringify(data));
    });
    ctx.setProp(gameObj, 'getTeams', getTeams);
    getTeams.dispose();

    const getBracket = ctx.newFunction('getBracket', (sportIdHandle) => {
      const sportId = ctx.dump(sportIdHandle) as string;
      const sport = state.sportsLeague.getSport(sportId);
      if (!sport) return ctx.newString(JSON.stringify({ error: `Unknown sport: ${sportId}` }));
      const data = sport.bracket.map(round => ({
        name: round.name,
        matches: round.matches.map(m => ({
          team1Id: m.team1Id,
          team2Id: m.team2Id,
          winnerId: m.winnerId,
          played: m.played,
          score: m.score,
        })),
      }));
      return ctx.newString(JSON.stringify(data));
    });
    ctx.setProp(gameObj, 'getBracket', getBracket);
    getBracket.dispose();

    const placeBets = ctx.newFunction('placeBets', (sportIdHandle, wagerHandle, roundsHandle) => {
      const sportId = ctx.dump(sportIdHandle) as string;
      const wager = ctx.dump(wagerHandle) as number;
      const roundsRaw = ctx.dump(roundsHandle) as Record<string, string[]>;

      if (typeof sportId !== 'string') return ctx.newString('Usage: game.placeBets("sportId", wagerPerRound, {round1: [...], ...})');
      if (typeof wager !== 'number' || wager < 100) return ctx.newString('Minimum wager per round is $100');

      // Calculate total cost (wager * number of rounds being bet on)
      const totalCost = state.sportsLeague.calcBetCost(roundsRaw, wager);
      if (totalCost > state.money) return ctx.newString(`Not enough money. Need $${totalCost} ($${wager}/round), have $${state.money.toFixed(2)}`);

      const err = state.sportsLeague.placeBets(sportId, wager, roundsRaw);
      if (err) return ctx.newString(err);

      state.money -= totalCost;
      const entry: ConsoleEntry = { type: 'log', text: `Placed $${totalCost.toLocaleString()} in bets on ${sportId} ($${wager}/round)` };
      this.consoleBuffer.push(entry);
      this.outputMap.push({ entry, stepIndex: this.executionTrace.length - 1 });
      return ctx.newString(`Bets placed! $${totalCost.toLocaleString()} wagered on ${sportId}`);
    });
    ctx.setProp(gameObj, 'placeBets', placeBets);
    placeBets.dispose();

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
