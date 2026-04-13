import type { GameState } from '../game/GameState';
import type { ConsoleOutput } from './ConsoleOutput';
import type { Mission } from '../game/missions/Missions';
import { BracketView } from './BracketView';
import { SKINS, getSkin, setSkin } from './SkinManager';

export class Sidebar {
  private el: HTMLDivElement;
  private state: GameState;
  private console: ConsoleOutput;
  private prevPrices: Map<string, number> = new Map();
  private onLoadMission: ((mission: Mission) => void) | null = null;
  private onLoadMissionCode: ((mission: Mission) => void) | null = null;
  private onInsertCode: ((code: string) => void) | null = null;
  private onGetCode: (() => string) | null = null;
  private onCollectMission: ((missionId: string) => void) | null = null;
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

      // Docs: paste button inserts code snippet into editor
      const insertBtn = target.closest('.docs-insert-btn') as HTMLElement | null;
      if (insertBtn && this.onInsertCode) {
        e.preventDefault();
        const pre = insertBtn.previousElementSibling as HTMLElement | null;
        if (pre?.classList.contains('docs-example')) {
          this.onInsertCode(pre.textContent ?? '');
        }
        return;
      }
      // Docs: clickable function signatures
      const docFnCode = target.closest('.docs-fn > code') as HTMLElement | null;
      if (docFnCode && this.onInsertCode) {
        e.preventDefault();
        this.onInsertCode(docFnCode.textContent?.replace(/\s*\u229E$/, '') ?? '');
        return;
      }

      // Docs TOC links — smooth scroll to section
      const tocLink = target.closest('.docs-toc-link') as HTMLAnchorElement | null;
      if (tocLink) {
        e.preventDefault();
        const href = tocLink.getAttribute('href');
        if (href) {
          const section = this.el.querySelector(href);
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      // Docs back-to-top button
      if (target.closest('#docs-back-top')) {
        e.preventDefault();
        const top = this.el.querySelector('#docs-top');
        if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      // Shop buttons
      const shopBtn = target.closest('.shop-btn') as HTMLElement | null;
      if (shopBtn) {
        e.preventDefault();
        const id = shopBtn.dataset['id'];
        if (id) {
          const result = this.state.shop.purchase(id, this.state);
          if (result.startsWith('Purchased')) {
            this.console.appendSystem(result);
            this.state.save();
          } else {
            this.console.appendError(result);
          }
        }
        return;
      }

      // Mission collect buttons
      const collectBtn = target.closest('.mission-collect-btn') as HTMLElement | null;
      if (collectBtn) {
        e.preventDefault();
        const id = collectBtn.dataset['id'];
        if (id && this.onCollectMission) {
          this.onCollectMission(id);
        }
        return;
      }

      // Mission load starter code button — confirm before overwriting editor
      const loadStarterBtn = target.closest('.mission-load-starter-btn') as HTMLElement | null;
      if (loadStarterBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = loadStarterBtn.dataset['id'];
        if (id) {
          const mission = this.state.missions.find(m => m.id === id);
          if (mission && this.onLoadMissionCode) {
            this.showConfirmLoadCodeModal(mission);
          }
        }
        return;
      }

      // Mission buttons — show info only, no code overwrite
      const missionBtn = target.closest('.mission-btn') as HTMLElement | null;
      if (missionBtn) {
        e.preventDefault();
        const id = missionBtn.dataset['id'];
        if (id) {
          const mission = this.state.missions.find(m => m.id === id);
          if (mission && this.onLoadMission) {
            this.onLoadMission(mission);
          }
        }
        return;
      }

      // Mission load saved code button — opens modal
      const loadCodeBtn = target.closest('.mission-load-code-btn') as HTMLElement | null;
      if (loadCodeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = loadCodeBtn.dataset['id'];
        if (id) {
          const mission = this.state.missions.find(m => m.id === id);
          if (mission?.savedCode) {
            this.showMissionCodeModal(mission);
          }
        }
        return;
      }

      // Mission save code button
      const saveCodeBtn = target.closest('.mission-save-code-btn') as HTMLElement | null;
      if (saveCodeBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = saveCodeBtn.dataset['id'];
        if (id && this.onGetCode) {
          const mission = this.state.missions.find(m => m.id === id);
          if (mission) {
            const code = this.onGetCode();
            if (!code.trim()) {
              this.console.appendError('Editor is empty — nothing to save.');
              return;
            }
            if (mission.savedCode) {
              this.showConfirmOverwriteModal(mission, code);
            } else {
              mission.savedCode = code;
              this.state.save();
              this.console.appendSystem(`Saved code snippet to: ${mission.name}`);
            }
          }
        }
        return;
      }

      // Mission tree button
      const treeBtn = target.closest('#btn-mission-tree') as HTMLElement | null;
      if (treeBtn) {
        e.preventDefault();
        this.showMissionTreeModal();
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

  private showMissionTreeModal(): void {
    document.getElementById('mission-tree-modal')?.remove();

    const missions = this.state.missions;
    const modal = document.createElement('div');
    modal.id = 'mission-tree-modal';

    // Group missions by era
    const eras = [
      { key: 'dawn', label: 'Dawn of Computing', color: '#88ccaa' },
      { key: 'market', label: 'Market', color: '#44dd88' },
      { key: 'science', label: 'Scientific Research', color: '#44bbff' },
      { key: 'crypto', label: 'Crypto Era', color: '#ffaa44' },
      { key: 'quantum', label: 'Quantum Era', color: '#aa88ff' },
    ];

    const getMissionStatus = (m: Mission): 'completed' | 'available' | 'ready' | 'locked' => {
      if (m.completed) return 'completed';
      if (m.readyToCollect) return 'ready';
      const prereqsMet = m.prerequisites.every(
        pid => missions.find(m2 => m2.id === pid)?.completed
      );
      if (!prereqsMet) return 'locked';
      if (m.requiredResearch) {
        const node = this.state.researchTree.find(n => n.id === m.requiredResearch);
        if (!node?.researched) return 'locked';
      }
      if (m.minYear && this.state.year < m.minYear) return 'locked';
      return 'available';
    };

    const statusIcon = (status: string) => {
      if (status === 'completed') return '<span style="color:#44dd88;">&#10003;</span>';
      if (status === 'ready') return '<span style="color:#ffcc44;">&#11088;</span>';
      if (status === 'available') return '<span style="color:#ffcc44;">&#9679;</span>';
      return '<span style="color:#334455;">&#9632;</span>';
    };

    const statusColor = (status: string) => {
      if (status === 'completed') return '#44dd88';
      if (status === 'ready') return '#ffcc44';
      if (status === 'available') return '#ffcc44';
      return '#667788';
    };

    let html = '';
    for (const era of eras) {
      const eraMissions = missions.filter(m => m.era === era.key);
      if (eraMissions.length === 0) continue;

      html += `<div style="margin-bottom:12px;">
        <div style="color:${era.color};font-weight:bold;margin-bottom:6px;font-size:13px;border-bottom:1px solid ${era.color}33;padding-bottom:4px;">${era.label}</div>`;

      for (const m of eraMissions) {
        const status = getMissionStatus(m);
        const color = statusColor(status);
        const icon = statusIcon(status);
        const prereqNames = m.prerequisites.map(pid => {
          const pm = missions.find(m2 => m2.id === pid);
          return pm ? pm.name : pid;
        });
        const reqs: string[] = [...prereqNames];
        if (m.requiredResearch) {
          const rn = this.state.researchTree.find(n => n.id === m.requiredResearch);
          reqs.push(rn ? `${rn.name} research` : `${m.requiredResearch} research`);
        }
        if (m.minYear) reqs.push(`Year ${m.minYear}+`);
        const prereqText = reqs.length > 0
          ? `<div style="color:#7799aa;font-size:9px;margin-top:2px;">Requires: ${reqs.join(', ')}</div>`
          : '';
        const rewardText = `<span style="color:#aa88ff;font-size:10px;">${m.researchCredits} cr</span>`
          + (m.moneyReward > 0 ? ` <span style="color:#44dd88;font-size:10px;">+$${m.moneyReward.toLocaleString()}</span>` : '');

        const isClickable = status === 'available' || status === 'ready';
        const cursor = isClickable ? 'cursor:pointer;' : '';
        const hoverBg = isClickable ? 'background:#1a2a3a;' : '';
        const opacity = status === 'locked' ? 'opacity:0.7;' : '';

        html += `<div class="mission-tree-node${isClickable ? ' mission-tree-clickable' : ''}" data-mission-id="${m.id}"
          style="padding:6px 8px;margin:3px 0;border-left:3px solid ${color};${cursor}${hoverBg}${opacity}border-radius:0 4px 4px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span>${icon} <span style="color:${color};">${m.name}</span></span>
            ${rewardText}
          </div>
          <div style="color:var(--skin-text-mid);font-size:10px;margin-top:2px;">${m.description}</div>
          ${prereqText}
        </div>`;
      }
      html += '</div>';
    }

    // Legend
    html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #223344;display:flex;gap:12px;font-size:10px;color:var(--skin-text-mid);">
      <span>${statusIcon('completed')} Completed</span>
      <span>${statusIcon('ready')} Ready</span>
      <span>${statusIcon('available')} Available</span>
      <span>${statusIcon('locked')} Locked</span>
    </div>`;

    const completedCount = missions.filter(m => m.completed).length;

    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#0c1824;border:1px solid #2a4a6a;border-radius:8px;max-width:500px;width:90%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #1a2a3a;">
            <span style="color:#aa88ff;font-weight:bold;font-size:14px;">Mission Tree</span>
            <span style="color:var(--skin-text-mid);font-size:11px;">${completedCount} / ${missions.length} complete</span>
            <button id="close-mission-tree" style="background:none;border:none;color:var(--skin-text-mid);font-size:20px;cursor:pointer;padding:0 4px;">&times;</button>
          </div>
          <div style="padding:12px 16px;overflow-y:auto;flex:1;">
            ${html}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close button
    document.getElementById('close-mission-tree')?.addEventListener('click', () => modal.remove());
    // Click backdrop to close
    modal.querySelector('div')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) modal.remove();
    });

    // Clickable mission nodes load the mission
    modal.querySelectorAll('.mission-tree-clickable').forEach(node => {
      node.addEventListener('click', () => {
        const id = (node as HTMLElement).dataset['missionId'];
        if (id) {
          const mission = missions.find(m => m.id === id);
          if (!mission) return;
          if (mission.readyToCollect && this.onCollectMission) {
            this.onCollectMission(id);
            modal.remove();
          } else if (this.onLoadMission) {
            this.onLoadMission(mission);
            modal.remove();
          }
        }
      });
    });
  }

  private highlightJS(code: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Tokenize to avoid highlighting inside strings/comments
    const tokens: { type: string; text: string }[] = [];
    let i = 0;
    while (i < code.length) {
      // Single-line comment
      if (code[i] === '/' && code[i + 1] === '/') {
        const end = code.indexOf('\n', i);
        const slice = end === -1 ? code.slice(i) : code.slice(i, end);
        tokens.push({ type: 'comment', text: slice });
        i += slice.length;
        continue;
      }
      // Multi-line comment
      if (code[i] === '/' && code[i + 1] === '*') {
        const end = code.indexOf('*/', i + 2);
        const slice = end === -1 ? code.slice(i) : code.slice(i, end + 2);
        tokens.push({ type: 'comment', text: slice });
        i += slice.length;
        continue;
      }
      // String (double/single/backtick)
      if (code[i] === '"' || code[i] === "'" || code[i] === '`') {
        const q = code[i]!;
        let j = i + 1;
        while (j < code.length && code[j] !== q) {
          if (code[j] === '\\') j++;
          j++;
        }
        tokens.push({ type: 'string', text: code.slice(i, j + 1) });
        i = j + 1;
        continue;
      }
      // Number
      if (/\d/.test(code[i]!) && (i === 0 || /[^a-zA-Z_$]/.test(code[i - 1]!))) {
        let j = i;
        while (j < code.length && /[\d.xa-fA-F]/.test(code[j]!)) j++;
        tokens.push({ type: 'number', text: code.slice(i, j) });
        i = j;
        continue;
      }
      // Word (identifier/keyword)
      if (/[a-zA-Z_$]/.test(code[i]!)) {
        let j = i;
        while (j < code.length && /[a-zA-Z0-9_$]/.test(code[j]!)) j++;
        tokens.push({ type: 'word', text: code.slice(i, j) });
        i = j;
        continue;
      }
      // Other
      tokens.push({ type: 'other', text: code[i]! });
      i++;
    }

    const keywords = new Set(['let', 'const', 'var', 'if', 'else', 'for', 'while', 'return', 'function', 'new', 'true', 'false', 'null', 'undefined', 'of', 'in', 'break', 'continue', 'switch', 'case', 'default']);
    const apis = new Set(['print', 'console', 'market', 'sys', 'sports', 'seti', 'Math']);

    return tokens.map(t => {
      const e = esc(t.text);
      switch (t.type) {
        case 'comment': return `<span style="color:#556677;font-style:italic;">${e}</span>`;
        case 'string': return `<span style="color:#e6c07b;">${e}</span>`;
        case 'number': return `<span style="color:#d19a66;">${e}</span>`;
        case 'word':
          if (keywords.has(t.text)) return `<span style="color:#c678dd;">${e}</span>`;
          if (apis.has(t.text)) return `<span style="color:#61afef;">${e}</span>`;
          return `<span style="color:#abb2bf;">${e}</span>`;
        default: return `<span style="color:#888;">${e}</span>`;
      }
    }).join('');
  }

  private showMissionCodeModal(mission: Mission): void {
    document.getElementById('mission-code-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'mission-code-modal';

    const highlighted = this.highlightJS(mission.savedCode!);

    // Line numbers
    const lineCount = mission.savedCode!.split('\n').length;
    const lineNums = Array.from({ length: lineCount }, (_, i) => `<span style="color:#334455;">${i + 1}</span>`).join('\n');

    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#0c1824;border:1px solid #2a4a6a;border-radius:8px;max-width:600px;width:90%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #1a2a3a;">
            <div>
              <span style="color:#44dd88;font-weight:bold;font-size:13px;">&#10003; ${mission.name}</span>
              <span style="color:#556677;font-size:11px;margin-left:8px;">Saved Code</span>
            </div>
            <button class="mc-close" style="background:none;border:none;color:var(--skin-text-mid);font-size:20px;cursor:pointer;padding:0 4px;">&times;</button>
          </div>
          <div style="padding:12px 16px;overflow-y:auto;flex:1;">
            <div style="background:#060e18;border:1px solid #1a2a3a;border-radius:4px;padding:12px;display:flex;gap:12px;font-family:monospace;font-size:12px;line-height:1.5;overflow-x:auto;">
              <pre style="margin:0;text-align:right;user-select:none;min-width:20px;">${lineNums}</pre>
              <pre style="margin:0;flex:1;white-space:pre-wrap;word-break:break-all;">${highlighted}</pre>
            </div>
          </div>
          <div style="padding:10px 16px;border-top:1px solid #1a2a3a;display:flex;gap:8px;justify-content:flex-end;">
            <button class="mc-load" style="background:#1a3a2a;border:1px solid #44dd8855;color:#44dd88;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;">Load into Editor</button>
            <button class="mc-close" style="background:#1a2a3a;border:1px solid #2a4a6a;color:var(--skin-text-mid);padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close
    modal.querySelectorAll('.mc-close').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });
    // Click backdrop to close
    modal.querySelector('div')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) modal.remove();
    });
    // Load into editor
    modal.querySelector('.mc-load')?.addEventListener('click', () => {
      modal.remove();
      if (this.onLoadMissionCode) {
        this.onLoadMissionCode({ ...mission, starterCode: mission.savedCode! });
        this.console.appendSystem(`Loaded saved code for: ${mission.name}`);
      }
    });
  }

  private showConfirmLoadCodeModal(mission: Mission): void {
    document.getElementById('confirm-load-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'confirm-load-modal';

    const hasSavedCode = !!mission.savedCode;

    const starterHighlighted = this.highlightJS(mission.starterCode);
    const starterLines = mission.starterCode.split('\n');
    const starterLineNums = starterLines.map((_, i) => `<span style="color:#334455;">${i + 1}</span>`).join('\n');

    let savedHighlighted = '';
    let savedLineNums = '';
    if (hasSavedCode) {
      savedHighlighted = this.highlightJS(mission.savedCode!);
      const savedLines = mission.savedCode!.split('\n');
      savedLineNums = savedLines.map((_, i) => `<span style="color:#334455;">${i + 1}</span>`).join('\n');
    }

    const codePreview = (lineNums: string, highlighted: string) => `
      <div style="background:#060e18;border:1px solid #1a2a3a;border-radius:4px;padding:10px;display:flex;gap:10px;font-family:monospace;font-size:11px;line-height:1.5;overflow-x:auto;max-height:200px;overflow-y:auto;">
        <pre style="margin:0;text-align:right;user-select:none;min-width:16px;">${lineNums}</pre>
        <pre style="margin:0;flex:1;white-space:pre-wrap;word-break:break-all;">${highlighted}</pre>
      </div>`;

    const starterTab = `<button class="lc-tab active" data-lc-tab="starter" style="background:none;border:none;border-bottom:2px solid #44dd88;color:#44dd88;padding:4px 10px;cursor:pointer;font-size:11px;">Starter Code</button>`;
    const savedTab = hasSavedCode
      ? `<button class="lc-tab" data-lc-tab="saved" style="background:none;border:none;border-bottom:2px solid transparent;color:#667788;padding:4px 10px;cursor:pointer;font-size:11px;">Saved Code</button>`
      : '';

    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#0c1824;border:1px solid #aa88ff44;border-radius:8px;max-width:550px;width:90%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
          <div style="padding:12px 16px;border-bottom:1px solid #1a2a3a;">
            <div style="color:#aa88ff;font-weight:bold;font-size:13px;margin-bottom:4px;">Load Code — ${mission.name}</div>
            <div style="color:#88aabb;font-size:11px;">This will replace whatever is currently in the editor.</div>
          </div>
          <div style="padding:8px 16px 0;display:flex;gap:2px;border-bottom:1px solid #1a2a3a;">
            ${starterTab}${savedTab}
          </div>
          <div style="padding:12px 16px;overflow-y:auto;flex:1;">
            <div id="lc-preview-starter">${codePreview(starterLineNums, starterHighlighted)}</div>
            ${hasSavedCode ? `<div id="lc-preview-saved" style="display:none;">${codePreview(savedLineNums, savedHighlighted)}</div>` : ''}
          </div>
          <div style="padding:10px 16px;border-top:1px solid #1a2a3a;display:flex;gap:8px;justify-content:flex-end;">
            <button class="lc-cancel" style="background:#1a2a3a;border:1px solid #2a4a6a;color:var(--skin-text-mid);padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;">Cancel</button>
            <button class="lc-load" style="background:#1a3a2a;border:1px solid #44dd8855;color:#44dd88;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;">Load into Editor</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let activeTab = 'starter';

    // Tab switching
    modal.querySelectorAll('.lc-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const t = (tab as HTMLElement).dataset['lcTab']!;
        activeTab = t;
        modal.querySelectorAll('.lc-tab').forEach(tb => {
          const el = tb as HTMLElement;
          const isActive = el.dataset['lcTab'] === t;
          el.style.borderBottomColor = isActive ? '#44dd88' : 'transparent';
          el.style.color = isActive ? '#44dd88' : '#667788';
        });
        const starterEl = modal.querySelector('#lc-preview-starter') as HTMLElement | null;
        const savedEl = modal.querySelector('#lc-preview-saved') as HTMLElement | null;
        if (starterEl) starterEl.style.display = t === 'starter' ? '' : 'none';
        if (savedEl) savedEl.style.display = t === 'saved' ? '' : 'none';
      });
    });

    modal.querySelector('.lc-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('div')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) modal.remove();
    });
    modal.querySelector('.lc-load')?.addEventListener('click', () => {
      if (this.onLoadMissionCode) {
        if (activeTab === 'saved' && hasSavedCode) {
          this.onLoadMissionCode({ ...mission, starterCode: mission.savedCode! });
          this.console.appendSystem(`Loaded saved code for: ${mission.name}`);
        } else {
          this.onLoadMissionCode(mission);
        }
      }
      modal.remove();
    });
  }

  private showConfirmOverwriteModal(mission: Mission, newCode: string): void {
    document.getElementById('confirm-overwrite-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'confirm-overwrite-modal';

    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9000;display:flex;align-items:center;justify-content:center;">
        <div style="background:#0c1824;border:1px solid #aa663355;border-radius:8px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
          <div style="padding:16px;">
            <div style="color:#ffaa44;font-weight:bold;font-size:13px;margin-bottom:8px;">Overwrite saved code?</div>
            <div style="color:#88aabb;font-size:12px;">This will replace the saved code snippet for <b style="color:#ccddcc;">${mission.name}</b>. This cannot be undone.</div>
          </div>
          <div style="padding:10px 16px;border-top:1px solid #1a2a3a;display:flex;gap:8px;justify-content:flex-end;">
            <button class="ow-cancel" style="background:#1a2a3a;border:1px solid #2a4a6a;color:var(--skin-text-mid);padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;">Cancel</button>
            <button class="ow-confirm" style="background:#3a2a1a;border:1px solid #ffaa4455;color:#ffaa44;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;">Overwrite</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.ow-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('div')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) modal.remove();
    });
    modal.querySelector('.ow-confirm')?.addEventListener('click', () => {
      mission.savedCode = newCode;
      this.state.save();
      this.console.appendSystem(`Updated code snippet for: ${mission.name}`);
      modal.remove();
    });
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
      ? '<div style="color:var(--skin-text-mid);padding:16px;">No news yet...</div>'
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
            <span style="color:var(--skin-text-mid);">${ev.category.toUpperCase()}</span>
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

  setOnLoadMissionCode(fn: (mission: Mission) => void): void {
    this.onLoadMissionCode = fn;
  }

  setOnInsertCode(fn: (code: string) => void): void {
    this.onInsertCode = fn;
  }

  setOnGetCode(fn: () => string): void {
    this.onGetCode = fn;
  }

  setOnCollectMission(fn: (missionId: string) => void): void {
    this.onCollectMission = fn;
  }

  private render(): void {
    this.el.innerHTML = `
      <div class="sb-header">
        <span class="sb-logo">Quantum.src</span>
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
          <button class="sidebar-btn" id="btn-mission-tree" style="margin-bottom:6px;text-align:center;background:#0a1220;border-color:#aa88ff55;color:#aa88ff;">
            View Mission Tree
          </button>
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

      <div class="sb-tab-content" id="stab-docs" style="display:none;position:relative;">
        <div class="sb-section docs-section">
          <h3 id="docs-top">Terminal Reference</h3>

          <div class="docs-toc" style="margin-bottom:12px;">
            <div style="color:var(--skin-text-mid);font-size:10px;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Contents</div>
            <a class="docs-toc-link" href="#docs-sys"><span style="color:#88ccaa;">sys</span><span style="color:#445566;">System status &amp; hardware info</span></a>
            <a class="docs-toc-link" href="#docs-market"><span style="color:#88ccaa;">market</span><span style="color:#445566;">Stock trading &amp; news feed</span></a>
            <a class="docs-toc-link" href="#docs-sports"><span style="color:#88ccaa;">sports</span><span style="color:#445566;">League betting &amp; brackets</span></a>
            <a class="docs-toc-link" href="#docs-seti" id="toc-seti"><span>seti</span><span style="color:#445566;">Deep space scanning</span></a>
            <a class="docs-toc-link" href="#docs-output"><span style="color:#88ccaa;">output</span><span style="color:#445566;">Print to terminal</span></a>
            <a class="docs-toc-link" href="#docs-tickers"><span style="color:#88ccaa;">tickers</span><span style="color:#445566;">Stock symbol reference</span></a>
            <a class="docs-toc-link" href="#docs-leagues"><span style="color:#88ccaa;">leagues</span><span style="color:#445566;">League ID reference</span></a>
          </div>

          <button id="docs-back-top" style="display:none;position:sticky;bottom:8px;left:50%;transform:translateX(-50%);z-index:50;background:#0c1824ee;border:1px solid var(--skin-border);color:var(--skin-text-mid);padding:4px 14px;border-radius:12px;cursor:pointer;font-size:10px;backdrop-filter:blur(4px);">&#9650; Back to top</button>

          <div class="docs-group" id="docs-sys">
            <h4>sys — System Status</h4>
            <div class="docs-fn"><code>sys.funds()</code> <span class="docs-ret">number</span> <p>Current cash balance.</p></div>
            <div class="docs-fn"><code>sys.year()</code> <span class="docs-ret">number</span> <p>Current in-game year.</p></div>
            <div class="docs-fn"><code>sys.energy()</code> <span class="docs-ret">number</span> <p>Available energy (kWh).</p></div>
            <div class="docs-fn"><code>sys.credits()</code> <span class="docs-ret">number</span> <p>Research credits from missions.</p></div>
            <div class="docs-fn"><code>sys.era()</code> <span class="docs-ret">string</span> <p>Current computing era.</p></div>
            <div class="docs-fn"><code>sys.compute()</code> <span class="docs-ret">string</span> <p>Hardware description.</p></div>
            <pre class="docs-example">print("Year " + sys.year() + " — " + sys.era())
print("Funds: $" + sys.funds())
print("Compute: " + sys.compute())</pre><button class="docs-insert-btn">\u{1F4CB} Insert into editor</button>
          </div>

          <div class="docs-group" id="docs-market">
            <h4>market — Stock Market</h4>
            <div class="docs-fn"><code>market.scan()</code> <span class="docs-ret">array</span> <p>All stocks with symbol, name, sector, price.</p></div>
            <pre class="docs-example">let stocks = market.scan()
for (let s of stocks) {
  print(s.symbol + " [" + s.sector + "] $" + s.price)
}</pre><button class="docs-insert-btn">\u{1F4CB} Insert into editor</button>
            <div class="docs-fn"><code>market.price(symbol)</code> <span class="docs-ret">number</span> <p>Quick price lookup for one ticker.</p></div>
            <pre class="docs-example">let p = market.price("CPUX")
if (p < 10) market.buy("CPUX", 5)</pre><button class="docs-insert-btn">\u{1F4CB} Insert into editor</button>
            <div class="docs-fn"><code>market.buy(symbol, qty)</code> <span class="docs-ret">string</span> <p>Acquire shares. Deducts from funds.</p></div>
            <div class="docs-fn"><code>market.sell(symbol, qty)</code> <span class="docs-ret">string</span> <p>Liquidate shares. Adds to funds.</p></div>
            <div class="docs-fn"><code>market.holdings()</code> <span class="docs-ret">object</span> <p>Current positions. Keys = symbols, values = qty.</p></div>
            <pre class="docs-example">let h = market.holdings()
// { CPUX: 10, ROBO: 5 }</pre><button class="docs-insert-btn">\u{1F4CB} Insert into editor</button>
            <div class="docs-fn"><code>market.feed()</code> <span class="docs-ret">array</span> <p>Live news feed with per-stock impact.</p></div>
            <pre class="docs-example">let news = market.feed()
for (let n of news) {
  if (!n.active) continue
  print(n.headline)
  print("  " + n.remaining + "/" + n.duration + " ticks")
  for (let sym in n.stockImpacts) {
    print("  " + sym + ": $" + n.stockImpacts[sym] + "/tick")
  }
}</pre><button class="docs-insert-btn">\u{1F4CB} Insert into editor</button>
          </div>

          <div class="docs-group" id="docs-sports">
            <h4>sports — League Betting</h4>
            <div class="docs-fn"><code>sports.leagues()</code> <span class="docs-ret">array</span> <p>All leagues with season, phase, timing.</p></div>
            <pre class="docs-example">let lg = sports.leagues()
for (let l of lg) {
  print(l.name + " S" + l.season + " [" + l.phase + "]")
}</pre><button class="docs-insert-btn">\u{1F4CB} Insert into editor</button>
            <div class="docs-fn"><code>sports.roster(leagueId)</code> <span class="docs-ret">array</span> <p>16 teams with id, name, rating, seed, wins, losses.</p></div>
            <pre class="docs-example">let teams = sports.roster("football")
teams.sort((a, b) => b.rating - a.rating)
print("Top: " + teams[0].name + " (" + teams[0].rating + ")")</pre><button class="docs-insert-btn">\u{1F4CB} Insert into editor</button>
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
})</pre><button class="docs-insert-btn">\u{1F4CB} Insert into editor</button>
          </div>

          <div class="docs-group" id="docs-seti">
            <h4 id="docs-seti-title">seti — Deep Space Scanning</h4>
            <div id="docs-seti-lock" style="display:none;color:#778899;font-size:11px;padding:6px 8px;border:1px dashed #445566;border-radius:4px;margin-bottom:6px;">
              &#128274; Locked — Requires <b>SETI Program</b> research
            </div>
            <div id="docs-seti-content">
              <div class="docs-fn"><code>seti.catalogue()</code> <span class="docs-ret">array</span> <p>Stellar catalogue of nearby stars with signal readings.</p></div>
              <pre class="docs-example">let stars = seti.catalogue()
for (let s of stars) {
  if (s.signal > 0.5) print(s.name + " ANOMALY: " + s.signal)
}</pre><button class="docs-insert-btn">\u{1F4CB} Insert into editor</button>
              <div class="docs-fn"><code>seti.scan(name)</code> <span class="docs-ret">object</span> <p>Deep scan a specific star. Returns frequency, pattern, and notes.</p></div>
              <pre class="docs-example">let data = seti.scan("Epsilon Eridani")
print(data.pattern + " — " + data.note)</pre><button class="docs-insert-btn">\u{1F4CB} Insert into editor</button>
              <div class="docs-fn"><code>seti.transmit(name)</code> <span class="docs-ret">string</span> <p>Build deep space array and send signal. Costs $1,000,000.</p></div>
              <div class="docs-fn"><code>seti.listen()</code> <span class="docs-ret">object</span> <p>Check for incoming replies from transmitted signals.</p></div>
            </div>
          </div>

          <div class="docs-group" id="docs-output">
            <h4>Output</h4>
            <div class="docs-fn"><code>print(value)</code> <p>Write to the output terminal.</p></div>
          </div>

          <div class="docs-group" id="docs-tickers">
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

          <div class="docs-group" id="docs-leagues">
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

    // Docs back-to-top: show when scrolled past TOC
    const docsPanel = this.el.querySelector('#stab-docs') as HTMLElement | null;
    const backTopBtn = this.el.querySelector('#docs-back-top') as HTMLElement | null;
    if (docsPanel && backTopBtn) {
      docsPanel.addEventListener('scroll', () => {
        backTopBtn.style.display = docsPanel.scrollTop > 150 ? '' : 'none';
      });
    }

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

    const currentSkin = getSkin();
    const skinOptions = SKINS.map(s =>
      `<button class="sidebar-btn skin-option${s.id === currentSkin ? ' skin-active' : ''}"
        data-skin-id="${s.id}"
        style="text-align:center;${s.id === currentSkin ? 'border-color:var(--skin-accent);' : ''}">
        <strong>${s.label}</strong>
        <span style="display:block;font-size:11px;color:var(--skin-text-dim);margin-top:2px;">${s.description}</span>
      </button>`
    ).join('');

    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.innerHTML = `
      <div class="nm-backdrop"></div>
      <div class="nm-content" style="max-width:400px;height:auto;">
        <div class="nm-header"><span>Settings</span><button class="nm-close">&times;</button></div>
        <div style="padding:16px;">
          <div style="color:var(--skin-text-mid);font-family:var(--skin-font-ui);margin-bottom:8px;font-size:13px;font-weight:bold;">Skin</div>
          <div id="skin-options" style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
            ${skinOptions}
          </div>
          <div style="height:1px;background:var(--skin-border);margin:12px 0;"></div>
          <div style="color:var(--skin-text-mid);font-family:var(--skin-font-ui);margin-bottom:8px;font-size:13px;font-weight:bold;">Danger Zone</div>
          <button id="btn-reset-game" class="sidebar-btn" style="background:var(--skin-bg-btn);border-color:var(--skin-error);color:var(--skin-error);text-align:center;">
            Reset Game (Delete All Progress)
          </button>
          <div style="color:var(--skin-text-very-dim);font-size:12px;margin-top:8px;">This will erase all save data, stocks, sports, and reset everything to the beginning.</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.nm-backdrop')!.addEventListener('click', () => modal.remove());
    modal.querySelector('.nm-close')!.addEventListener('click', () => modal.remove());

    modal.querySelector('#skin-options')!.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.skin-option') as HTMLElement | null;
      if (!btn) return;
      const skinId = btn.dataset['skinId'] as string;
      setSkin(skinId as ReturnType<typeof getSkin>);
      // Update active state on buttons
      modal.querySelectorAll('.skin-option').forEach(el => {
        (el as HTMLElement).classList.remove('skin-active');
        (el as HTMLElement).style.borderColor = '';
      });
      btn.classList.add('skin-active');
      btn.style.borderColor = 'var(--skin-accent)';
    });

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
        <div class="rm-split">
          <div class="rm-tree-panel"><canvas id="research-canvas"></canvas></div>
          <div class="rm-detail-panel" id="rm-detail">
            <div style="color:#446655;padding:20px;text-align:center;font-family:'Lato',sans-serif;">Click a node to view details</div>
          </div>
        </div>
      </div>
    `;
    const style = document.createElement('style');
    style.textContent = `
      #research-modal { position:fixed;top:0;left:0;width:100%;height:100%;z-index:1000;display:flex;align-items:center;justify-content:center; }
      .rm-backdrop { position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8); }
      .rm-content { position:relative;width:95%;max-width:1000px;height:85%;background:var(--skin-bg-modal);border:1px solid var(--skin-border);border-radius:var(--skin-radius);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--skin-bevel); }
      .rm-header { display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--skin-bg-header);border-bottom:1px solid var(--skin-border);color:var(--skin-accent);font-size:14px;font-weight:bold;letter-spacing:1px; }
      [data-skin="win95"] .rm-header { color:#fff; }
      .rm-close { background:none;border:none;color:var(--skin-text-mid);font-size:24px;cursor:pointer;font-family:inherit; }
      .rm-close:hover { color:var(--skin-error); }
      [data-skin="win95"] .rm-close { color:#fff; }
      .rm-split { flex:1;display:flex;overflow:hidden; }
      .rm-tree-panel { flex:1;overflow:auto;min-width:0; }
      .rm-detail-panel { width:260px;flex-shrink:0;border-left:1px solid var(--skin-border);overflow-y:auto;background:var(--skin-bg-sidebar); }
      #research-canvas { display:block; }
      .rm-d-header { font-size:18px;margin-bottom:8px; }
      .rm-d-row { display:flex;justify-content:space-between;font-size:13px;color:var(--skin-text-light);padding:4px 0; }
      .rm-d-label { color:var(--skin-text-dim);font-size:12px;font-family:var(--skin-font-ui);text-transform:uppercase;letter-spacing:1px;margin-top:10px;margin-bottom:4px; }
      .rm-d-desc { color:var(--skin-text-mid);font-size:13px;font-family:var(--skin-font-ui);line-height:1.5; }
      .rm-d-prereq { font-size:12px;color:var(--skin-text-mid);padding:2px 0; }
      .rm-unlock-btn { display:block;width:100%;margin-top:12px;padding:10px;background:var(--skin-bg-btn);border:1px solid var(--skin-accent);border-radius:var(--skin-radius);color:var(--skin-accent);font-family:inherit;font-size:14px;font-weight:bold;cursor:pointer;text-align:center;transition:background 0.15s;box-shadow:var(--skin-bevel); }
      .rm-unlock-btn:hover { background:var(--skin-bg-btn-hover); }
      .rm-unlock-btn:disabled { opacity:0.4;cursor:not-allowed;border-color:var(--skin-border);color:var(--skin-text-dim); }
      @media (max-width:640px) { .rm-detail-panel { width:100%;border-left:none;border-top:1px solid var(--skin-border);max-height:40%; } .rm-split { flex-direction:column; } }
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

    let selectedId: string | null = null;

    const draw = () => {
      const skinStyle = getComputedStyle(document.documentElement);
      const sv = (n: string, fb: string) => skinStyle.getPropertyValue(n).trim() || fb;
      const skinAccent = sv('--skin-accent', '#00ff88');
      const skinTextMid = sv('--skin-text-mid', '#668877');
      const skinTextDim = sv('--skin-text-dim', '#446655');
      const skinBorder = sv('--skin-border', '#1a3a2a');
      ctx.fillStyle = sv('--skin-bg-modal', '#0a0a18'); ctx.fillRect(0, 0, totalW, totalH);

      // Era labels
      let ey = padY; ctx.font = '12px IBM Plex Mono, Courier New';
      for (const era of eraOrder) {
        const group = eraGroups.get(era) ?? [];
        if (group.length === 0) continue;
        ctx.fillStyle = '#334466';
        ctx.fillText((eraLabels[era] ?? era).toUpperCase(), padX, ey + 12);
        const maxY = Math.max(...group.map(n => (positions.get(n.id)?.y ?? 0) + nodeH));
        ey = maxY + eraGap;
      }

      // Connections
      for (const node of nodes) {
        const to = positions.get(node.id); if (!to) continue;
        for (const preId of node.prerequisites) {
          const from = positions.get(preId); if (!from) continue;
          ctx.strokeStyle = node.researched ? skinAccent + '44' : node.unlocked ? skinTextMid + '44' : skinBorder + '44';
          ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(from.x + nodeW / 2, from.y + nodeH);
          ctx.lineTo(to.x + nodeW / 2, to.y); ctx.stroke();
        }
      }

      // Nodes
      for (const node of nodes) {
        const pos = positions.get(node.id); if (!pos) continue;
        const isSelected = node.id === selectedId;
        ctx.fillStyle = node.researched ? '#0a2a18' : node.unlocked ? '#0a1a22' : '#0a0a12';
        ctx.strokeStyle = isSelected ? '#ffffff' : node.researched ? skinAccent : node.unlocked ? skinTextMid : skinBorder;
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.beginPath(); ctx.roundRect(pos.x, pos.y, nodeW, nodeH, 4); ctx.fill(); ctx.stroke();
        ctx.font = '16px sans-serif';
        ctx.fillStyle = node.researched ? skinAccent : node.unlocked ? skinTextMid : skinTextDim;
        ctx.fillText(node.icon, pos.x + 6, pos.y + 18);
        ctx.font = 'bold 12px IBM Plex Mono, Courier New';
        ctx.fillText(node.name, pos.x + 26, pos.y + 16, nodeW - 34);
        ctx.font = '12px IBM Plex Mono, Courier New';
        if (node.researched) { ctx.fillStyle = '#006633'; ctx.fillText('[DONE]', pos.x + 8, pos.y + 32); }
        else if (node.unlocked) {
          ctx.fillStyle = '#aa88ff'; ctx.fillText(`${node.creditsCost} credits`, pos.x + 8, pos.y + 32);
          ctx.fillStyle = '#6688ff'; ctx.fillText(`+${node.yearAdvance}yr`, pos.x + 100, pos.y + 32);
        } else { ctx.fillStyle = '#222233'; ctx.fillText('[LOCKED]', pos.x + 8, pos.y + 32); }
        ctx.fillStyle = node.researched ? skinTextMid : node.unlocked ? skinTextDim : skinBorder;
        ctx.font = '12px IBM Plex Mono, Courier New';
        const desc = node.description.length > 30 ? node.description.slice(0, 28) + '...' : node.description;
        ctx.fillText(desc, pos.x + 8, pos.y + 48, nodeW - 16);
      }
    };

    const showDetail = (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      selectedId = nodeId;
      draw();

      const detailEl = modal.querySelector('#rm-detail')!;
      const prereqNames = node.prerequisites.map(pid => {
        const p = nodes.find(n => n.id === pid);
        return p ? `${p.icon} ${p.name}${p.researched ? ' \u2713' : ''}` : pid;
      });

      const statusColor = node.researched ? 'var(--skin-accent)' : node.unlocked ? 'var(--skin-energy)' : 'var(--skin-error)';
      const statusText = node.researched ? 'Researched' : node.unlocked ? 'Available' : 'Locked';
      const canAfford = s.researchCredits >= node.creditsCost;

      let unlockBtn = '';
      if (!node.researched && node.unlocked) {
        unlockBtn = `<button class="rm-unlock-btn" id="rm-do-unlock" ${canAfford ? '' : 'disabled'}>
          ${canAfford ? `\u{1F513} Unlock Research (${node.creditsCost} credits)` : `Need ${node.creditsCost} credits (have ${s.researchCredits})`}
        </button>`;
      }

      detailEl.innerHTML = `<div style="padding:16px;">
        <div class="rm-d-header" style="color:${node.researched ? 'var(--skin-accent)' : 'var(--skin-text-light)'};">${node.icon} ${node.name}</div>
        <div class="rm-d-row"><span style="color:${statusColor};">${statusText}</span><span style="color:var(--skin-text-dim);">${node.era.toUpperCase()}</span></div>
        <div class="rm-d-label">Description</div>
        <div class="rm-d-desc">${node.description}</div>
        <div class="rm-d-label">Details</div>
        <div class="rm-d-row"><span>Cost</span><span style="color:var(--skin-credits);">${node.creditsCost} credits</span></div>
        <div class="rm-d-row"><span>Time Advance</span><span style="color:var(--skin-info);">+${node.yearAdvance} years</span></div>
        ${prereqNames.length > 0 ? `
          <div class="rm-d-label">Prerequisites</div>
          ${prereqNames.map(p => `<div class="rm-d-prereq">${p}</div>`).join('')}
        ` : '<div class="rm-d-label" style="color:#336655;">No prerequisites</div>'}
        ${unlockBtn}
      </div>`;

      const unlockBtnEl = detailEl.querySelector('#rm-do-unlock');
      if (unlockBtnEl) {
        unlockBtnEl.addEventListener('click', () => {
          if (s.researchCredits < node.creditsCost) return;
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
          draw();
          showDetail(nodeId); // refresh detail panel
        });
      }
    };

    // Click handler
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (totalW / rect.width);
      const my = (e.clientY - rect.top) * (totalH / rect.height);

      for (const node of nodes) {
        const pos = positions.get(node.id);
        if (!pos) continue;
        if (mx >= pos.x && mx <= pos.x + nodeW && my >= pos.y && my <= pos.y + nodeH) {
          showDetail(node.id);
          return;
        }
      }
    });

    draw();
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
    this.updateDocs();
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
      entries.push(`<div class="portfolio-row" style="border-top:1px solid var(--skin-border);margin-top:4px;padding-top:4px;"><span style="color:var(--skin-text-mid);">Total</span><span class="value">$${totalValue.toFixed(2)}</span></div>`);
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
          : `<span style="color:var(--skin-text-mid);">$${sport.playerBets.totalWagered.toLocaleString()} wagered</span>`)
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
    const readyToCollect = s.getReadyToCollectMissions();
    const available = s.getAvailableMissions();
    const done = s.missions.filter(m => m.completed);
    const html: string[] = [];

    // Ready to collect — prominent collect buttons
    for (const m of readyToCollect) {
      const costText = m.collectCost ? ` — $${m.collectCost.toLocaleString()}` : '';
      const canAfford = !m.collectCost || s.money >= m.collectCost;
      const btnStyle = canAfford
        ? 'border-color:#ffcc4488;background:linear-gradient(135deg,#1a2a1a,#1a3a2a);'
        : 'border-color:#ff444444;opacity:0.7;';
      html.push(`<button class="sidebar-btn mission-collect-btn" data-id="${m.id}" style="${btnStyle}" title="${canAfford ? 'Click to collect!' : `Need $${m.collectCost!.toLocaleString()}`}">
        <span style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#ffcc44;">&#11088; ${m.name}</span>
          <span style="color:#44dd88;font-size:10px;font-weight:bold;">COLLECT${costText}</span>
        </span>
        <span class="year-advance" style="color:#aa88ff;font-size:9px;">+${m.researchCredits} cr${m.moneyReward > 0 ? ` +$${m.moneyReward.toLocaleString()}` : ''}</span>
      </button>`);
    }

    // Available missions
    for (const m of available) {
      html.push(`<div class="sidebar-btn mission-btn" data-id="${m.id}" title="${m.hint}" style="border-color:#aa88ff55;cursor:pointer;">
        <span style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#aa88ff;">${m.name}</span>
          <span class="cost" style="color:#aa88ff;">+${m.researchCredits} cr</span>
        </span>
        <span class="year-advance" style="color:var(--skin-text-mid);font-size:9px;">${m.description}</span>
        <span style="display:flex;justify-content:end;margin-top:3px;">
          <button class="mission-load-starter-btn" data-id="${m.id}" style="background:none;border:1px solid #aa88ff44;color:#aa88ff;font-size:9px;padding:1px 6px;border-radius:3px;cursor:pointer;" title="Load starter code into editor">&#128196; Load Code</button>
        </span>
      </div>`);
    }

    // Completed missions
    if (done.length > 0) {
      html.push(`<div style="margin-top:4px;">`);
      for (const m of done) {
        const hasCode = !!m.savedCode;
        html.push(`<div class="research-done" style="color:#6644aa;display:flex;justify-content:space-between;align-items:center;">
          <span>[DONE] ${m.name}</span>
          <span style="display:flex;gap:4px;">
            ${hasCode ? `<button class="mission-load-code-btn" data-id="${m.id}" style="background:none;border:1px solid #aa88ff44;color:#aa88ff;font-size:9px;padding:1px 5px;border-radius:3px;cursor:pointer;" title="View saved code snippet">&#128196;</button>` : ''}
            <button class="mission-save-code-btn" data-id="${m.id}" style="background:none;border:1px solid #44886644;color:#448866;font-size:9px;padding:1px 5px;border-radius:3px;cursor:pointer;" title="${hasCode ? 'Overwrite saved code with current editor' : 'Save current editor code to this mission'}">&#128190;</button>
          </span>
        </div>`);
      }
      html.push(`</div>`);
    }

    if (readyToCollect.length === 0 && available.length === 0 && done.length === 0) {
      html.push('<div class="stat-row" style="color:#334455;">No missions yet</div>');
    }

    el.innerHTML = html.join('');

    // Click handling is done via event delegation in constructor
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
      const style = canAfford ? '' : 'opacity:0.5;pointer-events:none;';
      html.push(`<button class="sidebar-btn shop-btn" style="${style}border-color:#44aa5555;" data-id="${item.id}" title="${item.description}"${canAfford ? '' : ' disabled'}>
        ${item.name}
        <span class="cost" style="color:#44dd88;">$${item.cost.toLocaleString()}</span>
        <span class="year-advance" style="color:var(--skin-text-mid);font-size:9px;">${item.description}</span>
      </button>`);
    }

    el.innerHTML = html.join('');

    // Click handling is done via event delegation in constructor
  }

  private updateDocs(): void {
    const setiUnlocked = this.state.researchTree.find(n => n.id === 'seti_program')?.researched ?? false;
    const setiGroup = this.el.querySelector('#docs-seti') as HTMLElement | null;
    const setiContent = this.el.querySelector('#docs-seti-content') as HTMLElement | null;
    const setiLock = this.el.querySelector('#docs-seti-lock') as HTMLElement | null;
    const setiTitle = this.el.querySelector('#docs-seti-title') as HTMLElement | null;
    const tocSeti = this.el.querySelector('#toc-seti') as HTMLElement | null;

    if (setiGroup && setiContent && setiLock && setiTitle) {
      if (setiUnlocked) {
        setiGroup.style.opacity = '';
        setiContent.style.display = '';
        setiLock.style.display = 'none';
        setiTitle.style.color = '';
        if (tocSeti) tocSeti.style.color = '#88ccaa';
      } else {
        setiGroup.style.opacity = '0.6';
        setiContent.style.display = 'none';
        setiLock.style.display = '';
        setiTitle.style.color = '#667788';
        if (tocSeti) tocSeti.style.color = '#667788';
      }
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
      const canAfford = s.researchCredits >= n.creditsCost;
      const style = canAfford ? '' : 'opacity:0.6;';
      html.push(`<button class="sidebar-btn research-btn" style="${style}" data-id="${n.id}" title="${n.description}">
        ${n.icon} ${n.name}
        <span class="cost" style="color:#aa88ff;">${n.creditsCost} credits</span>
        <span class="year-advance">+${n.yearAdvance}yr</span>
      </button>`);
    }

    if (done.length > 0) {
      for (const n of done) html.push(`<div class="research-done">${n.icon} ${n.name}</div>`);
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
