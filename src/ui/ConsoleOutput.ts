export interface ConsoleEntry {
  type: 'log' | 'error' | 'system' | 'result';
  text: string;
}

export class ConsoleOutput {
  private el: HTMLDivElement;

  constructor(el: HTMLDivElement) {
    this.el = el;
    this.appendSystem('QuantumSrc v0.1 — Write programs to trade on the stock market.');
    this.appendSystem('Use the code editor. Click RUN or press Ctrl+Enter.');
    this.appendLog('API: game.getMoney(), game.getStocks(), game.buy("SYM", qty), game.sell("SYM", qty)');
  }

  append(entry: ConsoleEntry): void {
    const line = document.createElement('div');
    line.className = entry.type;
    // Handle multi-line text
    if (entry.text.includes('\n')) {
      line.style.whiteSpace = 'pre';
    }
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

  appendEntries(entries: { type: string; text: string }[]): void {
    for (const entry of entries) {
      this.append(entry as ConsoleEntry);
    }
  }

  clear(): void {
    this.el.innerHTML = '';
  }
}
