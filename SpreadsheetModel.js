// SpreadsheetModel.js

/**
 * Universal imports for Node.js CommonJS and Browser environments.
 */
const ModelSpreadsheet =
	typeof Spreadsheet !== "undefined"
		? Spreadsheet
		: typeof globalThis !== "undefined" && globalThis.Spreadsheet
			? globalThis.Spreadsheet
			: typeof require !== "undefined"
				? require("./Datastructure.js").Spreadsheet
				: null;

const ModelCommandManager =
	typeof CommandManager !== "undefined"
		? CommandManager
		: typeof globalThis !== "undefined" && globalThis.CommandManager
			? globalThis.CommandManager
			: typeof require !== "undefined"
				? require("./CommandManager.js").CommandManager
				: null;

const ModelCalculationEngine =
	typeof CalculationEngine !== "undefined"
		? CalculationEngine
		: typeof globalThis !== "undefined" && globalThis.CalculationEngine
			? globalThis.CalculationEngine
			: typeof require !== "undefined"
				? require("./CalculationEngine.js").CalculationEngine
				: null;

/**
 * Standard event vocabulary emitted by SpreadsheetModel.
 */
const SpreadsheetEvents = Object.freeze({
	CellsChanged: "cellsChanged",
	SheetReset: "sheetReset",
});

class SpreadsheetModel {
	constructor(calculationEngine = null, commandManager = null) {
		this.CurrentSpreadsheet = null;
		this.CommandManager =
			commandManager ||
			(typeof ModelCommandManager === "function"
				? new ModelCommandManager()
				: null);
		this.CalculationEngine =
			calculationEngine ||
			(typeof ModelCalculationEngine === "function"
				? new ModelCalculationEngine()
				: null);
		this.Listeners = new Set();
		this._BatchDepth = 0;
		this._PendingChanges = new Map();
	}

	get currentSpreadsheet() {
		return this.CurrentSpreadsheet;
	}

	set currentSpreadsheet(val) {
		this.SetCurrentSpreadsheet(val);
	}

	get commandManager() {
		return this.CommandManager;
	}

	get calculationEngine() {
		return this.CalculationEngine;
	}

	set calculationEngine(val) {
		this.CalculationEngine = val;
	}

	get listeners() {
		return this.Listeners;
	}

	get batchDepth() {
		return this._BatchDepth;
	}

	/**
	 * Subscribes a listener callback to model events.
	 * @param {Function} listener
	 * @returns {Function} Unsubscribe function
	 */
	AddListener(listener) {
		if (typeof listener === "function") {
			this.Listeners.add(listener);
		}
		return () => this.RemoveListener(listener);
	}

	/**
	 * Unsubscribes a listener callback.
	 * @param {Function} listener
	 */
	RemoveListener(listener) {
		this.Listeners.delete(listener);
	}

	/**
	 * Notifies all subscribed listeners with an event object.
	 * @param {{ type: string, [key: string]: any }} event
	 */
	NotifyListeners(event) {
		for (const listener of this.Listeners) {
			try {
				listener(event);
			} catch (err) {
				console.error("Error in SpreadsheetModel listener:", err);
			}
		}
	}

	/**
	 * Begins a batch mutation context, delaying event emission until outermost EndBatch().
	 */
	BeginBatch() {
		this._BatchDepth++;
	}

	/**
	 * Ends a batch mutation context. Flushes all accumulated pending changes if depth reaches 0.
	 */
	EndBatch() {
		if (this._BatchDepth > 0) {
			this._BatchDepth--;
		}
		if (this._BatchDepth === 0 && this._PendingChanges.size > 0) {
			const cells = Array.from(this._PendingChanges.values());
			this._PendingChanges.clear();
			this.NotifyListeners({
				type: SpreadsheetEvents.CellsChanged,
				cells,
			});
		}
	}

	/**
	 * Executes a synchronous callback within a batch transaction.
	 * Guarantees a single CellsChanged event notification at completion.
	 * @param {Function} fn
	 * @returns {*}
	 */
	BatchUpdate(fn) {
		this.BeginBatch();
		try {
			return fn();
		} finally {
			this.EndBatch();
		}
	}

	/**
	 * Internal helper to record mutation deltas into pending changes or emit immediately.
	 * Deduplicates changes per cell key so the latest mutation snapshot wins.
	 * @private
	 * @param {Array<{ RowKey: number, ColKey: number, Value: *, ComputedValue: *, Style: object }>} deltaArray
	 */
	#RecordChanges(deltaArray) {
		if (!deltaArray || deltaArray.length === 0) return;

		const resolver = this.CalculationEngine?.Resolver;
		for (const cell of deltaArray) {
			const key = resolver
				? resolver.CoordsToCellKey(cell.RowKey, cell.ColKey)
				: `${cell.RowKey}:${cell.ColKey}`;
			this._PendingChanges.set(key, cell);
		}

		if (this._BatchDepth === 0) {
			const cells = Array.from(this._PendingChanges.values());
			this._PendingChanges.clear();
			this.NotifyListeners({
				type: SpreadsheetEvents.CellsChanged,
				cells,
			});
		}
	}

	GetCurrentSpreadsheet() {
		return this.CurrentSpreadsheet;
	}

	/**
	 * Assigns the active spreadsheet. Emits a SheetReset event without auto-recalculating.
	 * @param {Spreadsheet|null} spreadsheet
	 */
	SetCurrentSpreadsheet(spreadsheet) {
		if (spreadsheet !== null && !(spreadsheet instanceof ModelSpreadsheet)) {
			throw new TypeError("Expected a Spreadsheet instance or null.");
		}

		this.CurrentSpreadsheet = spreadsheet;

		this.NotifyListeners({
			type: SpreadsheetEvents.SheetReset,
			sheet: spreadsheet,
		});
	}

	/**
	 * Explicitly scans the current spreadsheet and recalculates all formula cells.
	 * Emits a single CellsChanged event containing all computed cells.
	 * @returns {Array<{ RowKey: number, ColKey: number, Value: *, ComputedValue: *, Style: object }>}
	 */
	RecalculateAll() {
		if (!this.CurrentSpreadsheet || !this.CalculationEngine) {
			return [];
		}

		const deltas = this.CalculationEngine.RecalculateAll(this);
		this.#RecordChanges(deltas);
		return deltas;
	}

	CreateBlank(sheetName, rows, columns) {
		if (!sheetName || typeof sheetName !== "string") {
			throw new TypeError("Sheet name must be a non-empty string.");
		}

		if (!Number.isInteger(rows) || rows <= 0) {
			throw new RangeError("Rows must be a positive integer.");
		}

		if (!Number.isInteger(columns) || columns <= 0) {
			throw new RangeError("Columns must be a positive integer.");
		}

		const spreadsheet = new ModelSpreadsheet(sheetName);

		spreadsheet.maxRows = rows;
		spreadsheet.isInMemory = true;

		for (let i = 1; i <= columns; i++) {
			spreadsheet.columns.push(`C${i}`);
		}

		this.CurrentSpreadsheet = spreadsheet;

		this.NotifyListeners({
			type: SpreadsheetEvents.SheetReset,
			sheet: spreadsheet,
		});

		return spreadsheet;
	}

	GetCell(rowKey, colKey) {
		return this.CurrentSpreadsheet
			? this.CurrentSpreadsheet.RetrieveCellData(rowKey, colKey)
			: null;
	}

	GetCellValue(rowKey, colKey) {
		const cell = this.GetCell(rowKey, colKey);
		if (!cell) return 0;
		return cell.ComputedValue !== undefined && cell.ComputedValue !== null
			? cell.ComputedValue
			: (cell.Value ?? cell.value ?? 0);
	}

	SetCell(rowKey, colKey, value, style = {}, computedValue = undefined) {
		if (!this.CurrentSpreadsheet) {
			throw new Error("No active spreadsheet in model.");
		}

		let deltas;
		if (computedValue !== undefined || !this.CalculationEngine) {
			const comp = computedValue !== undefined ? computedValue : value;
			this.CurrentSpreadsheet.InsertData(rowKey, colKey, value, style, comp);
			const numColKey =
				typeof colKey === "number"
					? colKey
					: (this.CalculationEngine?.Resolver?.ToColumnIndex(String(colKey)) ??
						colKey);
			deltas = [
				{
					RowKey: rowKey,
					ColKey: numColKey,
					Value: value,
					ComputedValue: comp,
					Style: style,
				},
			];
		} else {
			deltas = this.CalculationEngine.ProcessCellUpdate(
				this,
				rowKey,
				colKey,
				value,
				style,
			);
		}

		this.#RecordChanges(deltas);
	}

	/**
	 * Clears a batch of cells with a single downstream recalculation pass.
	 * Emits a single CellsChanged event containing all cleared and affected dependent cells.
	 * @param {Array<{ RowKey: number, ColKey: number|string, OldStyle?: object, Style?: object }>} entries
	 */
	ClearCells(entries) {
		if (!this.CurrentSpreadsheet || !entries || entries.length === 0) {
			return;
		}

		let deltas;
		if (
			this.CalculationEngine &&
			typeof this.CalculationEngine.ClearCells === "function"
		) {
			deltas = this.CalculationEngine.ClearCells(this, entries);
		} else {
			deltas = [];
			for (const entry of entries) {
				const rowKey = entry.RowKey !== undefined ? entry.RowKey : entry.rowKey;
				const colKey = entry.ColKey !== undefined ? entry.ColKey : entry.colKey;
				const numColKey =
					typeof colKey === "number"
						? colKey
						: (this.CalculationEngine?.Resolver?.ToColumnIndex(
								String(colKey),
							) ?? colKey);
				const style =
					entry.OldStyle || entry.oldStyle || entry.Style || entry.style || {};
				this.CurrentSpreadsheet.InsertData(rowKey, numColKey, "", style, "");
				deltas.push({
					RowKey: rowKey,
					ColKey: numColKey,
					Value: "",
					ComputedValue: "",
					Style: style,
				});
			}
		}

		this.#RecordChanges(deltas);
	}

	Clear() {
		if (this.CommandManager) {
			this.CommandManager.Clear();
		}

		if (this.CalculationEngine) {
			this.CalculationEngine.Clear();
		}

		if (!this.CurrentSpreadsheet) {
			return;
		}

		this.CurrentSpreadsheet.Clear();
		this.CurrentSpreadsheet = null;

		this.NotifyListeners({
			type: SpreadsheetEvents.SheetReset,
			sheet: null,
		});
	}

	ExecuteCommand(command) {
		if (!this.CommandManager) {
			this.CommandManager = new ModelCommandManager();
		}
		return this.CommandManager.ExecuteCommand(command);
	}

	Undo() {
		return this.CommandManager ? this.CommandManager.Undo() : null;
	}

	Redo() {
		return this.CommandManager ? this.CommandManager.Redo() : null;
	}
}

// Universal module export (Browser global & Node.js CommonJS)
if (typeof window !== "undefined") {
	window.SpreadsheetModel = SpreadsheetModel;
	window.SpreadsheetEvents = SpreadsheetEvents;
}

if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		SpreadsheetModel,
		SpreadsheetEvents,
	};
}
