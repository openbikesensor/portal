module.exports = {
  plugins: [
    {plugin: require('@semantic-ui-react/craco-less')},
    {
      plugin: {
        overrideWebpackConfig: ({webpackConfig, cracoConfig, pluginOptions, context: {env, paths}}) => {
          webpackConfig.resolve.alias = {
            ...webpackConfig.resolve.alias,
            'mapbox-gl': 'maplibre-gl',
          }

          return webpackConfig
        },
        options: {},
      },
    },
  ],
}
