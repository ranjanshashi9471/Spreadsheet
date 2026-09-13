/**
 * CommandManager.js
 *
 * Manages the undo/redo history stacks and command execution for Arbor Spreadsheet.
 * Strictly adheres to PascalCase properties and methods throughout.
 */

class CommandManager {
	/**
	 * @param {number} [maxHistorySize=100] - Maximum commands preserved in undo history.
	 */
	constructor(maxHistorySize = 100) {
		this.UndoStack = [];
		this.RedoStack = [];
		this.MaxHistorySize = maxHistorySize;
		this.Listeners = new Set();
	}

	/**
	 * Compatibility getter for undoStack.
	 */
	get undoStack() {
		return this.UndoStack;
	}

	/**
	 * Compatibility getter for redoStack.
	 */
	get redoStack() {
		return this.RedoStack;
	}

	/**
	 * Returns true if there are commands available to undo.
	 * @returns {boolean}
	 */
	get CanUndo() {
		return this.UndoStack.length > 0;
	}

	/**
	 * Compatibility getter for canUndo.
	 */
	get canUndo() {
		return this.CanUndo;
	}

	/**
	 * Returns true if there are commands available to redo.
	 * @returns {boolean}
	 */
	get CanRedo() {
		return this.RedoStack.length > 0;
	}

	/**
	 * Compatibility getter for canRedo.
	 */
	get canRedo() {
		return this.CanRedo;
	}

	/**
	 * Executes a command, adds it to the undo stack, and clears the redo stack.
	 * @param {Command} command - The command to execute.
	 * @returns {Command}
	 */
	ExecuteCommand(command) {
		if (!command || typeof command.Execute !== "function") {
			throw new TypeError("Command must implement an Execute() method.");
		}

		command.Execute();
		this.UndoStack.push(command);
		this.RedoStack = [];

		if (this.UndoStack.length > this.MaxHistorySize) {
			this.UndoStack.shift();
		}

		this.NotifyListeners("execute", command);
		return command;
	}

	/**
	 * Compatibility alias for ExecuteCommand.
	 */
	executeCommand(command) {
		return this.ExecuteCommand(command);
	}

	/**
	 * Undoes the most recent command from the undo stack.
	 * @returns {Command|null}
	 */
	Undo() {
		if (!this.CanUndo) {
			return null;
		}

		const command = this.UndoStack.pop();
		command.Undo();
		this.RedoStack.push(command);

		this.NotifyListeners("undo", command);
		return command;
	}

	/**
	 * Compatibility alias for Undo.
	 */
	undo() {
		return this.Undo();
	}

	/**
	 * Redoes the most recently undone command.
	 * @returns {Command|null}
	 */
	Redo() {
		if (!this.CanRedo) {
			return null;
		}

		const command = this.RedoStack.pop();
		command.Redo();
		this.UndoStack.push(command);

		this.NotifyListeners("redo", command);
		return command;
	}

	/**
	 * Compatibility alias for Redo.
	 */
	redo() {
		return this.Redo();
	}

	/**
	 * Clears both undo and redo stacks.
	 */
	Clear() {
		this.UndoStack = [];
		this.RedoStack = [];
		this.NotifyListeners("clear", null);
	}

	/**
	 * Compatibility alias for Clear.
	 */
	clear() {
		this.Clear();
	}

	/**
	 * Registers a callback listener for command events.
	 * @param {Function} listener
	 */
	AddListener(listener) {
		if (typeof listener === "function") {
			this.Listeners.add(listener);
		}
	}

	/**
	 * Unregisters a callback listener.
	 * @param {Function} listener
	 */
	RemoveListener(listener) {
		this.Listeners.delete(listener);
	}

	/**
	 * Notifies all registered listeners of a command event.
	 * @param {"execute"|"undo"|"redo"|"clear"} action
	 * @param {Command|null} command
	 */
	NotifyListeners(action, command) {
		for (const listener of this.Listeners) {
			try {
				listener(action, command);
			} catch (err) {
				console.error("Error in CommandManager listener:", err);
			}
		}
	}
}

// Browser & Node module export
if (typeof window !== "undefined") {
	window.CommandManager = CommandManager;
}

if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		CommandManager,
	};
}
