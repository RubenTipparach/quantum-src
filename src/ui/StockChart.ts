import type { Stock, Candle } from '../game/economy/StockMarket';

export type Timeframe = 60 | 300 | 600; // 1min, 5min, 10min in seconds/candles

const BAR_WIDTH = 6;
const BAR_GAP = 1;
const BAR_STEP = BAR_WIDTH + BAR_GAP; // 7px per bar

const COLORS = {
  bg: '#050510',
  grid: '#0a1515',
  gridText: '#334455',
  bullBody: '#00cc66',
  bullWick: '#00aa55',
  bearBody: '#dd3333',
  bearWick: '#aa2222',
  volume: '#1a3a2a',
  volumeHigh: '#2a5a3a',
  priceLabel: '#00ff88',
  symbolLabel: '#668877',
  timeframeLabel: '#446666',
};

export class StockChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private timeframe: Timeframe = 60;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  setTimeframe(tf: Timeframe): void {
    this.timeframe = tf;
  }

  getTimeframe(): Timeframe {
    return this.timeframe;
  }

  render(stock: Stock): void {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (w === 0 || h === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    const padding = { top: 20, right: 55, bottom: 20, left: 6 };
    const chartW = w - padding.left - padding.right;
    const volumeH = 25;
    const chartH = h - padding.top - padding.bottom - volumeH;

    if (chartW < 20 || chartH < 20) return;

    // How many bars fit in the chart area
    const maxBars = Math.floor(chartW / BAR_STEP);

    // Get candles for the timeframe, take only what fits
    const allCandles = stock.candles;
    const tfCandles = allCandles.slice(-this.timeframe);
    const visible = tfCandles.slice(-maxBars);

    if (visible.length === 0) return;

    // Price range from visible candles
    let minP = Infinity, maxP = -Infinity, maxVol = 0;
    for (const c of visible) {
      minP = Math.min(minP, c.low);
      maxP = Math.max(maxP, c.high);
      maxVol = Math.max(maxVol, c.volume);
    }
    // Add some padding to price range
    const range = maxP - minP || 1;
    minP -= range * 0.05;
    maxP += range * 0.05;
    const adjRange = maxP - minP;

    const priceToY = (p: number) => padding.top + chartH - ((p - minP) / adjRange) * chartH;

    // Draw grid
    this.drawGrid(ctx, padding.left, padding.top, chartW, chartH, minP, maxP, padding.left + chartW + 5);

    // Draw candles — right-aligned (latest bar at right edge)
    const startX = padding.left + chartW - visible.length * BAR_STEP;

    for (let i = 0; i < visible.length; i++) {
      const c = visible[i]!;
      const cx = startX + i * BAR_STEP + BAR_WIDTH / 2;
      const isBull = c.close >= c.open;

      // Wick
      ctx.strokeStyle = isBull ? COLORS.bullWick : COLORS.bearWick;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, priceToY(c.high));
      ctx.lineTo(cx, priceToY(c.low));
      ctx.stroke();

      // Body
      const bodyTop = priceToY(Math.max(c.open, c.close));
      const bodyBot = priceToY(Math.min(c.open, c.close));
      const bodyH = Math.max(1, bodyBot - bodyTop);
      ctx.fillStyle = isBull ? COLORS.bullBody : COLORS.bearBody;
      ctx.fillRect(cx - BAR_WIDTH / 2, bodyTop, BAR_WIDTH, bodyH);

      // Volume bar
      const volH = maxVol > 0 ? (c.volume / maxVol) * volumeH : 0;
      const volY = h - padding.bottom - volH;
      ctx.fillStyle = isBull ? COLORS.volumeHigh : COLORS.volume;
      ctx.fillRect(cx - BAR_WIDTH / 2, volY, BAR_WIDTH, volH);
    }

    // Current price line
    const curY = priceToY(stock.price);
    ctx.strokeStyle = '#00ff8833';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padding.left, curY);
    ctx.lineTo(padding.left + chartW, curY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price tag on right
    ctx.fillStyle = '#0a2a18';
    ctx.fillRect(padding.left + chartW + 2, curY - 7, 50, 14);
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(padding.left + chartW + 2, curY - 7, 50, 14);
    ctx.fillStyle = COLORS.priceLabel;
    ctx.font = '9px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`$${stock.price.toFixed(2)}`, padding.left + chartW + 5, curY + 3);

    // Header: symbol + name + price
    ctx.font = 'bold 11px Courier New';
    ctx.fillStyle = COLORS.symbolLabel;
    ctx.textAlign = 'left';
    ctx.fillText(`${stock.symbol} — ${stock.name}`, padding.left + 4, padding.top - 6);

    ctx.fillStyle = COLORS.priceLabel;
    ctx.textAlign = 'right';
    ctx.fillText(`$${stock.price.toFixed(2)}`, w - 4, padding.top - 6);
    ctx.textAlign = 'left';

    // Timeframe + bar count label
    const tfLabel = this.timeframe === 60 ? '1m' : this.timeframe === 300 ? '5m' : '10m';
    ctx.font = '9px Courier New';
    ctx.fillStyle = COLORS.timeframeLabel;
    ctx.fillText(`${tfLabel} · ${visible.length} bars`, padding.left + 4, h - 4);
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number, cw: number, ch: number,
    minP: number, maxP: number, labelX: number,
  ): void {
    const gridLines = 4;
    const range = maxP - minP || 1;
    ctx.font = '9px Courier New';
    ctx.textAlign = 'left';

    for (let i = 0; i <= gridLines; i++) {
      const t = i / gridLines;
      const y = y0 + ch - t * ch;
      const price = minP + t * range;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + cw, y);
      ctx.stroke();

      ctx.fillStyle = COLORS.gridText;
      ctx.fillText(`$${price.toFixed(2)}`, labelX, y + 3);
    }
  }
}
