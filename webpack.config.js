//@ts-check

'use strict';

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
    target: 'node',
    mode: 'none',
    entry: './src/extension.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: 'commonjs2',
    },
    externals: [
        {
            vscode: 'commonjs vscode',
        },
        '@abandonware/bluetooth-hci-socket',
        'ws',
    ],
    resolve: {
        extensions: ['.ts', '.js', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: [/node_modules/, path.resolve(__dirname, 'src/webview')],
                use: [
                    {
                        loader: 'ts-loader',
                    },
                ],
            },
        ],
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: {
        level: 'log',
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(
                        __dirname,
                        'node_modules/@pybricks/mpy-cross-v6/build/mpy-cross-v6.wasm',
                    ),
                    to: path.resolve(__dirname, 'dist'),
                },
                {
                    from: path.resolve(__dirname, 'src/assets'),
                    to: path.resolve(__dirname, 'dist/assets'),
                },
            ],
        }),
    ],
};

const webviewConfig = {
    target: 'web',
    mode: 'production',
    entry: './src/webview/blocklypyWebviewScript.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'blocklypyWebview.js',
    },
    resolve: {
        extensions: ['.ts', '.js', '.json'],
    },
    module: {
        rules: [
            { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ },
            { test: /\.css$/, use: ['style-loader', 'css-loader'] },
        ],
    },
    plugins: [
        new MonacoWebpackPlugin({
            languages: ['python', 'vb'],
            globalAPI: true,
        }),
    ],
    devtool: 'nosources-source-map',
};

module.exports = [extensionConfig, webviewConfig];
