export type HardwareType = 'cpu' | 'gpu' | 'quantum' | 'subatomic';

export interface ComputeHardware {
  type: HardwareType;
  cores: number;
  clockSpeed: number;
  generation: number;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  era: string;
  requirements: MissionRequirement[];
  rewards: MissionReward;
  completed: boolean;
}

export interface MissionRequirement {
  type: 'money' | 'energy' | 'research' | 'hardware' | 'program';
  value: number | string;
}

export interface MissionReward {
  money?: number;
  energy?: number;
  research?: string[];
  yearAdvance?: number;
}
