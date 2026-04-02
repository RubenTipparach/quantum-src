/**
 * Sports League & Bracket Betting System
 *
 * Each sport has 16 teams competing in a single-elimination tournament bracket.
 * Seasons cycle: BETTING → PLAYING (4 rounds) → FINISHED → new season.
 * Players predict bracket outcomes upfront and earn payouts for correct picks,
 * with multipliers increasing for later rounds.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FUTURE: Individual Team Members & Sabermetrics
 * ─────────────────────────────────────────────────────────────────────────────
 * Each team will eventually have a roster of ~12 players with individual stats:
 *
 *   interface Player {
 *     id: string;
 *     name: string;
 *     position: string;
 *     stats: {
 *       offense: number;       // 1-99
 *       defense: number;       // 1-99
 *       stamina: number;       // 1-99
 *       clutch: number;        // performance under pressure
 *       consistency: number;   // variance in performance
 *       injuryRisk: number;    // probability of missing games
 *     };
 *     seasonStats: {
 *       gamesPlayed: number;
 *       points: number;        // sport-specific (goals, touchdowns, etc.)
 *       assists: number;
 *       errors: number;
 *       winShares: number;     // sabermetric: contribution to team wins
 *       war: number;           // Wins Above Replacement
 *       elo: number;           // individual Elo rating
 *     };
 *     injured: boolean;
 *     injuryDuration: number;
 *   }
 *
 * Match simulation will factor in:
 *   - Individual player matchups (offense vs defense)
 *   - Fatigue accumulation across tournament rounds
 *   - Injury events mid-tournament changing team strength
 *   - Home/away advantage modifiers
 *   - Hot/cold streaks (momentum from prior wins)
 *   - Sport-specific metrics:
 *       Football: passing yards, rushing yards, turnovers, time of possession
 *       Basketball: FG%, 3PT%, rebounds, assists, turnovers, pace
 *       Baseball: ERA, WHIP, OPS, BABIP, FIP, WAR
 *       Soccer: xG (expected goals), possession%, pass completion, tackles
 *
 * Advanced betting will include:
 *   - Over/under on match scores
 *   - Individual player performance props
 *   - MVP predictions
 *   - Series spread betting
 *
 * API additions:
 *   game.getTeamRoster(sportId, teamId) → player list with stats
 *   game.getPlayerStats(sportId, playerId) → detailed sabermetrics
 *   game.getMatchPrediction(sportId, team1Id, team2Id) → simulated odds
 *   game.getInjuryReport(sportId) → current injuries
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ────────────────────────────────────────────────────────────
//  DATA TYPES
// ────────────────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  /** Overall strength rating 40-99 */
  rating: number;
  /** Tournament seed 1-16 (1 = strongest) */
  seed: number;
  /** Wins this season */
  wins: number;
  /** Losses this season */
  losses: number;
}

export interface Match {
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
  played: boolean;
  /** Score [team1Score, team2Score] or null if not played */
  score: [number, number] | null;
}

export interface BracketRound {
  name: string;
  matches: Match[];
}

export type SeasonPhase = 'betting' | 'playing' | 'finished';

export interface PlayerBets {
  /** Wager amount in dollars */
  wager: number;
  /**
   * Predictions per round. Each array contains team IDs predicted to win.
   * round1: 8 winners, round2: 4 winners, round3: 2 winners, round4: 1 winner
   */
  rounds: string[][];
  /** Payout earned (calculated after tournament) */
  payout: number;
  /** Per-round correct counts */
  correctPerRound: number[];
}

export interface Sport {
  id: string;
  name: string;
  icon: string;
  teams: Team[];
  bracket: BracketRound[];
  phase: SeasonPhase;
  seasonNumber: number;
  /** Ticks remaining in current phase */
  phaseTicksLeft: number;
  /** Current round being played (0-3) during 'playing' phase */
  currentRound: number;
  /** Ticks until next match resolves */
  matchTimer: number;
  /** Player's bets for this season */
  playerBets: PlayerBets | null;
}

/** Payout multiplier per correct pick, indexed by round */
const PAYOUT_MULTIPLIERS = [0.5, 1.5, 3, 8];

const ROUND_NAMES = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Championship'];

/** Ticks per phase */
const BETTING_TICKS = 40;
const FINISHED_TICKS = 20;
const TICKS_PER_MATCH = 3;

// ────────────────────────────────────────────────────────────
//  TEAM NAME GENERATION
// ────────────────────────────────────────────────────────────

const CITIES = [
  'Portland', 'Memphis', 'Phoenix', 'Denver', 'Austin', 'Seattle',
  'Miami', 'Chicago', 'Detroit', 'Boston', 'Dallas', 'Atlanta',
  'Nashville', 'Oakland', 'Cleveland', 'Tampa', 'Orlando', 'Charlotte',
  'Milwaukee', 'Richmond', 'Sacramento', 'San Diego', 'Pittsburgh',
  'Minneapolis', 'Brooklyn', 'Houston', 'Las Vegas', 'Philadelphia',
  'Baltimore', 'Salt Lake', 'Kansas City', 'Jacksonville', 'Raleigh',
  'Columbus', 'Indianapolis', 'Louisville', 'New Orleans', 'San Antonio',
  'Tucson', 'Omaha', 'El Paso', 'Boise', 'Fresno', 'Tulsa',
  'Anchorage', 'Honolulu', 'Birmingham', 'Spokane', 'Savannah',
];

const MASCOTS = [
  'Thunder', 'Vipers', 'Wolves', 'Eagles', 'Titans', 'Storm',
  'Blaze', 'Phantoms', 'Knights', 'Raptors', 'Scorpions', 'Sharks',
  'Hawks', 'Stallions', 'Dragons', 'Cobras', 'Grizzlies', 'Falcons',
  'Panthers', 'Bulldogs', 'Coyotes', 'Ravens', 'Hornets', 'Mustangs',
  'Jaguars', 'Wolverines', 'Mavericks', 'Cyclones', 'Monarchs',
  'Sentinels', 'Reapers', 'Warhawks', 'Bison', 'Sabercats', 'Timberwolves',
  'Outlaws', 'Enforcers', 'Comets', 'Corsairs', 'Gladiators',
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function generateTeams(sportId: string, count: number, usedCities: Set<string>): Team[] {
  const available = CITIES.filter(c => !usedCities.has(c));
  const cities = shuffleArray(available).slice(0, count);
  const mascots = shuffleArray(MASCOTS).slice(0, count);

  cities.forEach(c => usedCities.add(c));

  const teams: Team[] = [];
  for (let i = 0; i < count; i++) {
    teams.push({
      id: `${sportId}_${String(i + 1).padStart(2, '0')}`,
      name: `${cities[i]} ${mascots[i]}`,
      rating: Math.floor(55 + Math.random() * 40), // 55-94
      seed: 0,
      wins: 0,
      losses: 0,
    });
  }

  // Sort by rating descending, assign seeds
  teams.sort((a, b) => b.rating - a.rating);
  teams.forEach((t, i) => t.seed = i + 1);

  return teams;
}

// ────────────────────────────────────────────────────────────
//  BRACKET GENERATION & SIMULATION
// ────────────────────────────────────────────────────────────

function createBracket(teams: Team[]): BracketRound[] {
  // Standard seeding: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
  const seedOrder = [
    [1, 16], [8, 9], [5, 12], [4, 13],
    [6, 11], [3, 14], [7, 10], [2, 15],
  ];

  const teamBySeed = new Map<number, Team>();
  for (const t of teams) teamBySeed.set(t.seed, t);

  const round1Matches: Match[] = seedOrder.map(([s1, s2]) => ({
    team1Id: teamBySeed.get(s1!)!.id,
    team2Id: teamBySeed.get(s2!)!.id,
    winnerId: null,
    played: false,
    score: null,
  }));

  const rounds: BracketRound[] = [
    { name: ROUND_NAMES[0]!, matches: round1Matches },
    { name: ROUND_NAMES[1]!, matches: Array.from({ length: 4 }, () => emptyMatch()) },
    { name: ROUND_NAMES[2]!, matches: Array.from({ length: 2 }, () => emptyMatch()) },
    { name: ROUND_NAMES[3]!, matches: [emptyMatch()] },
  ];

  return rounds;
}

function emptyMatch(): Match {
  return { team1Id: null, team2Id: null, winnerId: null, played: false, score: null };
}

/** Simulate a match. Returns winner ID. */
function simulateMatch(team1: Team, team2: Team): { winnerId: string; score: [number, number] } {
  // Probability based on ratings with some noise
  const noise1 = (Math.random() - 0.5) * 20;
  const noise2 = (Math.random() - 0.5) * 20;
  const eff1 = team1.rating + noise1;
  const eff2 = team2.rating + noise2;

  const winnerId = eff1 >= eff2 ? team1.id : team2.id;

  // Generate plausible scores (higher for basketball, lower for soccer)
  const baseScore = 2 + Math.floor(Math.random() * 4);
  const winMargin = Math.max(1, Math.floor(Math.random() * 3));
  const loserScore = baseScore;
  const winnerScore = baseScore + winMargin;

  const score: [number, number] = winnerId === team1.id
    ? [winnerScore, loserScore]
    : [loserScore, winnerScore];

  return { winnerId, score };
}

// ────────────────────────────────────────────────────────────
//  SPORTS LEAGUE
// ────────────────────────────────────────────────────────────

export class SportsLeague {
  sports: Sport[] = [];

  constructor() {
    const usedCities = new Set<string>();

    const defs: { id: string; name: string; icon: string }[] = [
      { id: 'football', name: 'Football', icon: '\u{1F3C8}' },
      { id: 'basketball', name: 'Basketball', icon: '\u{1F3C0}' },
      { id: 'baseball', name: 'Baseball', icon: '\u26BE' },
      { id: 'soccer', name: 'Soccer', icon: '\u26BD' },
    ];

    for (let i = 0; i < defs.length; i++) {
      const d = defs[i]!;
      const teams = generateTeams(d.id, 16, usedCities);
      const bracket = createBracket(teams);
      this.sports.push({
        id: d.id,
        name: d.name,
        icon: d.icon,
        teams,
        bracket,
        phase: 'betting',
        seasonNumber: 1,
        // Stagger starts so not all sports begin simultaneously
        phaseTicksLeft: BETTING_TICKS + i * 12,
        currentRound: 0,
        matchTimer: TICKS_PER_MATCH,
        playerBets: null,
      });
    }
  }

  /** Called each game tick */
  tick(): void {
    for (const sport of this.sports) {
      this.tickSport(sport);
    }
  }

  private tickSport(sport: Sport): void {
    sport.phaseTicksLeft--;

    switch (sport.phase) {
      case 'betting':
        if (sport.phaseTicksLeft <= 0) {
          sport.phase = 'playing';
          sport.currentRound = 0;
          sport.matchTimer = TICKS_PER_MATCH;
        }
        break;

      case 'playing':
        this.tickPlaying(sport);
        break;

      case 'finished':
        if (sport.phaseTicksLeft <= 0) {
          this.startNewSeason(sport);
        }
        break;
    }
  }

  private tickPlaying(sport: Sport): void {
    sport.matchTimer--;
    if (sport.matchTimer > 0) return;

    const round = sport.bracket[sport.currentRound];
    if (!round) return;

    // Find next unplayed match in current round
    const match = round.matches.find(m => !m.played && m.team1Id && m.team2Id);

    if (match) {
      const team1 = sport.teams.find(t => t.id === match.team1Id)!;
      const team2 = sport.teams.find(t => t.id === match.team2Id)!;
      const result = simulateMatch(team1, team2);
      match.winnerId = result.winnerId;
      match.score = result.score;
      match.played = true;

      // Update win/loss records
      const winner = sport.teams.find(t => t.id === result.winnerId)!;
      const loser = sport.teams.find(t => t.id === (result.winnerId === team1.id ? team2.id : team1.id))!;
      winner.wins++;
      loser.losses++;

      sport.matchTimer = TICKS_PER_MATCH;
    }

    // Check if round is complete
    const roundComplete = round.matches.every(m => m.played);
    if (roundComplete) {
      // Advance winners to next round
      if (sport.currentRound < 3) {
        const nextRound = sport.bracket[sport.currentRound + 1]!;
        const winners = round.matches.map(m => m.winnerId!);
        for (let i = 0; i < nextRound.matches.length; i++) {
          nextRound.matches[i]!.team1Id = winners[i * 2] ?? null;
          nextRound.matches[i]!.team2Id = winners[i * 2 + 1] ?? null;
        }
        sport.currentRound++;
        sport.matchTimer = TICKS_PER_MATCH;
      } else {
        // Tournament over
        sport.phase = 'finished';
        sport.phaseTicksLeft = FINISHED_TICKS;
        this.scoreBets(sport);
      }
    }
  }

  private scoreBets(sport: Sport): void {
    const bets = sport.playerBets;
    if (!bets) return;

    let totalPayout = 0;
    bets.correctPerRound = [];

    for (let r = 0; r < 4; r++) {
      const predicted = bets.rounds[r] ?? [];
      const round = sport.bracket[r];
      if (!round) { bets.correctPerRound.push(0); continue; }

      let correct = 0;
      const actualWinners = round.matches.filter(m => m.played).map(m => m.winnerId!);

      for (const pred of predicted) {
        if (actualWinners.includes(pred)) correct++;
      }

      bets.correctPerRound.push(correct);
      totalPayout += correct * bets.wager * PAYOUT_MULTIPLIERS[r]!;
    }

    bets.payout = totalPayout;
  }

  private startNewSeason(sport: Sport): void {
    sport.seasonNumber++;

    // Slightly shuffle ratings between seasons (regression to mean + noise)
    for (const team of sport.teams) {
      const drift = (Math.random() - 0.5) * 12;
      team.rating = Math.max(40, Math.min(99, Math.round(team.rating + drift)));
      team.wins = 0;
      team.losses = 0;
    }

    // Re-seed by new ratings
    sport.teams.sort((a, b) => b.rating - a.rating);
    sport.teams.forEach((t, i) => t.seed = i + 1);

    sport.bracket = createBracket(sport.teams);
    sport.phase = 'betting';
    sport.phaseTicksLeft = BETTING_TICKS;
    sport.currentRound = 0;
    sport.matchTimer = TICKS_PER_MATCH;
    sport.playerBets = null;
  }

  /** Place bets for a sport. Returns error string or null on success. */
  placeBets(sportId: string, wager: number, rounds: Record<string, string[]>): string | null {
    const sport = this.sports.find(s => s.id === sportId);
    if (!sport) return `Unknown sport: ${sportId}`;
    if (sport.phase !== 'betting') return `Betting is closed for ${sport.name}. Phase: ${sport.phase}`;
    if (wager < 100) return 'Minimum wager is $100';
    if (sport.playerBets) return `Bets already placed for ${sport.name} this season. Wait for next season.`;

    const roundArrays: string[][] = [];
    const expectedCounts = [8, 4, 2, 1];
    const roundKeys = ['round1', 'round2', 'round3', 'round4'];

    for (let r = 0; r < 4; r++) {
      const key = roundKeys[r]!;
      const picks = rounds[key];
      if (!picks || !Array.isArray(picks)) {
        return `Missing ${key}: expected array of ${expectedCounts[r]} team IDs`;
      }
      if (picks.length !== expectedCounts[r]) {
        return `${key}: expected ${expectedCounts[r]} picks, got ${picks.length}`;
      }
      // Validate team IDs exist
      for (const tid of picks) {
        if (!sport.teams.find(t => t.id === tid)) {
          return `Unknown team ID in ${key}: ${tid}`;
        }
      }
      roundArrays.push(picks);
    }

    // Validate bracket consistency: each round's picks must be a subset of the previous round
    for (let r = 1; r < 4; r++) {
      for (const tid of roundArrays[r]!) {
        if (!roundArrays[r - 1]!.includes(tid)) {
          return `${roundKeys[r]}: team ${tid} wasn't picked to win in ${roundKeys[r - 1]}`;
        }
      }
    }

    sport.playerBets = {
      wager,
      rounds: roundArrays,
      payout: 0,
      correctPerRound: [],
    };

    return null;
  }

  getSport(id: string): Sport | undefined {
    return this.sports.find(s => s.id === id);
  }

  /** Collect payouts from all finished sports and reset. Returns total. */
  collectPayouts(): number {
    let total = 0;
    for (const sport of this.sports) {
      if (sport.phase === 'finished' && sport.playerBets && sport.playerBets.payout > 0) {
        total += sport.playerBets.payout;
        sport.playerBets.payout = 0; // Don't double-collect
      }
    }
    return total;
  }
}
