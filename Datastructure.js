// Spreadsheet.js

/**
 * Represents a node in the secondary AVL tree (for rows within a column).
 * Stores the row key and its corresponding cell value.
 */
class RowNode {
	constructor(rowKey, cellValue, style) {
		this.key = rowKey;
		this.value = cellValue;
		this.style = style;
		this.left = null;
		this.right = null;
		this.height = 1;
	}
}

/**
 * Represents a node in the primary AVL tree (for columns).
 * Each column node itself contains another AVL tree (of RowNodes) for its rows.
 */
class ColumnNode {
	constructor(colKey) {
		this.key = colKey;
		this.rows = null; // Root of the secondary AVL Tree for rows in this column
		this.left = null;
		this.right = null;
		this.height = 1;
	}
}

/**
 * Implements an AVL (Adelson-Velsky and Landis) tree.
 * This class provides methods for insertion, searching, and balancing operations
 * for self-balancing binary search trees.
 */
class AVLTree {
	constructor() {
		this.root = null;
	}

	GetHeight(node) {
		return node ? node.height : 0;
	}

	GetBalance(node) {
		return node ? this.GetHeight(node.left) - this.GetHeight(node.right) : 0;
	}

	RotateRight(y) {
		const x = y.left;
		const T2 = x.right;

		x.right = y;
		y.left = T2;

		y.height = Math.max(this.GetHeight(y.left), this.GetHeight(y.right)) + 1;
		x.height = Math.max(this.GetHeight(x.left), this.GetHeight(x.right)) + 1;

		return x;
	}

	RotateLeft(x) {
		const y = x.right;
		const T2 = y.left;

		y.left = x;
		x.right = T2;

		x.height = Math.max(this.GetHeight(x.left), this.GetHeight(x.right)) + 1;
		y.height = Math.max(this.GetHeight(y.left), this.GetHeight(y.right)) + 1;

		return y;
	}

	/**
	 * Inserts a new node into the AVL tree.
	 * This method is generic and can be used for both ColumnNodes and RowNodes.
	 * @param {object} node - The current node in the recursive insertion process.
	 * @param {*} key - The key of the new node.
	 * @param {*} [value=undefined] - The value associated with the node (for RowNodes).
	 * @param {Function} createNodeFn - The function to create a new node (e.g., ColumnNode or RowNode).
	 * @returns {object} The root of the balanced subtree after insertion.
	 */
	_Insert(node, key, value, style, createNodeFn) {
		if (!node) {
			return createNodeFn(key, value, style);
		}

		if (key < node.key) {
			node.left = this._Insert(node.left, key, value, style, createNodeFn);
		} else if (key > node.key) {
			node.right = this._Insert(node.right, key, value, style, createNodeFn);
		} else {
			// If the key already exists, update its value (relevant for RowNodes)
			if (value !== undefined) {
				node.value = value;
			}
			if (style !== undefined) {
				node.style = { ...(node.style || {}), ...style };
			}
			return node;
		}

		node.height =
			Math.max(this.GetHeight(node.left), this.GetHeight(node.right)) + 1;
		const balance = this.GetBalance(node);

		if (balance > 1 && key < node.left.key) return this.RotateRight(node);
		if (balance < -1 && key > node.right.key) return this.RotateLeft(node);
		if (balance > 1 && key > node.left.key) {
			node.left = this.RotateLeft(node.left);
			return this.RotateRight(node);
		}
		if (balance < -1 && key < node.right.key) {
			node.right = this.RotateRight(node.right);
			return this.RotateLeft(node);
		}

		return node;
	}

	Insert(node, key, value, style, createNodeFn) {
		return this._Insert(node, key, value, style, createNodeFn);
	}

	/**
	 * Searches for a node with the given key in the AVL tree.
	 * @param {*} key - The key to search for.
	 * @returns {object|null} The node if found, otherwise null.
	 */
	Find(key) {
		let current = this.root;
		while (current) {
			if (key === current.key) {
				return current;
			} else if (key < current.key) {
				current = current.left;
			} else {
				current = current.right;
			}
		}
		return null;
	}

	/**
	 * Traverses the AVL tree in-order and returns an array of its nodes.
	 * @param {object} node - The current node in the recursive traversal.
	 * @returns {Array} An array of nodes.
	 */
	_TraverseInOrder(node) {
		if (!node) return [];
		return [
			...this._TraverseInOrder(node.left),
			node,
			...this._TraverseInOrder(node.right),
		];
	}

	TraverseInOrder(node) {
		return this._TraverseInOrder(node);
	}
}

/**
 * Represents a spreadsheet.
 * Uses a CellStore abstraction (defaulting to AVLCellStore) for cell storage.
 */
class Spreadsheet {
	// Export this class
	constructor(sheetName = "Sheet1", cellStore = null) {
		this.SheetName = sheetName;
		this.SheetId = 0;
		this.IsInMemory = true;
		this.Columns = []; // if dbdump then columnames will be stored here, else columnIds
		this.MaxRows = 0;
		this.PrimaryKeys = new Set(); // Kept for syncing with DB if needed
		this.PrimaryKeyMap = new Map(); // used to store rowno as key and primarykey values as value
		this.CellStore =
			cellStore ||
			(typeof AVLCellStore !== "undefined" ? new AVLCellStore() : null);
		this.RenderData = null;
	}

	// Backwards-compatible aliases
	get sheetName() {
		return this.SheetName;
	}
	set sheetName(val) {
		this.SheetName = val;
	}
	get sheetId() {
		return this.SheetId;
	}
	set sheetId(val) {
		this.SheetId = val;
	}
	get isInMemory() {
		return this.IsInMemory;
	}
	set isInMemory(val) {
		this.IsInMemory = val;
	}
	get columns() {
		return this.Columns;
	}
	set columns(val) {
		this.Columns = val;
	}
	get maxRows() {
		return this.MaxRows;
	}
	set maxRows(val) {
		this.MaxRows = val;
	}
	get primaryKeys() {
		return this.PrimaryKeys;
	}
	set primaryKeys(val) {
		this.PrimaryKeys = val;
	}
	get primaryKeyMap() {
		return this.PrimaryKeyMap;
	}
	set primaryKeyMap(val) {
		this.PrimaryKeyMap = val;
	}
	get cellStore() {
		return this.CellStore;
	}
	set cellStore(val) {
		this.CellStore = val;
	}
	get renderData() {
		return this.RenderData;
	}
	set renderData(val) {
		this.RenderData = val;
	}
	get columnTree() {
		return this.CellStore && this.CellStore.ColumnTree
			? this.CellStore.ColumnTree
			: this.CellStore?.GetRawTree
				? this.CellStore.GetRawTree()
				: null;
	}

	/**
	 * Inserts or updates data at a specific cell (rowKey, colKey).
	 * If the column or row doesn't exist, it will be created.
	 * @param {*} rowKey - The key identifying the row.
	 * @param {*} colKey - The key identifying the column.
	 * @param {*} cellValue - The value to store in the cell.
	 * @param {object} [style={}] - Cell formatting/style metadata.
	 */
	InsertData(rowKey, colKey, cellValue, style = {}) {
		if (!this.CellStore) {
			this.CellStore = new AVLCellStore();
		}
		this.CellStore.SetCell(rowKey, colKey, cellValue, style);
	}

	/**
	 * Retrieves the data from a specific cell.
	 * @param {*} rowKey - The key identifying the row.
	 * @param {*} colKey - The key identifying the column.
	 * @returns {*} The cell value, or null if the cell does not exist.
	 */
	RetrieveCellData(rowKey, colKey) {
		return this.CellStore ? this.CellStore.GetCell(rowKey, colKey) : null;
	}

	/**
	 * Traverses all columns and their respective rows, returning a structured representation of the spreadsheet data.
	 * @returns {Array<object>} An array of objects, each representing a column and its rows.
	 */
	TraverseAll() {
		return this.CellStore ? this.CellStore.TraverseAll() : [];
	}

	/**
	 * Traverses all rows within a specific column.
	 * @param {*} colKey - The key of the column to traverse.
	 * @returns {Array<object>} An array of objects, each representing a row and its value in the specified column.
	 */
	TraverseRowsInColumn(colKey) {
		return this.CellStore ? this.CellStore.TraverseRowsInColumn(colKey) : [];
	}

	/**
	 * Clears all data from the in-memory spreadsheet.
	 */
	Clear() {
		if (this.CellStore) {
			this.CellStore.Clear();
		}
		this.Columns = [];
		this.MaxRows = 0;
		this.PrimaryKeys.clear();
		this.PrimaryKeyMap.clear();
		this.RenderData = null;
	}
}
