export interface Mission {
  id: string;
  name: string;
  description: string;
  era: string;
  /** Hint shown in the mission panel */
  hint: string;
  /** Starter code loaded into editor when mission is selected */
  starterCode: string;
  /** Research credits awarded on completion */
  researchCredits: number;
  /** Money bonus on completion */
  moneyReward: number;
  /** IDs of missions that must be completed first */
  prerequisites: string[];
  completed: boolean;
  /** Mission objective validated — waiting for player to click Collect */
  readyToCollect: boolean;
  /** Research node ID that must be researched before this mission is available */
  requiredResearch?: string;
  /** Minimum in-game year before this mission is available */
  minYear?: number;
  /** Money the player must spend to collect this mission */
  collectCost?: number;
  /** Player-saved code snippet for this mission */
  savedCode?: string;
  /**
   * Validate the program output. Receives the array of console log texts
   * and the game state. Return true if the mission is satisfied.
   */
  validate: (outputs: string[], gameState: MissionGameRef) => boolean;
}

export interface MissionGameRef {
  money: number;
  year: number;
  portfolio: Map<string, number>;
  stockSymbols: string[];
  /** Stock prices snapshotted at execution time (symbol → price) */
  stockPrices: Record<string, number>;
}

export function createMissions(): Mission[] {
  return [
    // === DAWN OF COMPUTING: Learning the basics ===
    {
      id: 'hello_world',
      name: 'Hello World',
      description: 'Print "Hello World" to the console.',
      era: 'dawn',
      hint: 'Use print("Hello World")',
      starterCode: '// Print "Hello World"\n',
      researchCredits: 1,
      moneyReward: 100,
      prerequisites: [],
      completed: false, readyToCollect: false,
      validate: (outputs) => outputs.some(o => o.includes('Hello World')),
    },
    {
      id: 'first_buy',
      name: 'First Trade',
      description: 'Buy at least 1 share of any stock using market.buy().',
      era: 'dawn',
      hint: 'Use market.buy("CPUX", 1) to buy a share.',
      starterCode: '// Buy your first share\n',
      researchCredits: 2,
      moneyReward: 0,
      prerequisites: ['hello_world'],
      completed: false, readyToCollect: false,
      validate: (outputs) => outputs.some(o => o.includes('Acquired')),
    },
    {
      id: 'buy_sell',
      name: 'Round Trip',
      description: 'Buy a stock and then sell it in the same program.',
      era: 'dawn',
      hint: 'Call market.buy() then market.sell() for the same symbol.',
      starterCode: '// Buy and sell a stock\n',
      researchCredits: 3,
      moneyReward: 500,
      prerequisites: ['first_buy'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const hasBuy = outputs.some(o => o.includes('Acquired'));
        const hasSell = outputs.some(o => o.includes('Sold'));
        return hasBuy && hasSell;
      },
    },

    // === MARKET: Trading & Market Manipulation ===
    {
      id: 'read_market',
      name: 'Market Reader',
      description: 'Print the price of every stock on the market.',
      era: 'market',
      hint: 'Use market.scan() to get stock data, then loop and print each price.',
      starterCode: '// Get all stocks and print each symbol with its price\n',
      researchCredits: 2,
      moneyReward: 200,
      prerequisites: ['hello_world'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const priceLines = outputs.filter(o => o.includes('$'));
        return priceLines.length >= 5;
      },
    },
    {
      id: 'find_cheapest',
      name: 'Bargain Hunter',
      description: 'Find and print the symbol of the cheapest stock.',
      era: 'market',
      hint: 'Loop through stocks, track the one with the lowest price.',
      starterCode: '// Find the cheapest stock and print its symbol\nlet stocks = market.scan()\n',
      researchCredits: 3,
      moneyReward: 300,
      prerequisites: ['read_market'],
      completed: false, readyToCollect: false,
      validate: (outputs, gs) => {
        // Find cheapest symbol from snapshot
        let cheapest = '';
        let cheapestPrice = Infinity;
        for (const [sym, price] of Object.entries(gs.stockPrices)) {
          if (price < cheapestPrice) { cheapestPrice = price; cheapest = sym; }
        }
        return outputs.some(o => o.trim() === cheapest);
      },
    },
    {
      id: 'sum_market',
      name: 'Market Cap',
      description: 'Calculate and print the total value of all stocks (sum of all prices).',
      era: 'market',
      hint: 'Loop through stocks, sum their prices, print the total.',
      starterCode: '// Calculate and print the sum of all stock prices\nlet stocks = market.scan();\n',
      researchCredits: 3,
      moneyReward: 400,
      prerequisites: ['read_market'],
      completed: false, readyToCollect: false,
      validate: (outputs, gs) => {
        const expectedSum = Object.values(gs.stockPrices).reduce((a, b) => a + b, 0);
        return outputs.some(o => {
          const n = parseFloat(o.replace(/[$,]/g, ''));
          if (isNaN(n) || n <= 0) return false;
          // Allow ±5% tolerance since prices may tick between scan and print
          return Math.abs(n - expectedSum) / expectedSum < 0.05;
        });
      },
    },
    {
      id: 'sort_stocks',
      name: 'Stock Sorter',
      description: 'Print all stock symbols sorted by price, cheapest first.',
      era: 'market',
      hint: 'Use Array.sort() to sort by price, then print each symbol.',
      starterCode: '// Sort stocks by price (ascending) and print symbols\nlet stocks = market.scan();\n',
      researchCredits: 5,
      moneyReward: 600,
      prerequisites: ['find_cheapest', 'sum_market'],
      completed: false, readyToCollect: false,
      validate: (outputs, gs) => {
        // Build expected sorted order from snapshot
        const sorted = Object.entries(gs.stockPrices)
          .sort((a, b) => a[1] - b[1])
          .map(([sym]) => sym);
        const printed = outputs.filter(o => /^[A-Z]{4}$/.test(o.trim())).map(o => o.trim());
        if (printed.length < 5) return false;
        // Verify the first N printed symbols match sorted order
        for (let i = 0; i < printed.length; i++) {
          if (printed[i] !== sorted[i]) return false;
        }
        return true;
      },
    },
    {
      id: 'buy_cheapest',
      name: 'Value Investor',
      description: 'Write a program that finds the cheapest stock and buys 10 shares of it.',
      era: 'market',
      hint: 'Combine finding the cheapest with market.buy().',
      starterCode: '// Find the cheapest stock and buy 10 shares\nlet stocks = market.scan();\n',
      researchCredits: 5,
      moneyReward: 800,
      prerequisites: ['find_cheapest', 'first_buy'],
      completed: false, readyToCollect: false,
      validate: (outputs, gs) => {
        // Find cheapest symbol from snapshot
        let cheapest = '';
        let cheapestPrice = Infinity;
        for (const [sym, price] of Object.entries(gs.stockPrices)) {
          if (price < cheapestPrice) { cheapestPrice = price; cheapest = sym; }
        }
        return outputs.some(o => o.includes('Acquired') && o.includes('10') && o.includes(cheapest));
      },
    },
    {
      id: 'portfolio_value',
      name: 'Portfolio Analyzer',
      description: 'Print the total $ value of your portfolio (shares * current prices).',
      era: 'market',
      hint: 'Use market.holdings() and market.scan() to calculate total value.',
      starterCode: '// Calculate and print your total portfolio value\nlet portfolio = market.holdings()\nlet stocks = market.scan()\n',
      researchCredits: 5,
      moneyReward: 1000,
      prerequisites: ['buy_sell', 'sum_market'],
      completed: false, readyToCollect: false,
      validate: (outputs, gs) => {
        // Calculate expected portfolio value from snapshot prices
        let expectedValue = 0;
        for (const [sym, qty] of gs.portfolio) {
          const price = gs.stockPrices[sym] ?? 0;
          expectedValue += price * qty;
        }
        return outputs.some(o => {
          const n = parseFloat(o.replace(/[$,]/g, ''));
          if (isNaN(n)) return false;
          // Empty portfolio: accept 0
          if (expectedValue === 0) return n === 0;
          // Allow ±5% tolerance
          return Math.abs(n - expectedValue) / expectedValue < 0.05;
        });
      },
    },
    {
      id: 'news_trader',
      name: 'News Trader',
      description: 'Read the news feed and buy 5 shares of any stock with an active bullish event.',
      era: 'market',
      hint: 'Use market.feed() to find active events with impact > 0. Check stockImpacts for tickers, then market.buy().',
      starterCode: '// Find bullish news and ride the wave\nlet news = market.feed()\nlet stocks = market.scan()\n',
      researchCredits: 6,
      moneyReward: 2000,
      prerequisites: ['portfolio_value'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        return outputs.some(o => o.includes('Acquired') && o.includes('5'));
      },
    },
    {
      id: 'sector_sweep',
      name: 'Sector Sweep',
      description: 'Buy 3 shares of every stock in the same sector. Print the sector name first.',
      era: 'market',
      hint: 'Use market.scan() to group by sector. Pick one sector, print it, then buy 3 of each stock in it.',
      starterCode: '// Pick a sector and buy 3 shares of every stock in it\nlet stocks = market.scan()\n',
      researchCredits: 6,
      moneyReward: 3000,
      prerequisites: ['sort_stocks'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const buys = outputs.filter(o => o.includes('Acquired') && o.includes('3'));
        return buys.length >= 2; // At least 2 stocks in one sector
      },
    },
    {
      id: 'penny_flipper',
      name: 'Penny Flipper',
      description: 'Buy 20 shares of any stock under $5, and sell 20 shares of any stock over $25. Classic arbitrage.',
      era: 'market',
      hint: 'Scan for cheap and expensive stocks. Buy low, sell high — in the same program.',
      starterCode: '// Buy penny stocks, dump expensive ones\nlet stocks = market.scan()\n',
      researchCredits: 8,
      moneyReward: 5000,
      prerequisites: ['buy_cheapest'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const hasBuy = outputs.some(o => o.includes('Acquired') && /\b20\b/.test(o));
        const hasSell = outputs.some(o => o.includes('Sold') && /\b20\b/.test(o));
        return hasBuy && hasSell;
      },
    },
    {
      id: 'pump_dump',
      name: 'Pump & Dump',
      description: 'Buy 50 shares of the cheapest stock, print "PUMP", then sell all 50 and print "DUMP".',
      era: 'market',
      hint: 'Find the cheapest stock, buy 50, print PUMP, sell 50, print DUMP. The large trade triggers a news event.',
      starterCode: '// The classic pump and dump\nlet stocks = market.scan()\n',
      researchCredits: 10,
      moneyReward: 10000,
      prerequisites: ['penny_flipper'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const pumpIdx = outputs.findIndex(o => o.trim() === 'PUMP');
        const dumpIdx = outputs.findIndex(o => o.trim() === 'DUMP');
        const hasBuy50 = outputs.some(o => o.includes('Acquired') && /\b50\b/.test(o));
        const hasSell50 = outputs.some(o => o.includes('Sold') && /\b50\b/.test(o));
        return pumpIdx >= 0 && dumpIdx > pumpIdx && hasBuy50 && hasSell50;
      },
    },
    {
      id: 'market_crash',
      name: 'Market Crash',
      description: 'Mass liquidation: sell 100+ total shares across at least 3 different stocks. Print "CRASH" when done.',
      era: 'market',
      hint: 'You need to own shares first. Buy or already hold stock in 3+ tickers, then sell 100+ total shares.',
      starterCode: '// Crash the market — mass sell-off\nlet stocks = market.scan()\nlet h = market.holdings()\n',
      researchCredits: 12,
      moneyReward: 15000,
      prerequisites: ['pump_dump'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const sells = outputs.filter(o => o.includes('Sold'));
        const symbols = new Set<string>();
        let totalQty = 0;
        for (const s of sells) {
          const symMatch = s.match(/Sold (\d+) ([A-Z]{4})/);
          if (symMatch) {
            totalQty += parseInt(symMatch[1]!);
            symbols.add(symMatch[2]!);
          }
        }
        const hasCrash = outputs.some(o => o.trim() === 'CRASH');
        return symbols.size >= 3 && totalQty >= 100 && hasCrash;
      },
    },
    {
      id: 'insider_trading',
      name: 'Insider Trading',
      description: 'Read the news, find the stock with the worst active event (biggest negative impact), and buy 20 shares of it. Print "BUY THE DIP" first.',
      era: 'market',
      hint: 'Use market.feed() to find active bearish events (impact < 0). Find the stock with the largest negative stockImpact, print "BUY THE DIP", then buy 20.',
      starterCode: '// Buy the dip — insider knowledge\nlet news = market.feed()\nlet stocks = market.scan()\n',
      researchCredits: 15,
      moneyReward: 20000,
      prerequisites: ['news_trader', 'market_crash'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const hasDip = outputs.some(o => o.trim() === 'BUY THE DIP');
        const hasBuy20 = outputs.some(o => o.includes('Acquired') && /\b20\b/.test(o));
        return hasDip && hasBuy20;
      },
    },

    // === CRYPTO ERA ===
    {
      id: 'fibonacci',
      name: 'Fibonacci Sequence',
      description: 'Print the first 20 Fibonacci numbers, one per line.',
      era: 'crypto',
      hint: 'Start with 0, 1 and add the previous two to get the next.',
      starterCode: '// Print the first 20 Fibonacci numbers\n',
      researchCredits: 8,
      moneyReward: 5000,
      prerequisites: ['sort_stocks'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const expected = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181];
        if (outputs.length < 20) return false;
        for (let i = 0; i < 20; i++) {
          if (parseInt(outputs[i]!.trim()) !== expected[i]) return false;
        }
        return true;
      },
    },
    {
      id: 'moving_average',
      name: 'Moving Average',
      description: 'For each stock, print its symbol and whether its price is above or below $15.',
      era: 'crypto',
      hint: 'Loop stocks, check price > 15, print "SYMBOL: ABOVE" or "SYMBOL: BELOW".',
      starterCode: '// For each stock, print SYMBOL: ABOVE or SYMBOL: BELOW based on $15 threshold\nlet stocks = market.scan();\n',
      researchCredits: 6,
      moneyReward: 3000,
      prerequisites: ['sort_stocks'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const valid = outputs.filter(o => /^[A-Z]{4}: (ABOVE|BELOW)$/.test(o.trim()));
        return valid.length >= 5;
      },
    },
    {
      id: 'bull_bear',
      name: 'Bull or Bear',
      description: 'Buy 5 shares of every stock priced under $10, sell 5 shares of every stock over $30.',
      era: 'crypto',
      hint: 'Loop stocks, use if/else on price, call buy or sell accordingly.',
      starterCode: '// Buy cheap stocks, sell expensive ones\nlet stocks = market.scan();\n',
      researchCredits: 8,
      moneyReward: 8000,
      prerequisites: ['buy_cheapest', 'moving_average'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const hasBuy = outputs.some(o => o.includes('Acquired'));
        const hasSell = outputs.some(o => o.includes('Sold'));
        return hasBuy || hasSell; // At least one trade depending on prices
      },
    },
    {
      id: 'prime_numbers',
      name: 'Prime Finder',
      description: 'Print all prime numbers between 1 and 100.',
      era: 'crypto',
      hint: 'For each number, check if it is divisible by any number from 2 to its square root.',
      starterCode: '// Print all primes from 1 to 100\n',
      researchCredits: 10,
      moneyReward: 10000,
      prerequisites: ['fibonacci'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
        const printed = outputs.map(o => parseInt(o.trim())).filter(n => !isNaN(n));
        if (printed.length !== primes.length) return false;
        return primes.every((p, i) => printed[i] === p);
      },
    },

    // === QUANTUM ERA ===
    {
      id: 'binary_search',
      name: 'Binary Search',
      description: 'Given a sorted array [2,5,8,12,16,23,38,56,72,91], find 23 using binary search. Print each midpoint checked, then "FOUND" or "NOT FOUND".',
      era: 'quantum',
      hint: 'Implement binary search: track low/high, check mid, print mid each step.',
      starterCode: '// Binary search for 23 in this array\nlet arr = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91];\nlet target = 23;\n',
      researchCredits: 15,
      moneyReward: 50000,
      prerequisites: ['prime_numbers'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        return outputs.some(o => o.trim() === 'FOUND');
      },
    },
    {
      id: 'encryption_sim',
      name: 'Caesar Cipher',
      description: 'Encrypt the message "QUANTUM" using a Caesar cipher with shift 3. Print the result.',
      era: 'quantum',
      hint: 'Shift each letter by 3 positions in the alphabet. A→D, B→E, etc.',
      starterCode: '// Encrypt "QUANTUM" with Caesar cipher, shift 3\nlet message = "QUANTUM";\nlet shift = 3;\n',
      researchCredits: 15,
      moneyReward: 100000,
      prerequisites: ['binary_search'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        return outputs.some(o => o.trim() === 'TXDQWXP');
      },
    },
    // === SCIENTIFIC RESEARCH: SETI ===
    {
      id: 'seti_scan',
      name: 'SETI: Star Survey',
      description: 'Scan the stellar catalogue for anomalous signals from nearby stars.',
      era: 'science',
      hint: 'Use seti.catalogue() to get star data. Print stars with signal strength > 0.5.',
      starterCode: '// Scan the stellar catalogue for alien signals\nlet stars = seti.catalogue()\n',
      researchCredits: 8,
      moneyReward: 5000,
      prerequisites: ['sort_stocks'],
      requiredResearch: 'seti_program',
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        return outputs.some(o => o.includes('Epsilon Eridani'));
      },
    },
    {
      id: 'seti_transmit',
      name: 'SETI: Deep Space Array',
      description: 'Build a $1,000,000 deep space array and transmit a signal to Epsilon Eridani.',
      era: 'science',
      hint: 'Call seti.transmit("Epsilon Eridani"). Collecting this mission costs $1,000,000.',
      starterCode: '// Transmit a signal to the anomalous star\n// Collecting this mission will cost $1,000,000\n',
      researchCredits: 15,
      moneyReward: 0,
      collectCost: 1000000,
      prerequisites: ['seti_scan'],
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        return outputs.some(o => o.includes('Transmission sent'));
      },
    },
    {
      id: 'seti_decrypt',
      name: 'SETI: Alien Decryption',
      description: 'A reply from Epsilon Eridani has arrived! Decrypt the alien signal.',
      era: 'science',
      hint: 'Use seti.listen() to get the encrypted message. The hint mentions hydrogen (atomic mass 7). Try shifting each letter back by 7.',
      starterCode: '// The aliens have replied! Decrypt their message.\nlet reply = seti.listen()\nprint("Status: " + reply.status)\nprint("Encrypted: " + reply.encrypted)\n// Hint: Caesar cipher with shift from hydrogen atomic mass\n',
      researchCredits: 20,
      moneyReward: 100000,
      prerequisites: ['seti_transmit'],
      requiredResearch: 'gpu_compute',
      minYear: 2003,
      completed: false, readyToCollect: false,
      validate: (outputs) => {
        return outputs.some(o => o.includes('YOU ARE NOT ALONE'));
      },
    },
  ];
}
