import { GameEngine } from './engine/GameEngine';
import { GameState } from './game/GameState';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

const gameState = new GameState();
const engine = new GameEngine(canvas, gameState);

engine.start();
