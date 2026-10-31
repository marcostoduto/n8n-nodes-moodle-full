/**
 * @type {import('@types/eslint').ESLint.ConfigData}
 */
module.exports = {
	root: true,

	env: {
		browser: true,
		es6: true,
		node: true,
	},

	parser: '@typescript-eslint/parser',

	parserOptions: {
		project: ['./tsconfig.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},

	ignorePatterns: ['.eslintrc.js', '**/*.js', '**/node_modules/**', '**/dist/**'],

	overrides: [
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				'n8n-nodes-base/cred-class-field-documentation-url-missing': 'off',
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
			rules: {
				'n8n-nodes-base/node-execute-block-missing-continue-on-fail': 'off',
				'n8n-nodes-base/node-resource-description-filename-against-convention': 'off',
				'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',
				// The node keeps its published file name and PNG icon for backwards compatibility.
				'n8n-nodes-base/node-filename-against-convention': 'off',
				'n8n-nodes-base/node-class-description-icon-not-svg': 'off',
				// Purely cosmetic UI-text/ordering rules. Their autofixers corrupt the single-line
				// option objects used throughout the node, so they are disabled.
				'n8n-nodes-base/node-param-options-type-unsorted-items': 'off',
				'n8n-nodes-base/node-param-collection-type-unsorted-items': 'off',
				'n8n-nodes-base/node-param-option-description-identical-to-name': 'off',
				'n8n-nodes-base/node-param-description-identical-to-display-name': 'off',
				'n8n-nodes-base/node-param-option-name-wrong-for-get-many': 'off',
				'n8n-nodes-base/node-param-operation-option-description-wrong-for-get-many': 'off',
				'n8n-nodes-base/node-param-operation-option-action-wrong-for-get-many': 'off',
				'n8n-nodes-base/node-param-description-boolean-without-whether': 'off',
			},
		},
	],
};
