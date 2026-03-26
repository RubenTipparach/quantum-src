import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
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

export class CodeEditor {
  private view: EditorView;

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
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto' },
          }),
        ],
      }),
      parent: container,
    });
  }

  getCode(): string {
    return this.view.state.doc.toString();
  }

  setCode(code: string): void {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: code },
    });
  }
}
