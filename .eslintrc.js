module.exports = {
  root: true,
  env: {
    node: true,
    es6: true,
  },
  plugins: ['prettier'],
  extends: [
    'eslint:recommended',
    "plugin:prettier/recommended",
  ],
  rules: {
    // for prettier compat
    'implicit-arrow-linebreak': 'off',

    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-debugger': 'error',
    'curly': ['error', 'all'],
    'func-call-spacing': ['error', 'never'],
    'keyword-spacing': ['error', { 'before': true, 'after': true }],
    'no-eval': ['error', {}],
    'no-multiple-empty-lines': ['error', { 'max': 1, 'maxBOF': 0 }],
    'no-var': 'error',
    'no-dupe-keys': 'error',
    'no-prototype-builtins': 'error',
    'prefer-arrow-callback': 'error',
    'semi': ['error', 'always'],
    'semi-spacing': ["error", {"before": false, "after": true}],
    'space-before-blocks': ['error', 'always'],
    'eol-last': ["error", "always"],
    'eqeqeq': ["error", "always"],
    'no-unused-vars': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

    '@typescript-eslint/no-var-requires': 'warn',
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  overrides: [
    {
      files: ["*.js"],
      rules: {
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-unused-vars": "off",
      }
    },
    {
      files: ["*.vue"],
      parser: "vue-eslint-parser",
      parserOptions: {
          parser: "@typescript-eslint/parser",
          ecmaVersion: 2020,
          sourceType: "module"
      },
      extends: [
        "plugin:vue/base",
        "plugin:vue/essential",
        "@vue/typescript/recommended",
      ],
      rules: {
        // HACK: this rule is required, otherwise travis-ci will fail (for some reason)
        // even through when run locally, no linting errors occur.
        "vue/no-parsing-error": ["error", {
          "invalid-first-character-of-tag-name": false,
        }],
      }
    },
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: ["./tsconfig.json"],
			},
      rules: {
        "no-unused-vars": "off",
        "@typescript-eslint/adjacent-overload-signatures": "error",
        "@typescript-eslint/switch-exhaustiveness-check": "error",
        "@typescript-eslint/restrict-template-expressions": "warn",
        "@typescript-eslint/no-unnecessary-type-assertion": "warn",
        "@typescript-eslint/no-unnecessary-boolean-literal-compare": "warn",

        "@typescript-eslint/no-unsafe-call": "off", // TODO: switch to warn
        "@typescript-eslint/no-unsafe-member-access": "off", // TODO: switch to warn
        "@typescript-eslint/no-unsafe-assignment": "off", // TODO: switch to warn
      }
    },
  ]
};
