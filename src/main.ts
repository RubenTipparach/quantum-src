import { GameEngine } from './engine/GameEngine';
import { GameState } from './game/GameState';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLDivElement;

const gameState = new GameState();
const engine = new GameEngine(canvas, hud, gameState);

engine.start();
