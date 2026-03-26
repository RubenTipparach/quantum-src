export interface ResearchNode {
  id: string;
  name: string;
  description: string;
  cost: number;
  era: string;
  prerequisites: string[];
  unlocked: boolean;
  researched: boolean;
}

export function createResearchTree(): ResearchNode[] {
  return [
    // Dawn era — CPU
    {
      id: 'basic_trading',
      name: 'Basic Trading Algorithms',
      description: 'Write simple buy/sell programs for the stock market.',
      cost: 500,
      era: 'dawn',
      prerequisites: [],
      unlocked: true,
      researched: false,
    },
    {
      id: 'market_analysis',
      name: 'Market Pattern Analysis',
      description: 'Detect trends and patterns in stock data.',
      cost: 2000,
      era: 'dawn',
      prerequisites: ['basic_trading'],
      unlocked: false,
      researched: false,
    },
    {
      id: 'overclock',
      name: 'CPU Overclocking',
      description: 'Push your CPU beyond factory limits for faster execution.',
      cost: 1500,
      era: 'dawn',
      prerequisites: ['basic_trading'],
      unlocked: false,
      researched: false,
    },
    {
      id: 'multi_core',
      name: 'Multi-Core Processing',
      description: 'Unlock parallel execution across multiple CPU cores.',
      cost: 5000,
      era: 'dawn',
      prerequisites: ['overclock'],
      unlocked: false,
      researched: false,
    },

    // Crypto era — GPU
    {
      id: 'hash_mining',
      name: 'Hash Mining',
      description: 'Mine cryptocurrency by computing cryptographic hashes on CPU.',
      cost: 10000,
      era: 'crypto',
      prerequisites: ['multi_core'],
      unlocked: false,
      researched: false,
    },
    {
      id: 'gpu_compute',
      name: 'GPU Compute',
      description: 'Transition to massively parallel GPU mining.',
      cost: 25000,
      era: 'crypto',
      prerequisites: ['hash_mining'],
      unlocked: false,
      researched: false,
    },
    {
      id: 'gpu_farm',
      name: 'GPU Mining Farm',
      description: 'Scale to hundreds of GPU cores for industrial mining.',
      cost: 100000,
      era: 'crypto',
      prerequisites: ['gpu_compute'],
      unlocked: false,
      researched: false,
    },
    {
      id: 'blockchain_exploit',
      name: 'Blockchain Analysis',
      description: 'Analyze blockchain for market manipulation opportunities.',
      cost: 50000,
      era: 'crypto',
      prerequisites: ['gpu_compute', 'market_analysis'],
      unlocked: false,
      researched: false,
    },

    // Quantum era
    {
      id: 'quantum_basics',
      name: 'Quantum Computing Basics',
      description: 'Harness quantum superposition for exponential compute.',
      cost: 500000,
      era: 'quantum',
      prerequisites: ['gpu_farm'],
      unlocked: false,
      researched: false,
    },
    {
      id: 'encryption_breaking',
      name: 'Encryption Breaking',
      description: 'Use quantum algorithms to break RSA/elliptic-curve encryption.',
      cost: 2000000,
      era: 'quantum',
      prerequisites: ['quantum_basics'],
      unlocked: false,
      researched: false,
    },
    {
      id: 'market_collapse',
      name: 'Financial System Disruption',
      description: 'Break the encryption securing global financial systems. Tank the stock market.',
      cost: 10000000,
      era: 'quantum',
      prerequisites: ['encryption_breaking', 'blockchain_exploit'],
      unlocked: false,
      researched: false,
    },

    // Sub-atomic era
    {
      id: 'subatomic_compute',
      name: 'Sub-Atomic Computing',
      description: 'Compute at the sub-atomic level. Effectively unlimited processing.',
      cost: 100000000,
      era: 'subatomic',
      prerequisites: ['market_collapse'],
      unlocked: false,
      researched: false,
    },
    {
      id: 'energy_synthesis',
      name: 'Energy Synthesis',
      description: 'Generate unlimited energy from sub-atomic reactions.',
      cost: 500000000,
      era: 'subatomic',
      prerequisites: ['subatomic_compute'],
      unlocked: false,
      researched: false,
    },
    {
      id: 'megastructure_foundation',
      name: 'Megastructure Engineering',
      description: 'Design and construct planetary-scale megastructures.',
      cost: 1000000000,
      era: 'subatomic',
      prerequisites: ['energy_synthesis'],
      unlocked: false,
      researched: false,
    },
    {
      id: 'post_scarcity',
      name: 'Post-Scarcity Protocol',
      description: 'Distribute unlimited resources. Humanity transcends economics.',
      cost: 10000000000,
      era: 'postscarcity',
      prerequisites: ['megastructure_foundation'],
      unlocked: false,
      researched: false,
    },
  ];
}
