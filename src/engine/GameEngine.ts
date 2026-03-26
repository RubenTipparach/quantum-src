import * as THREE from 'three';
import type { GameState } from '../game/GameState';

export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private hud: HTMLDivElement;
  private gameState: GameState;
  private clock: THREE.Clock;

  constructor(canvas: HTMLCanvasElement, hud: HTMLDivElement, gameState: GameState) {
    this.hud = hud;
    this.gameState = gameState;
    this.clock = new THREE.Clock();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.setupScene();
    this.setupHUD();

    window.addEventListener('resize', () => this.onResize());
  }

  private setupScene(): void {
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00ff88, 1);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    // Grid floor
    const gridHelper = new THREE.GridHelper(50, 50, 0x003322, 0x001a11);
    this.scene.add(gridHelper);

    // Placeholder CPU object
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

  private setupHUD(): void {
    this.hud.innerHTML = `
      <div id="status-bar" style="position:absolute;top:10px;left:10px;font-size:14px;line-height:1.8;">
        <div>Year: <span id="hud-year">1983</span></div>
        <div>Money: $<span id="hud-money">1000</span></div>
        <div>Energy: <span id="hud-energy">100</span> kWh</div>
        <div>Compute: <span id="hud-compute">CPU x1</span></div>
        <div>Era: <span id="hud-era">Dawn of Computing</span></div>
      </div>
      <div id="console-panel" style="position:absolute;bottom:10px;left:10px;right:10px;height:200px;
        background:rgba(0,0,0,0.85);border:1px solid #00ff88;border-radius:4px;padding:10px;
        font-size:13px;overflow-y:auto;">
        <div style="color:#00ff88;margin-bottom:8px;">&gt; QuantumSrc v0.1 — Type programs to begin trading...</div>
        <div id="console-output"></div>
        <div style="display:flex;align-items:center;margin-top:4px;">
          <span style="color:#00ff88;">&gt;&nbsp;</span>
          <input id="console-input" type="text" autocomplete="off" spellcheck="false"
            style="flex:1;background:transparent;border:none;color:#00ff88;font-family:inherit;
            font-size:inherit;outline:none;" />
        </div>
      </div>
    `;

    const input = document.getElementById('console-input') as HTMLInputElement;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = input.value.trim();
        if (code) {
          this.gameState.executeCommand(code);
          this.appendConsole(`> ${code}`);
          const result = this.gameState.getLastResult();
          if (result) this.appendConsole(result);
          input.value = '';
          this.updateHUD();
        }
      }
    });
  }

  private appendConsole(text: string): void {
    const output = document.getElementById('console-output');
    if (output) {
      const line = document.createElement('div');
      line.textContent = text;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    }
  }

  private updateHUD(): void {
    const s = this.gameState;
    const el = (id: string) => document.getElementById(id);
    el('hud-year')!.textContent = String(s.year);
    el('hud-money')!.textContent = s.money.toLocaleString();
    el('hud-energy')!.textContent = String(s.energy);
    el('hud-compute')!.textContent = s.getComputeLabel();
    el('hud-era')!.textContent = s.getEraName();
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start(): void {
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = this.clock.getDelta();
      this.gameState.update(delta);
      this.updateHUD();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
