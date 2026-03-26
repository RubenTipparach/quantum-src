import { EraRegistry } from './eras/EraRegistry';
import type { ResearchNode } from './research/ResearchTree';
import { createResearchTree } from './research/ResearchTree';
import type { ComputeHardware } from './Types';
import { StockMarket } from './economy/StockMarket';

const SAVE_KEY = 'quantumsrc_gamestate';

interface SaveData {
  year: number;
  money: number;
  energy: number;
  totalEnergyCapacity: number;
  hardware: ComputeHardware;
  research: Record<string, { unlocked: boolean; researched: boolean }>;
  portfolio: Record<string, number>;
}

export class GameState {
  year = 1983;
  money = 1000;
  energy = 100;
  totalEnergyCapacity = 100;

  hardware: ComputeHardware = { type: 'cpu', cores: 1, clockSpeed: 4.77, generation: 1 };
  researchTree: ResearchNode[];
  eras: EraRegistry;
  stockMarket: StockMarket;
  portfolio: Map<string, number> = new Map();

  private timeAccumulator = 0;
  private readonly TICK_RATE = 1;
  private saveTimer = 0;
  private readonly SAVE_INTERVAL = 5; // autosave every 5 seconds

  constructor() {
    this.researchTree = createResearchTree();
    this.eras = new EraRegistry();
    this.stockMarket = new StockMarket();
    this.load();
  }

  update(delta: number): void {
    this.timeAccumulator += delta;
    while (this.timeAccumulator >= this.TICK_RATE) {
      this.timeAccumulator -= this.TICK_RATE;
      this.tick();
    }

    // Periodic autosave
    this.saveTimer += delta;
    if (this.saveTimer >= this.SAVE_INTERVAL) {
      this.saveTimer = 0;
      this.save();
    }
  }

  private tick(): void {
    this.stockMarket.tick();
  }

  getComputeLabel(): string {
    const hw = this.hardware;
    switch (hw.type) {
      case 'cpu': return `CPU x${hw.cores} @ ${hw.clockSpeed}MHz`;
      case 'gpu': return `GPU x${hw.cores} cores`;
      case 'quantum': return `Quantum ${hw.cores} qubits`;
      case 'subatomic': return `Sub-Atomic ${hw.cores} nodes`;
    }
  }

  getEraName(): string {
    return this.eras.getCurrentEra(this.year).name;
  }

  advanceYear(years: number = 1): void {
    this.year += years;
    this.save();
  }

  save(): void {
    const data: SaveData = {
      year: this.year,
      money: this.money,
      energy: this.energy,
      totalEnergyCapacity: this.totalEnergyCapacity,
      hardware: this.hardware,
      research: {},
      portfolio: {},
    };

    for (const node of this.researchTree) {
      data.research[node.id] = { unlocked: node.unlocked, researched: node.researched };
    }

    for (const [sym, qty] of this.portfolio) {
      if (qty > 0) data.portfolio[sym] = qty;
    }

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable — silently skip
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;

      const data: SaveData = JSON.parse(raw);

      this.year = data.year;
      this.money = data.money;
      this.energy = data.energy;
      this.totalEnergyCapacity = data.totalEnergyCapacity;
      this.hardware = data.hardware;

      // Restore research state
      for (const node of this.researchTree) {
        const saved = data.research[node.id];
        if (saved) {
          node.unlocked = saved.unlocked;
          node.researched = saved.researched;
        }
      }

      // Restore portfolio
      this.portfolio.clear();
      for (const [sym, qty] of Object.entries(data.portfolio)) {
        if (qty > 0) this.portfolio.set(sym, qty);
      }
    } catch {
      // Corrupted save — start fresh
    }
  }

  resetSave(): void {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('quantumsrc_editor_code');
  }
}
