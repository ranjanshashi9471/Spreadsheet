/**
 * Represents a node in the secondary AVL tree (for rows within a column).
 * Stores the row key and its corresponding cell value.
 */
class RowNode {
	constructor(rowKey, cellValue) {
		this.key = rowKey;
		this.value = cellValue;
		this.left = null;
		this.right = null;
		this.height = 1; // New nodes are always at height 1
	}
}

/**
 * Represents a node in the primary AVL tree (for columns).
 * Each column node itself contains another AVL tree (of RowNodes) for its rows.
 */
class ColumnNode {
	constructor(colKey) {
		this.key = colKey;
		this.name = null; // Can be used for column headers
		this.rows = null; // Root of the secondary AVL tree for rows in this column
		this.left = null;
		this.right = null;
		this.height = 1; // New nodes are always at height 1
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

	/**
	 * Helper function to get the height of a node.
	 * @param {object} node - The node to get the height of.
	 * @returns {number} The height of the node, or 0 if null.
	 */
	getHeight(node) {
		return node ? node.height : 0;
	}

	/**
	 * Helper function to calculate the balance factor of a node.
	 * @param {object} node - The node to calculate the balance factor for.
	 * @returns {number} The balance factor (height of left subtree - height of right subtree).
	 */
	getBalance(node) {
		return node ? this.getHeight(node.left) - this.getHeight(node.right) : 0;
	}

	/**
	 * Performs a right rotation on the given node.
	 * Used to balance the AVL tree.
	 * @param {object} y - The node to rotate around.
	 * @returns {object} The new root of the rotated subtree.
	 */
	rotateRight(y) {
		const x = y.left;
		const T2 = x.right;

		x.right = y;
		y.left = T2;

		y.height = Math.max(this.getHeight(y.left), this.getHeight(y.right)) + 1;
		x.height = Math.max(this.getHeight(x.left), this.getHeight(x.right)) + 1;

		return x;
	}

	/**
	 * Performs a left rotation on the given node.
	 * Used to balance the AVL tree.
	 * @param {object} x - The node to rotate around.
	 * @returns {object} The new root of the rotated subtree.
	 */
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
	 * @param {*} [value=null] - The value associated with the node (for RowNodes).
	 * @param {Function} createNodeFn - The function to create a new node (e.g., createColumnNode or createRowNode).
	 * @returns {object} The root of the balanced subtree after insertion.
	 */
	_insert(node, key, value, createNodeFn) {
		if (!node) {
			return createNodeFn(key, value);
		}

		if (key < node.key) {
			node.left = this._insert(node.left, key, value, createNodeFn);
		} else if (key > node.key) {
			node.right = this._insert(node.right, key, value, createNodeFn);
		} else {
			// If the key already exists, update its value (relevant for RowNodes)
			if (value !== undefined) {
				node.value = value;
			}
			return node; // Duplicate keys for ColumnNodes are handled by not inserting
		}

		// Update height of the current node
		node.height =
			Math.max(this.getHeight(node.left), this.getHeight(node.right)) + 1;

		// Get the balance factor
		const balance = this.getBalance(node);

		// Perform rotations if the node is unbalanced
		// Left Left Case
		if (balance > 1 && key < node.left.key) {
			return this.rotateRight(node);
		}
		// Right Right Case
		if (balance < -1 && key > node.right.key) {
			return this.rotateLeft(node);
		}
		// Left Right Case
		if (balance > 1 && key > node.left.key) {
			node.left = this.rotateLeft(node.left);
			return this.rotateRight(node);
		}
		// Right Left Case
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

// -----------------------------------------------------------------------------

/**
 * Represents a spreadsheet using an AVL tree of AVL trees (ColumnNode contains an AVLTree of RowNodes).
 * This structure allows for efficient insertion, retrieval, and traversal of cell data
 * based on row and column keys.
 */
class Spreadsheet {
	constructor(sheetName = "Sheet1") {
		this.sheetName = sheetName;
		this.columnTree = new AVLTree(); // Primary AVL tree for columns
		this.colCount = 0; // Tracks the number of unique columns
		this.rowCount = 0; // Tracks the number of unique rows (across all columns) - might need more specific tracking if a "row" means a full horizontal line
	}

	/**
	 * Inserts or updates data at a specific cell (rowKey, colKey).
	 * If the column or row doesn't exist, it will be created.
	 * @param {*} rowKey - The key identifying the row.
	 * @param {*} colKey - The key identifying the column.
	 * @param {*} cellValue - The value to store in the cell.
	 */
	insertData(rowKey, colKey, cellValue) {
		// Find or insert the column
		let colNode = this.columnTree.find(colKey);
		if (!colNode) {
			this.columnTree.root = this.columnTree._insert(
				this.columnTree.root,
				colKey,
				undefined, // ColumnNodes don't have a direct 'value' like RowNodes
				(key) => new ColumnNode(key)
			);
			colNode = this.columnTree.find(colKey); // Retrieve the newly inserted node
			this.colCount++;
		}

		// Insert or update the row within the found/created column
		if (!colNode.rows) {
			colNode.rows = new AVLTree();
		}
		colNode.rows.root = colNode.rows._insert(
			colNode.rows.root,
			rowKey,
			cellValue,
			(key, val) => new RowNode(key, val)
		);

		// Note: Tracking rowCount accurately across all columns can be complex
		// if a "row" implies a horizontal line. For unique row keys across the
		// entire sheet, a separate Set could be maintained. For simplicity,
		// this implementation assumes rowCount reflects unique row entries
		// within individual columns, or you might count the total number of
		// RowNodes across all columns.
		// A simple way to track unique rows if they are guaranteed to have at least one cell
		// would be to have a set of unique rowKeys.
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
			return null; // Column or its row tree doesn't exist
		}
		const rowNode = colNode.rows.find(rowKey);
		return rowNode ? rowNode.value : null;
	}

	/**
	 * Traverses all columns and their respective rows, returning a structured representation of the spreadsheet data.
	 * The data is returned in column-major order (sorted by column key), with rows within each column also sorted by row key.
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
				colName: colNode.name, // Include column name if available
				rows: formattedRows,
			});
		}
		return spreadsheetData;
	}

	/**
	 * Traverses all rows within a specific column.
	 * @param {*} colKey - The key of the column to traverse.
	 * @returns {Array<object>} An array of objects, each representing a row and its value in the specified column.
	 * Returns an empty array if the column does not exist or has no rows.
	 */
	traverseRowsInColumn(colKey) {
		const colNode = this.columnTree.find(colKey);
		if (!colNode || !colNode.rows) {
			return [];
		}
		const rowsInColumn = colNode.rows._traverseInOrder(colNode.rows.root);
		return rowsInColumn.map((row) => ({ key: row.key, value: row.value }));
	}
}

// --- Usage Example ---
console.log("🚀 Initializing Spreadsheet...");
const mySpreadsheet = new Spreadsheet("My Data Sheet");

console.log("\n➕ Inserting Data:");
mySpreadsheet.insertData(1, 1, "Alpha");
mySpreadsheet.insertData(3, 1, "Gamma");
mySpreadsheet.insertData(2, 2, "Beta");
mySpreadsheet.insertData(1, 2, "Delta");
mySpreadsheet.insertData(5, 3, "Epsilon");
mySpreadsheet.insertData(4, 1, "Zeta"); // Adding another row to col 1
mySpreadsheet.insertData(2, 3, "Eta"); // Adding another row to col 3
mySpreadsheet.insertData(1, 1, "New Alpha"); // Updating existing cell

console.log("\n🔎 Retrieving Data:");
console.log(`Cell (1,1): ${mySpreadsheet.retrieveCellData(1, 1)}`); // Expected: New Alpha
console.log(`Cell (3,1): ${mySpreadsheet.retrieveCellData(3, 1)}`); // Expected: Gamma
console.log(`Cell (2,2): ${mySpreadsheet.retrieveCellData(2, 2)}`); // Expected: Beta
console.log(`Cell (1,2): ${mySpreadsheet.retrieveCellData(1, 2)}`); // Expected: Delta
console.log(`Cell (5,3): ${mySpreadsheet.retrieveCellData(5, 3)}`); // Expected: Epsilon

console.log(`Cell (4,1): ${mySpreadsheet.retrieveCellData(4, 1)}`); // Expected: Zeta
console.log(`Cell (2,3): ${mySpreadsheet.retrieveCellData(2, 3)}`); // Expected: Eta
console.log(`Cell (99,99): ${mySpreadsheet.retrieveCellData(99, 99)}`); // Expected: null (non-existent)
console.log(`Cell (1,5): ${mySpreadsheet.retrieveCellData(1, 5)}`); // Expected: null (non-existent column)

console.log("\n➡️ Traversing Rows in Column 1:");
console.log(mySpreadsheet.traverseRowsInColumn(1));
/* Expected output (order might vary slightly due to AVL balancing, but keys will be sorted):
[
  { key: 1, value: 'New Alpha' },
  { key: 3, value: 'Gamma' },
  { key: 4, value: 'Zeta' }
]
*/

console.log("\n🔄 Traversing All Data in Spreadsheet:");
console.log(JSON.stringify(mySpreadsheet.traverseAll(), null, 2));
/* Expected structured output (column keys and row keys within columns will be sorted):
[
  {
    "colKey": 1,
    "colName": null,
    "rows": [
      { "key": 1, "value": "New Alpha" },
      { "key": 3, "value": "Gamma" },
      { "key": 4, "value": "Zeta" }
    ]
  },
  {
    "colKey": 2,
    "colName": null,
    "rows": [
      { "key": 1, "value": "Delta" },
      { "key": 2, "value": "Beta" }
    ]
  },
  {
    "colKey": 3,
    "colName": null,
    "rows": [
      { "key": 2, "value": "Eta" },
      { "key": 5, "value": "Epsilon" }
    ]
  }
]
*/

console.log(`\nSpreadsheet Name: ${mySpreadsheet.sheetName}`);
console.log(`Total Columns: ${mySpreadsheet.colCount}`);
// Note: Total rows calculation is tricky without a separate Set for all unique rowKeys across the sheet.
// The current 'rowCount' would need to be updated within insertData based on such a Set.
