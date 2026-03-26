import type { Stock } from '../game/economy/StockMarket';

export type Timeframe = 60 | 300 | 600;
export type ChartMode = 'candle' | 'line';

const BAR_WIDTH = 6;
const BAR_GAP = 1;
const BAR_STEP = BAR_WIDTH + BAR_GAP;

const GREEN = '#00cc66';
const RED = '#dd3333';

const COLORS = {
  bg: '#050510',
  grid: '#0a1515',
  gridText: '#334455',
  bullBody: GREEN,
  bullWick: '#00aa55',
  bearBody: RED,
  bearWick: '#aa2222',
  volume: '#1a3a2a',
  volumeHigh: '#2a5a3a',
  priceLabel: '#00ff88',
  symbolLabel: '#668877',
  timeframeLabel: '#446666',
  line: '#00ff88',
  lineFill: 'rgba(0, 255, 136, 0.08)',
};

export class StockChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private timeframe: Timeframe = 60;
  private mode: ChartMode = 'candle';
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  setTimeframe(tf: Timeframe): void { this.timeframe = tf; }
  getTimeframe(): Timeframe { return this.timeframe; }
  setMode(m: ChartMode): void { this.mode = m; }
  getMode(): ChartMode { return this.mode; }

  render(stock: Stock, marketEmotion: number): void {
    this.time += 0.016; // ~60fps

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

    const padding = { top: 22, right: 55, bottom: 32, left: 6 };
    const chartW = w - padding.left - padding.right;
    const volumeH = 20;
    const chartH = h - padding.top - padding.bottom - volumeH;

    if (chartW < 20 || chartH < 20) return;

    const allCandles = stock.candles;
    const tfCandles = allCandles.slice(-this.timeframe);

    if (tfCandles.length === 0) return;

    // Price range
    let minP = Infinity, maxP = -Infinity, maxVol = 0;
    for (const c of tfCandles) {
      minP = Math.min(minP, c.low);
      maxP = Math.max(maxP, c.high);
      maxVol = Math.max(maxVol, c.volume);
    }
    const range = maxP - minP || 1;
    minP -= range * 0.05;
    maxP += range * 0.05;
    const adjRange = maxP - minP;

    const priceToY = (p: number) => padding.top + chartH - ((p - minP) / adjRange) * chartH;

    // Grid
    this.drawGrid(ctx, padding.left, padding.top, chartW, chartH, minP, maxP, padding.left + chartW + 5);

    if (this.mode === 'candle') {
      this.drawCandles(ctx, stock, tfCandles, priceToY, maxVol, volumeH, padding, chartW, h);
    } else {
      this.drawLine(ctx, stock, tfCandles, priceToY, maxVol, volumeH, padding, chartW, h);
    }

    // Current price dashed line
    const curY = priceToY(stock.price);
    ctx.strokeStyle = `${COLORS.line}33`;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padding.left, curY);
    ctx.lineTo(padding.left + chartW, curY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Current price badge on right axis
    ctx.fillStyle = '#0a2a18';
    ctx.fillRect(padding.left + chartW + 2, curY - 7, 50, 14);
    ctx.strokeStyle = COLORS.priceLabel;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(padding.left + chartW + 2, curY - 7, 50, 14);
    ctx.fillStyle = COLORS.priceLabel;
    ctx.font = 'bold 9px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`$${stock.price.toFixed(2)}`, padding.left + chartW + 5, curY + 3);

    // Header: symbol + price + change %
    const firstCandle = tfCandles[0]!;
    const priceChange = stock.price - firstCandle.open;
    const pctChange = (priceChange / firstCandle.open) * 100;
    const changeColor = priceChange >= 0 ? GREEN : RED;
    const changeSign = priceChange >= 0 ? '+' : '';

    ctx.font = 'bold 11px Courier New';
    ctx.fillStyle = COLORS.symbolLabel;
    ctx.textAlign = 'left';
    ctx.fillText(`${stock.symbol}`, padding.left + 4, padding.top - 8);

    ctx.font = '10px Courier New';
    ctx.fillStyle = COLORS.priceLabel;
    const priceX = padding.left + 4 + ctx.measureText(stock.symbol).width + 8;
    ctx.fillText(`$${stock.price.toFixed(2)}`, priceX, padding.top - 8);

    ctx.fillStyle = changeColor;
    const changeX = priceX + ctx.measureText(`$${stock.price.toFixed(2)}`).width + 8;
    ctx.fillText(`${changeSign}${pctChange.toFixed(1)}%`, changeX, padding.top - 8);

    // Bottom: timeframe label + bar count
    const tfLabel = this.timeframe === 60 ? '1m' : this.timeframe === 300 ? '5m' : '10m';
    ctx.font = '9px Courier New';
    ctx.fillStyle = COLORS.timeframeLabel;
    ctx.textAlign = 'left';
    ctx.fillText(`${tfLabel} · ${tfCandles.length} bars`, padding.left + 4, h - padding.bottom + 14);

    // Market emotion gauge at bottom
    this.drawEmotionGauge(ctx, padding.left + chartW / 2 - 60, h - padding.bottom + 8, 120, 10, marketEmotion);
  }

  private drawCandles(
    ctx: CanvasRenderingContext2D, stock: Stock,
    candles: typeof stock.candles, priceToY: (p: number) => number,
    maxVol: number, volumeH: number,
    padding: { top: number; right: number; bottom: number; left: number },
    chartW: number, totalH: number,
  ): void {
    const maxBars = Math.floor(chartW / BAR_STEP);
    const visible = candles.slice(-maxBars);
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

      // Volume
      const volH = maxVol > 0 ? (c.volume / maxVol) * volumeH : 0;
      const volY = totalH - padding.bottom - volH;
      ctx.fillStyle = isBull ? COLORS.volumeHigh : COLORS.volume;
      ctx.fillRect(cx - BAR_WIDTH / 2, volY, BAR_WIDTH, volH);
    }
  }

  private drawLine(
    ctx: CanvasRenderingContext2D, stock: Stock,
    candles: typeof stock.candles, priceToY: (p: number) => number,
    maxVol: number, volumeH: number,
    padding: { top: number; right: number; bottom: number; left: number },
    chartW: number, totalH: number,
  ): void {
    if (candles.length < 2) return;

    const prices = candles.map(c => c.close);
    const gap = chartW / Math.max(1, prices.length - 1);

    // Area fill
    ctx.beginPath();
    ctx.moveTo(padding.left, priceToY(prices[0]!));
    for (let i = 0; i < prices.length; i++) {
      ctx.lineTo(padding.left + i * gap, priceToY(prices[i]!));
    }
    ctx.lineTo(padding.left + (prices.length - 1) * gap, padding.top + (totalH - padding.top - padding.bottom - volumeH));
    ctx.lineTo(padding.left, padding.top + (totalH - padding.top - padding.bottom - volumeH));
    ctx.closePath();
    ctx.fillStyle = COLORS.lineFill;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < prices.length; i++) {
      const px = padding.left + i * gap;
      const py = priceToY(prices[i]!);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pulsing dot at current price
    const lastX = padding.left + (prices.length - 1) * gap;
    const lastY = priceToY(prices[prices.length - 1]!);
    const pulse = 2 + Math.sin(this.time * 3) * 1;
    const pulseAlpha = 0.7 + Math.sin(this.time * 3) * 0.3;
    ctx.beginPath();
    ctx.arc(lastX, lastY, pulse, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.line;
    ctx.globalAlpha = pulseAlpha;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Volume bars
    const maxBars = Math.floor(chartW / BAR_STEP);
    const visCandles = candles.slice(-maxBars);
    const vStartX = padding.left + chartW - visCandles.length * BAR_STEP;
    for (let i = 0; i < visCandles.length; i++) {
      const c = visCandles[i]!;
      const cx = vStartX + i * BAR_STEP + BAR_WIDTH / 2;
      const volH = maxVol > 0 ? (c.volume / maxVol) * volumeH : 0;
      const volY = totalH - padding.bottom - volH;
      ctx.fillStyle = c.close >= c.open ? COLORS.volumeHigh : COLORS.volume;
      ctx.fillRect(cx - BAR_WIDTH / 2, volY, BAR_WIDTH, volH);
    }
  }

  private drawEmotionGauge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, emotion: number): void {
    // Gradient bar: red (fear) → gray → green (greed)
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#ff2222');
    grad.addColorStop(0.25, '#ff6644');
    grad.addColorStop(0.5, '#888888');
    grad.addColorStop(0.75, '#88ff44');
    grad.addColorStop(1, '#00ff00');

    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;

    // Indicator line
    const pos = ((emotion + 1) / 2) * w; // emotion: -1 to 1
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + pos - 1, y - 1, 3, h + 2);

    // Labels
    ctx.font = '7px Courier New';
    ctx.fillStyle = '#ff4444';
    ctx.textAlign = 'left';
    ctx.fillText('FEAR', x, y + h + 8);
    ctx.fillStyle = '#44ff44';
    ctx.textAlign = 'right';
    ctx.fillText('GREED', x + w, y + h + 8);
    ctx.textAlign = 'left';
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number, cw: number, ch: number,
    minP: number, maxP: number, labelX: number,
  ): void {
    const gridLines = 3;
    const range = maxP - minP || 1;
    ctx.font = '9px Courier New';
    ctx.textAlign = 'left';

    for (let i = 0; i <= gridLines; i++) {
      const t = i / gridLines;
      const y = y0 + ch - t * ch;
      const price = minP + t * range;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + cw, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.gridText;
      ctx.fillText(`$${price.toFixed(2)}`, labelX, y + 3);
    }
  }
}
