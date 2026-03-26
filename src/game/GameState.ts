import { EraRegistry } from './eras/EraRegistry';
import type { ResearchNode } from './research/ResearchTree';
import { createResearchTree } from './research/ResearchTree';
import type { ComputeHardware } from './Types';
import { StockMarket } from './economy/StockMarket';

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

  constructor() {
    this.researchTree = createResearchTree();
    this.eras = new EraRegistry();
    this.stockMarket = new StockMarket();
  }

  update(delta: number): void {
    this.timeAccumulator += delta;
    while (this.timeAccumulator >= this.TICK_RATE) {
      this.timeAccumulator -= this.TICK_RATE;
      this.tick();
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
  }
}
