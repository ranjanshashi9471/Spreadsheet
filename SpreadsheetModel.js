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
		this.GridRenderer = null;
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

	get gridRenderer() {
		return this.GridRenderer;
	}

	set gridRenderer(val) {
		this.GridRenderer = val;
	}

	GetCurrentSpreadsheet() {
		return this.CurrentSpreadsheet;
	}

	SetCurrentSpreadsheet(spreadsheet) {
		if (spreadsheet !== null && !(spreadsheet instanceof ModelSpreadsheet)) {
			throw new TypeError("Expected a Spreadsheet instance or null.");
		}

		this.CurrentSpreadsheet = spreadsheet;

		if (this.CurrentSpreadsheet && this.CalculationEngine) {
			this.CalculationEngine.RecalculateAll(this);
		}
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

		if (computedValue !== undefined || !this.CalculationEngine) {
			this.CurrentSpreadsheet.InsertData(
				rowKey,
				colKey,
				value,
				style,
				computedValue !== undefined ? computedValue : value,
			);
			return;
		}

		this.CalculationEngine.ProcessCellUpdate(
			this,
			rowKey,
			colKey,
			value,
			style,
		);
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
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		SpreadsheetModel,
	};
}
