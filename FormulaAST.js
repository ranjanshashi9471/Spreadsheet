/**
 * FormulaAST.js
 *
 * Pure Abstract Syntax Tree (AST) node representations for the Arbor Spreadsheet formula engine.
 * All nodes are pure data containers (DTOs) with zero evaluation or execution logic.
 *
 * Strictly follows PascalCase for all properties and methods.
 */

class ASTNode {
	/**
	 * @param {string} nodeType
	 */
	constructor(nodeType) {
		this.NodeType = nodeType;
	}

	ToString() {
		return `${this.NodeType}`;
	}
}

class NumberNode extends ASTNode {
	/**
	 * @param {number} value
	 */
	constructor(value) {
		super("NumberNode");
		this.Value = value;
	}

	ToString() {
		return `${this.Value}`;
	}
}

class UnaryOpNode extends ASTNode {
	/**
	 * @param {string} operator
	 * @param {ASTNode} operand
	 */
	constructor(operator, operand) {
		super("UnaryOpNode");
		this.Operator = operator;
		this.Operand = operand;
	}

	ToString() {
		return `(${this.Operator}${this.Operand ? this.Operand.ToString() : ""})`;
	}
}

class BinaryOpNode extends ASTNode {
	/**
	 * @param {string} operator
	 * @param {ASTNode} left
	 * @param {ASTNode} right
	 */
	constructor(operator, left, right) {
		super("BinaryOpNode");
		this.Operator = operator;
		this.Left = left;
		this.Right = right;
	}

	ToString() {
		const leftStr = this.Left ? this.Left.ToString() : "";
		const rightStr = this.Right ? this.Right.ToString() : "";
		return `(${leftStr} ${this.Operator} ${rightStr})`;
	}
}

class CellReferenceNode extends ASTNode {
	/**
	 * @param {string} rawReference - Canonical coordinate string, e.g. "A1"
	 * @param {number} colIndex - 0-based column index
	 * @param {number} rowIndex - 1-based row index
	 * @param {string} [colLetter] - Column letter(s), e.g. "A"
	 */
	constructor(rawReference, colIndex, rowIndex, colLetter = "") {
		super("CellReferenceNode");
		this.RawReference = rawReference ? rawReference.toUpperCase() : "";
		this.ColIndex = colIndex;
		this.RowIndex = rowIndex;
		this.ColLetter = colLetter || "";
	}

	ToString() {
		return `${this.RawReference}`;
	}
}

class RangeNode extends ASTNode {
	/**
	 * @param {string} rawReference - Canonical coordinate string, e.g. "A1:B3"
	 * @param {number} startCol - 0-based start column index
	 * @param {number} startRow - 1-based start row index
	 * @param {number} endCol - 0-based end column index
	 * @param {number} endRow - 1-based end row index
	 */
	constructor(rawReference, startCol, startRow, endCol, endRow) {
		super("RangeNode");
		this.RawReference = rawReference ? rawReference.toUpperCase() : "";
		this.StartCol = Math.min(startCol, endCol);
		this.StartRow = Math.min(startRow, endRow);
		this.EndCol = Math.max(startCol, endCol);
		this.EndRow = Math.max(startRow, endRow);
	}

	/**
	 * Tests whether given 0-based col and 1-based row are within this range bounding box.
	 * @param {number} colIndex
	 * @param {number} rowIndex
	 * @returns {boolean}
	 */
	ContainsCell(colIndex, rowIndex) {
		return (
			colIndex >= this.StartCol &&
			colIndex <= this.EndCol &&
			rowIndex >= this.StartRow &&
			rowIndex <= this.EndRow
		);
	}

	/**
	 * Total number of cells spanning this bounding box.
	 * @returns {number}
	 */
	GetCellCount() {
		return (
			(this.EndCol - this.StartCol + 1) * (this.EndRow - this.StartRow + 1)
		);
	}

	ToString() {
		return `${this.RawReference}`;
	}
}

class FunctionCallNode extends ASTNode {
	/**
	 * @param {string} functionName - e.g. "SUM"
	 * @param {ASTNode[]} [args=[]] - Array of argument AST nodes
	 */
	constructor(functionName, args = []) {
		super("FunctionCallNode");
		this.FunctionName = functionName ? functionName.toUpperCase() : "";
		this.Arguments = Array.isArray(args) ? args : [];
	}

	ToString() {
		const argsStr = this.Arguments.map((arg) =>
			arg ? arg.ToString() : "",
		).join(", ");
		return `${this.FunctionName}(${argsStr})`;
	}
}

class ErrorNode extends ASTNode {
	/**
	 * @param {string} errorMessage
	 */
	constructor(errorMessage) {
		super("ErrorNode");
		this.ErrorMessage = errorMessage;
	}

	ToString() {
		return `${this.ErrorMessage}`;
	}
}

class BooleanNode extends ASTNode {
	/**
	 * @param {boolean} value
	 */
	constructor(value) {
		super("BooleanNode");
		this.Value = Boolean(value);
	}

	ToString() {
		return this.Value ? "TRUE" : "FALSE";
	}
}

class StringNode extends ASTNode {
	/**
	 * @param {string} value
	 */
	constructor(value) {
		super("StringNode");
		this.Value = value != null ? String(value) : "";
	}

	ToString() {
		return `"${this.Value}"`;
	}
}

// Universal module export (Browser global & Node.js CommonJS)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		ASTNode,
		NumberNode,
		UnaryOpNode,
		BinaryOpNode,
		CellReferenceNode,
		RangeNode,
		FunctionCallNode,
		BooleanNode,
		StringNode,
		ErrorNode,
	};
}
