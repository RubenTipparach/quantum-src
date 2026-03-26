import * as THREE from 'three';
import type { GameState } from '../game/GameState';
import { Sandbox } from '../game/programming/Sandbox';
import { CodeEditor } from '../ui/CodeEditor';
import { ConsoleOutput } from '../ui/ConsoleOutput';
import { Sidebar } from '../ui/Sidebar';
import { VFXSystem } from './VFXSystem';

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private gameState: GameState;
  private clock: THREE.Clock;
  private sandbox: Sandbox;
  private consoleOutput: ConsoleOutput;
  private sidebar: Sidebar;
  private editor: CodeEditor;
  private runBtn: HTMLButtonElement;
  private vfx: VFXSystem;

  constructor(canvas: HTMLCanvasElement, gameState: GameState) {
    this.gameState = gameState;
    this.clock = new THREE.Clock();
    this.sandbox = new Sandbox();

    const consoleEl = document.getElementById('console-panel') as HTMLDivElement;
    this.consoleOutput = new ConsoleOutput(consoleEl);

    document.getElementById('clear-console-btn')!.addEventListener('click', () => {
      this.consoleOutput.clear();
    });

    const sidebarEl = document.getElementById('sidebar') as HTMLDivElement;
    this.sidebar = new Sidebar(sidebarEl, gameState, this.consoleOutput);

    // Wire up mission loading into editor
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

    this.setupTabs();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050510);

    const viewport = document.getElementById('viewport')!;
    const w = viewport.clientWidth || 280;
    const h = viewport.clientHeight || 220;
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
    this.camera.position.set(0, 3, 5);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.setupScene();
    this.vfx = new VFXSystem(this.scene);

    window.addEventListener('resize', () => this.onResize());
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

        // Clear all states
        sidebar.classList.remove('active-tab');
        mainPanel.classList.remove('active-tab', 'active-tab-code', 'active-tab-output');

        if (target === 'sidebar') {
          sidebar.classList.add('active-tab');
        } else if (target === 'code') {
          mainPanel.classList.add('active-tab-code');
        } else if (target === 'output') {
          mainPanel.classList.add('active-tab-output');
          requestAnimationFrame(() => this.onResize());
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

  /** Ms per trace step — scales with hardware */
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

    // Execute fully, get the trace
    const trace = this.sandbox.executeTraced(code, this.gameState);

    if (trace.steps.length === 0 && trace.error) {
      this.consoleOutput.appendError(trace.error.text);
      return;
    }

    this.runBtn.textContent = 'RUNNING...';
    this.runBtn.style.opacity = '0.5';
    this.consoleOutput.appendSystem('--- EXECUTING ---');
    this.vfx.trigger('run');

    const speed = this.getStepDelay();
    const lines = this.editor.getLines();

    // Build a lookup: stepIndex → outputs produced at that step
    const outputsByStep = new Map<number, typeof trace.outputs>();
    for (const o of trace.outputs) {
      const arr = outputsByStep.get(o.stepIndex) ?? [];
      arr.push(o);
      outputsByStep.set(o.stepIndex, arr);
    }

    this.editor.replayTrace(trace.steps, speed, {
      onStep: (stepIndex, lineNumber) => {
        // VFX based on source line
        const lineText = lines[lineNumber - 1] ?? '';
        const trimmed = lineText.trim();
        if (trimmed !== '') this.detectVFX(trimmed);

        // Show any outputs produced at this trace step
        const outputs = outputsByStep.get(stepIndex);
        if (outputs) {
          for (const o of outputs) {
            this.consoleOutput.append(o.entry);
            if (o.entry.type === 'error') this.vfx.trigger('error');
          }
        }
      },

      onDone: () => {
        if (trace.error) {
          this.consoleOutput.append(trace.error);
          this.vfx.trigger('error');
        }

        this.consoleOutput.appendSystem('--- DONE ---');

        // Check missions against all log outputs
        const allOutputs = trace.outputs.map(o => o.entry.text);
        const completed = this.gameState.checkMissions(allOutputs);
        for (const m of completed) {
          this.consoleOutput.appendSystem(`MISSION COMPLETE: ${m.name}!`);
          this.consoleOutput.appendLog(`+${m.researchCredits} research credits` + (m.moneyReward > 0 ? ` +$${m.moneyReward.toLocaleString()}` : ''));
        }

        this.runBtn.textContent = 'RUN';
        this.runBtn.style.opacity = '1';
        this.vfx.trigger('done');
      },
    });
  }

  private detectVFX(line: string): void {
    if (line.includes('game.buy(')) this.vfx.trigger('buy');
    if (line.includes('game.sell(')) this.vfx.trigger('sell');
    if (line.includes('game.getStocks(')) this.vfx.trigger('getStocks');
    if (line.includes('print(') || line.includes('console.log(')) this.vfx.trigger('print');
  }

  private setupScene(): void {
    const ambientLight = new THREE.AmbientLight(0x303050, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00ff88, 0.8);
    dirLight.position.set(3, 5, 3);
    this.scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(10, 10, 0x002215, 0x001108);
    this.scene.add(gridHelper);
  }

  private onResize(): void {
    const viewport = document.getElementById('viewport')!;
    const w = viewport.clientWidth || 1;
    const h = viewport.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  start(): void {
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = this.clock.getDelta();
      this.gameState.update(delta);
      this.sidebar.update();
      this.vfx.update(delta);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
