import type { Mission } from '../Types';

export const MISSIONS: Mission[] = [
  // Dawn era
  {
    id: 'first_trade',
    name: 'First Trade',
    description: 'Buy and sell your first stock to learn the market.',
    era: 'dawn',
    requirements: [{ type: 'program', value: 'buy' }],
    rewards: { money: 500 },
    completed: false,
  },
  {
    id: 'profit_1000',
    name: 'First Thousand',
    description: 'Accumulate $2,000 total wealth through trading.',
    era: 'dawn',
    requirements: [{ type: 'money', value: 2000 }],
    rewards: { money: 1000, research: ['basic_trading'] },
    completed: false,
  },
  {
    id: 'overclock_cpu',
    name: 'Push the Limits',
    description: 'Research CPU overclocking to boost your compute power.',
    era: 'dawn',
    requirements: [{ type: 'research', value: 'overclock' }],
    rewards: { money: 3000, yearAdvance: 5 },
    completed: false,
  },

  // Crypto era
  {
    id: 'first_hash',
    name: 'First Hash',
    description: 'Mine your first cryptocurrency block.',
    era: 'crypto',
    requirements: [{ type: 'research', value: 'hash_mining' }],
    rewards: { money: 15000, energy: 50 },
    completed: false,
  },
  {
    id: 'gpu_upgrade',
    name: 'GPU Revolution',
    description: 'Transition to GPU-based computing.',
    era: 'crypto',
    requirements: [{ type: 'research', value: 'gpu_compute' }],
    rewards: { money: 50000 },
    completed: false,
  },
  {
    id: 'mining_empire',
    name: 'Mining Empire',
    description: 'Build a massive GPU mining operation.',
    era: 'crypto',
    requirements: [{ type: 'research', value: 'gpu_farm' }, { type: 'money', value: 500000 }],
    rewards: { money: 200000, yearAdvance: 10 },
    completed: false,
  },

  // Quantum era
  {
    id: 'quantum_leap',
    name: 'Quantum Leap',
    description: 'Achieve quantum computing capability.',
    era: 'quantum',
    requirements: [{ type: 'research', value: 'quantum_basics' }],
    rewards: { money: 1000000 },
    completed: false,
  },
  {
    id: 'break_encryption',
    name: 'Break the Code',
    description: 'Use quantum computing to break modern encryption.',
    era: 'quantum',
    requirements: [{ type: 'research', value: 'encryption_breaking' }],
    rewards: { money: 5000000, yearAdvance: 20 },
    completed: false,
  },
  {
    id: 'crash_markets',
    name: 'Controlled Demolition',
    description: 'Collapse the global financial system to redistribute wealth.',
    era: 'quantum',
    requirements: [{ type: 'research', value: 'market_collapse' }],
    rewards: { money: 50000000, yearAdvance: 50 },
    completed: false,
  },

  // Sub-atomic & post-scarcity
  {
    id: 'unlimited_power',
    name: 'Unlimited Power',
    description: 'Synthesize energy from sub-atomic reactions.',
    era: 'subatomic',
    requirements: [{ type: 'research', value: 'energy_synthesis' }],
    rewards: { energy: 999999 },
    completed: false,
  },
  {
    id: 'build_megastructure',
    name: 'Dyson Sphere',
    description: 'Construct the first megastructure around a star.',
    era: 'subatomic',
    requirements: [{ type: 'research', value: 'megastructure_foundation' }, { type: 'energy', value: 100000 }],
    rewards: { money: 1000000000, yearAdvance: 100 },
    completed: false,
  },
  {
    id: 'post_scarcity',
    name: 'The Singularity',
    description: 'Achieve post-scarcity. Humanity is free.',
    era: 'postscarcity',
    requirements: [{ type: 'research', value: 'post_scarcity' }],
    rewards: {},
    completed: false,
  },
];

export class MissionRegistry {
  missions: Mission[] = MISSIONS.map(m => ({ ...m, requirements: [...m.requirements], rewards: { ...m.rewards } }));

  getActiveMissions(era: string): Mission[] {
    return this.missions.filter(m => m.era === era && !m.completed);
  }

  getCompletedMissions(): Mission[] {
    return this.missions.filter(m => m.completed);
  }
}
