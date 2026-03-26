import { EditorView, keymap, Decoration, type DecorationSet } from '@codemirror/view';
import { EditorState, StateField, StateEffect } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';

const STARTER_CODE = `// Write trading programs here!
// API: game.getMoney(), game.getStocks(), game.buy("SYM", qty), game.sell("SYM", qty)

let stocks = JSON.parse(game.getStocks());
print("Current market:");
for (let s of stocks) {
  print("  " + s.symbol + ": $" + s.price);
}

print("Cash: $" + game.getMoney());
`;

const setExecutingLine = StateEffect.define<number | null>();

const executingLineDeco = Decoration.line({ class: 'cm-executing-line' });

const executingLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setExecutingLine)) {
        if (effect.value === null) {
          return Decoration.none;
        }
        const lineNo = effect.value;
        const doc = tr.state.doc;
        if (lineNo >= 1 && lineNo <= doc.lines) {
          const line = doc.line(lineNo);
          return Decoration.set([executingLineDeco.range(line.from)]);
        }
        return Decoration.none;
      }
    }
    return decos;
  },
  provide: f => EditorView.decorations.from(f),
});

export interface TraceStepCallback {
  /** Called for each step in the execution trace */
  onStep: (stepIndex: number, lineNumber: number) => void;
  /** Called when the trace replay is complete */
  onDone: () => void;
}

export class CodeEditor {
  private view: EditorView;
  private running = false;
  private animationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement, onRun: (code: string) => void) {
    const runKeymap = keymap.of([{
      key: 'Ctrl-Enter',
      run: () => {
        onRun(this.getCode());
        return true;
      },
    }, {
      key: 'Cmd-Enter',
      run: () => {
        onRun(this.getCode());
        return true;
      },
    }]);

    this.view = new EditorView({
      state: EditorState.create({
        doc: STARTER_CODE,
        extensions: [
          basicSetup,
          javascript(),
          oneDark,
          runKeymap,
          executingLineField,
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto' },
            '.cm-executing-line': {
              backgroundColor: 'rgba(0, 255, 136, 0.12)',
              borderLeft: '3px solid #00ff88',
              marginLeft: '-3px',
            },
          }),
        ],
      }),
      parent: container,
    });
  }

  getCode(): string {
    return this.view.state.doc.toString();
  }

  getLines(): string[] {
    const doc = this.view.state.doc;
    const lines: string[] = [];
    for (let i = 1; i <= doc.lines; i++) {
      lines.push(doc.line(i).text);
    }
    return lines;
  }

  setCode(code: string): void {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: code },
    });
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Replay an execution trace — the highlight jumps to each line
   * in the exact order they actually executed (loops repeat, etc).
   */
  replayTrace(trace: number[], speed: number, callbacks: TraceStepCallback): void {
    if (this.running) return;
    this.running = true;

    let stepIndex = 0;

    const step = () => {
      if (stepIndex >= trace.length) {
        this.clearHighlight();
        this.running = false;
        callbacks.onDone();
        return;
      }

      const lineNum = trace[stepIndex]!;

      // Highlight the line
      this.view.dispatch({
        effects: setExecutingLine.of(lineNum),
      });

      // Scroll into view
      const doc = this.view.state.doc;
      if (lineNum >= 1 && lineNum <= doc.lines) {
        const line = doc.line(lineNum);
        this.view.dispatch({
          effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
        });
      }

      callbacks.onStep(stepIndex, lineNum);

      stepIndex++;
      this.animationTimer = setTimeout(step, speed);
    };

    step();
  }

  clearHighlight(): void {
    this.view.dispatch({
      effects: setExecutingLine.of(null),
    });
    if (this.animationTimer !== null) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
    this.running = false;
  }
}
