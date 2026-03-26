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

const SAVE_KEY = 'quantumsrc_editor_code';

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
  onStep: (stepIndex: number, lineNumber: number) => void;
  onDone: () => void;
  onAborted: () => void;
}

export class CodeEditor {
  private view: EditorView;
  private running = false;
  private animationTimer: ReturnType<typeof setTimeout> | null = null;
  /** Line count of the code that's currently being animated */
  private snapshotLineCount = 0;

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

    const savedCode = localStorage.getItem(SAVE_KEY);
    const initialCode = savedCode ?? STARTER_CODE;

    this.view = new EditorView({
      state: EditorState.create({
        doc: initialCode,
        extensions: [
          basicSetup,
          javascript(),
          oneDark,
          runKeymap,
          executingLineField,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              localStorage.setItem(SAVE_KEY, update.state.doc.toString());
            }
          }),
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

  replayTrace(trace: number[], speed: number, callbacks: TraceStepCallback): void {
    // If already running, abort the current run first
    if (this.running) {
      this.abort();
    }
    this.running = true;
    this.snapshotLineCount = this.view.state.doc.lines;

    let stepIndex = 0;

    const step = () => {
      if (!this.running) {
        // Was aborted
        this.clearHighlightSafe();
        callbacks.onAborted();
        return;
      }

      if (stepIndex >= trace.length) {
        this.clearHighlightSafe();
        this.running = false;
        callbacks.onDone();
        return;
      }

      const lineNum = trace[stepIndex]!;

      // Only highlight if the line still exists in the editor
      // (user may have edited the code shorter during execution)
      const doc = this.view.state.doc;
      if (lineNum >= 1 && lineNum <= doc.lines) {
        this.view.dispatch({
          effects: setExecutingLine.of(lineNum),
        });
        this.view.dispatch({
          effects: EditorView.scrollIntoView(doc.line(lineNum).from, { y: 'center' }),
        });
      }

      callbacks.onStep(stepIndex, lineNum);

      stepIndex++;
      this.animationTimer = setTimeout(step, speed);
    };

    step();
  }

  /** Stop the current animation. Does not clear the running flag — onAborted callback handles that. */
  abort(): void {
    if (this.animationTimer !== null) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
    this.running = false;
    this.clearHighlightSafe();
  }

  private clearHighlightSafe(): void {
    try {
      this.view.dispatch({
        effects: setExecutingLine.of(null),
      });
    } catch {
      // Editor state might have changed — ignore
    }
  }
}
