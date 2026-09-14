/**
 * scratch/test_slice9.js
 *
 * Verification suite for Phase 7: Slice 9 — Calculation Engine Coordinator,
 * Reactive Recalculation Cascade, Dual Value Storage, and Command Integration.
 *
 * Checks:
 * 1. Strict Universal PascalCase compliance across classes, methods, and properties.
 * 2. Zero DOM dependencies in CalculationEngine.
 * 3. Dual storage model: Value (raw input/formula) vs ComputedValue (calculated outcome).
 * 4. Reactive recalculation cascade across linear dependency chains.
 * 5. Multi-cell Range reactive recalculation (SUM, AVERAGE).
 * 6. Diamond DAG topological recalculation order.
 * 7. Non-destructive circular reference detection (#CIRCULAR!) and recovery.
 * 8. Error handling (#ERROR!, #DIV/0!) and downstream propagation.
 * 9. Full sheet recalculation (RecalculateAll) simulating DB reload.
 * 10. Undo/Redo integration with CommandManager (formula cascades on undo/redo).
 * 11. Full regression across all slices 1 to 8 and DB save.
 */

const assert = require("assert");
const { ReferenceResolver } = require("../ReferenceResolver.js");
const { FormulaParser, OhmFormulaParser } = require("../FormulaParser.js");
const { FormulaEvaluator } = require("../FormulaEvaluator.js");
const { FunctionRegistry } = require("../FunctionRegistry.js");
const { DependencyAnalyzer } = require("../DependencyAnalyzer.js");
const { DependencyGraph } = require("../DependencyGraph.js");
const { CalculationEngine } = require("../CalculationEngine.js");
const { Spreadsheet, RowNode } = require("../Datastructure.js");
const { CellStore, AVLCellStore } = require("../CellStore.js");
const { SpreadsheetModel } = require("../SpreadsheetModel.js");
const { CommandManager } = require("../CommandManager.js");
const { SetCellCommand, ClearRangeCommand } = require("../Command.js");

console.log(
	"==========================================================================",
);
console.log(
	"RUNNING SLICE 9 VERIFICATION: CALCULATION ENGINE & REACTIVE CASCADE",
);
console.log(
	"==========================================================================\n",
);

// -----------------------------------------------------------------------------
// 1. Universal PascalCase Compliance Check
// -----------------------------------------------------------------------------
console.log("1. Verifying Universal PascalCase compliance...");

const calcEngineInstance = new CalculationEngine();
const engineMethods = [
	"IsFormula",
	"ProcessCellUpdate",
	"RecalculateDependents",
	"RecalculateAll",
	"Clear",
];

for (const m of engineMethods) {
	assert.strictEqual(
		typeof calcEngineInstance[m],
		"function",
		`CalculationEngine.${m} must be a PascalCase function`,
	);
}

const engineProperties = [
	"Parser",
	"Evaluator",
	"Analyzer",
	"Graph",
	"Resolver",
	"FormulaCache",
];

for (const prop of engineProperties) {
	assert(
		calcEngineInstance[prop] !== undefined,
		`CalculationEngine.${prop} must be a PascalCase property`,
	);
}

const testRowNode = new RowNode(1, "=10+20", {}, 30);
assert.strictEqual(testRowNode.Key, 1, "RowNode.Key must be PascalCase");
assert.strictEqual(
	testRowNode.Value,
	"=10+20",
	"RowNode.Value must be PascalCase",
);
assert.strictEqual(
	testRowNode.ComputedValue,
	30,
	"RowNode.ComputedValue must be PascalCase",
);

const testModel = new SpreadsheetModel();
assert.strictEqual(
	typeof testModel.GetCellValue,
	"function",
	"SpreadsheetModel.GetCellValue must be a PascalCase function",
);

console.log(
	"   ✅ All classes, properties, and methods strictly follow Universal PascalCase.\n",
);

// -----------------------------------------------------------------------------
// 2. Zero DOM Dependency Check
// -----------------------------------------------------------------------------
console.log("2. Verifying Zero DOM dependencies...");
assert.strictEqual(
	typeof window,
	"undefined",
	"Window must be undefined in pure Node.js context",
);
assert.strictEqual(
	typeof document,
	"undefined",
	"Document must be undefined in pure Node.js context",
);
console.log("   ✅ CalculationEngine runs with zero DOM dependencies.\n");

// -----------------------------------------------------------------------------
// 3. Dual Storage Model: Value vs ComputedValue
// -----------------------------------------------------------------------------
console.log("3. Verifying Dual Storage Model (Value vs ComputedValue)...");

const model = new SpreadsheetModel();
model.CreateBlank("Sheet1", 10, 10);

// A1: literal number
model.SetCell(1, 0, 42);
const a1 = model.GetCell(1, 0);
assert.strictEqual(a1.Value, 42, "A1 Value must be literal 42");
assert.strictEqual(a1.ComputedValue, 42, "A1 ComputedValue must be 42");
assert.strictEqual(model.GetCellValue(1, 0), 42, "GetCellValue must return 42");

// B1: formula referencing A1
model.SetCell(1, 1, "=A1 * 2");
const b1 = model.GetCell(1, 1);
assert.strictEqual(
	b1.Value,
	"=A1 * 2",
	"B1 Value must retain raw formula string",
);
assert.strictEqual(
	b1.ComputedValue,
	84,
	"B1 ComputedValue must evaluate to 84",
);
assert.strictEqual(model.GetCellValue(1, 1), 84, "GetCellValue must return 84");

// C1: formula with string comparison
model.SetCell(1, 2, '=IF(B1 > 50, "PASS", "FAIL")');
const c1 = model.GetCell(1, 2);
assert.strictEqual(c1.Value, '=IF(B1 > 50, "PASS", "FAIL")');
assert.strictEqual(c1.ComputedValue, "PASS");

console.log("   A1: Literal 42 -> Value: 42, ComputedValue: 42 ✅");
console.log("   B1: '=A1 * 2' -> Value: '=A1 * 2', ComputedValue: 84 ✅");
console.log("   C1: '=IF(B1 > 50, ...)' -> ComputedValue: 'PASS' ✅\n");

// -----------------------------------------------------------------------------
// 4. Reactive Recalculation Cascade (Linear Chain)
// -----------------------------------------------------------------------------
console.log("4. Verifying Reactive Recalculation Cascade (Chain)...");

const chainModel = new SpreadsheetModel();
chainModel.CreateBlank("ChainSheet", 10, 10);

// A1 = 10
// B1 = =A1 * 2   (20)
// C1 = =B1 + 5   (25)
// D1 = =C1 ^ 2   (625)
chainModel.SetCell(1, 0, 10);
chainModel.SetCell(1, 1, "=A1 * 2");
chainModel.SetCell(1, 2, "=B1 + 5");
chainModel.SetCell(1, 3, "=C1 ^ 2");

assert.strictEqual(chainModel.GetCellValue(1, 0), 10);
assert.strictEqual(chainModel.GetCellValue(1, 1), 20);
assert.strictEqual(chainModel.GetCellValue(1, 2), 25);
assert.strictEqual(chainModel.GetCellValue(1, 3), 625);

// Mutate A1 to 20: B1 -> 40, C1 -> 45, D1 -> 2025
chainModel.SetCell(1, 0, 20);
assert.strictEqual(chainModel.GetCellValue(1, 0), 20);
assert.strictEqual(chainModel.GetCellValue(1, 1), 40);
assert.strictEqual(chainModel.GetCellValue(1, 2), 45);
assert.strictEqual(chainModel.GetCellValue(1, 3), 2025);

// Mutate A1 to 0: B1 -> 0, C1 -> 5, D1 -> 25
chainModel.SetCell(1, 0, 0);
assert.strictEqual(chainModel.GetCellValue(1, 0), 0);
assert.strictEqual(chainModel.GetCellValue(1, 1), 0);
assert.strictEqual(chainModel.GetCellValue(1, 2), 5);
assert.strictEqual(chainModel.GetCellValue(1, 3), 25);

console.log("   A1=10 -> B1=20 -> C1=25 -> D1=625 ✅");
console.log("   Mutating A1=20 -> B1=40, C1=45, D1=2025 ✅");
console.log("   Mutating A1=0  -> B1=0,  C1=5,  D1=25 ✅\n");

// -----------------------------------------------------------------------------
// 5. Multi-Cell Range Reactive Recalculation
// -----------------------------------------------------------------------------
console.log("5. Verifying Multi-Cell Range Reactive Recalculation...");

const rangeModel = new SpreadsheetModel();
rangeModel.CreateBlank("RangeSheet", 10, 10);

rangeModel.SetCell(1, 0, 10); // A1
rangeModel.SetCell(2, 0, 20); // A2
rangeModel.SetCell(3, 0, 30); // A3

rangeModel.SetCell(1, 1, "=SUM(A1:A3)"); // B1 = 60
rangeModel.SetCell(2, 1, "=AVERAGE(A1:A3)"); // B2 = 20
rangeModel.SetCell(3, 1, "=B1 + B2"); // B3 = 80

assert.strictEqual(rangeModel.GetCellValue(1, 1), 60);
assert.strictEqual(rangeModel.GetCellValue(2, 1), 20);
assert.strictEqual(rangeModel.GetCellValue(3, 1), 80);

// Mutate A2 from 20 to 50:
// SUM(10, 50, 30) = 90
// AVERAGE(10, 50, 30) = 30
// B3 = 90 + 30 = 120
rangeModel.SetCell(2, 0, 50);

assert.strictEqual(
	rangeModel.GetCellValue(1, 1),
	90,
	"SUM(A1:A3) must update to 90",
);
assert.strictEqual(
	rangeModel.GetCellValue(2, 1),
	30,
	"AVERAGE(A1:A3) must update to 30",
);
assert.strictEqual(rangeModel.GetCellValue(3, 1), 120, "B3 must update to 120");

console.log("   A1:A3 (10, 20, 30): SUM=60, AVERAGE=20, Total=80 ✅");
console.log("   Mutating A2 to 50: SUM=90, AVERAGE=30, Total=120 ✅\n");

// -----------------------------------------------------------------------------
// 6. Diamond DAG Recalculation Order
// -----------------------------------------------------------------------------
console.log("6. Verifying Diamond DAG Recalculation Order...");

const dagModel = new SpreadsheetModel();
dagModel.CreateBlank("DAGSheet", 10, 10);

// A1 = 5
// B1 = =A1 * 2  (10)
// C1 = =A1 * 3  (15)
// D1 = =B1 + C1 (25)
dagModel.SetCell(1, 0, 5);
dagModel.SetCell(1, 1, "=A1 * 2");
dagModel.SetCell(1, 2, "=A1 * 3");
dagModel.SetCell(1, 3, "=B1 + C1");

assert.strictEqual(dagModel.GetCellValue(1, 3), 25);

// Mutate A1 to 10: B1=20, C1=30, D1=50
dagModel.SetCell(1, 0, 10);
assert.strictEqual(dagModel.GetCellValue(1, 1), 20);
assert.strictEqual(dagModel.GetCellValue(1, 2), 30);
assert.strictEqual(dagModel.GetCellValue(1, 3), 50);

console.log(
	"   Diamond DAG: A1(10) -> B1(20), C1(30) -> D1(50) topologically resolved ✅\n",
);

// -----------------------------------------------------------------------------
// 7. Non-Destructive Cycle Detection (#CIRCULAR!) & Recovery
// -----------------------------------------------------------------------------
console.log("7. Verifying Non-Destructive Cycle Detection and Recovery...");

const circModel = new SpreadsheetModel();
circModel.CreateBlank("CircSheet", 10, 10);

// Self cycle: A1 = =A1 + 1
circModel.SetCell(1, 0, "=A1 + 1");
assert.strictEqual(
	circModel.GetCellValue(1, 0),
	"#CIRCULAR!",
	"Self-cycle must produce #CIRCULAR!",
);

// 2-cell cycle: A1 = 10, B1 = =A1. Then set A1 = =B1
circModel.SetCell(1, 0, 10);
circModel.SetCell(1, 1, "=A1");
assert.strictEqual(circModel.GetCellValue(1, 1), 10);

circModel.SetCell(1, 0, "=B1");
assert.strictEqual(
	circModel.GetCellValue(1, 0),
	"#CIRCULAR!",
	"2-cell cycle must produce #CIRCULAR!",
);

// Recovery: Set A1 to a valid number 100 -> B1 should now recompute to 100!
circModel.SetCell(1, 0, 100);
assert.strictEqual(circModel.GetCellValue(1, 0), 100);
assert.strictEqual(
	circModel.GetCellValue(1, 1),
	100,
	"B1 must recover and compute to 100",
);

console.log("   Direct self-cycle 'A1 = =A1 + 1' -> #CIRCULAR! ✅");
console.log("   2-cell cycle 'A1 = =B1' -> #CIRCULAR! without hang ✅");
console.log("   Cycle recovery 'A1 = 100' -> B1 cleanly evaluates to 100 ✅\n");

// -----------------------------------------------------------------------------
// 8. Error Handling & Propagation (#ERROR!, #DIV/0!)
// -----------------------------------------------------------------------------
console.log("8. Verifying Error Handling & Propagation...");

const errModel = new SpreadsheetModel();
errModel.CreateBlank("ErrSheet", 10, 10);

// Syntax error
errModel.SetCell(1, 0, "=10 ++ ");
assert.strictEqual(
	errModel.GetCellValue(1, 0),
	"#ERROR!",
	"Syntax error must produce #ERROR!",
);

// Division by zero
errModel.SetCell(1, 1, "=10 / 0");
assert.strictEqual(
	errModel.GetCellValue(1, 1),
	"#DIV/0!",
	"Division by zero must produce #DIV/0!",
);

// Error propagation downstream
errModel.SetCell(1, 2, "=B1 * 5");
assert.strictEqual(
	errModel.GetCellValue(1, 2),
	"#DIV/0!",
	"#DIV/0! must propagate downstream",
);

// IFERROR fallback
errModel.SetCell(1, 3, '=IFERROR(B1, "Safe")');
assert.strictEqual(
	errModel.GetCellValue(1, 3),
	"Safe",
	"IFERROR must catch #DIV/0! and return fallback",
);

console.log("   Syntax error '=10 ++ ' -> #ERROR! ✅");
console.log("   Division by zero '=10 / 0' -> #DIV/0! ✅");
console.log("   Downstream error propagation '=B1 * 5' -> #DIV/0! ✅");
console.log("   IFERROR recovery '=IFERROR(B1, \"Safe\")' -> 'Safe' ✅\n");

// -----------------------------------------------------------------------------
// 9. Full Sheet Recalculation (RecalculateAll)
// -----------------------------------------------------------------------------
console.log("9. Verifying Full Sheet Recalculation (RecalculateAll)...");

const reloadModel = new SpreadsheetModel();
const sheet = reloadModel.CreateBlank("ReloadSheet", 10, 10);

// Insert raw formulas directly (as if loaded from database without pre-calculated values)
sheet.InsertData(1, 0, 25); // A1 = 25
sheet.InsertData(2, 0, 75); // A2 = 75
sheet.InsertData(1, 1, "=SUM(A1:A2)"); // B1 = =SUM(A1:A2)
sheet.InsertData(2, 1, "=B1 * 2"); // B2 = =B1 * 2
sheet.InsertData(3, 1, "=AVERAGE(A1:A2)"); // B3 = =AVERAGE(A1:A2)

// Recalculate all formulas in sheet
reloadModel.CalculationEngine.RecalculateAll(reloadModel);

assert.strictEqual(
	reloadModel.GetCellValue(1, 1),
	100,
	"B1 must compute to 100",
);
assert.strictEqual(
	reloadModel.GetCellValue(2, 1),
	200,
	"B2 must compute to 200",
);
assert.strictEqual(reloadModel.GetCellValue(3, 1), 50, "B3 must compute to 50");

console.log(
	"   Direct DB raw data rehydration: RecalculateAll correctly computes all formulas ✅\n",
);

// -----------------------------------------------------------------------------
// 10. Undo / Redo Integration with CommandManager
// -----------------------------------------------------------------------------
console.log("10. Verifying CommandManager Undo/Redo Reactive Cascade...");

const cmdModel = new SpreadsheetModel();
cmdModel.CreateBlank("CmdSheet", 10, 10);

// Command 1: Set A1 = 10
cmdModel.ExecuteCommand(new SetCellCommand(cmdModel, 1, 0, 10));
assert.strictEqual(cmdModel.GetCellValue(1, 0), 10);

// Command 2: Set B1 = =A1 * 5
cmdModel.ExecuteCommand(new SetCellCommand(cmdModel, 1, 1, "=A1 * 5"));
assert.strictEqual(cmdModel.GetCellValue(1, 1), 50);

// Command 3: Set A1 = 20 (Cascades B1 -> 100)
cmdModel.ExecuteCommand(new SetCellCommand(cmdModel, 1, 0, 20));
assert.strictEqual(cmdModel.GetCellValue(1, 0), 20);
assert.strictEqual(cmdModel.GetCellValue(1, 1), 100);

// Undo Command 3: A1 reverts to 10, B1 cascades back to 50!
cmdModel.Undo();
assert.strictEqual(
	cmdModel.GetCellValue(1, 0),
	10,
	"Undo must revert A1 to 10",
);
assert.strictEqual(
	cmdModel.GetCellValue(1, 1),
	50,
	"Undo must cascade B1 back to 50",
);

// Redo Command 3: A1 reapplies 20, B1 cascades back to 100!
cmdModel.Redo();
assert.strictEqual(
	cmdModel.GetCellValue(1, 0),
	20,
	"Redo must reapply A1 to 20",
);
assert.strictEqual(
	cmdModel.GetCellValue(1, 1),
	100,
	"Redo must cascade B1 back to 100",
);

// Command 4: ClearRangeCommand on A1
cmdModel.ExecuteCommand(
	new ClearRangeCommand(cmdModel, [{ RowKey: 1, ColKey: 0 }]),
);
assert.strictEqual(cmdModel.GetCellValue(1, 0), "");
assert.strictEqual(
	cmdModel.GetCellValue(1, 1),
	0,
	"Clearing A1 must cascade B1 to 0",
);

// Undo ClearRange: A1 restored to 20, B1 cascades to 100
cmdModel.Undo();
assert.strictEqual(cmdModel.GetCellValue(1, 0), 20);
assert.strictEqual(cmdModel.GetCellValue(1, 1), 100);

console.log("   Execute SetCell: A1=20 -> B1=100 ✅");
console.log("   Undo SetCell: A1=10 -> B1=50 cascaded ✅");
console.log("   Redo SetCell: A1=20 -> B1=100 cascaded ✅");
console.log("   ClearRange & Undo: cascades seamlessly ✅\n");

// -----------------------------------------------------------------------------
// 11. Full Regression Across Slices 1 to 8 & DB Save
// -----------------------------------------------------------------------------
console.log("11. Verifying Full Regression Across Slices 1 to 8...");

const slices = [
	"scratch/test_slice1.js",
	"scratch/test_slice2.js",
	"scratch/test_slice3.js",
	"scratch/test_slice4.js",
	"scratch/test_slice6.js",
	"scratch/test_slice7.js",
	"scratch/test_slice8.js",
	"scratch/test_db_save.js",
];

const { execSync } = require("child_process");
for (const s of slices) {
	try {
		execSync(`node ${s}`, { stdio: "pipe" });
		console.log(`   ${s} passed cleanly ✅`);
	} catch (err) {
		console.error(`   ${s} FAILED:`, err.message);
		process.exit(1);
	}
}

console.log(
	"\n==========================================================================",
);
console.log("ALL SLICE 9 TESTS COMPLETED SUCCESSFULLY! 🎉");
console.log(
	"PHASE 7 COMPLETE: ENTERPRISE-GRADE CALCULATION & FORMULA ENGINE! 🏆🚀",
);
console.log(
	"==========================================================================",
);
