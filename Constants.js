const SelectionType = Object.freeze({
	Cell: "cell",
	Row: "row",
	Column: "column",
	Range: "range",
});

const InputType = Object.freeze({
	Text: "text",
	File: "file",
	Number: "number",
});

const ButtonsLabels = Object.freeze({
	OK: "OK",
	Cancel: "Cancel",
	Yes: "Yes",
	No: "No",
	InsertEmptyRow: "Insert Empty Row",
	InsertEmptyColumn: "Insert Empty Column",
	DeleteRow: "Delete Row",
	DeleteColumn: "Delete Column",
	SaveSyncSheet: "Save / Sync Sheet",
	LoadSheet: "Load Sheet",
	SyncChanges: "Sync Changes",
	ExportJSON: "Export JSON",
	LoadJSON: "Load JSON",
	ExportDump: "Export Dump",
});

const placeholders = Object.freeze({
	RowCount: "Enter Row Count",
});

const DATABASEDUMPTYPE = Object.freeze({
	ARBOR_DUMP: 0,
	RAW_SQL_DUMP: 1,
});

/**
 * Standard spreadsheet formula error tokens.
 */
const FormulaErrors = Object.freeze({
	Error: "#ERROR!",
	Value: "#VALUE!",
	Ref: "#REF!",
	Name: "#NAME?",
	DivZero: "#DIV/0!",
	Circular: "#CIRCULAR!",
	Num: "#NUM!",
	NA: "#N/A",
});

/**
 * Built-in syntactic special forms that require custom/lazy control flow
 * and are evaluated directly by FormulaEvaluator rather than FunctionRegistry.
 */
const FormulaSpecialForms = Object.freeze(new Set(["IF", "IFERROR"]));

/**
 * Returns true if a given value is a spreadsheet formula error token.
 * @param {*} value
 * @returns {boolean}
 */
function IsFormulaError(value) {
	return typeof value === "string" && value.startsWith("#");
}

if (typeof window !== "undefined") {
	window.FormulaErrors = FormulaErrors;
	window.FormulaSpecialForms = FormulaSpecialForms;
	window.IsFormulaError = IsFormulaError;
}

// Universal module export (Browser global & Node.js CommonJS)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		SelectionType,
		InputType,
		ButtonsLabels,
		placeholders,
		DATABASEDUMPTYPE,
		FormulaErrors,
		FormulaSpecialForms,
		IsFormulaError,
	};
}
