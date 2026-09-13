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
