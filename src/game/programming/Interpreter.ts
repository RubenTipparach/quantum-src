import type { GameState } from '../GameState';

/**
 * Simple command interpreter for the in-game console.
 * This will evolve into the full custom language as the game progresses.
 * For now it supports basic commands to interact with game systems.
 */
export class ProgramInterpreter {
  private state: GameState;
  private portfolio: Map<string, number> = new Map(); // symbol -> shares owned

  constructor(state: GameState) {
    this.state = state;
  }

  execute(input: string): string {
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    switch (cmd) {
      case 'help':
        return this.help();
      case 'status':
        return this.status();
      case 'stocks':
      case 'market':
        return this.state.stockMarket.getQuotes();
      case 'buy':
        return this.buy(parts[1], Number(parts[2]));
      case 'sell':
        return this.sell(parts[1], Number(parts[2]));
      case 'portfolio':
        return this.showPortfolio();
      case 'mine':
        return this.mine(parts[1]);
      case 'research':
        return this.research(parts[1]);
      case 'tree':
        return this.showResearchTree();
      case 'advance':
        return this.advance(Number(parts[1]) || 1);
      default:
        return `Unknown command: ${cmd}. Type 'help' for available commands.`;
    }
  }

  private help(): string {
    return [
      'Commands:',
      '  help              - Show this help',
      '  status            - Show current game state',
      '  stocks            - Show stock market quotes',
      '  buy <SYM> <QTY>   - Buy shares',
      '  sell <SYM> <QTY>  - Sell shares',
      '  portfolio         - Show your holdings',
      '  mine start|stop   - Start/stop crypto mining',
      '  research <id>     - Research a technology',
      '  tree              - Show research tree',
      '  advance [years]   - Advance time',
    ].join('\n');
  }

  private status(): string {
    const s = this.state;
    return `Year: ${s.year} | Money: $${s.money.toLocaleString()} | Energy: ${s.energy}/${s.totalEnergyCapacity} kWh | Compute: ${s.getComputeLabel()} | Era: ${s.getEraName()}`;
  }

  private buy(symbol: string | undefined, qty: number): string {
    if (!symbol || isNaN(qty) || qty <= 0) return 'Usage: buy <SYMBOL> <QUANTITY>';
    const stock = this.state.stockMarket.getStock(symbol.toUpperCase());
    if (!stock) return `Unknown stock: ${symbol}`;
    const cost = stock.price * qty;
    if (cost > this.state.money) return `Not enough money. Need $${cost.toFixed(2)}, have $${this.state.money.toFixed(2)}`;
    this.state.money -= cost;
    const current = this.portfolio.get(stock.symbol) ?? 0;
    this.portfolio.set(stock.symbol, current + qty);
    return `Bought ${qty} ${stock.symbol} @ $${stock.price.toFixed(2)} = $${cost.toFixed(2)}`;
  }

  private sell(symbol: string | undefined, qty: number): string {
    if (!symbol || isNaN(qty) || qty <= 0) return 'Usage: sell <SYMBOL> <QUANTITY>';
    const sym = symbol.toUpperCase();
    const owned = this.portfolio.get(sym) ?? 0;
    if (owned < qty) return `You only own ${owned} shares of ${sym}`;
    const stock = this.state.stockMarket.getStock(sym);
    if (!stock) return `Unknown stock: ${sym}`;
    const revenue = stock.price * qty;
    this.state.money += revenue;
    this.portfolio.set(sym, owned - qty);
    return `Sold ${qty} ${sym} @ $${stock.price.toFixed(2)} = $${revenue.toFixed(2)}`;
  }

  private showPortfolio(): string {
    if (this.portfolio.size === 0) return 'Portfolio is empty.';
    const lines: string[] = ['Your Portfolio:'];
    let totalValue = 0;
    for (const [sym, qty] of this.portfolio) {
      if (qty <= 0) continue;
      const stock = this.state.stockMarket.getStock(sym);
      const value = stock ? stock.price * qty : 0;
      totalValue += value;
      lines.push(`  ${sym}: ${qty} shares ($${value.toFixed(2)})`);
    }
    lines.push(`  Total value: $${totalValue.toFixed(2)}`);
    return lines.join('\n');
  }

  private mine(action: string | undefined): string {
    if (action === 'start') return this.state.cryptoMiner.startMining();
    if (action === 'stop') return this.state.cryptoMiner.stopMining();
    return 'Usage: mine start|stop';
  }

  private research(id: string | undefined): string {
    if (!id) return 'Usage: research <id>. Type "tree" to see available research.';
    const node = this.state.researchTree.find(n => n.id === id);
    if (!node) return `Unknown research: ${id}`;
    if (node.researched) return `${node.name} is already researched.`;
    if (!node.unlocked) {
      const missing = node.prerequisites.filter(
        p => !this.state.researchTree.find(n => n.id === p)?.researched
      );
      return `Prerequisites not met: ${missing.join(', ')}`;
    }
    if (this.state.money < node.cost) {
      return `Not enough money. Need $${node.cost.toLocaleString()}, have $${this.state.money.toLocaleString()}`;
    }
    this.state.money -= node.cost;
    node.researched = true;

    // Unlock dependent research
    for (const other of this.state.researchTree) {
      if (!other.unlocked && other.prerequisites.every(
        p => this.state.researchTree.find(n => n.id === p)?.researched
      )) {
        other.unlocked = true;
      }
    }

    return `Researched: ${node.name}! ${node.description}`;
  }

  private showResearchTree(): string {
    const lines: string[] = ['Research Tree:'];
    for (const node of this.state.researchTree) {
      const status = node.researched ? '[DONE]' : node.unlocked ? `[$${node.cost.toLocaleString()}]` : '[LOCKED]';
      lines.push(`  ${status} ${node.name} (${node.id})`);
    }
    return lines.join('\n');
  }

  private advance(years: number): string {
    this.state.advanceYear(years);
    return `Advanced ${years} year(s). Now year ${this.state.year}. Era: ${this.state.getEraName()}`;
  }
}
