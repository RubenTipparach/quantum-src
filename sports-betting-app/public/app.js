/* ─────────────────────────────────────────────────────────────
   Sports Bracket Betting - Client
   ───────────────────────────────────────────────────────────── */

const socket = io();

let myId = null;
let myName = '';
let state = {
  players: {},
  sports: [],
  phase: 'waiting',
  countdownValue: 0,
};
let activeSportId = null;
let myBets = {};  // { sportId: { wager, round0: [...], ... } }
let isReady = false;

// ── DOM refs ────────────────────────────────────────────────

const joinScreen = document.getElementById('join-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name');
const joinBtn = document.getElementById('join-btn');
const phaseBadge = document.getElementById('phase-badge');
const playerInfo = document.getElementById('player-info');
const playerList = document.getElementById('player-list');
const readyBtn = document.getElementById('ready-btn');
const unreadyBtn = document.getElementById('unready-btn');
const sportTabs = document.getElementById('sport-tabs');
const wagerInput = document.getElementById('wager-input');
const bracketContainer = document.getElementById('bracket-container');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const simLog = document.getElementById('sim-log');
const simLogEntries = document.getElementById('sim-log-entries');
const resultsOverlay = document.getElementById('results-overlay');
const leaderboard = document.getElementById('leaderboard');
const detailedResults = document.getElementById('detailed-results');
const newSeasonBtn = document.getElementById('new-season-btn');
const wagerSection = document.getElementById('wager-section');

// ── JOIN ─────────────────────────────────────────────────────

joinBtn.addEventListener('click', join);
playerNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });

function join() {
  const name = playerNameInput.value.trim();
  if (!name) { playerNameInput.focus(); return; }
  socket.emit('join', name);
}

socket.on('joined', (data) => {
  myId = data.id;
  myName = data.name;
  joinScreen.classList.remove('active');
  gameScreen.classList.add('active');
  playerInfo.textContent = myName;
});

// ── LOBBY UPDATES ────────────────────────────────────────────

socket.on('lobbyUpdate', (data) => {
  state = data;
  if (data.sports.length > 0 && !activeSportId) {
    activeSportId = data.sports[0].id;
  }
  renderPlayers();
  renderSportTabs();
  renderBracket();
  updatePhase(data.phase);
});

socket.on('phase', (data) => {
  state.phase = data.phase;
  updatePhase(data.phase);
});

socket.on('countdown', (data) => {
  state.countdownValue = data.value;
  countdownNumber.textContent = data.value;
});

socket.on('error', (data) => {
  showToast(data.message, true);
});

socket.on('betsAccepted', (data) => {
  showToast(`Bets locked for ${data.sportId}!`);
  renderSportTabs();
});

// ── SIMULATION EVENTS ────────────────────────────────────────

socket.on('roundStart', (data) => {
  addSimEntry(`<span class="sim-round">${getSportIcon(data.sportId)} ${data.roundName}</span> starting...`);
});

socket.on('matchResult', (data) => {
  // Update local bracket state
  const sport = state.sports.find(s => s.id === data.sportId);
  if (sport) {
    sport.bracket[data.roundIndex].matches[data.matchIndex] = data.match;
  }
  renderBracket();

  const score = data.match.score;
  addSimEntry(
    `${getSportIcon(data.sportId)} ` +
    `<span class="sim-winner">${data.winnerName}</span> ` +
    `<span class="sim-score">${score[0]} - ${score[1]}</span> ` +
    `<span class="sim-loser">${data.loserName}</span>`
  );
});

socket.on('bracketUpdate', (data) => {
  const sport = state.sports.find(s => s.id === data.sportId);
  if (sport) {
    sport.bracket = data.bracket;
    renderBracket();
  }
});

socket.on('sportComplete', (data) => {
  addSimEntry(`<span class="sim-round">${getSportIcon(data.sportId)} Tournament Complete!</span>`);
});

socket.on('results', (data) => {
  renderResults(data);
});

// ── READY / UNREADY ──────────────────────────────────────────

readyBtn.addEventListener('click', () => {
  // Auto-submit bets for current sport before readying
  submitAllBets();
  socket.emit('ready');
  isReady = true;
  readyBtn.style.display = 'none';
  unreadyBtn.style.display = '';
});

unreadyBtn.addEventListener('click', () => {
  socket.emit('unready');
  isReady = false;
  readyBtn.style.display = '';
  unreadyBtn.style.display = 'none';
});

newSeasonBtn.addEventListener('click', () => {
  socket.emit('newSeason');
  resultsOverlay.style.display = 'none';
  simLogEntries.innerHTML = '';
  simLog.style.display = 'none';
  myBets = {};
  isReady = false;
  readyBtn.style.display = '';
  unreadyBtn.style.display = 'none';
});

// ── PHASE UPDATES ────────────────────────────────────────────

function updatePhase(phase) {
  phaseBadge.className = 'phase-badge phase-' + phase;
  const labels = {
    waiting: 'WAITING',
    betting: 'BETTING OPEN',
    countdown: 'STARTING...',
    simulating: 'LIVE!',
    results: 'RESULTS',
  };
  phaseBadge.textContent = labels[phase] || phase.toUpperCase();

  countdownOverlay.style.display = phase === 'countdown' ? '' : 'none';
  simLog.style.display = (phase === 'simulating' || phase === 'results') ? '' : 'none';

  // Hide wager and ready controls when not betting
  const isBetting = phase === 'betting';
  wagerSection.style.display = isBetting ? '' : 'none';
  document.getElementById('ready-section').style.display = isBetting ? '' : 'none';

  // Hide auto-fill when not betting
  document.querySelectorAll('.auto-fill-section').forEach(el => {
    el.style.display = isBetting ? '' : 'none';
  });
}

// ── RENDER PLAYERS ───────────────────────────────────────────

function renderPlayers() {
  playerList.innerHTML = '';
  for (const [id, p] of Object.entries(state.players)) {
    const li = document.createElement('li');
    const isMe = id === myId;
    li.innerHTML = `
      <span>${isMe ? '<b>' + esc(p.name) + '</b>' : esc(p.name)}</span>
      <span class="ready-dot ${p.ready ? 'is-ready' : ''}"></span>
    `;
    playerList.appendChild(li);
  }
}

// ── RENDER SPORT TABS ────────────────────────────────────────

function renderSportTabs() {
  sportTabs.innerHTML = '';
  for (const sport of state.sports) {
    const tab = document.createElement('button');
    tab.className = 'sport-tab' + (sport.id === activeSportId ? ' active' : '');
    const hasBet = myBets[sport.id] != null;
    tab.innerHTML = `
      <span class="tab-icon">${sport.icon}</span>${sport.name}
      ${hasBet ? '<span class="bet-indicator">BET</span>' : ''}
    `;
    tab.addEventListener('click', () => {
      activeSportId = sport.id;
      renderSportTabs();
      renderBracket();
    });
    sportTabs.appendChild(tab);
  }
}

// ── RENDER BRACKET ───────────────────────────────────────────

function renderBracket() {
  const sport = state.sports.find(s => s.id === activeSportId);
  if (!sport) { bracketContainer.innerHTML = ''; return; }

  const isBetting = state.phase === 'betting';
  const teamMap = {};
  for (const t of sport.teams) teamMap[t.id] = t;

  const bracket = document.createElement('div');
  bracket.className = 'bracket';

  for (let r = 0; r < sport.bracket.length; r++) {
    const round = sport.bracket[r];
    const roundDiv = document.createElement('div');
    roundDiv.className = 'bracket-round';

    const header = document.createElement('div');
    header.className = 'round-header';
    header.textContent = round.name;
    roundDiv.appendChild(header);

    for (let m = 0; m < round.matches.length; m++) {
      const match = round.matches[m];
      const card = document.createElement('div');
      card.className = 'match-card';

      // Team 1
      card.appendChild(renderMatchTeam(match, match.team1Id, match.score ? match.score[0] : null, teamMap));
      // Team 2
      card.appendChild(renderMatchTeam(match, match.team2Id, match.score ? match.score[1] : null, teamMap));

      // Pick dropdown (betting phase, round has 2 known teams)
      if (isBetting && match.team1Id && match.team2Id) {
        const pickDiv = document.createElement('div');
        pickDiv.className = 'match-pick';

        const label = document.createElement('label');
        label.textContent = 'Your pick:';
        pickDiv.appendChild(label);

        const sel = document.createElement('select');
        sel.className = 'pick-select';
        sel.dataset.sportId = sport.id;
        sel.dataset.round = r;
        sel.dataset.match = m;

        const currentPick = getPickForMatch(sport.id, r, m);

        const optNone = document.createElement('option');
        optNone.value = '';
        optNone.textContent = '-- Select winner --';
        sel.appendChild(optNone);

        const t1 = teamMap[match.team1Id];
        const t2 = teamMap[match.team2Id];
        if (t1) {
          const o = document.createElement('option');
          o.value = t1.id;
          o.textContent = `(${t1.seed}) ${t1.name}`;
          if (currentPick === t1.id) o.selected = true;
          sel.appendChild(o);
        }
        if (t2) {
          const o = document.createElement('option');
          o.value = t2.id;
          o.textContent = `(${t2.seed}) ${t2.name}`;
          if (currentPick === t2.id) o.selected = true;
          sel.appendChild(o);
        }

        sel.addEventListener('change', onPickChange);
        pickDiv.appendChild(sel);
        card.appendChild(pickDiv);
      }

      // Show pick result during/after simulation
      if (!isBetting && state.phase !== 'waiting') {
        const pick = getPickForMatch(sport.id, r, m);
        if (pick && match.played) {
          const indicator = document.createElement('div');
          indicator.className = 'match-pick';
          const isCorrect = pick === match.winnerId;
          const team = teamMap[pick];
          indicator.innerHTML = `<span style="font-size:0.8rem;color:${isCorrect ? 'var(--win)' : 'var(--danger)'}">
            Your pick: ${team ? team.name : pick} ${isCorrect ? '&#10004;' : '&#10008;'}
          </span>`;
          card.appendChild(indicator);
        }
      }

      roundDiv.appendChild(card);
    }

    bracket.appendChild(roundDiv);
  }

  // Auto-fill buttons
  bracketContainer.innerHTML = '';

  if (isBetting) {
    const autoDiv = document.createElement('div');
    autoDiv.className = 'auto-fill-section';

    const favBtn = document.createElement('button');
    favBtn.className = 'btn btn-secondary btn-sm';
    favBtn.textContent = 'Auto-pick: Favorites';
    favBtn.addEventListener('click', () => autoFill(sport, 'favorites'));
    autoDiv.appendChild(favBtn);

    const randBtn = document.createElement('button');
    randBtn.className = 'btn btn-secondary btn-sm';
    randBtn.textContent = 'Auto-pick: Random';
    randBtn.addEventListener('click', () => autoFill(sport, 'random'));
    autoDiv.appendChild(randBtn);

    const upsetBtn = document.createElement('button');
    upsetBtn.className = 'btn btn-secondary btn-sm';
    upsetBtn.textContent = 'Auto-pick: Underdogs';
    upsetBtn.addEventListener('click', () => autoFill(sport, 'underdogs'));
    autoDiv.appendChild(upsetBtn);

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary btn-sm';
    submitBtn.textContent = 'Submit Bets';
    submitBtn.addEventListener('click', () => submitBetsForSport(sport.id));
    autoDiv.appendChild(submitBtn);

    bracketContainer.appendChild(autoDiv);
  }

  bracketContainer.appendChild(bracket);
}

function renderMatchTeam(match, teamId, score, teamMap) {
  const div = document.createElement('div');
  div.className = 'match-team';

  if (!teamId) {
    div.classList.add('tbd');
    div.innerHTML = `
      <span class="team-seed">?</span>
      <span class="team-name">TBD</span>
    `;
    return div;
  }

  const team = teamMap[teamId];
  if (!team) {
    div.classList.add('tbd');
    div.innerHTML = `<span class="team-name">${teamId}</span>`;
    return div;
  }

  if (match.played) {
    if (teamId === match.winnerId) div.classList.add('winner');
    else div.classList.add('loser');
  }

  div.innerHTML = `
    <span class="team-seed">${team.seed}</span>
    <span class="team-name">${esc(team.name)}</span>
    ${score !== null ? `<span class="team-score">${score}</span>` : ''}
  `;

  return div;
}

// ── PICK MANAGEMENT ──────────────────────────────────────────

// localPicks[sportId][roundIndex] = [ teamId, teamId, ... ]  (one per match)
let localPicks = {};

function ensurePicks(sportId) {
  if (!localPicks[sportId]) {
    localPicks[sportId] = { 0: [], 1: [], 2: [], 3: [] };
  }
}

function getPickForMatch(sportId, roundIndex, matchIndex) {
  ensurePicks(sportId);
  const roundPicks = localPicks[sportId][roundIndex];
  // Find pick for this specific match index
  return roundPicks[matchIndex] || null;
}

function onPickChange(e) {
  const sel = e.target;
  const sportId = sel.dataset.sportId;
  const roundIdx = parseInt(sel.dataset.round);
  const matchIdx = parseInt(sel.dataset.match);
  const teamId = sel.value;

  ensurePicks(sportId);
  if (!localPicks[sportId][roundIdx]) localPicks[sportId][roundIdx] = [];

  // Store pick by match index
  localPicks[sportId][roundIdx][matchIdx] = teamId || null;

  // If round 0, auto-propagate winners into later rounds
  propagatePicks(sportId);
  renderBracket();
}

function propagatePicks(sportId) {
  const sport = state.sports.find(s => s.id === sportId);
  if (!sport) return;
  ensurePicks(sportId);

  // For rounds 1-3, if both feeder matches from previous round have picks,
  // auto-populate this round's match teams and pre-select higher seed
  for (let r = 1; r < 4; r++) {
    const prevRound = sport.bracket[r - 1];
    const thisRound = sport.bracket[r];

    for (let m = 0; m < thisRound.matches.length; m++) {
      const feeder1 = m * 2;
      const feeder2 = m * 2 + 1;

      const pick1 = localPicks[sportId][r - 1][feeder1];
      const pick2 = localPicks[sportId][r - 1][feeder2];

      // Only set if both feeders have picks and this match hasn't been manually set
      if (pick1 && pick2) {
        // Update the bracket display teams for this round
        thisRound.matches[m].team1Id = pick1;
        thisRound.matches[m].team2Id = pick2;

        // If no pick yet for this match, don't auto-select
        // (user must choose)
      }
    }
  }
}

// ── AUTO-FILL ────────────────────────────────────────────────

function autoFill(sport, strategy) {
  ensurePicks(sport.id);
  const teamMap = {};
  for (const t of sport.teams) teamMap[t.id] = t;

  // Clear existing picks
  localPicks[sport.id] = { 0: [], 1: [], 2: [], 3: [] };

  // Simulate bracket with strategy
  let currentTeams = []; // teams advancing through rounds
  const bracket = sport.bracket;

  // Round 0: pick from actual matchups
  for (let m = 0; m < bracket[0].matches.length; m++) {
    const match = bracket[0].matches[m];
    const t1 = teamMap[match.team1Id];
    const t2 = teamMap[match.team2Id];
    if (!t1 || !t2) continue;

    let winner;
    if (strategy === 'favorites') {
      winner = t1.rating >= t2.rating ? t1 : t2;
    } else if (strategy === 'underdogs') {
      winner = t1.rating < t2.rating ? t1 : t2;
    } else {
      winner = Math.random() < 0.5 ? t1 : t2;
    }
    localPicks[sport.id][0][m] = winner.id;
    currentTeams.push(winner);
  }

  // Rounds 1-3: pick from winners of previous picks
  for (let r = 1; r < 4; r++) {
    const nextTeams = [];
    const matchCount = currentTeams.length / 2;
    for (let m = 0; m < matchCount; m++) {
      const t1 = currentTeams[m * 2];
      const t2 = currentTeams[m * 2 + 1];
      if (!t1 || !t2) continue;

      // Update bracket display
      sport.bracket[r].matches[m].team1Id = t1.id;
      sport.bracket[r].matches[m].team2Id = t2.id;

      let winner;
      if (strategy === 'favorites') {
        winner = t1.rating >= t2.rating ? t1 : t2;
      } else if (strategy === 'underdogs') {
        winner = t1.rating < t2.rating ? t1 : t2;
      } else {
        winner = Math.random() < 0.5 ? t1 : t2;
      }
      localPicks[sport.id][r][m] = winner.id;
      nextTeams.push(winner);
    }
    currentTeams = nextTeams;
  }

  renderBracket();
  showToast(`Auto-filled ${sport.name} bracket (${strategy})`);
}

// ── SUBMIT BETS ──────────────────────────────────────────────

function submitBetsForSport(sportId) {
  ensurePicks(sportId);
  const picks = localPicks[sportId];
  const expectedCounts = [8, 4, 2, 1];
  const wager = Math.max(100, parseInt(wagerInput.value) || 100);

  const data = { sportId, wager };

  for (let r = 0; r < 4; r++) {
    const roundPicks = (picks[r] || []).filter(p => p != null);
    if (roundPicks.length !== expectedCounts[r]) {
      showToast(`${sportId}: Round ${r + 1} needs ${expectedCounts[r]} picks (have ${roundPicks.length}). Use auto-fill or pick all matches.`, true);
      return;
    }
    data[`round${r}`] = roundPicks;
  }

  socket.emit('placeBets', data);
  myBets[sportId] = data;
}

function submitAllBets() {
  for (const sport of state.sports) {
    if (!myBets[sport.id]) {
      // Check if picks exist
      ensurePicks(sport.id);
      const picks = localPicks[sport.id];
      const expectedCounts = [8, 4, 2, 1];
      let complete = true;
      for (let r = 0; r < 4; r++) {
        const roundPicks = (picks[r] || []).filter(p => p != null);
        if (roundPicks.length !== expectedCounts[r]) { complete = false; break; }
      }
      if (complete) {
        submitBetsForSport(sport.id);
      }
    }
  }
}

// ── RESULTS ──────────────────────────────────────────────────

function renderResults(data) {
  resultsOverlay.style.display = '';

  // Leaderboard
  let html = '<table class="leaderboard-table"><thead><tr><th>#</th><th>Player</th><th>Winnings</th></tr></thead><tbody>';
  data.leaderboard.forEach((entry, i) => {
    const rankClass = i < 3 ? `rank-${i + 1}` : '';
    const winClass = entry.totalWon > 0 ? 'winnings' : 'winnings zero';
    html += `<tr>
      <td class="${rankClass}">${i + 1}</td>
      <td class="${rankClass}">${esc(entry.name)}${entry.socketId === myId ? ' (You)' : ''}</td>
      <td class="${winClass}">$${entry.totalWon.toLocaleString()}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  leaderboard.innerHTML = html;

  // My detailed results
  const myEntry = data.leaderboard.find(e => e.socketId === myId);
  if (myEntry && myEntry.details) {
    let detailHtml = '<h3 style="margin-bottom:12px;color:var(--text)">Your Detailed Results</h3>';
    for (const sport of data.sports) {
      const sportResult = myEntry.details[sport.id];
      if (!sportResult) continue;

      detailHtml += `<div class="detail-sport"><h4>${sport.icon} ${sport.name} — $${sportResult.totalWon.toLocaleString()}</h4>`;
      for (const rd of sportResult.rounds) {
        if (!rd) continue;
        detailHtml += `<div class="detail-round">
          <span>${rd.roundName}</span>
          <span class="correct">${rd.correct}/${rd.total} correct</span>
          <span>x${rd.multiplier}</span>
          <span class="payout">$${rd.payout.toLocaleString()}</span>
        </div>`;
      }
      detailHtml += '</div>';
    }
    detailedResults.innerHTML = detailHtml;
  }
}

// ── SIM LOG ──────────────────────────────────────────────────

function addSimEntry(html) {
  const div = document.createElement('div');
  div.className = 'sim-entry';
  div.innerHTML = html;
  simLogEntries.appendChild(div);
  simLogEntries.scrollTop = simLogEntries.scrollHeight;
}

// ── HELPERS ──────────────────────────────────────────────────

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getSportIcon(sportId) {
  const sport = state.sports.find(s => s.id === sportId);
  return sport ? sport.icon : '';
}

function showToast(message, isError) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
