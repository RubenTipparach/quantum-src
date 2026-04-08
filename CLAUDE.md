# Quantum.src — Development Guidelines

## Execution Model — GAME DESIGN (not performance)

The player writes code that executes in a QuickJS sandbox. Execution happens instantly under the hood, then replays visually step-by-step in the editor.

**Critical rule: Visual replay MUST sync with data.**

- The market simulation is intrinsic and independent of code execution. The market ticks on its own clock via the game loop (`GameState.update(delta)`), NOT inside `__tick()`. The market does NOT advance because code runs — it advances because time passes. Code execution and market simulation are completely decoupled independent systems.
- When player code calls `market.scan()`, it reads the market state at that instant. During visual replay, the game loop continues running so the market naturally advances in real time alongside the replay.
- The visual step-by-step replay in the editor MUST play back each step one at a time. This is intentional game design — the player is watching their program "run" on their in-game computer. Never batch, skip, or compress steps.
- **Replay speed is ONLY governed by in-game hardware upgrades** (CPU clock speed, GPU cores, quantum, subatomic). This is a core game mechanic — buying better hardware makes your code run faster. Never adjust replay speed programmatically. The player earns faster execution through gameplay progression.
- Mission validation happens in `onDone` after the visual replay completes — not before. The player watches their code run, sees the results, THEN gets the mission ready notification.
- The step-by-step execution IS the game. Each line highlighting, each `print()` appearing in the console — this is what makes the player feel like they're programming a real computer in the game world.

## Mission System

- Missions validate after code replay finishes (`onDone`)
- Missions go through: available → readyToCollect → completed
- Player must click "Collect" to get rewards (no auto-complete)
- Some missions have a `collectCost` (money deducted on collect)
- Mission completion triggers news events that affect stock prices

## News Events

- Research completion, mission completion, and large player trades all trigger news events
- News events affect stock prices via `newsFeed.getImpact(symbol)`
- Events fade linearly over their duration
