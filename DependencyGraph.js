/**
 * DependencyGraph.js
 *
 * Directed Acyclic Graph (DAG) state manager for Arbor Spreadsheet.
 * Tracks direct cell-to-cell and range-to-cell dependencies.
 * Provides non-destructive cycle validation (WouldCreateCycle) and
 * computes topological recalculation order for reactive updates.
 *
 * Zero DOM dependencies.
 * Strictly follows PascalCase for all properties and methods.
 */

// Universal import for ReferenceResolver (Browser global fallback / Node CommonJS)
const { ReferenceResolver } =
	typeof require !== "undefined"
		? require("./ReferenceResolver.js")
		: {
				ReferenceResolver: window.ReferenceResolver,
			};

/**
 * Graph-level state representation of a range dependency.
 * Represents a formula cell depending on a 2D bounding box of cells.
 */
class RangeDependency {
	/**
	 * @param {string} dependentCell - The cell containing the formula referencing this range (e.g. "C1")
	 * @param {number} startCol - 0-based start col index
	 * @param {number} startRow - 1-based start row index
	 * @param {number} endCol - 0-based end col index
	 * @param {number} endRow - 1-based end row index
	 * @param {string} rawReference - Canonical range coordinate string (e.g. "A1:B3")
	 */
	constructor(dependentCell, startCol, startRow, endCol, endRow, rawReference) {
		this.DependentCell = dependentCell ? dependentCell.toUpperCase() : "";
		this.StartCol = Math.min(startCol, endCol);
		this.StartRow = Math.min(startRow, endRow);
		this.EndCol = Math.max(startCol, endCol);
		this.EndRow = Math.max(startRow, endRow);
		this.RawReference = rawReference ? rawReference.toUpperCase() : "";
	}

	/**
	 * Tests if a given 0-based column and 1-based row index fall within this range.
	 * @param {number} colIndex
	 * @param {number} rowIndex
	 * @returns {boolean}
	 */
	ContainsCell(colIndex, rowIndex) {
		return (
			colIndex >= this.StartCol &&
			colIndex <= this.EndCol &&
			rowIndex >= this.StartRow &&
			rowIndex <= this.EndRow
		);
	}
}

class DependencyGraph {
	/**
	 * @param {ReferenceResolver} [resolver=null]
	 */
	constructor(resolver = null) {
		this.Resolver = resolver || new ReferenceResolver();
		this.Precedents = new Map(); // cellKey -> Set<cellKey>
		this.Dependents = new Map(); // cellKey -> Set<cellKey>
		this.RangePrecedents = new Map(); // cellKey -> Array<RangeDependency>
		this.RangeDependencies = []; // Array<RangeDependency>
	}

	/**
	 * Retrieves direct downstream dependents for a cell (both direct cell and range dependents).
	 * @param {string} cellKey
	 * @returns {string[]}
	 */
	GetDirectDependents(cellKey) {
		if (!cellKey || typeof cellKey !== "string") {
			return [];
		}

		const upperKey = cellKey.trim().toUpperCase();
		const result = new Set();

		// 1. Direct cell-to-cell dependents
		const direct = this.Dependents.get(upperKey);
		if (direct) {
			for (const dep of direct) {
				result.add(dep);
			}
		}

		// 2. Range dependents whose bounding box contains cellKey
		const coords = this.Resolver.CellKeyToCoords(upperKey);
		if (coords) {
			for (const rangeDep of this.RangeDependencies) {
				if (rangeDep.ContainsCell(coords.ColKey, coords.RowKey)) {
					result.add(rangeDep.DependentCell);
				}
			}
		}

		return Array.from(result);
	}

	/**
	 * Retrieves direct upstream precedents for a cell.
	 * @param {string} cellKey
	 * @returns {{ Cells: string[], Ranges: RangeDependency[] }}
	 */
	GetDirectPrecedents(cellKey) {
		if (!cellKey || typeof cellKey !== "string") {
			return { Cells: [], Ranges: [] };
		}

		const upperKey = cellKey.trim().toUpperCase();
		const cellPrecedents = this.Precedents.get(upperKey) || new Set();
		const rangePrecedents = this.RangePrecedents.get(upperKey) || [];

		return {
			Cells: Array.from(cellPrecedents),
			Ranges: rangePrecedents,
		};
	}

	/**
	 * Non-destructively tests whether adding proposed dependencies for cellKey would introduce a cycle.
	 * Does NOT mutate internal graph state.
	 * @param {string} cellKey - The cell proposing new dependencies
	 * @param {string[]|Set<string>} [proposedCellDependencies=[]] - Cell keys that cellKey would depend on
	 * @param {Array<{ StartCol: number, StartRow: number, EndCol: number, EndRow: number }>} [proposedRangeDependencies=[]] - Ranges that cellKey would depend on
	 * @returns {boolean} True if a circular dependency would be created; false otherwise.
	 */
	WouldCreateCycle(
		cellKey,
		proposedCellDependencies = [],
		proposedRangeDependencies = [],
	) {
		if (!cellKey || typeof cellKey !== "string") {
			return false;
		}

		const target = cellKey.trim().toUpperCase();
		const targetCoords = this.Resolver.CellKeyToCoords(target);

		const proposedCells = new Set();
		for (const cell of proposedCellDependencies) {
			proposedCells.add(cell.trim().toUpperCase());
		}

		// 1. Direct self-reference check
		if (proposedCells.has(target)) {
			return true;
		}

		if (targetCoords) {
			for (const range of proposedRangeDependencies) {
				const startCol = Math.min(range.StartCol, range.EndCol);
				const endCol = Math.max(range.StartCol, range.EndCol);
				const startRow = Math.min(range.StartRow, range.EndRow);
				const endRow = Math.max(range.StartRow, range.EndRow);
				if (
					targetCoords.ColKey >= startCol &&
					targetCoords.ColKey <= endCol &&
					targetCoords.RowKey >= startRow &&
					targetCoords.RowKey <= endRow
				) {
					return true;
				}
			}
		}

		// 2. Downstream reachability check via DFS
		// If target can reach any proposed precedent via existing dependents, adding precedent -> target creates a cycle.
		const visited = new Set();
		const stack = [target];

		while (stack.length > 0) {
			const current = stack.pop();
			if (visited.has(current)) {
				continue;
			}
			visited.add(current);

			const dependents = this.GetDirectDependents(current);
			for (const dep of dependents) {
				// If downstream reaches a proposed cell precedent
				if (proposedCells.has(dep)) {
					return true;
				}

				// If downstream reaches any cell inside a proposed range precedent
				const depCoords = this.Resolver.CellKeyToCoords(dep);
				if (depCoords) {
					for (const range of proposedRangeDependencies) {
						const startCol = Math.min(range.StartCol, range.EndCol);
						const endCol = Math.max(range.StartCol, range.EndCol);
						const startRow = Math.min(range.StartRow, range.EndRow);
						const endRow = Math.max(range.StartRow, range.EndRow);
						if (
							depCoords.ColKey >= startCol &&
							depCoords.ColKey <= endCol &&
							depCoords.RowKey >= startRow &&
							depCoords.RowKey <= endRow
						) {
							return true;
						}
					}
				}

				stack.push(dep);
			}
		}

		return false;
	}

	/**
	 * Sets the dependencies for a cellKey, updating all internal adjacency maps and ranges.
	 * Replaces any existing dependencies for cellKey.
	 * @param {string} cellKey
	 * @param {string[]|Set<string>} [proposedCellDependencies=[]]
	 * @param {Array<{ StartCol: number, StartRow: number, EndCol: number, EndRow: number, RawReference?: string }>} [proposedRangeDependencies=[]]
	 */
	SetDependencies(
		cellKey,
		proposedCellDependencies = [],
		proposedRangeDependencies = [],
	) {
		if (!cellKey || typeof cellKey !== "string") {
			return;
		}

		const upperKey = cellKey.trim().toUpperCase();

		// Clean up existing dependencies for this cell
		this.RemoveDependencies(upperKey);

		// 1. Add cell dependencies
		const cellDeps = new Set();
		for (const p of proposedCellDependencies) {
			const upperP = p.trim().toUpperCase();
			cellDeps.add(upperP);

			if (!this.Dependents.has(upperP)) {
				this.Dependents.set(upperP, new Set());
			}
			this.Dependents.get(upperP).add(upperKey);
		}
		this.Precedents.set(upperKey, cellDeps);

		// 2. Add range dependencies
		const rangeDeps = [];
		for (const r of proposedRangeDependencies) {
			const rangeDep = new RangeDependency(
				upperKey,
				r.StartCol,
				r.StartRow,
				r.EndCol,
				r.EndRow,
				r.RawReference || "",
			);
			rangeDeps.push(rangeDep);
			this.RangeDependencies.push(rangeDep);
		}
		this.RangePrecedents.set(upperKey, rangeDeps);
	}

	/**
	 * Removes all dependency associations for cellKey.
	 * @param {string} cellKey
	 */
	RemoveDependencies(cellKey) {
		if (!cellKey || typeof cellKey !== "string") {
			return;
		}

		const upperKey = cellKey.trim().toUpperCase();

		// 1. Remove from Dependents maps of previous cell precedents
		const previousPrecedents = this.Precedents.get(upperKey);
		if (previousPrecedents) {
			for (const p of previousPrecedents) {
				const depSet = this.Dependents.get(p);
				if (depSet) {
					depSet.delete(upperKey);
					if (depSet.size === 0) {
						this.Dependents.delete(p);
					}
				}
			}
			this.Precedents.delete(upperKey);
		}

		// 2. Remove from RangeDependencies array
		this.RangeDependencies = this.RangeDependencies.filter(
			(dep) => dep.DependentCell !== upperKey,
		);
		this.RangePrecedents.delete(upperKey);
	}

	/**
	 * Computes the topological recalculation order for all downstream cells affected by changes to changedCellKeys.
	 * Uses Kahn's algorithm restricted to the affected subgraph.
	 * @param {string|string[]} changedCellKeys
	 * @returns {{ Order: string[], HasCycle: boolean, CircularCells: string[] }}
	 */
	GetRecalculationOrder(changedCellKeys) {
		const changed = (
			Array.isArray(changedCellKeys) ? changedCellKeys : [changedCellKeys]
		)
			.filter((k) => k && typeof k === "string")
			.map((k) => k.trim().toUpperCase());

		// 1. Traverse all reachable downstream dependent cells (affected subgraph)
		const affected = new Set();
		const queue = [...changed];
		const visited = new Set();

		while (queue.length > 0) {
			const current = queue.shift();
			if (visited.has(current)) {
				continue;
			}
			visited.add(current);

			const dependents = this.GetDirectDependents(current);
			for (const dep of dependents) {
				affected.add(dep);
				queue.push(dep);
			}
		}

		if (affected.size === 0) {
			return { Order: [], HasCycle: false, CircularCells: [] };
		}

		// 2. Compute in-degree within the affected set
		const inDegree = new Map();
		for (const cell of affected) {
			inDegree.set(cell, 0);
		}

		for (const cell of affected) {
			const dependents = this.GetDirectDependents(cell);
			for (const dep of dependents) {
				if (affected.has(dep)) {
					inDegree.set(dep, inDegree.get(dep) + 1);
				}
			}
		}

		// 3. Queue cells with in-degree 0 (depend only on changed or external cells)
		const readyQueue = [];
		for (const [cell, deg] of inDegree.entries()) {
			if (deg === 0) {
				readyQueue.push(cell);
			}
		}

		// 4. Process in topological order
		const order = [];
		while (readyQueue.length > 0) {
			const current = readyQueue.shift();
			order.push(current);

			const dependents = this.GetDirectDependents(current);
			for (const dep of dependents) {
				if (affected.has(dep)) {
					const newDeg = inDegree.get(dep) - 1;
					inDegree.set(dep, newDeg);
					if (newDeg === 0) {
						readyQueue.push(dep);
					}
				}
			}
		}

		// 5. Detect cycles among affected cells
		const hasCycle = order.length < affected.size;
		const circularCells = hasCycle
			? Array.from(affected).filter((c) => !order.includes(c))
			: [];

		return {
			Order: order,
			HasCycle: hasCycle,
			CircularCells: circularCells,
		};
	}

	/**
	 * Computes the topological recalculation order for ALL registered formula cells in the graph.
	 * Used during full sheet recalculation (e.g. after loading from DB or switching sheets).
	 * @returns {{ Order: string[], HasCycle: boolean, CircularCells: string[] }}
	 */
	GetFullRecalculationOrder() {
		const allFormulaCells = new Set([
			...this.Precedents.keys(),
			...this.RangePrecedents.keys(),
		]);

		if (allFormulaCells.size === 0) {
			return { Order: [], HasCycle: false, CircularCells: [] };
		}

		// 1. Compute in-degree within the formula cell set
		const inDegree = new Map();
		for (const cell of allFormulaCells) {
			inDegree.set(cell, 0);
		}

		for (const cell of allFormulaCells) {
			// Direct cell precedents
			const cellPrecs = this.Precedents.get(cell);
			if (cellPrecs) {
				for (const p of cellPrecs) {
					if (allFormulaCells.has(p)) {
						inDegree.set(cell, inDegree.get(cell) + 1);
					}
				}
			}

			// Range precedents
			const rangePrecs = this.RangePrecedents.get(cell);
			if (rangePrecs && rangePrecs.length > 0) {
				for (const otherCell of allFormulaCells) {
					if (otherCell === cell) continue;
					const coords = this.Resolver.CellKeyToCoords(otherCell);
					if (coords) {
						for (const range of rangePrecs) {
							if (range.ContainsCell(coords.ColKey, coords.RowKey)) {
								inDegree.set(cell, inDegree.get(cell) + 1);
								break;
							}
						}
					}
				}
			}
		}

		// 2. Queue cells with in-degree 0 (no formula precedents)
		const readyQueue = [];
		for (const [cell, deg] of inDegree.entries()) {
			if (deg === 0) {
				readyQueue.push(cell);
			}
		}

		// 3. Process in topological order
		const order = [];
		while (readyQueue.length > 0) {
			const current = readyQueue.shift();
			order.push(current);

			const dependents = this.GetDirectDependents(current);
			for (const dep of dependents) {
				if (allFormulaCells.has(dep)) {
					const newDeg = inDegree.get(dep) - 1;
					inDegree.set(dep, newDeg);
					if (newDeg === 0) {
						readyQueue.push(dep);
					}
				}
			}
		}

		// 4. Detect cycles
		const hasCycle = order.length < allFormulaCells.size;
		const circularCells = hasCycle
			? Array.from(allFormulaCells).filter((c) => !order.includes(c))
			: [];

		return {
			Order: order,
			HasCycle: hasCycle,
			CircularCells: circularCells,
		};
	}

	/**
	 * Clears all dependency graph data.
	 */
	Clear() {
		this.Precedents.clear();
		this.Dependents.clear();
		this.RangePrecedents.clear();
		this.RangeDependencies = [];
	}
}

// Universal module export (Browser global & Node.js CommonJS)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		RangeDependency,
		DependencyGraph,
	};
}
