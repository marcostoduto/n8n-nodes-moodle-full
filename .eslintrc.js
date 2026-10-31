/**
 * @type {import('@types/eslint').ESLint.ConfigData}
 */
module.exports = {
	root: true,
	env: { browser: true, es6: true, node: true },
	parser: '@typescript-eslint/parser',
	parserOptions: {
		project: ['./tsconfig.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},
	ignorePatterns: ['.eslintrc.js', '**/*.js', '**/node_modules/**', '**/dist/**', 'test/**'],
	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
			rules: {
				'n8n-nodes-base/community-package-json-name-still-default': 'off',
			},
		},
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				'n8n-nodes-base/cred-class-field-documentation-url-not-http-url': 'off',
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
			rules: {
				// Cosmetic rules that would require renaming hundreds of existing labels/options.
				'n8n-nodes-base/node-param-options-type-unsorted-items': 'off',
				'n8n-nodes-base/node-param-description-missing-final-period': 'off',
				'n8n-nodes-base/node-param-description-excess-final-period': 'off',
				'n8n-nodes-base/node-param-description-wrong-for-dynamic-options': 'off',
				'n8n-nodes-base/node-param-description-boolean-without-whether': 'off',
				'n8n-nodes-base/node-param-display-name-miscased': 'off',
				'n8n-nodes-base/node-param-option-name-wrong-for-get-many': 'off',
				'n8n-nodes-base/node-param-option-description-wrong-for-get-many': 'off',
				'n8n-nodes-base/node-param-option-value-duplicate': 'off',
				'n8n-nodes-base/node-param-description-miscased-id': 'off',
				'n8n-nodes-base/node-param-display-name-miscased-id': 'off',
				'n8n-nodes-base/node-param-placeholder-miscased-id': 'off',
				'n8n-nodes-base/node-param-description-identical-to-display-name': 'off',
				'n8n-nodes-base/node-param-resource-with-plural-option': 'off',
				'n8n-nodes-base/node-param-operation-option-action-miscased': 'off',
				'n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options': 'off',
				'n8n-nodes-base/node-param-collection-type-unsorted-items': 'off',
				'n8n-nodes-base/node-param-description-unencoded-angle-brackets': 'off',
				'n8n-nodes-base/node-param-operation-option-without-action': 'off',
				'n8n-nodes-base/node-class-description-icon-not-svg': 'off',
				'n8n-nodes-base/node-execute-block-wrong-error-thrown': 'off',
				'n8n-nodes-base/node-param-description-comma-separated-hyphen': 'off',
				'n8n-nodes-base/node-param-default-wrong-for-options': 'off',
				'n8n-nodes-base/node-filename-against-convention': 'off',
			},
		},
	],
};
