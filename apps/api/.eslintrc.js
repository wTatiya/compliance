module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.eslint.json']
  },
  extends: ['../../.eslintrc.json', 'plugin:@typescript-eslint/recommended', 'prettier'],
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    jest: true
  },
  ignorePatterns: ['dist', 'node_modules']
};
