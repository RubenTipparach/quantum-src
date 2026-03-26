import type { ConsoleEntry } from '../game/programming/Sandbox';

export class ConsoleOutput {
  private el: HTMLDivElement;

  constructor(el: HTMLDivElement) {
    this.el = el;
    this.appendSystem('QuantumSrc v0.1 — Write programs to trade on the stock market.');
    this.appendSystem('Use the editor on the right. Click RUN or press Ctrl+Enter.');
    this.appendSystem('API: game.getMoney(), game.getStocks(), game.buy("SYM", qty), game.sell("SYM", qty)');
  }

  append(entry: ConsoleEntry): void {
    const line = document.createElement('div');
    line.className = entry.type;
    line.textContent = entry.text;
    this.el.appendChild(line);
    this.el.scrollTop = this.el.scrollHeight;
  }

  appendLog(text: string): void {
    this.append({ type: 'log', text });
  }

  appendError(text: string): void {
    this.append({ type: 'error', text });
  }

  appendSystem(text: string): void {
    this.append({ type: 'system', text });
  }

  appendResult(text: string): void {
    this.append({ type: 'result', text });
  }

  appendEntries(entries: ConsoleEntry[]): void {
    for (const entry of entries) {
      this.append(entry);
    }
  }

  clear(): void {
    this.el.innerHTML = '';
  }
}
