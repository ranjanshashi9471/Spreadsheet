module.exports = {
	// Specifies the JavaScript language options.
	parserOptions: {
		// Set ecmaVersion to the latest or a version that supports private class fields.
		// ES2022 (or 13) is when private fields were standardized.
		// 'latest' is often a good choice to stay up-to-date.
		ecmaVersion: "latest",
		// sourceType 'module' is necessary for import/export statements
		sourceType: "module",
	},
	// Define the environments where your code runs.
	// 'browser' provides browser globals like 'document', 'window', etc.
	env: {
		browser: true,
		es2022: true, // Also declare ES2022 environment for relevant globals/features
	},
	// Extend recommended ESLint rules to catch common issues.
	extends: "eslint:recommended",
	// Rules specific to your project.
	rules: {
		// You can add specific rules here if needed, e.g.,
		// 'no-unused-vars': 'warn',
		// 'no-console': 'off', // If you want to allow console.log
	},
};
