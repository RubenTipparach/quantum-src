import { EraRegistry } from './eras/EraRegistry';
import type { ResearchNode } from './research/ResearchTree';
import { createResearchTree } from './research/ResearchTree';
import type { ComputeHardware } from './Types';
import { StockMarket } from './economy/StockMarket';
import { NewsFeed } from './economy/NewsFeed';
import { Shop } from './shop/Shop';
import type { Mission } from './missions/Missions';
import { createMissions } from './missions/Missions';

const SAVE_KEY = 'quantumsrc_gamestate';

interface SaveData {
  year: number;
  money: number;
  energy: number;
  totalEnergyCapacity: number;
  researchCredits: number;
  hardware: ComputeHardware;
  research: Record<string, { unlocked: boolean; researched: boolean }>;
  portfolio: Record<string, number>;
  completedMissions: string[];
  purchasedShopItems: string[];
}

export class GameState {
  year = 1983;
  money = 1000;
  energy = 100;
  totalEnergyCapacity = 100;
  researchCredits = 0;

  hardware: ComputeHardware = { type: 'cpu', cores: 1, clockSpeed: 4.77, generation: 1, ram: 0.640, maxRam: 16 };
  researchTree: ResearchNode[];
  eras: EraRegistry;
  stockMarket: StockMarket;
  newsFeed: NewsFeed;
  portfolio: Map<string, number> = new Map();
  shop: Shop;
  missions: Mission[];

  private timeAccumulator = 0;
  private readonly TICK_RATE = 1.5; // Slowed 50% from 1s to 1.5s
  private saveTimer = 0;
  private readonly SAVE_INTERVAL = 5;

  constructor() {
    this.researchTree = createResearchTree();
    this.eras = new EraRegistry();
    this.stockMarket = new StockMarket();
    this.newsFeed = new NewsFeed(this.stockMarket.stocks.map(s => s.symbol));
    this.stockMarket.setNewsFeed(this.newsFeed);
    this.shop = new Shop();
    this.missions = createMissions();
    this.load();
  }

  update(delta: number): void {
    this.timeAccumulator += delta;
    while (this.timeAccumulator >= this.TICK_RATE) {
      this.timeAccumulator -= this.TICK_RATE;
      this.tick();
    }

    this.saveTimer += delta;
    if (this.saveTimer >= this.SAVE_INTERVAL) {
      this.saveTimer = 0;
      this.save();
    }
  }

  private tick(): void {
    this.newsFeed.tick();
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

  /** Check and complete missions based on program output */
  checkMissions(outputs: string[]): Mission[] {
    const completed: Mission[] = [];
    const gameRef = {
      money: this.money,
      year: this.year,
      portfolio: this.portfolio,
      stockSymbols: this.stockMarket.stocks.map(s => s.symbol),
    };

    for (const mission of this.missions) {
      if (mission.completed) continue;
      // Check prerequisites
      const prereqsMet = mission.prerequisites.every(
        pid => this.missions.find(m => m.id === pid)?.completed
      );
      if (!prereqsMet) continue;

      if (mission.validate(outputs, gameRef)) {
        mission.completed = true;
        this.researchCredits += mission.researchCredits;
        this.money += mission.moneyReward;
        completed.push(mission);
      }
    }

    if (completed.length > 0) this.save();
    return completed;
  }

  getAvailableMissions(): Mission[] {
    return this.missions.filter(m => {
      if (m.completed) return false;
      return m.prerequisites.every(
        pid => this.missions.find(m2 => m2.id === pid)?.completed
      );
    });
  }

  save(): void {
    const data: SaveData = {
      year: this.year,
      money: this.money,
      energy: this.energy,
      totalEnergyCapacity: this.totalEnergyCapacity,
      researchCredits: this.researchCredits,
      hardware: this.hardware,
      research: {},
      portfolio: {},
      completedMissions: this.missions.filter(m => m.completed).map(m => m.id),
      purchasedShopItems: this.shop.items.filter(i => i.purchased).map(i => i.id),
    };

    for (const node of this.researchTree) {
      data.research[node.id] = { unlocked: node.unlocked, researched: node.researched };
    }

    for (const [sym, qty] of this.portfolio) {
      if (qty > 0) data.portfolio[sym] = qty;
    }

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* silently skip */ }
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
      this.researchCredits = data.researchCredits ?? 0;
      this.hardware = data.hardware;
      // Ensure new fields exist on old saves
      if (this.hardware.ram === undefined) this.hardware.ram = 0.640;
      if (this.hardware.maxRam === undefined) this.hardware.maxRam = 16;

      for (const node of this.researchTree) {
        const saved = data.research[node.id];
        if (saved) {
          node.unlocked = saved.unlocked;
          node.researched = saved.researched;
        }
      }

      this.portfolio.clear();
      for (const [sym, qty] of Object.entries(data.portfolio)) {
        if (qty > 0) this.portfolio.set(sym, qty);
      }

      // Restore missions
      if (data.completedMissions) {
        for (const id of data.completedMissions) {
          const m = this.missions.find(m2 => m2.id === id);
          if (m) m.completed = true;
        }
      }

      // Restore shop purchases (re-apply effects)
      if (data.purchasedShopItems) {
        for (const id of data.purchasedShopItems) {
          const item = this.shop.items.find(i => i.id === id);
          if (item) item.purchased = true;
          // Don't re-apply — hardware state already loaded
        }
      }
    } catch { /* corrupted save — start fresh */ }
  }

  resetSave(): void {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('quantumsrc_editor_code');
  }
}
