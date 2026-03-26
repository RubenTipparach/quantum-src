import type { ShopItem, GameStateRef } from '../Types';

export function createShopItems(): ShopItem[] {
  return [
    // === DAWN ERA: CPUs ===
    {
      id: 'cpu_8mhz',
      name: 'CPU 8MHz',
      description: '8086 processor. Double clock speed.',
      cost: 500,
      era: 'dawn',
      category: 'cpu',
      minYear: 1983,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.clockSpeed = 8; },
    },
    {
      id: 'cpu_16mhz',
      name: 'CPU 16MHz',
      description: '286 processor. Getting faster.',
      cost: 2000,
      era: 'dawn',
      category: 'cpu',
      minYear: 1985,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.clockSpeed = 16; },
    },
    {
      id: 'cpu_33mhz',
      name: 'CPU 33MHz',
      description: '486 processor. Serious computing.',
      cost: 5000,
      era: 'dawn',
      category: 'cpu',
      minYear: 1990,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.clockSpeed = 33; },
    },
    {
      id: 'cpu_66mhz',
      name: 'CPU 66MHz',
      description: 'Pentium-class processor.',
      cost: 10000,
      era: 'dawn',
      category: 'cpu',
      minYear: 1995,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.clockSpeed = 66; },
    },

    // === RAM ===
    {
      id: 'ram_1mb',
      name: 'RAM 1MB',
      description: 'Upgrade to 1MB RAM.',
      cost: 300,
      era: 'dawn',
      category: 'ram',
      minYear: 1983,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.ram = 1; },
    },
    {
      id: 'ram_4mb',
      name: 'RAM 4MB',
      description: 'Upgrade to 4MB. Room for bigger programs.',
      cost: 1500,
      era: 'dawn',
      category: 'ram',
      minYear: 1988,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.ram = 4; },
    },
    {
      id: 'ram_16mb',
      name: 'RAM 16MB',
      description: 'Upgrade to 16MB.',
      cost: 5000,
      era: 'dawn',
      category: 'ram',
      minYear: 1993,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.ram = 16; },
    },
    {
      id: 'ram_64mb',
      name: 'RAM 64MB',
      description: 'Upgrade to 64MB.',
      cost: 12000,
      era: 'dawn',
      category: 'ram',
      minYear: 1997,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.ram = 64; },
    },
    {
      id: 'ram_256mb',
      name: 'RAM 256MB',
      description: 'Upgrade to 256MB.',
      cost: 30000,
      era: 'crypto',
      category: 'ram',
      minYear: 2000,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.ram = 256; },
    },
    {
      id: 'ram_1gb',
      name: 'RAM 1GB',
      description: 'Upgrade to 1GB.',
      cost: 80000,
      era: 'crypto',
      category: 'ram',
      minYear: 2005,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.ram = 1024; },
    },

    // === ENERGY ===
    {
      id: 'psu_200w',
      name: 'PSU 200W',
      description: 'Bigger power supply. +100 energy capacity.',
      cost: 400,
      era: 'dawn',
      category: 'energy',
      minYear: 1983,
      unique: true,
      purchased: false,
      apply: (s) => { s.totalEnergyCapacity += 100; s.energy += 100; },
    },
    {
      id: 'psu_500w',
      name: 'PSU 500W',
      description: '+300 energy capacity.',
      cost: 3000,
      era: 'dawn',
      category: 'energy',
      minYear: 1990,
      unique: true,
      purchased: false,
      apply: (s) => { s.totalEnergyCapacity += 300; s.energy += 300; },
    },
    {
      id: 'solar_panel',
      name: 'Solar Panel',
      description: '+500 energy capacity.',
      cost: 15000,
      era: 'crypto',
      category: 'energy',
      minYear: 2005,
      unique: true,
      purchased: false,
      apply: (s) => { s.totalEnergyCapacity += 500; s.energy += 500; },
    },

    // === CRYPTO ERA: GPUs ===
    {
      id: 'gpu_128',
      name: 'GPU 128 cores',
      description: 'Entry-level GPU. Massively parallel.',
      cost: 25000,
      era: 'crypto',
      category: 'gpu',
      minYear: 2005,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.type = 'gpu'; s.hardware.cores = 128; s.hardware.clockSpeed = 500; s.hardware.maxRam = 4096; },
    },
    {
      id: 'gpu_512',
      name: 'GPU 512 cores',
      description: 'Mid-range GPU.',
      cost: 80000,
      era: 'crypto',
      category: 'gpu',
      minYear: 2015,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.type = 'gpu'; s.hardware.cores = 512; s.hardware.clockSpeed = 1000; s.hardware.maxRam = 8192; },
    },
    {
      id: 'gpu_2048',
      name: 'GPU 2048 cores',
      description: 'High-end GPU farm.',
      cost: 250000,
      era: 'crypto',
      category: 'gpu',
      minYear: 2030,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.type = 'gpu'; s.hardware.cores = 2048; s.hardware.clockSpeed = 2000; s.hardware.maxRam = 32768; },
    },

    // === QUANTUM ERA ===
    {
      id: 'quantum_8',
      name: 'Quantum 8 Qubits',
      description: 'First quantum processor.',
      cost: 1000000,
      era: 'quantum',
      category: 'quantum',
      minYear: 2060,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.type = 'quantum'; s.hardware.cores = 8; s.hardware.clockSpeed = 100; s.hardware.maxRam = 1048576; },
    },
    {
      id: 'quantum_64',
      name: 'Quantum 64 Qubits',
      description: 'Serious quantum computing.',
      cost: 10000000,
      era: 'quantum',
      category: 'quantum',
      minYear: 2100,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.type = 'quantum'; s.hardware.cores = 64; s.hardware.clockSpeed = 500; s.hardware.maxRam = 1048576; },
    },

    // === SUB-ATOMIC ERA ===
    {
      id: 'subatomic_1',
      name: 'Sub-Atomic Node',
      description: 'First sub-atomic computing node.',
      cost: 500000000,
      era: 'subatomic',
      category: 'subatomic',
      minYear: 2200,
      unique: true,
      purchased: false,
      apply: (s) => { s.hardware.type = 'subatomic'; s.hardware.cores = 1; s.hardware.clockSpeed = 10000; s.hardware.maxRam = 1048576; },
    },
  ];
}

export class Shop {
  items: ShopItem[];

  constructor() {
    this.items = createShopItems();
  }

  getAvailable(year: number): ShopItem[] {
    return this.items.filter(item => !item.purchased && year >= item.minYear);
  }

  purchase(itemId: string, state: GameStateRef & { money: number }): string {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return 'Item not found.';
    if (item.purchased) return 'Already purchased.';
    if (state.money < item.cost) return `Not enough money. Need $${item.cost.toLocaleString()}.`;
    state.money -= item.cost;
    item.purchased = true;
    item.apply(state);
    return `Purchased: ${item.name}`;
  }
}
