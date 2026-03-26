import type { GameState } from '../game/GameState';
import type { ConsoleOutput } from './ConsoleOutput';

export class Sidebar {
  private el: HTMLDivElement;
  private state: GameState;
  private console: ConsoleOutput;
  private prevPrices: Map<string, number> = new Map();

  constructor(el: HTMLDivElement, state: GameState, console: ConsoleOutput) {
    this.el = el;
    this.state = state;
    this.console = console;
    // Snapshot initial prices
    for (const s of state.stockMarket.stocks) {
      this.prevPrices.set(s.symbol, s.price);
    }
    this.render();
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="sb-header">QUANTUM SRC</div>

      <div class="sb-section">
        <h3>System Status</h3>
        <div class="stat-row"><span>Year</span><span class="val" id="sb-year">1983</span></div>
        <div class="stat-row"><span>Era</span><span class="val era" id="sb-era">Dawn of Computing</span></div>
        <div class="stat-row"><span>Money</span><span class="val money" id="sb-money">$1,000</span></div>
        <div class="stat-row"><span>Energy</span><span class="val energy" id="sb-energy">100 / 100 kWh</span></div>
        <div class="stat-row"><span>Compute</span><span class="val" id="sb-compute">CPU x1</span></div>
      </div>

      <div class="sb-section">
        <h3>Stock Market</h3>
        <div id="sb-stocks"></div>
      </div>

      <div class="sb-section">
        <h3>Portfolio</h3>
        <div id="sb-portfolio"><div class="stat-row" style="color:#334455;">No holdings</div></div>
      </div>

      <div class="sb-section">
        <h3>Actions</h3>
        <button class="sidebar-btn" id="btn-advance1">Advance 1 Year</button>
        <button class="sidebar-btn" id="btn-advance5">Advance 5 Years</button>
        <button class="sidebar-btn" id="btn-advance25">Advance 25 Years</button>
      </div>

      <div class="sb-section">
        <h3>Research Tree</h3>
        <div id="sb-research"></div>
      </div>
    `;

    this.bindButtons();
    this.update();
  }

  private bindButtons(): void {
    const bind = (id: string, fn: () => void) => {
      this.el.querySelector(`#${id}`)?.addEventListener('click', fn);
    };

    bind('btn-advance1', () => {
      this.state.advanceYear(1);
      this.console.appendSystem(`Year ${this.state.year}. Era: ${this.state.getEraName()}`);
    });

    bind('btn-advance5', () => {
      this.state.advanceYear(5);
      this.console.appendSystem(`Year ${this.state.year}. Era: ${this.state.getEraName()}`);
    });

    bind('btn-advance25', () => {
      this.state.advanceYear(25);
      this.console.appendSystem(`Year ${this.state.year}. Era: ${this.state.getEraName()}`);
    });
  }

  update(): void {
    const s = this.state;
    const setText = (id: string, text: string) => {
      const node = this.el.querySelector(`#${id}`);
      if (node) node.textContent = text;
    };

    setText('sb-year', String(s.year));
    setText('sb-era', s.getEraName());
    setText('sb-money', `$${s.money.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    setText('sb-energy', `${Math.round(s.energy)} / ${s.totalEnergyCapacity} kWh`);
    setText('sb-compute', s.getComputeLabel());

    this.updateStocks();
    this.updatePortfolio();
    this.updateResearch();
  }

  private updateStocks(): void {
    const el = this.el.querySelector('#sb-stocks');
    if (!el) return;

    el.innerHTML = this.state.stockMarket.stocks.map(st => {
      const prev = this.prevPrices.get(st.symbol) ?? st.price;
      const diff = st.price - prev;
      const pct = prev > 0 ? (diff / prev) * 100 : 0;
      const cls = diff >= 0 ? 'up' : 'down';
      const sign = diff >= 0 ? '+' : '';
      return `<div class="stock-row">
        <span class="sym">${st.symbol}</span>
        <span class="price">$${st.price.toFixed(2)}</span>
        <span class="change ${cls}">${sign}${pct.toFixed(1)}%</span>
      </div>`;
    }).join('');

    // Update prev prices for next tick
    for (const st of this.state.stockMarket.stocks) {
      this.prevPrices.set(st.symbol, st.price);
    }
  }

  private updatePortfolio(): void {
    const el = this.el.querySelector('#sb-portfolio');
    if (!el) return;

    const entries: string[] = [];
    let totalValue = 0;

    for (const [sym, qty] of this.state.portfolio) {
      if (qty <= 0) continue;
      const stock = this.state.stockMarket.getStock(sym);
      const val = stock ? stock.price * qty : 0;
      totalValue += val;
      entries.push(`<div class="portfolio-row">
        <span>${sym} <span class="shares">x${qty}</span></span>
        <span class="value">$${val.toFixed(2)}</span>
      </div>`);
    }

    if (entries.length === 0) {
      el.innerHTML = '<div class="stat-row" style="color:#334455;">No holdings</div>';
    } else {
      entries.push(`<div class="portfolio-row" style="border-top:1px solid #1a3a2a;margin-top:4px;padding-top:4px;">
        <span style="color:#668877;">Total</span>
        <span class="value">$${totalValue.toFixed(2)}</span>
      </div>`);
      el.innerHTML = entries.join('');
    }
  }

  private updateResearch(): void {
    const el = this.el.querySelector('#sb-research');
    if (!el) return;

    const s = this.state;
    const available = s.researchTree.filter(n => !n.researched && n.unlocked);
    const done = s.researchTree.filter(n => n.researched);
    const locked = s.researchTree.filter(n => !n.researched && !n.unlocked);

    const html: string[] = [];

    for (const n of available) {
      const canAfford = s.money >= n.cost;
      const cls = canAfford ? 'sidebar-btn research-btn' : 'sidebar-btn research-btn';
      const style = canAfford ? '' : 'opacity:0.6;';
      html.push(`<button class="${cls}" style="${style}" data-id="${n.id}" title="${n.description}">
        ${n.name} <span class="cost">$${n.cost.toLocaleString()}</span>
      </button>`);
    }

    if (done.length > 0) {
      for (const n of done) {
        html.push(`<div class="research-done">[DONE] ${n.name}</div>`);
      }
    }

    if (locked.length > 0) {
      html.push(`<div class="research-locked" style="margin-top:4px;">${locked.length} locked</div>`);
    }

    el.innerHTML = html.join('');

    // Bind research buttons
    el.querySelectorAll('.research-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset['id']!;
        const node = s.researchTree.find(n => n.id === id);
        if (!node) return;
        if (s.money < node.cost) {
          this.console.appendError(`Need $${node.cost.toLocaleString()}, have $${s.money.toLocaleString()}`);
          return;
        }
        s.money -= node.cost;
        node.researched = true;
        // Unlock dependents
        for (const other of s.researchTree) {
          if (!other.unlocked && other.prerequisites.every(
            p => s.researchTree.find(n2 => n2.id === p)?.researched
          )) {
            other.unlocked = true;
          }
        }
        this.console.appendSystem(`Researched: ${node.name}!`);
        this.console.appendLog(node.description);
      });
    });
  }
}
