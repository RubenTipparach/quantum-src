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

const SCRIPTS_KEY = 'quantumsrc_scripts';

interface ScriptFile {
  id: string;
  name: string;
  code: string;
  updatedAt: number;
}

function loadScripts(): ScriptFile[] {
  try {
    const raw = localStorage.getItem(SCRIPTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // Migrate from old single-file save
  const oldCode = localStorage.getItem('quantumsrc_editor_code');
  const scripts: ScriptFile[] = [{
    id: 'script_1',
    name: 'program.js',
    code: oldCode ?? STARTER_CODE,
    updatedAt: Date.now(),
  }];
  saveScripts(scripts);
  return scripts;
}

function saveScripts(scripts: ScriptFile[]): void {
  try { localStorage.setItem(SCRIPTS_KEY, JSON.stringify(scripts)); } catch { /* ignore */ }
}

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
  private snapshotLineCount = 0;
  private scripts: ScriptFile[];
  private activeScriptId: string;
  private onTabsChanged: (() => void) | null = null;

  constructor(container: HTMLElement, onRun: (code: string) => void) {
    this.scripts = loadScripts();
    this.activeScriptId = this.scripts[0]!.id;

    const runKeymap = keymap.of([{
      key: 'Ctrl-Enter',
      run: () => { onRun(this.getCode()); return true; },
    }, {
      key: 'Cmd-Enter',
      run: () => { onRun(this.getCode()); return true; },
    }]);

    const initialCode = this.scripts[0]!.code;

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
              const script = this.scripts.find(s => s.id === this.activeScriptId);
              if (script) {
                script.code = update.state.doc.toString();
                script.updatedAt = Date.now();
                saveScripts(this.scripts);
              }
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

  setOnTabsChanged(fn: () => void): void { this.onTabsChanged = fn; }

  getScripts(): ScriptFile[] { return this.scripts; }
  getActiveScriptId(): string { return this.activeScriptId; }

  switchTo(scriptId: string): void {
    // Save current code first
    const current = this.scripts.find(s => s.id === this.activeScriptId);
    if (current) { current.code = this.getCode(); current.updatedAt = Date.now(); }

    const target = this.scripts.find(s => s.id === scriptId);
    if (!target) return;
    this.activeScriptId = target.id;
    this.setCode(target.code);
    saveScripts(this.scripts);
    this.onTabsChanged?.();
  }

  newScript(name?: string): ScriptFile {
    const id = 'script_' + Date.now();
    const script: ScriptFile = {
      id,
      name: name ?? `script_${this.scripts.length + 1}.js`,
      code: '// New script\n',
      updatedAt: Date.now(),
    };
    this.scripts.push(script);
    saveScripts(this.scripts);
    this.switchTo(id);
    return script;
  }

  renameScript(scriptId: string, newName: string): void {
    const script = this.scripts.find(s => s.id === scriptId);
    if (script) {
      script.name = newName;
      saveScripts(this.scripts);
      this.onTabsChanged?.();
    }
  }

  deleteScript(scriptId: string): boolean {
    if (this.scripts.length <= 1) return false;
    const idx = this.scripts.findIndex(s => s.id === scriptId);
    if (idx < 0) return false;
    this.scripts.splice(idx, 1);
    if (this.activeScriptId === scriptId) {
      this.switchTo(this.scripts[0]!.id);
    }
    saveScripts(this.scripts);
    this.onTabsChanged?.();
    return true;
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
