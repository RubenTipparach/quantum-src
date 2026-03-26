import * as THREE from 'three';
import type { GameState } from '../game/GameState';
import { Sandbox } from '../game/programming/Sandbox';
import { CodeEditor } from '../ui/CodeEditor';
import { ConsoleOutput } from '../ui/ConsoleOutput';
import { Sidebar } from '../ui/Sidebar';

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private gameState: GameState;
  private clock: THREE.Clock;
  private sandbox: Sandbox;
  private consoleOutput: ConsoleOutput;
  private sidebar: Sidebar;

  constructor(canvas: HTMLCanvasElement, gameState: GameState) {
    this.gameState = gameState;
    this.clock = new THREE.Clock();
    this.sandbox = new Sandbox();

    // Console output
    const consoleEl = document.getElementById('console-panel') as HTMLDivElement;
    this.consoleOutput = new ConsoleOutput(consoleEl);

    // Sidebar
    const sidebarEl = document.getElementById('sidebar') as HTMLDivElement;
    this.sidebar = new Sidebar(sidebarEl, gameState, this.consoleOutput);

    // Code editor
    const editorContainer = document.getElementById('editor-container') as HTMLDivElement;
    new CodeEditor(editorContainer, (code) => this.runCode(code));

    // Run button
    document.getElementById('run-btn')!.addEventListener('click', () => {
      const editorView = editorContainer.querySelector('.cm-content') as HTMLElement;
      // Get code from CodeMirror
      const code = editorView?.innerText ?? '';
      this.runCode(code);
    });

    // Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    const viewport = document.getElementById('viewport')!;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.setupScene();
    window.addEventListener('resize', () => this.onResize());

    // Init sandbox (async)
    this.sandbox.init(gameState).then(() => {
      this.consoleOutput.appendSystem('Sandbox ready.');
    });
  }

  private runCode(code: string): void {
    if (!this.sandbox.isReady()) {
      this.consoleOutput.appendError('Sandbox still loading...');
      return;
    }
    this.consoleOutput.appendSystem('--- RUN ---');
    const entries = this.sandbox.execute(code, this.gameState);
    this.consoleOutput.appendEntries(entries);
  }

  private setupScene(): void {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00ff88, 1);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(50, 50, 0x003322, 0x001a11);
    this.scene.add(gridHelper);

    // CPU chip
    const cpuGeometry = new THREE.BoxGeometry(2, 0.3, 2);
    const cpuMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aa55,
      emissive: 0x003311,
      metalness: 0.8,
      roughness: 0.2,
    });
    const cpuMesh = new THREE.Mesh(cpuGeometry, cpuMaterial);
    cpuMesh.position.y = 0.15;
    this.scene.add(cpuMesh);
  }

  private onResize(): void {
    const viewport = document.getElementById('viewport')!;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
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
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
