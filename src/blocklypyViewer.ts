// import { Graphviz } from '@hpcc-js/wasm-graphviz';
import {
    convertProjectToPython,
    IPyConverterFile,
    IPyConverterOptions,
} from 'blocklypy';
import * as vscode from 'vscode';
import { logDebug, setContextCustomViewType } from './extension';
import { editor } from 'monaco-editor';

interface BlocklypyViewerContent {
    filename?: string;
    pycode?: string;
    pseudo?: string;
    preview?: string;
    graph?: string;
    // result
}

export enum ViewType {
    Preview = 'preview',
    Pseudo = 'pseudo',
    Pycode = 'pycode',
    Graph = 'graph',
    Loading = 'loading',
}

export class blocklypyViewerProvider implements vscode.CustomReadonlyEditorProvider {
    private static providers = new Map<string, blocklypyViewerProvider>();
    private static activeProvider?: blocklypyViewerProvider;

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new blocklypyViewerProvider(context);
        return vscode.window.registerCustomEditorProvider(
            'pybricks.blocklypyViewer',
            provider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            },
        );
    }

    public static getProviderForUri(
        uri: vscode.Uri,
    ): blocklypyViewerProvider | undefined {
        return blocklypyViewerProvider.providers.get(uri.toString());
    }

    public static get activeViewer(): blocklypyViewerProvider | undefined {
        return blocklypyViewerProvider.activeProvider;
    }

    constructor(private readonly context: vscode.ExtensionContext) {}
    private content: BlocklypyViewerContent = {};
    private uri?: vscode.Uri;
    private currentPanel?: vscode.WebviewPanel;

    async openCustomDocument(
        uri: vscode.Uri,
        openContext: { backupId?: string },
        _token: vscode.CancellationToken,
    ): Promise<vscode.CustomDocument> {
        this.uri = uri;
        blocklypyViewerProvider.providers.set(uri.toString(), this);
        return {
            uri,
            dispose: () => {
                blocklypyViewerProvider.providers.delete(uri.toString());
            },
        };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        this.currentPanel = webviewPanel;
        blocklypyViewerProvider.activeProvider = this;

        webviewPanel.onDidChangeViewState(
            (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
                if (webviewPanel.active) {
                    blocklypyViewerProvider.activeProvider = this;
                } else if (blocklypyViewerProvider.activeProvider === this) {
                    blocklypyViewerProvider.activeProvider = undefined;
                }
            },
        );

        webviewPanel.webview.options = {
            enableScripts: true,
        };

        // webviewPanel.webview.html = this.getHtmlForWebview();
        // this.showView(undefined);

        setTimeout(async () => {
            // Read the binary file as Uint8Array
            const fileUint8Array = await vscode.workspace.fs.readFile(document.uri);

            const file: IPyConverterFile = {
                name: document.uri.path.split('/').pop() || 'project',
                buffer: fileUint8Array.buffer as ArrayBuffer,
            };
            const options = {
                output: { 'blockly.svg': true },
            } satisfies IPyConverterOptions;
            const result = await convertProjectToPython([file], options);
            const filename = Array.isArray(result.name)
                ? result.name.join(', ')
                : result.name || 'Unknown';

            const pycode: string | undefined = Array.isArray(result.pycode)
                ? result.pycode.join('\n')
                : result.pycode;

            const pseudo: string | undefined = result.plaincode;

            const preview: string | undefined = result.extra?.['blockly.svg'];

            const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
            const dependencygraph = result.dependencygraph;
            const graphviz = await Graphviz.load(); //TODO: move to static init
            const graph: string | undefined = dependencygraph
                ? await graphviz.dot(dependencygraph)
                : undefined;

            this.content = {
                filename,
                pycode,
                pseudo,
                preview,
                graph,
            };

            webviewPanel.webview.html = this.getHtmlForWebview();
            // this.showView(undefined);

            setTimeout(() => {
                this.showView(this.availableView(undefined));
            }, 100);
            logDebug(
                pycode
                    ? `Successfully converted ${filename} to Python (${pycode.length} bytes).`
                    : `Failed to convert ${filename} to Python.`,
            );
        }, 0);
    }

    private currentView?: ViewType;
    public rotateViews(forward: boolean) {
        const view = this.availableView(
            this.nextView(this.currentView, forward ? +1 : -1),
        );
        this.showView(view);
    }

    private contentForView(view: ViewType | undefined) {
        if (view === ViewType.Pycode && this.content.pycode) {
            return this.content.pycode;
        } else if (view === ViewType.Pseudo && this.content.pseudo) {
            return this.content.pseudo;
        } else if (view === ViewType.Preview && this.content.preview) {
            return this.content.preview;
        } else if (view === ViewType.Graph && this.content.graph) {
            return this.content.graph;
        } else {
            return undefined;
        }
    }

    private availableView(current: ViewType | undefined): ViewType {
        let effectiveView = current;
        let content: string | undefined;
        do {
            content = this.contentForView(effectiveView);
            if (!content) {
                // try next view
                effectiveView = this.nextView(effectiveView);
            }
        } while (!content && effectiveView !== current);

        return effectiveView ?? ViewType.Preview;
    }

    private nextView(view: ViewType | undefined, step: number = +1): ViewType {
        const Views = [
            ViewType.Preview,
            ViewType.Pseudo,
            ViewType.Pycode,
            ViewType.Graph,
        ];
        const currentIndex = view ? Views.indexOf(view) : -1;
        const nextIndex = (currentIndex + step + Views.length) % Views.length;
        return Views[nextIndex];
    }

    public showView(view: ViewType | undefined) {
        this.currentView = view ?? ViewType.Loading;

        const content = view ? this.contentForView(view) : undefined;
        setContextCustomViewType(this.currentView);
        this.currentPanel?.webview.postMessage({
            command: 'showView',
            view: this.currentView,
            content,
        });
    }

    private getHtmlForWebview(): string {
        const scriptUri = this.currentPanel?.webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                'dist',
                'blocklypyWebview.js',
            ),
        );
        const imageUri = this.currentPanel?.webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.context.extensionUri,
                'asset',
                'logo-small-spin.svg',
            ),
        );
        const editorWorkerUri = this.currentPanel?.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'editor.worker.js'),
        );
        const pythonWorkerUri = this.currentPanel?.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'python.worker.js'),
        );
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="UTF-8">
            <title>${this.content?.filename}</title>
            <link rel="preload" href="${imageUri}" as="image">
            <style>
            html, body, #container, #editor {
            height: 100%;
            width: 100%;
            margin: 0;
            padding: 0;
            overflow: hidden;
            }
            #container {
                display: flex;
                height: 100vh;
                width: 100vw;
                justify-content: center;
                align-items: center;
            }
            #pycode, #pseudo, #preview, #graph {
                flex: 1 1 auto;
                height: 100%;
                width: 100%;
                display: none;
                overflow: auto;
            }
            #preview, #graph {
                padding: 20px;
            }
            #preview svg, #graph svg {
                width: 100%;
                height: 100%;
                display: block;
            }
            #loading {
                height: 50%;
                width: 50%;
            }
            </style>
            </head>
            <body>
            <div id="container">
                <img id="loading" src="${imageUri}"/>
                <div id="editor" style="display:none"></div>
                <div id="preview" style="display:none"></div>
                <div id="graph" style="display:none"></div>
            </div>

            <script>
            window.workerUrls = {
                'editorWorkerService': '${editorWorkerUri}',
                'pythonWorkerService': '${pythonWorkerUri}',
            };
            </script>
            <script deferred src="${scriptUri}"></script>

            </body>
            </html>
        `;
    }

    get pycode(): string | undefined {
        return this.content.pycode;
    }

    get filename(): string | undefined {
        return this.content.filename;
    }
}
