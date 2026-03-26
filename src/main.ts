import { GameEngine } from './engine/GameEngine';
import { GameState } from './game/GameState';

async function main() {
  try {
    const gameState = new GameState();
    const engine = new GameEngine(gameState);
    await engine.init();
    engine.start();
  } catch (err) {
    console.error('Failed to initialize QuantumSrc:', err);
    document.body.innerHTML = `<pre style="color:red;padding:20px;">Failed to initialize: ${err}</pre>`;
  }
}

main();
