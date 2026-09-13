class SpreadsheetModel {
	constructor() {
		this.CurrentSpreadsheet = null;
		this.CommandManager =
			typeof CommandManager !== "undefined" ? new CommandManager() : null;
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

	GetCurrentSpreadsheet() {
		return this.CurrentSpreadsheet;
	}

	SetCurrentSpreadsheet(spreadsheet) {
		if (spreadsheet !== null && !(spreadsheet instanceof Spreadsheet)) {
			throw new TypeError("Expected a Spreadsheet instance or null.");
		}

		this.CurrentSpreadsheet = spreadsheet;
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

		const spreadsheet = new Spreadsheet(sheetName);

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

	SetCell(rowKey, colKey, value, style = {}) {
		if (!this.CurrentSpreadsheet) {
			throw new Error("No active spreadsheet in model.");
		}
		this.CurrentSpreadsheet.InsertData(rowKey, colKey, value, style);
	}

	Clear() {
		if (this.CommandManager) {
			this.CommandManager.Clear();
		}

		if (!this.CurrentSpreadsheet) {
			return;
		}

		this.CurrentSpreadsheet.Clear();
		this.CurrentSpreadsheet = null;
	}

	ExecuteCommand(command) {
		if (!this.CommandManager) {
			this.CommandManager = new CommandManager();
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
