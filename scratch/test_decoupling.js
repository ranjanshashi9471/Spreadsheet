/**
 * test_decoupling.js
 *
 * Comprehensive Verification Suite for Commit 1 (P0):
 * Architectural Decoupling of Model, Commands, and Calculation Engine from View/DOM.
 *
 * Verifies:
 * 1. Universal PascalCase compliance across all classes, properties, and methods.
 * 2. Static Architectural Boundary: ZERO DOM/View dependencies in Model, Commands, Engine.
 * 3. Pure Headless Zero-DOM Execution.
 * 4. Single-Notification Transaction Invariant (1 user command = 1 cellsChanged event).
 * 5. Diamond DAG Duplicate Convergence (no duplicate cell entries in mutation deltas).
 * 6. BatchUpdate and Nested Batching semantics with latest-snapshot-wins.
 * 7. ClearCells single recalculation pass.
 * 8. GridRenderer Event-Driven Subscription & Lifecycle (Destroy).
 * 9. SheetReset and explicit RecalculateAll decoupling.
 * 10. Full Regression across existing test suites.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const {
	SpreadsheetModel,
	SpreadsheetEvents,
} = require("../SpreadsheetModel.js");
const { CalculationEngine } = require("../CalculationEngine.js");
const {
	Command,
	SetCellCommand,
	ClearRangeCommand,
	CompoundCommand,
} = require("../Command.js");
const { GridRenderer } = require("../GridRenderer.js");
const { SelectionModel } = require("../SelectionModel.js");

console.log(
	"==========================================================================",
);
console.log(
	"RUNNING COMMIT 1 VERIFICATION: ARCHITECTURAL BOUNDARIES & ZERO-DOM",
);
console.log(
	"==========================================================================\n",
);

// -----------------------------------------------------------------------------
// 1. Universal PascalCase Compliance Check
// -----------------------------------------------------------------------------
console.log("1. Verifying Universal PascalCase compliance...");

const model = new SpreadsheetModel();
const modelMethods = [
	"AddListener",
	"RemoveListener",
	"NotifyListeners",
	"BeginBatch",
	"EndBatch",
	"BatchUpdate",
	"GetCurrentSpreadsheet",
	"SetCurrentSpreadsheet",
	"CreateBlank",
	"GetCell",
	"GetCellValue",
	"SetCell",
	"ClearCells",
	"RecalculateAll",
	"Clear",
	"ExecuteCommand",
	"Undo",
	"Redo",
];

for (const m of modelMethods) {
	assert.strictEqual(
		typeof model[m],
		"function",
		`SpreadsheetModel.${m} must be a PascalCase function`,
	);
}

assert.ok(
	model.Listeners instanceof Set,
	"SpreadsheetModel.Listeners must be a Set",
);
assert.strictEqual(typeof model.CommandManager, "object");
assert.strictEqual(typeof model.CalculationEngine, "object");

assert.strictEqual(
	SpreadsheetEvents.CellsChanged,
	"cellsChanged",
	"SpreadsheetEvents.CellsChanged must be 'cellsChanged'",
);
assert.strictEqual(
	SpreadsheetEvents.SheetReset,
	"sheetReset",
	"SpreadsheetEvents.SheetReset must be 'sheetReset'",
);

console.log(
	"   ✅ All classes, methods, and events follow Universal PascalCase.\n",
);

// -----------------------------------------------------------------------------
// 2. Static Architectural Boundary Verification
// -----------------------------------------------------------------------------
console.log(
	"2. Verifying Static Architectural Boundaries (No DOM / View in Model, Commands, Engine)...",
);

function checkForbiddenTokens(filePath, forbiddenTokens, allowedPatterns = []) {
	const content = fs.readFileSync(filePath, "utf-8");
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		// Skip comments and allowed patterns
		if (line.trim().startsWith("//") || line.trim().startsWith("*")) {
			continue;
		}

		let isAllowed = false;
		for (const allowed of allowedPatterns) {
			if (allowed.test(line)) {
				isAllowed = true;
				break;
			}
		}
		if (isAllowed) continue;

		for (const token of forbiddenTokens) {
			if (line.includes(token)) {
				throw new Error(
					`Forbidden token '${token}' found in ${path.basename(filePath)} at line ${i + 1}:\n${line}`,
				);
			}
		}
	}
}

// Check CalculationEngine.js
checkForbiddenTokens(
	path.join(__dirname, "../CalculationEngine.js"),
	["GridRenderer", "document.", "document[", "querySelector"],
	[
		/window\.ReferenceResolver/,
		/window\.FormulaParser/,
		/window\.FormulaEvaluator/,
		/window\.DependencyAnalyzer/,
		/window\.DependencyGraph/,
		/window\.ErrorNode/,
		/window\.OhmFormulaParser/,
	],
);

// Check SpreadsheetModel.js
checkForbiddenTokens(
	path.join(__dirname, "../SpreadsheetModel.js"),
	[
		"GridRenderer",
		"document.",
		"document[",
		"window.document",
		"querySelector",
	],
	[
		/typeof window !== "undefined"/,
		/window\.SpreadsheetModel/,
		/window\.SpreadsheetEvents/,
	],
);

// Check Command.js
checkForbiddenTokens(
	path.join(__dirname, "../Command.js"),
	[
		"GridRenderer",
		"document.",
		"document[",
		"window.document",
		"querySelector",
	],
	[
		/typeof window !== "undefined"/,
		/window\.Command/,
		/window\.SetCellCommand/,
		/window\.ClearRangeCommand/,
		/window\.CompoundCommand/,
	],
);

console.log("   CalculationEngine.js: 0 DOM/View references ✅");
console.log("   SpreadsheetModel.js:  0 DOM/View references ✅");
console.log("   Command.js:           0 DOM/View references ✅");
console.log("   ✅ Static boundary verification passed.\n");

// -----------------------------------------------------------------------------
// 3. Pure Headless Zero-DOM Execution Verification
// -----------------------------------------------------------------------------
console.log("3. Verifying Pure Headless Zero-DOM Execution...");

assert.strictEqual(
	typeof window,
	"undefined",
	"window must be undefined in pure Node.js",
);
assert.strictEqual(
	typeof document,
	"undefined",
	"document must be undefined in pure Node.js",
);

const headlessModel = new SpreadsheetModel();
headlessModel.CreateBlank("HeadlessSheet", 5, 5);

// Execute SetCellCommand without any mock DOM
const setCmd = new SetCellCommand(headlessModel, 1, 0, 100);
headlessModel.ExecuteCommand(setCmd);
assert.strictEqual(
	headlessModel.GetCellValue(1, 0),
	100,
	"Cell A1 must be 100 in headless mode",
);

// Undo and Redo
headlessModel.Undo();
assert.strictEqual(
	headlessModel.GetCellValue(1, 0),
	"",
	"Cell A1 must revert to '' on undo",
);
headlessModel.Redo();
assert.strictEqual(
	headlessModel.GetCellValue(1, 0),
	100,
	"Cell A1 must be 100 on redo",
);

// ClearRangeCommand
const clearCmd = new ClearRangeCommand(headlessModel, [
	{ RowKey: 1, ColKey: 0 },
]);
headlessModel.ExecuteCommand(clearCmd);
assert.strictEqual(
	headlessModel.GetCellValue(1, 0),
	"",
	"Cell A1 must be cleared",
);
headlessModel.Undo();
assert.strictEqual(
	headlessModel.GetCellValue(1, 0),
	100,
	"Cell A1 must be restored to 100 on undo",
);

console.log(
	"   ✅ Model and Commands execute completely decoupled from browser DOM.\n",
);

// -----------------------------------------------------------------------------
// 4. Single-Notification Transaction Invariant Verification
// -----------------------------------------------------------------------------
console.log("4. Verifying Single-Notification Transaction Invariant...");

const txModel = new SpreadsheetModel();
txModel.CreateBlank("TxSheet", 10, 10);

let eventLog = [];
txModel.AddListener((event) => {
	eventLog.push(event);
});

// Test 4.1: Single cell edit -> exactly 1 event emitted
eventLog = [];
txModel.ExecuteCommand(new SetCellCommand(txModel, 1, 0, 10)); // A1 = 10
assert.strictEqual(
	eventLog.length,
	1,
	"Single SetCellCommand must emit exactly 1 event",
);
assert.strictEqual(eventLog[0].type, SpreadsheetEvents.CellsChanged);
assert.strictEqual(eventLog[0].cells.length, 1);
assert.strictEqual(eventLog[0].cells[0].RowKey, 1);
assert.strictEqual(eventLog[0].cells[0].ColKey, 0);
assert.strictEqual(eventLog[0].cells[0].Value, 10);

// Setup dependency chain: B1 = =A1 * 2, C1 = =B1 + 5
txModel.ExecuteCommand(new SetCellCommand(txModel, 1, 1, "=A1 * 2"));
txModel.ExecuteCommand(new SetCellCommand(txModel, 1, 2, "=B1 + 5"));

assert.strictEqual(txModel.GetCellValue(1, 0), 10); // A1 = 10
assert.strictEqual(txModel.GetCellValue(1, 1), 20); // B1 = 20
assert.strictEqual(txModel.GetCellValue(1, 2), 25); // C1 = 25

// Test 4.2: Chain cascade mutation -> exactly 1 event with complete affected set [A1, B1, C1]
eventLog = [];
txModel.ExecuteCommand(new SetCellCommand(txModel, 1, 0, 30)); // Mutate A1 to 30

assert.strictEqual(
	eventLog.length,
	1,
	"Cascaded mutation must emit exactly 1 cellsChanged event",
);
assert.strictEqual(eventLog[0].type, SpreadsheetEvents.CellsChanged);
assert.strictEqual(
	eventLog[0].cells.length,
	3,
	"Event must contain all 3 affected cells [A1, B1, C1]",
);

const cellKeysInEvent = eventLog[0].cells.map((c) => `${c.RowKey}:${c.ColKey}`);
assert.ok(cellKeysInEvent.includes("1:0"), "Must contain A1");
assert.ok(cellKeysInEvent.includes("1:1"), "Must contain B1");
assert.ok(cellKeysInEvent.includes("1:2"), "Must contain C1");

// Verify values
assert.strictEqual(txModel.GetCellValue(1, 0), 30);
assert.strictEqual(txModel.GetCellValue(1, 1), 60);
assert.strictEqual(txModel.GetCellValue(1, 2), 65);

// Test 4.3: ClearRangeCommand -> exactly 1 event for clearing multiple cells + cascade
eventLog = [];
txModel.ExecuteCommand(
	new ClearRangeCommand(txModel, [
		{ RowKey: 1, ColKey: 0 },
		{ RowKey: 1, ColKey: 1 },
	]),
);

assert.strictEqual(
	eventLog.length,
	1,
	"ClearRangeCommand must emit exactly 1 event",
);
assert.strictEqual(eventLog[0].type, SpreadsheetEvents.CellsChanged);
// A1 cleared, B1 cleared, C1 cascaded (0 + 5 = 5)
assert.strictEqual(txModel.GetCellValue(1, 0), "");
assert.strictEqual(txModel.GetCellValue(1, 1), "");
assert.strictEqual(txModel.GetCellValue(1, 2), 5);

// Test 4.4: Undo ClearRangeCommand -> exactly 1 event for restoring multiple cells + cascade
eventLog = [];
txModel.Undo();
assert.strictEqual(
	eventLog.length,
	1,
	"Undo ClearRangeCommand must emit exactly 1 event",
);
assert.strictEqual(eventLog[0].type, SpreadsheetEvents.CellsChanged);
assert.strictEqual(txModel.GetCellValue(1, 0), 30);
assert.strictEqual(txModel.GetCellValue(1, 1), 60);
assert.strictEqual(txModel.GetCellValue(1, 2), 65);

// Test 4.5: Redo ClearRangeCommand -> exactly 1 event
eventLog = [];
txModel.Redo();
assert.strictEqual(
	eventLog.length,
	1,
	"Redo ClearRangeCommand must emit exactly 1 event",
);
assert.strictEqual(eventLog[0].type, SpreadsheetEvents.CellsChanged);

// Test 4.6: CompoundCommand transaction -> exactly 1 event for Execute, Undo, and Redo
const compModel = new SpreadsheetModel();
compModel.CreateBlank("CompoundSheet", 10, 10);
const compLog = [];
compModel.AddListener((e) => compLog.push(e));

const c1 = new SetCellCommand(compModel, 1, 0, "alpha");
const c2 = new SetCellCommand(compModel, 1, 1, "beta");
const c3 = new SetCellCommand(compModel, 1, 2, "gamma");
const compCmd = new CompoundCommand([c1, c2, c3], compModel, "Set 3 cells");

compLog.length = 0;
compModel.ExecuteCommand(compCmd);
assert.strictEqual(
	compLog.length,
	1,
	"CompoundCommand Execute must emit exactly 1 cellsChanged event",
);
assert.strictEqual(compLog[0].type, SpreadsheetEvents.CellsChanged);
assert.strictEqual(
	compLog[0].cells.length,
	3,
	"CompoundCommand Execute must report 3 affected cells in a single batch",
);
assert.strictEqual(compModel.GetCellValue(1, 0), "alpha");
assert.strictEqual(compModel.GetCellValue(1, 1), "beta");
assert.strictEqual(compModel.GetCellValue(1, 2), "gamma");

// Undo CompoundCommand
compLog.length = 0;
compModel.Undo();
assert.strictEqual(
	compLog.length,
	1,
	"CompoundCommand Undo must emit exactly 1 cellsChanged event",
);
assert.strictEqual(compLog[0].type, SpreadsheetEvents.CellsChanged);
assert.strictEqual(
	compLog[0].cells.length,
	3,
	"CompoundCommand Undo must report 3 affected cells in a single batch",
);
assert.strictEqual(compModel.GetCellValue(1, 0), "");
assert.strictEqual(compModel.GetCellValue(1, 1), "");
assert.strictEqual(compModel.GetCellValue(1, 2), "");

// Redo CompoundCommand
compLog.length = 0;
compModel.Redo();
assert.strictEqual(
	compLog.length,
	1,
	"CompoundCommand Redo must emit exactly 1 cellsChanged event",
);
assert.strictEqual(compLog[0].type, SpreadsheetEvents.CellsChanged);
assert.strictEqual(
	compLog[0].cells.length,
	3,
	"CompoundCommand Redo must report 3 affected cells in a single batch",
);
assert.strictEqual(compModel.GetCellValue(1, 0), "alpha");
assert.strictEqual(compModel.GetCellValue(1, 1), "beta");
assert.strictEqual(compModel.GetCellValue(1, 2), "gamma");

// Test 4.7: Direct RestoreCells bulk calculation pass -> 1 event, formulas evaluated
const restoreModel = new SpreadsheetModel();
restoreModel.CreateBlank("RestoreSheet", 10, 10);
const restoreLog = [];
restoreModel.AddListener((e) => restoreLog.push(e));

restoreModel.RestoreCells([
	{ RowKey: 1, ColKey: 0, OldValue: 50 },
	{ RowKey: 1, ColKey: 1, OldValue: "=A1 * 4" },
]);

assert.strictEqual(
	restoreLog.length,
	1,
	"RestoreCells must emit exactly 1 cellsChanged event",
);
assert.strictEqual(restoreLog[0].type, SpreadsheetEvents.CellsChanged);
assert.strictEqual(restoreModel.GetCellValue(1, 0), 50);
assert.strictEqual(restoreModel.GetCellValue(1, 1), 200);

console.log(
	"   ✅ Single-Notification Transaction Invariant strictly enforced across edits, clears, undo, redo.\n",
	"   ✅ Single-Notification Transaction Invariant strictly enforced across edits, compound commands, clears, bulk restore, undo, redo.\n",
);

// -----------------------------------------------------------------------------
// 5. Diamond DAG Duplicate Convergence Verification
// -----------------------------------------------------------------------------
console.log("5. Verifying Diamond DAG Duplicate Convergence...");

const diamondModel = new SpreadsheetModel();
diamondModel.CreateBlank("DiamondSheet", 10, 10);

// A1 = 10
// B1 = =A1 * 2  (20)
// C1 = =A1 * 3  (30)
// D1 = =B1 + C1 (50)
diamondModel.SetCell(1, 0, 10);
diamondModel.SetCell(1, 1, "=A1 * 2");
diamondModel.SetCell(1, 2, "=A1 * 3");
diamondModel.SetCell(1, 3, "=B1 + C1");

assert.strictEqual(diamondModel.GetCellValue(1, 3), 50);

eventLog = [];
diamondModel.AddListener((e) => eventLog.push(e));

// Mutate A1 = 20 -> B1=40, C1=60, D1=100
diamondModel.ExecuteCommand(new SetCellCommand(diamondModel, 1, 0, 20));

assert.strictEqual(
	eventLog.length,
	1,
	"Diamond DAG mutation must emit exactly 1 event",
);
const changedCells = eventLog[0].cells;

// Count occurrences of each cell in changedCells
const keyCounts = {};
for (const c of changedCells) {
	const k = `${c.RowKey}:${c.ColKey}`;
	keyCounts[k] = (keyCounts[k] || 0) + 1;
}

assert.strictEqual(keyCounts["1:0"], 1, "A1 must appear exactly once");
assert.strictEqual(keyCounts["1:1"], 1, "B1 must appear exactly once");
assert.strictEqual(keyCounts["1:2"], 1, "C1 must appear exactly once");
assert.strictEqual(
	keyCounts["1:3"],
	1,
	"D1 must appear exactly once (converged without duplicate)",
);

const d1Entry = changedCells.find((c) => c.RowKey === 1 && c.ColKey === 3);
assert.strictEqual(d1Entry.ComputedValue, 100, "D1 ComputedValue must be 100");

console.log(
	"   Diamond DAG: A1(20) -> B1(40), C1(60) -> D1(100) converged with 0 duplicates ✅\n",
);

// -----------------------------------------------------------------------------
// 6. BatchUpdate and Nested Batching Semantics
// -----------------------------------------------------------------------------
console.log(
	"6. Verifying BatchUpdate & Nested Batching (Latest-Snapshot-Wins)...",
);

const batchModel = new SpreadsheetModel();
batchModel.CreateBlank("BatchSheet", 10, 10);

eventLog = [];
batchModel.AddListener((e) => eventLog.push(e));

batchModel.BatchUpdate(() => {
	// Nested batch call
	batchModel.BeginBatch();
	batchModel.SetCell(1, 0, "first");
	batchModel.SetCell(1, 0, "second"); // Overwrite within batch
	batchModel.SetCell(2, 0, "row2");
	batchModel.EndBatch();

	// Still inside outer batch, no event should have fired yet
	assert.strictEqual(
		eventLog.length,
		0,
		"No event must fire while inside batch",
	);

	batchModel.SetCell(1, 0, "final"); // Overwrite again
});

// Outermost batch completed: exactly 1 event fired
assert.strictEqual(
	eventLog.length,
	1,
	"Outer EndBatch must emit exactly 1 event",
);
assert.strictEqual(
	eventLog[0].cells.length,
	2,
	"Event must contain exactly 2 unique cells [1:0, 2:0]",
);

const cellA1 = eventLog[0].cells.find((c) => c.RowKey === 1 && c.ColKey === 0);
assert.strictEqual(
	cellA1.Value,
	"final",
	"Latest mutation snapshot ('final') must win",
);

console.log(
	"   ✅ Nested batching delays emission and deduplicates with latest snapshot winning.\n",
);

// -----------------------------------------------------------------------------
// 7. GridRenderer Event-Driven Subscription & Lifecycle (Destroy)
// -----------------------------------------------------------------------------
console.log("7. Verifying GridRenderer Event Subscription & Lifecycle...");

const renderModel = new SpreadsheetModel();
renderModel.CreateBlank("RenderSheet", 5, 5);

// Create a mock DOM container and elements
const cellDOMUpdates = [];
const mockRenderer = new GridRenderer(null, renderModel, new SelectionModel());

// Override UpdateCell to track invocations from event stream
mockRenderer.UpdateCell = function (rowKey, colKey, value, style) {
	cellDOMUpdates.push({ rowKey, colKey, value, style });
};

// Perform mutation on model
renderModel.SetCell(1, 0, "Hello Renderer");

assert.strictEqual(
	cellDOMUpdates.length,
	1,
	"GridRenderer must receive update via model event",
);
assert.strictEqual(cellDOMUpdates[0].rowKey, 1);
assert.strictEqual(cellDOMUpdates[0].colKey, 0);
assert.strictEqual(cellDOMUpdates[0].value, "Hello Renderer");

// Test Destroy()
cellDOMUpdates.length = 0;
mockRenderer.Destroy();

assert.strictEqual(
	mockRenderer.SpreadsheetModel,
	null,
	"Destroy must set SpreadsheetModel to null",
);
assert.strictEqual(
	mockRenderer.ModelListener,
	null,
	"Destroy must set ModelListener to null",
);

renderModel.SetCell(1, 0, "After Destroy");
assert.strictEqual(
	cellDOMUpdates.length,
	0,
	"Destroyed GridRenderer must not receive further updates",
);

// Test Rebinding
const renderModel2 = new SpreadsheetModel();
renderModel2.CreateBlank("RenderSheet2", 5, 5);
mockRenderer.SpreadsheetModel = renderModel2;

assert.strictEqual(
	mockRenderer.SpreadsheetModel,
	renderModel2,
	"SpreadsheetModel setter must update model reference",
);
assert.strictEqual(
	typeof mockRenderer.ModelListener,
	"function",
	"SpreadsheetModel setter must re-create and attach listener",
);

renderModel2.SetCell(2, 0, "Rebound Update");
assert.strictEqual(
	cellDOMUpdates.length,
	1,
	"Rebound GridRenderer must receive updates from new model",
);
assert.strictEqual(cellDOMUpdates[0].rowKey, 2);
assert.strictEqual(cellDOMUpdates[0].colKey, 0);
assert.strictEqual(cellDOMUpdates[0].value, "Rebound Update");

console.log(
	"   ✅ GridRenderer cleanly decoupled as an event-driven subscriber.\n",
	"   ✅ GridRenderer cleanly decoupled as an event-driven subscriber with lifecycle management.\n",
);

// -----------------------------------------------------------------------------
// 8. SheetReset and Explicit RecalculateAll Decoupling
// -----------------------------------------------------------------------------
console.log(
	"8. Verifying SheetReset and explicit RecalculateAll decoupling...",
);

const resetModel = new SpreadsheetModel();
eventLog = [];
resetModel.AddListener((e) => eventLog.push(e));

const s1 = resetModel.CreateBlank("Sheet1", 5, 5);
s1.InsertData(1, 0, 50);
s1.InsertData(1, 1, "=A1 * 3"); // Formula not evaluated yet

// SetCurrentSpreadsheet emits SheetReset, does NOT auto-recalculate
eventLog = [];
resetModel.SetCurrentSpreadsheet(s1);

assert.strictEqual(eventLog.length, 1);
assert.strictEqual(eventLog[0].type, SpreadsheetEvents.SheetReset);
assert.strictEqual(eventLog[0].sheet, s1);

// Formula cell B1 should not be computed yet
const rawB1 = resetModel.GetCell(1, 1);
assert.strictEqual(
	rawB1.ComputedValue,
	undefined,
	"SetCurrentSpreadsheet must NOT auto-recalculate",
);

// Explicitly invoke RecalculateAll()
eventLog = [];
const recalcDeltas = resetModel.RecalculateAll();

assert.strictEqual(
	eventLog.length,
	1,
	"RecalculateAll must emit 1 cellsChanged event",
);
assert.strictEqual(
	resetModel.GetCellValue(1, 1),
	150,
	"B1 must compute to 150",
);
assert.strictEqual(recalcDeltas.length, 1);
assert.strictEqual(recalcDeltas[0].ComputedValue, 150);

console.log(
	"   ✅ SheetReset does not silently recalculate; RecalculateAll operates explicitly.\n",
);

// -----------------------------------------------------------------------------
// 9. Full Regression Across Slices 1 to 9 & DB Save
// 9. 3-Cell Circular Dependency Cycle Creation & Automatic Recovery
// -----------------------------------------------------------------------------
console.log("9. Verifying Full Regression Across All Slices...");
console.log(
	"9. Verifying 3-Cell Circular Dependency Cycle Creation & Automatic Recovery...",
);

const circModel = new SpreadsheetModel();
circModel.CreateBlank("CircSheet", 5, 5);

// Create 3-cell cycle: A1 = =B1, B1 = =C1, C1 = =A1
circModel.SetCell(1, 0, "=B1"); // A1 depends on B1
circModel.SetCell(1, 1, "=C1"); // B1 depends on C1
circModel.SetCell(1, 2, "=A1"); // C1 depends on A1 -> Cycle detected!

assert.strictEqual(
	circModel.GetCellValue(1, 2),
	"#CIRCULAR!",
	"C1 must evaluate to #CIRCULAR!",
);
assert.strictEqual(
	circModel.GetCellValue(1, 1),
	"#CIRCULAR!",
	"B1 must evaluate to #CIRCULAR!",
);
assert.strictEqual(
	circModel.GetCellValue(1, 0),
	"#CIRCULAR!",
	"A1 must evaluate to #CIRCULAR!",
);
assert.strictEqual(
	circModel.CalculationEngine.CircularFormulas.size,
	1,
	"Engine must track circular formula",
);

// Break the cycle: Set A1 = 10 (literal number)
circModel.SetCell(1, 0, 10);

assert.strictEqual(circModel.GetCellValue(1, 0), 10, "A1 must now be 10");
assert.strictEqual(
	circModel.GetCellValue(1, 2),
	10,
	"C1 must automatically recover and evaluate to 10 (=A1)",
);
assert.strictEqual(
	circModel.GetCellValue(1, 1),
	10,
	"B1 must automatically recover and evaluate to 10 (=C1)",
);
assert.strictEqual(
	circModel.CalculationEngine.CircularFormulas.size,
	0,
	"All circular formulas must be recovered and cleared from CircularFormulas",
);

console.log(
	"   ✅ 3-Cell circular cycle correctly diagnosed and automatically recovered upon breaking.\n",
);

// -----------------------------------------------------------------------------
// 10. Full Regression Across Slices 1 to 9 & DB Save
// -----------------------------------------------------------------------------
console.log("10. Verifying Full Regression Across All Slices...");

const { execSync } = require("child_process");
const testFiles = [
	"scratch/test_slice1.js",
	"scratch/test_slice2.js",
	"scratch/test_slice3.js",
	"scratch/test_slice4.js",
	"scratch/test_slice6.js",
	"scratch/test_slice7.js",
	"scratch/test_slice8.js",
	"scratch/test_slice9.js",
	"scratch/test_db_save.js",
];

for (const tf of testFiles) {
	try {
		execSync(`node ${tf}`, {
			cwd: path.join(__dirname, ".."),
			stdio: "pipe",
		});
		console.log(`   ${tf} passed cleanly ✅`);
	} catch (err) {
		console.error(`   ❌ ${tf} failed:`, err.stderr?.toString() || err.message);
		process.exit(1);
	}
}

console.log(
	"\n==========================================================================",
);
console.log(
	"COMMIT 1 (P0) VERIFICATION COMPLETE: ALL TESTS PASSED SUCCESSFULLY! 🏆🚀",
);
console.log(
	"ZERO-DOM BOUNDARY & SINGLE-NOTIFICATION INVARIANTS FULLY ACHIEVED!",
);
console.log(
	"==========================================================================",
);
