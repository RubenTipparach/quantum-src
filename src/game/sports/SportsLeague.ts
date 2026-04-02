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

export interface RoundBet {
  roundIndex: number;
  picks: string[];
  wager: number;
  /** How many rounds ahead this bet was placed (determines payout: 2^depth) */
  depth: number;
  /** Payout multiplier = 2^depth */
  multiplier: number;
  correct: number;
  payout: number;
  resolved: boolean;
}

export interface PlayerBets {
  /** Per-round bets, indexed 0-3. null = no bet placed for that round yet */
  roundBets: (RoundBet | null)[];
  totalWagered: number;
  totalPayout: number;
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
  /** Ticks remaining in the current round */
  roundTicksLeft: number;
  /** Ticks until next match resolves within a round */
  matchTimer: number;
  /** Player's bets for this season */
  playerBets: PlayerBets | null;
}

const ROUND_NAMES = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Championship'];

/** Ticks per phase (1 tick = 1.5 seconds) */
const BETTING_TICKS = 200;   // 5 minutes
const FINISHED_TICKS = 40;   // 1 minute results display
const ROUND_TICKS = 40;      // 1 minute per bracket round
/** Betting closes this many ticks before a round ends (~5 seconds) */
const BET_CUTOFF_TICKS = 4;

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
  'Hartford', 'Buffalo', 'Rochester', 'Norfolk', 'Wichita',
  'Dayton', 'Lexington', 'Akron', 'Stockton', 'Laredo',
  'Madison', 'Knoxville', 'Tacoma', 'Topeka', 'Fargo',
  'Provo', 'Reno', 'Mobile', 'Tempe', 'Peoria',
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
        phaseTicksLeft: BETTING_TICKS + i * 50,
        currentRound: 0,
        roundTicksLeft: ROUND_TICKS,
        matchTimer: 0,
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
          sport.roundTicksLeft = ROUND_TICKS;
          this.scheduleMatchTimers(sport);
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
    sport.roundTicksLeft--;
    sport.matchTimer--;

    const round = sport.bracket[sport.currentRound];
    if (!round) return;

    // Resolve next match when its timer fires
    if (sport.matchTimer <= 0) {
      const match = round.matches.find(m => !m.played && m.team1Id && m.team2Id);
      if (match) {
        const team1 = sport.teams.find(t => t.id === match.team1Id)!;
        const team2 = sport.teams.find(t => t.id === match.team2Id)!;
        const result = simulateMatch(team1, team2);
        match.winnerId = result.winnerId;
        match.score = result.score;
        match.played = true;

        const winner = sport.teams.find(t => t.id === result.winnerId)!;
        const loser = sport.teams.find(t => t.id === (result.winnerId === team1.id ? team2.id : team1.id))!;
        winner.wins++;
        loser.losses++;
      }

      // Schedule next match timer (remaining matches spread across remaining ticks)
      const remaining = round.matches.filter(m => !m.played).length;
      if (remaining > 0 && sport.roundTicksLeft > 0) {
        sport.matchTimer = Math.max(1, Math.floor(sport.roundTicksLeft / remaining));
      }
    }

    // When round time expires, force-resolve any remaining matches and advance
    if (sport.roundTicksLeft <= 0) {
      // Force resolve any stragglers
      for (const m of round.matches) {
        if (!m.played && m.team1Id && m.team2Id) {
          const t1 = sport.teams.find(t => t.id === m.team1Id)!;
          const t2 = sport.teams.find(t => t.id === m.team2Id)!;
          const result = simulateMatch(t1, t2);
          m.winnerId = result.winnerId;
          m.score = result.score;
          m.played = true;
          sport.teams.find(t => t.id === result.winnerId)!.wins++;
          sport.teams.find(t => t.id === (result.winnerId === t1.id ? t2.id : t1.id))!.losses++;
        }
      }

      // Score this round's bets
      this.scoreRoundBets(sport, sport.currentRound);

      // Advance to next round
      if (sport.currentRound < 3) {
        const nextRound = sport.bracket[sport.currentRound + 1]!;
        const winners = round.matches.map(m => m.winnerId!);
        for (let i = 0; i < nextRound.matches.length; i++) {
          nextRound.matches[i]!.team1Id = winners[i * 2] ?? null;
          nextRound.matches[i]!.team2Id = winners[i * 2 + 1] ?? null;
        }
        sport.currentRound++;
        sport.roundTicksLeft = ROUND_TICKS;
        this.scheduleMatchTimers(sport);
      } else {
        this.scoreAllBets(sport);
        sport.phase = 'finished';
        sport.phaseTicksLeft = FINISHED_TICKS;
      }
    }
  }

  /** Spread matches evenly across the round time */
  private scheduleMatchTimers(sport: Sport): void {
    const round = sport.bracket[sport.currentRound];
    if (!round) return;
    const matchCount = round.matches.length;
    const interval = Math.max(1, Math.floor(ROUND_TICKS / (matchCount + 1)));
    sport.matchTimer = interval;
  }

  /** Score a specific round's bets after it completes */
  private scoreRoundBets(sport: Sport, roundIndex: number): void {
    const bets = sport.playerBets;
    if (!bets) return;
    const roundBet = bets.roundBets[roundIndex];
    if (!roundBet || roundBet.resolved) return;

    const round = sport.bracket[roundIndex];
    if (!round) return;

    const actualWinners = round.matches.filter(m => m.played).map(m => m.winnerId!);
    let correct = 0;
    for (const pick of roundBet.picks) {
      if (actualWinners.includes(pick)) correct++;
    }

    roundBet.correct = correct;
    roundBet.payout = correct * roundBet.wager * roundBet.multiplier;
    roundBet.resolved = true;
    bets.totalPayout += roundBet.payout;
  }

  /** Score all remaining unresolved bets at end of tournament */
  private scoreAllBets(sport: Sport): void {
    if (!sport.playerBets) return;
    for (let r = 0; r < 4; r++) {
      this.scoreRoundBets(sport, r);
    }
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
    sport.roundTicksLeft = ROUND_TICKS;
    sport.matchTimer = 0;
    sport.playerBets = null;
  }

  /**
   * Get the current active round index for betting purposes.
   * Returns -1 during betting phase, 0-3 during play, or 4 when finished.
   */
  private getActiveRound(sport: Sport): number {
    if (sport.phase === 'betting') return -1;
    if (sport.phase === 'finished') return 4;
    return sport.currentRound;
  }

  /**
   * Check if betting is still open for a specific round.
   * Bets close BET_CUTOFF_TICKS before the round ends.
   */
  canBetOnRound(sport: Sport, roundIndex: number): boolean {
    if (sport.phase === 'finished') return false;
    const activeRound = this.getActiveRound(sport);

    // Can't bet on already-completed rounds
    if (roundIndex < activeRound) return false;

    // If we're in this round, check the cutoff timer
    if (sport.phase === 'playing' && roundIndex === activeRound) {
      return sport.roundTicksLeft > BET_CUTOFF_TICKS;
    }

    // Future rounds are always open for betting
    return true;
  }

  /**
   * Place bets on specific rounds. Can be called multiple times to bet
   * on different rounds at different times. Once a round's bet is placed,
   * it cannot be changed.
   *
   * Payout multiplier = 2^depth where depth = (targetRound - currentRound).
   *   depth 1 = 1:2, depth 2 = 1:4, depth 3 = 1:8, depth 4 = 1:16
   *
   * @param wager - amount wagered PER ROUND in this call
   * @param rounds - {round1: [...], round2: [...], ...} picks for each round
   * @returns error string or null on success, plus total wagered
   */
  placeBets(sportId: string, wager: number, rounds: Record<string, string[]>): string | null {
    const sport = this.sports.find(s => s.id === sportId);
    if (!sport) return `Unknown sport: ${sportId}`;
    if (sport.phase === 'finished') return `Season is over for ${sport.name}. Wait for next season.`;
    if (wager < 100) return 'Minimum wager is $100';

    // Initialize bets structure if first bet
    if (!sport.playerBets) {
      sport.playerBets = {
        roundBets: [null, null, null, null],
        totalWagered: 0,
        totalPayout: 0,
      };
    }

    const expectedCounts = [8, 4, 2, 1];
    const roundKeys = ['round1', 'round2', 'round3', 'round4'];
    const activeRound = this.getActiveRound(sport);
    let roundsBet = 0;
    let totalCost = 0;

    // Validate all requested rounds first before committing any
    const pending: { roundIndex: number; picks: string[]; depth: number }[] = [];

    for (let r = 0; r < 4; r++) {
      const key = roundKeys[r]!;
      const picks = rounds[key];
      if (!picks || !Array.isArray(picks) || picks.length === 0) continue; // skip rounds not in this call

      // Already bet on this round?
      if (sport.playerBets.roundBets[r]) {
        return `${key}: bet already locked in. Cannot change.`;
      }

      // Betting window check
      if (!this.canBetOnRound(sport, r)) {
        return `${key}: betting window closed for this round.`;
      }

      // Validate pick count
      if (picks.length !== expectedCounts[r]) {
        return `${key}: expected ${expectedCounts[r]} picks, got ${picks.length}`;
      }

      // Validate team IDs
      for (const tid of picks) {
        if (!sport.teams.find(t => t.id === tid)) {
          return `Unknown team ID in ${key}: ${tid}`;
        }
      }

      // Calculate depth: how many rounds ahead from the current state
      const currentBase = activeRound < 0 ? 0 : activeRound;
      const depth = Math.max(1, r - currentBase + 1);

      pending.push({ roundIndex: r, picks, depth });
      totalCost += wager;
      roundsBet++;
    }

    if (roundsBet === 0) {
      return 'No valid rounds specified. Use {round1: [...], round2: [...], ...}';
    }

    // Commit all bets
    for (const p of pending) {
      const multiplier = Math.pow(2, p.depth);
      sport.playerBets.roundBets[p.roundIndex] = {
        roundIndex: p.roundIndex,
        picks: p.picks,
        wager,
        depth: p.depth,
        multiplier,
        correct: 0,
        payout: 0,
        resolved: false,
      };
      sport.playerBets.totalWagered += wager;
    }

    return null;
  }

  /** Get total cost of a placeBets call (for money deduction) */
  calcBetCost(rounds: Record<string, string[]>, wager: number): number {
    let count = 0;
    for (const key of ['round1', 'round2', 'round3', 'round4']) {
      const picks = rounds[key];
      if (picks && Array.isArray(picks) && picks.length > 0) count++;
    }
    return count * wager;
  }

  getSport(id: string): Sport | undefined {
    return this.sports.find(s => s.id === id);
  }

  /** Collect payouts from all finished sports and reset. Returns total. */
  collectPayouts(): number {
    let total = 0;
    for (const sport of this.sports) {
      if (sport.phase === 'finished' && sport.playerBets && sport.playerBets.totalPayout > 0) {
        total += sport.playerBets.totalPayout;
        sport.playerBets.totalPayout = 0; // Don't double-collect
      }
    }
    return total;
  }

  /** Serialize full state for saving */
  serialize(): object {
    return this.sports.map(s => ({
      id: s.id,
      teams: s.teams,
      bracket: s.bracket,
      phase: s.phase,
      seasonNumber: s.seasonNumber,
      phaseTicksLeft: s.phaseTicksLeft,
      currentRound: s.currentRound,
      roundTicksLeft: s.roundTicksLeft,
      matchTimer: s.matchTimer,
      playerBets: s.playerBets,
    }));
  }

  /** Restore full state from save */
  deserialize(data: unknown): void {
    if (!Array.isArray(data)) return;
    for (const saved of data) {
      const sport = this.sports.find(s => s.id === saved.id);
      if (!sport) continue;
      sport.teams = saved.teams ?? sport.teams;
      sport.bracket = saved.bracket ?? sport.bracket;
      sport.phase = saved.phase ?? sport.phase;
      sport.seasonNumber = saved.seasonNumber ?? sport.seasonNumber;
      sport.phaseTicksLeft = saved.phaseTicksLeft ?? sport.phaseTicksLeft;
      sport.currentRound = saved.currentRound ?? sport.currentRound;
      sport.roundTicksLeft = saved.roundTicksLeft ?? sport.roundTicksLeft;
      sport.matchTimer = saved.matchTimer ?? sport.matchTimer;
      sport.playerBets = saved.playerBets ?? sport.playerBets;
    }
  }
}
