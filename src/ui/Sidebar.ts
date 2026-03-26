import type { GameState } from '../game/GameState';
import type { ConsoleOutput } from './ConsoleOutput';

export class Sidebar {
  private el: HTMLDivElement;
  private state: GameState;
  private console: ConsoleOutput;

  constructor(el: HTMLDivElement, state: GameState, console: ConsoleOutput) {
    this.el = el;
    this.state = state;
    this.console = console;
    this.render();
  }

  private render(): void {
    this.el.innerHTML = `
      <h2>STATUS</h2>
      <div class="stat">Year: <span id="sb-year">1983</span></div>
      <div class="stat">Money: $<span id="sb-money">1,000</span></div>
      <div class="stat">Energy: <span id="sb-energy">100</span> kWh</div>
      <div class="stat">Compute: <span id="sb-compute">CPU x1</span></div>
      <div class="stat">Era: <span id="sb-era">Dawn of Computing</span></div>

      <h2>MARKET</h2>
      <div class="sidebar-section" id="sb-stocks"></div>
      <div class="sidebar-section" style="margin-top:4px;">
        <button class="sidebar-btn" id="btn-market">View Quotes</button>
        <button class="sidebar-btn" id="btn-portfolio">Portfolio</button>
      </div>

      <h2>ACTIONS</h2>
      <div class="sidebar-section">
        <button class="sidebar-btn" id="btn-status">Status Report</button>
        <button class="sidebar-btn" id="btn-advance1">Advance 1 Year</button>
        <button class="sidebar-btn" id="btn-advance5">Advance 5 Years</button>
      </div>

      <h2>RESEARCH</h2>
      <div class="sidebar-section" id="sb-research"></div>
    `;

    this.bindButtons();
  }

  private bindButtons(): void {
    const bind = (id: string, fn: () => void) => {
      this.el.querySelector(`#${id}`)?.addEventListener('click', fn);
    };

    bind('btn-market', () => {
      this.console.appendSystem(this.state.stockMarket.getQuotes());
    });

    bind('btn-portfolio', () => {
      const p = this.state.portfolio;
      if (p.size === 0) {
        this.console.appendSystem('Portfolio is empty.');
        return;
      }
      const lines: string[] = ['Portfolio:'];
      let total = 0;
      for (const [sym, qty] of p) {
        if (qty <= 0) continue;
        const stock = this.state.stockMarket.getStock(sym);
        const val = stock ? stock.price * qty : 0;
        total += val;
        lines.push(`  ${sym}: ${qty} shares ($${val.toFixed(2)})`);
      }
      lines.push(`  Total: $${total.toFixed(2)}`);
      this.console.appendSystem(lines.join('\n'));
    });

    bind('btn-status', () => {
      const s = this.state;
      this.console.appendSystem(
        `Year: ${s.year} | Money: $${s.money.toLocaleString()} | Energy: ${s.energy}/${s.totalEnergyCapacity} kWh | ${s.getComputeLabel()} | ${s.getEraName()}`
      );
    });

    bind('btn-advance1', () => {
      this.state.advanceYear(1);
      this.console.appendSystem(`Advanced to year ${this.state.year}. Era: ${this.state.getEraName()}`);
    });

    bind('btn-advance5', () => {
      this.state.advanceYear(5);
      this.console.appendSystem(`Advanced to year ${this.state.year}. Era: ${this.state.getEraName()}`);
    });
  }

  update(): void {
    const s = this.state;
    const el = (id: string) => this.el.querySelector(`#${id}`);
    const setText = (id: string, text: string) => {
      const node = el(id);
      if (node) node.textContent = text;
    };

    setText('sb-year', String(s.year));
    setText('sb-money', s.money.toLocaleString());
    setText('sb-energy', String(Math.round(s.energy)));
    setText('sb-compute', s.getComputeLabel());
    setText('sb-era', s.getEraName());

    // Stock tickers
    const stocksEl = el('sb-stocks');
    if (stocksEl) {
      stocksEl.innerHTML = s.stockMarket.stocks
        .map(st => `<div class="stat" style="font-size:11px;">${st.symbol}: $${st.price.toFixed(2)}</div>`)
        .join('');
    }

    // Research buttons
    const researchEl = el('sb-research');
    if (researchEl) {
      const available = s.researchTree.filter(n => !n.researched && n.unlocked);
      const done = s.researchTree.filter(n => n.researched);
      researchEl.innerHTML =
        available.map(n =>
          `<button class="sidebar-btn research-btn" data-id="${n.id}" title="${n.description}">
            ${n.name} ($${n.cost.toLocaleString()})
          </button>`
        ).join('') +
        done.map(n =>
          `<div class="stat" style="font-size:11px;color:#557799;">[DONE] ${n.name}</div>`
        ).join('');

      researchEl.querySelectorAll('.research-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset['id']!;
          const node = s.researchTree.find(n => n.id === id)!;
          if (s.money < node.cost) {
            this.console.appendError(`Not enough money. Need $${node.cost.toLocaleString()}`);
            return;
          }
          s.money -= node.cost;
          node.researched = true;
          // Unlock dependents
          for (const other of s.researchTree) {
            if (!other.unlocked && other.prerequisites.every(
              p => s.researchTree.find(n => n.id === p)?.researched
            )) {
              other.unlocked = true;
            }
          }
          this.console.appendSystem(`Researched: ${node.name}! ${node.description}`);
        });
      });
    }
  }
}
