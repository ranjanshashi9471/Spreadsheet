/**
 * FunctionRegistry.js
 *
 * Extensible function library and registry for Arbor Spreadsheet.
 * Maintains built-in mathematical, statistical, and aggregate functions,
 * and allows dynamic registration of user-defined functions.
 *
 * Enforces Invariant 6: FunctionRegistry contains eager functions only.
 * Special syntactic forms (IF, IFERROR) are evaluated directly in FormulaEvaluator.
 *
 * Zero DOM dependencies.
 * Strictly follows PascalCase for all properties and methods.
 */

// Universal import for Constants (Browser global fallback / Node CommonJS)
const { FormulaErrors, FormulaSpecialForms, IsFormulaError } =
	typeof require !== "undefined"
		? require("./Constants.js")
		: {
				FormulaErrors: window.FormulaErrors,
				FormulaSpecialForms: window.FormulaSpecialForms,
				IsFormulaError: window.IsFormulaError,
			};

/**
 * Extracts and classifies argument values for aggregate functions.
 * Adheres to standard spreadsheet semantics:
 * - Direct scalar non-numeric strings trigger #VALUE!
 * - Non-numeric strings inside ranges/arrays are ignored
 * - Error tokens (#DIV/0!, #REF!, etc.) are propagated immediately
 * - Direct booleans evaluate to 1 (true) or 0 (false); booleans in ranges are ignored
 * @param {Array<*>} args
 * @returns {{ Values: Array<{ Value: *, IsNumber: boolean, IsFromRange: boolean }>, Error: string|null }}
 */
function ExtractValues(args) {
	const values = [];

	for (const arg of args) {
		if (Array.isArray(arg)) {
			// Values originating from a Range
			for (const item of arg) {
				if (item === null || item === undefined || item === "") {
					continue;
				}
				if (IsFormulaError(item)) {
					return { Values: [], Error: item };
				}
				if (typeof item === "number" && !Number.isNaN(item)) {
					values.push({ Value: item, IsNumber: true, IsFromRange: true });
				} else if (typeof item === "string") {
					const parsed = Number(item);
					if (!Number.isNaN(parsed)) {
						values.push({ Value: parsed, IsNumber: true, IsFromRange: true });
					} else {
						values.push({ Value: item, IsNumber: false, IsFromRange: true });
					}
				} else if (typeof item === "boolean") {
					values.push({ Value: item, IsNumber: false, IsFromRange: true });
				}
			}
		} else {
			// Direct scalar argument
			if (arg === null || arg === undefined || arg === "") {
				continue;
			}
			if (IsFormulaError(arg)) {
				return { Values: [], Error: arg };
			}
			if (typeof arg === "number" && !Number.isNaN(arg)) {
				values.push({ Value: arg, IsNumber: true, IsFromRange: false });
			} else if (typeof arg === "boolean") {
				values.push({ Value: arg ? 1 : 0, IsNumber: true, IsFromRange: false });
			} else if (typeof arg === "string") {
				const parsed = Number(arg);
				if (!Number.isNaN(parsed)) {
					values.push({ Value: parsed, IsNumber: true, IsFromRange: false });
				} else {
					return { Values: [], Error: FormulaErrors.Value };
				}
			}
		}
	}

	return { Values: values, Error: null };
}

class FunctionRegistry {
	constructor() {
		this.Functions = new Map();
		this.Metadata = new Map();
		this.RegisterDefaultFunctions();
	}

	/**
	 * Returns the singleton instance of FunctionRegistry.
	 * @deprecated Use dependency injection with new FunctionRegistry() instead of the global singleton.
	 * @returns {FunctionRegistry}
	 */
	static get Instance() {
		if (!FunctionRegistry._instance) {
			FunctionRegistry._instance = new FunctionRegistry();
		}
		return FunctionRegistry._instance;
	}

	/**
	 * Registers a function implementation with the given name and optional metadata.
	 * Enforces special-form shadowing protection and boundary arity checking.
	 * @param {string} name
	 * @param {Function} fn
	 * @param {object} [metadata={}]
	 */
	RegisterFunction(name, fn, metadata = {}) {
		if (!name || typeof name !== "string") {
			throw new TypeError("Function name must be a non-empty string.");
		}
		if (typeof fn !== "function") {
			throw new TypeError(
				"Function implementation must be a callable function.",
			);
		}

		const upper = name.trim().toUpperCase();
		if (FormulaSpecialForms && FormulaSpecialForms.has(upper)) {
			throw new Error(
				`Cannot register '${name}': special syntactic forms are handled directly by FormulaEvaluator.`,
			);
		}

		const wrapped = (...args) => {
			if (metadata.MinArgs !== undefined && args.length < metadata.MinArgs) {
				return FormulaErrors.Value;
			}
			if (metadata.MaxArgs !== undefined && args.length > metadata.MaxArgs) {
				return FormulaErrors.Value;
			}
			return fn(...args);
		};

		this.Functions.set(upper, wrapped);
		this.Metadata.set(upper, Object.freeze({ ...metadata }));
	}

	/**
	 * Retrieves a registered function by name. Case-insensitive.
	 * @param {string} name
	 * @returns {Function|null}
	 */
	GetFunction(name) {
		if (!name || typeof name !== "string") {
			return null;
		}
		return this.Functions.get(name.trim().toUpperCase()) || null;
	}

	/**
	 * Checks whether a function is registered. Case-insensitive.
	 * @param {string} name
	 * @returns {boolean}
	 */
	HasFunction(name) {
		return this.GetFunction(name) !== null;
	}

	/**
	 * Unregisters a function by name. Case-insensitive.
	 * @param {string} name
	 * @returns {boolean}
	 */
	UnregisterFunction(name) {
		if (!name || typeof name !== "string") {
			return false;
		}
		const upper = name.trim().toUpperCase();
		this.Metadata.delete(upper);
		return this.Functions.delete(upper);
	}

	/**
	 * Retrieves metadata for a registered function. Case-insensitive.
	 * @param {string} name
	 * @returns {object|null}
	 */
	GetMetadata(name) {
		if (!name || typeof name !== "string") {
			return null;
		}
		return this.Metadata.get(name.trim().toUpperCase()) || null;
	}

	/**
	 * Lists all registered function names in alphabetical order, optionally filtered by category.
	 * @param {string|null} [category=null]
	 * @returns {string[]}
	 */
	ListFunctions(category = null) {
		let names = Array.from(this.Functions.keys());
		if (category) {
			const targetCat = category.trim().toUpperCase();
			names = names.filter((name) => {
				const meta = this.Metadata.get(name);
				return (
					meta &&
					meta.Category &&
					meta.Category.trim().toUpperCase() === targetCat
				);
			});
		}
		return names.sort();
	}

	/**
	 * Registers built-in core spreadsheet functions.
	 */
	RegisterDefaultFunctions() {
		// ==========================================
		// Mathematical Functions
		// ==========================================

		// ABS: Absolute value of a number
		this.RegisterFunction(
			"ABS",
			(arg) => {
				if (IsFormulaError(arg)) return arg;
				if (arg === null || arg === undefined || arg === "") {
					return FormulaErrors.Value;
				}
				if (typeof arg === "boolean") return FormulaErrors.Value;
				const num = Number(arg);
				if (Number.isNaN(num)) return FormulaErrors.Value;
				return Math.abs(num);
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Math",
				Description: "Absolute value of a number",
			},
		);

		// INT: Rounds a number down to the nearest integer
		this.RegisterFunction(
			"INT",
			(arg) => {
				if (IsFormulaError(arg)) return arg;
				if (typeof arg === "boolean") return FormulaErrors.Value;
				if (arg === null || arg === undefined || arg === "") {
					return FormulaErrors.Value;
				}
				const num = Number(arg);
				if (Number.isNaN(num)) return FormulaErrors.Value;
				return Math.floor(num);
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Math",
				Description: "Rounds a number down to the nearest integer",
			},
		);

		// MOD: Returns the remainder from division (spreadsheet floor modulo: n - d * floor(n/d))
		this.RegisterFunction(
			"MOD",
			(nArg, dArg) => {
				if (IsFormulaError(nArg)) return nArg;
				if (IsFormulaError(dArg)) return dArg;
				if (typeof nArg === "boolean" || typeof dArg === "boolean") {
					return FormulaErrors.Value;
				}
				if (
					nArg === null ||
					nArg === undefined ||
					nArg === "" ||
					dArg === null ||
					dArg === undefined ||
					dArg === ""
				) {
					return FormulaErrors.Value;
				}
				const n = Number(nArg);
				const d = Number(dArg);
				if (Number.isNaN(n) || Number.isNaN(d)) return FormulaErrors.Value;
				if (d === 0) return FormulaErrors.DivZero;
				return n - d * Math.floor(n / d);
			},
			{
				MinArgs: 2,
				MaxArgs: 2,
				Category: "Math",
				Description:
					"Returns remainder from division (spreadsheet floor modulo)",
			},
		);

		// POWER: Returns the result of a number raised to a power
		this.RegisterFunction(
			"POWER",
			(baseArg, expArg) => {
				if (IsFormulaError(baseArg)) return baseArg;
				if (IsFormulaError(expArg)) return expArg;
				if (typeof baseArg === "boolean" || typeof expArg === "boolean") {
					return FormulaErrors.Value;
				}
				if (
					baseArg === null ||
					baseArg === undefined ||
					baseArg === "" ||
					expArg === null ||
					expArg === undefined ||
					expArg === ""
				) {
					return FormulaErrors.Value;
				}
				const base = Number(baseArg);
				const exp = Number(expArg);
				if (Number.isNaN(base) || Number.isNaN(exp)) return FormulaErrors.Value;
				if (base === 0 && exp < 0) return FormulaErrors.DivZero;
				const res = Math.pow(base, exp);
				if (Number.isNaN(res) || !Number.isFinite(res))
					return FormulaErrors.Num;
				return res;
			},
			{
				MinArgs: 2,
				MaxArgs: 2,
				Category: "Math",
				Description: "Returns the result of a number raised to a power",
			},
		);

		// PRODUCT: Multiplies all numbers given as arguments
		this.RegisterFunction(
			"PRODUCT",
			(...args) => {
				const extracted = ExtractValues(args);
				if (extracted.Error) {
					return extracted.Error;
				}
				const numbers = extracted.Values.filter((item) => item.IsNumber);
				if (numbers.length === 0) return 0;
				let prod = 1;
				for (const item of numbers) {
					prod *= item.Value;
				}
				return prod;
			},
			{
				MinArgs: 1,
				Category: "Math",
				Description: "Multiplies all numbers given as arguments",
			},
		);

		// ROUND: Rounds a number to a specified number of digits
		this.RegisterFunction(
			"ROUND",
			(numArg, digitsArg = 0) => {
				if (IsFormulaError(numArg)) return numArg;
				if (IsFormulaError(digitsArg)) return digitsArg;
				if (typeof numArg === "boolean" || typeof digitsArg === "boolean") {
					return FormulaErrors.Value;
				}
				if (numArg === null || numArg === undefined || numArg === "") {
					return FormulaErrors.Value;
				}
				const num = Number(numArg);
				const digits = Number(digitsArg);
				if (Number.isNaN(num) || Number.isNaN(digits))
					return FormulaErrors.Value;
				const factor = Math.pow(10, digits);
				return Math.round(num * factor) / factor;
			},
			{
				MinArgs: 1,
				MaxArgs: 2,
				Category: "Math",
				Description: "Rounds a number to a specified number of digits",
			},
		);

		// SQRT: Returns the positive square root
		this.RegisterFunction(
			"SQRT",
			(arg) => {
				if (IsFormulaError(arg)) return arg;
				if (typeof arg === "boolean") return FormulaErrors.Value;
				if (arg === null || arg === undefined || arg === "") {
					return FormulaErrors.Value;
				}
				const num = Number(arg);
				if (Number.isNaN(num)) return FormulaErrors.Value;
				if (num < 0) return FormulaErrors.Num;
				return Math.sqrt(num);
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Math",
				Description: "Returns a positive square root",
			},
		);

		// SUM: Sum of numbers, ignoring blanks & text in ranges
		this.RegisterFunction(
			"SUM",
			(...args) => {
				const extracted = ExtractValues(args);
				if (extracted.Error) {
					return extracted.Error;
				}
				let sum = 0;
				for (const item of extracted.Values) {
					if (item.IsNumber) {
						sum += item.Value;
					}
				}
				return sum;
			},
			{
				MinArgs: 1,
				Category: "Math",
				Description: "Sum of numbers, ignoring blanks & text in ranges",
			},
		);

		// ==========================================
		// Statistical Functions
		// ==========================================

		// AVERAGE: Arithmetic mean of numbers; #DIV/0! if count is zero
		this.RegisterFunction(
			"AVERAGE",
			(...args) => {
				const extracted = ExtractValues(args);
				if (extracted.Error) {
					return extracted.Error;
				}
				let sum = 0;
				let count = 0;
				for (const item of extracted.Values) {
					if (item.IsNumber) {
						sum += item.Value;
						count++;
					}
				}
				if (count === 0) {
					return FormulaErrors.DivZero;
				}
				return sum / count;
			},
			{
				MinArgs: 1,
				Category: "Statistical",
				Description: "Arithmetic mean of numbers",
			},
		);

		// MIN: Minimum numeric value; 0 if empty
		this.RegisterFunction(
			"MIN",
			(...args) => {
				const extracted = ExtractValues(args);
				if (extracted.Error) {
					return extracted.Error;
				}
				const numbers = extracted.Values.filter((item) => item.IsNumber).map(
					(item) => item.Value,
				);
				if (numbers.length === 0) {
					return 0;
				}
				return Math.min(...numbers);
			},
			{
				MinArgs: 1,
				Category: "Statistical",
				Description: "Minimum numeric value",
			},
		);

		// MAX: Maximum numeric value; 0 if empty
		this.RegisterFunction(
			"MAX",
			(...args) => {
				const extracted = ExtractValues(args);
				if (extracted.Error) {
					return extracted.Error;
				}
				const numbers = extracted.Values.filter((item) => item.IsNumber).map(
					(item) => item.Value,
				);
				if (numbers.length === 0) {
					return 0;
				}
				return Math.max(...numbers);
			},
			{
				MinArgs: 1,
				Category: "Statistical",
				Description: "Maximum numeric value",
			},
		);

		// COUNT: Count of numeric values
		this.RegisterFunction(
			"COUNT",
			(...args) => {
				const extracted = ExtractValues(args);
				if (extracted.Error) {
					return extracted.Error;
				}
				return extracted.Values.filter((item) => item.IsNumber).length;
			},
			{
				MinArgs: 1,
				Category: "Statistical",
				Description: "Count of numeric values",
			},
		);

		// COUNTA: Count of non-empty values
		this.RegisterFunction(
			"COUNTA",
			(...args) => {
				for (const arg of args) {
					if (IsFormulaError(arg)) {
						return arg;
					}
					if (Array.isArray(arg)) {
						for (const item of arg) {
							if (IsFormulaError(item)) {
								return item;
							}
						}
					}
				}

				let count = 0;
				for (const arg of args) {
					if (Array.isArray(arg)) {
						for (const item of arg) {
							if (item !== null && item !== undefined && item !== "") {
								count++;
							}
						}
					} else if (arg !== null && arg !== undefined && arg !== "") {
						count++;
					}
				}
				return count;
			},
			{
				MinArgs: 1,
				Category: "Statistical",
				Description: "Count of non-empty values",
			},
		);

		// ==========================================
		// Logical Functions (Eager Only)
		// ==========================================

		// TRUE: Returns logical true
		this.RegisterFunction("TRUE", () => true, {
			MinArgs: 0,
			MaxArgs: 0,
			Category: "Logical",
			Description: "Logical constant TRUE",
		});

		// FALSE: Returns logical false
		this.RegisterFunction("FALSE", () => false, {
			MinArgs: 0,
			MaxArgs: 0,
			Category: "Logical",
			Description: "Logical constant FALSE",
		});

		// AND: Returns true if all arguments are truthy, false otherwise
		this.RegisterFunction(
			"AND",
			(...args) => {
				let count = 0;
				for (const arg of args) {
					if (Array.isArray(arg)) {
						for (const item of arg) {
							if (IsFormulaError(item)) {
								return item;
							}
							if (typeof item === "boolean") {
								count++;
								if (!item) return false;
							} else if (typeof item === "number") {
								count++;
								if (item === 0) return false;
							}
						}
					} else {
						if (IsFormulaError(arg)) {
							return arg;
						}
						const b = ToBoolean(arg);
						if (b.Error) return b.Error;
						count++;
						if (!b.Value) return false;
					}
				}
				if (count === 0) return FormulaErrors.Value;
				return true;
			},
			{
				MinArgs: 1,
				Category: "Logical",
				Description: "Logical AND across all arguments",
			},
		);

		// OR: Returns true if any argument is truthy, false otherwise
		this.RegisterFunction(
			"OR",
			(...args) => {
				let count = 0;
				let hasTrue = false;
				for (const arg of args) {
					if (Array.isArray(arg)) {
						for (const item of arg) {
							if (IsFormulaError(item)) {
								return item;
							}
							if (typeof item === "boolean") {
								count++;
								if (item) hasTrue = true;
							} else if (typeof item === "number") {
								count++;
								if (item !== 0) hasTrue = true;
							}
						}
					} else {
						if (IsFormulaError(arg)) {
							return arg;
						}
						const b = ToBoolean(arg);
						if (b.Error) return b.Error;
						count++;
						if (b.Value) hasTrue = true;
					}
				}
				if (count === 0) return FormulaErrors.Value;
				return hasTrue;
			},
			{
				MinArgs: 1,
				Category: "Logical",
				Description: "Logical OR across all arguments",
			},
		);

		// NOT: Inverts a logical value
		this.RegisterFunction(
			"NOT",
			(arg) => {
				if (IsFormulaError(arg)) {
					return arg;
				}
				const b = ToBoolean(arg);
				if (b.Error) return b.Error;
				return !b.Value;
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Logical",
				Description: "Inverts a logical value",
			},
		);

		// ==========================================
		// Text Functions
		// ==========================================

		// CONCATENATE: Joins several text strings into one string
		this.RegisterFunction(
			"CONCATENATE",
			(...args) => {
				let result = "";
				for (const arg of args) {
					if (Array.isArray(arg)) {
						for (const item of arg) {
							if (IsFormulaError(item)) return item;
							if (item !== null && item !== undefined) {
								result += String(item);
							}
						}
					} else {
						if (IsFormulaError(arg)) return arg;
						if (arg !== null && arg !== undefined) {
							result += String(arg);
						}
					}
				}
				return result;
			},
			{
				MinArgs: 1,
				Category: "Text",
				Description: "Joins several text strings into one string",
			},
		);

		// LEN: Returns the number of characters in a text string
		this.RegisterFunction(
			"LEN",
			(arg) => {
				if (IsFormulaError(arg)) return arg;
				if (arg === null || arg === undefined) return 0;
				return String(arg).length;
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Text",
				Description: "Returns the number of characters in a text string",
			},
		);

		// TRIM: Removes extra spaces from text (leading/trailing and multiple internal spaces)
		this.RegisterFunction(
			"TRIM",
			(arg) => {
				if (IsFormulaError(arg)) return arg;
				if (arg === null || arg === undefined) return "";
				return String(arg).trim().replace(/\s+/g, " ");
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Text",
				Description: "Removes leading, trailing, and repeated spaces from text",
			},
		);

		// UPPER: Converts text to uppercase
		this.RegisterFunction(
			"UPPER",
			(arg) => {
				if (IsFormulaError(arg)) return arg;
				if (arg === null || arg === undefined) return "";
				return String(arg).toUpperCase();
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Text",
				Description: "Converts text to uppercase",
			},
		);

		// LOWER: Converts text to lowercase
		this.RegisterFunction(
			"LOWER",
			(arg) => {
				if (IsFormulaError(arg)) return arg;
				if (arg === null || arg === undefined) return "";
				return String(arg).toLowerCase();
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Text",
				Description: "Converts text to lowercase",
			},
		);

		// ==========================================
		// Information Functions
		// ==========================================

		// ISNUMBER: Checks whether a value is a number
		this.RegisterFunction(
			"ISNUMBER",
			(arg) => {
				return typeof arg === "number" && !Number.isNaN(arg);
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Information",
				Description: "Checks whether a value is a number",
			},
		);

		// ISTEXT: Checks whether a value is text (excluding formula errors)
		this.RegisterFunction(
			"ISTEXT",
			(arg) => {
				return typeof arg === "string" && !IsFormulaError(arg);
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Information",
				Description: "Checks whether a value is text",
			},
		);

		// ISBLANK: Checks whether a reference or value is empty
		this.RegisterFunction(
			"ISBLANK",
			(arg) => {
				return arg === null || arg === undefined || arg === "";
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Information",
				Description: "Checks whether a value is empty",
			},
		);

		// ISERROR: Checks whether a value is an error token
		this.RegisterFunction(
			"ISERROR",
			(arg) => {
				return IsFormulaError(arg);
			},
			{
				MinArgs: 1,
				MaxArgs: 1,
				Category: "Information",
				Description: "Checks whether a value is a formula error",
			},
		);
	}
}

/**
 * Converts a value to a boolean following standard spreadsheet truthiness rules.
 * @param {*} val
 * @returns {{ Value?: boolean, Error?: string }}
 */
function ToBoolean(val) {
	if (typeof val === "boolean") {
		return { Value: val };
	}
	if (typeof val === "number") {
		return { Value: val !== 0 };
	}
	if (typeof val === "string") {
		if (IsFormulaError(val)) {
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
		return { Error: FormulaErrors.Value };
	}
	return { Error: FormulaErrors.Value };
}

// Universal module export (Browser global & Node.js CommonJS)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		FunctionRegistry,
		ExtractValues,
		ToBoolean,
	};
}
