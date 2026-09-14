/**
 * scratch/test_slice2.js
 *
 * Automated verification suite for Slice 2 of Phase 7:
 * Cell References (A1, B2) and ReferenceResolver Integration.
 *
 * Checks:
 * 1. Universal PascalCase compliance across ReferenceResolver and CellReferenceNode.
 * 2. Bidirectional coordinate transformations in ReferenceResolver.
 * 3. CST -> AST generation producing pure CellReferenceNode DTOs.
 * 4. Evaluation of formulas containing cell references across multiple context styles.
 * 5. Case-insensitivity, empty cell handling, unary operators, and error propagation.
 */

const assert = require("assert");
const {
	ASTNode,
	NumberNode,
	UnaryOpNode,
	BinaryOpNode,
	CellReferenceNode,
	ErrorNode,
} = require("../FormulaAST.js");
const { ReferenceResolver } = require("../ReferenceResolver.js");
const { FormulaParser, OhmFormulaParser } = require("../FormulaParser.js");
const { FormulaEvaluator } = require("../FormulaEvaluator.js");

console.log(
	"==========================================================================",
);
console.log(
	"RUNNING SLICE 2 VERIFICATION: CELL REFERENCES & REFERENCE RESOLVER",
);
console.log(
	"==========================================================================\n",
);

// 1. Strict PascalCase Verification
console.log("1. Verifying Universal PascalCase constraints...");
function VerifyPascalCase(cls, instance) {
	const proto = Object.getPrototypeOf(instance);
	const methods = Object.getOwnPropertyNames(proto).filter(
		(name) => name !== "constructor" && !name.startsWith("_"),
	);
	for (const method of methods) {
		assert(
			/^[A-Z]/.test(method),
			`Method ${cls.name}.${method} does not start with an uppercase letter (PascalCase)!`,
		);
	}

	const props = Object.keys(instance).filter((name) => !name.startsWith("_"));
	for (const prop of props) {
		assert(
			/^[A-Z]/.test(prop),
			`Property ${cls.name}.${prop} does not start with an uppercase letter (PascalCase)!`,
		);
	}
}

const resolver = new ReferenceResolver();
const cellRefNode = new CellReferenceNode("A1", 0, 1, "A");
const parser = new OhmFormulaParser();
const evaluator = new FormulaEvaluator();

VerifyPascalCase(ReferenceResolver, resolver);
VerifyPascalCase(CellReferenceNode, cellRefNode);
console.log(
	"   ✅ Universal PascalCase strictly adhered to across all Slice 2 components.\n",
);

// 2. ReferenceResolver Coordinate Transformations
console.log(
	"2. Verifying ReferenceResolver bidirectional coordinate mapping...",
);
// ToColumnName (0-based -> Excel letter)
assert.strictEqual(resolver.ToColumnName(0), "A");
assert.strictEqual(resolver.ToColumnName(1), "B");
assert.strictEqual(resolver.ToColumnName(25), "Z");
assert.strictEqual(resolver.ToColumnName(26), "AA");
assert.strictEqual(resolver.ToColumnName(27), "AB");
assert.strictEqual(resolver.ToColumnName(51), "AZ");
assert.strictEqual(resolver.ToColumnName(52), "BA");
assert.strictEqual(resolver.ToColumnName(701), "ZZ");
assert.strictEqual(resolver.ToColumnName(702), "AAA");

// ToColumnIndex (Excel letter -> 0-based index)
assert.strictEqual(resolver.ToColumnIndex("A"), 0);
assert.strictEqual(resolver.ToColumnIndex("B"), 1);
assert.strictEqual(resolver.ToColumnIndex("Z"), 25);
assert.strictEqual(resolver.ToColumnIndex("AA"), 26);
assert.strictEqual(resolver.ToColumnIndex("AB"), 27);
assert.strictEqual(resolver.ToColumnIndex("AZ"), 51);
assert.strictEqual(resolver.ToColumnIndex("BA"), 52);
assert.strictEqual(resolver.ToColumnIndex("ZZ"), 701);
assert.strictEqual(resolver.ToColumnIndex("AAA"), 702);

// Case-insensitivity in ToColumnIndex
assert.strictEqual(resolver.ToColumnIndex("a"), 0);
assert.strictEqual(resolver.ToColumnIndex("aa"), 26);
assert.strictEqual(resolver.ToColumnIndex("aB"), 27);

// CoordsToCellKey & CellKeyToCoords round-trip
assert.strictEqual(resolver.CoordsToCellKey(1, 0), "A1");
assert.strictEqual(resolver.CoordsToCellKey(10, 26), "AA10");

const parsedA1 = resolver.CellKeyToCoords("A1");
assert.deepStrictEqual(parsedA1, { RowKey: 1, ColKey: 0, ColLetter: "A" });

const parsedLowercase = resolver.CellKeyToCoords("b12");
assert.deepStrictEqual(parsedLowercase, {
	RowKey: 12,
	ColKey: 1,
	ColLetter: "B",
});

const parsedAA100 = resolver.CellKeyToCoords("AA100");
assert.deepStrictEqual(parsedAA100, {
	RowKey: 100,
	ColKey: 26,
	ColLetter: "AA",
});

assert.strictEqual(resolver.CellKeyToCoords("INVALID"), null);
assert.strictEqual(
	resolver.CellKeyToCoords("A0"),
	null,
	"Row 0 is invalid in 1-based indexing",
);
assert.strictEqual(resolver.IsValidCellReference("A1"), true);
assert.strictEqual(resolver.IsValidCellReference("1A"), false);
console.log(
	"   ✅ ReferenceResolver coordinate transformations verified (including multi-letter & round-trips).\n",
);

// 3. Parser AST Generation for Cell References
console.log("3. Verifying Parser AST Generation for Cell References...");
const ast1 = parser.Parse("A1 + B1");
assert(ast1 instanceof BinaryOpNode);
assert.strictEqual(ast1.Operator, "+");
assert(ast1.Left instanceof CellReferenceNode);
assert.strictEqual(ast1.Left.RawReference, "A1");
assert.strictEqual(ast1.Left.ColIndex, 0);
assert.strictEqual(ast1.Left.RowIndex, 1);
assert.strictEqual(ast1.Left.ColLetter, "A");
assert(ast1.Right instanceof CellReferenceNode);
assert.strictEqual(ast1.Right.RawReference, "B1");
assert.strictEqual(ast1.Right.ColIndex, 1);
assert.strictEqual(ast1.Right.RowIndex, 1);
assert.strictEqual(ast1.Right.ColLetter, "B");
console.log(`   "A1 + B1" -> ${ast1.ToString()} ✅`);

// Case-insensitivity in formula text
const astCase = parser.Parse("a1 * 2 + B2");
assert(astCase instanceof BinaryOpNode);
assert.strictEqual(astCase.Left.Left.RawReference, "A1");
assert.strictEqual(astCase.Right.RawReference, "B2");
console.log(
	`   "a1 * 2 + B2" -> ${astCase.ToString()} (normalized to uppercase) ✅\n`,
);

// 4. Evaluation with Mock Data Contexts
console.log(
	"4. Verifying Evaluation of Cell References with Mock Data Contexts...",
);
const mockContextMap = {
	A1: 10,
	B1: 20,
	B2: 5,
	Z1: 100,
};

// Simple addition
const res1 = evaluator.Evaluate(parser.Parse("A1 + B1"), mockContextMap);
assert.strictEqual(res1, 30, "A1 (10) + B1 (20) must be 30");
console.log("   A1 + B1 = 30 ✅");

// Mixed references and numbers with precedence
const res2 = evaluator.Evaluate(parser.Parse("A1 * 2 + B2"), mockContextMap);
assert.strictEqual(res2, 25, "10 * 2 + 5 must be 25");
console.log("   A1 * 2 + B2 = 25 ✅");

// Grouping with parentheses
const res3 = evaluator.Evaluate(parser.Parse("(A1 + B1) * B2"), mockContextMap);
assert.strictEqual(res3, 150, "(10 + 20) * 5 must be 150");
console.log("   (A1 + B1) * B2 = 150 ✅");

// Unary negation on cell reference
const res4 = evaluator.Evaluate(parser.Parse("-A1 + 25"), mockContextMap);
assert.strictEqual(res4, 15, "-10 + 25 must be 15");
console.log("   -A1 + 25 = 15 ✅");

// Empty/missing cell resolves to 0 in arithmetic
const res5 = evaluator.Evaluate(parser.Parse("A1 + C1"), mockContextMap);
assert.strictEqual(res5, 10, "A1 (10) + empty C1 (0) must be 10");
console.log("   A1 + C1 (empty) = 10 ✅");

// Error propagation from referenced cell
const mockErrorContext = {
	A1: 10,
	B1: "#DIV/0!",
	C1: "#REF!",
};
const resErr1 = evaluator.Evaluate(parser.Parse("A1 + B1"), mockErrorContext);
assert.strictEqual(
	resErr1,
	"#DIV/0!",
	"Referenced #DIV/0! error must propagate",
);
console.log("   A1 + B1 (#DIV/0!) = #DIV/0! ✅");

const resErr2 = evaluator.Evaluate(parser.Parse("C1 * 2"), mockErrorContext);
assert.strictEqual(resErr2, "#REF!", "Referenced #REF! error must propagate");
console.log("   C1 (#REF!) * 2 = #REF! ✅");

// Functional data provider context
const functionalContext = {
	GetCellValue(rowKey, colKey) {
		if (rowKey === 1 && colKey === 0) return 42; // A1
		if (rowKey === 1 && colKey === 1) return 8; // B1
		return 0;
	},
};
const resFunc = evaluator.Evaluate(parser.Parse("A1 / B1"), functionalContext);
assert.strictEqual(resFunc, 5.25, "42 / 8 must be 5.25");
console.log(
	"   Functional context GetCellValue(row, col): A1 / B1 = 5.25 ✅\n",
);

// 5. Existing Slice 1 tests regression check
console.log(
	"5. Regression check: Ensuring Slice 1 arithmetic remains 100% operational...",
);
assert.strictEqual(evaluator.Evaluate(parser.Parse("10 + 20 * 3")), 70);
assert.strictEqual(evaluator.Evaluate(parser.Parse("(10 + 20) * 3")), 90);
assert.strictEqual(evaluator.Evaluate(parser.Parse("100 / 4 - 5")), 20);
assert.strictEqual(evaluator.Evaluate(parser.Parse("-10 + 25")), 15);
assert.strictEqual(evaluator.Evaluate(parser.Parse("10 / 0")), "#DIV/0!");
console.log(
	"   ✅ All Slice 1 arithmetic expressions continue to pass cleanly.\n",
);

console.log(
	"==========================================================================",
);
console.log("ALL SLICE 2 TESTS COMPLETED SUCCESSFULLY! 🎉");
console.log(
	"Seam verified: Cell References (A1, B1) & ReferenceResolver complete. 🎯",
);
console.log(
	"==========================================================================",
);
