/**
 * scratch/test_slice1.js
 *
 * Automated verification suite for Slice 1 of Phase 7:
 * Arithmetic Expression Formula Engine (Ohm -> CST -> AST -> Evaluator -> Result).
 *
 * Checks:
 * 1. Syntax integrity.
 * 2. Strict universal PascalCase naming.
 * 3. AST construction and operator precedence.
 * 4. Evaluation accuracy across arithmetic, grouping, and unary operators.
 * 5. Error handling (#DIV/0!, #ERROR!).
 * 6. Encapsulation of Ohm and pure DOM-independent execution.
 */

const assert = require("assert");
const {
	NumberNode,
	UnaryOpNode,
	BinaryOpNode,
	ErrorNode,
	ASTNode,
} = require("../FormulaAST.js");
const { FormulaParser, OhmFormulaParser } = require("../FormulaParser.js");
const { FormulaEvaluator } = require("../FormulaEvaluator.js");

console.log(
	"==========================================================================",
);
console.log(
	"RUNNING SLICE 1 VERIFICATION: ARITHMETIC ENGINE (OHM -> AST -> EVALUATOR)",
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

const parser = new OhmFormulaParser();
const evaluator = new FormulaEvaluator();
const numNode = new NumberNode(42);
const unaryNode = new UnaryOpNode("-", numNode);
const binaryNode = new BinaryOpNode("+", numNode, numNode);
const errorNode = new ErrorNode("#ERROR!");

VerifyPascalCase(NumberNode, numNode);
VerifyPascalCase(UnaryOpNode, unaryNode);
VerifyPascalCase(BinaryOpNode, binaryNode);
VerifyPascalCase(ErrorNode, errorNode);
VerifyPascalCase(OhmFormulaParser, parser);
VerifyPascalCase(FormulaEvaluator, evaluator);
console.log(
	"   ✅ Universal PascalCase strictly adhered to across all classes, properties, and methods.\n",
);

// 2. Ohm Encapsulation Verification
console.log("2. Verifying Ohm Encapsulation...");
assert(
	parser instanceof FormulaParser,
	"OhmFormulaParser must extend FormulaParser",
);
assert(!("Ohm" in evaluator), "FormulaEvaluator must NOT know about Ohm");
assert(!("ohmLib" in evaluator), "FormulaEvaluator must NOT reference ohmLib");
console.log("   ✅ Ohm is strictly encapsulated inside OhmFormulaParser.\n");

// 3. Exact Target Pipeline: "10 + 20 * 3"
console.log(
	"3. Verifying Exact Target Pipeline: '10 + 20 * 3' -> AST -> 70...",
);
const targetInput = "10 + 20 * 3";
const targetAst = parser.Parse(targetInput);

assert(targetAst instanceof BinaryOpNode, "Root AST must be BinaryOpNode");
assert.strictEqual(targetAst.Operator, "+", "Root operator must be '+'");
assert(targetAst.Left instanceof NumberNode, "Left child must be NumberNode");
assert.strictEqual(targetAst.Left.Value, 10, "Left child value must be 10");
assert(
	targetAst.Right instanceof BinaryOpNode,
	"Right child must be BinaryOpNode (precedence)",
);
assert.strictEqual(
	targetAst.Right.Operator,
	"*",
	"Right child operator must be '*'",
);
assert.strictEqual(
	targetAst.Right.Left.Value,
	20,
	"Right-left value must be 20",
);
assert.strictEqual(
	targetAst.Right.Right.Value,
	3,
	"Right-right value must be 3",
);

const targetResult = evaluator.Evaluate(targetAst);
assert.strictEqual(targetResult, 70, "10 + 20 * 3 must evaluate to 70");
console.log(
	`   Pipeline output: "${targetInput}" -> ${targetAst.ToString()} -> ${targetResult} ✅\n`,
);

// 4. Precedence, Grouping, and Associativity
console.log("4. Verifying Precedence, Grouping, and Associativity...");
const testCases = [
	{
		input: "10 + 20 * 3",
		expected: 70,
		note: "Multiplication before addition",
	},
	{
		input: "(10 + 20) * 3",
		expected: 90,
		note: "Parentheses override precedence",
	},
	{ input: "100 / 4 - 5", expected: 20, note: "Division before subtraction" },
	{ input: "100 / (4 - 2)", expected: 50, note: "Parentheses in denominator" },
	{ input: "-10 + 25", expected: 15, note: "Unary negation at start" },
	{
		input: "25 + -10",
		expected: 15,
		note: "Unary negation after binary operator",
	},
	{ input: "+5 + +15", expected: 20, note: "Unary positive signs" },
	{ input: "10 + 20 + 30", expected: 60, note: "Left-associative addition" },
	{
		input: "24 / 4 / 2",
		expected: 3,
		note: "Left-associative division: (24 / 4) / 2",
	},
	{ input: "3.5 * 2 + 1.25", expected: 8.25, note: "Floating point numbers" },
	{
		input: "(2 + 3) * (4 + 5)",
		expected: 45,
		note: "Nested grouped expressions",
	},
	{ input: "=10 + 20 * 3", expected: 70, note: "Leading '=' formula prefix" },
	{
		input: "  = ( 15 - 5 ) * 2  ",
		expected: 20,
		note: "Whitespace tolerance and leading '='",
	},
];

for (const tc of testCases) {
	const ast = parser.Parse(tc.input);
	assert(
		!(ast instanceof ErrorNode),
		`Parse should not fail for '${tc.input}'`,
	);
	const res = evaluator.Evaluate(ast);
	assert.strictEqual(
		res,
		tc.expected,
		`Failed '${tc.input}' (${tc.note}): expected ${tc.expected}, got ${res}`,
	);
	console.log(`   "${tc.input}" = ${res} (${tc.note}) ✅`);
}
console.log();

// 5. Error Handling
console.log("5. Verifying Error Handling (#DIV/0!, #ERROR!)...");
// Division by zero
const divZeroAst = parser.Parse("10 / 0");
const divZeroResult = evaluator.Evaluate(divZeroAst);
assert.strictEqual(
	divZeroResult,
	"#DIV/0!",
	"Division by zero must return #DIV/0!",
);
console.log("   '10 / 0' -> #DIV/0! ✅");

// Division by zero nested
const nestedDivZeroAst = parser.Parse("(10 / 0) + 5");
const nestedDivZeroResult = evaluator.Evaluate(nestedDivZeroAst);
assert.strictEqual(
	nestedDivZeroResult,
	"#DIV/0!",
	"Nested division by zero must propagate #DIV/0!",
);
console.log("   '(10 / 0) + 5' -> #DIV/0! ✅");

// Syntax error
const syntaxErrAst = parser.Parse("10 ++ *");
assert(syntaxErrAst instanceof ErrorNode, "Syntax error must return ErrorNode");
const syntaxErrResult = evaluator.Evaluate(syntaxErrAst);
assert.strictEqual(
	syntaxErrResult,
	"#ERROR!",
	"Syntax error must evaluate to #ERROR!",
);
console.log("   '10 ++ *' -> #ERROR! ✅");

// Empty formula
const emptyAst = parser.Parse("=");
assert(emptyAst instanceof ErrorNode, "Empty formula must return ErrorNode");
assert.strictEqual(
	evaluator.Evaluate(emptyAst),
	"#ERROR!",
	"Empty formula must evaluate to #ERROR!",
);
console.log("   '=' -> #ERROR! ✅\n");

console.log(
	"==========================================================================",
);
console.log("ALL SLICE 1 TESTS COMPLETED SUCCESSFULLY! 🎉");
console.log(
	"Seam verified: Ohm -> CST -> AST -> Evaluator -> 70. Ready for Slice 2. 🎯",
);
console.log(
	"==========================================================================",
);
