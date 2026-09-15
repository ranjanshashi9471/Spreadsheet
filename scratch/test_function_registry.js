/**
 * test_function_registry.js
 *
 * Comprehensive test suite verifying Commit 3:
 * - Invariant 6: FunctionRegistry contains eager functions only (no IF/IFERROR)
 * - Shadowing protection against registering special syntactic forms
 * - FormulaEvaluator native lazy control flow for special forms
 * - Dependency injection and isolated evaluator/engine instances
 * - Shared ReferenceResolver invariant (engine.Evaluator.Resolver === engine.Graph.Resolver)
 * - Boundary arity validation (MinArgs / MaxArgs enforcing #VALUE!)
 * - Function name normalization and case-insensitivity
 * - Frozen metadata storage and category-filtered introspection
 * - All new built-in functions with spreadsheet semantics (MOD floor modulo, POWER, SQRT, etc.)
 * - Full end-to-end evaluation through CalculationEngine
 */

const assert = require("assert");
const {
	FormulaErrors,
	FormulaSpecialForms,
	IsFormulaError,
} = require("../Constants.js");
const { FunctionRegistry } = require("../FunctionRegistry.js");
const { FormulaEvaluator } = require("../FormulaEvaluator.js");
const { CalculationEngine } = require("../CalculationEngine.js");
const { ReferenceResolver } = require("../ReferenceResolver.js");
const { OhmFormulaParser } = require("../FormulaParser.js");

console.log(
	"=== Starting Commit 3 FunctionRegistry & Formula Architecture Verification ===\n",
);

const parser = new OhmFormulaParser();

// -----------------------------------------------------------------------------
// 1. Invariant 6 & Special Form Shadowing Protection
// -----------------------------------------------------------------------------
console.log("1. Verifying Invariant 6 & Special Form Shadowing Protection...");
const registry = new FunctionRegistry();

assert.strictEqual(
	registry.HasFunction("IF"),
	false,
	"Registry must not have IF",
);
assert.strictEqual(
	registry.HasFunction("IFERROR"),
	false,
	"Registry must not have IFERROR",
);
assert.strictEqual(
	registry.HasFunction("if"),
	false,
	"Registry HasFunction must be case-insensitive for IF",
);
assert.strictEqual(
	registry.HasFunction("iferror"),
	false,
	"Registry HasFunction must be case-insensitive for IFERROR",
);
assert.strictEqual(
	registry.GetFunction("IF"),
	null,
	"GetFunction('IF') must return null",
);
assert.strictEqual(
	registry.GetFunction("iferror"),
	null,
	"GetFunction('iferror') must return null",
);

// Shadowing attempts must throw explicit Errors
assert.throws(
	() => registry.RegisterFunction("IF", () => {}),
	/Cannot register 'IF': special syntactic forms are handled directly by FormulaEvaluator/,
	"Registering IF must throw shadowing error",
);
assert.throws(
	() => registry.RegisterFunction("if", () => {}),
	/Cannot register 'if': special syntactic forms are handled directly by FormulaEvaluator/,
	"Registering 'if' in lowercase must throw shadowing error",
);
assert.throws(
	() => registry.RegisterFunction("  IF  ", () => {}),
	/Cannot register '  IF  ': special syntactic forms are handled directly by FormulaEvaluator/,
	"Registering '  IF  ' with whitespace must throw shadowing error",
);
assert.throws(
	() => registry.RegisterFunction("IFERROR", () => {}),
	/Cannot register 'IFERROR': special syntactic forms are handled directly by FormulaEvaluator/,
	"Registering IFERROR must throw shadowing error",
);
assert.throws(
	() => registry.RegisterFunction("iferror", () => {}),
	/Cannot register 'iferror': special syntactic forms are handled directly by FormulaEvaluator/,
	"Registering 'iferror' in lowercase must throw shadowing error",
);
console.log("  PASSED: Invariant 6 and shadowing protection validated.");

// -----------------------------------------------------------------------------
// 2. Evaluator Special Forms Execution (Lazy Control Flow)
// -----------------------------------------------------------------------------
console.log("2. Verifying Evaluator Special Forms Lazy Control Flow...");
const evaluator = new FormulaEvaluator(registry);

// IF short-circuiting: false branch must NOT be evaluated if condition is true
const astIfTrue = parser.Parse("IF(TRUE, 10, 1 / 0)");
const resIfTrue = evaluator.Evaluate(astIfTrue);
assert.strictEqual(
	resIfTrue,
	10,
	"IF(TRUE, 10, 1/0) must short-circuit false branch and yield 10",
);

const astIfFalse = parser.Parse("IF(FALSE, 1 / 0, 20)");
const resIfFalse = evaluator.Evaluate(astIfFalse);
assert.strictEqual(
	resIfFalse,
	20,
	"IF(FALSE, 1/0, 20) must short-circuit true branch and yield 20",
);

const astIfNumAvoid = parser.Parse("IF(TRUE, 42, SQRT(-1))");
const resIfNumAvoid = evaluator.Evaluate(astIfNumAvoid);
assert.strictEqual(
	resIfNumAvoid,
	42,
	"IF(TRUE, 42, SQRT(-1)) must avoid evaluating invalid SQRT branch",
);

// IFERROR short-circuiting & fallback
const astIfError1 = parser.Parse('IFERROR(10 / 0, "Fallback")');
const resIfError1 = evaluator.Evaluate(astIfError1);
assert.strictEqual(
	resIfError1,
	"Fallback",
	"IFERROR(10/0, 'Fallback') must return fallback on #DIV/0!",
);

const astIfError2 = parser.Parse("IFERROR(50, 1 / 0)");
const resIfError2 = evaluator.Evaluate(astIfError2);
assert.strictEqual(
	resIfError2,
	50,
	"IFERROR(50, 1/0) must NOT evaluate fallback when primary value is healthy",
);

const astIfError3 = parser.Parse('IFERROR(SQRT(-4), "Negative")');
const resIfError3 = evaluator.Evaluate(astIfError3);
assert.strictEqual(
	resIfError3,
	"Negative",
	"IFERROR(SQRT(-4), 'Negative') must catch #NUM! error",
);

// Special forms arity
const astIfArity = parser.Parse("IF(TRUE)");
const resIfArity = evaluator.Evaluate(astIfArity);
assert.strictEqual(
	resIfArity,
	FormulaErrors.Value,
	"IF with 1 arg must return #VALUE!",
);

const astIfErrorArity = parser.Parse("IFERROR(10)");
const resIfErrorArity = evaluator.Evaluate(astIfErrorArity);
assert.strictEqual(
	resIfErrorArity,
	FormulaErrors.Value,
	"IFERROR with 1 arg must return #VALUE!",
);

console.log("  PASSED: Special forms lazy evaluation validated.");

// -----------------------------------------------------------------------------
// 3. Dependency Injection & Evaluator/Engine Isolation
// -----------------------------------------------------------------------------
console.log("3. Verifying Dependency Injection & Instance Isolation...");
const regA = new FunctionRegistry();
const regB = new FunctionRegistry();

regA.RegisterFunction("CUSTOM_FOO", (x) => x * 2, { MinArgs: 1, MaxArgs: 1 });
regB.RegisterFunction("CUSTOM_BAR", (x) => x * 10, { MinArgs: 1, MaxArgs: 1 });

const evalA = new FormulaEvaluator(regA);
const evalB = new FormulaEvaluator(regB);

const astFoo = parser.Parse("CUSTOM_FOO(5)");
const astBar = parser.Parse("CUSTOM_BAR(5)");

assert.strictEqual(
	evalA.Evaluate(astFoo),
	10,
	"evalA must evaluate CUSTOM_FOO",
);
assert.strictEqual(
	evalA.Evaluate(astBar),
	FormulaErrors.Name,
	"evalA must not have CUSTOM_BAR (#NAME?)",
);

assert.strictEqual(
	evalB.Evaluate(astBar),
	50,
	"evalB must evaluate CUSTOM_BAR",
);
assert.strictEqual(
	evalB.Evaluate(astFoo),
	FormulaErrors.Name,
	"evalB must not have CUSTOM_FOO (#NAME?)",
);

// CalculationEngine DI isolation
const engineA = new CalculationEngine(null, null, null, null, null, regA);
const engineB = new CalculationEngine(null, null, null, null, null, regB);

assert.strictEqual(engineA.Registry, regA, "engineA must hold regA");
assert.strictEqual(engineB.Registry, regB, "engineB must hold regB");
assert.notStrictEqual(
	engineA.Registry,
	engineB.Registry,
	"Engine registries must be independent instances",
);
console.log("  PASSED: DI and instance isolation validated.");

// -----------------------------------------------------------------------------
// 4. Shared ReferenceResolver Invariant
// -----------------------------------------------------------------------------
console.log("4. Verifying Shared ReferenceResolver Invariant...");
const defaultEngine = new CalculationEngine();
assert.ok(
	defaultEngine.Resolver instanceof ReferenceResolver,
	"Engine must instantiate ReferenceResolver",
);
assert.strictEqual(
	defaultEngine.Evaluator.Resolver,
	defaultEngine.Graph.Resolver,
	"Evaluator and Graph must share the exact same ReferenceResolver instance",
);
assert.strictEqual(
	defaultEngine.Evaluator.Resolver,
	defaultEngine.Resolver,
	"Evaluator and Engine must share the exact same ReferenceResolver instance",
);

const customResolver = new ReferenceResolver();
const engineWithCustomRes = new CalculationEngine(
	null,
	null,
	null,
	null,
	customResolver,
);
assert.strictEqual(
	engineWithCustomRes.Resolver,
	customResolver,
	"Engine must accept custom resolver",
);
assert.strictEqual(
	engineWithCustomRes.Graph.Resolver,
	customResolver,
	"Graph must receive custom resolver",
);
assert.strictEqual(
	engineWithCustomRes.Evaluator.Resolver,
	customResolver,
	"Evaluator must receive custom resolver",
);
console.log("  PASSED: Shared ReferenceResolver invariant validated.");

// -----------------------------------------------------------------------------
// 5. Arity Validation at Registry Boundary
// -----------------------------------------------------------------------------
console.log("5. Verifying Boundary Arity Validation...");
const arityRegistry = new FunctionRegistry();

// Direct calls to wrapped functions enforce arity
const sqrtFn = arityRegistry.GetFunction("SQRT");
assert.strictEqual(
	sqrtFn(),
	FormulaErrors.Value,
	"Direct SQRT() with 0 args must return #VALUE!",
);
assert.strictEqual(
	sqrtFn(16, 2),
	FormulaErrors.Value,
	"Direct SQRT(16, 2) with 2 args must return #VALUE!",
);
assert.strictEqual(sqrtFn(16), 4, "Direct SQRT(16) with 1 arg must return 4");

const notFn = arityRegistry.GetFunction("NOT");
assert.strictEqual(
	notFn(),
	FormulaErrors.Value,
	"Direct NOT() with 0 args must return #VALUE!",
);
assert.strictEqual(
	notFn(true, false),
	FormulaErrors.Value,
	"Direct NOT(true, false) with 2 args must return #VALUE!",
);
assert.strictEqual(notFn(true), false, "Direct NOT(true) must return false");

const modFn = arityRegistry.GetFunction("MOD");
assert.strictEqual(
	modFn(10),
	FormulaErrors.Value,
	"Direct MOD(10) with 1 arg must return #VALUE!",
);
assert.strictEqual(
	modFn(10, 3, 2),
	FormulaErrors.Value,
	"Direct MOD(10, 3, 2) with 3 args must return #VALUE!",
);

const trueFn = arityRegistry.GetFunction("TRUE");
assert.strictEqual(
	trueFn(1),
	FormulaErrors.Value,
	"Direct TRUE(1) with 1 arg must return #VALUE!",
);
assert.strictEqual(
	trueFn(),
	true,
	"Direct TRUE() with 0 args must return true",
);

// Through evaluator
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("SQRT()")),
	FormulaErrors.Value,
	"Evaluator SQRT() must yield #VALUE!",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("SQRT(16, 2)")),
	FormulaErrors.Value,
	"Evaluator SQRT(16, 2) must yield #VALUE!",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("NOT()")),
	FormulaErrors.Value,
	"Evaluator NOT() must yield #VALUE!",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("MOD(10)")),
	FormulaErrors.Value,
	"Evaluator MOD(10) must yield #VALUE!",
);
console.log("  PASSED: Boundary arity validation validated.");

// -----------------------------------------------------------------------------
// 6. Function Name Normalization & Case-Insensitivity
// -----------------------------------------------------------------------------
console.log("6. Verifying Name Normalization...");
assert.strictEqual(
	registry.HasFunction("sum"),
	true,
	"HasFunction('sum') must be true",
);
assert.strictEqual(
	registry.HasFunction("SUM"),
	true,
	"HasFunction('SUM') must be true",
);
assert.strictEqual(
	registry.HasFunction("Sum"),
	true,
	"HasFunction('Sum') must be true",
);
assert.strictEqual(
	registry.HasFunction("  sUm  "),
	true,
	"HasFunction('  sUm  ') with whitespace must be true",
);

assert.strictEqual(
	registry.GetFunction("sum"),
	registry.GetFunction("SUM"),
	"GetFunction must yield same function",
);
assert.strictEqual(
	registry.GetFunction("  suM  "),
	registry.GetFunction("SUM"),
	"GetFunction must trim whitespace",
);

assert.strictEqual(
	evaluator.Evaluate(parser.Parse("sum(1, 2, 3)")),
	6,
	"Lowercase formula sum(1, 2, 3) must evaluate to 6",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("SqRt(25)")),
	5,
	"Mixed case SqRt(25) must evaluate to 5",
);
console.log("  PASSED: Name normalization validated.");

// -----------------------------------------------------------------------------
// 7. Metadata & Introspection
// -----------------------------------------------------------------------------
console.log("7. Verifying Metadata & Introspection...");
const allFunctions = registry.ListFunctions();
assert.ok(Array.isArray(allFunctions), "ListFunctions must return an array");
assert.ok(allFunctions.includes("SUM"), "ListFunctions must include SUM");
assert.ok(allFunctions.includes("ROUND"), "ListFunctions must include ROUND");
assert.ok(!allFunctions.includes("IF"), "ListFunctions must NOT include IF");
assert.ok(
	!allFunctions.includes("IFERROR"),
	"ListFunctions must NOT include IFERROR",
);

// Sorted order check
const sortedCopy = [...allFunctions].sort();
assert.deepStrictEqual(
	allFunctions,
	sortedCopy,
	"ListFunctions must return names in sorted alphabetical order",
);

// Category filtering
const mathFunctions = registry.ListFunctions("Math");
assert.deepStrictEqual(
	mathFunctions,
	["ABS", "INT", "MOD", "POWER", "PRODUCT", "ROUND", "SQRT", "SUM"],
	"ListFunctions('Math') must return correct sorted Math functions",
);

const statFunctions = registry.ListFunctions("Statistical");
assert.deepStrictEqual(
	statFunctions,
	["AVERAGE", "COUNT", "COUNTA", "MAX", "MIN"],
	"ListFunctions('Statistical') must return correct sorted Statistical functions",
);

const logicalFunctions = registry.ListFunctions("Logical");
assert.deepStrictEqual(
	logicalFunctions,
	["AND", "FALSE", "NOT", "OR", "TRUE"],
	"ListFunctions('Logical') must return correct sorted Logical functions",
);

const textFunctions = registry.ListFunctions("Text");
assert.deepStrictEqual(
	textFunctions,
	["CONCATENATE", "LEN", "LOWER", "TRIM", "UPPER"],
	"ListFunctions('Text') must return correct sorted Text functions",
);

const infoFunctions = registry.ListFunctions("Information");
assert.deepStrictEqual(
	infoFunctions,
	["ISBLANK", "ISERROR", "ISNUMBER", "ISTEXT"],
	"ListFunctions('Information') must return correct sorted Information functions",
);

// Metadata immutability
const roundMeta = registry.GetMetadata("ROUND");
assert.strictEqual(roundMeta.MinArgs, 1, "ROUND MinArgs must be 1");
assert.strictEqual(roundMeta.MaxArgs, 2, "ROUND MaxArgs must be 2");
assert.strictEqual(roundMeta.Category, "Math", "ROUND Category must be Math");
assert.ok(Object.isFrozen(roundMeta), "GetMetadata must return frozen object");

assert.throws(
	() => {
		"use strict";
		roundMeta.MinArgs = 999;
	},
	TypeError,
	"Mutating frozen metadata must throw in strict mode",
);

assert.strictEqual(
	registry.GetMetadata("NONEXISTENT"),
	null,
	"GetMetadata for unknown function must return null",
);
console.log("  PASSED: Metadata & introspection validated.");

// -----------------------------------------------------------------------------
// 8. Built-in Functions & Spreadsheet Semantics
// -----------------------------------------------------------------------------
console.log("8. Verifying Built-in Functions & Spreadsheet Semantics...");

// Math: ABS
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ABS(-42)")),
	42,
	"ABS(-42) = 42",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ABS(42)")),
	42,
	"ABS(42) = 42",
);
assert.strictEqual(evaluator.Evaluate(parser.Parse("ABS(0)")), 0, "ABS(0) = 0");
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('ABS("text")')),
	FormulaErrors.Value,
	"ABS('text') = #VALUE!",
);

// Math: ROUND
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ROUND(3.14159, 2)")),
	3.14,
	"ROUND(3.14159, 2) = 3.14",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ROUND(3.5)")),
	4,
	"ROUND(3.5) = 4",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ROUND(1234, -2)")),
	1200,
	"ROUND(1234, -2) = 1200",
);

// Math: MOD (Strict spreadsheet floor modulo!)
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("MOD(10, 3)")),
	1,
	"MOD(10, 3) = 1",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("MOD(-10, 3)")),
	2,
	"MOD(-10, 3) = 2 (spreadsheet floor modulo)",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("MOD(10, -3)")),
	-2,
	"MOD(10, -3) = -2 (spreadsheet floor modulo)",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("MOD(-10, -3)")),
	-1,
	"MOD(-10, -3) = -1 (spreadsheet floor modulo)",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("MOD(10, 0)")),
	FormulaErrors.DivZero,
	"MOD(10, 0) = #DIV/0!",
);

// Math: POWER
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("POWER(2, 8)")),
	256,
	"POWER(2, 8) = 256",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("POWER(0, -1)")),
	FormulaErrors.DivZero,
	"POWER(0, -1) = #DIV/0!",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("POWER(-4, 0.5)")),
	FormulaErrors.Num,
	"POWER(-4, 0.5) = #NUM!",
);

// Math: PRODUCT
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("PRODUCT(2, 3, 4)")),
	24,
	"PRODUCT(2, 3, 4) = 24",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("PRODUCT(5)")),
	5,
	"PRODUCT(5) = 5",
);

// Range-based PRODUCT ignoring text
const dummyContext = {
	GetRangeValues: (startCol, startRow, endCol, endRow) => [
		2,
		"ignore_me",
		4,
		null,
		3,
	],
};
const astProductRange = parser.Parse("PRODUCT(A1:A5)");
assert.strictEqual(
	evaluator.Evaluate(astProductRange, dummyContext),
	24,
	"PRODUCT across range ignores text & nulls (2 * 4 * 3 = 24)",
);

// Math: INT
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("INT(4.9)")),
	4,
	"INT(4.9) = 4",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("INT(4.1)")),
	4,
	"INT(4.1) = 4",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("INT(-4.2)")),
	-5,
	"INT(-4.2) = -5 (floors down)",
);

// Math: SQRT
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("SQRT(144)")),
	12,
	"SQRT(144) = 12",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("SQRT(0)")),
	0,
	"SQRT(0) = 0",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("SQRT(-4)")),
	FormulaErrors.Num,
	"SQRT(-4) = #NUM!",
);

// Text: CONCATENATE
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('CONCATENATE("Hello", " ", "World")')),
	"Hello World",
	"CONCATENATE('Hello', ' ', 'World') = 'Hello World'",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('CONCATENATE("Num: ", 42)')),
	"Num: 42",
	"CONCATENATE('Num: ', 42) = 'Num: 42'",
);

// Text: LEN
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('LEN("Arbor")')),
	5,
	"LEN('Arbor') = 5",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('LEN("")')),
	0,
	"LEN('') = 0",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("LEN(12345)")),
	5,
	"LEN(12345) = 5",
);

// Text: TRIM
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('TRIM("  test  ")')),
	"test",
	"TRIM('  test  ') = 'test'",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('TRIM("   multiple   spaces   here   ")')),
	"multiple spaces here",
	"TRIM reduces multiple internal spaces to a single space",
);

// Text: UPPER / LOWER
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('UPPER("hello world")')),
	"HELLO WORLD",
	"UPPER('hello world')",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('LOWER("HELLO WORLD")')),
	"hello world",
	"LOWER('HELLO WORLD')",
);

// Information: ISNUMBER
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ISNUMBER(123)")),
	true,
	"ISNUMBER(123) = true",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('ISNUMBER("123")')),
	false,
	"ISNUMBER('123') = false (string is not number)",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ISNUMBER(10 / 0)")),
	false,
	"ISNUMBER(#DIV/0!) = false",
);

// Information: ISTEXT
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('ISTEXT("abc")')),
	true,
	"ISTEXT('abc') = true",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ISTEXT(123)")),
	false,
	"ISTEXT(123) = false",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('ISTEXT("#VALUE!")')),
	false,
	"ISTEXT('#VALUE!') = false",
);

// Information: ISBLANK
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('ISBLANK("")')),
	true,
	"ISBLANK('') = true",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ISBLANK(0)")),
	false,
	"ISBLANK(0) = false",
);

// Information: ISERROR
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ISERROR(10 / 0)")),
	true,
	"ISERROR(10/0) = true (#DIV/0!)",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ISERROR(SQRT(-1))")),
	true,
	"ISERROR(SQRT(-1)) = true (#NUM!)",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("ISERROR(100)")),
	false,
	"ISERROR(100) = false",
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('ISERROR("regular text")')),
	false,
	"ISERROR('regular text') = false",
);

console.log(
	"  PASSED: Built-in functions and spreadsheet semantics validated.",
);

// -----------------------------------------------------------------------------
// 9. Full End-to-End CalculationEngine Integration
// -----------------------------------------------------------------------------
console.log("9. Verifying End-to-End CalculationEngine Integration...");

// Mock sheet model for cell updates
class MockCellStore {
	constructor() {
		this.cells = new Map();
	}
	InsertData(r, c, val, style, computed) {
		this.cells.set(`${r},${c}`, {
			Value: val,
			ComputedValue: computed,
			Style: style,
		});
	}
	GetCell(r, c) {
		return this.cells.get(`${r},${c}`) || null;
	}
}

const mockModel = new MockCellStore();
const engine = new CalculationEngine();

// Test 1: Literal cell
engine.ProcessCellUpdate(mockModel, 1, 0, 10); // A1 = 10
assert.strictEqual(mockModel.GetCell(1, 0).ComputedValue, 10, "A1 must be 10");

// Test 2: Formula using new built-in function ABS and MOD
engine.ProcessCellUpdate(mockModel, 2, 0, "=MOD(-10, 3)"); // A2 = =MOD(-10, 3)
assert.strictEqual(mockModel.GetCell(2, 0).ComputedValue, 2, "A2 must be 2");

// Test 3: Formula using Special Form IF with dependency on A1
engine.ProcessCellUpdate(mockModel, 3, 0, "=IF(A1 > 5, ROUND(3.14159, 2), 0)"); // A3
assert.strictEqual(
	mockModel.GetCell(3, 0).ComputedValue,
	3.14,
	"A3 must be 3.14",
);

// Test 4: Downstream reactive recalculation through special forms
engine.ProcessCellUpdate(mockModel, 1, 0, 2); // A1 changed to 2 -> A3 condition becomes false!
assert.strictEqual(
	mockModel.GetCell(3, 0).ComputedValue,
	0,
	"A3 must recalculate to 0 after A1 update",
);

// Test 5: Complex combination
engine.ProcessCellUpdate(
	mockModel,
	4,
	0,
	'=CONCATENATE(UPPER("result: "), SQRT(16))',
); // A4
assert.strictEqual(
	mockModel.GetCell(4, 0).ComputedValue,
	"RESULT: 4",
	"A4 must evaluate to 'RESULT: 4'",
);

console.log("  PASSED: End-to-End CalculationEngine integration validated.");

console.log("\n>>> ALL COMMIT 3 VERIFICATIONS PASSED SUCCESSFULLY! <<<\n");
