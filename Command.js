/**
 * Command.js
 *
 * Command pattern implementation for Arbor Spreadsheet engine.
 * Encapsulates spreadsheet mutations (edits, clears, formatting) as undoable/redoable operations.
 *
 * Strictly follows PascalCase for all properties and methods.
 */

/**
 * Base abstract Command class.
 */
class Command {
	/**
	 * @param {string} [description="Command"]
	 */
	constructor(description = "Command") {
		this.Description = description;
		this.Timestamp = Date.now();
	}

	/**
	 * Executes the command.
	 */
	Execute() {
		throw new Error("Command.Execute() must be implemented by subclass.");
	}

	/**
	 * Undoes the command, restoring previous state.
	 */
	Undo() {
		throw new Error("Command.Undo() must be implemented by subclass.");
	}

	/**
	 * Redoes the command. Defaults to calling Execute().
	 */
	Redo() {
		this.Execute();
	}
}

/**
 * Command to set a single cell's value and/or style.
 */
class SetCellCommand extends Command {
	/**
	 * @param {SpreadsheetModel} spreadsheetModel
	 * @param {number} rowKey
	 * @param {number|string} colKey
	 * @param {*} newValue
	 * @param {object|null} [newStyle=null]
	 * @param {*} [oldValue=undefined]
	 * @param {object|null} [oldStyle=undefined]
	 * @param {string} [description="Set Cell"]
	 */
	constructor(
		spreadsheetModel,
		rowKey,
		colKey,
		newValue,
		newStyle = null,
		oldValue = undefined,
		oldStyle = undefined,
		description = "Set Cell",
	) {
		super(description);
		this.SpreadsheetModel = spreadsheetModel;
		this.RowKey = rowKey;
		this.ColKey = colKey;
		this.NewValue = newValue;
		this.OldValue = oldValue;
		this.NewStyle = newStyle;
		this.OldStyle = oldStyle;
	}

	/**
	 * Executes the cell update and updates DOM if mounted.
	 */
	Execute() {
		if (!this.SpreadsheetModel) return;

		// Capture old value and style if not already provided
		if (this.OldValue === undefined || this.OldStyle === undefined) {
			const prevCell = this.SpreadsheetModel.GetCell(this.RowKey, this.ColKey);
			if (this.OldValue === undefined) {
				this.OldValue = prevCell ? prevCell.value : "";
			}
			if (this.OldStyle === undefined) {
				this.OldStyle = prevCell && prevCell.style ? { ...prevCell.style } : {};
			}
		}

		this.SpreadsheetModel.SetCell(
			this.RowKey,
			this.ColKey,
			this.NewValue,
			this.NewStyle !== null ? this.NewStyle : undefined,
		);

		this.UpdateDOM(this.NewValue, this.NewStyle);
	}

	/**
	 * Undoes the cell update, reverting to previous value and style.
	 */
	Undo() {
		if (!this.SpreadsheetModel) return;

		this.SpreadsheetModel.SetCell(
			this.RowKey,
			this.ColKey,
			this.OldValue,
			this.OldStyle || {},
		);

		this.UpdateDOM(this.OldValue, this.OldStyle);
	}

	/**
	 * Redoes the command.
	 */
	Redo() {
		this.Execute();
	}

	/**
	 * Updates the DOM input and table cell if present in current document.
	 * @param {*} value
	 * @param {object|null} style
	 */
	UpdateDOM(value, style) {
		if (
			typeof document === "undefined" ||
			typeof document.querySelector !== "function"
		)
			return;

		if (
			this.SpreadsheetModel?.GridRenderer &&
			typeof this.SpreadsheetModel.GridRenderer.UpdateCell === "function"
		) {
			this.SpreadsheetModel.GridRenderer.UpdateCell(
				this.RowKey,
				this.ColKey,
				value,
				style,
			);
			return;
		}

		const currentSheet = this.SpreadsheetModel?.CurrentSpreadsheet;
		if (!currentSheet) return;

		const columns = currentSheet.Columns || currentSheet.columns || [];
		const colIdx =
			typeof this.ColKey === "number"
				? this.ColKey
				: columns.indexOf(this.ColKey);

		if (value !== undefined) {
			const input = document.querySelector(
				`input[data-rowno="${this.RowKey}"][data-colno="${colIdx}"]`,
			);
			if (input) {
				input.value = value ?? "";
			}
		}

		if (style !== undefined) {
			const td = document.querySelector(
				`tr[data-rowno="${this.RowKey}"] td[data-colno="${colIdx}"]`,
			);
			if (td) {
				td.style.backgroundColor = style?.backgroundColor || "";
				if (style) {
					Object.assign(td.style, style);
				}
			}
		}
	}
}

/**
 * Command to clear a collection or range of cells.
 */
class ClearRangeCommand extends Command {
	/**
	 * @param {SpreadsheetModel} spreadsheetModel
	 * @param {Array<{ RowKey: number, ColKey: number|string, OldValue?: *, OldStyle?: object }>} [cellEntries=[]]
	 * @param {string} [description="Clear Range"]
	 */
	constructor(spreadsheetModel, cellEntries = [], description = "Clear Range") {
		super(description);
		this.SpreadsheetModel = spreadsheetModel;
		this.CellEntries = cellEntries;
	}

	/**
	 * Clears each cell in the range, recording prior values and styles.
	 */
	Execute() {
		if (!this.SpreadsheetModel) return;

		for (let i = 0; i < this.CellEntries.length; i++) {
			const entry = this.CellEntries[i];
			if (entry.OldValue === undefined || entry.OldStyle === undefined) {
				const prev = this.SpreadsheetModel.GetCell(entry.RowKey, entry.ColKey);
				if (entry.OldValue === undefined) {
					entry.OldValue = prev ? prev.value : "";
				}
				if (entry.OldStyle === undefined) {
					entry.OldStyle = prev && prev.style ? { ...prev.style } : {};
				}
			}

			this.SpreadsheetModel.SetCell(
				entry.RowKey,
				entry.ColKey,
				"",
				entry.OldStyle || {},
			);

			this.UpdateDOM(entry.RowKey, entry.ColKey, "");
		}
	}

	/**
	 * Restores every cleared cell to its previous value and style.
	 */
	Undo() {
		if (!this.SpreadsheetModel) return;

		for (let i = 0; i < this.CellEntries.length; i++) {
			const entry = this.CellEntries[i];
			this.SpreadsheetModel.SetCell(
				entry.RowKey,
				entry.ColKey,
				entry.OldValue,
				entry.OldStyle || {},
			);

			this.UpdateDOM(
				entry.RowKey,
				entry.ColKey,
				entry.OldValue,
				entry.OldStyle,
			);
		}
	}

	/**
	 * Redoes the clear operation.
	 */
	Redo() {
		this.Execute();
	}

	/**
	 * Updates the DOM input and cell if present.
	 * @param {number} rowKey
	 * @param {number|string} colKey
	 * @param {*} value
	 * @param {object} [style]
	 */
	UpdateDOM(rowKey, colKey, value, style) {
		if (
			typeof document === "undefined" ||
			typeof document.querySelector !== "function"
		)
			return;

		if (
			this.SpreadsheetModel?.GridRenderer &&
			typeof this.SpreadsheetModel.GridRenderer.UpdateCell === "function"
		) {
			this.SpreadsheetModel.GridRenderer.UpdateCell(
				rowKey,
				colKey,
				value,
				style,
			);
			return;
		}

		const currentSheet = this.SpreadsheetModel?.CurrentSpreadsheet;
		if (!currentSheet) return;

		const columns = currentSheet.Columns || currentSheet.columns || [];
		const colIdx =
			typeof colKey === "number" ? colKey : columns.indexOf(colKey);

		if (value !== undefined) {
			const input = document.querySelector(
				`input[data-rowno="${rowKey}"][data-colno="${colIdx}"]`,
			);
			if (input) {
				input.value = value ?? "";
			}
		}

		if (style !== undefined) {
			const td = document.querySelector(
				`tr[data-rowno="${rowKey}"] td[data-colno="${colIdx}"]`,
			);
			if (td) {
				td.style.backgroundColor = style?.backgroundColor || "";
				if (style) {
					Object.assign(td.style, style);
				}
			}
		}
	}
}

/**
 * Composite command that executes a batch of commands as an atomic transaction.
 */
class CompoundCommand extends Command {
	/**
	 * @param {Array<Command>} [commands=[]]
	 * @param {string} [description="Compound Command"]
	 */
	constructor(commands = [], description = "Compound Command") {
		super(description);
		this.Commands = commands;
	}

	/**
	 * Appends a sub-command to the compound batch.
	 * @param {Command} command
	 */
	AddCommand(command) {
		this.Commands.push(command);
	}

	/**
	 * Executes all sub-commands in forward order.
	 */
	Execute() {
		for (let i = 0; i < this.Commands.length; i++) {
			this.Commands[i].Execute();
		}
	}

	/**
	 * Undoes all sub-commands in reverse order.
	 */
	Undo() {
		for (let i = this.Commands.length - 1; i >= 0; i--) {
			this.Commands[i].Undo();
		}
	}

	/**
	 * Redoes all sub-commands in forward order.
	 */
	Redo() {
		for (let i = 0; i < this.Commands.length; i++) {
			this.Commands[i].Redo();
		}
	}
}

// Browser & Node module export
if (typeof window !== "undefined") {
	window.Command = Command;
	window.SetCellCommand = SetCellCommand;
	window.ClearRangeCommand = ClearRangeCommand;
	window.CompoundCommand = CompoundCommand;
}

if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		Command,
		SetCellCommand,
		ClearRangeCommand,
		CompoundCommand,
	};
}
