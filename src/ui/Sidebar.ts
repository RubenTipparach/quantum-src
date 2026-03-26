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
        <h3>Research Tree</h3>
        <button class="sidebar-btn" id="btn-view-tree" style="margin-bottom:8px;text-align:center;background:#0a1220;border-color:#2244aa;color:#6688ff;">
          View Full Tree
        </button>
        <div id="sb-research"></div>
      </div>
    `;

    this.el.querySelector('#btn-view-tree')?.addEventListener('click', () => {
      this.showResearchModal();
    });

    this.update();
  }

  private showResearchModal(): void {
    // Remove existing modal if any
    document.getElementById('research-modal')?.remove();

    const s = this.state;
    const modal = document.createElement('div');
    modal.id = 'research-modal';
    modal.innerHTML = `
      <div class="rm-backdrop"></div>
      <div class="rm-content">
        <div class="rm-header">
          <span>Research Tree</span>
          <button class="rm-close">&times;</button>
        </div>
        <div class="rm-body">
          <canvas id="research-canvas"></canvas>
        </div>
      </div>
    `;

    // Styles injected inline for the modal
    const style = document.createElement('style');
    style.textContent = `
      #research-modal { position:fixed;top:0;left:0;width:100%;height:100%;z-index:1000;display:flex;align-items:center;justify-content:center; }
      .rm-backdrop { position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8); }
      .rm-content { position:relative;width:90%;max-width:900px;height:80%;background:#0a0a18;border:1px solid #1a3a2a;border-radius:8px;display:flex;flex-direction:column;overflow:hidden; }
      .rm-header { display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#060610;border-bottom:1px solid #1a3a2a;color:#00ff88;font-size:14px;font-weight:bold;letter-spacing:1px; }
      .rm-close { background:none;border:none;color:#668877;font-size:24px;cursor:pointer;font-family:inherit; }
      .rm-close:hover { color:#ff5555; }
      .rm-body { flex:1;overflow:auto;position:relative; }
      #research-canvas { display:block; }
    `;
    modal.appendChild(style);
    document.body.appendChild(modal);

    // Close handlers
    modal.querySelector('.rm-backdrop')!.addEventListener('click', () => modal.remove());
    modal.querySelector('.rm-close')!.addEventListener('click', () => modal.remove());

    // Draw the tree on canvas
    this.drawResearchTree(modal);
  }

  private drawResearchTree(modal: HTMLElement): void {
    const canvas = modal.querySelector('#research-canvas') as HTMLCanvasElement;
    const body = modal.querySelector('.rm-body') as HTMLElement;
    const ctx = canvas.getContext('2d')!;

    const s = this.state;
    const nodes = s.researchTree;

    // Group nodes by era
    const eraOrder = ['dawn', 'crypto', 'quantum', 'subatomic', 'postscarcity'];
    const eraLabels: Record<string, string> = {
      dawn: 'Dawn of Computing',
      crypto: 'Crypto Revolution',
      quantum: 'Quantum Disruption',
      subatomic: 'Sub-Atomic Ascendancy',
      postscarcity: 'Post-Scarcity',
    };
    const eraGroups = new Map<string, typeof nodes>();
    for (const era of eraOrder) {
      eraGroups.set(era, nodes.filter(n => n.era === era));
    }

    // Layout
    const nodeW = 160;
    const nodeH = 60;
    const colGap = 40;
    const rowGap = 30;
    const eraGap = 50;
    const padX = 40;
    const padY = 40;

    // Position each node
    const positions = new Map<string, { x: number; y: number }>();
    let curY = padY;

    for (const era of eraOrder) {
      const group = eraGroups.get(era) ?? [];
      if (group.length === 0) continue;

      curY += 25; // era label space
      const startY = curY;
      let maxRowHeight = 0;

      for (let i = 0; i < group.length; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = padX + col * (nodeW + colGap);
        const y = startY + row * (nodeH + rowGap);
        positions.set(group[i]!.id, { x, y });
        maxRowHeight = Math.max(maxRowHeight, y + nodeH);
      }

      curY = maxRowHeight + eraGap;
    }

    const totalW = padX * 2 + nodeW * 2 + colGap;
    const totalH = curY + padY;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalW * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = totalW + 'px';
    canvas.style.height = totalH + 'px';
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, totalW, totalH);

    // Draw era labels
    curY = padY;
    ctx.font = '11px Courier New';
    for (const era of eraOrder) {
      const group = eraGroups.get(era) ?? [];
      if (group.length === 0) continue;
      ctx.fillStyle = '#334466';
      ctx.fillText((eraLabels[era] ?? era).toUpperCase(), padX, curY + 12);
      curY += 25;
      for (let i = 0; i < group.length; i++) {
        const row = Math.floor(i / 2);
        if (i % 2 === 0) curY = Math.max(curY, (positions.get(group[i]!.id)?.y ?? 0) + nodeH + rowGap);
      }
      // Find bottom of this era's nodes
      const maxY = Math.max(...group.map(n => (positions.get(n.id)?.y ?? 0) + nodeH));
      curY = maxY + eraGap;
    }

    // Draw connections
    for (const node of nodes) {
      const to = positions.get(node.id);
      if (!to) continue;
      for (const preId of node.prerequisites) {
        const from = positions.get(preId);
        if (!from) continue;
        ctx.strokeStyle = node.researched ? '#00ff8844' : node.unlocked ? '#33665544' : '#1a2a2244';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(from.x + nodeW / 2, from.y + nodeH);
        ctx.lineTo(to.x + nodeW / 2, to.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      // Background
      if (node.researched) {
        ctx.fillStyle = '#0a2a18';
        ctx.strokeStyle = '#00ff88';
      } else if (node.unlocked) {
        ctx.fillStyle = '#0a1a22';
        ctx.strokeStyle = '#336655';
      } else {
        ctx.fillStyle = '#0a0a12';
        ctx.strokeStyle = '#1a2a22';
      }
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(pos.x, pos.y, nodeW, nodeH, 4);
      ctx.fill();
      ctx.stroke();

      // Name
      ctx.fillStyle = node.researched ? '#00ff88' : node.unlocked ? '#88bbaa' : '#334455';
      ctx.font = 'bold 10px Courier New';
      ctx.fillText(node.name, pos.x + 8, pos.y + 16, nodeW - 16);

      // Status line
      ctx.font = '9px Courier New';
      if (node.researched) {
        ctx.fillStyle = '#006633';
        ctx.fillText('[DONE]', pos.x + 8, pos.y + 30);
      } else if (node.unlocked) {
        ctx.fillStyle = '#ffaa22';
        ctx.fillText(`$${node.cost.toLocaleString()}`, pos.x + 8, pos.y + 30);
        ctx.fillStyle = '#6688ff';
        ctx.fillText(`+${node.yearAdvance}yr`, pos.x + 90, pos.y + 30);
      } else {
        ctx.fillStyle = '#222233';
        ctx.fillText('[LOCKED]', pos.x + 8, pos.y + 30);
      }

      // Description (truncated)
      ctx.fillStyle = node.researched ? '#336655' : node.unlocked ? '#446655' : '#1a2a22';
      ctx.font = '8px Courier New';
      const desc = node.description.length > 35 ? node.description.slice(0, 33) + '...' : node.description;
      ctx.fillText(desc, pos.x + 8, pos.y + 46, nodeW - 16);
    }
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
      const style = canAfford ? '' : 'opacity:0.6;';
      html.push(`<button class="sidebar-btn research-btn" style="${style}" data-id="${n.id}" title="${n.description}">
        ${n.name}
        <span class="cost">$${n.cost.toLocaleString()}</span>
        <span class="year-advance">+${n.yearAdvance}yr</span>
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

        // Advance time
        s.advanceYear(node.yearAdvance);

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
        this.console.appendSystem(`${node.yearAdvance} years pass... Now year ${s.year}. Era: ${s.getEraName()}`);
      });
    });
  }
}
