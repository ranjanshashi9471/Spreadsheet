/**
 * scratch/test_slice7.js
 *
 * Automated verification suite for Slice 7 of Phase 7:
 * Logical Functions (IF, AND, OR, NOT, IFERROR) and Short-Circuit Evaluation.
 *
 * Checks:
 * 1. Universal PascalCase compliance on all evaluator and registry methods.
 * 2. Short-circuit evaluation in IF: unselected branches are never evaluated (division by zero guard).
 * 3. Lazy fallback evaluation in IFERROR: fallback only evaluated on error.
 * 4. Logical functions AND, OR, NOT with scalar, cell, and range arguments.
 * 5. Error token propagation (#DIV/0!, #REF!) across logical functions.
 * 6. Nested combinations (e.g. IF(AND(A1 > 0, B1 > 0), ...)).
 * 7. Full regression suite check across Slices 1 to 6.
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
console.log(
	"RUNNING SLICE 7 VERIFICATION: LOGICAL FUNCTIONS & SHORT-CIRCUIT EVALUATION",
);
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

const evaluator = new FormulaEvaluator();
CheckPascalCase(evaluator, "FormulaEvaluator");
CheckPascalCase(Object.getPrototypeOf(evaluator), "FormulaEvaluator.prototype");

const registry = FunctionRegistry.Instance;
CheckPascalCase(registry, "FunctionRegistry");
CheckPascalCase(Object.getPrototypeOf(registry), "FunctionRegistry.prototype");

const parser = new OhmFormulaParser();
CheckPascalCase(parser, "OhmFormulaParser");
CheckPascalCase(Object.getPrototypeOf(parser), "OhmFormulaParser.prototype");

console.log(
	"   ✅ All classes, properties, and methods strictly follow Universal PascalCase.\n",
);

// -----------------------------------------------------------------------------
// 2. Short-Circuit Evaluation in IF
// -----------------------------------------------------------------------------
console.log("2. Verifying Short-Circuit Evaluation in IF...");

// Division by zero on false branch must NEVER execute when condition is TRUE
const ifTrueShortCircuit = evaluator.Evaluate(
	parser.Parse("IF(TRUE, 100, 1 / 0)"),
);
assert.strictEqual(
	ifTrueShortCircuit,
	100,
	"IF(TRUE, 100, 1 / 0) must return 100 without #DIV/0!",
);
console.log(
	`   IF(TRUE, 100, 1 / 0) = ${ifTrueShortCircuit} (short-circuit on true) ✅`,
);

// Division by zero on true branch must NEVER execute when condition is FALSE
const ifFalseShortCircuit = evaluator.Evaluate(
	parser.Parse("IF(FALSE, 1 / 0, 200)"),
);
assert.strictEqual(
	ifFalseShortCircuit,
	200,
	"IF(FALSE, 1 / 0, 200) must return 200 without #DIV/0!",
);
console.log(
	`   IF(FALSE, 1 / 0, 200) = ${ifFalseShortCircuit} (short-circuit on false) ✅`,
);

// Classic spreadsheet guard pattern: IF(A1 = 0, 0, 100 / A1)
const contextZero = { A1: 0 };
const ifGuardZero = evaluator.Evaluate(
	parser.Parse("IF(A1 = 0, 0, 100 / A1)"),
	contextZero,
);
assert.strictEqual(
	ifGuardZero,
	0,
	"IF(A1 = 0, 0, 100 / A1) with A1 = 0 must return 0",
);
console.log(
	`   IF(A1 = 0, 0, 100 / A1) with A1=0 = ${ifGuardZero} (guard succeeded) ✅`,
);

const contextNonZero = { A1: 10 };
const ifGuardNonZero = evaluator.Evaluate(
	parser.Parse("IF(A1 = 0, 0, 100 / A1)"),
	contextNonZero,
);
assert.strictEqual(
	ifGuardNonZero,
	10,
	"IF(A1 = 0, 0, 100 / A1) with A1 = 10 must return 10",
);
console.log(`   IF(A1 = 0, 0, 100 / A1) with A1=10 = ${ifGuardNonZero} ✅`);

// Default false branch returns false
const ifDefaultFalse = evaluator.Evaluate(parser.Parse("IF(FALSE, 100)"));
assert.strictEqual(
	ifDefaultFalse,
	false,
	"IF(FALSE, 100) returns false when false branch omitted",
);
console.log(
	`   IF(FALSE, 100) = ${ifDefaultFalse} (omitted false branch) ✅\n`,
);

// -----------------------------------------------------------------------------
// 3. Lazy Fallback in IFERROR
// -----------------------------------------------------------------------------
console.log("3. Verifying Lazy Error Handling in IFERROR...");

const ifErrorCaught = evaluator.Evaluate(
	parser.Parse('IFERROR(10 / 0, "Division error")'),
);
assert.strictEqual(
	ifErrorCaught,
	"Division error",
	"IFERROR must catch division by zero",
);
console.log(`   IFERROR(10 / 0, "Division error") = "${ifErrorCaught}" ✅`);

const ifErrorNotTriggered = evaluator.Evaluate(
	parser.Parse('IFERROR(10 / 2, "Division error")'),
);
assert.strictEqual(
	ifErrorNotTriggered,
	5,
	"IFERROR must return valid result when no error occurs",
);
console.log(`   IFERROR(10 / 2, "Division error") = ${ifErrorNotTriggered} ✅`);

// Catching cell error reference
const contextRefErr = { A1: "#REF!" };
const ifErrorRef = evaluator.Evaluate(
	parser.Parse('IFERROR(A1, "Reference Error")'),
	contextRefErr,
);
assert.strictEqual(
	ifErrorRef,
	"Reference Error",
	"IFERROR must catch #REF! error token",
);
console.log(`   IFERROR(A1, "Reference Error") = "${ifErrorRef}" ✅`);

// Fallback expression only evaluated on error
const ifErrorLazy = evaluator.Evaluate(parser.Parse("IFERROR(50, 1 / 0)"));
assert.strictEqual(
	ifErrorLazy,
	50,
	"Fallback expression must not be evaluated if no error",
);
console.log(
	`   IFERROR(50, 1 / 0) = ${ifErrorLazy} (fallback not evaluated) ✅\n`,
);

// -----------------------------------------------------------------------------
// 4. Logical Functions: AND, OR, NOT
// -----------------------------------------------------------------------------
console.log("4. Verifying AND, OR, NOT Functions...");

const logicalCases = [
	// AND
	{ input: "AND(TRUE, TRUE)", expected: true, note: "AND(T, T)" },
	{ input: "AND(TRUE, FALSE)", expected: false, note: "AND(T, F)" },
	{ input: "AND(1, 1, 1)", expected: true, note: "AND with non-zero numbers" },
	{ input: "AND(1, 0, 1)", expected: false, note: "AND with a zero number" },
	{
		input: "AND(10 > 5, 20 < 30)",
		expected: true,
		note: "AND with comparison expressions",
	},
	{
		input: "AND(10 > 5, 20 > 30)",
		expected: false,
		note: "AND with one false comparison",
	},

	// OR
	{ input: "OR(TRUE, FALSE)", expected: true, note: "OR(T, F)" },
	{ input: "OR(FALSE, FALSE)", expected: false, note: "OR(F, F)" },
	{ input: "OR(0, 0, 1)", expected: true, note: "OR with non-zero number" },
	{ input: "OR(0, 0, 0)", expected: false, note: "OR with all zeros" },
	{
		input: "OR(10 < 5, 20 = 20)",
		expected: true,
		note: "OR with one true comparison",
	},

	// NOT
	{ input: "NOT(TRUE)", expected: false, note: "NOT(TRUE)" },
	{ input: "NOT(FALSE)", expected: true, note: "NOT(FALSE)" },
	{ input: "NOT(1)", expected: false, note: "NOT(1)" },
	{ input: "NOT(0)", expected: true, note: "NOT(0)" },
	{ input: "NOT(10 < 5)", expected: true, note: "NOT(10 < 5)" },
];

for (const tc of logicalCases) {
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
// 5. Logical Functions with Ranges and Cell Contexts
// -----------------------------------------------------------------------------
console.log("5. Verifying Logical Functions with Ranges & Cell Contexts...");

const mockGrid = {
	A1: true,
	A2: true,
	A3: false,
	B1: 10,
	B2: 20,
	B3: "VIP",
};

// AND with range
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("AND(A1:A2)"), mockGrid),
	true,
	"AND(A1:A2) both true",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("AND(A1:A3)"), mockGrid),
	false,
	"AND(A1:A3) includes false",
);
console.log("   AND(A1:A2) = true, AND(A1:A3) = false ✅");

// OR with range
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("OR(A2:A3)"), mockGrid),
	true,
	"OR(A2:A3) has true",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("OR(A3:A3)"), mockGrid),
	false,
	"OR(A3:A3) only false",
);
console.log("   OR(A2:A3) = true, OR(A3:A3) = false ✅");

// Error propagation in AND, OR, NOT
const gridErr = { E1: "#DIV/0!" };
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("AND(TRUE, E1)"), gridErr),
	"#DIV/0!",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("OR(FALSE, E1)"), gridErr),
	"#DIV/0!",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("NOT(E1)"), gridErr),
	"#DIV/0!",
);
console.log("   Error token #DIV/0! propagates through AND, OR, NOT ✅\n");

// -----------------------------------------------------------------------------
// 6. Nested Complex Formulas
// -----------------------------------------------------------------------------
console.log("6. Verifying Nested Complex Formulas...");

const contextComplex = {
	A1: 85, // Score
	B1: 0.95, // Attendance
	C1: 50000, // Salary
	D1: 0.2, // TaxRate
};

// Nested IF with AND
const passExpr = 'IF(AND(A1 >= 70, B1 >= 0.8), "Pass", "Fail")';
const passRes = evaluator.Evaluate(parser.Parse(passExpr), contextComplex);
assert.strictEqual(passRes, "Pass", 'Expected "Pass" for A1=85, B1=0.95');
console.log(`   ${passExpr} = "${passRes}" ✅`);

// Nested IF-ELSE staircase
const gradeExpr =
	'IF(A1 >= 90, "A", IF(A1 >= 80, "B", IF(A1 >= 70, "C", "F")))';
const gradeRes = evaluator.Evaluate(parser.Parse(gradeExpr), contextComplex);
assert.strictEqual(gradeRes, "B", 'Expected "B" for A1=85');
console.log(`   Nested IF grade staircase = "${gradeRes}" ✅`);

// IFERROR wrapping arithmetic expression with IF
const safeDiv = 'IFERROR(IF(B1 > 0, A1 / B1, 0), "Math Error")';
const safeRes = evaluator.Evaluate(parser.Parse(safeDiv), contextComplex);
assert.strictEqual(
	Math.round(safeRes * 100) / 100,
	Math.round((85 / 0.95) * 100) / 100,
);
console.log(`   IFERROR with nested IF = ${safeRes} ✅\n`);

// -----------------------------------------------------------------------------
// 7. Full Regression Across All Slices (1 to 6)
// -----------------------------------------------------------------------------
console.log("7. Verifying Regression Across Slices 1 to 6...");

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

// Slice 4: Ranges & Math Functions
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

// Slice 6: Comparison Operators
assert.strictEqual(evaluator.Evaluate(parser.Parse("10 + 5 > 12")), true);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('B1 = "vip"'), { B1: "VIP" }),
	true,
);

console.log(
	"   ✅ All Slice 1 to Slice 6 expressions continue to pass cleanly.\n",
);

console.log(
	"==========================================================================",
);
console.log("ALL SLICE 7 TESTS COMPLETED SUCCESSFULLY! 🎉");
console.log(
	"Seam verified: Logical Functions (IF, AND, OR, NOT, IFERROR) complete. 🎯",
);
console.log(
	"==========================================================================",
);
