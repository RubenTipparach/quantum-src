import type { Era } from './Era';
import { ERAS } from './Era';

export class EraRegistry {
  getCurrentEra(year: number): Era {
    for (let i = ERAS.length - 1; i >= 0; i--) {
      if (year >= ERAS[i]!.startYear) {
        return ERAS[i]!;
      }
    }
    return ERAS[0]!;
  }

  getEraById(id: string): Era | undefined {
    return ERAS.find(e => e.id === id);
  }

  getAllEras(): Era[] {
    return [...ERAS];
  }
}
