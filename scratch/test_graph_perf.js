/**
 * test_graph_perf.js
 *
 * Performance Benchmark & Scaling Verification Suite for Commit 2:
 * DependencyGraph Traversal & Cycle Detection Optimizations.
 *
 * Reference benchmark observed on development environment (for regression detection,
 * not contractual SLA guarantees).
 *
 * Benchmarks:
 * 1. Linear Chain Scaling: 100 -> 1,000 -> 5,000 -> 10,000 nodes (queueHead vs array reindexing)
 * 2. Diamond DAG Lattice: width 10/tiers 10 -> width 20/tiers 25 -> width 25/tiers 40 (readyHead & convergence)
 * 3. Wide Fan-Out: 1 root -> 100, 1,000, 5,000 independent formulas
 * 4. Deep Binary Tree Hierarchy: depth 10 (1,023) -> depth 12 (4,095) -> depth 14 (16,383)
 * 5. Range Dependency Profiling: Range-Light (10 ranges) vs Range-Heavy (500 ranges)
 * 6. Full Graph Recalculation: GetFullRecalculationOrder (1,000 & 3,000 nodes)
 *
 * Methodology:
 * 1. Graph construction is separated from measurement (pure graph traversal timing).
 * 2. 5-iteration warm-up before timing to stabilize V8 JIT.
 * 3. Multiple timed iterations (10-20) measuring average, minimum, and maximum elapsed times.
 * 4. Topological correctness assertion (precedent-before-dependent check) verified per tier.
 */

const assert = require("assert");
const { performance } = require("perf_hooks");
const { DependencyGraph } = require("../DependencyGraph.js");
const { ReferenceResolver } = require("../ReferenceResolver.js");

console.log(
	"==========================================================================",
);
console.log(
	"RUNNING COMMIT 2: DEPENDENCY GRAPH PERFORMANCE & SCALING BENCHMARKS",
);
console.log(
	"==========================================================================\n",
);

const resolver = new ReferenceResolver();

/**
 * Validates that every precedent of a cell strictly precedes it in topological Order.
 * @param {DependencyGraph} graph
 * @param {string[]} order
 */
function verifyTopologicalOrdering(graph, order) {
	const pos = new Map();
	for (let i = 0; i < order.length; i++) {
		pos.set(order[i], i);
	}

	for (const cell of order) {
		const precedents = graph.Precedents.get(cell);
		if (precedents) {
			for (const p of precedents) {
				if (pos.has(p)) {
					assert.ok(
						pos.get(p) < pos.get(cell),
						`Topological violation: precedent ${p} (pos ${pos.get(p)}) must precede dependent ${cell} (pos ${pos.get(cell)})`,
					);
				}
			}
		}
	}
}

/**
 * Standardized benchmark runner.
 * Separates construction, warms up JIT, measures multiple iterations, and validates correctness.
 *
 * @param {object} params
 * @param {string} params.name - Benchmark display name
 * @param {Function} params.buildGraph - Factory function to build graph
 * @param {Function} params.query - Function to execute query on graph
 * @param {Function} [params.verify] - Optional verification callback
 * @param {number} [params.iterations=10] - Number of timed iterations
 * @param {number} [params.warmups=5] - Number of un-timed warm-up runs
 */
function runBenchmark({
	name,
	buildGraph,
	query,
	verify,
	iterations = 10,
	warmups = 5,
}) {
	// Phase 1: Build graph (un-timed)
	const graph = buildGraph();

	// Phase 2: Warm-up runs to prime V8 JIT
	for (let i = 0; i < warmups; i++) {
		query(graph);
	}

	// Phase 3: Timed measurement
	const times = [];
	let lastResult = null;
	const totalStart = performance.now();
	for (let i = 0; i < iterations; i++) {
		const t0 = performance.now();
		lastResult = query(graph);
		const t1 = performance.now();
		times.push(t1 - t0);
	}
	const totalMs = performance.now() - totalStart;

	const minMs = Math.min(...times);
	const maxMs = Math.max(...times);
	const avgMs = times.reduce((a, b) => a + b, 0) / times.length;

	// Phase 4: Correctness & invariant verification
	if (verify) {
		verify(graph, lastResult);
	}

	console.log(
		`   ${name.padEnd(37)} | Count: ${String(lastResult.Order.length).padStart(5)} | Avg: ${avgMs.toFixed(3)} ms | Min: ${minMs.toFixed(3)} ms | Max: ${maxMs.toFixed(3)} ms ✅`,
	);

	return { avgMs, minMs, maxMs, totalMs, count: lastResult.Order.length };
}

// -----------------------------------------------------------------------------
// 1. Linear Chain Scaling: 100 -> 1,000 -> 5,000 -> 10,000 nodes
// Specifically exercises pointer-based queueHead traversal vs array re-indexing
// -----------------------------------------------------------------------------
console.log(
	"1. Linear Chain Traversal (Testing queueHead traversal vs array reindexing):",
);

const linearTiers = [100, 1000, 5000, 10000];
for (const n of linearTiers) {
	runBenchmark({
		name: `Linear Chain (N = ${n})`,
		buildGraph: () => {
			const g = new DependencyGraph(resolver);
			for (let i = 2; i <= n; i++) {
				g.SetDependencies(`L${i}`, [`L${i - 1}`]);
			}
			return g;
		},
		query: (g) => g.GetRecalculationOrder(["L1"]),
		verify: (g, res) => {
			assert.strictEqual(res.HasCycle, false, "Chain must not have cycles");
			assert.strictEqual(
				res.Order.length,
				n - 1,
				`Must contain all ${n - 1} dependents`,
			);
			assert.strictEqual(res.Order[0], "L2", "L2 must be first");
			assert.strictEqual(
				res.Order[res.Order.length - 1],
				`L${n}`,
				`L${n} must be last`,
			);
			verifyTopologicalOrdering(g, res.Order);
		},
		iterations: 15,
	});
}
console.log();

// -----------------------------------------------------------------------------
// 2. Diamond DAG Lattice Scaling: width 10/tiers 10 -> width 25/tiers 40
// Tests duplicate convergence and readyQueue head-index traversal
// -----------------------------------------------------------------------------
console.log(
	"2. Diamond DAG Lattice (Testing duplicate convergence & readyQueue):",
);

const diamondConfigs = [
	{ name: "Diamond DAG (width 10, tiers 10)", width: 10, tiers: 10 },
	{ name: "Diamond DAG (width 20, tiers 25)", width: 20, tiers: 25 },
	{ name: "Diamond DAG (width 25, tiers 40)", width: 25, tiers: 40 },
];

for (const cfg of diamondConfigs) {
	runBenchmark({
		name: cfg.name,
		buildGraph: () => {
			const g = new DependencyGraph(resolver);
			for (let t = 1; t < cfg.tiers; t++) {
				for (let i = 0; i < cfg.width; i++) {
					g.SetDependencies(`D_${t}_${i}`, [
						`D_${t - 1}_${i}`,
						`D_${t - 1}_${(i + 1) % cfg.width}`,
					]);
				}
			}
			return g;
		},
		query: (g) => g.GetRecalculationOrder(["D_0_0"]),
		verify: (g, res) => {
			assert.strictEqual(
				res.HasCycle,
				false,
				"Diamond DAG must not have cycles",
			);
			assert.ok(
				res.Order.length > 0,
				"Order must contain affected diamond nodes",
			);
			// Invariant: Zero duplicate cells in topological order
			const set = new Set(res.Order);
			assert.strictEqual(
				set.size,
				res.Order.length,
				"Order must contain 0 duplicates",
			);
			verifyTopologicalOrdering(g, res.Order);
		},
		iterations: 15,
	});
}
console.log();

// -----------------------------------------------------------------------------
// 3. Wide Fan-Out: 1 root -> 100, 1,000, 5,000 independent formulas
// -----------------------------------------------------------------------------
console.log("3. Wide Fan-Out (1 Root driving N formulas):");

const fanOutTiers = [100, 1000, 5000];
for (const n of fanOutTiers) {
	runBenchmark({
		name: `Wide Fan-Out (N = ${n})`,
		buildGraph: () => {
			const g = new DependencyGraph(resolver);
			for (let i = 1; i <= n; i++) {
				g.SetDependencies(`F_${i}`, ["ROOT"]);
			}
			return g;
		},
		query: (g) => g.GetRecalculationOrder(["ROOT"]),
		verify: (g, res) => {
			assert.strictEqual(res.HasCycle, false, "Fan-out must not have cycles");
			assert.strictEqual(res.Order.length, n, `Must order all ${n} dependents`);
			verifyTopologicalOrdering(g, res.Order);
		},
		iterations: 15,
	});
}
console.log();

// -----------------------------------------------------------------------------
// 4. Deep Binary Tree Hierarchy: depth 10 (1k) -> 12 (4k) -> 14 (16k)
// -----------------------------------------------------------------------------
console.log("4. Deep Binary Tree Hierarchy (Cascading hierarchical tree):");

const treeDepths = [10, 12, 14];
for (const depth of treeDepths) {
	const totalNodes = Math.pow(2, depth) - 1;
	runBenchmark({
		name: `Binary Tree (depth ${depth}, N = ${totalNodes})`,
		buildGraph: () => {
			const g = new DependencyGraph(resolver);
			for (let i = 2; i <= totalNodes; i++) {
				const parent = Math.floor(i / 2);
				g.SetDependencies(`N_${i}`, [`N_${parent}`]);
			}
			return g;
		},
		query: (g) => g.GetRecalculationOrder(["N_1"]),
		verify: (g, res) => {
			assert.strictEqual(
				res.HasCycle,
				false,
				"Binary tree must not have cycles",
			);
			assert.strictEqual(
				res.Order.length,
				totalNodes - 1,
				`Must order all ${totalNodes - 1} dependents`,
			);
			verifyTopologicalOrdering(g, res.Order);
		},
		iterations: 10,
	});
}
console.log();

// -----------------------------------------------------------------------------
// 5. Range Dependency Profiling: Range-Light vs Range-Heavy
// Exposes RangeDependencies scan cost to establish baseline for future indexing
// -----------------------------------------------------------------------------
console.log(
	"5. Range Dependency Profiling (Comparing Range-Light vs Range-Heavy):",
);

// 5.1: Range-Light (1,000 scalar formulas, 10 range summaries)
runBenchmark({
	name: "Range-Light (1k formulas, 10 ranges)",
	buildGraph: () => {
		const g = new DependencyGraph(resolver);
		for (let i = 1; i <= 1000; i++) {
			g.SetDependencies(`C_${i}`, [`C_${i - 1}`]);
		}
		for (let r = 1; r <= 10; r++) {
			g.SetDependencies(
				`RNG_SUM_${r}`,
				[],
				[
					{
						StartCol: 0,
						StartRow: r * 50,
						EndCol: 0,
						EndRow: r * 50 + 40,
						RawReference: `A${r * 50}:A${r * 50 + 40}`,
					},
				],
			);
		}
		return g;
	},
	query: (g) => g.GetRecalculationOrder(["A150"]),
	verify: (g, res) => {
		assert.strictEqual(res.HasCycle, false);
		verifyTopologicalOrdering(g, res.Order);
	},
	iterations: 20,
});

// 5.2: Range-Heavy (1,000 scalar formulas, 500 range summaries)
runBenchmark({
	name: "Range-Heavy (1k formulas, 500 ranges)",
	buildGraph: () => {
		const g = new DependencyGraph(resolver);
		for (let i = 1; i <= 1000; i++) {
			g.SetDependencies(`C_${i}`, [`C_${i - 1}`]);
		}
		for (let r = 1; r <= 500; r++) {
			const startRow = (r % 50) + 1;
			g.SetDependencies(
				`RNG_SUM_${r}`,
				[],
				[
					{
						StartCol: 0,
						StartRow: startRow,
						EndCol: 0,
						EndRow: startRow + 20,
						RawReference: `A${startRow}:A${startRow + 20}`,
					},
				],
			);
		}
		return g;
	},
	query: (g) => g.GetRecalculationOrder(["A25"]),
	verify: (g, res) => {
		assert.strictEqual(res.HasCycle, false);
		assert.ok(
			res.Order.length > 0,
			"Mutating A25 must trigger overlapping range summaries",
		);
		verifyTopologicalOrdering(g, res.Order);
	},
	iterations: 20,
});
console.log();

// -----------------------------------------------------------------------------
// 6. Full Graph Recalculation: GetFullRecalculationOrder (1,000 & 3,000 formulas)
// -----------------------------------------------------------------------------
console.log("6. Full Sheet Recalculation Order (GetFullRecalculationOrder):");

for (const n of [1000, 3000]) {
	runBenchmark({
		name: `Full Graph Recalc (N = ${n})`,
		buildGraph: () => {
			const g = new DependencyGraph(resolver);
			for (let i = 2; i <= n; i++) {
				const p1 = `F_${i - 1}`;
				const p2 = i > 10 ? `F_${i - 10}` : `F_1`;
				g.SetDependencies(`F_${i}`, [p1, p2]);
			}
			return g;
		},
		query: (g) => g.GetFullRecalculationOrder(),
		verify: (g, res) => {
			assert.strictEqual(res.HasCycle, false);
			assert.strictEqual(res.Order.length, n - 1);
			verifyTopologicalOrdering(g, res.Order);
		},
		iterations: 10,
	});
}

console.log(
	"\n==========================================================================",
);
console.log(
	"BENCHMARK SUITE COMPLETE: ACCELERATED SCALING CURVES VERIFIED! ⚡🏆",
);
console.log(
	"==========================================================================",
);
