const HtmlWebpackPlugin = require('html-webpack-plugin')
const ESLintPlugin = require('eslint-webpack-plugin')
const path = require('path')

module.exports = {
    entry: path.join(__dirname, 'src', 'index'),
    output: {
        filename: '[name].bundle.js',
        path: path.join(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /(node_modules|bower_components)/,
                use: ['babel-loader']
            },
            {
                test: /\.s?css$/,
                use: [
                    'style-loader', // creates style nodes from JS strings
                    'css-loader', // translates CSS into CommonJS
                    'sass-loader' // compiles Sass to CSS
                ]
            }
        ]
    },
    resolve: {
        extensions: ['*', '.js', '.jsx']
    },
    optimization: {
        splitChunks: {
            chunks: 'all'
        }
    },
    devtool: 'source-map',
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: path.join(__dirname, 'src', 'index.html'),
            favicon: path.join(__dirname, 'src', 'favicon.ico')
        }),
        new ESLintPlugin()
    ]
}