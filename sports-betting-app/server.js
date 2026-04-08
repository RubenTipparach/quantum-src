import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// In production (docker build), serve the Vite build output
app.use(express.static(path.join(__dirname, 'dist')));

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────

const CITIES = [
  'Portland','Memphis','Phoenix','Denver','Austin','Seattle','Miami','Chicago',
  'Detroit','Boston','Dallas','Atlanta','Nashville','Oakland','Cleveland','Tampa',
  'Orlando','Charlotte','Milwaukee','Richmond','Sacramento','San Diego','Pittsburgh',
  'Minneapolis','Brooklyn','Houston','Las Vegas','Philadelphia','Baltimore','Salt Lake',
  'Kansas City','Jacksonville','Raleigh','Columbus','Indianapolis','Louisville',
  'New Orleans','San Antonio','Tucson','Omaha','El Paso','Boise','Fresno','Tulsa',
  'Anchorage','Honolulu','Birmingham','Spokane','Savannah','Hartford','Buffalo',
  'Rochester','Norfolk','Wichita','Dayton','Lexington','Akron','Stockton','Laredo',
  'Madison','Knoxville','Tacoma','Topeka','Fargo','Provo','Reno','Mobile','Tempe','Peoria',
];

const MASCOTS = [
  'Thunder','Vipers','Wolves','Eagles','Titans','Storm','Blaze','Phantoms',
  'Knights','Raptors','Scorpions','Sharks','Hawks','Stallions','Dragons','Cobras',
  'Grizzlies','Falcons','Panthers','Bulldogs','Coyotes','Ravens','Hornets','Mustangs',
  'Jaguars','Wolverines','Mavericks','Cyclones','Monarchs','Sentinels','Reapers',
  'Warhawks','Bison','Sabercats','Timberwolves','Outlaws','Enforcers','Comets',
  'Corsairs','Gladiators',
];

const ROUND_NAMES = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Championship'];
const SEED_ORDER = [
  [1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15],
];

const SPORT_DEFS = [
  { id: 'football',   name: 'Football',   icon: '\u{1F3C8}' },
  { id: 'basketball', name: 'Basketball', icon: '\u{1F3C0}' },
  { id: 'baseball',   name: 'Baseball',   icon: '\u26BE' },
  { id: 'soccer',     name: 'Soccer',     icon: '\u26BD' },
];

// Simulation timing (ms)
const COUNTDOWN_SECONDS = 5;
const MATCH_DELAY_MS = 800;   // delay between each match resolving
const ROUND_DELAY_MS = 2000;  // delay between rounds

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateTeams(sportId, count, usedCities) {
  const available = CITIES.filter(c => !usedCities.has(c));
  const cities = shuffle(available).slice(0, count);
  const mascots = shuffle(MASCOTS).slice(0, count);
  cities.forEach(c => usedCities.add(c));

  const teams = [];
  for (let i = 0; i < count; i++) {
    teams.push({
      id: `${sportId}_${String(i + 1).padStart(2, '0')}`,
      name: `${cities[i]} ${mascots[i]}`,
      rating: Math.floor(55 + Math.random() * 40),
      seed: 0,
      wins: 0,
      losses: 0,
    });
  }
  teams.sort((a, b) => b.rating - a.rating);
  teams.forEach((t, i) => t.seed = i + 1);
  return teams;
}

function createBracket(teams) {
  const teamBySeed = new Map();
  for (const t of teams) teamBySeed.set(t.seed, t);

  const round1 = SEED_ORDER.map(([s1, s2]) => ({
    team1Id: teamBySeed.get(s1).id,
    team2Id: teamBySeed.get(s2).id,
    winnerId: null,
    played: false,
    score: null,
  }));

  return [
    { name: ROUND_NAMES[0], matches: round1 },
    { name: ROUND_NAMES[1], matches: Array.from({ length: 4 }, () => emptyMatch()) },
    { name: ROUND_NAMES[2], matches: Array.from({ length: 2 }, () => emptyMatch()) },
    { name: ROUND_NAMES[3], matches: [emptyMatch()] },
  ];
}

function emptyMatch() {
  return { team1Id: null, team2Id: null, winnerId: null, played: false, score: null };
}

function simulateMatch(team1, team2) {
  const noise1 = (Math.random() - 0.5) * 20;
  const noise2 = (Math.random() - 0.5) * 20;
  const eff1 = team1.rating + noise1;
  const eff2 = team2.rating + noise2;
  const winnerId = eff1 >= eff2 ? team1.id : team2.id;

  const baseScore = 2 + Math.floor(Math.random() * 4);
  const winMargin = Math.max(1, Math.floor(Math.random() * 3));
  const loserScore = baseScore;
  const winnerScore = baseScore + winMargin;

  const score = winnerId === team1.id
    ? [winnerScore, loserScore]
    : [loserScore, winnerScore];

  return { winnerId, score };
}

// ─────────────────────────────────────────────────────────────
//  GAME STATE (in-memory)
// ─────────────────────────────────────────────────────────────

let lobby = {
  players: {},       // socketId -> { name, ready, bets: { sportId: { round0: [...], ... } } }
  sports: [],        // array of sport objects with teams + bracket
  phase: 'waiting',  // waiting | betting | countdown | simulating | results
  countdownTimer: null,
  countdownValue: 0,
  seasonNumber: 1,
};

function resetGame() {
  const usedCities = new Set();
  lobby.sports = SPORT_DEFS.map(def => {
    const teams = generateTeams(def.id, 16, usedCities);
    const bracket = createBracket(teams);
    return { ...def, teams, bracket };
  });
  lobby.phase = 'betting';
  // Reset player states
  for (const pid of Object.keys(lobby.players)) {
    lobby.players[pid].ready = false;
    lobby.players[pid].bets = {};
  }
}

function getTeamById(sport, teamId) {
  return sport.teams.find(t => t.id === teamId);
}

// Calculate payouts for a player
function calculatePayouts(playerBets, sports) {
  const results = {};
  let totalWon = 0;

  for (const sport of sports) {
    const bets = playerBets[sport.id];
    if (!bets) continue;

    const sportResult = { rounds: [], totalWon: 0 };

    for (let r = 0; r < 4; r++) {
      const picks = bets[`round${r}`];
      if (!picks || picks.length === 0) {
        sportResult.rounds.push(null);
        continue;
      }

      const round = sport.bracket[r];
      const actualWinners = round.matches.filter(m => m.played).map(m => m.winnerId);
      let correct = 0;
      for (const pick of picks) {
        if (actualWinners.includes(pick)) correct++;
      }

      const wager = bets.wager || 100;
      const depth = r + 1;
      const multiplier = Math.pow(2, depth);
      const payout = correct * wager * multiplier;

      sportResult.rounds.push({
        roundIndex: r,
        roundName: ROUND_NAMES[r],
        picks,
        actualWinners,
        correct,
        total: picks.length,
        wager,
        depth,
        multiplier,
        payout,
      });
      sportResult.totalWon += payout;
    }

    results[sport.id] = sportResult;
    totalWon += sportResult.totalWon;
  }

  return { results, totalWon };
}

function getLobbyState() {
  const players = {};
  for (const [id, p] of Object.entries(lobby.players)) {
    players[id] = { name: p.name, ready: p.ready };
  }
  return {
    players,
    sports: lobby.sports,
    phase: lobby.phase,
    countdownValue: lobby.countdownValue,
    seasonNumber: lobby.seasonNumber,
  };
}

// ─────────────────────────────────────────────────────────────
//  SIMULATION ENGINE
// ─────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSimulation() {
  lobby.phase = 'simulating';
  io.emit('phase', { phase: 'simulating' });

  for (const sport of lobby.sports) {
    // Reset wins/losses
    for (const t of sport.teams) { t.wins = 0; t.losses = 0; }

    for (let roundIdx = 0; roundIdx < 4; roundIdx++) {
      const round = sport.bracket[roundIdx];

      io.emit('roundStart', { sportId: sport.id, roundIndex: roundIdx, roundName: round.name });
      await sleep(ROUND_DELAY_MS);

      for (let matchIdx = 0; matchIdx < round.matches.length; matchIdx++) {
        const match = round.matches[matchIdx];
        if (!match.team1Id || !match.team2Id) continue;

        const team1 = getTeamById(sport, match.team1Id);
        const team2 = getTeamById(sport, match.team2Id);
        const result = simulateMatch(team1, team2);

        match.winnerId = result.winnerId;
        match.score = result.score;
        match.played = true;

        const winner = getTeamById(sport, result.winnerId);
        const loserId = result.winnerId === team1.id ? team2.id : team1.id;
        const loser = getTeamById(sport, loserId);
        winner.wins++;
        loser.losses++;

        io.emit('matchResult', {
          sportId: sport.id,
          roundIndex: roundIdx,
          matchIndex: matchIdx,
          match: { ...match },
          winnerName: winner.name,
          loserName: loser.name,
        });

        await sleep(MATCH_DELAY_MS);
      }

      // Populate next round
      if (roundIdx < 3) {
        const nextRound = sport.bracket[roundIdx + 1];
        const winners = round.matches.map(m => m.winnerId);
        for (let i = 0; i < nextRound.matches.length; i++) {
          nextRound.matches[i].team1Id = winners[i * 2] || null;
          nextRound.matches[i].team2Id = winners[i * 2 + 1] || null;
        }
        io.emit('bracketUpdate', { sportId: sport.id, bracket: sport.bracket });
      }
    }

    io.emit('sportComplete', { sportId: sport.id });
  }

  // Calculate all payouts
  const leaderboard = [];
  for (const [pid, player] of Object.entries(lobby.players)) {
    const payoutInfo = calculatePayouts(player.bets, lobby.sports);
    leaderboard.push({
      socketId: pid,
      name: player.name,
      totalWon: payoutInfo.totalWon,
      details: payoutInfo.results,
    });
  }
  leaderboard.sort((a, b) => b.totalWon - a.totalWon);

  lobby.phase = 'results';
  io.emit('phase', { phase: 'results' });
  io.emit('results', { leaderboard, sports: lobby.sports });
}

// ─────────────────────────────────────────────────────────────
//  SOCKET HANDLERS
// ─────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('join', (name) => {
    name = String(name || 'Anonymous').trim().slice(0, 20) || 'Anonymous';
    lobby.players[socket.id] = { name, ready: false, bets: {} };

    // If no game active, start one
    if (lobby.phase === 'waiting' || lobby.phase === 'results') {
      resetGame();
    }

    socket.emit('joined', { id: socket.id, name });
    io.emit('lobbyUpdate', getLobbyState());
    console.log(`${name} joined the lobby`);
  });

  socket.on('placeBets', (data) => {
    if (lobby.phase !== 'betting') {
      socket.emit('error', { message: 'Betting is closed.' });
      return;
    }

    const player = lobby.players[socket.id];
    if (!player) return;

    // data: { sportId, wager, round0: [...], round1: [...], ... }
    const { sportId, wager } = data;
    const sport = lobby.sports.find(s => s.id === sportId);
    if (!sport) {
      socket.emit('error', { message: `Unknown sport: ${sportId}` });
      return;
    }

    const expectedCounts = [8, 4, 2, 1];
    const bets = { wager: Math.max(100, Number(wager) || 100) };

    for (let r = 0; r < 4; r++) {
      const picks = data[`round${r}`];
      if (!picks || !Array.isArray(picks)) continue;
      if (picks.length !== expectedCounts[r]) {
        socket.emit('error', { message: `Round ${r + 1}: expected ${expectedCounts[r]} picks, got ${picks.length}` });
        return;
      }
      // Validate team IDs
      for (const tid of picks) {
        if (!sport.teams.find(t => t.id === tid)) {
          socket.emit('error', { message: `Unknown team: ${tid}` });
          return;
        }
      }
      bets[`round${r}`] = picks;
    }

    player.bets[sportId] = bets;
    socket.emit('betsAccepted', { sportId });
  });

  socket.on('ready', () => {
    const player = lobby.players[socket.id];
    if (!player || lobby.phase !== 'betting') return;

    player.ready = true;
    io.emit('lobbyUpdate', getLobbyState());

    // Check if all players are ready
    const players = Object.values(lobby.players);
    if (players.length > 0 && players.every(p => p.ready)) {
      startCountdown();
    }
  });

  socket.on('unready', () => {
    const player = lobby.players[socket.id];
    if (!player || lobby.phase !== 'betting') return;
    player.ready = false;
    io.emit('lobbyUpdate', getLobbyState());
  });

  socket.on('newSeason', () => {
    if (lobby.phase !== 'results') return;
    lobby.seasonNumber++;
    resetGame();
    io.emit('lobbyUpdate', getLobbyState());
  });

  socket.on('disconnect', () => {
    const player = lobby.players[socket.id];
    if (player) {
      console.log(`${player.name} disconnected`);
      delete lobby.players[socket.id];
      io.emit('lobbyUpdate', getLobbyState());
    }
  });
});

function startCountdown() {
  lobby.phase = 'countdown';
  lobby.countdownValue = COUNTDOWN_SECONDS;
  io.emit('phase', { phase: 'countdown' });
  io.emit('countdown', { value: lobby.countdownValue });

  const interval = setInterval(() => {
    lobby.countdownValue--;
    if (lobby.countdownValue <= 0) {
      clearInterval(interval);
      runSimulation();
    } else {
      io.emit('countdown', { value: lobby.countdownValue });
    }
  }, 1000);
}

// ─────────────────────────────────────────────────────────────
//  START
// ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sports Betting Party running on http://localhost:${PORT}`);
});
