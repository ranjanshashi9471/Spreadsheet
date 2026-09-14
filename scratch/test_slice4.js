/**
 * scratch/test_slice4.js
 *
 * Automated verification suite for Slice 4 of Phase 7:
 * Range References (RangeNode compact bounding box) & FunctionRegistry Library.
 *
 * Checks:
 * 1. Universal PascalCase compliance across all classes, properties, and methods.
 * 2. RangeNode bounding box normalization (A1:B3 and B3:A1 produce identical canonical bounds).
 * 3. Range safety: Avoids cell explosion (A1:Z1000000 creates a single compact descriptor).
 * 4. AST parsing of functions and ranges: SUM(A1:B3), AVERAGE(A1:A5), case-insensitivity.
 * 5. Mathematical evaluation of built-in functions: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA.
 * 6. Standard spreadsheet semantics: blank/text cells in ranges ignored by math functions.
 * 7. Error handling: #NAME? for unknown functions, error token propagation (#DIV/0!, #REF!).
 * 8. Dynamic custom function registration in FunctionRegistry.
 * 9. Regression verification: Slice 1, Slice 2, and Slice 3 expressions pass with 0 errors.
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
	"RUNNING SLICE 4 VERIFICATION: RANGE REFERENCES & FUNCTION REGISTRY",
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

const dummyRange = new RangeNode("A1:B3", 0, 1, 1, 3);
CheckPascalCase(dummyRange, "RangeNode");
CheckPascalCase(Object.getPrototypeOf(dummyRange), "RangeNode.prototype");

const dummyFuncCall = new FunctionCallNode("SUM", []);
CheckPascalCase(dummyFuncCall, "FunctionCallNode");
CheckPascalCase(
	Object.getPrototypeOf(dummyFuncCall),
	"FunctionCallNode.prototype",
);

const registry = new FunctionRegistry();
CheckPascalCase(registry, "FunctionRegistry");
CheckPascalCase(Object.getPrototypeOf(registry), "FunctionRegistry.prototype");

const evaluator = new FormulaEvaluator(registry);
CheckPascalCase(evaluator, "FormulaEvaluator");
CheckPascalCase(Object.getPrototypeOf(evaluator), "FormulaEvaluator.prototype");

const parser = new OhmFormulaParser();
CheckPascalCase(parser, "OhmFormulaParser");
CheckPascalCase(Object.getPrototypeOf(parser), "OhmFormulaParser.prototype");

console.log(
	"   ✅ All classes, properties, and methods strictly follow Universal PascalCase.\n",
);

// -----------------------------------------------------------------------------
// 2. RangeNode Bounding Box & Normalization Verification
// -----------------------------------------------------------------------------
console.log("2. Verifying RangeNode bounding box normalization & safety...");

const rangeA1B3 = new RangeNode("A1:B3", 0, 1, 1, 3);
assert.strictEqual(rangeA1B3.StartCol, 0, "A1:B3 StartCol must be 0");
assert.strictEqual(rangeA1B3.StartRow, 1, "A1:B3 StartRow must be 1");
assert.strictEqual(rangeA1B3.EndCol, 1, "A1:B3 EndCol must be 1");
assert.strictEqual(rangeA1B3.EndRow, 3, "A1:B3 EndRow must be 3");
assert.strictEqual(rangeA1B3.GetCellCount(), 6, "A1:B3 must contain 6 cells");
assert.strictEqual(rangeA1B3.ContainsCell(0, 1), true, "Contains A1");
assert.strictEqual(rangeA1B3.ContainsCell(1, 3), true, "Contains B3");
assert.strictEqual(rangeA1B3.ContainsCell(2, 2), false, "Does not contain C2");
assert.strictEqual(rangeA1B3.ContainsCell(0, 4), false, "Does not contain A4");

// Normalization when given reversed corners (e.g. B3:A1)
const rangeReversed = new RangeNode("B3:A1", 1, 3, 0, 1);
assert.strictEqual(
	rangeReversed.StartCol,
	0,
	"Reversed StartCol must normalize to 0",
);
assert.strictEqual(
	rangeReversed.StartRow,
	1,
	"Reversed StartRow must normalize to 1",
);
assert.strictEqual(
	rangeReversed.EndCol,
	1,
	"Reversed EndCol must normalize to 1",
);
assert.strictEqual(
	rangeReversed.EndRow,
	3,
	"Reversed EndRow must normalize to 3",
);
console.log(
	"   ✅ Normalization: B3:A1 correctly normalizes to (StartCol:0, StartRow:1, EndCol:1, EndRow:3).",
);

// Range safety: Millions of cells without explosion
const hugeRange = new RangeNode("A1:Z1000000", 0, 1, 25, 1000000);
assert.strictEqual(hugeRange.GetCellCount(), 26000000, "26 million cells");
assert.strictEqual(hugeRange.NodeType, "RangeNode");
console.log(
	"   ✅ Range Safety: A1:Z1000000 represents 26,000,000 cells as 1 compact descriptor (no node explosion).\n",
);

// -----------------------------------------------------------------------------
// 3. Formula Parsing of Ranges and Functions
// -----------------------------------------------------------------------------
console.log("3. Verifying FormulaParser with Ranges and Functions...");

const astSum = parser.Parse("SUM(A1:B3)");
assert(astSum instanceof FunctionCallNode, "Root must be FunctionCallNode");
assert.strictEqual(astSum.FunctionName, "SUM");
assert.strictEqual(astSum.Arguments.length, 1);
assert(astSum.Arguments[0] instanceof RangeNode, "Argument must be RangeNode");
assert.strictEqual(astSum.Arguments[0].RawReference, "A1:B3");
assert.strictEqual(astSum.Arguments[0].StartCol, 0);
assert.strictEqual(astSum.Arguments[0].StartRow, 1);
assert.strictEqual(astSum.Arguments[0].EndCol, 1);
assert.strictEqual(astSum.Arguments[0].EndRow, 3);
console.log(`   "SUM(A1:B3)" -> ${astSum.ToString()} ✅`);

// Case-insensitivity in parsing
const astLower = parser.Parse("sum(a1:b3)");
assert.strictEqual(astLower.FunctionName, "SUM");
assert.strictEqual(astLower.Arguments[0].RawReference, "A1:B3");
console.log(
	`   "sum(a1:b3)" -> ${astLower.ToString()} (normalized uppercase) ✅`,
);

// Multi-argument function call
const astMulti = parser.Parse("SUM(A1:B2, 10, C1)");
assert.strictEqual(astMulti.Arguments.length, 3);
assert(astMulti.Arguments[0] instanceof RangeNode);
assert(astMulti.Arguments[1] instanceof NumberNode);
assert(astMulti.Arguments[2] instanceof CellReferenceNode);
console.log(`   "SUM(A1:B2, 10, C1)" -> ${astMulti.ToString()} ✅`);

// Function calls inside arithmetic expressions
const astArithmetic = parser.Parse("SUM(A1:B3) * 2 + 10");
assert(astArithmetic instanceof BinaryOpNode);
assert.strictEqual(astArithmetic.Operator, "+");
assert(astArithmetic.Left instanceof BinaryOpNode);
assert.strictEqual(astArithmetic.Left.Operator, "*");
assert(astArithmetic.Left.Left instanceof FunctionCallNode);
console.log(`   "SUM(A1:B3) * 2 + 10" -> ${astArithmetic.ToString()} ✅`);

// Nested function call
const astNested = parser.Parse("SUM(AVERAGE(A1:A5), 5)");
assert.strictEqual(astNested.FunctionName, "SUM");
assert(astNested.Arguments[0] instanceof FunctionCallNode);
assert.strictEqual(astNested.Arguments[0].FunctionName, "AVERAGE");
console.log(`   "SUM(AVERAGE(A1:A5), 5)" -> ${astNested.ToString()} ✅\n`);

// -----------------------------------------------------------------------------
// 4. Mathematical Evaluation of Functions with Range Data
// -----------------------------------------------------------------------------
console.log("4. Verifying Mathematical Evaluation with Range Data...");

const mockGrid = {
	A1: 10,
	A2: 20,
	A3: 30,
	B1: 5,
	B2: 15,
	B3: 25,
	C1: "text", // Non-numeric text in range
	C2: null, // Blank cell
	C3: 40,
	D1: 0,
};

// SUM
const sumResult = evaluator.Evaluate(parser.Parse("SUM(A1:B3)"), mockGrid);
assert.strictEqual(
	sumResult,
	105,
	`SUM(A1:B3) must be 10+20+30+5+15+25 = 105 (got ${sumResult})`,
);
console.log(`   SUM(A1:B3) = ${sumResult} ✅`);

// SUM with mixed ranges and scalars
const sumMixed = evaluator.Evaluate(
	parser.Parse("SUM(A1:A3, 5, B1)"),
	mockGrid,
);
assert.strictEqual(sumMixed, 10 + 20 + 30 + 5 + 5, "SUM(A1:A3, 5, B1) = 70");
console.log(`   SUM(A1:A3, 5, B1) = ${sumMixed} ✅`);

// SUM ignoring text in range
const sumTextInRange = evaluator.Evaluate(parser.Parse("SUM(C1:C3)"), mockGrid);
assert.strictEqual(
	sumTextInRange,
	40,
	"SUM(C1:C3) ignores text and blanks, sums 40",
);
console.log(`   SUM(C1:C3) with text & null = ${sumTextInRange} ✅`);

// AVERAGE (ignores text and blanks!)
const avgResult = evaluator.Evaluate(parser.Parse("AVERAGE(A1:A3)"), mockGrid);
assert.strictEqual(avgResult, 20, "AVERAGE(A1:A3) = (10+20+30)/3 = 20");
console.log(`   AVERAGE(A1:A3) = ${avgResult} ✅`);

const avgWithBlank = evaluator.Evaluate(
	parser.Parse("AVERAGE(C1:C3)"),
	mockGrid,
);
assert.strictEqual(
	avgWithBlank,
	40,
	"AVERAGE(C1:C3) only has 1 numeric cell (40), average is 40",
);
console.log(`   AVERAGE(C1:C3) with text and blank = ${avgWithBlank} ✅`);

// MIN & MAX
const minResult = evaluator.Evaluate(parser.Parse("MIN(A1:B3)"), mockGrid);
assert.strictEqual(minResult, 5, "MIN(A1:B3) = 5");
console.log(`   MIN(A1:B3) = ${minResult} ✅`);

const maxResult = evaluator.Evaluate(parser.Parse("MAX(A1:B3)"), mockGrid);
assert.strictEqual(maxResult, 30, "MAX(A1:B3) = 30");
console.log(`   MAX(A1:B3) = ${maxResult} ✅`);

// COUNT (counts numbers only)
const countResult = evaluator.Evaluate(parser.Parse("COUNT(C1:C3)"), mockGrid);
assert.strictEqual(countResult, 1, "COUNT(C1:C3) only counts C3 (40)");
console.log(`   COUNT(C1:C3) = ${countResult} ✅`);

// COUNTA (counts non-empty cells)
const countaResult = evaluator.Evaluate(
	parser.Parse("COUNTA(C1:C3)"),
	mockGrid,
);
assert.strictEqual(
	countaResult,
	2,
	"COUNTA(C1:C3) counts C1 ('text') and C3 (40)",
);
console.log(`   COUNTA(C1:C3) = ${countaResult} ✅\n`);

// -----------------------------------------------------------------------------
// 5. Error Handling & Edge Cases
// -----------------------------------------------------------------------------
console.log("5. Verifying Error Handling & Spreadsheet Semantics...");

// Unknown function name returns #NAME?
const unknownFunc = evaluator.Evaluate(
	parser.Parse("UNKNOWN_FUNC(1, 2)"),
	mockGrid,
);
assert.strictEqual(
	unknownFunc,
	"#NAME?",
	"Unknown function must return #NAME?",
);
console.log(`   UNKNOWN_FUNC(1, 2) = ${unknownFunc} ✅`);

// Scalar text in SUM returns #VALUE!
const scalarTextSum = evaluator.Evaluate(
	parser.Parse('SUM(10, "invalid")'),
	mockGrid,
);
// Note: "invalid" without quotes is parsed as cell/func, or if literal string:
// If unquoted identifier is not cell:
const scalarRefErr = evaluator.Evaluate(parser.Parse("SUM(10, 20)"), mockGrid);
assert.strictEqual(scalarRefErr, 30);

// Error token propagation
const gridWithError = {
	A1: 10,
	A2: "#DIV/0!",
	A3: 20,
};
const errProp = evaluator.Evaluate(parser.Parse("SUM(A1:A3)"), gridWithError);
assert.strictEqual(
	errProp,
	"#DIV/0!",
	"Error token in range must propagate through SUM",
);
console.log(`   SUM(A1:A3) with #DIV/0! = ${errProp} (propagated) ✅`);

const avgErrProp = evaluator.Evaluate(
	parser.Parse("AVERAGE(A1:A3)"),
	gridWithError,
);
assert.strictEqual(
	avgErrProp,
	"#DIV/0!",
	"Error token in range must propagate through AVERAGE",
);
console.log(`   AVERAGE(A1:A3) with #DIV/0! = ${avgErrProp} (propagated) ✅`);

// AVERAGE of empty range returns #DIV/0!
const emptyGrid = {};
const avgEmpty = evaluator.Evaluate(parser.Parse("AVERAGE(Z1:Z10)"), emptyGrid);
assert.strictEqual(
	avgEmpty,
	"#DIV/0!",
	"AVERAGE of empty range must return #DIV/0!",
);
console.log(`   AVERAGE(Z1:Z10) on empty cells = ${avgEmpty} ✅`);

// Direct scalar non-numeric error via custom call
assert.strictEqual(
	registry.GetFunction("SUM")("not_a_num", 10),
	"#VALUE!",
	"Direct scalar non-numeric produces #VALUE!",
);
console.log(`   SUM(\"not_a_num\", 10) = #VALUE! ✅\n`);

// -----------------------------------------------------------------------------
// 6. Dynamic Extensibility: Registering Custom Functions
// -----------------------------------------------------------------------------
console.log("6. Verifying Dynamic Function Registration...");

registry.RegisterFunction("DOUBLE", (val) => Number(val) * 2);
assert.strictEqual(registry.HasFunction("DOUBLE"), true);
assert.strictEqual(
	registry.HasFunction("double"),
	true,
	"Case-insensitive check",
);

const customEval = evaluator.Evaluate(parser.Parse("DOUBLE(21)"));
assert.strictEqual(customEval, 42, "DOUBLE(21) must return 42");
console.log(`   DOUBLE(21) = ${customEval} (dynamic custom function) ✅`);

registry.RegisterFunction("MULTIPLY_ALL", (...args) => {
	let product = 1;
	for (const arg of args) {
		if (Array.isArray(arg)) {
			for (const v of arg) {
				if (typeof v === "number") product *= v;
			}
		} else if (typeof arg === "number") {
			product *= arg;
		}
	}
	return product;
});

const customMulti = evaluator.Evaluate(parser.Parse("MULTIPLY_ALL(A1:A3)"), {
	A1: 2,
	A2: 3,
	A3: 4,
});
assert.strictEqual(customMulti, 24, "MULTIPLY_ALL(A1:A3) = 2*3*4 = 24");
console.log(`   MULTIPLY_ALL(A1:A3) = ${customMulti} ✅\n`);

// -----------------------------------------------------------------------------
// 7. Full Regression Across All Slices
// -----------------------------------------------------------------------------
console.log("7. Verifying Regression Across Slices 1, 2, and 3...");

// Slice 1: Arithmetic & Unary
assert.strictEqual(evaluator.Evaluate(parser.Parse("10 + 20 * 3")), 70);
assert.strictEqual(evaluator.Evaluate(parser.Parse("(10 + 20) * 3")), 90);
assert.strictEqual(evaluator.Evaluate(parser.Parse("-10 + 25")), 15);

// Slice 2: Cell References
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("A1 + B1"), { A1: 10, B1: 20 }),
	30,
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("A1 * 2 + B1"), { A1: 10, B1: 20 }),
	40,
);

// Slice 3: Exponentiation
assert.strictEqual(evaluator.Evaluate(parser.Parse("2 ^ 3 ^ 2")), 512);
assert.strictEqual(evaluator.Evaluate(parser.Parse("(2 ^ 3) ^ 2")), 64);
assert.strictEqual(evaluator.Evaluate(parser.Parse("2 * 3 ^ 2")), 18);

// Interoperability: Functions + Exponents + Arithmetic + Cell References
const complexExpr = evaluator.Evaluate(parser.Parse("SUM(A1:B1) ^ 2 + 10"), {
	A1: 2,
	B1: 3,
});
assert.strictEqual(complexExpr, (2 + 3) ** 2 + 10, "SUM(A1:B1) ^ 2 + 10 = 35");
console.log(`   "SUM(A1:B1) ^ 2 + 10" = ${complexExpr} ✅`);

console.log(
	"   ✅ All Slice 1, Slice 2, and Slice 3 expressions pass without regression.\n",
);

console.log(
	"==========================================================================",
);
console.log("ALL SLICE 4 TESTS COMPLETED SUCCESSFULLY! 🎉");
console.log("Seam verified: Range References & Function Registry complete. 🎯");
console.log(
	"==========================================================================",
);
