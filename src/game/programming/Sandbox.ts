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

  /** Return a JS object/array inside the sandbox (not a JSON string) */
  private jsonToHandle(ctx: QuickJSContext, data: unknown) {
    const json = JSON.stringify(data);
    const result = ctx.evalCode(`(${json})`);
    if (result.error) {
      const err = result.error;
      err.dispose();
      return ctx.newString(json); // fallback to string
    }
    return result.value;
  }

  private injectAPI(ctx: QuickJSContext, state: GameState): void {
    const self = this;

    // Helper: create a function and attach to an object, then dispose
    const fn = (obj: any, name: string, func: (...args: any[]) => any) => {
      const handle = ctx.newFunction(name, func);
      ctx.setProp(obj, name, handle);
      handle.dispose();
    };

    // ── Global output ──

    const consoleObj = ctx.newObject();
    fn(consoleObj, 'log', (...args) => {
      const texts = args.map(a => self.stringify(ctx.dump(a)));
      const entry: ConsoleEntry = { type: 'log', text: texts.join(' ') };
      self.consoleBuffer.push(entry);
      self.outputMap.push({ entry, stepIndex: self.executionTrace.length - 1 });
    });
    ctx.setProp(ctx.global, 'console', consoleObj);
    consoleObj.dispose();

    fn(ctx.global, 'print', (...args) => {
      const texts = args.map(a => self.stringify(ctx.dump(a)));
      const entry: ConsoleEntry = { type: 'log', text: texts.join(' ') };
      self.consoleBuffer.push(entry);
      self.outputMap.push({ entry, stepIndex: self.executionTrace.length - 1 });
    });

    // ── sys — system status ──

    const sysObj = ctx.newObject();

    fn(sysObj, 'funds', () => ctx.newNumber(state.money));
    fn(sysObj, 'year', () => ctx.newNumber(state.year));
    fn(sysObj, 'energy', () => ctx.newNumber(state.energy));
    fn(sysObj, 'credits', () => ctx.newNumber(state.researchCredits));
    fn(sysObj, 'era', () => ctx.newString(state.getEraName()));
    fn(sysObj, 'compute', () => ctx.newString(state.getComputeLabel()));

    ctx.setProp(ctx.global, 'sys', sysObj);
    sysObj.dispose();

    // ── market — stock market ──

    const marketObj = ctx.newObject();

    fn(marketObj, 'scan', () => {
      return self.jsonToHandle(ctx, state.stockMarket.stocks.map(s => ({
        symbol: s.symbol,
        name: s.name,
        sector: s.sector,
        price: Math.round(s.price * 100) / 100,
      })));
    });

    fn(marketObj, 'price', (symHandle) => {
      const sym = (ctx.dump(symHandle) as string)?.toUpperCase();
      const stock = state.stockMarket.getStock(sym);
      if (!stock) return ctx.newNumber(0);
      return ctx.newNumber(Math.round(stock.price * 100) / 100);
    });

    fn(marketObj, 'buy', (symHandle, qtyHandle) => {
      const symbol = ctx.dump(symHandle) as string;
      const qty = ctx.dump(qtyHandle) as number;
      if (typeof symbol !== 'string' || typeof qty !== 'number') {
        return ctx.newString('Usage: market.buy("SYMBOL", quantity)');
      }
      const sym = symbol.toUpperCase();
      const stock = state.stockMarket.getStock(sym);
      if (!stock) return ctx.newString(`Unknown stock: ${sym}`);
      const cost = stock.price * qty;
      if (cost > state.money) return ctx.newString(`Insufficient funds. Need $${cost.toFixed(2)}`);
      state.money -= cost;
      const current = state.portfolio.get(stock.symbol) ?? 0;
      state.portfolio.set(stock.symbol, current + qty);
      state.newsFeed.onLargeTrade(stock.symbol, true, qty, stock.price);
      const entry: ConsoleEntry = { type: 'log', text: `Acquired ${qty} ${stock.symbol} @ $${stock.price.toFixed(2)}` };
      self.consoleBuffer.push(entry);
      self.outputMap.push({ entry, stepIndex: self.executionTrace.length - 1 });
      return ctx.newString(entry.text);
    });

    fn(marketObj, 'sell', (symHandle, qtyHandle) => {
      const symbol = ctx.dump(symHandle) as string;
      const qty = ctx.dump(qtyHandle) as number;
      if (typeof symbol !== 'string' || typeof qty !== 'number') {
        return ctx.newString('Usage: market.sell("SYMBOL", quantity)');
      }
      const sym = symbol.toUpperCase();
      const owned = state.portfolio.get(sym) ?? 0;
      if (owned < qty) return ctx.newString(`Only holding ${owned} shares of ${sym}`);
      const stock = state.stockMarket.getStock(sym);
      if (!stock) return ctx.newString(`Unknown stock: ${sym}`);
      state.money += stock.price * qty;
      state.portfolio.set(sym, owned - qty);
      state.newsFeed.onLargeTrade(sym, false, qty, stock.price);
      const entry: ConsoleEntry = { type: 'log', text: `Sold ${qty} ${sym} @ $${stock.price.toFixed(2)}` };
      self.consoleBuffer.push(entry);
      self.outputMap.push({ entry, stepIndex: self.executionTrace.length - 1 });
      return ctx.newString(entry.text);
    });

    fn(marketObj, 'holdings', () => {
      const data: Record<string, number> = {};
      for (const [sym, qty] of state.portfolio) {
        if (qty > 0) data[sym] = qty;
      }
      return self.jsonToHandle(ctx, data);
    });

    fn(marketObj, 'feed', () => {
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
      return self.jsonToHandle(ctx, events);
    });

    ctx.setProp(ctx.global, 'market', marketObj);
    marketObj.dispose();

    // ── sports — sports betting ──

    const sportsObj = ctx.newObject();

    fn(sportsObj, 'leagues', () => {
      return self.jsonToHandle(ctx, state.sportsLeague.sports.map(s => ({
        id: s.id,
        name: s.name,
        phase: s.phase,
        season: s.seasonNumber,
        ticksLeft: s.phase === 'betting' ? s.phaseTicksLeft : s.roundTicksLeft,
        round: s.currentRound,
        hasBet: !!s.playerBets,
      })));
    });

    fn(sportsObj, 'roster', (idHandle) => {
      const sportId = ctx.dump(idHandle) as string;
      const sport = state.sportsLeague.getSport(sportId);
      if (!sport) return self.jsonToHandle(ctx, { error: `Unknown league: ${sportId}` });
      return self.jsonToHandle(ctx, sport.teams.map(t => ({
        id: t.id,
        name: t.name,
        rating: t.rating,
        seed: t.seed,
        wins: t.wins,
        losses: t.losses,
      })));
    });

    fn(sportsObj, 'bracket', (idHandle) => {
      const sportId = ctx.dump(idHandle) as string;
      const sport = state.sportsLeague.getSport(sportId);
      if (!sport) return self.jsonToHandle(ctx, { error: `Unknown league: ${sportId}` });
      return self.jsonToHandle(ctx, sport.bracket.map(round => ({
        name: round.name,
        matches: round.matches.map(m => ({
          team1: m.team1Id,
          team2: m.team2Id,
          winner: m.winnerId,
          played: m.played,
          score: m.score,
        })),
      })));
    });

    fn(sportsObj, 'wager', (idHandle, amtHandle, picksHandle) => {
      const sportId = ctx.dump(idHandle) as string;
      const amount = ctx.dump(amtHandle) as number;
      const picks = ctx.dump(picksHandle) as Record<string, string[]>;

      if (typeof sportId !== 'string') return ctx.newString('Usage: sports.wager("leagueId", amount, {round1: [...], ...})');
      if (typeof amount !== 'number' || amount < 100) return ctx.newString('Minimum wager is $100 per round');

      const totalCost = state.sportsLeague.calcBetCost(picks, amount);
      if (totalCost > state.money) return ctx.newString(`Insufficient funds. Need $${totalCost} ($${amount}/round), have $${state.money.toFixed(2)}`);

      const err = state.sportsLeague.placeBets(sportId, amount, picks);
      if (err) return ctx.newString(err);

      state.money -= totalCost;
      const entry: ConsoleEntry = { type: 'log', text: `Wagered $${totalCost.toLocaleString()} on ${sportId} ($${amount}/round)` };
      self.consoleBuffer.push(entry);
      self.outputMap.push({ entry, stepIndex: self.executionTrace.length - 1 });
      return ctx.newString(entry.text);
    });

    ctx.setProp(ctx.global, 'sports', sportsObj);
    sportsObj.dispose();

    // ── seti — deep space scanning ──

    const setiObj = ctx.newObject();

    fn(setiObj, 'catalogue', () => {
      return self.jsonToHandle(ctx, [
        { name: 'Alpha Centauri', distance: 4.37, type: 'G2V', signal: 0.02 },
        { name: "Barnard's Star", distance: 5.96, type: 'M4V', signal: 0.01 },
        { name: 'Wolf 359', distance: 7.86, type: 'M6.5V', signal: 0.00 },
        { name: 'Lalande 21185', distance: 8.29, type: 'M2V', signal: 0.03 },
        { name: 'Sirius', distance: 8.60, type: 'A1V', signal: 0.01 },
        { name: 'Ross 154', distance: 9.69, type: 'M3.5V', signal: 0.00 },
        { name: 'Epsilon Eridani', distance: 10.48, type: 'K2V', signal: 0.87 },
        { name: 'Ross 128', distance: 11.01, type: 'M4V', signal: 0.04 },
        { name: '61 Cygni', distance: 11.41, type: 'K5V', signal: 0.01 },
        { name: 'Tau Ceti', distance: 11.91, type: 'G8V', signal: 0.05 },
      ]);
    });

    fn(setiObj, 'scan', (nameHandle) => {
      const name = ctx.dump(nameHandle) as string;
      if (typeof name !== 'string') return ctx.newString('Usage: seti.scan("Star Name")');
      const catalogue: Record<string, { distance: number; type: string; signal: number }> = {
        'Alpha Centauri': { distance: 4.37, type: 'G2V', signal: 0.02 },
        "Barnard's Star": { distance: 5.96, type: 'M4V', signal: 0.01 },
        'Wolf 359': { distance: 7.86, type: 'M6.5V', signal: 0.00 },
        'Lalande 21185': { distance: 8.29, type: 'M2V', signal: 0.03 },
        'Sirius': { distance: 8.60, type: 'A1V', signal: 0.01 },
        'Ross 154': { distance: 9.69, type: 'M3.5V', signal: 0.00 },
        'Epsilon Eridani': { distance: 10.48, type: 'K2V', signal: 0.87 },
        'Ross 128': { distance: 11.01, type: 'M4V', signal: 0.04 },
        '61 Cygni': { distance: 11.41, type: 'K5V', signal: 0.01 },
        'Tau Ceti': { distance: 11.91, type: 'G8V', signal: 0.05 },
      };
      const star = catalogue[name];
      if (!star) return ctx.newString(`Unknown star: ${name}`);
      const result: Record<string, unknown> = {
        name,
        distance: star.distance,
        type: star.type,
        signal: star.signal,
        frequency: '1420.405 MHz',
      };
      if (star.signal > 0.5) {
        result.pattern = 'REPEATING';
        result.note = 'Strong non-natural signal detected. Possible intelligent origin.';
      } else {
        result.pattern = star.signal > 0 ? 'NOISE' : 'NONE';
        result.note = 'No anomalous signals.';
      }
      return self.jsonToHandle(ctx, result);
    });

    fn(setiObj, 'transmit', (nameHandle) => {
      const name = ctx.dump(nameHandle) as string;
      if (typeof name !== 'string') return ctx.newString('Usage: seti.transmit("Star Name")');
      if (name !== 'Epsilon Eridani') {
        const entry: ConsoleEntry = { type: 'log', text: `No anomalous signal from ${name}. Transmission aborted.` };
        self.consoleBuffer.push(entry);
        self.outputMap.push({ entry, stepIndex: self.executionTrace.length - 1 });
        return ctx.newString(entry.text);
      }
      if (state.setiTransmitted) {
        const entry: ConsoleEntry = { type: 'log', text: 'Transmission already sent to Epsilon Eridani.' };
        self.consoleBuffer.push(entry);
        self.outputMap.push({ entry, stepIndex: self.executionTrace.length - 1 });
        return ctx.newString(entry.text);
      }
      const cost = 1000000;
      if (state.money < cost) {
        const entry: ConsoleEntry = { type: 'log', text: `Insufficient funds. Deep space array costs $1,000,000. Have $${state.money.toLocaleString()}.` };
        self.consoleBuffer.push(entry);
        self.outputMap.push({ entry, stepIndex: self.executionTrace.length - 1 });
        return ctx.newString(entry.text);
      }
      state.money -= cost;
      state.setiTransmitted = true;
      state.setiTransmitYear = state.year;
      const eta = Math.round(state.year + 10.48 * 2);
      const entry: ConsoleEntry = { type: 'log', text: `Transmission sent to Epsilon Eridani (10.48 ly). Array cost: $1,000,000. Earliest reply: ~${eta}` };
      self.consoleBuffer.push(entry);
      self.outputMap.push({ entry, stepIndex: self.executionTrace.length - 1 });
      return ctx.newString(entry.text);
    });

    fn(setiObj, 'listen', () => {
      if (!state.setiTransmitted) {
        return ctx.newString('No active transmissions. Use seti.transmit() first.');
      }
      if (state.year < 2003) {
        const remaining = 2003 - state.year;
        return self.jsonToHandle(ctx, {
          status: 'WAITING',
          message: `Signal in transit. Estimated ${remaining} years until reply.`,
          targetYear: 2003,
        });
      }
      // The alien reply — an encrypted message using a shift cipher (key = 7)
      const plaintext = 'WE HAVE WATCHED YOUR STAR FOR AGES. YOU ARE NOT ALONE. SEEK THE PATTERN IN PI.';
      const encrypted = plaintext.split('').map(c => {
        if (c >= 'A' && c <= 'Z') {
          return String.fromCharCode(((c.charCodeAt(0) - 65 + 7) % 26) + 65);
        }
        return c;
      }).join('');
      return self.jsonToHandle(ctx, {
        status: 'SIGNAL_RECEIVED',
        source: 'Epsilon Eridani',
        distance: 10.48,
        encrypted,
        encoding: 'SHIFTED_ALPHA',
        hint: 'Frequency offset suggests a Caesar cipher. The hydrogen line number (atomic number 1, mass 7) may hold the key.',
      });
    });

    ctx.setProp(ctx.global, 'seti', setiObj);
    setiObj.dispose();
  }

  isReady(): boolean {
    return this.ready;
  }

  dispose(): void {
    this.ctx?.dispose();
    this.runtime?.dispose();
  }
}
