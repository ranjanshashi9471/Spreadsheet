/**
 * DependencyAnalyzer.js
 *
 * Traverses pure ASTNode data structures and extracts cell reference and range dependencies.
 * Zero DOM dependencies. Zero coupling to Ohm.
 *
 * Strictly follows PascalCase for all properties and methods.
 */

// Universal import for AST Nodes (Browser global fallback / Node CommonJS)
const {
	NumberNode,
	UnaryOpNode,
	BinaryOpNode,
	CellReferenceNode,
	RangeNode,
	FunctionCallNode,
	BooleanNode,
	StringNode,
	ErrorNode,
} =
	typeof require !== "undefined"
		? require("./FormulaAST.js")
		: {
				NumberNode: window.NumberNode,
				UnaryOpNode: window.UnaryOpNode,
				BinaryOpNode: window.BinaryOpNode,
				CellReferenceNode: window.CellReferenceNode,
				RangeNode: window.RangeNode,
				FunctionCallNode: window.FunctionCallNode,
				BooleanNode: window.BooleanNode,
				StringNode: window.StringNode,
				ErrorNode: window.ErrorNode,
			};

class DependencyAnalyzer {
	/**
	 * Analyzes an ASTNode and extracts all direct cell and range dependencies.
	 * @param {ASTNode} astNode
	 * @returns {{ Cells: Set<string>, Ranges: Array<RangeNode> }}
	 */
	Analyze(astNode) {
		const cells = new Set();
		const ranges = [];

		this.Traverse(astNode, cells, ranges);

		return {
			Cells: cells,
			Ranges: ranges,
		};
	}

	/**
	 * Recursive AST traversal helper.
	 * @param {ASTNode} node
	 * @param {Set<string>} cells
	 * @param {Array<RangeNode>} ranges
	 */
	Traverse(node, cells, ranges) {
		if (!node) {
			return;
		}

		if (node instanceof CellReferenceNode) {
			cells.add(node.RawReference);
			return;
		}

		if (node instanceof RangeNode) {
			ranges.push(node);
			return;
		}

		if (node instanceof UnaryOpNode) {
			this.Traverse(node.Operand, cells, ranges);
			return;
		}

		if (node instanceof BinaryOpNode) {
			this.Traverse(node.Left, cells, ranges);
			this.Traverse(node.Right, cells, ranges);
			return;
		}

		if (node instanceof FunctionCallNode) {
			if (Array.isArray(node.Arguments)) {
				for (const arg of node.Arguments) {
					this.Traverse(arg, cells, ranges);
				}
			}
			return;
		}

		// Leaf nodes (NumberNode, StringNode, BooleanNode, ErrorNode) have no children
	}
}

// Universal module export (Browser global & Node.js CommonJS)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		DependencyAnalyzer,
	};
}
