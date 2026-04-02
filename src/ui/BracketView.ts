import type { Sport, Team, PlayerBets } from '../game/sports/SportsLeague';

const COLORS = {
  bg: '#0a0a18',
  line: '#1a3a2a',
  lineActive: '#00ff88',
  text: '#88bbaa',
  textDim: '#334455',
  textBright: '#00ff88',
  matchBg: '#0a1a15',
  matchBorder: '#1a3a2a',
  matchPlayed: '#0f2a1a',
  matchPlayedBorder: '#336655',
  winner: '#00ff88',
  loser: '#553333',
  betCorrect: '#00ff88',
  betWrong: '#ff4444',
  betPending: '#ffaa22',
  score: '#aaccbb',
  seed: '#446666',
  phaseLabel: '#6688ff',
  highlight: '#1a4a2a',
};

const MATCH_W = 150;
const MATCH_H = 44;
const ROUND_GAP = 50;
const MATCH_V_GAP = 8;

/** Stored positions for hit-testing clicks */
interface TeamHitBox {
  x: number;
  y: number;
  w: number;
  h: number;
  teamId: string;
}

export class BracketView {
  private static refreshTimer: ReturnType<typeof setInterval> | null = null;
  private static hitBoxes: TeamHitBox[] = [];

  static show(sport: Sport): void {
    document.getElementById('bracket-modal')?.remove();
    if (BracketView.refreshTimer) {
      clearInterval(BracketView.refreshTimer);
      BracketView.refreshTimer = null;
    }

    const modal = document.createElement('div');
    modal.id = 'bracket-modal';

    const teamMap = new Map<string, Team>();
    for (const t of sport.teams) teamMap.set(t.id, t);

    modal.innerHTML = `
      <div class="bk-backdrop"></div>
      <div class="bk-content">
        <div class="bk-header">
          <span>${sport.icon} ${sport.name} — Season ${sport.seasonNumber}</span>
          <span class="bk-phase" id="bk-phase-label"></span>
          <button class="bk-close">&times;</button>
        </div>
        <div class="bk-body">
          <canvas id="bracket-canvas"></canvas>
          <div id="bk-team-detail" class="bk-team-detail" style="display:none;"></div>
        </div>
        <div class="bk-footer" id="bk-footer"></div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      if (BracketView.refreshTimer) {
        clearInterval(BracketView.refreshTimer);
        BracketView.refreshTimer = null;
      }
      modal.remove();
    };

    modal.querySelector('.bk-backdrop')!.addEventListener('click', close);
    modal.querySelector('.bk-close')!.addEventListener('click', close);

    // Canvas click handler for team details
    const canvas = modal.querySelector('#bracket-canvas') as HTMLCanvasElement;
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const mx = (e.clientX - rect.left) * dpr;
      const my = (e.clientY - rect.top) * dpr;

      for (const hb of BracketView.hitBoxes) {
        if (mx >= hb.x * dpr && mx <= (hb.x + hb.w) * dpr &&
            my >= hb.y * dpr && my <= (hb.y + hb.h) * dpr) {
          const team = teamMap.get(hb.teamId);
          if (team) BracketView.showTeamDetail(modal, team, sport);
          return;
        }
      }
      // Clicked empty area — hide detail
      const detail = modal.querySelector('#bk-team-detail') as HTMLElement;
      if (detail) detail.style.display = 'none';
    });

    // Initial draw + timer updates
    const refresh = () => {
      BracketView.updatePhaseLabel(modal, sport);
      BracketView.updateFooter(modal, sport);
      BracketView.draw(modal, sport, teamMap);
    };
    refresh();
    BracketView.refreshTimer = setInterval(refresh, 1500);
  }

  private static updatePhaseLabel(modal: HTMLElement, sport: Sport): void {
    const el = modal.querySelector('#bk-phase-label');
    if (!el) return;

    if (sport.phase === 'betting') {
      const totalSecs = Math.ceil(sport.phaseTicksLeft * 1.5);
      const min = Math.floor(totalSecs / 60);
      const sec = totalSecs % 60;
      el.innerHTML = `<span style="color:#ffaa22;">BETTING OPEN</span> — <span style="color:#fff;">${min}:${String(sec).padStart(2, '0')}</span>`;
    } else if (sport.phase === 'playing') {
      const roundSecs = Math.ceil(sport.roundTicksLeft * 1.5);
      const roundName = sport.bracket[sport.currentRound]?.name ?? '';
      el.innerHTML = `<span style="color:#00ff88;">${roundName}</span> — <span style="color:#fff;">${roundSecs}s</span>`;
    } else {
      const secs = Math.ceil(sport.phaseTicksLeft * 1.5);
      el.innerHTML = `<span style="color:#6688ff;">SEASON COMPLETE</span> — next in ${secs}s`;
    }
  }

  private static updateFooter(modal: HTMLElement, sport: Sport): void {
    const el = modal.querySelector('#bk-footer');
    if (!el) return;

    if (!sport.playerBets) {
      el.innerHTML = '<span style="color:#334455;">No bets placed this season</span>';
      return;
    }

    const b = sport.playerBets;
    const roundLabels = ['R16', 'QF', 'SF', 'Final'];
    let html = `<span class="bk-bet-label">Your Bets ($${b.wager.toLocaleString()} wager):</span>`;

    if (b.correctPerRound.length > 0) {
      const parts = b.correctPerRound.map((c, i) => {
        const expected = [8, 4, 2, 1][i]!;
        const color = c === expected ? COLORS.betCorrect : c > 0 ? COLORS.betPending : COLORS.betWrong;
        return `<span style="color:${color};">${roundLabels[i]}: ${c}/${expected}</span>`;
      });
      html += parts.join(' ');
      html += `<span class="bk-payout" style="color:${b.payout > 0 ? '#00ff88' : '#ff4444'};">Payout: $${b.payout.toLocaleString()}</span>`;
    } else {
      html += '<span style="color:#ffaa22;">Awaiting results...</span>';
    }

    el.innerHTML = html;
  }

  private static showTeamDetail(modal: HTMLElement, team: Team, sport: Sport): void {
    const detail = modal.querySelector('#bk-team-detail') as HTMLElement;
    if (!detail) return;

    // Find the team's tournament path
    const path: string[] = [];
    for (const round of sport.bracket) {
      for (const m of round.matches) {
        if (m.played && (m.team1Id === team.id || m.team2Id === team.id)) {
          const opp = m.team1Id === team.id ? m.team2Id : m.team1Id;
          const oppTeam = sport.teams.find(t => t.id === opp);
          const won = m.winnerId === team.id;
          path.push(`${won ? 'W' : 'L'} vs ${oppTeam?.name ?? 'TBD'} (${m.score ? m.score.join('-') : '—'})`);
        }
      }
    }

    const winPct = team.wins + team.losses > 0
      ? Math.round((team.wins / (team.wins + team.losses)) * 100) : 0;

    detail.innerHTML = `
      <div class="bk-detail-header">${team.name}</div>
      <div class="bk-detail-row"><span>Seed</span><span>#${team.seed}</span></div>
      <div class="bk-detail-row"><span>Rating</span><span style="color:#ffaa22;">${team.rating}</span></div>
      <div class="bk-detail-row"><span>Record</span><span>${team.wins}W - ${team.losses}L${winPct > 0 ? ` (${winPct}%)` : ''}</span></div>
      ${path.length > 0 ? `
        <div class="bk-detail-label">Tournament Path</div>
        ${path.map(p => {
          const color = p.startsWith('W') ? '#00ff88' : '#ff4444';
          return `<div class="bk-detail-path" style="color:${color};">${p}</div>`;
        }).join('')}
      ` : '<div class="bk-detail-label" style="color:#334455;">No matches played yet</div>'}
    `;
    detail.style.display = 'block';
  }

  private static draw(modal: HTMLElement, sport: Sport, teamMap: Map<string, Team>): void {
    const canvas = modal.querySelector('#bracket-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    BracketView.hitBoxes = [];

    const rounds = sport.bracket;
    const roundCount = rounds.length;

    const padX = 30;
    const padY = 30;
    const maxMatches = rounds[0]?.matches.length ?? 8;
    const colW = MATCH_W + ROUND_GAP;

    const totalW = padX * 2 + roundCount * colW;
    const round1H = maxMatches * (MATCH_H + MATCH_V_GAP) - MATCH_V_GAP;
    const totalH = padY * 2 + round1H + 40;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = totalW * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = totalW + 'px';
    canvas.style.height = totalH + 'px';
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, totalW, totalH);

    // Positions
    const positions: { x: number; y: number; centerY: number }[][] = [];

    for (let r = 0; r < roundCount; r++) {
      const round = rounds[r]!;
      const matchCount = round.matches.length;
      const x = padX + r * colW;
      const totalRoundH = matchCount * (MATCH_H + MATCH_V_GAP) - MATCH_V_GAP;

      let startY: number;
      if (r === 0) {
        startY = padY + 30;
      } else {
        const parentPositions = positions[r - 1]!;
        const firstParent = parentPositions[0]!;
        const lastParent = parentPositions[parentPositions.length - 1]!;
        const groupH = lastParent.centerY - firstParent.centerY;
        const centerOfParents = firstParent.centerY + groupH / 2;
        startY = centerOfParents - totalRoundH / 2;
      }

      const roundPositions: { x: number; y: number; centerY: number }[] = [];
      for (let m = 0; m < matchCount; m++) {
        const y = startY + m * (MATCH_H + MATCH_V_GAP);
        roundPositions.push({ x, y, centerY: y + MATCH_H / 2 });
      }
      positions.push(roundPositions);
    }

    // Round headers
    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'center';
    for (let r = 0; r < roundCount; r++) {
      const x = padX + r * colW + MATCH_W / 2;
      const isActive = sport.phase === 'playing' && sport.currentRound === r;
      ctx.fillStyle = isActive ? COLORS.phaseLabel : COLORS.textDim;
      ctx.fillText(rounds[r]!.name.toUpperCase(), x, padY + 20);
    }

    // Connector lines
    for (let r = 1; r < roundCount; r++) {
      const prevRound = positions[r - 1]!;
      const currRound = positions[r]!;

      for (let m = 0; m < currRound.length; m++) {
        const curr = currRound[m]!;
        const parent1 = prevRound[m * 2];
        const parent2 = prevRound[m * 2 + 1];

        if (parent1 && parent2) {
          const match = rounds[r]!.matches[m]!;
          const isReady = match.team1Id && match.team2Id;
          ctx.strokeStyle = isReady ? COLORS.lineActive + '66' : COLORS.line;
          ctx.lineWidth = 1.5;

          const midX = parent1.x + MATCH_W + ROUND_GAP / 2;

          ctx.beginPath();
          ctx.moveTo(parent1.x + MATCH_W, parent1.centerY);
          ctx.lineTo(midX, parent1.centerY);
          ctx.lineTo(midX, parent2.centerY);
          ctx.lineTo(parent2.x + MATCH_W, parent2.centerY);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(midX, curr.centerY);
          ctx.lineTo(curr.x, curr.centerY);
          ctx.stroke();
        }
      }
    }

    // Draw matches
    for (let r = 0; r < roundCount; r++) {
      const round = rounds[r]!;
      for (let m = 0; m < round.matches.length; m++) {
        const match = round.matches[m]!;
        const pos = positions[r]![m]!;
        BracketView.drawMatch(ctx, pos.x, pos.y, match, teamMap, sport.playerBets, r);
      }
    }
  }

  private static drawMatch(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    match: { team1Id: string | null; team2Id: string | null; winnerId: string | null; played: boolean; score: [number, number] | null },
    teamMap: Map<string, Team>,
    bets: PlayerBets | null,
    roundIndex: number,
  ): void {
    const played = match.played;
    const halfH = MATCH_H / 2;

    ctx.fillStyle = played ? COLORS.matchPlayed : COLORS.matchBg;
    ctx.strokeStyle = played ? COLORS.matchPlayedBorder : COLORS.matchBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, MATCH_W, MATCH_H, 3);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = COLORS.matchBorder;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y + halfH);
    ctx.lineTo(x + MATCH_W, y + halfH);
    ctx.stroke();

    const teams = [
      { id: match.team1Id, scoreIdx: 0 as const },
      { id: match.team2Id, scoreIdx: 1 as const },
    ];

    for (let i = 0; i < 2; i++) {
      const { id, scoreIdx } = teams[i]!;
      const ty = y + i * halfH;

      if (!id) {
        ctx.font = '9px Courier New';
        ctx.fillStyle = COLORS.textDim;
        ctx.textAlign = 'left';
        ctx.fillText('TBD', x + 6, ty + halfH / 2 + 3);
        continue;
      }

      const team = teamMap.get(id);
      if (!team) continue;

      // Register click hit box
      BracketView.hitBoxes.push({ x, y: ty, w: MATCH_W, h: halfH, teamId: id });

      const isWinner = played && match.winnerId === id;
      const isLoser = played && match.winnerId !== id;

      // Bet indicator
      if (bets) {
        const predicted = bets.rounds[roundIndex]?.includes(id);
        if (predicted) {
          let dotColor = COLORS.betPending;
          if (played) dotColor = isWinner ? COLORS.betCorrect : COLORS.betWrong;
          ctx.fillStyle = dotColor;
          ctx.beginPath();
          ctx.arc(x + MATCH_W - 8, ty + halfH / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Seed
      ctx.font = '8px Courier New';
      ctx.fillStyle = COLORS.seed;
      ctx.textAlign = 'left';
      ctx.fillText(`(${team.seed})`, x + 4, ty + halfH / 2 + 3);

      // Team name
      ctx.font = isWinner ? 'bold 9px Courier New' : '9px Courier New';
      ctx.fillStyle = isWinner ? COLORS.winner : isLoser ? COLORS.loser : COLORS.text;
      const nameX = x + 26;
      const maxNameW = MATCH_W - 50;
      ctx.fillText(team.name.length > 16 ? team.name.slice(0, 15) + '\u2026' : team.name, nameX, ty + halfH / 2 + 3, maxNameW);

      // Score
      if (match.score) {
        ctx.font = 'bold 9px Courier New';
        ctx.fillStyle = isWinner ? COLORS.winner : COLORS.score;
        ctx.textAlign = 'right';
        ctx.fillText(String(match.score[scoreIdx]), x + MATCH_W - 15, ty + halfH / 2 + 3);
        ctx.textAlign = 'left';
      }
    }
  }
}
