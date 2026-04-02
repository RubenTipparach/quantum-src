import type { GameState } from '../game/GameState';
import type { ConsoleOutput } from './ConsoleOutput';
import type { Mission } from '../game/missions/Missions';
import { BracketView } from './BracketView';

export class Sidebar {
  private el: HTMLDivElement;
  private state: GameState;
  private console: ConsoleOutput;
  private prevPrices: Map<string, number> = new Map();
  private onLoadMission: ((mission: Mission) => void) | null = null;

  constructor(el: HTMLDivElement, state: GameState, console: ConsoleOutput) {
    this.el = el;
    this.state = state;
    this.console = console;
    for (const s of state.stockMarket.stocks) {
      this.prevPrices.set(s.symbol, s.price);
    }
    this.render();
  }

  setOnLoadMission(fn: (mission: Mission) => void): void {
    this.onLoadMission = fn;
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="sb-header">QUANTUM SRC</div>

      <div class="sb-section">
        <h3>System Status</h3>
        <div class="stat-row"><span>Year</span><span class="val" id="sb-year">1983</span></div>
        <div class="stat-row"><span>Era</span><span class="val era" id="sb-era">Dawn of Computing</span></div>
        <div class="stat-row"><span>Money</span><span class="val money" id="sb-money">$1,000</span></div>
        <div class="stat-row"><span>Credits</span><span class="val" id="sb-credits" style="color:#aa88ff;">0</span></div>
        <div class="stat-row"><span>Energy</span><span class="val energy" id="sb-energy">100 / 100 kWh</span></div>
        <div class="stat-row"><span>Compute</span><span class="val" id="sb-compute">CPU x1</span></div>
        <div class="stat-row"><span>RAM</span><span class="val" id="sb-ram">640KB</span></div>
      </div>

      <div class="sb-section">
        <h3>Missions</h3>
        <div id="sb-missions"></div>
      </div>

      <div class="sb-section">
        <h3>Stock Market</h3>
        <div id="sb-stocks"></div>
      </div>

      <div class="sb-section">
        <h3>News Feed</h3>
        <div id="sb-news"><div class="stat-row" style="color:#334455;">No news yet...</div></div>
      </div>

      <div class="sb-section">
        <h3>Portfolio</h3>
        <div id="sb-portfolio"><div class="stat-row" style="color:#334455;">No holdings</div></div>
      </div>

      <div class="sb-section">
        <h3>Sports & Betting</h3>
        <div id="sb-sports"></div>
      </div>

      <div class="sb-section">
        <h3>Shop</h3>
        <div id="sb-shop"></div>
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
    document.getElementById('research-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'research-modal';
    modal.innerHTML = `
      <div class="rm-backdrop"></div>
      <div class="rm-content">
        <div class="rm-header"><span>Research Tree</span><button class="rm-close">&times;</button></div>
        <div class="rm-body"><canvas id="research-canvas"></canvas></div>
      </div>
    `;
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
    modal.querySelector('.rm-backdrop')!.addEventListener('click', () => modal.remove());
    modal.querySelector('.rm-close')!.addEventListener('click', () => modal.remove());
    this.drawResearchTree(modal);
  }

  private drawResearchTree(modal: HTMLElement): void {
    const canvas = modal.querySelector('#research-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const s = this.state;
    const nodes = s.researchTree;
    const eraOrder = ['dawn', 'crypto', 'quantum', 'subatomic', 'postscarcity'];
    const eraLabels: Record<string, string> = {
      dawn: 'Dawn of Computing', crypto: 'Crypto Revolution', quantum: 'Quantum Disruption',
      subatomic: 'Sub-Atomic Ascendancy', postscarcity: 'Post-Scarcity',
    };
    const eraGroups = new Map<string, typeof nodes>();
    for (const era of eraOrder) eraGroups.set(era, nodes.filter(n => n.era === era));

    const nodeW = 160, nodeH = 60, colGap = 40, rowGap = 30, eraGap = 50, padX = 40, padY = 40;
    const positions = new Map<string, { x: number; y: number }>();
    let curY = padY;
    for (const era of eraOrder) {
      const group = eraGroups.get(era) ?? [];
      if (group.length === 0) continue;
      curY += 25;
      const startY = curY;
      let maxRowHeight = 0;
      for (let i = 0; i < group.length; i++) {
        const x = padX + (i % 2) * (nodeW + colGap);
        const y = startY + Math.floor(i / 2) * (nodeH + rowGap);
        positions.set(group[i]!.id, { x, y });
        maxRowHeight = Math.max(maxRowHeight, y + nodeH);
      }
      curY = maxRowHeight + eraGap;
    }

    const totalW = padX * 2 + nodeW * 2 + colGap, totalH = curY + padY;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalW * dpr; canvas.height = totalH * dpr;
    canvas.style.width = totalW + 'px'; canvas.style.height = totalH + 'px';
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#0a0a18'; ctx.fillRect(0, 0, totalW, totalH);

    // Era labels
    curY = padY; ctx.font = '11px Courier New';
    for (const era of eraOrder) {
      const group = eraGroups.get(era) ?? [];
      if (group.length === 0) continue;
      ctx.fillStyle = '#334466';
      ctx.fillText((eraLabels[era] ?? era).toUpperCase(), padX, curY + 12);
      const maxY = Math.max(...group.map(n => (positions.get(n.id)?.y ?? 0) + nodeH));
      curY = maxY + eraGap;
    }

    // Connections
    for (const node of nodes) {
      const to = positions.get(node.id); if (!to) continue;
      for (const preId of node.prerequisites) {
        const from = positions.get(preId); if (!from) continue;
        ctx.strokeStyle = node.researched ? '#00ff8844' : node.unlocked ? '#33665544' : '#1a2a2244';
        ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(from.x + nodeW / 2, from.y + nodeH);
        ctx.lineTo(to.x + nodeW / 2, to.y); ctx.stroke();
      }
    }

    // Nodes
    for (const node of nodes) {
      const pos = positions.get(node.id); if (!pos) continue;
      ctx.fillStyle = node.researched ? '#0a2a18' : node.unlocked ? '#0a1a22' : '#0a0a12';
      ctx.strokeStyle = node.researched ? '#00ff88' : node.unlocked ? '#336655' : '#1a2a22';
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(pos.x, pos.y, nodeW, nodeH, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = node.researched ? '#00ff88' : node.unlocked ? '#88bbaa' : '#334455';
      ctx.font = 'bold 10px Courier New'; ctx.fillText(node.name, pos.x + 8, pos.y + 16, nodeW - 16);
      ctx.font = '9px Courier New';
      if (node.researched) { ctx.fillStyle = '#006633'; ctx.fillText('[DONE]', pos.x + 8, pos.y + 30); }
      else if (node.unlocked) {
        ctx.fillStyle = '#aa88ff'; ctx.fillText(`${node.creditsCost} credits`, pos.x + 8, pos.y + 30);
        ctx.fillStyle = '#6688ff'; ctx.fillText(`+${node.yearAdvance}yr`, pos.x + 100, pos.y + 30);
      } else { ctx.fillStyle = '#222233'; ctx.fillText('[LOCKED]', pos.x + 8, pos.y + 30); }
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
    setText('sb-credits', String(s.researchCredits));
    setText('sb-energy', `${Math.round(s.energy)} / ${s.totalEnergyCapacity} kWh`);
    setText('sb-compute', s.getComputeLabel());
    const ramStr = s.hardware.ram >= 1024 ? `${(s.hardware.ram / 1024).toFixed(0)}GB` : s.hardware.ram >= 1 ? `${s.hardware.ram}MB` : `${Math.round(s.hardware.ram * 1024)}KB`;
    setText('sb-ram', ramStr);

    this.updateStocks();
    this.updateNews();
    this.updatePortfolio();
    this.updateSports();
    this.updateMissions();
    this.updateShop();
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
      const escaped = st.description.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      const sectorLabel = st.sector.charAt(0).toUpperCase() + st.sector.slice(1);
      return `<div class="stock-row">
        <span class="sym stock-tag" data-tooltip="${st.name}\n${sectorLabel} sector\n\n${escaped}">${st.symbol}</span>
        <span class="price">$${st.price.toFixed(2)}</span>
        <span class="change ${cls}">${sign}${pct.toFixed(1)}%</span>
      </div>`;
    }).join('');
    for (const st of this.state.stockMarket.stocks) this.prevPrices.set(st.symbol, st.price);
  }

  private updateNews(): void {
    const el = this.el.querySelector('#sb-news');
    if (!el) return;
    const events = this.state.newsFeed.getRecentEvents();
    if (events.length === 0) {
      el.innerHTML = '<div class="stat-row" style="color:#334455;">No news yet...</div>';
      return;
    }
    el.innerHTML = events.slice(0, 8).map(ev => {
      const isActive = ev.remaining > 0;
      const isBullish = ev.impact > 0;
      const icon = ev.category === 'world' ? '&#127758;'
        : ev.category === 'ceo' ? '&#128100;'
        : ev.category === 'research' ? '&#128300;'
        : ev.category === 'market' ? '&#128200;'
        : ev.category === 'sector' ? '&#128202;'
        : '&#127970;';
      const impactColor = isBullish ? '#00cc66' : '#dd3333';
      const opacity = isActive ? '1' : '0.4';
      const activeIndicator = isActive ? `<span class="news-active" style="color:${impactColor};">&#9679;</span>` : '';
      return `<div class="news-item" style="opacity:${opacity};">
        <span class="news-icon">${icon}</span>
        <span class="news-text">${ev.headline}</span>
        ${activeIndicator}
      </div>`;
    }).join('');
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
      const desc = stock ? stock.description.replace(/'/g, '&#39;').replace(/"/g, '&quot;') : '';
      const sectorLabel = stock ? stock.sector.charAt(0).toUpperCase() + stock.sector.slice(1) : '';
      const tooltip = stock ? `${stock.name}\n${sectorLabel} sector\n\n${desc}` : sym;
      entries.push(`<div class="portfolio-row"><span><span class="stock-tag" data-tooltip="${tooltip}">${sym}</span> <span class="shares">x${qty}</span></span><span class="value">$${val.toFixed(2)}</span></div>`);
    }
    if (entries.length === 0) {
      el.innerHTML = '<div class="stat-row" style="color:#334455;">No holdings</div>';
    } else {
      entries.push(`<div class="portfolio-row" style="border-top:1px solid #1a3a2a;margin-top:4px;padding-top:4px;"><span style="color:#668877;">Total</span><span class="value">$${totalValue.toFixed(2)}</span></div>`);
      el.innerHTML = entries.join('');
    }
  }

  private updateSports(): void {
    const el = this.el.querySelector('#sb-sports');
    if (!el) return;
    const sports = this.state.sportsLeague.sports;

    el.innerHTML = sports.map(sport => {
      let phaseText: string;
      let phaseColor: string;
      if (sport.phase === 'betting') {
        const secs = Math.ceil(sport.phaseTicksLeft * 1.5);
        phaseText = `BETTING ${secs}s`;
        phaseColor = '#ffaa22';
      } else if (sport.phase === 'playing') {
        phaseText = sport.bracket[sport.currentRound]?.name ?? 'Playing';
        phaseColor = '#00ff88';
      } else {
        phaseText = 'COMPLETE';
        phaseColor = '#6688ff';
      }

      const betStatus = sport.playerBets
        ? (sport.playerBets.payout > 0
          ? `<span style="color:#00ff88;">+$${sport.playerBets.payout.toLocaleString()}</span>`
          : '<span style="color:#668877;">Bet placed</span>')
        : (sport.phase === 'betting'
          ? '<span style="color:#ffaa22;">No bet</span>'
          : '<span style="color:#334455;">—</span>');

      return `<button class="sidebar-btn sport-btn" data-sport="${sport.id}" style="border-color:#2a3a4a55;">
        <span style="display:flex;justify-content:space-between;align-items:center;">
          <span>${sport.icon} ${sport.name} S${sport.seasonNumber}</span>
          <span style="font-size:9px;color:${phaseColor};">${phaseText}</span>
        </span>
        <span style="display:flex;justify-content:space-between;font-size:9px;margin-top:2px;">
          ${betStatus}
          <span style="color:#446666;">View Bracket</span>
        </span>
      </button>`;
    }).join('');

    el.querySelectorAll('.sport-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sportId = (btn as HTMLElement).dataset['sport']!;
        const sport = this.state.sportsLeague.getSport(sportId);
        if (sport) BracketView.show(sport);
      });
    });
  }

  private updateMissions(): void {
    const el = this.el.querySelector('#sb-missions');
    if (!el) return;
    const s = this.state;
    const available = s.getAvailableMissions();
    const done = s.missions.filter(m => m.completed);
    const html: string[] = [];

    for (const m of available) {
      html.push(`<button class="sidebar-btn mission-btn" data-id="${m.id}" title="${m.hint}" style="border-color:#aa88ff55;">
        <span style="color:#aa88ff;">${m.name}</span>
        <span class="cost" style="color:#aa88ff;">${m.researchCredits} cr</span>
        <span class="year-advance" style="color:#668877;font-size:9px;">${m.description}</span>
      </button>`);
    }

    if (done.length > 0) {
      html.push(`<div style="margin-top:4px;">`);
      for (const m of done) {
        html.push(`<div class="research-done" style="color:#6644aa;">[DONE] ${m.name}</div>`);
      }
      html.push(`</div>`);
    }

    if (available.length === 0 && done.length === 0) {
      html.push('<div class="stat-row" style="color:#334455;">No missions yet</div>');
    }

    el.innerHTML = html.join('');

    el.querySelectorAll('.mission-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset['id']!;
        const mission = s.missions.find(m => m.id === id);
        if (mission && this.onLoadMission) {
          this.onLoadMission(mission);
        }
      });
    });
  }

  private updateShop(): void {
    const el = this.el.querySelector('#sb-shop');
    if (!el) return;
    const s = this.state;
    const available = s.shop.getAvailable(s.year);
    const html: string[] = [];

    if (available.length === 0) {
      html.push('<div class="stat-row" style="color:#334455;">No items available</div>');
    }

    for (const item of available.slice(0, 8)) { // show max 8
      const canAfford = s.money >= item.cost;
      const style = canAfford ? '' : 'opacity:0.6;';
      html.push(`<button class="sidebar-btn shop-btn" style="${style}border-color:#44aa5555;" data-id="${item.id}" title="${item.description}">
        ${item.name}
        <span class="cost" style="color:#44dd88;">$${item.cost.toLocaleString()}</span>
        <span class="year-advance" style="color:#668877;font-size:9px;">${item.description}</span>
      </button>`);
    }

    el.innerHTML = html.join('');

    el.querySelectorAll('.shop-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset['id']!;
        const result = s.shop.purchase(id, s);
        if (result.startsWith('Purchased')) {
          this.console.appendSystem(result);
          s.save();
        } else {
          this.console.appendError(result);
        }
      });
    });
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
      const canAfford = s.researchCredits >= n.creditsCost;
      const style = canAfford ? '' : 'opacity:0.6;';
      html.push(`<button class="sidebar-btn research-btn" style="${style}" data-id="${n.id}" title="${n.description}">
        ${n.name}
        <span class="cost" style="color:#aa88ff;">${n.creditsCost} credits</span>
        <span class="year-advance">+${n.yearAdvance}yr</span>
      </button>`);
    }

    if (done.length > 0) {
      for (const n of done) html.push(`<div class="research-done">[DONE] ${n.name}</div>`);
    }
    if (locked.length > 0) html.push(`<div class="research-locked" style="margin-top:4px;">${locked.length} locked</div>`);

    el.innerHTML = html.join('');

    el.querySelectorAll('.research-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset['id']!;
        const node = s.researchTree.find(n => n.id === id);
        if (!node) return;
        if (s.researchCredits < node.creditsCost) {
          this.console.appendError(`Need ${node.creditsCost} credits, have ${s.researchCredits}. Complete missions to earn credits.`);
          return;
        }
        s.researchCredits -= node.creditsCost;
        node.researched = true;
        s.newsFeed.onResearchCompleted(node);
        s.advanceYear(node.yearAdvance);
        for (const other of s.researchTree) {
          if (!other.unlocked && other.prerequisites.every(p => s.researchTree.find(n2 => n2.id === p)?.researched)) {
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
