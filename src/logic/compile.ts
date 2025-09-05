import * as vscode from 'vscode';
import { parse, walk } from '@pybricks/python-program-analysis';
import { compile } from '@pybricks/mpy-cross-v6';
import path from 'path';
import { blocklypyViewerProvider } from '../blocklypyViewer';

export const MAIN_MOCULE = '__main__';
export const MAIN_MOCULE_PATH = '__main__.py';

type Module = {
    name: string;
    path: string;
    content: string;
};

function getPythonCode(): { content: string; folder?: string } | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const content = editor.document.getText();
        const folder = path.dirname(editor.document.uri.fsPath);
        return { content, folder };
    }

    const customViewer = blocklypyViewerProvider.activeViewer;
    if (customViewer && customViewer.pycode) {
        const content = customViewer.pycode;
        return { content };
    }

    return undefined;
}

export async function compileAsync(): Promise<Blob> {
    await vscode.commands.executeCommand('workbench.action.files.saveAll');

    const pycode = getPythonCode();
    if (!pycode) {
        throw new Error('No Python code available to compile.');
    }

    const parts: BlobPart[] = [];

    const modules: Module[] = [
        {
            name: MAIN_MOCULE,
            path: MAIN_MOCULE_PATH,
            content: pycode.content,
        },
    ];

    const checkedModules = new Set<string>();

    while (modules.length > 0) {
        const module = modules.pop()!;
        if (checkedModules.has(module.name)) {
            continue;
        }
        checkedModules.add(module.name);

        // console.log(`Compiling module: ${module.name} (${module.path})`);
        const importedModules = findImportedModules(module.content);
        console.log(`Imported modules in ${module.name}:`, importedModules);
        for (const importedModule of importedModules) {
            if (checkedModules.has(importedModule) || !pycode.folder) {
                continue;
            }
            const resolvedModule = await resolveModuleAsync(
                pycode.folder,
                importedModule,
            );
            if (resolvedModule) {
                modules.push(resolvedModule);
            } else {
                checkedModules.add(importedModule);
            }
        }

        const compiled = await compile(
            module.path,
            module.content,
            undefined,
            undefined,
        );
        if (compiled.status !== 0 || !compiled.mpy) {
            throw new Error(`Failed to compile ${module.name}`);
        }

        parts.push(encodeUInt32LE(compiled.mpy.length));
        parts.push(cString(module.name) as BlobPart);
        parts.push(compiled.mpy as BlobPart);

        checkedModules.add(module.name);
    }

    return new Blob(parts);
}

async function resolveModuleAsync(
    folder: string,
    module: string,
): Promise<Module | undefined> {
    const relativePath = module.replace(/\./g, path.sep) + '.py';
    let absolutePath = path.join(folder, relativePath);
    try {
        const uri = vscode.Uri.file(absolutePath);
        const stats = await vscode.workspace.fs.stat(uri);
        if (stats.type === vscode.FileType.File) {
            return {
                name: module,
                path: relativePath,
                content: Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(
                    'utf8',
                ),
            };
        }
    } catch {}
}

const encoder = new TextEncoder();

function cString(str: string): Uint8Array {
    return encoder.encode(str + '\x00');
}

function encodeUInt32LE(value: number): ArrayBuffer {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setUint32(0, value, true);
    return buf;
}

function findImportedModules(py: string): ReadonlySet<string> {
    const modules = new Set<string>();

    const tree = parse(py);

    walk(tree, {
        onEnterNode(node, _ancestors) {
            if (node.type === 'import') {
                for (const name of node.names) {
                    modules.add(name.path);
                }
            } else if (node.type === 'from') {
                modules.add(node.base);
            }
        },
    });

    return modules;
}
