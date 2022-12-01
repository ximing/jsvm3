module.exports = {
  presets: [
    [
      '@babel/env',
      {
        targets: {
          browsers: ['safari >= 10', 'android >= 53'],
        },
        useBuiltIns: 'usage',
        corejs: '3',
      },
    ],
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    '@babel/plugin-proposal-class-properties',
    '@babel/plugin-syntax-optional-chaining',
    '@babel/plugin-proposal-do-expressions',
    '@babel/plugin-proposal-object-rest-spread',
  ],
};
