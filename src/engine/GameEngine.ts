import type { GameState } from '../game/GameState';
import { Sandbox } from '../game/programming/Sandbox';
import { CodeEditor } from '../ui/CodeEditor';
import { ConsoleOutput } from '../ui/ConsoleOutput';
import { Sidebar } from '../ui/Sidebar';
import { StockChart } from '../ui/StockChart';

export class GameEngine {
  private gameState: GameState;
  private sandbox: Sandbox;
  private consoleOutput: ConsoleOutput;
  private sidebar: Sidebar;
  private editor: CodeEditor;
  private runBtn: HTMLButtonElement;
  private stockChart: StockChart;

  constructor(gameState: GameState) {
    this.gameState = gameState;
    this.sandbox = new Sandbox();

    const consoleEl = document.getElementById('console-panel') as HTMLDivElement;
    this.consoleOutput = new ConsoleOutput(consoleEl);

    document.getElementById('clear-console-btn')!.addEventListener('click', () => {
      this.consoleOutput.clear();
    });

    const sidebarEl = document.getElementById('sidebar') as HTMLDivElement;
    this.sidebar = new Sidebar(sidebarEl, gameState, this.consoleOutput);

    this.sidebar.setOnLoadMission((mission) => {
      this.editor.setCode(mission.starterCode);
      this.consoleOutput.appendSystem(`--- MISSION: ${mission.name} ---`);
      this.consoleOutput.appendLog(mission.description);
      this.consoleOutput.appendLog(`Hint: ${mission.hint}`);
      this.consoleOutput.appendLog(`Reward: ${mission.researchCredits} research credits` + (mission.moneyReward > 0 ? ` + $${mission.moneyReward.toLocaleString()}` : ''));
    });

    const editorContainer = document.getElementById('editor-container') as HTMLDivElement;
    this.editor = new CodeEditor(editorContainer, (code) => this.runCode(code));

    this.runBtn = document.getElementById('run-btn') as HTMLButtonElement;
    this.runBtn.addEventListener('click', () => {
      this.runCode(this.editor.getCode());
    });

    // Stock chart
    const chartCanvas = document.getElementById('stock-chart-canvas') as HTMLCanvasElement;
    this.stockChart = new StockChart(chartCanvas);
    this.setupChartControls();

    // Mobile tabs
    this.setupTabs();
  }

  private setupChartControls(): void {
    const btnCandle = document.getElementById('btn-candle')!;
    const btnLine = document.getElementById('btn-line')!;

    btnCandle.addEventListener('click', () => {
      this.stockChart.setMode('candle');
      btnCandle.classList.add('active');
      btnLine.classList.remove('active');
    });
    btnLine.addEventListener('click', () => {
      this.stockChart.setMode('line');
      btnLine.classList.add('active');
      btnCandle.classList.remove('active');
    });

    // Stock selector buttons
    const selectorEl = document.getElementById('stock-selector')!;
    const stocks = this.gameState.stockMarket.stocks;
    for (const s of stocks) {
      const btn = document.createElement('button');
      btn.textContent = s.symbol;
      btn.dataset['sym'] = s.symbol;
      if (s.symbol === this.gameState.stockMarket.selectedSymbol) btn.classList.add('active');
      btn.addEventListener('click', () => {
        this.gameState.stockMarket.selectedSymbol = s.symbol;
        selectorEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      selectorEl.appendChild(btn);
    }
  }

  private setupTabs(): void {
    const tabBar = document.getElementById('tab-bar');
    if (!tabBar) return;

    const tabs = tabBar.querySelectorAll('button');
    const sidebar = document.getElementById('sidebar')!;
    const mainPanel = document.getElementById('main-panel')!;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset['tab'];
        if (!target) return;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        sidebar.classList.remove('active-tab');
        mainPanel.classList.remove('active-tab', 'active-tab-code', 'active-tab-output');
        if (target === 'sidebar') {
          sidebar.classList.add('active-tab');
        } else if (target === 'code') {
          mainPanel.classList.add('active-tab-code');
        } else if (target === 'output') {
          mainPanel.classList.add('active-tab-output');
        }
      });
    });
  }

  async init(): Promise<void> {
    try {
      await this.sandbox.init(this.gameState);
      this.consoleOutput.appendSystem('Sandbox ready. Write code and click RUN.');
    } catch (err) {
      this.consoleOutput.appendError(`Sandbox failed to load: ${err}`);
      this.consoleOutput.appendSystem('You can still use sidebar buttons.');
    }
  }

  private getStepDelay(): number {
    const hw = this.gameState.hardware;
    switch (hw.type) {
      case 'cpu': return Math.max(20, 150 - hw.clockSpeed * 5);
      case 'gpu': return Math.max(10, 60 - hw.cores * 0.1);
      case 'quantum': return 5;
      case 'subatomic': return 2;
    }
  }

  private runCode(code: string): void {
    if (this.editor.isRunning()) return;
    if (!this.sandbox.isReady()) {
      this.consoleOutput.appendError('Sandbox still loading...');
      return;
    }

    const trace = this.sandbox.executeTraced(code, this.gameState);

    if (trace.steps.length === 0 && trace.error) {
      this.consoleOutput.appendError(trace.error.text);
      return;
    }

    this.runBtn.textContent = 'RUNNING...';
    this.runBtn.style.opacity = '0.5';
    this.consoleOutput.appendSystem('--- EXECUTING ---');

    const speed = this.getStepDelay();
    const lines = this.editor.getLines();

    const outputsByStep = new Map<number, typeof trace.outputs>();
    for (const o of trace.outputs) {
      const arr = outputsByStep.get(o.stepIndex) ?? [];
      arr.push(o);
      outputsByStep.set(o.stepIndex, arr);
    }

    this.editor.replayTrace(trace.steps, speed, {
      onStep: (stepIndex, lineNumber) => {
        const lineText = lines[lineNumber - 1] ?? '';
        const trimmed = lineText.trim();
        if (trimmed !== '') this.detectVFX(trimmed);

        const outputs = outputsByStep.get(stepIndex);
        if (outputs) {
          for (const o of outputs) {
            this.consoleOutput.append(o.entry);
          }
        }
      },

      onDone: () => {
        if (trace.error) {
          this.consoleOutput.append(trace.error);
        }

        this.consoleOutput.appendSystem('--- DONE ---');

        const allOutputs = trace.outputs.map(o => o.entry.text);
        const completed = this.gameState.checkMissions(allOutputs);
        for (const m of completed) {
          this.consoleOutput.appendSystem(`MISSION COMPLETE: ${m.name}!`);
          this.consoleOutput.appendLog(`+${m.researchCredits} research credits` + (m.moneyReward > 0 ? ` +$${m.moneyReward.toLocaleString()}` : ''));
        }

        this.runBtn.textContent = 'RUN';
        this.runBtn.style.opacity = '1';
      },
    });
  }

  private detectVFX(_line: string): void {
    // VFX triggers reserved for future 3D effects
  }

  start(): void {
    let lastTime = performance.now();
    const animate = () => {
      requestAnimationFrame(animate);
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      this.gameState.update(delta);
      this.sidebar.update();

      // Render stock chart
      const stock = this.gameState.stockMarket.getSelectedStock();
      this.stockChart.render(stock);
    };
    animate();
  }
}
