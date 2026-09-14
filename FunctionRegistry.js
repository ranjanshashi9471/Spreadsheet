/**
 * FunctionRegistry.js
 *
 * Extensible function library and registry for Arbor Spreadsheet.
 * Maintains built-in mathematical, statistical, and aggregate functions,
 * and allows dynamic registration of user-defined functions.
 *
 * Zero DOM dependencies.
 * Strictly follows PascalCase for all properties and methods.
 */

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
				if (typeof item === "string" && item.startsWith("#")) {
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
			if (typeof arg === "string" && arg.startsWith("#")) {
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
					return { Values: [], Error: "#VALUE!" };
				}
			}
		}
	}

	return { Values: values, Error: null };
}

class FunctionRegistry {
	constructor() {
		this.Functions = new Map();
		this.RegisterDefaultFunctions();
	}

	/**
	 * Returns the singleton instance of FunctionRegistry.
	 * @returns {FunctionRegistry}
	 */
	static get Instance() {
		if (!FunctionRegistry._instance) {
			FunctionRegistry._instance = new FunctionRegistry();
		}
		return FunctionRegistry._instance;
	}

	/**
	 * Registers a function implementation with the given name.
	 * @param {string} name
	 * @param {Function} fn
	 */
	RegisterFunction(name, fn) {
		if (!name || typeof name !== "string") {
			throw new TypeError("Function name must be a non-empty string.");
		}
		if (typeof fn !== "function") {
			throw new TypeError(
				"Function implementation must be a callable function.",
			);
		}
		this.Functions.set(name.trim().toUpperCase(), fn);
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
		return this.Functions.delete(name.trim().toUpperCase());
	}

	/**
	 * Lists all registered function names in uppercase.
	 * @returns {string[]}
	 */
	ListFunctions() {
		return Array.from(this.Functions.keys());
	}

	/**
	 * Registers built-in core spreadsheet functions.
	 */
	RegisterDefaultFunctions() {
		// SUM: Sum of numbers, ignoring blanks & text in ranges
		this.RegisterFunction("SUM", (...args) => {
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
		});

		// AVERAGE: Arithmetic mean of numbers; #DIV/0! if count is zero
		this.RegisterFunction("AVERAGE", (...args) => {
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
				return "#DIV/0!";
			}
			return sum / count;
		});

		// MIN: Minimum numeric value; 0 if empty
		this.RegisterFunction("MIN", (...args) => {
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
		});

		// MAX: Maximum numeric value; 0 if empty
		this.RegisterFunction("MAX", (...args) => {
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
		});

		// COUNT: Count of numeric values
		this.RegisterFunction("COUNT", (...args) => {
			const extracted = ExtractValues(args);
			if (extracted.Error) {
				return extracted.Error;
			}
			return extracted.Values.filter((item) => item.IsNumber).length;
		});

		// COUNTA: Count of non-empty values
		this.RegisterFunction("COUNTA", (...args) => {
			for (const arg of args) {
				if (typeof arg === "string" && arg.startsWith("#")) {
					return arg;
				}
				if (Array.isArray(arg)) {
					for (const item of arg) {
						if (typeof item === "string" && item.startsWith("#")) {
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
		});

		// TRUE: Returns logical true
		this.RegisterFunction("TRUE", () => true);

		// FALSE: Returns logical false
		this.RegisterFunction("FALSE", () => false);

		// AND: Returns true if all arguments are truthy, false otherwise
		this.RegisterFunction("AND", (...args) => {
			let count = 0;
			for (const arg of args) {
				if (Array.isArray(arg)) {
					for (const item of arg) {
						if (typeof item === "string" && item.startsWith("#")) {
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
					if (typeof arg === "string" && arg.startsWith("#")) {
						return arg;
					}
					const b = ToBoolean(arg);
					if (b.Error) return b.Error;
					count++;
					if (!b.Value) return false;
				}
			}
			if (count === 0) return "#VALUE!";
			return true;
		});

		// OR: Returns true if any argument is truthy, false otherwise
		this.RegisterFunction("OR", (...args) => {
			let count = 0;
			let hasTrue = false;
			for (const arg of args) {
				if (Array.isArray(arg)) {
					for (const item of arg) {
						if (typeof item === "string" && item.startsWith("#")) {
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
					if (typeof arg === "string" && arg.startsWith("#")) {
						return arg;
					}
					const b = ToBoolean(arg);
					if (b.Error) return b.Error;
					count++;
					if (b.Value) hasTrue = true;
				}
			}
			if (count === 0) return "#VALUE!";
			return hasTrue;
		});

		// NOT: Inverts a logical value
		this.RegisterFunction("NOT", (...args) => {
			if (args.length !== 1) {
				return "#VALUE!";
			}
			const arg = args[0];
			if (typeof arg === "string" && arg.startsWith("#")) {
				return arg;
			}
			const b = ToBoolean(arg);
			if (b.Error) return b.Error;
			return !b.Value;
		});

		// IF: Logical conditional (eager registry fallback)
		this.RegisterFunction(
			"IF",
			(condition, trueVal = true, falseVal = false) => {
				if (typeof condition === "string" && condition.startsWith("#")) {
					return condition;
				}
				const b = ToBoolean(condition);
				if (b.Error) return b.Error;
				return b.Value ? trueVal : falseVal;
			},
		);

		// IFERROR: Returns fallback if value is error (eager registry fallback)
		this.RegisterFunction("IFERROR", (value, fallback) => {
			if (typeof value === "string" && value.startsWith("#")) {
				return fallback;
			}
			return value;
		});
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

// Universal module export (Browser global & Node.js CommonJS)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		FunctionRegistry,
	};
}
