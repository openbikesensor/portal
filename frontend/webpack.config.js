const path = require('path');

module.exports = {
  entry: './src/index.js',
  mode: 'development',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      'mapbox-gl': 'maplibre-gl',
      '../../theme.config': path.resolve('./src/semantic-ui/theme.config')
    },
    modules: ['node_modules', 'src'],
  },
  module: {
    rules: [
      {
        test: /\.(m?j|t)sx?$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-react',
'@babel/preset-typescript',
              '@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/i,
        use: [
          "style-loader",
          "css-loader"
        ],
      },
      {
        test: /\.module\.less$/i,
        use: [
          // compiles Less to CSS
          "style-loader",
          {loader: "css-loader", options: { modules: true,}},
          {loader: "less-loader", options: {
            lessOptions: {
              math: 'always',
            }
          }},
        ],
      },
      {
        test: /\.less$/i,
        exclude: /\.module\.less$/i,
        use: [
          // compiles Less to CSS
          "style-loader",
          "css-loader",
          {loader: "less-loader", options: {
            lessOptions: {
              math: 'always',
            }
          }},
        ],
      },

      {

        test: /\.(png|svg|jpg|jpeg|gif)$/i,

        type: 'asset/resource',

      },
      {

        test: /\.(woff|woff2|eot|ttf|otf)$/i,

        type: 'asset/resource',

      },
    ],
  },
};
