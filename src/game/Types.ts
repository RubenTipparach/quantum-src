export type HardwareType = 'cpu' | 'gpu' | 'quantum' | 'subatomic';

export interface ComputeHardware {
  type: HardwareType;
  cores: number;
  clockSpeed: number;
  generation: number;
  ram: number;       // MB of RAM
  maxRam: number;    // max RAM this hardware supports
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  era: string;
  category: 'cpu' | 'gpu' | 'quantum' | 'subatomic' | 'ram' | 'energy';
  minYear: number;
  /** Applied when purchased */
  apply: (state: GameStateRef) => void;
  /** Can only buy once? */
  unique: boolean;
  purchased: boolean;
}

/** Lightweight ref to avoid circular imports */
export interface GameStateRef {
  hardware: ComputeHardware;
  energy: number;
  totalEnergyCapacity: number;
}
