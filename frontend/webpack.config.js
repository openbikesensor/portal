var HtmlWebpackPlugin = require('html-webpack-plugin')
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

const path = require('path')

const resolveApp = (relativePath) => path.resolve(__dirname, relativePath)
const appSrc = resolveApp('src')

module.exports = function (webpackEnv) {
  const isEnvProduction = webpackEnv.production
  const isEnvDevelopment = !isEnvProduction

  const apiUrl = process.env.API_URL || 'http://localhost:3000'
  const baseUrl = process.env.BASE_URL || isEnvDevelopment ? 'http://localhost:3001' : '__BASE_HREF__'
  const port = process.env.PORT || 3001

  const sourceMap = isEnvDevelopment || Boolean(process.env.GENERATE_SOURCEMAP)

  const getStyleLoaders = (modules, withLess) => {
    const loaders = [
      isEnvDevelopment && require.resolve('style-loader'),
      isEnvProduction && {
        loader: MiniCssExtractPlugin.loader,
        // css is located in `static/css`, use '../../' to locate index.html folder
        // in production `paths.publicUrlOrPath` can be a relative path
        // options: paths.publicUrlOrPath.startsWith('.')
        //   ? { publicPath: '../../' }
        //   : {},
      },
      {
        loader: require.resolve('css-loader'),
        options: {
          modules,
          importLoaders: withLess ? 2 : 1,
          sourceMap,
        },
      },
      {
        // Options for PostCSS as we reference these options twice
        // Adds vendor prefixing based on your specified browser support in
        // package.json
        loader: require.resolve('postcss-loader'),
        options: {
          postcssOptions: {
            // Necessary for external CSS imports to work
            // https://github.com/facebook/create-react-app/issues/2677
            ident: 'postcss',
            plugins: [
              'postcss-flexbugs-fixes',
              [
                'postcss-preset-env',
                {
                  autoprefixer: {
                    flexbox: 'no-2009',
                  },
                  stage: 3,
                },
              ],
              // Adds PostCSS Normalize as the reset css with default options,
              // so that it honors browserslist config in package.json
              // which in turn let's users customize the target behavior as per their needs.
              'postcss-normalize',
            ],
          },
          sourceMap,
        },
      },
    ].filter(Boolean)
    if (withLess) {
      loaders.push(
        // {
        //   loader: require.resolve('resolve-url-loader'),
        //   options: {
        //     sourceMap,
        //     root: appSrc,
        //   },
        // },
        {
          loader: require.resolve('less-loader'),
          options: {
            lessOptions: {
              math: 'always',
            },
            // sourceMap: true,
          },
        }
      )
    }
    return loaders
  }

  return {
    entry: './src/index.js',
    mode: isEnvProduction ? 'production' : isEnvDevelopment && 'development',
    cache: isEnvDevelopment && {type: 'filesystem'},
    devtool: sourceMap && (isEnvProduction ? 'source-map' : 'cheap-module-source-map'),
    output: {
      // The build folder.
      path: path.resolve(__dirname, 'build'),
      // Add /* filename */ comments to generated require()s in the output.
      pathinfo: isEnvDevelopment,
      // There will be one main bundle, and one file per asynchronous chunk.
      // In development, it does not produce real files.
      filename: isEnvProduction ? 'static/js/[name].[contenthash:8].js' : isEnvDevelopment && 'static/js/bundle.js',
      // There are also additional JS chunk files if you use code splitting.
      chunkFilename: isEnvProduction
        ? 'static/js/[name].[contenthash:8].chunk.js'
        : isEnvDevelopment && 'static/js/[name].chunk.js',
      assetModuleFilename: 'static/media/[name].[hash][ext]',
      // webpack uses `publicPath` to determine where the app is being served from.
      // It requires a trailing slash, or the file assets will get an incorrect path.
      // We inferred the "public path" (such as / or /my-project) from homepage.
      // publicPath: paths.publicUrlOrPath,
      //
      // Point sourcemap entries to original disk location (format as URL on Windows)
      devtoolModuleFilenameTemplate: isEnvProduction
        ? (info) => path.relative(appSrc, info.absoluteResourcePath).replace(/\\/g, '/')
        : isEnvDevelopment && ((info) => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/')),
    },

    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        'mapbox-gl': 'maplibre-gl',
        '../../theme.config': path.resolve('./src/semantic-ui/theme.config'),
        '../../themes/default': 'fomantic-ui-less/themes/default',
      },
      modules: ['node_modules', 'src'],
    },
    plugins: [
      new HtmlWebpackPlugin({
        base: baseUrl,
        title: 'OpenBikeSensor Portal',
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

      isEnvDevelopment && new ReactRefreshWebpackPlugin(),

      isEnvProduction && new MiniCssExtractPlugin(),
    ].filter(Boolean),
    devServer: {
      port,
      hot: true,
      compress: true,
      historyApiFallback: true,
      static: {
        directory: path.join(__dirname, 'public'),
        serveIndex: true,
      },
      client: {
        webSocketURL: `ws://0.0.0.0:${port}/ws`,
      },
      proxy: {
        '/config.json': apiUrl,
        '/api': apiUrl,
        '/login': apiUrl,
        '/tiles': apiUrl
      },
    },
    module: {
      rules: [
        {
          test: /\.(mjs|js|jsx|ts|tsx)$/,
          // include: path.resolve('./src'),
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              babelrc: false,
              configFile: false,
              cacheDirectory: true,
              cacheCompression: false,
              sourceMaps: sourceMap,
              inputSourceMap: sourceMap,

              plugins: [
                isEnvDevelopment && 'react-refresh/babel',
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
                    development: isEnvDevelopment,
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
          use: getStyleLoaders(false),
          sideEffects: true,
        },
        {
          test: /\.less$/i,
          exclude: /\.module\.less$/i,
          use: getStyleLoaders(false, true),
          sideEffects: true,
        },
        {
          test: /\.module\.less$/i,
          use: getStyleLoaders(true, true),
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
}
