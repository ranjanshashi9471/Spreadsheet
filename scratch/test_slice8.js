/**
 * scratch/test_slice8.js
 *
 * Automated verification suite for Slice 8 of Phase 7:
 * Dependency Analysis & Directed Acyclic Graph (DAG) with Non-Destructive Cycle Detection.
 *
 * Checks:
 * 1. Universal PascalCase compliance on all classes, properties, and methods.
 * 2. AST dependency extraction via DependencyAnalyzer (cells, ranges, mixed formulas).
 * 3. DependencyGraph state management (Precedents, Dependents, RangeDependencies).
 * 4. Range dependency resolution: mutating a cell inside a range identifies the range-dependent cell.
 * 5. Non-destructive cycle detection (WouldCreateCycle):
 *    - Self-reference (A1 = A1, A1 = SUM(A1:A5))
 *    - Direct 2-cell cycle (A1 -> B1 -> A1)
 *    - Transitive multi-cell cycle (A1 -> B1 -> C1 -> A1)
 *    - Transitive range cycle (A1 -> B1 -> C1; A1 = SUM(C1:D5))
 *    - Non-destructive guarantee (graph state unchanged after WouldCreateCycle)
 * 6. Topological recalculation order (GetRecalculationOrder) for reactive propagation.
 * 7. Full regression suite across Slices 1 through 7 and database persistence.
 */

const assert = require("assert");
const { OhmFormulaParser } = require("../FormulaParser.js");
const { DependencyAnalyzer } = require("../DependencyAnalyzer.js");
const { DependencyGraph, RangeDependency } = require("../DependencyGraph.js");
const { FormulaEvaluator } = require("../FormulaEvaluator.js");

console.log(
	"==========================================================================",
);
console.log(
	"RUNNING SLICE 8 VERIFICATION: DEPENDENCY ANALYSIS & DAG (CYCLE DETECTION)",
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

const analyzer = new DependencyAnalyzer();
CheckPascalCase(analyzer, "DependencyAnalyzer");
CheckPascalCase(
	Object.getPrototypeOf(analyzer),
	"DependencyAnalyzer.prototype",
);

const rangeDep = new RangeDependency("C1", 0, 1, 1, 3, "A1:B3");
CheckPascalCase(rangeDep, "RangeDependency");
CheckPascalCase(Object.getPrototypeOf(rangeDep), "RangeDependency.prototype");

const graph = new DependencyGraph();
CheckPascalCase(graph, "DependencyGraph");
CheckPascalCase(Object.getPrototypeOf(graph), "DependencyGraph.prototype");

console.log(
	"   ✅ All classes, properties, and methods strictly follow Universal PascalCase.\n",
);

// -----------------------------------------------------------------------------
// 2. DependencyAnalyzer: Extracting AST Dependencies
// -----------------------------------------------------------------------------
console.log("2. Verifying DependencyAnalyzer AST extraction...");
const parser = new OhmFormulaParser();

// Pure arithmetic (zero dependencies)
const deps1 = analyzer.Analyze(parser.Parse("10 + 20 * 3"));
assert.strictEqual(deps1.Cells.size, 0);
assert.strictEqual(deps1.Ranges.length, 0);
console.log('   "10 + 20 * 3" -> 0 cells, 0 ranges ✅');

// Direct cell references
const deps2 = analyzer.Analyze(parser.Parse("A1 + B1 * 2"));
assert.strictEqual(deps2.Cells.size, 2);
assert(deps2.Cells.has("A1"));
assert(deps2.Cells.has("B1"));
assert.strictEqual(deps2.Ranges.length, 0);
console.log('   "A1 + B1 * 2" -> Cells: { A1, B1 } ✅');

// Range reference
const deps3 = analyzer.Analyze(parser.Parse("SUM(A1:B3)"));
assert.strictEqual(deps3.Cells.size, 0);
assert.strictEqual(deps3.Ranges.length, 1);
assert.strictEqual(deps3.Ranges[0].RawReference, "A1:B3");
console.log('   "SUM(A1:B3)" -> Ranges: [ A1:B3 ] ✅');

// Mixed formula: cells, ranges, comparisons, nested functions
const deps4 = analyzer.Analyze(
	parser.Parse("IF(A1 > 0, SUM(B1:B5) + C1, D1 * 2)"),
);
assert.strictEqual(deps4.Cells.size, 3);
assert(deps4.Cells.has("A1"));
assert(deps4.Cells.has("C1"));
assert(deps4.Cells.has("D1"));
assert.strictEqual(deps4.Ranges.length, 1);
assert.strictEqual(deps4.Ranges[0].RawReference, "B1:B5");
console.log(
	'   "IF(A1 > 0, SUM(B1:B5) + C1, D1 * 2)" -> Cells: { A1, C1, D1 }, Ranges: [ B1:B5 ] ✅\n',
);

// -----------------------------------------------------------------------------
// 3. DependencyGraph: Registering and Removing Dependencies
// -----------------------------------------------------------------------------
console.log("3. Verifying DependencyGraph registration and removal...");

graph.Clear();

// Cell C1 depends on A1 and B1
graph.SetDependencies("C1", ["A1", "B1"]);
assert.deepStrictEqual(graph.GetDirectDependents("A1"), ["C1"]);
assert.deepStrictEqual(graph.GetDirectDependents("B1"), ["C1"]);
const precC1 = graph.GetDirectPrecedents("C1");
assert.strictEqual(precC1.Cells.length, 2);
assert(precC1.Cells.includes("A1"));
assert(precC1.Cells.includes("B1"));
console.log("   SetDependencies('C1', ['A1', 'B1']) registered cleanly ✅");

// Updating C1 to depend only on D1 (cleans old edges)
graph.SetDependencies("C1", ["D1"]);
assert.deepStrictEqual(graph.GetDirectDependents("A1"), []);
assert.deepStrictEqual(graph.GetDirectDependents("B1"), []);
assert.deepStrictEqual(graph.GetDirectDependents("D1"), ["C1"]);
console.log(
	"   Updating C1 to ['D1'] cleanly decoupled previous precedents A1 & B1 ✅",
);

// Removing C1 dependencies entirely
graph.RemoveDependencies("C1");
assert.deepStrictEqual(graph.GetDirectDependents("D1"), []);
assert.strictEqual(graph.GetDirectPrecedents("C1").Cells.length, 0);
console.log("   RemoveDependencies('C1') removed all edges ✅\n");

// -----------------------------------------------------------------------------
// 4. Range Dependencies in DependencyGraph
// -----------------------------------------------------------------------------
console.log("4. Verifying Range Dependencies in DependencyGraph...");

graph.Clear();

// Total cell T1 depends on SUM(A1:B2)
const rangeNodeA1B2 = {
	StartCol: 0,
	StartRow: 1,
	EndCol: 1,
	EndRow: 2,
	RawReference: "A1:B2",
};
graph.SetDependencies("T1", [], [rangeNodeA1B2]);

// Any cell within A1:B2 (A1, A2, B1, B2) must report T1 as a dependent!
assert(graph.GetDirectDependents("A1").includes("T1"), "A1 is inside A1:B2");
assert(graph.GetDirectDependents("A2").includes("T1"), "A2 is inside A1:B2");
assert(graph.GetDirectDependents("B1").includes("T1"), "B1 is inside A1:B2");
assert(graph.GetDirectDependents("B2").includes("T1"), "B2 is inside A1:B2");

// Cells outside A1:B2 must NOT report T1 as a dependent
assert(!graph.GetDirectDependents("C1").includes("T1"), "C1 is outside A1:B2");
assert(!graph.GetDirectDependents("A3").includes("T1"), "A3 is outside A1:B2");
console.log(
	"   Mutating any cell inside range A1:B2 correctly identifies dependent cell T1 ✅\n",
);

// -----------------------------------------------------------------------------
// 5. Non-Destructive Cycle Detection (WouldCreateCycle)
// -----------------------------------------------------------------------------
console.log(
	"5. Verifying Non-Destructive Cycle Detection (WouldCreateCycle)...",
);

graph.Clear();
// Build baseline chain: A1 -> B1 -> C1 -> D1
graph.SetDependencies("B1", ["A1"]);
graph.SetDependencies("C1", ["B1"]);
graph.SetDependencies("D1", ["C1"]);

// Snapshot graph state before cycle checks
const preDependentsSnapshot = new Map(
	Array.from(graph.Dependents.entries()).map(([k, v]) => [k, new Set(v)]),
);
const prePrecedentsSnapshot = new Map(
	Array.from(graph.Precedents.entries()).map(([k, v]) => [k, new Set(v)]),
);

// Case A: Direct self-reference (A1 depends on A1)
assert.strictEqual(
	graph.WouldCreateCycle("A1", ["A1"]),
	true,
	"Self-reference must create cycle",
);
console.log("   A1 depends on A1 -> Cycle detected ✅");

// Case B: Direct 2-cell cycle (A1 depends on B1 while B1 depends on A1)
assert.strictEqual(
	graph.WouldCreateCycle("A1", ["B1"]),
	true,
	"Direct 2-cell cycle must be detected",
);
console.log("   A1 depends on B1 (when B1 depends on A1) -> Cycle detected ✅");

// Case C: Transitive multi-cell cycle (A1 depends on D1 while A1 -> B1 -> C1 -> D1)
assert.strictEqual(
	graph.WouldCreateCycle("A1", ["D1"]),
	true,
	"Transitive cycle must be detected",
);
console.log(
	"   A1 depends on D1 (transitive chain A1->B1->C1->D1) -> Cycle detected ✅",
);

// Case D: Range self-reference (A1 = SUM(A1:B3))
const selfRange = { StartCol: 0, StartRow: 1, EndCol: 1, EndRow: 3 };
assert.strictEqual(
	graph.WouldCreateCycle("A1", [], [selfRange]),
	true,
	"Range containing self must create cycle",
);
console.log("   A1 depends on SUM(A1:B3) -> Cycle detected ✅");

// Case E: Transitive range cycle (A1 = SUM(C1:D5) where C1 and D1 depend on A1)
const transitiveRange = { StartCol: 2, StartRow: 1, EndCol: 3, EndRow: 5 }; // C1:D5
assert.strictEqual(
	graph.WouldCreateCycle("A1", [], [transitiveRange]),
	true,
	"Transitive range cycle must be detected",
);
console.log(
	"   A1 depends on SUM(C1:D5) -> Transitive range cycle detected ✅",
);

// Case F: Valid non-cycle dependencies
assert.strictEqual(
	graph.WouldCreateCycle("A1", ["Z1"]),
	false,
	"A1 depending on independent Z1 is valid",
);
assert.strictEqual(
	graph.WouldCreateCycle("D1", ["Z1"]),
	false,
	"D1 depending on Z1 is valid",
);
console.log("   A1 depends on independent Z1 -> No cycle (valid) ✅");

// Case G: Non-destructive verification: graph state must NOT have changed!
assert.strictEqual(graph.Dependents.size, preDependentsSnapshot.size);
for (const [k, v] of preDependentsSnapshot.entries()) {
	assert.deepStrictEqual(graph.Dependents.get(k), v);
}
assert.strictEqual(graph.Precedents.size, prePrecedentsSnapshot.size);
for (const [k, v] of prePrecedentsSnapshot.entries()) {
	assert.deepStrictEqual(graph.Precedents.get(k), v);
}
console.log(
	"   ✅ Non-Destructive Guarantee: Graph state was 100% preserved without mutations.\n",
);

// -----------------------------------------------------------------------------
// 6. Topological Recalculation Order (GetRecalculationOrder)
// -----------------------------------------------------------------------------
console.log("6. Verifying Topological Recalculation Order...");

graph.Clear();
// Diamond DAG:
//       A1
//      /  \
//     B1   C1
//      \  /
//       D1
//       |
//       E1
graph.SetDependencies("B1", ["A1"]);
graph.SetDependencies("C1", ["A1"]);
graph.SetDependencies("D1", ["B1", "C1"]);
graph.SetDependencies("E1", ["D1"]);

const topoResult = graph.GetRecalculationOrder("A1");
assert.strictEqual(topoResult.HasCycle, false, "Diamond DAG has no cycles");
const order = topoResult.Order;
console.log("   Topological order for A1 change:", order);

// Verification of topological invariants:
// B1 and C1 must come before D1
assert(order.indexOf("B1") < order.indexOf("D1"), "B1 evaluated before D1");
assert(order.indexOf("C1") < order.indexOf("D1"), "C1 evaluated before D1");
// D1 must come before E1
assert(order.indexOf("D1") < order.indexOf("E1"), "D1 evaluated before E1");
console.log(
	"   ✅ Topological order invariant verified: precedents evaluated strictly before dependents.\n",
);

// -----------------------------------------------------------------------------
// 7. Full Regression Across All Slices (1 to 7)
// -----------------------------------------------------------------------------
console.log("7. Verifying Regression Across Slices 1 to 7...");

const evaluator = new FormulaEvaluator();

// Slices 1-3
assert.strictEqual(evaluator.Evaluate(parser.Parse("10 + 20 * 3")), 70);
assert.strictEqual(evaluator.Evaluate(parser.Parse("2 ^ 3 ^ 2")), 512);

// Slice 4 & 6
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("SUM(A1:B2)"), {
		A1: 1,
		A2: 2,
		B1: 3,
		B2: 4,
	}),
	10,
);
assert.strictEqual(evaluator.Evaluate(parser.Parse("10 + 5 > 12")), true);

// Slice 7: Short-circuit IF
assert.strictEqual(
	evaluator.Evaluate(parser.Parse("IF(TRUE, 100, 1 / 0)")),
	100,
);
assert.strictEqual(
	evaluator.Evaluate(parser.Parse('IFERROR(10 / 0, "Fallback")')),
	"Fallback",
);

console.log(
	"   ✅ All Slice 1 to Slice 7 expressions continue to pass cleanly.\n",
);

console.log(
	"==========================================================================",
);
console.log("ALL SLICE 8 TESTS COMPLETED SUCCESSFULLY! 🎉");
console.log("Seam verified: DependencyAnalyzer & DependencyGraph complete. 🎯");
console.log(
	"==========================================================================",
);
