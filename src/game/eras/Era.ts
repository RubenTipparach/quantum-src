export interface Era {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  description: string;
}

export const ERAS: Era[] = [
  {
    id: 'dawn',
    name: 'Dawn of Computing',
    startYear: 1983,
    endYear: 2000,
    description: 'Personal computers emerge. Write trading algorithms on early CPUs to build wealth.',
  },
  {
    id: 'crypto',
    name: 'Crypto Revolution',
    startYear: 2000,
    endYear: 2050,
    description: 'Hash mining on GPUs. Cryptocurrency floods the markets. Scale your compute cores.',
  },
  {
    id: 'quantum',
    name: 'Quantum Disruption',
    startYear: 2050,
    endYear: 2200,
    description: 'Quantum computers break encryption. Financial systems collapse. Reshape the economy.',
  },
  {
    id: 'subatomic',
    name: 'Sub-Atomic Ascendancy',
    startYear: 2200,
    endYear: 2350,
    description: 'Sub-atomic computing unlocks limitless energy. Build megastructures. Achieve post-scarcity.',
  },
  {
    id: 'postscarcity',
    name: 'Post-Scarcity Civilization',
    startYear: 2350,
    endYear: 2500,
    description: 'Resources are unlimited. Expand across the stars. Complete the grand megastructures.',
  },
];
