/**
 * ReferenceResolver.js
 *
 * Pure domain utility for spreadsheet coordinate transformations and reference resolution.
 * Handles bidirectional mapping between zero-based column indices and Excel-style column letters,
 * coordinate parsing, and cell reference validation.
 *
 * Zero DOM dependencies.
 * Strictly follows PascalCase for all properties and methods.
 */

class ReferenceResolver {
	/**
	 * Converts a 0-based column index to an Excel column name (e.g. 0 -> "A", 25 -> "Z", 26 -> "AA").
	 * @param {number} colIndex - 0-based column index
	 * @returns {string}
	 */
	ToColumnName(colIndex) {
		if (
			typeof colIndex !== "number" ||
			colIndex < 0 ||
			!Number.isInteger(colIndex)
		) {
			throw new TypeError(`Invalid column index: ${colIndex}`);
		}

		let colName = "";
		let temp = colIndex + 1; // Convert to 1-based for calculation

		while (temp > 0) {
			const remainder = (temp - 1) % 26;
			colName = String.fromCharCode(65 + remainder) + colName;
			temp = Math.floor((temp - 1) / 26);
		}

		return colName;
	}

	/**
	 * Converts an Excel column name to a 0-based column index (e.g. "A" -> 0, "Z" -> 25, "AA" -> 26).
	 * Case-insensitive.
	 * @param {string} colLetter
	 * @returns {number}
	 */
	ToColumnIndex(colLetter) {
		if (typeof colLetter !== "string" || colLetter.length === 0) {
			throw new TypeError(`Invalid column letter: ${colLetter}`);
		}

		const upper = colLetter.toUpperCase();
		let index = 0;

		for (let i = 0; i < upper.length; i++) {
			const code = upper.charCodeAt(i);
			if (code < 65 || code > 90) {
				throw new Error(`Invalid character in column name: '${upper[i]}'`);
			}
			index = index * 26 + (code - 64);
		}

		return index - 1; // Convert to 0-based
	}

	/**
	 * Formats row and column indices into a canonical cell key string (e.g. rowKey=1, colKey=0 -> "A1").
	 * @param {number} rowKey - 1-based row index
	 * @param {number} colKey - 0-based column index
	 * @returns {string}
	 */
	CoordsToCellKey(rowKey, colKey) {
		const colName = this.ToColumnName(colKey);
		return `${colName}${rowKey}`;
	}

	/**
	 * Parses a cell key string into coordinates (e.g. "A1" -> { RowKey: 1, ColKey: 0, ColLetter: "A" }).
	 * Case-insensitive.
	 * @param {string} cellKey
	 * @returns {{ RowKey: number, ColKey: number, ColLetter: string } | null}
	 */
	CellKeyToCoords(cellKey) {
		if (typeof cellKey !== "string") {
			return null;
		}

		const match = cellKey
			.trim()
			.toUpperCase()
			.match(/^([A-Z]+)([1-9][0-9]*)$/);
		if (!match) {
			return null;
		}

		const colLetter = match[1];
		const rowKey = parseInt(match[2], 10);
		const colKey = this.ToColumnIndex(colLetter);

		return {
			RowKey: rowKey,
			ColKey: colKey,
			ColLetter: colLetter,
		};
	}

	/**
	 * Checks if a string is a valid cell reference format (e.g. "A1", "b12", "AA100").
	 * @param {string} cellKey
	 * @returns {boolean}
	 */
	IsValidCellReference(cellKey) {
		return this.CellKeyToCoords(cellKey) !== null;
	}
}

// Universal module export (Browser global & Node.js CommonJS)
if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		ReferenceResolver,
	};
}
