/**
 * FormulaEvaluator.js
 *
 * Pure evaluation engine for Arbor Spreadsheet formula Abstract Syntax Trees (AST).
 * Traverses pure ASTNode data structures and calculates numeric/computed outcomes.
 * Decoupled from parsing, tokenization, and DOM presentation.
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

// Universal import for ReferenceResolver
const { ReferenceResolver } =
	typeof require !== "undefined"
		? require("./ReferenceResolver.js")
		: {
				ReferenceResolver: window.ReferenceResolver,
			};

// Universal import for FunctionRegistry
const { FunctionRegistry } =
	typeof require !== "undefined"
		? require("./FunctionRegistry.js")
		: {
				FunctionRegistry: window.FunctionRegistry,
			};

class FormulaEvaluator {
	/**
	 * @param {FunctionRegistry|null} [registry=null]
	 */
	constructor(registry = null) {
		this.Registry =
			registry ||
			(typeof FunctionRegistry !== "undefined"
				? FunctionRegistry.Instance
				: null);
		this.Resolver = new ReferenceResolver();
	}

	/**
	 * Recursively evaluates an ASTNode within an optional data context.
	 * @param {ASTNode} node
	 * @param {object|Function|null} [context=null]
	 * @returns {number|string|boolean|Array<*>}
	 */
	Evaluate(node, context = null) {
		if (!node) {
			return 0;
		}

		if (node instanceof NumberNode) {
			return node.Value;
		}

		if (node instanceof BooleanNode) {
			return node.Value;
		}

		if (node instanceof StringNode) {
			return node.Value;
		}

		if (node instanceof CellReferenceNode) {
			return this.ResolveCell(node, context);
		}

		if (node instanceof RangeNode) {
			return this.ResolveRange(node, context);
		}

		if (node instanceof FunctionCallNode) {
			return this.EvaluateFunctionCall(node, context);
		}

		if (node instanceof ErrorNode) {
			return node.ErrorMessage;
		}

		if (node instanceof UnaryOpNode) {
			return this.EvaluateUnaryOp(node.Operator, node.Operand, context);
		}

		if (node instanceof BinaryOpNode) {
			return this.EvaluateBinaryOp(
				node.Operator,
				node.Left,
				node.Right,
				context,
			);
		}

		return "#ERROR!";
	}

	/**
	 * Resolves a cell reference from the provided data context.
	 * @param {CellReferenceNode} cellRefNode
	 * @param {object|Function|null} context
	 * @returns {*}
	 */
	ResolveCell(cellRefNode, context) {
		if (!context) {
			return 0;
		}

		let val;
		if (typeof context.GetCellValue === "function") {
			val = context.GetCellValue(cellRefNode.RowIndex, cellRefNode.ColIndex);
		} else if (typeof context.GetCell === "function") {
			const cell = context.GetCell(cellRefNode.RowIndex, cellRefNode.ColIndex);
			val = cell
				? cell.ComputedValue !== undefined
					? cell.ComputedValue
					: (cell.Value ?? cell.value)
				: 0;
		} else if (typeof context === "function") {
			val = context(
				cellRefNode.RowIndex,
				cellRefNode.ColIndex,
				cellRefNode.RawReference,
			);
		} else if (typeof context === "object") {
			val = context[cellRefNode.RawReference];
			if (val === undefined) {
				val = context[cellRefNode.RawReference.toLowerCase()];
			}
		}

		if (val === undefined || val === null || val === "") {
			return 0;
		}

		if (typeof val === "string" && val.startsWith("#")) {
			return val;
		}

		if (typeof val === "number" || typeof val === "boolean") {
			return val;
		}

		const num = Number(val);
		if (!Number.isNaN(num)) {
			return num;
		}

		return val;
	}

	/**
	 * Resolves a range reference from the provided data context.
	 * @param {RangeNode} rangeNode
	 * @param {object|Function|null} context
	 * @returns {Array<*>}
	 */
	ResolveRange(rangeNode, context) {
		if (!context || !rangeNode) {
			return [];
		}

		if (typeof context.GetRangeValues === "function") {
			return context.GetRangeValues(
				rangeNode.StartCol,
				rangeNode.StartRow,
				rangeNode.EndCol,
				rangeNode.EndRow,
			);
		}

		const values = [];

		if (
			typeof context === "object" &&
			typeof context.GetCell !== "function" &&
			typeof context !== "function"
		) {
			const keys = Object.keys(context);
			const cellCount = rangeNode.GetCellCount();

			if (keys.length < cellCount) {
				for (const key of keys) {
					const coords = this.Resolver.CellKeyToCoords(key);
					if (coords && rangeNode.ContainsCell(coords.ColKey, coords.RowKey)) {
						values.push(context[key]);
					}
				}
				return values;
			}

			for (let r = rangeNode.StartRow; r <= rangeNode.EndRow; r++) {
				for (let c = rangeNode.StartCol; c <= rangeNode.EndCol; c++) {
					const key = this.Resolver.CoordsToCellKey(r, c);
					if (context[key] !== undefined) {
						values.push(context[key]);
					} else if (context[key.toLowerCase()] !== undefined) {
						values.push(context[key.toLowerCase()]);
					}
				}
			}
			return values;
		}

		for (let r = rangeNode.StartRow; r <= rangeNode.EndRow; r++) {
			for (let c = rangeNode.StartCol; c <= rangeNode.EndCol; c++) {
				let val;
				if (typeof context.GetCellValue === "function") {
					val = context.GetCellValue(r, c);
				} else if (typeof context.GetCell === "function") {
					const cell = context.GetCell(r, c);
					val = cell
						? cell.ComputedValue !== undefined
							? cell.ComputedValue
							: (cell.Value ?? cell.value)
						: null;
				} else if (typeof context === "function") {
					const ref = this.Resolver.CoordsToCellKey(r, c);
					val = context(r, c, ref);
				}
				if (val !== null && val !== undefined) {
					values.push(val);
				}
			}
		}

		return values;
	}

	/**
	 * Evaluates a function call ASTNode using the registered function implementations.
	 * @param {FunctionCallNode} functionCallNode
	 * @param {object|Function|null} context
	 * @returns {*}
	 */
	EvaluateFunctionCall(functionCallNode, context) {
		const fnName = functionCallNode.FunctionName;

		// Short-circuiting logical functions: IF and IFERROR
		if (fnName === "IF") {
			return this.EvaluateIf(functionCallNode, context);
		}
		if (fnName === "IFERROR") {
			return this.EvaluateIfError(functionCallNode, context);
		}

		const registry =
			this.Registry ||
			(typeof FunctionRegistry !== "undefined"
				? FunctionRegistry.Instance
				: null);

		if (!registry) {
			return "#NAME?";
		}

		const fn = registry.GetFunction(fnName);
		if (!fn) {
			return "#NAME?";
		}

		const evaluatedArgs = [];
		for (const argNode of functionCallNode.Arguments) {
			if (argNode instanceof RangeNode) {
				const rangeVals = this.ResolveRange(argNode, context);
				evaluatedArgs.push(rangeVals);
			} else {
				const argVal = this.Evaluate(argNode, context);
				evaluatedArgs.push(argVal);
			}
		}

		try {
			return fn(...evaluatedArgs);
		} catch (err) {
			return "#ERROR!";
		}
	}

	/**
	 * Evaluates an IF function call with short-circuit evaluation.
	 * Only evaluates the branch that matches the condition.
	 * @param {FunctionCallNode} functionCallNode
	 * @param {object|Function|null} context
	 * @returns {*}
	 */
	EvaluateIf(functionCallNode, context) {
		const args = functionCallNode.Arguments;
		if (args.length < 2 || args.length > 3) {
			return "#VALUE!";
		}

		const condVal = this.Evaluate(args[0], context);
		if (typeof condVal === "string" && condVal.startsWith("#")) {
			return condVal;
		}

		const boolRes = this.ToBoolean(condVal);
		if (boolRes.Error) {
			return boolRes.Error;
		}

		if (boolRes.Value) {
			return this.Evaluate(args[1], context);
		} else {
			return args[2] ? this.Evaluate(args[2], context) : false;
		}
	}

	/**
	 * Evaluates an IFERROR function call with lazy error handling.
	 * Only evaluates the fallback if the primary expression evaluates to an error.
	 * @param {FunctionCallNode} functionCallNode
	 * @param {object|Function|null} context
	 * @returns {*}
	 */
	EvaluateIfError(functionCallNode, context) {
		const args = functionCallNode.Arguments;
		if (args.length !== 2) {
			return "#VALUE!";
		}

		const primaryVal = this.Evaluate(args[0], context);
		if (typeof primaryVal === "string" && primaryVal.startsWith("#")) {
			return this.Evaluate(args[1], context);
		}

		return primaryVal;
	}

	/**
	 * Converts a value to a boolean following standard spreadsheet truthiness rules.
	 * @param {*} val
	 * @returns {{ Value?: boolean, Error?: string }}
	 */
	ToBoolean(val) {
		if (typeof val === "boolean") {
			return { Value: val };
		}
		if (typeof val === "number") {
			return { Value: val !== 0 };
		}
		if (typeof val === "string") {
			if (val.startsWith("#")) {
				return { Error: val };
			}
			const upper = val.trim().toUpperCase();
			if (upper === "TRUE") {
				return { Value: true };
			}
			if (upper === "FALSE") {
				return { Value: false };
			}
			const num = Number(val);
			if (!Number.isNaN(num)) {
				return { Value: num !== 0 };
			}
			return { Error: "#VALUE!" };
		}
		return { Error: "#VALUE!" };
	}

	/**
	 * Compares two values according to standard spreadsheet comparison semantics.
	 * Returns:
	 *   < 0 if left < right
	 *   0 if left == right
	 *   > 0 if left > right
	 * @param {*} leftVal
	 * @param {*} rightVal
	 * @returns {number}
	 */
	CompareValues(leftVal, rightVal) {
		if (typeof leftVal === "string" && typeof rightVal === "string") {
			const l = leftVal.toUpperCase();
			const r = rightVal.toUpperCase();
			if (l < r) return -1;
			if (l > r) return 1;
			return 0;
		}

		if (typeof leftVal === typeof rightVal) {
			if (leftVal < rightVal) return -1;
			if (leftVal > rightVal) return 1;
			return 0;
		}

		// Excel type comparison hierarchy: number < string < boolean
		const typeOrder = { number: 1, string: 2, boolean: 3 };
		const orderL = typeOrder[typeof leftVal] || 0;
		const orderR = typeOrder[typeof rightVal] || 0;
		if (orderL < orderR) return -1;
		if (orderL > orderR) return 1;
		return 0;
	}

	/**
	 * Evaluates unary operations (+, -).
	 * @param {string} operator
	 * @param {ASTNode} operandNode
	 * @param {object|null} context
	 * @returns {number|string}
	 */
	EvaluateUnaryOp(operator, operandNode, context) {
		const operandVal = this.Evaluate(operandNode, context);

		// If operand is an error token, propagate it
		if (typeof operandVal === "string" && operandVal.startsWith("#")) {
			return operandVal;
		}

		const num = Number(operandVal);
		if (Number.isNaN(num)) {
			return "#VALUE!";
		}

		if (operator === "-") {
			return -num;
		}
		if (operator === "+") {
			return +num;
		}

		return "#ERROR!";
	}

	/**
	 * Evaluates binary operations (+, -, *, /, ^, =, <>, <, <=, >, >=).
	 * @param {string} operator
	 * @param {ASTNode} leftNode
	 * @param {ASTNode} rightNode
	 * @param {object|null} context
	 * @returns {number|string|boolean}
	 */
	EvaluateBinaryOp(operator, leftNode, rightNode, context) {
		const leftVal = this.Evaluate(leftNode, context);
		if (typeof leftVal === "string" && leftVal.startsWith("#")) {
			return leftVal;
		}

		const rightVal = this.Evaluate(rightNode, context);
		if (typeof rightVal === "string" && rightVal.startsWith("#")) {
			return rightVal;
		}

		// Comparison operations
		switch (operator) {
			case "=":
				return this.CompareValues(leftVal, rightVal) === 0;
			case "<>":
				return this.CompareValues(leftVal, rightVal) !== 0;
			case "<":
				return this.CompareValues(leftVal, rightVal) < 0;
			case "<=":
				return this.CompareValues(leftVal, rightVal) <= 0;
			case ">":
				return this.CompareValues(leftVal, rightVal) > 0;
			case ">=":
				return this.CompareValues(leftVal, rightVal) >= 0;
		}

		// Arithmetic operations require numbers
		const leftNum = Number(leftVal);
		const rightNum = Number(rightVal);

		if (Number.isNaN(leftNum) || Number.isNaN(rightNum)) {
			return "#VALUE!";
		}

		switch (operator) {
			case "+":
				return leftNum + rightNum;
			case "-":
				return leftNum - rightNum;
			case "*":
				return leftNum * rightNum;
			case "/":
				if (rightNum === 0) {
					return "#DIV/0!";
				}
				return leftNum / rightNum;
			case "^": {
				if (leftNum === 0 && rightNum < 0) {
					return "#DIV/0!";
				}
				const powRes = Math.pow(leftNum, rightNum);
				if (Number.isNaN(powRes) || !Number.isFinite(powRes)) {
					return "#NUM!";
				}
				return powRes;
			}
			default:
				return "#ERROR!";
		}
	}
}

// Universal module export (Browser global & Node.js CommonJS)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		FormulaEvaluator,
	};
}
