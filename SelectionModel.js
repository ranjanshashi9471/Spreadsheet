// SelectionModel.js

/**
 * Manages all spreadsheet selection states, range calculations, and selection queries.
 * Pure model with zero DOM dependencies.
 */
class SelectionModel {
	constructor() {
		this.SelectedRowKeys = new Set();
		this.SelectedColKeys = new Set();
		this.LastClickedRowKey = null;
		this.LastClickedColKey = null;

		this.AnchorCell = null; // { Row: number, Col: number }
		this.IsDragging = false;
		this.DragStartRowKey = null;
		this.DragStartColKey = null;
	}

	// Backwards-compatible aliases
	get selectedRowKeys() {
		return this.SelectedRowKeys;
	}
	get selectedColKeys() {
		return this.SelectedColKeys;
	}
	get lastClickedRowKey() {
		return this.LastClickedRowKey;
	}
	set lastClickedRowKey(val) {
		this.LastClickedRowKey = val;
	}
	get lastClickedColKey() {
		return this.LastClickedColKey;
	}
	set lastClickedColKey(val) {
		this.LastClickedColKey = val;
	}
	get anchorCell() {
		return this.AnchorCell;
	}
	set anchorCell(val) {
		this.AnchorCell = val;
	}
	get isDragging() {
		return this.IsDragging;
	}
	set isDragging(val) {
		this.IsDragging = val;
	}
	get dragStartRowKey() {
		return this.DragStartRowKey;
	}
	set dragStartRowKey(val) {
		this.DragStartRowKey = val;
	}
	get dragStartColKey() {
		return this.DragStartColKey;
	}
	set dragStartColKey(val) {
		this.DragStartColKey = val;
	}

	/**
	 * Selects a single cell and sets it as the anchor.
	 * @param {number} rowKey
	 * @param {number|string} colKey
	 */
	SelectCell(rowKey, colKey) {
		this.ClearSelection();
		this.SelectedRowKeys.add(rowKey);
		this.SelectedColKeys.add(colKey);
		this.LastClickedRowKey = rowKey;
		this.LastClickedColKey = colKey;
		this.AnchorCell = { Row: rowKey, Col: colKey };
	}

	/**
	 * Selects a rectangular range of cells between two row and column coordinates.
	 * @param {number} startRow
	 * @param {number} startColIdx
	 * @param {number} endRow
	 * @param {number} endColIdx
	 * @param {Array<string>} columns - List of column names/keys
	 */
	SelectCellRange(startRow, startColIdx, endRow, endColIdx, columns) {
		this.SelectedRowKeys.clear();
		this.SelectedColKeys.clear();

		const rStart = Math.min(startRow, endRow);
		const rEnd = Math.max(startRow, endRow);
		for (let r = rStart; r <= rEnd; r++) {
			this.SelectedRowKeys.add(r);
		}

		const cStart = Math.min(startColIdx, endColIdx);
		const cEnd = Math.max(startColIdx, endColIdx);
		for (let c = cStart; c <= cEnd; c++) {
			if (columns && c < columns.length) {
				this.SelectedColKeys.add(columns[c]);
			}
		}
	}

	/**
	 * Selects a single row, toggles it, or selects a range.
	 * @param {number} rowKey
	 * @param {boolean} [isMulti=false]
	 * @param {boolean} [isRange=false]
	 */
	SelectRow(rowKey, isMulti = false, isRange = false) {
		if (isRange && this.LastClickedRowKey !== null) {
			this.SelectRowRange(this.LastClickedRowKey, rowKey);
		} else if (isMulti) {
			this.ToggleSingleRow(rowKey);
			this.LastClickedRowKey = rowKey;
		} else {
			this.SelectedRowKeys.clear();
			this.SelectedColKeys.clear();
			this.SelectedRowKeys.add(rowKey);
			this.LastClickedRowKey = rowKey;
		}
	}

	/**
	 * Selects a contiguous range of rows.
	 * @param {number} startKey
	 * @param {number} endKey
	 * @param {Array<number>} [allRowKeys=null]
	 */
	SelectRowRange(startKey, endKey, allRowKeys = null) {
		this.SelectedRowKeys.clear();
		this.SelectedColKeys.clear();
		const start = Math.min(startKey, endKey);
		const end = Math.max(startKey, endKey);

		if (allRowKeys && Array.isArray(allRowKeys)) {
			for (const r of allRowKeys) {
				if (r >= start && r <= end) {
					this.SelectedRowKeys.add(r);
				}
			}
		} else {
			for (let r = start; r <= end; r++) {
				this.SelectedRowKeys.add(r);
			}
		}
	}

	/**
	 * Toggles the selection status of a single row.
	 * @param {number} rowKey
	 */
	ToggleSingleRow(rowKey) {
		if (this.SelectedRowKeys.has(rowKey)) {
			this.SelectedRowKeys.delete(rowKey);
		} else {
			this.SelectedRowKeys.add(rowKey);
		}
	}

	/**
	 * Selects a single column, toggles it, or selects a range.
	 * @param {string|number} colKey
	 * @param {boolean} [isMulti=false]
	 * @param {boolean} [isRange=false]
	 * @param {Array<string>} [columns=[]]
	 */
	SelectColumn(colKey, isMulti = false, isRange = false, columns = []) {
		if (isRange && this.LastClickedColKey !== null) {
			this.SelectColumnRange(this.LastClickedColKey, colKey, columns);
		} else if (isMulti) {
			this.ToggleSingleCol(colKey);
			this.LastClickedColKey = colKey;
		} else {
			this.SelectedColKeys.clear();
			this.SelectedRowKeys.clear();
			this.SelectedColKeys.add(colKey);
			this.LastClickedColKey = colKey;
		}
	}

	/**
	 * Selects a contiguous range of columns.
	 * @param {string} startKey
	 * @param {string} endKey
	 * @param {Array<string>} columns
	 */
	SelectColumnRange(startKey, endKey, columns) {
		this.SelectedColKeys.clear();
		this.SelectedRowKeys.clear();
		const startIndex = columns.indexOf(startKey);
		const endIndex = columns.indexOf(endKey);
		if (startIndex === -1 || endIndex === -1) {
			return;
		}
		const start = Math.min(startIndex, endIndex);
		const end = Math.max(startIndex, endIndex);
		for (let i = start; i <= end; i++) {
			this.SelectedColKeys.add(columns[i]);
		}
	}

	/**
	 * Toggles the selection status of a single column.
	 * @param {string|number} colKey
	 */
	ToggleSingleCol(colKey) {
		if (this.SelectedColKeys.has(colKey)) {
			this.SelectedColKeys.delete(colKey);
		} else {
			this.SelectedColKeys.add(colKey);
		}
	}

	/**
	 * Clears all row, column, and cell selections.
	 */
	ClearSelection() {
		this.SelectedRowKeys.clear();
		this.SelectedColKeys.clear();
		this.AnchorCell = null;
		this.IsDragging = false;
		this.DragStartRowKey = null;
		this.DragStartColKey = null;
	}

	/**
	 * Sets the anchor cell for range expansions.
	 * @param {number} row
	 * @param {number} col
	 */
	SetAnchor(row, col) {
		this.AnchorCell = { Row: row, Col: col };
	}

	/**
	 * Updates the drag state.
	 * @param {boolean} isDragging
	 * @param {number|null} startRow
	 * @param {number|null} startCol
	 */
	SetDragging(isDragging, startRow = null, startCol = null) {
		this.IsDragging = isDragging;
		this.DragStartRowKey = startRow;
		this.DragStartColKey = startCol;
	}

	/**
	 * Checks if a specific cell is within the current selection.
	 * @param {number} rowKey
	 * @param {string|number} colKey
	 * @returns {boolean}
	 */
	IsCellSelected(rowKey, colKey) {
		return this.SelectedRowKeys.has(rowKey) && this.SelectedColKeys.has(colKey);
	}

	/**
	 * Checks if a row is selected.
	 * @param {number} rowKey
	 * @returns {boolean}
	 */
	IsRowSelected(rowKey) {
		return this.SelectedRowKeys.has(rowKey);
	}

	/**
	 * Checks if a column is selected.
	 * @param {string|number} colKey
	 * @returns {boolean}
	 */
	IsColumnSelected(colKey) {
		return this.SelectedColKeys.has(colKey);
	}

	/**
	 * Checks if there is an active selection.
	 * @returns {boolean}
	 */
	HasSelection() {
		return this.SelectedRowKeys.size > 0 || this.SelectedColKeys.size > 0;
	}

	/**
	 * Checks if multiple cells/rows/columns are selected.
	 * @returns {boolean}
	 */
	HasMultiSelection() {
		return this.SelectedRowKeys.size > 1 || this.SelectedColKeys.size > 1;
	}

	/**
	 * Computes the bounding rectangle of the current selection.
	 * @param {Array<string>} columns - Column names in order
	 * @returns {{ MinRow: number, MaxRow: number, MinColIdx: number, MaxColIdx: number } | null}
	 */
	GetSelectedBounds(columns) {
		if (this.SelectedRowKeys.size === 0 || this.SelectedColKeys.size === 0) {
			return null;
		}

		const rows = [...this.SelectedRowKeys];
		const minRow = Math.min(...rows);
		const maxRow = Math.max(...rows);

		const colIndices = [...this.SelectedColKeys]
			.map((key) => columns.indexOf(key))
			.filter((idx) => idx !== -1);

		if (colIndices.length === 0) {
			return null;
		}

		const minColIdx = Math.min(...colIndices);
		const maxColIdx = Math.max(...colIndices);

		return {
			MinRow: minRow,
			MaxRow: maxRow,
			MinColIdx: minColIdx,
			MaxColIdx: maxColIdx,
		};
	}
}
