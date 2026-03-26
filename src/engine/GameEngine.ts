import * as THREE from 'three';
import type { GameState } from '../game/GameState';
import { Sandbox, type ConsoleEntry } from '../game/programming/Sandbox';
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
    const panels = ['sidebar', 'main-panel'];

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset['tab'];
        if (!target) return;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        panels.forEach(id => {
          const panel = document.getElementById(id);
          if (panel) {
            if (id === target) panel.classList.add('active-tab');
            else panel.classList.remove('active-tab');
          }
        });
        requestAnimationFrame(() => this.onResize());
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

  private getExecutionSpeed(): number {
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

    // Execute the FULL program at once (so let/const scoping works correctly)
    const entries = this.sandbox.executeTagged(code, this.gameState);

    this.runBtn.textContent = 'RUNNING...';
    this.runBtn.style.opacity = '0.5';
    this.consoleOutput.appendSystem('--- EXECUTING ---');
    this.vfx.trigger('run');

    const speed = this.getExecutionSpeed();
    const lines = this.editor.getLines();

    // Build a queue of entries to show per line
    // Entries with a line number get shown when the highlight reaches that line.
    // Entries without a line number get shown at the end.
    const pendingEntries = [...entries];

    this.editor.stepExecution(speed, {
      onLine: (lineNumber, lineText) => {
        const trimmed = lineText.trim();

        // Trigger VFX based on source text
        if (trimmed !== '' && !trimmed.startsWith('//')) {
          this.detectVFX(trimmed);
        }

        // Flush any entries tagged for this line or earlier
        while (pendingEntries.length > 0) {
          const next = pendingEntries[0]!;
          if (next.line !== undefined && next.line <= lineNumber) {
            pendingEntries.shift();
            this.consoleOutput.append(next);
            if (next.type === 'error') this.vfx.trigger('error');
          } else {
            break;
          }
        }
      },

      onDone: () => {
        // Flush any remaining entries (untagged or past last line)
        for (const entry of pendingEntries) {
          this.consoleOutput.append(entry);
          if (entry.type === 'error') this.vfx.trigger('error');
        }

        this.consoleOutput.appendSystem('--- DONE ---');
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
