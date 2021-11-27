var HtmlWebpackPlugin = require('html-webpack-plugin')
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')

const path = require('path')

const isDevelopment = process.env.NODE_ENV !== 'production'

const API_URL = process.env.API_URL || 'http://localhost:3000'
const BASE_URL = process.env.BASE_URL || isDevelopment ? 'http://localhost:3001' : '__BASE_HREF__'
const PORT = process.env.PORT || 3001


module.exports = {
  entry: './src/index.js',
  mode: isDevelopment ? 'development' : 'production',
  cache: isDevelopment && {type: 'filesystem'},
  devtool: 'eval-cheap-module-source-map',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'bundle.js',
  },
  cache: false,
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      'mapbox-gl': 'maplibre-gl',
      '../../theme.config': path.resolve('./src/semantic-ui/theme.config'),
    },
    modules: ['node_modules', 'src'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      base: BASE_URL,
      meta: {
        charset: 'utf-8',
        viewport: 'width=device-width, initial-scale=1',
        'theme-color': '#000000',
        description:
          'Upload the tracks recorded with your OpenBikeSensor device to this portal and participate in the accumulation of Open Data.',
      },
      favicon: 'public/favicon.ico',
      manifest: 'public/manifest.json',
    }),

    isDevelopment && new ReactRefreshWebpackPlugin(),
  ].filter(Boolean),
  devServer: {
    port: PORT,
    hot: true,
    compress: true,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public'),
      serveIndex: true,
    },
    client: {
      webSocketURL: `ws://0.0.0.0:${PORT}/ws`,
    },
    proxy: {
      '/api': API_URL,
      '/login': API_URL,
    },
  },
  module: {
    rules: [
      {
        test: /\.(mjs|js|jsx|ts|tsx)$/,
        include: path.resolve('./src'),
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: false,
            configFile: false,
            cacheDirectory: true,
            cacheCompression: false,
            sourceMaps: true,
            inputSourceMap: true,

            plugins: [
              isDevelopment && 'react-refresh/babel',
              [
                '@babel/plugin-transform-runtime',
                {
                  corejs: false,
                  regenerator: true,
                  useESModules: true,
                },
              ],
            ].filter(Boolean),
            presets: [
              [
                '@babel/preset-react',
                {
                  development: isDevelopment,
                  runtime: 'automatic',
                },
              ],
              '@babel/preset-typescript',
              '@babel/preset-env',
            ],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
        sideEffects: true,
      },
      {
        test: /\.module\.less$/i,
        use: [
          // compiles Less to CSS
          'style-loader',
          {loader: 'css-loader', options: {modules: true}},
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                math: 'always',
              },
            },
          },
        ],
        sideEffects: true,
      },
      {
        test: /\.less$/i,
        exclude: /\.module\.less$/i,
        use: [
          // compiles Less to CSS
          'style-loader',
          'css-loader',
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                math: 'always',
              },
            },
          },
        ],
        sideEffects: true,
      },

      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },

      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },

      {
        scheme: 'data',
        type: 'asset/resource',
      },
    ],
  },
}
