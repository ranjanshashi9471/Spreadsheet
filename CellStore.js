// CellStore.js

/**
 * Abstract base contract for spreadsheet cell storage.
 * Defines the standard interface for cell retrieval, mutations, and traversals.
 */
class CellStore {
	/**
	 * Stores or updates a cell value and optional style at (rowKey, colKey).
	 * @param {number|string} rowKey
	 * @param {number|string} colKey
	 * @param {*} value
	 * @param {object} [style={}]
	 */
	SetCell(rowKey, colKey, value, style = {}) {
		throw new Error("CellStore.SetCell() must be implemented by subclass.");
	}

	/**
	 * Retrieves cell data at (rowKey, colKey).
	 * @param {number|string} rowKey
	 * @param {number|string} colKey
	 * @returns {{ value: *, style: object } | null}
	 */
	GetCell(rowKey, colKey) {
		throw new Error("CellStore.GetCell() must be implemented by subclass.");
	}

	/**
	 * Checks if a cell exists at (rowKey, colKey).
	 * @param {number|string} rowKey
	 * @param {number|string} colKey
	 * @returns {boolean}
	 */
	HasCell(rowKey, colKey) {
		return this.GetCell(rowKey, colKey) !== null;
	}

	/**
	 * Clears all stored cells.
	 */
	Clear() {
		throw new Error("CellStore.Clear() must be implemented by subclass.");
	}

	/**
	 * Checks if the store has no cells.
	 * @returns {boolean}
	 */
	IsEmpty() {
		throw new Error("CellStore.IsEmpty() must be implemented by subclass.");
	}

	/**
	 * Traverses all columns and their respective rows.
	 * @returns {Array<{ colKey: *, colName: *, rows: Array<{ key: *, value: *, style: * }> }>}
	 */
	TraverseAll() {
		throw new Error("CellStore.TraverseAll() must be implemented by subclass.");
	}

	/**
	 * Traverses all rows within a specific column.
	 * @param {number|string} colKey
	 * @returns {Array<{ key: *, value: *, style: * }>}
	 */
	TraverseRowsInColumn(colKey) {
		throw new Error(
			"CellStore.TraverseRowsInColumn() must be implemented by subclass.",
		);
	}

	/**
	 * Returns a set of all unique row keys that contain cell data.
	 * @returns {Set<number>}
	 */
	GetAllModifiedRowKeys() {
		throw new Error(
			"CellStore.GetAllModifiedRowKeys() must be implemented by subclass.",
		);
	}

	/**
	 * Converts cell data to a flat array suitable for database bulk operations.
	 * @param {number} [sheetId=null]
	 * @returns {Array<{ sheet_id?: number, col_id: number, row_id: number, cell_value: *, cell_style: string }>}
	 */
	ToDataArray(sheetId = null) {
		throw new Error("CellStore.ToDataArray() must be implemented by subclass.");
	}
}

/**
 * Concrete implementation of CellStore backed by an AVL tree of AVL trees.
 * Column nodes form the primary balanced BST, and row nodes within each column
 * form secondary balanced BSTs.
 */
class AVLCellStore extends CellStore {
	constructor() {
		super();
		this.ColumnTree = new AVLTree();
	}

	get columnTree() {
		return this.ColumnTree;
	}

	/**
	 * Provides raw access to the underlying AVL column tree for backwards compatibility.
	 */
	GetRawTree() {
		return this.ColumnTree;
	}

	SetCell(rowKey, colKey, value, style = {}) {
		let colNode = this.ColumnTree.Find(colKey);
		if (!colNode) {
			this.ColumnTree.root = this.ColumnTree._Insert(
				this.ColumnTree.root,
				colKey,
				undefined,
				undefined,
				(key) => new ColumnNode(key),
			);
			colNode = this.ColumnTree.Find(colKey);
		}

		if (!colNode.rows) {
			colNode.rows = new AVLTree();
		}

		colNode.rows.root = colNode.rows._Insert(
			colNode.rows.root,
			rowKey,
			value,
			style,
			(key, val, stl) => new RowNode(key, val, stl),
		);
	}

	GetCell(rowKey, colKey) {
		const colNode = this.ColumnTree.Find(colKey);
		if (!colNode || !colNode.rows) {
			return null;
		}
		const rowNode = colNode.rows.Find(rowKey);
		return rowNode ? { value: rowNode.value, style: rowNode.style } : null;
	}

	HasCell(rowKey, colKey) {
		return this.GetCell(rowKey, colKey) !== null;
	}

	Clear() {
		this.ColumnTree.root = null;
	}

	IsEmpty() {
		return this.ColumnTree.root === null;
	}

	TraverseAll() {
		const allColumns = this.ColumnTree._TraverseInOrder(this.ColumnTree.root);
		const spreadsheetData = [];

		for (const colNode of allColumns) {
			const rowsInColumn = colNode.rows
				? colNode.rows._TraverseInOrder(colNode.rows.root)
				: [];
			const formattedRows = rowsInColumn.map((row) => ({
				key: row.key,
				value: row.value,
				style: row.style,
			}));
			spreadsheetData.push({
				colKey: colNode.key,
				colName: colNode.name,
				rows: formattedRows,
			});
		}
		return spreadsheetData;
	}

	TraverseRowsInColumn(colKey) {
		const colNode = this.ColumnTree.Find(colKey);
		if (!colNode || !colNode.rows) {
			return [];
		}
		const rowsInColumn = colNode.rows._TraverseInOrder(colNode.rows.root);
		return rowsInColumn.map((row) => ({
			key: row.key,
			value: row.value,
			style: row.style,
		}));
	}

	GetAllModifiedRowKeys() {
		const allRowKeys = new Set();
		const allColumns = this.ColumnTree._TraverseInOrder(this.ColumnTree.root);

		for (const colNode of allColumns) {
			if (colNode.rows && colNode.rows.root) {
				const rowsInColumn = colNode.rows._TraverseInOrder(colNode.rows.root);
				for (const rowNode of rowsInColumn) {
					allRowKeys.add(rowNode.key);
				}
			}
		}
		return allRowKeys;
	}

	ToDataArray(sheetId = null) {
		const dataRows = [];
		const inMemoryColumns = this.ColumnTree._TraverseInOrder(
			this.ColumnTree.root,
		);

		for (let colNode of inMemoryColumns) {
			const colId = colNode.key;
			if (colNode.rows && colNode.rows.root) {
				const inMemoryRows = colNode.rows._TraverseInOrder(colNode.rows.root);
				for (let rowNode of inMemoryRows) {
					const entry = {
						col_id: colId,
						row_id: rowNode.key,
						cell_value: rowNode.value,
						cell_style: JSON.stringify(rowNode.style || {}),
					};
					if (sheetId !== null) {
						entry.sheet_id = sheetId;
					}
					dataRows.push(entry);
				}
			}
		}
		return dataRows;
	}
}
