/**
 * scratch/test_slice6.js
 *
 * Automated verification suite for Slice 6 of Phase 7:
 * Comparison Operators (=, <>, <, <=, >, >=), Boolean Literals, and Precedence.
 *
 * Checks:
 * 1. Universal PascalCase compliance on all new and updated components.
 * 2. Precedence hierarchy: Comparison binds looser than Additive, Multiplicative, and Power.
 * 3. AST construction for all 6 comparison operators, StringNode, and BooleanNode.
 * 4. Evaluation of numeric, string (case-insensitive), and boolean comparisons.
 * 5. Interaction with cell references and worksheet functions (e.g. SUM(A1:B2) > 50).
 * 6. Error propagation through comparison operators (#DIV/0!, #REF!).
 * 7. Full regression suite check across Slices 1, 2, 3, and 4.
 */

const assert = require("assert");
const {
	ASTNode,
	NumberNode,
	UnaryOpNode,
	BinaryOpNode,
	CellReferenceNode,
	RangeNode,
	FunctionCallNode,
	BooleanNode,
	StringNode,
	ErrorNode,
} = require("../FormulaAST.js");
const { ReferenceResolver } = require("../ReferenceResolver.js");
const { FunctionRegistry } = require("../FunctionRegistry.js");
const { OhmFormulaParser } = require("../FormulaParser.js");
const { FormulaEvaluator } = require("../FormulaEvaluator.js");

console.log(
	"==========================================================================",
);
console.log("RUNNING SLICE 6 VERIFICATION: COMPARISON OPERATORS & BOOLEANS");
console.log(
	"==========================================================================\n",
);

// -----------------------------------------------------------------------------
// 1. Universal PascalCase Compliance Check
// -----------------------------------------------------------------------------
console.log("1. Verifying Universal PascalCase compliance...");

function CheckPascalCase(obj, name, allowedLower = []) {
	const props = Object.getOwnPropertyNames(obj);
	for (const prop of props) {
		if (
			prop === "constructor" ||
			prop.startsWith("_") ||
			allowedLower.includes(prop)
		) {
			continue;
		}
		const firstChar = prop.charAt(0);
		assert(
			firstChar === firstChar.toUpperCase() &&
				firstChar !== firstChar.toLowerCase(),
			`Non-PascalCase property '${prop}' found on ${name}`,
		);
	}
}

const dummyBool = new BooleanNode(true);
CheckPascalCase(dummyBool, "BooleanNode");
CheckPascalCase(Object.getPrototypeOf(dummyBool), "BooleanNode.prototype");

const dummyStr = new StringNode("hello");
CheckPascalCase(dummyStr, "StringNode");
CheckPascalCase(Object.getPrototypeOf(dummyStr), "StringNode.prototype");

const evaluator = new FormulaEvaluator();
CheckPascalCase(evaluator, "FormulaEvaluator");
CheckPascalCase(Object.getPrototypeOf(evaluator), "FormulaEvaluator.prototype");

const parser = new OhmFormulaParser();
CheckPascalCase(parser, "OhmFormulaParser");
CheckPascalCase(Object.getPrototypeOf(parser), "OhmFormulaParser.prototype");

console.log(
	"   ✅ All classes, properties, and methods strictly follow Universal PascalCase.\n",
);

// -----------------------------------------------------------------------------
// 2. Precedence Hierarchy and AST Structure
// -----------------------------------------------------------------------------
console.log("2. Verifying Precedence Hierarchy and AST Structure...");

// Comparison binds looser than Additive: 10 + 5 > 12 -> (10 + 5) > 12
const astAddComp = parser.Parse("10 + 5 > 12");
assert(astAddComp instanceof BinaryOpNode, "Root must be BinaryOpNode");
assert.strictEqual(astAddComp.Operator, ">");
assert(astAddComp.Left instanceof BinaryOpNode);
assert.strictEqual(astAddComp.Left.Operator, "+");
assert.strictEqual(astAddComp.Right.Value, 12);
console.log(
	`   "10 + 5 > 12" -> ${astAddComp.ToString()} (Additive before Comparison) ✅`,
);

// Comparison binds looser than Multiplicative: 3 * 4 = 12 -> (3 * 4) = 12
const astMulComp = parser.Parse("3 * 4 = 12");
assert.strictEqual(astMulComp.Operator, "=");
assert.strictEqual(astMulComp.Left.Operator, "*");
console.log(
	`   "3 * 4 = 12" -> ${astMulComp.ToString()} (Multiplicative before Comparison) ✅`,
);

// Comparison binds looser than Power: 2 ^ 3 >= 8 -> (2 ^ 3) >= 8
const astPowComp = parser.Parse("2 ^ 3 >= 8");
assert.strictEqual(astPowComp.Operator, ">=");
assert.strictEqual(astPowComp.Left.Operator, "^");
console.log(
	`   "2 ^ 3 >= 8" -> ${astPowComp.ToString()} (Power before Comparison) ✅`,
);

// String and Boolean AST generation
const astStr = parser.Parse('A1 = "active"');
assert.strictEqual(astStr.Operator, "=");
assert(astStr.Right instanceof StringNode);
assert.strictEqual(astStr.Right.Value, "active");
console.log(`   'A1 = "active"' -> ${astStr.ToString()} (StringNode) ✅`);

const astBool = parser.Parse("TRUE");
assert(astBool instanceof BooleanNode);
assert.strictEqual(astBool.Value, true);
console.log(`   "TRUE" -> ${astBool.ToString()} (BooleanNode) ✅\n`);

// -----------------------------------------------------------------------------
// 3. Mathematical Evaluation of Comparisons
// -----------------------------------------------------------------------------
console.log("3. Verifying Mathematical Evaluation of Comparisons...");

const evalCases = [
	// Equality (=) & Inequality (<>)
	{ input: "20 = 20", expected: true, note: "20 = 20 is true" },
	{ input: "20 = 25", expected: false, note: "20 = 25 is false" },
	{ input: "10 <> 20", expected: true, note: "10 <> 20 is true" },
	{ input: "10 <> 10", expected: false, note: "10 <> 10 is false" },

	// Less Than (<) & Less Than Or Equal (<=)
	{ input: "5 < 10", expected: true, note: "5 < 10 is true" },
	{ input: "10 < 5", expected: false, note: "10 < 5 is false" },
	{ input: "10 < 10", expected: false, note: "10 < 10 is false" },
	{ input: "5 <= 10", expected: true, note: "5 <= 10 is true" },
	{ input: "10 <= 10", expected: true, note: "10 <= 10 is true" },
	{ input: "15 <= 10", expected: false, note: "15 <= 10 is false" },

	// Greater Than (>) & Greater Than Or Equal (>=)
	{ input: "10 > 5", expected: true, note: "10 > 5 is true" },
	{ input: "5 > 10", expected: false, note: "5 > 10 is false" },
	{ input: "10 > 10", expected: false, note: "10 > 10 is false" },
	{ input: "10 >= 5", expected: true, note: "10 >= 5 is true" },
	{ input: "10 >= 10", expected: true, note: "10 >= 10 is true" },
	{ input: "5 >= 10", expected: false, note: "5 >= 10 is false" },

	// Precedence compound expressions
	{ input: "10 + 5 > 12", expected: true, note: "15 > 12 is true" },
	{ input: "10 + 5 < 12", expected: false, note: "15 < 12 is false" },
	{ input: "2 * 3 = 6", expected: true, note: "6 = 6 is true" },
	{ input: "2 ^ 3 >= 8", expected: true, note: "8 >= 8 is true" },
	{ input: "2 ^ 3 > 8", expected: false, note: "8 > 8 is false" },
	{ input: "10 - 2 * 3 = 4", expected: true, note: "10 - 6 = 4 is true" },

	// String comparisons (case-insensitive Excel semantics)
	{
		input: '"hello" = "HELLO"',
		expected: true,
		note: "Case-insensitive equality",
	},
	{
		input: '"apple" = "banana"',
		expected: false,
		note: "Different strings equal",
	},
	{
		input: '"apple" <> "banana"',
		expected: true,
		note: "Different strings inequality",
	},
	{
		input: '"apple" < "banana"',
		expected: true,
		note: "Alphabetical ordering",
	},
	{ input: '"" = ""', expected: true, note: "Empty string equality" },

	// Boolean literals and comparisons
	{ input: "TRUE = TRUE", expected: true, note: "TRUE = TRUE" },
	{ input: "FALSE = FALSE", expected: true, note: "FALSE = FALSE" },
	{ input: "TRUE = FALSE", expected: false, note: "TRUE = FALSE" },
	{ input: "FALSE < TRUE", expected: true, note: "FALSE < TRUE in Excel" },
	{
		input: "TRUE() = TRUE",
		expected: true,
		note: "Parameterless TRUE() function",
	},
	{
		input: "FALSE() = FALSE",
		expected: true,
		note: "Parameterless FALSE() function",
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

// -----------------------------------------------------------------------------
// 4. Comparison with Cell References and Functions
// -----------------------------------------------------------------------------
console.log("4. Verifying Comparisons with Cell References and Functions...");

const mockContext = {
	A1: 50,
	B1: "VIP",
	C1: 10,
	D1: 20,
	D2: 30,
};

const contextCases = [
	{ input: "A1 > 20", expected: true, note: "50 > 20" },
	{ input: "A1 < 100", expected: true, note: "50 < 100" },
	{
		input: 'B1 = "vip"',
		expected: true,
		note: 'Case-insensitive cell string: "VIP" = "vip"',
	},
	{ input: 'B1 <> "REGULAR"', expected: true, note: '"VIP" <> "REGULAR"' },
	{ input: "A1 + C1 = 60", expected: true, note: "50 + 10 = 60" },
	{ input: "A1 * 2 <> 100", expected: false, note: "100 <> 100 is false" },
	{ input: "SUM(D1:D2) = 50", expected: true, note: "SUM(20, 30) = 50" },
	{ input: "SUM(D1:D2) > 40", expected: true, note: "50 > 40" },
	{
		input: "AVERAGE(D1:D2) = 25",
		expected: true,
		note: "AVERAGE(20, 30) = 25",
	},
	{ input: "MAX(D1:D2) <= 30", expected: true, note: "MAX(20, 30) = 30 <= 30" },
];

for (const tc of contextCases) {
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

// -----------------------------------------------------------------------------
// 5. Error Token Propagation Through Comparisons
// -----------------------------------------------------------------------------
console.log("5. Verifying Error Token Propagation...");

const errCases = [
	{
		input: "(10 / 0) = 5",
		expected: "#DIV/0!",
		note: "Division by zero in left operand propagates",
	},
	{
		input: "10 > (10 / 0)",
		expected: "#DIV/0!",
		note: "Division by zero in right operand propagates",
	},
	{
		input: "0 ^ -1 = 0",
		expected: "#DIV/0!",
		note: "Invalid power propagates through equality",
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

const contextWithErr = { A1: "#REF!" };
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("A1 = 10"), contextWithErr),
	"#REF!",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("10 < A1"), contextWithErr),
	"#REF!",
);
console.log("   Cell error '#REF!' propagates through comparison ✅\n");

// -----------------------------------------------------------------------------
// 6. Full Regression Suite Check Across Slices 1 to 4
// -----------------------------------------------------------------------------
console.log("6. Verifying Regression Across Slices 1, 2, 3, and 4...");

// Slice 1: Arithmetic & Unary
assert.strictEqual(evaluator.Evaluate(parser.Parse("10 + 20 * 3")), 70);
assert.strictEqual(evaluator.Evaluate(parser.Parse("(10 + 20) * 3")), 90);
assert.strictEqual(evaluator.Evaluate(parser.Parse("-10 + 25")), 15);

// Slice 2: Cell References
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("A1 + B1"), { A1: 10, B1: 20 }),
	30,
);

// Slice 3: Exponentiation
assert.strictEqual(evaluator.Evaluate(parser.Parse("2 ^ 3 ^ 2")), 512);

// Slice 4: Ranges and Functions
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("SUM(A1:B2)"), {
		A1: 1,
		A2: 2,
		B1: 3,
		B2: 4,
	}),
	10,
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("AVERAGE(A1:A3)"), {
		A1: 10,
		A2: 20,
		A3: 30,
	}),
	20,
);

console.log(
	"   ✅ All Slice 1, Slice 2, Slice 3, and Slice 4 expressions continue to pass cleanly.\n",
);

console.log(
	"==========================================================================",
);
console.log("ALL SLICE 6 TESTS COMPLETED SUCCESSFULLY! 🎉");
console.log(
	"Seam verified: Comparison Operators (=, <>, <, <=, >, >=) complete. 🎯",
);
console.log(
	"==========================================================================",
);
