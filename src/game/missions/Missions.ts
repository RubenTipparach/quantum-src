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
}

export function createMissions(): Mission[] {
  return [
    // === DAWN ERA: Learning the basics ===
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
      completed: false,
      validate: (outputs) => outputs.some(o => o.includes('Hello World')),
    },
    {
      id: 'read_market',
      name: 'Market Reader',
      description: 'Print the price of every stock on the market.',
      era: 'dawn',
      hint: 'Use game.getStocks() to get stock data, then loop and print each price.',
      starterCode: '// Get all stocks and print each symbol with its price\n',
      researchCredits: 2,
      moneyReward: 200,
      prerequisites: ['hello_world'],
      completed: false,
      validate: (outputs) => {
        // Must print at least 5 lines containing a $ sign (one per stock)
        const priceLines = outputs.filter(o => o.includes('$'));
        return priceLines.length >= 5;
      },
    },
    {
      id: 'find_cheapest',
      name: 'Bargain Hunter',
      description: 'Find and print the symbol of the cheapest stock.',
      era: 'dawn',
      hint: 'Loop through stocks, track the one with the lowest price.',
      starterCode: '// Find the cheapest stock and print its symbol\nlet stocks = JSON.parse(game.getStocks());\n',
      researchCredits: 3,
      moneyReward: 300,
      prerequisites: ['read_market'],
      completed: false,
      validate: (outputs, _gs) => {
        // Output must contain a stock symbol (all caps, 4 chars)
        return outputs.some(o => /^[A-Z]{4}$/.test(o.trim()));
      },
    },
    {
      id: 'first_buy',
      name: 'First Trade',
      description: 'Buy at least 1 share of any stock using game.buy().',
      era: 'dawn',
      hint: 'Use game.buy("CPUX", 1) to buy a share.',
      starterCode: '// Buy your first share\n',
      researchCredits: 2,
      moneyReward: 0,
      prerequisites: ['hello_world'],
      completed: false,
      validate: (outputs) => outputs.some(o => o.includes('Bought')),
    },
    {
      id: 'buy_sell',
      name: 'Round Trip',
      description: 'Buy a stock and then sell it in the same program.',
      era: 'dawn',
      hint: 'Call game.buy() then game.sell() for the same symbol.',
      starterCode: '// Buy and sell a stock\n',
      researchCredits: 3,
      moneyReward: 500,
      prerequisites: ['first_buy'],
      completed: false,
      validate: (outputs) => {
        const hasBuy = outputs.some(o => o.includes('Bought'));
        const hasSell = outputs.some(o => o.includes('Sold'));
        return hasBuy && hasSell;
      },
    },
    {
      id: 'sum_market',
      name: 'Market Cap',
      description: 'Calculate and print the total value of all stocks (sum of all prices).',
      era: 'dawn',
      hint: 'Loop through stocks, sum their prices, print the total.',
      starterCode: '// Calculate and print the sum of all stock prices\nlet stocks = JSON.parse(game.getStocks());\n',
      researchCredits: 3,
      moneyReward: 400,
      prerequisites: ['read_market'],
      completed: false,
      validate: (outputs) => {
        // Must print a number > 0
        return outputs.some(o => {
          const n = parseFloat(o.replace(/[$,]/g, ''));
          return !isNaN(n) && n > 10;
        });
      },
    },
    {
      id: 'sort_stocks',
      name: 'Stock Sorter',
      description: 'Print all stock symbols sorted by price, cheapest first.',
      era: 'dawn',
      hint: 'Use Array.sort() to sort by price, then print each symbol.',
      starterCode: '// Sort stocks by price (ascending) and print symbols\nlet stocks = JSON.parse(game.getStocks());\n',
      researchCredits: 5,
      moneyReward: 600,
      prerequisites: ['find_cheapest', 'sum_market'],
      completed: false,
      validate: (outputs) => {
        // Must have at least 5 outputs that are stock symbols
        const syms = outputs.filter(o => /^[A-Z]{4}$/.test(o.trim()));
        return syms.length >= 5;
      },
    },

    // === DAWN ERA: Advanced ===
    {
      id: 'buy_cheapest',
      name: 'Value Investor',
      description: 'Write a program that finds the cheapest stock and buys 10 shares of it.',
      era: 'dawn',
      hint: 'Combine finding the cheapest with game.buy().',
      starterCode: '// Find the cheapest stock and buy 10 shares\nlet stocks = JSON.parse(game.getStocks());\n',
      researchCredits: 5,
      moneyReward: 800,
      prerequisites: ['find_cheapest', 'first_buy'],
      completed: false,
      validate: (outputs) => outputs.some(o => o.includes('Bought') && o.includes('10')),
    },
    {
      id: 'portfolio_value',
      name: 'Portfolio Analyzer',
      description: 'Print the total $ value of your portfolio (shares * current prices).',
      era: 'dawn',
      hint: 'Use game.getPortfolio() and game.getStocks() to calculate total value.',
      starterCode: '// Calculate and print your total portfolio value\nlet portfolio = JSON.parse(game.getPortfolio());\nlet stocks = JSON.parse(game.getStocks());\n',
      researchCredits: 5,
      moneyReward: 1000,
      prerequisites: ['buy_sell', 'sum_market'],
      completed: false,
      validate: (outputs) => {
        return outputs.some(o => {
          const n = parseFloat(o.replace(/[$,]/g, ''));
          return !isNaN(n) && n >= 0;
        });
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
      completed: false,
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
      starterCode: '// For each stock, print SYMBOL: ABOVE or SYMBOL: BELOW based on $15 threshold\nlet stocks = JSON.parse(game.getStocks());\n',
      researchCredits: 6,
      moneyReward: 3000,
      prerequisites: ['sort_stocks'],
      completed: false,
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
      starterCode: '// Buy cheap stocks, sell expensive ones\nlet stocks = JSON.parse(game.getStocks());\n',
      researchCredits: 8,
      moneyReward: 8000,
      prerequisites: ['buy_cheapest', 'moving_average'],
      completed: false,
      validate: (outputs) => {
        const hasBuy = outputs.some(o => o.includes('Bought'));
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
      completed: false,
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
      completed: false,
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
      completed: false,
      validate: (outputs) => {
        return outputs.some(o => o.trim() === 'TXDQWXP');
      },
    },
  ];
}
