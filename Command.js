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
	 * Executes the cell update on the SpreadsheetModel.
	 */
	Execute() {
		if (!this.SpreadsheetModel) return;

		// Capture old value and style if not already provided
		if (this.OldValue === undefined || this.OldStyle === undefined) {
			const prevCell = this.SpreadsheetModel.GetCell(this.RowKey, this.ColKey);
			if (this.OldValue === undefined) {
				this.OldValue = prevCell
					? (prevCell.Value ?? prevCell.value ?? "")
					: "";
			}
			if (this.OldStyle === undefined) {
				const prevStyle = prevCell ? (prevCell.Style ?? prevCell.style) : null;
				this.OldStyle = prevStyle ? { ...prevStyle } : {};
			}
		}

		const valueToSet =
			this.NewValue !== undefined
				? this.NewValue
				: this.OldValue !== undefined
					? this.OldValue
					: "";
		const styleToSet =
			this.NewStyle !== null && this.NewStyle !== undefined
				? this.NewStyle
				: this.OldStyle || {};

		this.SpreadsheetModel.SetCell(
			this.RowKey,
			this.ColKey,
			valueToSet,
			styleToSet,
		);
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
	}

	/**
	 * Redoes the command.
	 */
	Redo() {
		this.Execute();
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
					entry.OldValue = prev ? (prev.Value ?? prev.value ?? "") : "";
				}
				if (entry.OldStyle === undefined) {
					const prevStyle = prev ? (prev.Style ?? prev.style) : null;
					entry.OldStyle = prevStyle ? { ...prevStyle } : {};
				}
			}
		}

		this.SpreadsheetModel.ClearCells(this.CellEntries);
	}

	/**
	 * Restores every cleared cell to its previous value and style.
	 * Executes within a batch context to emit a single notification transaction.
	 */
	Undo() {
		if (!this.SpreadsheetModel) return;

		this.SpreadsheetModel.BatchUpdate(() => {
			for (let i = 0; i < this.CellEntries.length; i++) {
				const entry = this.CellEntries[i];
				this.SpreadsheetModel.SetCell(
					entry.RowKey,
					entry.ColKey,
					entry.OldValue,
					entry.OldStyle || {},
				);
			}
		});
	}

	/**
	 * Redoes the clear operation.
	 */
	Redo() {
		this.Execute();
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
