/**
 * scratch/ParserExperiment.js
 *
 * Educational Spike: Isolated Pratt precedence / recursive-descent parser experiment.
 * Demonstrates:
 * 1. Tokens stream consumption.
 * 2. Operator precedence climbing (Pratt parsing) for infix and prefix operators.
 * 3. Pure AST Node generation (BinaryOpNode, UnaryOpNode, NumberNode).
 * 4. Separate tree-walking evaluation to compute exact results.
 *
 * Strictly follows PascalCase for all properties and methods.
 */

const { TokenType, Tokenizer } = require("./TokenizerExperiment");

// --- Pure AST Node DTOs ---

class ASTNode {
	constructor(type) {
		this.NodeType = type;
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
		return `(${this.Operator}${this.Operand.ToString()})`;
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
		return `(${this.Left.ToString()} ${this.Operator} ${this.Right.ToString()})`;
	}
}

// --- Precedence Levels ---

const Precedence = Object.freeze({
	NONE: 0,
	SUM: 10, // +, -
	PRODUCT: 20, // *, /
	UNARY: 30, // prefix -, +
});

// --- Pratt Precedence Parser ---

class Parser {
	/**
	 * @param {Array<Token>} tokens
	 */
	constructor(tokens) {
		this.Tokens = tokens || [];
		this.CurrentIndex = 0;
	}

	/**
	 * Looks at the current token without consuming it.
	 * @returns {Token}
	 */
	Peek() {
		if (this.CurrentIndex >= this.Tokens.length) {
			return this.Tokens[this.Tokens.length - 1];
		}
		return this.Tokens[this.CurrentIndex];
	}

	/**
	 * Consumes and returns the current token.
	 * @returns {Token}
	 */
	Advance() {
		const token = this.Peek();
		this.CurrentIndex++;
		return token;
	}

	/**
	 * Asserts that the current token matches the expected type and consumes it.
	 * @param {string} type
	 * @returns {Token}
	 */
	Expect(type) {
		const token = this.Peek();
		if (token.Type !== type) {
			throw new Error(
				`Expected token type '${type}' but found '${token.Type}' at pos ${token.Position}`,
			);
		}
		return this.Advance();
	}

	/**
	 * Gets the binding power / precedence of an infix operator token.
	 * @param {string} tokenType
	 * @returns {number}
	 */
	GetInfixPrecedence(tokenType) {
		switch (tokenType) {
			case TokenType.PLUS:
			case TokenType.MINUS:
				return Precedence.SUM;
			case TokenType.STAR:
			case TokenType.SLASH:
				return Precedence.PRODUCT;
			default:
				return Precedence.NONE;
		}
	}

	/**
	 * Parses a prefix or primary expression (literals, unary operators, grouping).
	 * @returns {ASTNode}
	 */
	ParsePrefix() {
		const token = this.Advance();

		switch (token.Type) {
			case TokenType.NUMBER:
				return new NumberNode(token.Value);

			case TokenType.PLUS:
			case TokenType.MINUS: {
				const operand = this.ParseExpression(Precedence.UNARY);
				return new UnaryOpNode(token.Value, operand);
			}

			case TokenType.LPAREN: {
				const inner = this.ParseExpression(Precedence.NONE);
				this.Expect(TokenType.RPAREN);
				return inner;
			}

			default:
				throw new Error(
					`Unexpected token '${token.Type}' in prefix position at pos ${token.Position}`,
				);
		}
	}

	/**
	 * Core Pratt precedence-climbing loop.
	 * @param {number} precedence
	 * @returns {ASTNode}
	 */
	ParseExpression(precedence = Precedence.NONE) {
		let left = this.ParsePrefix();

		while (true) {
			const nextToken = this.Peek();
			const nextPrecedence = this.GetInfixPrecedence(nextToken.Type);

			// If the next operator binds less tightly or equally to current precedence, break
			if (nextPrecedence <= precedence) {
				break;
			}

			// Consume the operator
			const opToken = this.Advance();

			// Parse right-hand side with the operator's precedence
			const right = this.ParseExpression(nextPrecedence);

			// Construct binary AST node
			left = new BinaryOpNode(opToken.Value, left, right);
		}

		return left;
	}

	/**
	 * Parses the full token stream into a root ASTNode.
	 * @returns {ASTNode}
	 */
	Parse() {
		const root = this.ParseExpression(Precedence.NONE);
		this.Expect(TokenType.EOF);
		return root;
	}
}

// --- Pure Tree-Walking Evaluator ---

class TinyEvaluator {
	/**
	 * Recursively evaluates an ASTNode to compute its numerical result.
	 * @param {ASTNode} node
	 * @returns {number}
	 */
	Evaluate(node) {
		if (node instanceof NumberNode) {
			return node.Value;
		}

		if (node instanceof UnaryOpNode) {
			const operandVal = this.Evaluate(node.Operand);
			if (node.Operator === "-") return -operandVal;
			if (node.Operator === "+") return +operandVal;
			throw new Error(`Unknown unary operator: ${node.Operator}`);
		}

		if (node instanceof BinaryOpNode) {
			const leftVal = this.Evaluate(node.Left);
			const rightVal = this.Evaluate(node.Right);

			switch (node.Operator) {
				case "+":
					return leftVal + rightVal;
				case "-":
					return leftVal - rightVal;
				case "*":
					return leftVal * rightVal;
				case "/":
					if (rightVal === 0) throw new Error("Division by zero");
					return leftVal / rightVal;
				default:
					throw new Error(`Unknown binary operator: ${node.Operator}`);
			}
		}

		throw new Error(`Unknown AST node type: ${node?.NodeType}`);
	}
}

// Export module
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		ASTNode,
		NumberNode,
		UnaryOpNode,
		BinaryOpNode,
		Precedence,
		Parser,
		TinyEvaluator,
	};
}

// Standalone execution demo & verification
if (typeof require !== "undefined" && require.main === module) {
	console.log(
		"=== Educational Spike: Pratt Parser & Evaluator Experiment ===\n",
	);

	const testCases = [
		{
			input: "10 + 20 * 3",
			expectedAST: "(10 + (20 * 3))",
			expectedVal: 70,
			description: "Multiplication binds tighter than addition",
		},
		{
			input: "(10 + 20) * 3",
			expectedAST: "((10 + 20) * 3)",
			expectedVal: 90,
			description: "Parentheses override operator precedence",
		},
		{
			input: "-10 + 25",
			expectedAST: "((-10) + 25)",
			expectedVal: 15,
			description: "Unary minus negation",
		},
		{
			input: "100 / 4 - 5",
			expectedAST: "((100 / 4) - 5)",
			expectedVal: 20,
			description: "Division and subtraction left-associativity",
		},
	];

	const evaluator = new TinyEvaluator();
	let allPassed = true;

	for (const tc of testCases) {
		const tokenizer = new Tokenizer(tc.input);
		const tokens = tokenizer.Tokenize();
		const parser = new Parser(tokens);
		const ast = parser.Parse();
		const astString = ast.ToString();
		const result = evaluator.Evaluate(ast);

		const astMatches = astString === tc.expectedAST;
		const valMatches = result === tc.expectedVal;

		console.log(`Input:        "${tc.input}" (${tc.description})`);
		console.log(
			`AST:          ${astString} ${astMatches ? "✅" : `❌ (Expected: ${tc.expectedAST})`}`,
		);
		console.log(
			`Evaluated:    ${result} ${valMatches ? "✅" : `❌ (Expected: ${tc.expectedVal})`}`,
		);
		console.log(
			"----------------------------------------------------------------",
		);

		if (!astMatches || !valMatches) {
			allPassed = false;
		}
	}

	if (allPassed) {
		console.log(
			"\n🎉 ALL EDUCATIONAL SPIKE TESTS PASSED! Pratt parsing & AST evaluation verified.\n",
		);
	} else {
		console.error("\n❌ Some educational spike tests failed.\n");
		process.exit(1);
	}
}
