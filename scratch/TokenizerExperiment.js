/**
 * scratch/TokenizerExperiment.js
 *
 * Educational Spike: Isolated manual lexical analysis (tokenization) experiment.
 * Demonstrates character-by-character scanning, number lexing, operator classification,
 * and token stream production for arithmetic expressions.
 *
 * Strictly follows PascalCase for all properties and methods.
 */

const TokenType = Object.freeze({
	NUMBER: "NUMBER",
	PLUS: "PLUS",
	MINUS: "MINUS",
	STAR: "STAR",
	SLASH: "SLASH",
	LPAREN: "LPAREN",
	RPAREN: "RPAREN",
	EOF: "EOF",
});

class Token {
	/**
	 * @param {string} type
	 * @param {*} value
	 * @param {number} position
	 */
	constructor(type, value, position) {
		this.Type = type;
		this.Value = value;
		this.Position = position;
	}

	ToString() {
		return `${this.Type}(${this.Value})`;
	}
}

class Tokenizer {
	/**
	 * @param {string} input
	 */
	constructor(input) {
		this.Input = input || "";
		this.Position = 0;
		this.Length = this.Input.length;
	}

	/**
	 * Looks ahead at character at current position + offset without advancing.
	 * @param {number} [offset=0]
	 * @returns {string}
	 */
	Peek(offset = 0) {
		const target = this.Position + offset;
		if (target >= this.Length) return "\0";
		return this.Input[target];
	}

	/**
	 * Consumes and returns current character, advancing position.
	 * @returns {string}
	 */
	Advance() {
		if (this.Position >= this.Length) return "\0";
		const ch = this.Input[this.Position];
		this.Position++;
		return ch;
	}

	/**
	 * Skips whitespace characters (spaces, tabs, newlines).
	 */
	SkipWhitespace() {
		while (this.Position < this.Length) {
			const ch = this.Peek();
			if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
				this.Advance();
			} else {
				break;
			}
		}
	}

	/**
	 * Scans a numeric literal (integer or floating point).
	 * @returns {Token}
	 */
	ReadNumber() {
		const startPos = this.Position;
		let numStr = "";
		let hasDecimal = false;

		while (this.Position < this.Length) {
			const ch = this.Peek();
			if (ch >= "0" && ch <= "9") {
				numStr += this.Advance();
			} else if (
				ch === "." &&
				!hasDecimal &&
				this.Peek(1) >= "0" &&
				this.Peek(1) <= "9"
			) {
				hasDecimal = true;
				numStr += this.Advance();
			} else {
				break;
			}
		}

		return new Token(TokenType.NUMBER, parseFloat(numStr), startPos);
	}

	/**
	 * Reads the next token from the character stream.
	 * @returns {Token}
	 */
	GetNextToken() {
		this.SkipWhitespace();

		if (this.Position >= this.Length) {
			return new Token(TokenType.EOF, null, this.Position);
		}

		const startPos = this.Position;
		const ch = this.Peek();

		// Numbers
		if (
			(ch >= "0" && ch <= "9") ||
			(ch === "." && this.Peek(1) >= "0" && this.Peek(1) <= "9")
		) {
			return this.ReadNumber();
		}

		// Single character operators & punctuation
		this.Advance();
		switch (ch) {
			case "+":
				return new Token(TokenType.PLUS, "+", startPos);
			case "-":
				return new Token(TokenType.MINUS, "-", startPos);
			case "*":
				return new Token(TokenType.STAR, "*", startPos);
			case "/":
				return new Token(TokenType.SLASH, "/", startPos);
			case "(":
				return new Token(TokenType.LPAREN, "(", startPos);
			case ")":
				return new Token(TokenType.RPAREN, ")", startPos);
			default:
				throw new Error(`Unexpected character '${ch}' at position ${startPos}`);
		}
	}

	/**
	 * Tokenizes the entire input string into an array of tokens.
	 * @returns {Array<Token>}
	 */
	Tokenize() {
		const tokens = [];
		while (true) {
			const token = this.GetNextToken();
			tokens.push(token);
			if (token.Type === TokenType.EOF) {
				break;
			}
		}
		return tokens;
	}
}

// Export for use in ParserExperiment
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		TokenType,
		Token,
		Tokenizer,
	};
}

// Standalone execution demo
if (typeof require !== "undefined" && require.main === module) {
	console.log("=== Educational Spike: Tokenizer Experiment ===");

	const expressions = [
		"10 + 20 * 3",
		"(10 + 20) * 3",
		"-10 + 25",
		"100 / 4 - 5.5",
	];

	for (const expr of expressions) {
		const tokenizer = new Tokenizer(expr);
		const tokens = tokenizer.Tokenize();
		console.log(`\nExpression: "${expr}"`);
		console.log(
			`Tokens (${tokens.length}): [ ${tokens.map((t) => t.ToString()).join(", ")} ]`,
		);
	}
	console.log("\nTokenizer experiment completed successfully! ✅");
}
