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
  private tooltipEl: HTMLDivElement;

  constructor(el: HTMLDivElement, state: GameState, console: ConsoleOutput) {
    this.el = el;
    this.state = state;
    this.console = console;
    for (const s of state.stockMarket.stocks) {
      this.prevPrices.set(s.symbol, s.price);
    }

    // Create shared tooltip element
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'stock-tooltip';
    this.tooltipEl.style.display = 'none';
    document.body.appendChild(this.tooltipEl);

    const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Global listener to dismiss tooltip on outside tap/click
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.stock-tag') && !target.closest('.stock-tooltip')) {
        this.tooltipEl.style.display = 'none';
      }
    });

    // Desktop: hover to show, mouseleave to hide
    this.el.addEventListener('mouseover', (e) => {
      if (isTouchDevice()) return;
      const tag = (e.target as HTMLElement).closest('.stock-tag') as HTMLElement | null;
      if (tag) this.showTooltip(tag);
    });
    this.el.addEventListener('mouseleave', () => {
      if (isTouchDevice()) return;
      this.tooltipEl.style.display = 'none';
    });
    // Hide when mouse moves to a non-tag area within sidebar
    this.el.addEventListener('mouseover', (e) => {
      if (isTouchDevice()) return;
      const tag = (e.target as HTMLElement).closest('.stock-tag') as HTMLElement | null;
      if (!tag) this.tooltipEl.style.display = 'none';
    });
    // Single delegated click handler for all dynamic sidebar elements
    this.el.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement;

      // Sport bracket buttons
      const sportBtn = target.closest('.sport-btn') as HTMLElement | null;
      if (sportBtn) {
        e.preventDefault();
        const sportId = sportBtn.dataset['sport'];
        if (sportId) {
          const sport = this.state.sportsLeague.getSport(sportId);
          if (sport) BracketView.show(sport);
        }
        return;
      }

      // News modal button
      if (target.closest('#btn-news-modal')) {
        e.preventDefault();
        this.showNewsModal();
        return;
      }

      // Settings button
      if (target.closest('#btn-settings')) {
        e.preventDefault();
        this.showSettingsModal();
        return;
      }

      // Stock tag tooltips — only on touch devices (desktop uses hover)
      const tag = target.closest('.stock-tag') as HTMLElement | null;
      if (tag && isTouchDevice()) {
        e.preventDefault();
        if (this.tooltipEl.style.display === 'block' && this.tooltipEl.dataset['sym'] === tag.textContent) {
          this.tooltipEl.style.display = 'none';
        } else {
          this.showTooltip(tag);
        }
        return;
      }
    });

    this.render();
  }

  private showTooltip(tag: HTMLElement): void {
    const text = tag.dataset['tooltip'] ?? '';
    if (!text) return;
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.tooltipEl.innerHTML = (isMobile ? '<button class="tooltip-close">&times;</button>' : '') +
      text.replace(/\n/g, '<br>');
    this.tooltipEl.dataset['sym'] = tag.textContent ?? '';
    this.tooltipEl.style.display = 'block';
    this.tooltipEl.style.pointerEvents = isMobile ? 'auto' : 'none';

    // Position
    const rect = tag.getBoundingClientRect();
    let top = rect.top - this.tooltipEl.offsetHeight - 6;
    if (top < 4) top = rect.bottom + 6;
    let left = rect.left;
    if (left + 240 > window.innerWidth) left = window.innerWidth - 244;
    this.tooltipEl.style.top = Math.max(4, top) + 'px';
    this.tooltipEl.style.left = Math.max(4, left) + 'px';

    // Close button handler (mobile)
    if (isMobile) {
      this.tooltipEl.querySelector('.tooltip-close')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tooltipEl.style.display = 'none';
      });
    }
  }

  private showNewsModal(): void {
    document.getElementById('news-modal')?.remove();

    const events = this.state.newsFeed.getRecentEvents();
    const stocks = this.state.stockMarket.stocks;

    const modal = document.createElement('div');
    modal.id = 'news-modal';

    // Helper to build a hoverable stock tag with tooltip
    const makeStockTag = (symbol: string) => {
      const stock = stocks.find(s => s.symbol === symbol);
      if (!stock) return `<span style="color:#88bbaa;">${symbol}</span>`;
      const escaped = stock.description.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
      const sectorLabel = stock.sector.charAt(0).toUpperCase() + stock.sector.slice(1);
      return `<span class="stock-tag" data-tooltip="${stock.name}\n${sectorLabel} sector\n\n${escaped}">${symbol}</span>`;
    };

    const eventsHtml = events.length === 0
      ? '<div style="color:#668877;padding:16px;">No news yet...</div>'
      : events.map(ev => {
        const isActive = ev.remaining > 0;
        const isBullish = ev.impact > 0;
        const icon = ev.category === 'world' ? '\u{1F30E}'
          : ev.category === 'ceo' ? '\u{1F464}'
          : ev.category === 'research' ? '\u{1F52C}'
          : ev.category === 'market' ? '\u{1F4C8}'
          : ev.category === 'sector' ? '\u{1F4CA}'
          : '\u{1F3E2}';
        const impactSign = isBullish ? '+' : '';
        const impactPct = (ev.impact * 100).toFixed(2);
        const impactColor = isBullish ? '#00cc66' : '#dd3333';
        const statusDot = `<span style="color:${impactColor};margin-right:4px;">&#9679;</span>`;

        // Show which stocks are affected and by how much
        const affectedStocks = ev.targets.length === 0 ? stocks : stocks.filter(s => ev.targets.includes(s.symbol));
        const stockImpacts = affectedStocks.map(s => {
          const ptsVal = s.price * ev.impact;
          const ptsStr = `<span style="color:${impactColor};">${impactSign}${ptsVal.toFixed(2)}</span>`;
          return `<span class="news-stock-impact">${makeStockTag(s.symbol)} ${ptsStr}</span>`;
        }).join('');

        const targetLabel = ev.targets.length === 0 ? 'ALL STOCKS' : ev.targets.map(t => makeStockTag(t)).join(' ');

        return `<div class="news-modal-item">
          <div class="news-modal-headline">${statusDot}${icon} ${ev.headline}</div>
          <div class="news-modal-meta">
            <span style="color:${impactColor};">${impactSign}${impactPct}%/tick</span>
            <span style="color:#668877;">${ev.category.toUpperCase()}</span>
            <span>${targetLabel}</span>
            <span style="color:#ffaa22;">${isActive ? `${ev.remaining} ticks left` : 'expired'}</span>
          </div>
          <div class="news-modal-impacts">${stockImpacts}</div>
        </div>`;
      }).join('');

    modal.innerHTML = `
      <div class="nm-backdrop"></div>
      <div class="nm-content">
        <div class="nm-header"><span>News Feed & Market Impact</span><button class="nm-close">&times;</button></div>
        <div class="nm-body">${eventsHtml}</div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.nm-backdrop')!.addEventListener('click', () => modal.remove());
    modal.querySelector('.nm-close')!.addEventListener('click', () => modal.remove());

    // Tooltip support for stock tags inside the modal
    const body = modal.querySelector('.nm-body')!;
    body.addEventListener('mouseover', (e) => {
      const tag = (e.target as HTMLElement).closest('.stock-tag') as HTMLElement | null;
      if (tag) this.showTooltip(tag);
    });
    body.addEventListener('mouseout', (e) => {
      const tag = (e.target as HTMLElement).closest('.stock-tag') as HTMLElement | null;
      if (tag) this.tooltipEl.style.display = 'none';
    });
    body.addEventListener('click', (e) => {
      const tag = (e.target as HTMLElement).closest('.stock-tag') as HTMLElement | null;
      if (tag) {
        e.stopPropagation();
        this.showTooltip(tag);
      }
    });
  }

  setOnLoadMission(fn: (mission: Mission) => void): void {
    this.onLoadMission = fn;
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="sb-header">
        <span>QUANTUM SRC</span>
        <button id="btn-settings" class="sb-settings-btn" title="Settings">&#9881;</button>
      </div>

      <div class="sb-tabs">
        <button class="sb-tab active" data-stab="status">Status</button>
        <button class="sb-tab" data-stab="market">Market</button>
        <button class="sb-tab" data-stab="sports">Sports</button>
        <button class="sb-tab" data-stab="research">Research</button>
        <button class="sb-tab" data-stab="docs">Docs</button>
      </div>

      <div class="sb-tab-content" id="stab-status">
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
          <h3>Shop</h3>
          <div id="sb-shop"></div>
        </div>
      </div>

      <div class="sb-tab-content" id="stab-market" style="display:none;">
        <div class="sb-section">
          <h3>Stock Market</h3>
          <div id="sb-stocks"></div>
        </div>

        <div class="sb-section">
          <h3>News Feed</h3>
          <button class="sidebar-btn" id="btn-news-modal" style="margin-bottom:6px;text-align:center;background:#0a1220;border-color:#2a4a6a;color:#6688ff;">
            View All News & Market Impact
          </button>
          <div id="sb-news"><div class="stat-row" style="color:#334455;">No news yet...</div></div>
        </div>

        <div class="sb-section">
          <h3>Portfolio</h3>
          <div id="sb-portfolio"><div class="stat-row" style="color:#334455;">No holdings</div></div>
        </div>
      </div>

      <div class="sb-tab-content" id="stab-sports" style="display:none;">
        <div class="sb-section">
          <h3>Sports & Betting</h3>
          <div id="sb-sports"></div>
        </div>
      </div>

      <div class="sb-tab-content" id="stab-research" style="display:none;">
        <div class="sb-section">
          <h3>Research Tree</h3>
          <button class="sidebar-btn" id="btn-view-tree" style="margin-bottom:8px;text-align:center;background:#0a1220;border-color:#2244aa;color:#6688ff;">
            View Full Tree
          </button>
          <div id="sb-research"></div>
        </div>
      </div>

      <div class="sb-tab-content" id="stab-docs" style="display:none;">
        <div class="sb-section docs-section">
          <h3>Terminal Reference</h3>
          <p class="docs-intro">QuantumSrc exposes three modules: <code>sys</code>, <code>market</code>, and <code>sports</code>. All queries return native objects — no parsing needed.</p>

          <div class="docs-group">
            <h4>sys — System Status</h4>
            <div class="docs-fn"><code>sys.funds()</code> <span class="docs-ret">number</span> <p>Current cash balance.</p></div>
            <div class="docs-fn"><code>sys.year()</code> <span class="docs-ret">number</span> <p>Current in-game year.</p></div>
            <div class="docs-fn"><code>sys.energy()</code> <span class="docs-ret">number</span> <p>Available energy (kWh).</p></div>
            <div class="docs-fn"><code>sys.credits()</code> <span class="docs-ret">number</span> <p>Research credits from missions.</p></div>
            <div class="docs-fn"><code>sys.era()</code> <span class="docs-ret">string</span> <p>Current computing era.</p></div>
            <div class="docs-fn"><code>sys.compute()</code> <span class="docs-ret">string</span> <p>Hardware description.</p></div>
            <pre class="docs-example">print("Year " + sys.year() + " — " + sys.era())
print("Funds: $" + sys.funds())
print("Compute: " + sys.compute())</pre>
          </div>

          <div class="docs-group">
            <h4>market — Stock Market</h4>
            <div class="docs-fn"><code>market.scan()</code> <span class="docs-ret">array</span> <p>All stocks with symbol, name, sector, price.</p></div>
            <pre class="docs-example">let stocks = market.scan()
for (let s of stocks) {
  print(s.symbol + " [" + s.sector + "] $" + s.price)
}</pre>
            <div class="docs-fn"><code>market.price(symbol)</code> <span class="docs-ret">number</span> <p>Quick price lookup for one ticker.</p></div>
            <pre class="docs-example">let p = market.price("CPUX")
if (p < 10) market.buy("CPUX", 5)</pre>
            <div class="docs-fn"><code>market.buy(symbol, qty)</code> <span class="docs-ret">string</span> <p>Acquire shares. Deducts from funds.</p></div>
            <div class="docs-fn"><code>market.sell(symbol, qty)</code> <span class="docs-ret">string</span> <p>Liquidate shares. Adds to funds.</p></div>
            <div class="docs-fn"><code>market.holdings()</code> <span class="docs-ret">object</span> <p>Current positions. Keys = symbols, values = qty.</p></div>
            <pre class="docs-example">let h = market.holdings()
// { CPUX: 10, ROBO: 5 }</pre>
            <div class="docs-fn"><code>market.feed()</code> <span class="docs-ret">array</span> <p>Live news feed with per-stock impact.</p></div>
            <pre class="docs-example">let news = market.feed()
for (let n of news) {
  if (!n.active) continue
  print(n.headline)
  print("  " + n.remaining + "/" + n.duration + " ticks")
  for (let sym in n.stockImpacts) {
    print("  " + sym + ": $" + n.stockImpacts[sym] + "/tick")
  }
}</pre>
          </div>

          <div class="docs-group">
            <h4>sports — League Betting</h4>
            <div class="docs-fn"><code>sports.leagues()</code> <span class="docs-ret">array</span> <p>All leagues with season, phase, timing.</p></div>
            <pre class="docs-example">let lg = sports.leagues()
for (let l of lg) {
  print(l.name + " S" + l.season + " [" + l.phase + "]")
}</pre>
            <div class="docs-fn"><code>sports.roster(leagueId)</code> <span class="docs-ret">array</span> <p>16 teams with id, name, rating, seed, wins, losses.</p></div>
            <pre class="docs-example">let teams = sports.roster("football")
teams.sort((a, b) => b.rating - a.rating)
print("Top: " + teams[0].name + " (" + teams[0].rating + ")")</pre>
            <div class="docs-fn"><code>sports.bracket(leagueId)</code> <span class="docs-ret">array</span> <p>Bracket rounds with match results (team1, team2, winner, score).</p></div>
            <div class="docs-fn"><code>sports.wager(leagueId, amount, picks)</code> <span class="docs-ret">string</span> <p>Place bracket bets. Amount is per-round. Locked once placed.</p></div>
            <div class="docs-table">
              <div class="docs-table-row"><span>Depth</span><span>Payout</span><span>Example</span></div>
              <div class="docs-table-row"><span>1 round</span><span>1:2</span><span>$50 &rarr; $100</span></div>
              <div class="docs-table-row"><span>2 rounds</span><span>1:4</span><span>$50 &rarr; $200</span></div>
              <div class="docs-table-row"><span>3 rounds</span><span>1:8</span><span>$50 &rarr; $400</span></div>
              <div class="docs-table-row"><span>4 rounds</span><span>1:16</span><span>$50 &rarr; $800</span></div>
            </div>
            <pre class="docs-example">let t = sports.roster("football")
t.sort((a, b) => b.rating - a.rating)

sports.wager("football", 100, {
  round1: [t[0].id, t[7].id, t[4].id, t[3].id,
           t[5].id, t[2].id, t[6].id, t[1].id],
  round4: [t[0].id]
})</pre>
          </div>

          <div class="docs-group">
            <h4>Output</h4>
            <div class="docs-fn"><code>print(value)</code> <p>Write to the output terminal.</p></div>
          </div>

          <div class="docs-group">
            <h4>Ticker Reference</h4>
            <div class="docs-symbols">
              <span><b>CPUX</b> Tech</span> <span><b>ROBO</b> Tech</span>
              <span><b>NTWK</b> Telecom</span> <span><b>DATA</b> Data</span>
              <span><b>ENRG</b> Energy</span> <span><b>PETX</b> Oil</span>
              <span><b>BNKR</b> Finance</span> <span><b>GENE</b> Medical</span>
              <span><b>TITN</b> Industrial</span> <span><b>SHLD</b> Defense</span>
              <span><b>CRYP</b> Crypto</span> <span><b>QBIT</b> Quantum</span>
            </div>
          </div>

          <div class="docs-group">
            <h4>League IDs</h4>
            <p class="docs-intro"><code>"football"</code> <code>"basketball"</code> <code>"baseball"</code> <code>"soccer"</code></p>
          </div>
        </div>
      </div>

      <div id="sb-resize-handle" class="sb-resize-handle"></div>
    `;

    // Tab switching
    this.el.querySelectorAll('.sb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = (tab as HTMLElement).dataset['stab'];
        this.el.querySelectorAll('.sb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.el.querySelectorAll('.sb-tab-content').forEach(c => (c as HTMLElement).style.display = 'none');
        const panel = this.el.querySelector(`#stab-${target}`) as HTMLElement;
        if (panel) panel.style.display = 'block';
      });
    });

    this.el.querySelector('#btn-view-tree')?.addEventListener('click', () => {
      this.showResearchModal();
    });

    // Resize handle
    this.setupResize();

    this.update();
  }

  private setupResize(): void {
    const handle = this.el.querySelector('#sb-resize-handle') as HTMLElement;
    if (!handle) return;

    // Restore saved width
    const savedW = localStorage.getItem('quantumsrc_sidebar_width');
    if (savedW) {
      const w = parseInt(savedW, 10);
      if (w >= 240) {
        this.el.style.width = w + 'px';
        (this.el.parentElement as HTMLElement).style.gridTemplateColumns = w + 'px 1fr';
      }
    }

    let startX = 0;
    let startW = 0;

    const onMouseMove = (e: MouseEvent) => {
      const newW = Math.max(240, startW + (e.clientX - startX));
      this.el.style.width = newW + 'px';
      (this.el.parentElement as HTMLElement).style.gridTemplateColumns = newW + 'px 1fr';
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('quantumsrc_sidebar_width', String(this.el.offsetWidth));
    };

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = this.el.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  private showSettingsModal(): void {
    document.getElementById('settings-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.innerHTML = `
      <div class="nm-backdrop"></div>
      <div class="nm-content" style="max-width:400px;height:auto;">
        <div class="nm-header"><span>Settings</span><button class="nm-close">&times;</button></div>
        <div style="padding:16px;">
          <div style="color:#668877;font-family:'Lato',sans-serif;margin-bottom:12px;">Game Settings</div>
          <button id="btn-reset-game" class="sidebar-btn" style="background:#2a0a0a;border-color:#ff4444;color:#ff4444;text-align:center;">
            Reset Game (Delete All Progress)
          </button>
          <div style="color:#334455;font-size:12px;margin-top:8px;">This will erase all save data, stocks, sports, and reset everything to the beginning.</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.nm-backdrop')!.addEventListener('click', () => modal.remove());
    modal.querySelector('.nm-close')!.addEventListener('click', () => modal.remove());

    modal.querySelector('#btn-reset-game')!.addEventListener('click', () => {
      if (confirm('Are you sure? This will delete ALL progress and cannot be undone.')) {
        this.state.resetSave();
        modal.remove();
        window.location.reload();
      }
    });
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

    const nodeW = 180, nodeH = 65, colGap = 40, rowGap = 30, eraGap = 50, padX = 40, padY = 40;
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
    curY = padY; ctx.font = '12px IBM Plex Mono, Courier New';
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
      ctx.font = 'bold 12px IBM Plex Mono, Courier New'; ctx.fillText(node.name, pos.x + 8, pos.y + 16, nodeW - 16);
      ctx.font = '12px IBM Plex Mono, Courier New';
      if (node.researched) { ctx.fillStyle = '#006633'; ctx.fillText('[DONE]', pos.x + 8, pos.y + 32); }
      else if (node.unlocked) {
        ctx.fillStyle = '#aa88ff'; ctx.fillText(`${node.creditsCost} credits`, pos.x + 8, pos.y + 32);
        ctx.fillStyle = '#6688ff'; ctx.fillText(`+${node.yearAdvance}yr`, pos.x + 100, pos.y + 32);
      } else { ctx.fillStyle = '#222233'; ctx.fillText('[LOCKED]', pos.x + 8, pos.y + 32); }
      ctx.fillStyle = node.researched ? '#336655' : node.unlocked ? '#446655' : '#1a2a22';
      ctx.font = '12px IBM Plex Mono, Courier New';
      const desc = node.description.length > 30 ? node.description.slice(0, 28) + '...' : node.description;
      ctx.fillText(desc, pos.x + 8, pos.y + 48, nodeW - 16);
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
        ? (sport.playerBets.totalPayout > 0
          ? `<span style="color:#00ff88;">+$${sport.playerBets.totalPayout.toLocaleString()}</span>`
          : `<span style="color:#668877;">$${sport.playerBets.totalWagered.toLocaleString()} wagered</span>`)
        : (sport.phase === 'betting'
          ? '<span style="color:#ffaa22;">No bet</span>'
          : '<span style="color:#334455;">—</span>');

      return `<button class="sidebar-btn sport-btn" data-sport="${sport.id}" style="border-color:#2a3a4a55;">
        <span style="display:flex;justify-content:space-between;align-items:center;">
          <span>${sport.icon} ${sport.name} S${sport.seasonNumber}</span>
          <span style="color:${phaseColor};">${phaseText}</span>
        </span>
        <span style="display:flex;justify-content:space-between;margin-top:2px;">
          ${betStatus}
          <span style="color:#446666;">View Bracket</span>
        </span>
      </button>`;
    }).join('');
    // Click handled by event delegation in constructor
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
