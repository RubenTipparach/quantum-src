import type { Stock, Candle } from '../game/economy/StockMarket';

export type ChartMode = 'candle' | 'line';

const COLORS = {
  bg: '#050510',
  grid: '#0a1515',
  gridText: '#334455',
  bullBody: '#00cc66',
  bullWick: '#00aa55',
  bearBody: '#dd3333',
  bearWick: '#aa2222',
  line: '#00ff88',
  lineFill: 'rgba(0, 255, 136, 0.08)',
  volume: '#1a3a2a',
  volumeHigh: '#2a5a3a',
  crosshair: '#335544',
  priceLabel: '#00ff88',
  symbolLabel: '#668877',
};

export class StockChart {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mode: ChartMode = 'candle';
  private animatedPrices: number[] = [];
  private animatedCandles: { open: number; high: number; low: number; close: number; volume: number }[] = [];
  private lerpSpeed = 0.15;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  setMode(mode: ChartMode): void {
    this.mode = mode;
  }

  getMode(): ChartMode {
    return this.mode;
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

    // Clear
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    const padding = { top: 20, right: 55, bottom: 40, left: 10 };
    const chartW = w - padding.left - padding.right;
    const volumeH = 30;
    const chartH = h - padding.top - padding.bottom - volumeH;

    if (chartW < 20 || chartH < 20) return;

    if (this.mode === 'candle') {
      this.renderCandlestick(ctx, stock, padding.left, padding.top, chartW, chartH, volumeH, w, h);
    } else {
      this.renderLine(ctx, stock, padding.left, padding.top, chartW, chartH, volumeH, w, h);
    }

    // Symbol label
    ctx.font = 'bold 11px Courier New';
    ctx.fillStyle = COLORS.symbolLabel;
    ctx.fillText(`${stock.symbol} — ${stock.name}`, padding.left + 4, padding.top - 6);

    // Current price
    ctx.fillStyle = COLORS.priceLabel;
    ctx.textAlign = 'right';
    ctx.fillText(`$${stock.price.toFixed(2)}`, w - 4, padding.top - 6);
    ctx.textAlign = 'left';
  }

  private renderCandlestick(
    ctx: CanvasRenderingContext2D, stock: Stock,
    x0: number, y0: number, cw: number, ch: number,
    volumeH: number, _totalW: number, totalH: number,
  ): void {
    const candles = [...stock.candles, stock.currentCandle];
    const maxCandles = Math.min(candles.length, 50);
    const visible = candles.slice(-maxCandles);

    // Animate candle values
    while (this.animatedCandles.length < visible.length) {
      const c = visible[this.animatedCandles.length]!;
      this.animatedCandles.push({ ...c });
    }
    this.animatedCandles = this.animatedCandles.slice(-maxCandles);
    for (let i = 0; i < visible.length; i++) {
      const target = visible[i]!;
      const anim = this.animatedCandles[i]!;
      anim.open += (target.open - anim.open) * this.lerpSpeed;
      anim.high += (target.high - anim.high) * this.lerpSpeed;
      anim.low += (target.low - anim.low) * this.lerpSpeed;
      anim.close += (target.close - anim.close) * this.lerpSpeed;
      anim.volume += (target.volume - anim.volume) * this.lerpSpeed;
    }

    // Price range
    let minP = Infinity, maxP = -Infinity, maxVol = 0;
    for (const c of this.animatedCandles) {
      minP = Math.min(minP, c.low);
      maxP = Math.max(maxP, c.high);
      maxVol = Math.max(maxVol, c.volume);
    }
    const range = maxP - minP || 1;
    const priceToY = (p: number) => y0 + ch - ((p - minP) / range) * ch;

    // Grid lines
    this.drawGrid(ctx, x0, y0, cw, ch, minP, maxP, x0 + cw + 5);

    // Candles
    const candleW = Math.max(3, (cw / maxCandles) - 2);
    const gap = cw / maxCandles;

    for (let i = 0; i < this.animatedCandles.length; i++) {
      const c = this.animatedCandles[i]!;
      const cx = x0 + i * gap + gap / 2;
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
      ctx.fillRect(cx - candleW / 2, bodyTop, candleW, bodyH);

      // Volume bar
      const volH = maxVol > 0 ? (c.volume / maxVol) * volumeH : 0;
      const volY = totalH - 4 - volH;
      ctx.fillStyle = isBull ? COLORS.volumeHigh : COLORS.volume;
      ctx.fillRect(cx - candleW / 2, volY, candleW, volH);
    }
  }

  private renderLine(
    ctx: CanvasRenderingContext2D, stock: Stock,
    x0: number, y0: number, cw: number, ch: number,
    volumeH: number, _totalW: number, totalH: number,
  ): void {
    const history = stock.history;
    const maxPoints = Math.min(history.length, 100);
    const visible = history.slice(-maxPoints);

    // Animate
    while (this.animatedPrices.length < visible.length) {
      this.animatedPrices.push(visible[this.animatedPrices.length]!);
    }
    this.animatedPrices = this.animatedPrices.slice(-maxPoints);
    for (let i = 0; i < visible.length; i++) {
      this.animatedPrices[i] = this.animatedPrices[i]! + (visible[i]! - this.animatedPrices[i]!) * this.lerpSpeed;
    }

    let minP = Infinity, maxP = -Infinity;
    for (const p of this.animatedPrices) {
      minP = Math.min(minP, p);
      maxP = Math.max(maxP, p);
    }
    const range = maxP - minP || 1;
    const priceToY = (p: number) => y0 + ch - ((p - minP) / range) * ch;
    const gap = cw / Math.max(1, this.animatedPrices.length - 1);

    this.drawGrid(ctx, x0, y0, cw, ch, minP, maxP, x0 + cw + 5);

    // Fill under line
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ch);
    for (let i = 0; i < this.animatedPrices.length; i++) {
      ctx.lineTo(x0 + i * gap, priceToY(this.animatedPrices[i]!));
    }
    ctx.lineTo(x0 + (this.animatedPrices.length - 1) * gap, y0 + ch);
    ctx.closePath();
    ctx.fillStyle = COLORS.lineFill;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < this.animatedPrices.length; i++) {
      const px = x0 + i * gap;
      const py = priceToY(this.animatedPrices[i]!);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Volume from candles
    const candles = [...stock.candles, stock.currentCandle];
    const visCandles = candles.slice(-30);
    let maxVol = 0;
    for (const c of visCandles) maxVol = Math.max(maxVol, c.volume);
    const vGap = cw / Math.max(1, visCandles.length);
    for (let i = 0; i < visCandles.length; i++) {
      const c = visCandles[i]!;
      const volH = maxVol > 0 ? (c.volume / maxVol) * volumeH : 0;
      ctx.fillStyle = c.close >= c.open ? COLORS.volumeHigh : COLORS.volume;
      ctx.fillRect(x0 + i * vGap, totalH - 4 - volH, Math.max(2, vGap - 2), volH);
    }
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    x0: number, y0: number, cw: number, ch: number,
    minP: number, maxP: number, labelX: number,
  ): void {
    const gridLines = 5;
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
