/**
 * FormulaParser.js
 *
 * Parser facade and Ohm-backed parser implementation for Arbor Spreadsheet.
 * Encapsulates all Ohm grammar and CST traversal rules, producing pure ASTNode instances.
 * Ohm is completely hidden behind OhmFormulaParser; no Ohm types escape into the rest of Arbor.
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

// Universal import for Ohm library
const ohmLib =
	typeof ohm !== "undefined"
		? ohm
		: typeof window !== "undefined" && window.ohm
			? window.ohm
			: typeof require !== "undefined"
				? require("./ohm.min.js")
				: null;

/**
 * Base abstract FormulaParser interface/facade.
 */
class FormulaParser {
	/**
	 * Parses formula text and returns a pure ASTNode tree.
	 * @param {string} formulaText
	 * @returns {ASTNode}
	 */
	Parse(formulaText) {
		throw new Error("FormulaParser.Parse() must be implemented by subclass.");
	}
}

/**
 * Concrete Ohm-backed implementation of FormulaParser.
 */
class OhmFormulaParser extends FormulaParser {
	constructor() {
		super();

		if (!ohmLib) {
			throw new Error(
				"Ohm library is not loaded. Ensure ohm.min.js is included.",
			);
		}

		// Coordinate resolver
		this.Resolver = new ReferenceResolver();
		const resolver = this.Resolver;

		// Slices 1-6: Comparisons, Arithmetic, cell references, powers, ranges, functions, booleans, strings
		this.GrammarSource = `
Formula {
  Expression = Comparison

  Comparison
    = Comparison "=" Additive   -- eq
    | Comparison "<>" Additive  -- neq
    | Comparison "<=" Additive  -- lte
    | Comparison ">=" Additive  -- gte
    | Comparison "<" Additive   -- lt
    | Comparison ">" Additive   -- gt
    | Additive

  Additive
    = Additive "+" Multiplicative  -- plus
    | Additive "-" Multiplicative  -- minus
    | Multiplicative

  Multiplicative
    = Multiplicative "*" Power    -- star
    | Multiplicative "/" Power    -- slash
    | Power

  Power
    = Unary "^" Power            -- pow
    | Unary

  Unary
    = "-" Primary                 -- minus
    | "+" Primary                 -- plus
    | Primary

  Primary
    = "(" Expression ")"          -- paren
    | FunctionCall
    | RangeRef
    | cellRef
    | boolean
    | number
    | string

  FunctionCall = funcName "(" ListOf<Expression, ","> ")"
  RangeRef = cellRef ":" cellRef
  cellRef = letter+ digit+
  funcName = letter (alnum | "_" | ".")*
  boolean = caseInsensitive<"true"> | caseInsensitive<"false">
  number  = digit+ ("." digit+)?
  string  = "\\\"" (~"\\\"" any)* "\\\""
}
`;

		this.Grammar = ohmLib.grammar(this.GrammarSource);
		this.Semantics = this.Grammar.createSemantics();

		// Bind operation to transform Ohm CST directly into pure ASTNodes
		this.Semantics.addOperation("ToAST", {
			Expression(expr) {
				return expr.ToAST();
			},
			Comparison_eq(left, _op, right) {
				return new BinaryOpNode("=", left.ToAST(), right.ToAST());
			},
			Comparison_neq(left, _op, right) {
				return new BinaryOpNode("<>", left.ToAST(), right.ToAST());
			},
			Comparison_lte(left, _op, right) {
				return new BinaryOpNode("<=", left.ToAST(), right.ToAST());
			},
			Comparison_gte(left, _op, right) {
				return new BinaryOpNode(">=", left.ToAST(), right.ToAST());
			},
			Comparison_lt(left, _op, right) {
				return new BinaryOpNode("<", left.ToAST(), right.ToAST());
			},
			Comparison_gt(left, _op, right) {
				return new BinaryOpNode(">", left.ToAST(), right.ToAST());
			},
			Additive_plus(left, _op, right) {
				return new BinaryOpNode("+", left.ToAST(), right.ToAST());
			},
			Additive_minus(left, _op, right) {
				return new BinaryOpNode("-", left.ToAST(), right.ToAST());
			},
			Multiplicative_star(left, _op, right) {
				return new BinaryOpNode("*", left.ToAST(), right.ToAST());
			},
			Multiplicative_slash(left, _op, right) {
				return new BinaryOpNode("/", left.ToAST(), right.ToAST());
			},
			Power_pow(left, _op, right) {
				return new BinaryOpNode("^", left.ToAST(), right.ToAST());
			},
			Unary_minus(_op, primary) {
				return new UnaryOpNode("-", primary.ToAST());
			},
			Unary_plus(_op, primary) {
				return new UnaryOpNode("+", primary.ToAST());
			},
			Primary_paren(_openParen, expr, _closeParen) {
				return expr.ToAST();
			},
			FunctionCall(name, _open, args, _close) {
				const fnName = name.sourceString.toUpperCase();
				const argNodes = args.asIteration().children.map((c) => c.ToAST());
				return new FunctionCallNode(fnName, argNodes);
			},
			RangeRef(from, _colon, to) {
				const raw = this.sourceString.toUpperCase().replace(/\s+/g, "");
				const fromStr = from.sourceString.toUpperCase();
				const toStr = to.sourceString.toUpperCase();
				const fromCoords = resolver.CellKeyToCoords(fromStr);
				const toCoords = resolver.CellKeyToCoords(toStr);
				if (!fromCoords || !toCoords) {
					return new ErrorNode("#REF!");
				}
				return new RangeNode(
					raw,
					fromCoords.ColKey,
					fromCoords.RowKey,
					toCoords.ColKey,
					toCoords.RowKey,
				);
			},
			cellRef(_letters, _digits) {
				const raw = this.sourceString.toUpperCase();
				const coords = resolver.CellKeyToCoords(raw);
				if (!coords) {
					return new ErrorNode("#REF!");
				}
				return new CellReferenceNode(
					raw,
					coords.ColKey,
					coords.RowKey,
					coords.ColLetter,
				);
			},
			boolean(_) {
				return new BooleanNode(this.sourceString.toUpperCase() === "TRUE");
			},
			number(_intPart, _decPart, _fracPart) {
				return new NumberNode(parseFloat(this.sourceString));
			},
			string(_open, chars, _close) {
				return new StringNode(chars.sourceString);
			},
		});
	}

	/**
	 * Parses a formula text string into a pure ASTNode representation.
	 * Handles optional leading '='.
	 * @param {string} formulaText
	 * @returns {ASTNode}
	 */
	Parse(formulaText) {
		if (formulaText == null || typeof formulaText !== "string") {
			return new ErrorNode("#ERROR!");
		}

		let text = formulaText.trim();
		if (text.startsWith("=")) {
			text = text.slice(1).trim();
		}

		if (text.length === 0) {
			return new ErrorNode("#ERROR!");
		}

		const matchResult = this.Grammar.match(text);
		if (!matchResult.succeeded()) {
			return new ErrorNode("#ERROR!");
		}

		try {
			return this.Semantics(matchResult).ToAST();
		} catch (err) {
			return new ErrorNode("#ERROR!");
		}
	}
}

// Universal module export (Browser global & Node.js CommonJS)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		FormulaParser,
		OhmFormulaParser,
	};
}
