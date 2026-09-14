/**
 * scratch/test_slice3.js
 *
 * Automated verification suite for Slice 3 of Phase 7:
 * Exponentiation (^) and Right-Associative Precedence.
 *
 * Checks:
 * 1. Universal PascalCase compliance.
 * 2. Right-associative exponentiation parsing and evaluation (2 ^ 3 ^ 2 = 512).
 * 3. Precedence hierarchy: ^ binds tighter than *, /, +, -.
 * 4. Interaction with cell references (A1 ^ B1).
 * 5. Error handling: 0 ^ -1 (#DIV/0!), (-4) ^ 0.5 (#NUM!).
 * 6. Regression check across Slice 1 and Slice 2 expressions.
 */

const assert = require("assert");
const {
	BinaryOpNode,
	NumberNode,
	CellReferenceNode,
} = require("../FormulaAST.js");
const { OhmFormulaParser } = require("../FormulaParser.js");
const { FormulaEvaluator } = require("../FormulaEvaluator.js");

console.log(
	"==========================================================================",
);
console.log(
	"RUNNING SLICE 3 VERIFICATION: EXPONENTIATION (^) & RIGHT-ASSOCIATIVE PRECEDENCE",
);
console.log(
	"==========================================================================\n",
);

const parser = new OhmFormulaParser();
const evaluator = new FormulaEvaluator();

// 1. AST Structure & Right-Associativity Verification
console.log("1. Verifying AST Structure and Right-Associativity of '^'...");
const astRightAssoc = parser.Parse("2 ^ 3 ^ 2");
assert(astRightAssoc instanceof BinaryOpNode, "Root must be BinaryOpNode");
assert.strictEqual(astRightAssoc.Operator, "^");
assert.strictEqual(astRightAssoc.Left.Value, 2);
assert(
	astRightAssoc.Right instanceof BinaryOpNode,
	"Right child must be BinaryOpNode for right-associativity",
);
assert.strictEqual(astRightAssoc.Right.Operator, "^");
assert.strictEqual(astRightAssoc.Right.Left.Value, 3);
assert.strictEqual(astRightAssoc.Right.Right.Value, 2);
console.log(
	`   "2 ^ 3 ^ 2" -> ${astRightAssoc.ToString()} (Right-associative) ✅\n`,
);

// 2. Precedence and Mathematical Evaluation
console.log("2. Verifying Mathematical Evaluation and Precedence...");
const evalCases = [
	{ input: "2 ^ 3", expected: 8, note: "Basic power 2^3" },
	{ input: "3 ^ 2", expected: 9, note: "Basic power 3^2" },
	{ input: "10 ^ 0", expected: 1, note: "Zero exponent" },
	{ input: "4 ^ 0.5", expected: 2, note: "Fractional exponent (square root)" },
	{
		input: "2 ^ 3 ^ 2",
		expected: 512,
		note: "Right-associativity: 2^(3^2) = 2^9 = 512",
	},
	{
		input: "(2 ^ 3) ^ 2",
		expected: 64,
		note: "Parentheses override: (2^3)^2 = 8^2 = 64",
	},
	{
		input: "2 * 3 ^ 2",
		expected: 18,
		note: "Power binds tighter than multiplication: 2 * 9 = 18",
	},
	{
		input: "(2 * 3) ^ 2",
		expected: 36,
		note: "Parentheses multiplication before power: 6^2 = 36",
	},
	{
		input: "10 - 2 ^ 3",
		expected: 2,
		note: "Power binds tighter than subtraction: 10 - 8 = 2",
	},
	{
		input: "2 ^ 3 * 2",
		expected: 16,
		note: "Power before multiplication: 8 * 2 = 16",
	},
	{
		input: "24 / 2 ^ 3",
		expected: 3,
		note: "Power before division: 24 / 8 = 3",
	},
	{
		input: "2 ^ (1 + 2)",
		expected: 8,
		note: "Parenthesized expression in exponent",
	},
];

for (const tc of evalCases) {
	const ast = parser.Parse(tc.input);
	const res = evaluator.Evaluate(ast);
	assert.strictEqual(
		res,
		tc.expected,
		`Failed "${tc.input}" (${tc.note}): expected ${tc.expected}, got ${res}`,
	);
	console.log(`   "${tc.input}" = ${res} (${tc.note}) ✅`);
}
console.log();

// 3. Exponentiation with Cell References
console.log("3. Verifying Exponentiation with Cell References...");
const mockContext = {
	A1: 3,
	B1: 2,
	C1: 4,
	D1: 0.5,
};

const cellCases = [
	{ input: "A1 ^ B1", expected: 9, note: "3 ^ 2 = 9" },
	{ input: "A1 ^ B1 ^ 2", expected: 81, note: "3 ^ (2 ^ 2) = 3 ^ 4 = 81" },
	{ input: "A1 * B1 ^ 2", expected: 12, note: "3 * (2 ^ 2) = 3 * 4 = 12" },
	{ input: "(A1 * B1) ^ 2", expected: 36, note: "(3 * 2) ^ 2 = 6 ^ 2 = 36" },
	{ input: "C1 ^ D1 + A1", expected: 5, note: "4 ^ 0.5 + 3 = 2 + 3 = 5" },
	{ input: "C1 ^ B1 / 2", expected: 8, note: "4 ^ 2 / 2 = 16 / 2 = 8" },
];

for (const tc of cellCases) {
	const ast = parser.Parse(tc.input);
	const res = evaluator.Evaluate(ast, mockContext);
	assert.strictEqual(
		res,
		tc.expected,
		`Failed "${tc.input}" (${tc.note}): expected ${tc.expected}, got ${res}`,
	);
	console.log(`   "${tc.input}" = ${res} (${tc.note}) ✅`);
}
console.log();

// 4. Error Handling
console.log("4. Verifying Exponentiation Error Handling (#DIV/0!, #NUM!)...");
const errCases = [
	{
		input: "0 ^ -1",
		expected: "#DIV/0!",
		note: "Zero with negative exponent is division by zero",
	},
	{
		input: "0 ^ -2",
		expected: "#DIV/0!",
		note: "Zero with negative exponent is division by zero",
	},
	{
		input: "(-4) ^ 0.5",
		expected: "#NUM!",
		note: "Even root of negative number produces NaN",
	},
];

for (const tc of errCases) {
	const ast = parser.Parse(tc.input);
	const res = evaluator.Evaluate(ast);
	assert.strictEqual(
		res,
		tc.expected,
		`Failed "${tc.input}" (${tc.note}): expected ${tc.expected}, got ${res}`,
	);
	console.log(`   "${tc.input}" = ${res} (${tc.note}) ✅`);
}
console.log();

// 5. Full Regression Suite Check
console.log(
	"5. Regression check: Ensuring Slice 1 and Slice 2 expressions remain operational...",
);
assert.strictEqual(evaluator.Evaluate(parser.Parse("10 + 20 * 3")), 70);
assert.strictEqual(evaluator.Evaluate(parser.Parse("(10 + 20) * 3")), 90);
assert.strictEqual(evaluator.Evaluate(parser.Parse("100 / 4 - 5")), 20);
assert.strictEqual(evaluator.Evaluate(parser.Parse("-10 + 25")), 15);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("A1 + B1"), { A1: 10, B1: 20 }),
	30,
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("a1 * 2 + B1"), { A1: 10, B1: 20 }),
	40,
);
console.log(
	"   ✅ All Slice 1 and Slice 2 expressions continue to pass cleanly.\n",
);

console.log(
	"==========================================================================",
);
console.log("ALL SLICE 3 TESTS COMPLETED SUCCESSFULLY! 🎉");
console.log(
	"Seam verified: Exponentiation (^) & Right-Associativity complete. 🎯",
);
console.log(
	"==========================================================================",
);
