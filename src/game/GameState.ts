import { EraRegistry } from './eras/EraRegistry';
import type { ResearchNode } from './research/ResearchTree';
import { createResearchTree } from './research/ResearchTree';
import type { ComputeHardware } from './Types';
import { StockMarket } from './economy/StockMarket';
import { NewsFeed } from './economy/NewsFeed';
import { Shop } from './shop/Shop';
import { SportsLeague } from './sports/SportsLeague';
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
  readyToCollectMissions?: string[];
  missionCode?: Record<string, string>;
  purchasedShopItems: string[];
  stockMarket?: object;
  newsFeed?: object;
  sportsLeague?: object;
  setiTransmitted?: boolean;
  setiTransmitYear?: number;
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
  sportsLeague: SportsLeague;
  missions: Mission[];

  // SETI state
  setiTransmitted = false;
  setiTransmitYear = 0;

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
    this.sportsLeague = new SportsLeague();
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
    this.sportsLeague.tick();

    // Auto-collect sports payouts
    const payouts = this.sportsLeague.collectPayouts();
    if (payouts > 0) {
      this.money += payouts;
    }
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

  /** Check missions and mark as ready to collect (does NOT auto-complete) */
  checkMissions(outputs: string[]): Mission[] {
    const ready: Mission[] = [];
    const gameRef = {
      money: this.money,
      year: this.year,
      portfolio: this.portfolio,
      stockSymbols: this.stockMarket.stocks.map(s => s.symbol),
    };

    for (const mission of this.missions) {
      if (mission.completed || mission.readyToCollect) continue;
      if (mission.minYear && this.year < mission.minYear) continue;
      if (mission.requiredResearch) {
        const node = this.researchTree.find(n => n.id === mission.requiredResearch);
        if (!node?.researched) continue;
      }
      const prereqsMet = mission.prerequisites.every(
        pid => this.missions.find(m => m.id === pid)?.completed
      );
      if (!prereqsMet) continue;

      if (mission.validate(outputs, gameRef)) {
        mission.readyToCollect = true;
        ready.push(mission);
      }
    }

    if (ready.length > 0) this.save();
    return ready;
  }

  /** Collect a mission that is ready — awards rewards, deducts collectCost */
  collectMission(missionId: string): { success: boolean; message: string } {
    const mission = this.missions.find(m => m.id === missionId);
    if (!mission) return { success: false, message: 'Mission not found.' };
    if (mission.completed) return { success: false, message: 'Already collected.' };
    if (!mission.readyToCollect) return { success: false, message: 'Mission not ready.' };

    if (mission.collectCost && this.money < mission.collectCost) {
      return { success: false, message: `Not enough funds. Need $${mission.collectCost.toLocaleString()}.` };
    }

    if (mission.collectCost) {
      this.money -= mission.collectCost;
    }
    mission.readyToCollect = false;
    mission.completed = true;
    this.researchCredits += mission.researchCredits;
    this.money += mission.moneyReward;
    this.save();
    return { success: true, message: `Collected: ${mission.name}!` };
  }

  getAvailableMissions(): Mission[] {
    return this.missions.filter(m => {
      if (m.completed || m.readyToCollect) return false;
      if (m.minYear && this.year < m.minYear) return false;
      if (m.requiredResearch) {
        const node = this.researchTree.find(n => n.id === m.requiredResearch);
        if (!node?.researched) return false;
      }
      return m.prerequisites.every(
        pid => this.missions.find(m2 => m2.id === pid)?.completed
      );
    });
  }

  getReadyToCollectMissions(): Mission[] {
    return this.missions.filter(m => m.readyToCollect && !m.completed);
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
      readyToCollectMissions: this.missions.filter(m => m.readyToCollect).map(m => m.id),
      missionCode: Object.fromEntries(this.missions.filter(m => m.savedCode).map(m => [m.id, m.savedCode!])),
      purchasedShopItems: this.shop.items.filter(i => i.purchased).map(i => i.id),
      stockMarket: this.stockMarket.serialize(),
      newsFeed: this.newsFeed.serialize(),
      sportsLeague: this.sportsLeague.serialize(),
      setiTransmitted: this.setiTransmitted,
      setiTransmitYear: this.setiTransmitYear,
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
      if (data.readyToCollectMissions) {
        for (const id of data.readyToCollectMissions) {
          const m = this.missions.find(m2 => m2.id === id);
          if (m) m.readyToCollect = true;
        }
      }
      if (data.missionCode) {
        for (const [id, code] of Object.entries(data.missionCode)) {
          const m = this.missions.find(m2 => m2.id === id);
          if (m) m.savedCode = code;
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

      // Restore SETI state
      if (data.setiTransmitted) this.setiTransmitted = true;
      if (data.setiTransmitYear) this.setiTransmitYear = data.setiTransmitYear;

      // Restore stock market state
      if (data.stockMarket) {
        this.stockMarket.deserialize(data.stockMarket as Parameters<typeof this.stockMarket.deserialize>[0]);
      }

      // Restore news feed
      if (data.newsFeed) {
        this.newsFeed.deserialize(data.newsFeed as Parameters<typeof this.newsFeed.deserialize>[0]);
      }

      // Restore sports league state
      if (data.sportsLeague) {
        this.sportsLeague.deserialize(data.sportsLeague);
      }
    } catch { /* corrupted save — start fresh */ }
  }

  resetSave(): void {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('quantumsrc_editor_code');
  }
}
