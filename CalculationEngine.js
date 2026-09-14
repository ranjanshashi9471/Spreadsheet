/**
 * CalculationEngine.js
 *
 * Master calculation coordinator for the Arbor Spreadsheet engine.
 * Integrates FormulaParser, DependencyAnalyzer, DependencyGraph, FormulaEvaluator,
 * and ReferenceResolver into a unified, reactive calculation engine.
 *
 * Responsibilities:
 * - Differentiates raw literal values from formulas (prefixed with '=').
 * - Coordinates parsing, dependency extraction, cycle validation, and evaluation.
 * - Manages AST caching for high-performance recalculations.
 * - Propagates reactive recalculations downstream in topological order via Kahn's algorithm.
 * - Handles circular reference (#CIRCULAR!) and syntax error (#ERROR!) detection safely.
 * - Supports full-sheet re-evaluation on sheet load or switch.
 *
 * Zero DOM dependencies.
 * Strictly follows PascalCase for all properties and methods.
 */

// Universal imports (Browser global fallback / Node CommonJS)
const { ReferenceResolver: CalcRefResolver } =
	typeof require !== "undefined"
		? require("./ReferenceResolver.js")
		: {
				ReferenceResolver: window.ReferenceResolver,
			};

const { OhmFormulaParser: CalcOhmParser, FormulaParser: CalcBaseParser } =
	typeof require !== "undefined"
		? require("./FormulaParser.js")
		: {
				OhmFormulaParser: window.OhmFormulaParser,
				FormulaParser: window.FormulaParser,
			};

const { FormulaEvaluator: CalcEvaluator } =
	typeof require !== "undefined"
		? require("./FormulaEvaluator.js")
		: {
				FormulaEvaluator: window.FormulaEvaluator,
			};

const { DependencyAnalyzer: CalcAnalyzer } =
	typeof require !== "undefined"
		? require("./DependencyAnalyzer.js")
		: {
				DependencyAnalyzer: window.DependencyAnalyzer,
			};

const { DependencyGraph: CalcGraph } =
	typeof require !== "undefined"
		? require("./DependencyGraph.js")
		: {
				DependencyGraph: window.DependencyGraph,
			};

const { ErrorNode: CalcErrorNode } =
	typeof require !== "undefined"
		? require("./FormulaAST.js")
		: {
				ErrorNode: window.ErrorNode,
			};

class CalculationEngine {
	/**
	 * @param {FormulaParser|null} [parser=null]
	 * @param {FormulaEvaluator|null} [evaluator=null]
	 * @param {DependencyAnalyzer|null} [analyzer=null]
	 * @param {DependencyGraph|null} [graph=null]
	 * @param {ReferenceResolver|null} [resolver=null]
	 */
	constructor(
		parser = null,
		evaluator = null,
		analyzer = null,
		graph = null,
		resolver = null,
	) {
		this.Parser =
			parser ||
			(typeof CalcOhmParser !== "undefined"
				? new CalcOhmParser()
				: typeof CalcBaseParser !== "undefined"
					? new CalcBaseParser()
					: null);
		this.Evaluator =
			evaluator ||
			(typeof CalcEvaluator !== "undefined" ? new CalcEvaluator() : null);
		this.Analyzer =
			analyzer ||
			(typeof CalcAnalyzer !== "undefined" ? new CalcAnalyzer() : null);
		this.Graph =
			graph || (typeof CalcGraph !== "undefined" ? new CalcGraph() : null);
		this.Resolver =
			resolver ||
			(typeof CalcRefResolver !== "undefined" ? new CalcRefResolver() : null);
		this.FormulaCache = new Map(); // cellKey -> { AST: ASTNode, RawFormula: string }
		this.CircularFormulas = new Map(); // cellKey -> { AST, RawFormula, Cells, Ranges, RowKey, ColKey, Style }
	}

	// Backwards-compatible lowercase property aliases
	get parser() {
		return this.Parser;
	}
	set parser(val) {
		this.Parser = val;
	}
	get evaluator() {
		return this.Evaluator;
	}
	set evaluator(val) {
		this.Evaluator = val;
	}
	get analyzer() {
		return this.Analyzer;
	}
	set analyzer(val) {
		this.Analyzer = val;
	}
	get graph() {
		return this.Graph;
	}
	set graph(val) {
		this.Graph = val;
	}
	get resolver() {
		return this.Resolver;
	}
	set resolver(val) {
		this.Resolver = val;
	}
	get formulaCache() {
		return this.FormulaCache;
	}
	get circularFormulas() {
		return this.CircularFormulas;
	}

	/**
	 * Checks if a given cell value is a formula.
	 * A value is a formula if it is a string starting with '=' after trimming.
	 * @param {*} value
	 * @returns {boolean}
	 */
	IsFormula(value) {
		return typeof value === "string" && value.trim().startsWith("=");
	}

	/**
	 * Processes an update to a cell value, coordinating dependency management,
	 * cycle detection, formula evaluation, and downstream recalculation.
	 * @param {SpreadsheetModel|object} model - The active spreadsheet model.
	 * @param {number} rowKey - 1-based row index.
	 * @param {number|string} colKey - 0-based column index.
	 * @param {*} rawValue - The raw input value (literal or formula string).
	 * @param {object} [style={}] - Optional cell style metadata.
	 * @returns {Array<{ RowKey: number, ColKey: number, Value: *, ComputedValue: *, Style: object }>}
	 */
	ProcessCellUpdate(model, rowKey, colKey, rawValue, style = {}) {
		const numColKey =
			typeof colKey === "number"
				? colKey
				: this.Resolver.ToColumnIndex(String(colKey));
		const cellKey = this.Resolver.CoordsToCellKey(rowKey, numColKey);
		const changedMap = new Map();

		// Case 1: Non-formula literal value
		if (!this.IsFormula(rawValue)) {
			this.Graph?.RemoveDependencies(cellKey);
			this.FormulaCache.delete(cellKey);
			this.CircularFormulas.delete(cellKey);

			const computedValue = rawValue;
			this.#CommitCellToStore(
				model,
				rowKey,
				numColKey,
				rawValue,
				style,
				computedValue,
			);
			changedMap.set(cellKey, {
				RowKey: rowKey,
				ColKey: numColKey,
				Value: rawValue,
				ComputedValue: computedValue,
				Style: style,
			});

			const recovered = this.#RecoverCircularFormulas(model);
			const keysToRecalc =
				recovered.length > 0 ? [cellKey, ...recovered] : cellKey;

			const depChanges = this.RecalculateDependents(model, keysToRecalc);
			for (const c of depChanges) {
				const k = this.Resolver.CoordsToCellKey(c.RowKey, c.ColKey);
				changedMap.set(k, c);
			}

			return Array.from(changedMap.values());
		}

		// Case 2: Formula string
		const rawFormula = String(rawValue).trim();
		let astNode;

		try {
			astNode = this.Parser ? this.Parser.Parse(rawFormula) : null;
		} catch (err) {
			astNode = new CalcErrorNode("#ERROR!");
		}

		// Check for syntax / parsing error
		if (!astNode || astNode instanceof CalcErrorNode) {
			this.Graph?.RemoveDependencies(cellKey);
			this.FormulaCache.delete(cellKey);
			this.CircularFormulas.delete(cellKey);

			const computedValue = astNode?.ErrorMessage || "#ERROR!";
			this.#CommitCellToStore(
				model,
				rowKey,
				numColKey,
				rawValue,
				style,
				computedValue,
			);
			changedMap.set(cellKey, {
				RowKey: rowKey,
				ColKey: numColKey,
				Value: rawValue,
				ComputedValue: computedValue,
				Style: style,
			});

			const recovered = this.#RecoverCircularFormulas(model);
			const keysToRecalc =
				recovered.length > 0 ? [cellKey, ...recovered] : cellKey;

			const depChanges = this.RecalculateDependents(model, keysToRecalc);
			for (const c of depChanges) {
				const k = this.Resolver.CoordsToCellKey(c.RowKey, c.ColKey);
				changedMap.set(k, c);
			}

			return Array.from(changedMap.values());
		}

		// Analyze dependencies
		const { Cells, Ranges } = this.Analyzer
			? this.Analyzer.Analyze(astNode)
			: { Cells: new Set(), Ranges: [] };

		// Non-destructive cycle check
		if (this.Graph && this.Graph.WouldCreateCycle(cellKey, Cells, Ranges)) {
			this.Graph.RemoveDependencies(cellKey);
			this.FormulaCache.delete(cellKey);
			this.CircularFormulas.set(cellKey, {
				AST: astNode,
				RawFormula: rawFormula,
				Cells,
				Ranges,
				RowKey: rowKey,
				ColKey: numColKey,
				Style: style,
			});

			const computedValue = "#CIRCULAR!";
			this.#CommitCellToStore(
				model,
				rowKey,
				numColKey,
				rawValue,
				style,
				computedValue,
			);
			changedMap.set(cellKey, {
				RowKey: rowKey,
				ColKey: numColKey,
				Value: rawValue,
				ComputedValue: computedValue,
				Style: style,
			});

			const depChanges = this.RecalculateDependents(model, cellKey);
			for (const c of depChanges) {
				const k = this.Resolver.CoordsToCellKey(c.RowKey, c.ColKey);
				changedMap.set(k, c);
			}

			return Array.from(changedMap.values());
		}

		// No cycle: register dependencies and cache AST
		if (this.Graph) {
			this.Graph.SetDependencies(cellKey, Cells, Ranges);
		}
		this.FormulaCache.set(cellKey, { AST: astNode, RawFormula: rawFormula });
		this.CircularFormulas.delete(cellKey);

		// Evaluate formula in model context
		let computedValue;
		try {
			computedValue = this.Evaluator
				? this.Evaluator.Evaluate(astNode, model)
				: "#ERROR!";
		} catch (evalErr) {
			computedValue = "#ERROR!";
		}

		// Commit to storage
		this.#CommitCellToStore(
			model,
			rowKey,
			numColKey,
			rawValue,
			style,
			computedValue,
		);
		changedMap.set(cellKey, {
			RowKey: rowKey,
			ColKey: numColKey,
			Value: rawValue,
			ComputedValue: computedValue,
			Style: style,
		});

		// Check if any circular formulas can now be recovered
		const recovered = this.#RecoverCircularFormulas(model);

		// Recalculate downstream dependent cells and any recovered circular formulas
		const depChanges = this.RecalculateDependents(model, cellKey, recovered);
		for (const c of depChanges) {
			const k = this.Resolver.CoordsToCellKey(c.RowKey, c.ColKey);
			changedMap.set(k, c);
		}

		return Array.from(changedMap.values());
	}

	/**
	 * Recalculates all downstream dependent cells in topological order.
	 * Also recalculates any explicitly supplied formula keys (e.g. recovered circular formulas or restored formulas).
	 * @param {SpreadsheetModel|object} model - The active spreadsheet model.
	 * @param {string|string[]} changedCellKeys - One or more cell keys that changed.
	 * @param {string|string[]} [includeFormulaKeys=[]] - Formula cell keys that must be evaluated themselves.
	 * @returns {Array<{ RowKey: number, ColKey: number, Value: *, ComputedValue: *, Style: object }>}
	 */
	RecalculateDependents(model, changedCellKeys, includeFormulaKeys = []) {
		if (!this.Graph || !this.Evaluator) {
			return [];
		}

		const keys = Array.isArray(changedCellKeys)
			? changedCellKeys
			: [changedCellKeys];
		const formulaKeys = Array.isArray(includeFormulaKeys)
			? includeFormulaKeys
			: [includeFormulaKeys];
		const recalcResult = this.Graph.GetRecalculationOrder(keys, formulaKeys);
		const changedMap = new Map();

		// Flag any circular cells detected downstream
		if (recalcResult.HasCycle && recalcResult.CircularCells) {
			for (const circKey of recalcResult.CircularCells) {
				const coords = this.Resolver.CellKeyToCoords(circKey);
				if (!coords) continue;
				const cell = model.GetCell
					? model.GetCell(coords.RowKey, coords.ColKey)
					: null;
				const raw = cell ? (cell.Value ?? cell.value ?? "") : "";
				const style = cell ? (cell.Style ?? cell.style ?? {}) : {};
				this.#CommitCellToStore(
					model,
					coords.RowKey,
					coords.ColKey,
					raw,
					style,
					"#CIRCULAR!",
				);
				changedMap.set(circKey, {
					RowKey: coords.RowKey,
					ColKey: coords.ColKey,
					Value: raw,
					ComputedValue: "#CIRCULAR!",
					Style: style,
				});
			}
		}

		// Recalculate each affected cell in strict topological order
		for (const depKey of recalcResult.Order) {
			const coords = this.Resolver.CellKeyToCoords(depKey);
			if (!coords) continue;

			const cell = model.GetCell
				? model.GetCell(coords.RowKey, coords.ColKey)
				: null;
			if (!cell) continue;

			const rawFormula = cell.Value ?? cell.value;
			if (!this.IsFormula(rawFormula)) continue;

			let cached = this.FormulaCache.get(depKey);
			let astNode = cached?.AST;
			if (!astNode) {
				astNode = this.Parser ? this.Parser.Parse(rawFormula) : null;
				if (astNode && !(astNode instanceof CalcErrorNode)) {
					this.FormulaCache.set(depKey, {
						AST: astNode,
						RawFormula: rawFormula,
					});
				}
			}

			let newComputedValue;
			if (!astNode || astNode instanceof CalcErrorNode) {
				newComputedValue = astNode?.ErrorMessage || "#ERROR!";
			} else {
				try {
					newComputedValue = this.Evaluator.Evaluate(astNode, model);
				} catch (e) {
					newComputedValue = "#ERROR!";
				}
			}

			const style = cell.Style ?? cell.style ?? {};
			this.#CommitCellToStore(
				model,
				coords.RowKey,
				coords.ColKey,
				rawFormula,
				style,
				newComputedValue,
			);
			changedMap.set(depKey, {
				RowKey: coords.RowKey,
				ColKey: coords.ColKey,
				Value: rawFormula,
				ComputedValue: newComputedValue,
				Style: style,
			});
		}

		return Array.from(changedMap.values());
	}

	/**
	 * Clears a batch of cells, updates storage, removes dependencies, and runs a single
	 * downstream recalculation pass across all affected dependents.
	 * @param {SpreadsheetModel|object} model - The active spreadsheet model.
	 * @param {Array<{ RowKey: number, ColKey: number|string, OldStyle?: object, Style?: object }>} entries
	 * @returns {Array<{ RowKey: number, ColKey: number, Value: *, ComputedValue: *, Style: object }>}
	 */
	ClearCells(model, entries) {
		if (!model || !entries || entries.length === 0) return [];
		const clearedKeys = [];
		const changedMap = new Map();

		for (const entry of entries) {
			const rowKey = entry.RowKey !== undefined ? entry.RowKey : entry.rowKey;
			const colKey = entry.ColKey !== undefined ? entry.ColKey : entry.colKey;
			const numColKey =
				typeof colKey === "number"
					? colKey
					: this.Resolver.ToColumnIndex(String(colKey));
			const cellKey = this.Resolver.CoordsToCellKey(rowKey, numColKey);
			clearedKeys.push(cellKey);

			this.Graph?.RemoveDependencies(cellKey);
			this.FormulaCache.delete(cellKey);
			this.CircularFormulas.delete(cellKey);

			const style =
				entry.OldStyle || entry.oldStyle || entry.Style || entry.style || {};
			this.#CommitCellToStore(model, rowKey, numColKey, "", style, "");
			changedMap.set(cellKey, {
				RowKey: rowKey,
				ColKey: numColKey,
				Value: "",
				ComputedValue: "",
				Style: style,
			});
		}

		const recovered = this.#RecoverCircularFormulas(model);
		const depChanges = this.RecalculateDependents(
			model,
			clearedKeys,
			recovered,
		);
		for (const c of depChanges) {
			const k = this.Resolver.CoordsToCellKey(c.RowKey, c.ColKey);
			changedMap.set(k, c);
		}

		return Array.from(changedMap.values());
	}

	/**
	 * Restores a batch of cells, commits values to store, reconstructs formula dependencies,
	 * and executes a SINGLE downstream recalculation pass across all restored and dependent cells.
	 * @param {SpreadsheetModel|object} model - The active spreadsheet model.
	 * @param {Array<{ RowKey: number, ColKey: number|string, OldValue?: *, Value?: *, OldStyle?: object, Style?: object }>} entries
	 * @returns {Array<{ RowKey: number, ColKey: number, Value: *, ComputedValue: *, Style: object }>}
	 */
	RestoreCells(model, entries) {
		if (!model || !entries || entries.length === 0) return [];
		const changedMap = new Map();
		const changedLiteralKeys = [];
		const restoredFormulaKeys = [];

		// Phase 1: Write all cell values and styles into storage and register dependencies
		for (const entry of entries) {
			const rowKey = entry.RowKey !== undefined ? entry.RowKey : entry.rowKey;
			const colKey = entry.ColKey !== undefined ? entry.ColKey : entry.colKey;
			const numColKey =
				typeof colKey === "number"
					? colKey
					: this.Resolver.ToColumnIndex(String(colKey));
			const cellKey = this.Resolver.CoordsToCellKey(rowKey, numColKey);
			const rawVal =
				entry.OldValue !== undefined
					? entry.OldValue
					: entry.Value !== undefined
						? entry.Value
						: "";
			const style =
				entry.OldStyle || entry.oldStyle || entry.Style || entry.style || {};

			if (!this.IsFormula(rawVal)) {
				this.Graph?.RemoveDependencies(cellKey);
				this.FormulaCache.delete(cellKey);
				this.CircularFormulas.delete(cellKey);

				this.#CommitCellToStore(
					model,
					rowKey,
					numColKey,
					rawVal,
					style,
					rawVal,
				);
				changedLiteralKeys.push(cellKey);
				changedMap.set(cellKey, {
					RowKey: rowKey,
					ColKey: numColKey,
					Value: rawVal,
					ComputedValue: rawVal,
					Style: style,
				});
			} else {
				const rawFormula = String(rawVal).trim();
				let astNode;
				try {
					astNode = this.Parser ? this.Parser.Parse(rawFormula) : null;
				} catch (err) {
					astNode = new CalcErrorNode("#ERROR!");
				}

				if (!astNode || astNode instanceof CalcErrorNode) {
					this.Graph?.RemoveDependencies(cellKey);
					this.FormulaCache.delete(cellKey);
					this.CircularFormulas.delete(cellKey);

					const errVal = astNode?.ErrorMessage || "#ERROR!";
					this.#CommitCellToStore(
						model,
						rowKey,
						numColKey,
						rawFormula,
						style,
						errVal,
					);
					changedLiteralKeys.push(cellKey);
					changedMap.set(cellKey, {
						RowKey: rowKey,
						ColKey: numColKey,
						Value: rawFormula,
						ComputedValue: errVal,
						Style: style,
					});
				} else {
					const { Cells, Ranges } = this.Analyzer
						? this.Analyzer.Analyze(astNode)
						: { Cells: new Set(), Ranges: [] };

					if (
						this.Graph &&
						this.Graph.WouldCreateCycle(cellKey, Cells, Ranges)
					) {
						this.Graph.RemoveDependencies(cellKey);
						this.FormulaCache.delete(cellKey);
						this.CircularFormulas.set(cellKey, {
							AST: astNode,
							RawFormula: rawFormula,
							Cells,
							Ranges,
							RowKey: rowKey,
							ColKey: numColKey,
							Style: style,
						});

						this.#CommitCellToStore(
							model,
							rowKey,
							numColKey,
							rawFormula,
							style,
							"#CIRCULAR!",
						);
						changedLiteralKeys.push(cellKey);
						changedMap.set(cellKey, {
							RowKey: rowKey,
							ColKey: numColKey,
							Value: rawFormula,
							ComputedValue: "#CIRCULAR!",
							Style: style,
						});
					} else {
						if (this.Graph) {
							this.Graph.SetDependencies(cellKey, Cells, Ranges);
						}
						this.FormulaCache.set(cellKey, {
							AST: astNode,
							RawFormula: rawFormula,
						});
						this.CircularFormulas.delete(cellKey);

						// Commit the raw formula to storage (will be evaluated in Phase 2)
						this.#CommitCellToStore(
							model,
							rowKey,
							numColKey,
							rawFormula,
							style,
							undefined,
						);
						restoredFormulaKeys.push(cellKey);
					}
				}
			}
		}

		// Check for circular formula recovery
		const recovered = this.#RecoverCircularFormulas(model);
		const formulaKeysToCalculate = [...restoredFormulaKeys, ...recovered];

		// Phase 2: Single recalculation pass for all restored cells and downstream dependents!
		const depChanges = this.RecalculateDependents(
			model,
			changedLiteralKeys,
			formulaKeysToCalculate,
		);
		for (const c of depChanges) {
			const k = this.Resolver.CoordsToCellKey(c.RowKey, c.ColKey);
			changedMap.set(k, c);
		}

		return Array.from(changedMap.values());
	}

	/**
	 * Scans the entire spreadsheet, discovers all formula cells, constructs the DAG,
	 * and re-evaluates all formulas in topological order.
	 * @param {SpreadsheetModel|object} model - The active spreadsheet model.
	 * @returns {Array<{ RowKey: number, ColKey: number, Value: *, ComputedValue: *, Style: object }>}
	 */
	RecalculateAll(model) {
		if (!model) return [];

		this.Clear();

		const spreadsheet = model.CurrentSpreadsheet || model;
		if (!spreadsheet || typeof spreadsheet.TraverseAll !== "function") {
			return [];
		}

		const data = spreadsheet.TraverseAll();
		if (!Array.isArray(data) || data.length === 0) {
			return [];
		}

		const changedMap = new Map();

		// 1. First pass: Register all formula cells in the DAG and cache their ASTs
		for (const col of data) {
			const colKey = col.colKey !== undefined ? col.colKey : col.ColKey;
			const numColKey =
				typeof colKey === "number"
					? colKey
					: this.Resolver.ToColumnIndex(String(colKey));

			for (const row of col.rows || []) {
				const rowKey = row.key !== undefined ? row.key : row.Key;
				const raw = row.value !== undefined ? row.value : row.Value;

				if (this.IsFormula(raw)) {
					const cellKey = this.Resolver.CoordsToCellKey(rowKey, numColKey);
					const rawFormula = String(raw).trim();
					const astNode = this.Parser ? this.Parser.Parse(rawFormula) : null;

					if (!astNode || astNode instanceof CalcErrorNode) {
						const errVal = astNode?.ErrorMessage || "#ERROR!";
						this.#CommitCellToStore(
							model,
							rowKey,
							numColKey,
							rawFormula,
							row.style || {},
							errVal,
						);
						changedMap.set(cellKey, {
							RowKey: rowKey,
							ColKey: numColKey,
							Value: rawFormula,
							ComputedValue: errVal,
							Style: row.style || {},
						});
					} else {
						const { Cells, Ranges } = this.Analyzer
							? this.Analyzer.Analyze(astNode)
							: { Cells: new Set(), Ranges: [] };

						if (
							this.Graph &&
							this.Graph.WouldCreateCycle(cellKey, Cells, Ranges)
						) {
							this.#CommitCellToStore(
								model,
								rowKey,
								numColKey,
								rawFormula,
								row.style || {},
								"#CIRCULAR!",
							);
							changedMap.set(cellKey, {
								RowKey: rowKey,
								ColKey: numColKey,
								Value: rawFormula,
								ComputedValue: "#CIRCULAR!",
								Style: row.style || {},
							});
						} else {
							if (this.Graph) {
								this.Graph.SetDependencies(cellKey, Cells, Ranges);
							}
							this.FormulaCache.set(cellKey, {
								AST: astNode,
								RawFormula: rawFormula,
							});
						}
					}
				}
			}
		}

		// 2. Second pass: Compute topological order across all formula cells
		const recalcResult = this.Graph
			? this.Graph.GetFullRecalculationOrder()
			: { Order: Array.from(this.FormulaCache.keys()), HasCycle: false };

		// Handle any detected circular cells
		if (recalcResult.HasCycle && recalcResult.CircularCells) {
			for (const circKey of recalcResult.CircularCells) {
				const coords = this.Resolver.CellKeyToCoords(circKey);
				if (!coords) continue;
				const cell = model.GetCell
					? model.GetCell(coords.RowKey, coords.ColKey)
					: null;
				const raw = cell ? (cell.Value ?? cell.value ?? "") : "";
				const style = cell ? (cell.Style ?? cell.style ?? {}) : {};
				this.#CommitCellToStore(
					model,
					coords.RowKey,
					coords.ColKey,
					raw,
					style,
					"#CIRCULAR!",
				);
				changedMap.set(circKey, {
					RowKey: coords.RowKey,
					ColKey: coords.ColKey,
					Value: raw,
					ComputedValue: "#CIRCULAR!",
					Style: style,
				});
			}
		}

		// Evaluate in topological order
		for (const cellKey of recalcResult.Order) {
			const cached = this.FormulaCache.get(cellKey);
			if (!cached) continue;

			const coords = this.Resolver.CellKeyToCoords(cellKey);
			if (!coords) continue;

			const cell = model.GetCell
				? model.GetCell(coords.RowKey, coords.ColKey)
				: null;
			const style = cell ? (cell.Style ?? cell.style ?? {}) : {};

			let computedValue;
			try {
				computedValue = this.Evaluator
					? this.Evaluator.Evaluate(cached.AST, model)
					: "#ERROR!";
			} catch (e) {
				computedValue = "#ERROR!";
			}

			this.#CommitCellToStore(
				model,
				coords.RowKey,
				coords.ColKey,
				cached.RawFormula,
				style,
				computedValue,
			);
			changedMap.set(cellKey, {
				RowKey: coords.RowKey,
				ColKey: coords.ColKey,
				Value: cached.RawFormula,
				ComputedValue: computedValue,
				Style: style,
			});
		}

		return Array.from(changedMap.values());
	}

	/**
	 * Clears the dependency graph, AST cache, and circular formula tracking.
	 */
	Clear() {
		this.Graph?.Clear();
		this.FormulaCache.clear();
		this.CircularFormulas.clear();
	}

	/**
	 * Checks if any currently circular formulas can now be safely re-introduced
	 * into the dependency graph without creating cycles.
	 * @private
	 * @param {SpreadsheetModel|object} model
	 * @returns {string[]} Recovered cell keys
	 */
	#RecoverCircularFormulas(model) {
		if (this.CircularFormulas.size === 0 || !this.Graph) {
			return [];
		}

		const recoveredKeys = [];
		let progress = true;
		while (progress) {
			progress = false;
			for (const [circKey, circData] of Array.from(
				this.CircularFormulas.entries(),
			)) {
				if (
					!this.Graph.WouldCreateCycle(circKey, circData.Cells, circData.Ranges)
				) {
					this.CircularFormulas.delete(circKey);
					this.Graph.SetDependencies(circKey, circData.Cells, circData.Ranges);
					this.FormulaCache.set(circKey, {
						AST: circData.AST,
						RawFormula: circData.RawFormula,
					});
					recoveredKeys.push(circKey);
					progress = true;
				}
			}
		}

		return recoveredKeys;
	}

	/**
	 * Commits cell value, style, and computedValue directly to underlying storage
	 * without re-triggering calculation cycle.
	 * @private
	 */
	#CommitCellToStore(model, rowKey, colKey, value, style, computedValue) {
		if (!model) return;

		const targetStore = model.CurrentSpreadsheet || model;
		if (typeof targetStore.InsertData === "function") {
			targetStore.InsertData(rowKey, colKey, value, style, computedValue);
		} else if (typeof targetStore.SetCell === "function") {
			targetStore.SetCell(rowKey, colKey, value, style, computedValue);
		}
	}
}

// Universal module export (Browser global & Node.js CommonJS)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		CalculationEngine,
	};
}
