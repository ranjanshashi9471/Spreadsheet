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

	getHeight(node) {
		return node ? node.height : 0;
	}

	getBalance(node) {
		return node ? this.getHeight(node.left) - this.getHeight(node.right) : 0;
	}

	rotateRight(y) {
		const x = y.left;
		const T2 = x.right;

		x.right = y;
		y.left = T2;

		y.height = Math.max(this.getHeight(y.left), this.getHeight(y.right)) + 1;
		x.height = Math.max(this.getHeight(x.left), this.getHeight(x.right)) + 1;

		return x;
	}

	rotateLeft(x) {
		const y = x.right;
		const T2 = y.left;

		y.left = x;
		x.right = T2;

		x.height = Math.max(this.getHeight(x.left), this.getHeight(x.right)) + 1;
		y.height = Math.max(this.getHeight(y.left), this.getHeight(y.right)) + 1;

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
	_insert(node, key, value, style, createNodeFn) {
		if (!node) {
			return createNodeFn(key, value, style);
		}

		if (key < node.key) {
			node.left = this._insert(node.left, key, value, style, createNodeFn);
		} else if (key > node.key) {
			node.right = this._insert(node.right, key, value, style, createNodeFn);
		} else {
			// If the key already exists, update its value (relevant for RowNodes)
			if (value !== undefined) {
				node.value = value;
			}
			if (style !== undefined) {
				node.style = { ...style };
			}
			return node;
		}

		node.height =
			Math.max(this.getHeight(node.left), this.getHeight(node.right)) + 1;
		const balance = this.getBalance(node);

		if (balance > 1 && key < node.left.key) return this.rotateRight(node);
		if (balance < -1 && key > node.right.key) return this.rotateLeft(node);
		if (balance > 1 && key > node.left.key) {
			node.left = this.rotateLeft(node.left);
			return this.rotateRight(node);
		}
		if (balance < -1 && key < node.right.key) {
			node.right = this.rotateRight(node.right);
			return this.rotateLeft(node);
		}

		return node;
	}

	/**
	 * Searches for a node with the given key in the AVL tree.
	 * @param {*} key - The key to search for.
	 * @returns {object|null} The node if found, otherwise null.
	 */
	find(key) {
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
	_traverseInOrder(node) {
		if (!node) return [];
		return [
			...this._traverseInOrder(node.left),
			node,
			...this._traverseInOrder(node.right),
		];
	}
}

/**
 * Represents a spreadsheet using an AVL tree of AVL trees.
 * This is an in-memory data structure.
 */
class Spreadsheet {
	// Export this class
	constructor(sheetName = "Sheet1") {
		this.sheetName = sheetName;
		this.columnTree = new AVLTree();
		this.columns = [];
		this.maxRows = 0;
	}

	/**
	 * Inserts or updates data at a specific cell (rowKey, colKey).
	 * If the column or row doesn't exist, it will be created.
	 * @param {*} rowKey - The key identifying the row.
	 * @param {*} colKey - The key identifying the column.
	 * @param {*} cellValue - The value to store in the cell.
	 */
	insertData(rowKey, colKey, cellValue, style = {}) {
		// Find or insert the column
		let colNode = this.columnTree.find(colKey);
		if (!colNode) {
			this.columnTree.root = this.columnTree._insert(
				this.columnTree.root,
				colKey,
				undefined,
				undefined,
				(key) => new ColumnNode(key)
			);
			colNode = this.columnTree.find(colKey); // Re-find after potential root change
		}

		// Insert or update the row within the found/created column
		if (!colNode.rows) {
			colNode.rows = new AVLTree();
		}

		colNode.rows.root = colNode.rows._insert(
			colNode.rows.root,
			rowKey,
			cellValue,
			style,
			(key, value, style) => new RowNode(key, value, style)
		);
	}

	/**
	 * Retrieves the data from a specific cell.
	 * @param {*} rowKey - The key identifying the row.
	 * @param {*} colKey - The key identifying the column.
	 * @returns {*} The cell value, or null if the cell does not exist.
	 */
	retrieveCellData(rowKey, colKey) {
		const colNode = this.columnTree.find(colKey);
		if (!colNode || !colNode.rows) {
			return null;
		}
		const rowNode = colNode.rows.find(rowKey);
		return rowNode ? rowNode.value : null;
	}

	/**
	 * Traverses all columns and their respective rows, returning a structured representation of the spreadsheet data.
	 * @returns {Array<object>} An array of objects, each representing a column and its rows.
	 */
	traverseAll() {
		const allColumns = this.columnTree._traverseInOrder(this.columnTree.root);
		const spreadsheetData = [];

		for (const colNode of allColumns) {
			const rowsInColumn = colNode.rows
				? colNode.rows._traverseInOrder(colNode.rows.root)
				: [];
			const formattedRows = rowsInColumn.map((row) => ({
				key: row.key,
				value: row.value,
			}));
			spreadsheetData.push({
				colKey: colNode.key,
				colName: colNode.name,
				rows: formattedRows,
			});
		}
		return spreadsheetData;
	}

	/**
	 * Traverses all rows within a specific column.
	 * @param {*} colKey - The key of the column to traverse.
	 * @returns {Array<object>} An array of objects, each representing a row and its value in the specified column.
	 */
	traverseRowsInColumn(colKey) {
		const colNode = this.columnTree.find(colKey);
		if (!colNode || !colNode.rows) {
			return [];
		}
		const rowsInColumn = colNode.rows._traverseInOrder(colNode.rows.root);
		return rowsInColumn.map((row) => ({ key: row.key, value: row.value }));
	}

	/**
	 * Clears all data from the in-memory spreadsheet.
	 */
	clear() {
		this.columnTree.root = null;
	}
}
