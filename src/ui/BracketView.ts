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
};

const MATCH_W = 150;
const MATCH_H = 44;
const ROUND_GAP = 50;
const MATCH_V_GAP = 8;

export class BracketView {
  static show(sport: Sport): void {
    document.getElementById('bracket-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'bracket-modal';

    const teamMap = new Map<string, Team>();
    for (const t of sport.teams) teamMap.set(t.id, t);

    modal.innerHTML = `
      <div class="bk-backdrop"></div>
      <div class="bk-content">
        <div class="bk-header">
          <span>${sport.icon} ${sport.name} — Season ${sport.seasonNumber}</span>
          <span class="bk-phase">${BracketView.phaseLabel(sport)}</span>
          <button class="bk-close">&times;</button>
        </div>
        <div class="bk-body"><canvas id="bracket-canvas"></canvas></div>
        ${sport.playerBets ? BracketView.betsFooter(sport) : '<div class="bk-footer" style="color:#334455;">No bets placed this season</div>'}
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.bk-backdrop')!.addEventListener('click', () => modal.remove());
    modal.querySelector('.bk-close')!.addEventListener('click', () => modal.remove());

    BracketView.draw(modal, sport, teamMap);
  }

  private static phaseLabel(sport: Sport): string {
    if (sport.phase === 'betting') {
      const secs = Math.ceil(sport.phaseTicksLeft * 1.5);
      return `BETTING OPEN — ${secs}s left`;
    }
    if (sport.phase === 'playing') {
      return `ROUND ${sport.currentRound + 1}/4 — ${sport.bracket[sport.currentRound]?.name ?? ''}`;
    }
    return 'SEASON COMPLETE';
  }

  private static betsFooter(sport: Sport): string {
    const b = sport.playerBets!;
    const roundLabels = ['R16', 'QF', 'SF', 'Final'];
    let html = '<div class="bk-footer"><span class="bk-bet-label">Your Bets ($' +
      b.wager.toLocaleString() + ' wager):</span>';

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

    html += '</div>';
    return html;
  }

  private static draw(modal: HTMLElement, sport: Sport, teamMap: Map<string, Team>): void {
    const canvas = modal.querySelector('#bracket-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;

    const rounds = sport.bracket;
    const roundCount = rounds.length;

    // Calculate canvas dimensions
    const padX = 30;
    const padY = 30;
    const maxMatches = rounds[0]?.matches.length ?? 8;
    const colW = MATCH_W + ROUND_GAP;

    const totalW = padX * 2 + roundCount * colW;
    // Height: first round determines max, subsequent rounds center vertically
    const round1H = maxMatches * (MATCH_H + MATCH_V_GAP) - MATCH_V_GAP;
    const totalH = padY * 2 + round1H + 40; // +40 for header

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = totalW * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = totalW + 'px';
    canvas.style.height = totalH + 'px';
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, totalW, totalH);

    // Positions: each match → { x, y, centerY }
    const positions: { x: number; y: number; centerY: number }[][] = [];

    for (let r = 0; r < roundCount; r++) {
      const round = rounds[r]!;
      const matchCount = round.matches.length;
      const x = padX + r * colW;

      // Center vertically relative to round 1
      const totalRoundH = matchCount * (MATCH_H + MATCH_V_GAP) - MATCH_V_GAP;

      let startY: number;
      if (r === 0) {
        startY = padY + 30;
      } else {
        // Center between the midpoints of parent matches
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

    // Draw round headers
    ctx.font = 'bold 10px Courier New';
    ctx.textAlign = 'center';
    for (let r = 0; r < roundCount; r++) {
      const x = padX + r * colW + MATCH_W / 2;
      const isActive = sport.phase === 'playing' && sport.currentRound === r;
      ctx.fillStyle = isActive ? COLORS.phaseLabel : COLORS.textDim;
      ctx.fillText(rounds[r]!.name.toUpperCase(), x, padY + 20);
    }

    // Draw connector lines
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

          // Horizontal from parent, then vertical, then horizontal to child
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

    // Match box
    ctx.fillStyle = played ? COLORS.matchPlayed : COLORS.matchBg;
    ctx.strokeStyle = played ? COLORS.matchPlayedBorder : COLORS.matchBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, MATCH_W, MATCH_H, 3);
    ctx.fill();
    ctx.stroke();

    // Divider line
    ctx.strokeStyle = COLORS.matchBorder;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y + halfH);
    ctx.lineTo(x + MATCH_W, y + halfH);
    ctx.stroke();

    // Draw each team
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
      ctx.fillText(team.name.length > 16 ? team.name.slice(0, 15) + '…' : team.name, nameX, ty + halfH / 2 + 3, maxNameW);

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
