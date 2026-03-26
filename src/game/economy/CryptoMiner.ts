import type { ComputeHardware } from '../Types';
import type { GameState } from '../GameState';

export class CryptoMiner {
  hashRate = 0; // hashes per tick
  totalMined = 0;
  miningActive = false;
  difficulty = 1;
  rewardPerBlock = 50;

  constructor(hardware: ComputeHardware) {
    this.updateHashRate(hardware);
  }

  updateHashRate(hardware: ComputeHardware): void {
    switch (hardware.type) {
      case 'cpu':
        this.hashRate = hardware.cores * hardware.clockSpeed * 0.001;
        break;
      case 'gpu':
        this.hashRate = hardware.cores * hardware.clockSpeed * 0.1;
        break;
      case 'quantum':
        this.hashRate = hardware.cores * hardware.clockSpeed * 1000;
        break;
      case 'subatomic':
        this.hashRate = hardware.cores * hardware.clockSpeed * 1000000;
        break;
    }
  }

  tick(state: GameState): void {
    if (!this.miningActive) return;

    const energyCost = this.hashRate * 0.01;
    if (state.energy < energyCost) {
      this.miningActive = false;
      return;
    }

    state.energy -= energyCost;
    const chance = this.hashRate / this.difficulty;
    if (Math.random() < Math.min(chance, 0.5)) {
      const reward = this.rewardPerBlock / this.difficulty;
      state.money += reward;
      this.totalMined += reward;
      this.difficulty *= 1.001; // slowly increasing difficulty
    }
  }

  startMining(): string {
    this.miningActive = true;
    return `Mining started. Hash rate: ${this.hashRate.toFixed(2)} H/s`;
  }

  stopMining(): string {
    this.miningActive = false;
    return `Mining stopped. Total mined: $${this.totalMined.toFixed(2)}`;
  }
}
