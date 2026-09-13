/**
 * GridRenderer.js
 *
 * Presentation and rendering engine for Arbor Spreadsheet.
 * Translates SpreadsheetModel, CellStore, and SelectionModel state into DOM elements.
 *
 * Strictly follows PascalCase for all properties and methods.
 */

class GridRenderer {
	/**
	 * @param {HTMLElement} containerElement - Root DOM container for table.
	 * @param {SpreadsheetModel} spreadsheetModel - Data model owner.
	 * @param {SelectionModel} selectionModel - Selection state owner.
	 */
	constructor(containerElement, spreadsheetModel, selectionModel) {
		this.ContainerElement = containerElement;
		this.SpreadsheetModel = spreadsheetModel;
		this.SelectionModel = selectionModel;

		this.TableElement = null;
		this.THeadElement = null;
		this.TBodyElement = null;
		this.CustomColWidths = new Map();
		this.DynamicStyleSheet = null;

		// Virtualization properties (Strict PascalCase)
		this.RowHeight = 28;
		this.BufferRows = 10;
		this.StartRow = 1;
		this.EndRow = 1;
		this.IsVirtualizationEnabled = true;
		this.IsScrolling = false;
		this.TopSpacerElement = null;
		this.BottomSpacerElement = null;
		this.ScrollHandlerAttached = false;
	}

	// Compatibility getters
	get containerElement() {
		return this.ContainerElement;
	}
	get spreadsheetModel() {
		return this.SpreadsheetModel;
	}
	get selectionModel() {
		return this.SelectionModel;
	}
	get tableElement() {
		return this.TableElement;
	}
	get tHeadElement() {
		return this.THeadElement;
	}
	get tBodyElement() {
		return this.TBodyElement;
	}
	get customColWidths() {
		return this.CustomColWidths;
	}
	get rowHeight() {
		return this.RowHeight;
	}
	get bufferRows() {
		return this.BufferRows;
	}
	get startRow() {
		return this.StartRow;
	}
	get endRow() {
		return this.EndRow;
	}
	get isVirtualizationEnabled() {
		return this.IsVirtualizationEnabled;
	}

	/**
	 * Converts 1-based column number to spreadsheet column name (1 -> A, 27 -> AA).
	 * @param {number} colIndex
	 * @returns {string}
	 */
	ToColumnName(colIndex) {
		let colName = "";
		while (colIndex > 0) {
			const remainder = (colIndex - 1) % 26;
			colName = String.fromCharCode(65 + remainder) + colName;
			colIndex = Math.floor((colIndex - 1) / 26);
		}
		return colName;
	}

	/**
	 * Converts column label (e.g. C1 or A) to numeric index.
	 * @param {string} colName
	 * @returns {number}
	 */
	ToColumnIndex(colName) {
		if (!colName) return 0;
		if (colName.startsWith("C") && !isNaN(parseInt(colName.substring(1), 10))) {
			return parseInt(colName.substring(1), 10);
		}
		let result = 0;
		for (let i = 0; i < colName.length; i++) {
			result = result * 26 + (colName.charCodeAt(i) - 64);
		}
		return result;
	}

	/**
	 * Coordinates full rendering of table structure, headers, and data cells.
	 * @param {Function} [onColumnHeaderClick] - Optional callback for header clicks.
	 * @param {Function} [onResize] - Optional callback for column resize events.
	 */
	RenderGrid(onColumnHeaderClick, onResize) {
		const currentSheet = this.SpreadsheetModel?.CurrentSpreadsheet;
		if (!currentSheet) return;

		const sheetName = currentSheet.SheetName || currentSheet.sheetName;

		// 1. Build Table Structure
		this.RenderStructure(sheetName);

		// 2. Render Column Headers (A, B, C...)
		this.RenderColHead(onColumnHeaderClick);

		// 3. Render Data Body
		this.RenderTableBody();

		// 4. Attach Resizers
		this.AttachResizing(onResize);

		// 5. Attach Virtual Scroll Listener
		this.AttachScrollListener();

		// 6. Apply any active highlights
		this.UpdateHighlights();
	}

	/**
	 * Generates table skeleton (table, thead, tbody).
	 * @param {string} sheetName
	 */
	RenderStructure(sheetName) {
		if (!this.ContainerElement) return;

		this.ContainerElement.innerHTML = `
			<table border="1">
				<thead>
					<tr class="table-header" id="${sheetName}_header"></tr>
				</thead>
				<tbody id="${sheetName}-data-input" class="table-body">
				</tbody>
			</table>
		`;

		if (typeof this.ContainerElement.querySelector === "function") {
			this.TableElement = this.ContainerElement.querySelector("table");
			this.THeadElement = this.ContainerElement.querySelector("thead");
			this.TBodyElement = this.ContainerElement.querySelector("tbody");
		}
	}

	/**
	 * Renders column headers with corner cell (#) and resize handles.
	 * @param {Function} [onColumnHeaderClick]
	 */
	RenderColHead(onColumnHeaderClick) {
		const currentSheet = this.SpreadsheetModel?.CurrentSpreadsheet;
		if (!currentSheet) return;

		const sheetName = currentSheet.SheetName || currentSheet.sheetName;
		const cols = currentSheet.Columns || currentSheet.columns || [];
		const isInMemory = Boolean(
			currentSheet.IsInMemory ?? currentSheet.isInMemory,
		);

		const tableHeader =
			(typeof document !== "undefined" &&
				document.getElementById &&
				document.getElementById(`${sheetName}_header`)) ||
			(this.THeadElement &&
			typeof this.THeadElement.querySelector === "function"
				? this.THeadElement.querySelector("tr")
				: null);

		if (!tableHeader) return;
		tableHeader.innerHTML = "";

		// Corner cell for row numbers
		if (
			typeof document !== "undefined" &&
			typeof document.createElement === "function"
		) {
			const cornerTh = document.createElement("th");
			cornerTh.innerHTML = "#";
			cornerTh.classList.add("c0");
			tableHeader.appendChild(cornerTh);

			cols.forEach((colName, colIdx) => {
				const displayColName = isInMemory
					? this.ToColumnName(colIdx + 1) || colName
					: colName;

				const th = document.createElement("th");
				th.innerHTML = `${displayColName}`;
				th.classList.add(colName);
				th.dataset.colKey = colName;
				th.dataset.colIdx = colIdx;

				if (typeof onColumnHeaderClick === "function") {
					th.addEventListener("click", (e) => {
						e.preventDefault();
						onColumnHeaderClick(colName, e);
					});
				}

				const div = document.createElement("div");
				div.classList.add(`${colName}_resize`, "resize");
				th.appendChild(div);

				tableHeader.appendChild(th);
			});
		}
	}

	/**
	 * Computes visible row indices and spacer heights for virtual scrolling.
	 * @returns {{ StartRow: number, EndRow: number, TopSpacerHeight: number, BottomSpacerHeight: number, TotalRows: number }}
	 */
	ComputeVisibleRange() {
		const currentSheet = this.SpreadsheetModel?.CurrentSpreadsheet;
		const totalRows = currentSheet
			? currentSheet.MaxRows || currentSheet.maxRows || 0
			: 0;

		if (totalRows <= 0) {
			return {
				StartRow: 1,
				EndRow: 0,
				TopSpacerHeight: 0,
				BottomSpacerHeight: 0,
				TotalRows: 0,
			};
		}

		if (!this.IsVirtualizationEnabled) {
			return {
				StartRow: 1,
				EndRow: totalRows,
				TopSpacerHeight: 0,
				BottomSpacerHeight: 0,
				TotalRows: totalRows,
			};
		}

		const scrollTop =
			(this.ContainerElement && this.ContainerElement.scrollTop) || 0;
		const viewportHeight =
			(this.ContainerElement && this.ContainerElement.clientHeight) || 600;

		const visibleStart = Math.floor(scrollTop / this.RowHeight) + 1;
		const visibleEnd = Math.ceil((scrollTop + viewportHeight) / this.RowHeight);

		const startRow = Math.max(1, visibleStart - this.BufferRows);
		const endRow = Math.min(totalRows, visibleEnd + this.BufferRows);

		const topSpacerHeight = (startRow - 1) * this.RowHeight;
		const bottomSpacerHeight = Math.max(
			0,
			(totalRows - endRow) * this.RowHeight,
		);

		return {
			StartRow: startRow,
			EndRow: endRow,
			TopSpacerHeight: topSpacerHeight,
			BottomSpacerHeight: bottomSpacerHeight,
			TotalRows: totalRows,
		};
	}

	/**
	 * Renders the visible virtual slice with top and bottom spacer rows.
	 */
	RenderVirtualSlice() {
		const currentSheet = this.SpreadsheetModel?.CurrentSpreadsheet;
		if (!currentSheet) return;

		const sheetName = currentSheet.SheetName || currentSheet.sheetName;
		const cols = currentSheet.Columns || currentSheet.columns || [];
		const isInMemory = Boolean(
			currentSheet.IsInMemory ?? currentSheet.isInMemory,
		);

		const tbody =
			(typeof document !== "undefined" &&
				document.getElementById &&
				document.getElementById(`${sheetName}-data-input`)) ||
			this.TBodyElement;

		if (!tbody) return;

		const { StartRow, EndRow, TopSpacerHeight, BottomSpacerHeight } =
			this.ComputeVisibleRange();
		this.StartRow = StartRow;
		this.EndRow = EndRow;

		tbody.innerHTML = "";

		const fragment =
			typeof document !== "undefined" &&
			typeof document.createDocumentFragment === "function"
				? document.createDocumentFragment()
				: tbody;

		const colSpan = cols.length + 1;

		// 1. Top Spacer Row
		if (
			TopSpacerHeight > 0 &&
			typeof document !== "undefined" &&
			typeof document.createElement === "function"
		) {
			const topSpacer = document.createElement("tr");
			topSpacer.className = "virtual-spacer top-spacer";
			topSpacer.style.height = `${TopSpacerHeight}px`;
			const topTd = document.createElement("td");
			topTd.colSpan = colSpan;
			topTd.style.height = `${TopSpacerHeight}px`;
			topSpacer.appendChild(topTd);
			fragment.appendChild(topSpacer);
			this.TopSpacerElement = topSpacer;
		} else {
			this.TopSpacerElement = null;
		}

		// 2. Visible Data Rows
		for (let rowno = StartRow; rowno <= EndRow; rowno++) {
			const tr = this.RenderRow(rowno, cols, isInMemory, sheetName);
			if (tr) {
				fragment.appendChild(tr);
			}
		}

		// 3. Bottom Spacer Row
		if (
			BottomSpacerHeight > 0 &&
			typeof document !== "undefined" &&
			typeof document.createElement === "function"
		) {
			const bottomSpacer = document.createElement("tr");
			bottomSpacer.className = "virtual-spacer bottom-spacer";
			bottomSpacer.style.height = `${BottomSpacerHeight}px`;
			const bottomTd = document.createElement("td");
			bottomTd.colSpan = colSpan;
			bottomTd.style.height = `${BottomSpacerHeight}px`;
			bottomSpacer.appendChild(bottomTd);
			fragment.appendChild(bottomSpacer);
			this.BottomSpacerElement = bottomSpacer;
		} else {
			this.BottomSpacerElement = null;
		}

		if (fragment !== tbody) {
			tbody.appendChild(fragment);
		}
		this.TBodyElement = tbody;

		// 4. Update highlights on visible rows
		this.UpdateHighlights();
	}

	/**
	 * Attaches scroll event listener for 60 FPS viewport virtualization.
	 */
	AttachScrollListener() {
		if (!this.ContainerElement || this.ScrollHandlerAttached) return;
		if (typeof this.ContainerElement.addEventListener !== "function") return;

		this.ScrollHandler = () => {
			if (this.IsScrolling) return;
			this.IsScrolling = true;

			if (typeof requestAnimationFrame === "function") {
				requestAnimationFrame(() => {
					this.IsScrolling = false;
					const prevStart = this.StartRow;
					const prevEnd = this.EndRow;
					const { StartRow, EndRow } = this.ComputeVisibleRange();
					if (StartRow !== prevStart || EndRow !== prevEnd) {
						this.RenderVirtualSlice();
					}
				});
			} else {
				this.IsScrolling = false;
				this.RenderVirtualSlice();
			}
		};

		this.ContainerElement.addEventListener("scroll", this.ScrollHandler);
		this.ScrollHandlerAttached = true;
	}

	/**
	 * Scrolls viewport to ensure target row is visible.
	 * @param {number} rowNo
	 */
	ScrollToRow(rowNo) {
		if (
			!this.ContainerElement ||
			typeof this.ContainerElement.scrollTop !== "number"
		)
			return;

		const targetScrollTop = (rowNo - 1) * this.RowHeight;
		const currentScrollTop = this.ContainerElement.scrollTop;
		const viewportHeight = this.ContainerElement.clientHeight || 600;

		if (targetScrollTop < currentScrollTop) {
			this.ContainerElement.scrollTop = targetScrollTop;
		} else if (
			targetScrollTop + this.RowHeight >
			currentScrollTop + viewportHeight
		) {
			this.ContainerElement.scrollTop =
				targetScrollTop + this.RowHeight - viewportHeight;
		}

		this.RenderVirtualSlice();
	}

	/**
	 * Scrolls viewport to ensure target cell is visible.
	 * @param {number} rowNo
	 * @param {number|string} colKey
	 */
	ScrollToCell(rowNo, colKey) {
		this.ScrollToRow(rowNo);
		if (
			this.ContainerElement &&
			typeof this.ContainerElement.scrollLeft === "number"
		) {
			const cell = this.GetCellElement(rowNo, colKey);
			if (cell && typeof cell.offsetLeft === "number") {
				const cellLeft = cell.offsetLeft;
				const cellWidth = cell.offsetWidth || 120;
				const currentLeft = this.ContainerElement.scrollLeft;
				const viewportWidth = this.ContainerElement.clientWidth || 800;

				if (cellLeft < currentLeft) {
					this.ContainerElement.scrollLeft = cellLeft;
				} else if (cellLeft + cellWidth > currentLeft + viewportWidth) {
					this.ContainerElement.scrollLeft =
						cellLeft + cellWidth - viewportWidth;
				}
			}
		}
	}

	/**
	 * Customizes row height in pixels.
	 * @param {number} height
	 */
	SetRowHeight(height) {
		if (typeof height === "number" && height > 0) {
			this.RowHeight = height;
			this.RenderVirtualSlice();
		}
	}

	/**
	 * Enables or disables virtualization.
	 * @param {boolean} enabled
	 */
	SetVirtualizationEnabled(enabled) {
		this.IsVirtualizationEnabled = Boolean(enabled);
		this.RenderTableBody();
	}

	/**
	 * Renders table body containing all rows and cells.
	 */
	RenderTableBody() {
		if (this.IsVirtualizationEnabled) {
			this.RenderVirtualSlice();
			return;
		}

		const currentSheet = this.SpreadsheetModel?.CurrentSpreadsheet;
		if (!currentSheet) return;

		const sheetName = currentSheet.SheetName || currentSheet.sheetName;
		const rows = currentSheet.MaxRows || currentSheet.maxRows || 0;
		const cols = currentSheet.Columns || currentSheet.columns || [];
		const isInMemory = Boolean(
			currentSheet.IsInMemory ?? currentSheet.isInMemory,
		);

		const tbody =
			(typeof document !== "undefined" &&
				document.getElementById &&
				document.getElementById(`${sheetName}-data-input`)) ||
			this.TBodyElement;

		if (!tbody) return;
		tbody.innerHTML = "";

		const fragment =
			typeof document !== "undefined" &&
			typeof document.createDocumentFragment === "function"
				? document.createDocumentFragment()
				: tbody;

		for (let rowno = 1; rowno <= rows; rowno++) {
			const tr = this.RenderRow(rowno, cols, isInMemory, sheetName);
			if (tr) {
				fragment.appendChild(tr);
			}
		}

		if (fragment !== tbody) {
			tbody.appendChild(fragment);
		}
		this.TBodyElement = tbody;
	}

	/**
	 * Renders a single row element with corner header and cell elements.
	 * @param {number} rowno
	 * @param {Array<string>} columns
	 * @param {boolean} isInMemory
	 * @param {string} sheetName
	 * @returns {HTMLTableRowElement|null}
	 */
	RenderRow(rowno, columns, isInMemory, sheetName) {
		if (
			typeof document === "undefined" ||
			typeof document.createElement !== "function"
		)
			return null;

		const tr = document.createElement("tr");
		tr.dataset.rowno = rowno;
		tr.style.height = `${this.RowHeight}px`;

		if (this.SelectionModel && this.SelectionModel.IsRowSelected(rowno)) {
			tr.classList.add("selected-row");
		}

		// Corner row-header cell
		const tdId = document.createElement("td");
		tdId.innerHTML = `${rowno}`;
		tdId.classList.add("C0");
		tdId.dataset.rowKey = rowno;
		tdId.style.height = `${this.RowHeight}px`;
		tr.appendChild(tdId);

		// Data cells
		columns.forEach((colName, colKey) => {
			const td = this.RenderCell(rowno, colKey, colName, isInMemory, sheetName);
			if (td) {
				tr.appendChild(td);
			}
		});

		return tr;
	}

	/**
	 * Renders an individual data cell element.
	 * @param {number} rowno
	 * @param {number} colKey
	 * @param {string} colName
	 * @param {boolean} isInMemory
	 * @param {string} sheetName
	 * @returns {HTMLTableCellElement|null}
	 */
	RenderCell(rowno, colKey, colName, isInMemory, sheetName) {
		if (
			typeof document === "undefined" ||
			typeof document.createElement !== "function"
		)
			return null;

		const displayColName = isInMemory ? this.ToColumnName(colKey + 1) : colName;
		const td = document.createElement("td");
		td.classList.add(colName);
		td.dataset.rowno = rowno;
		td.dataset.colno = colKey;

		if (
			this.SelectionModel &&
			this.SelectionModel.IsCellSelected(rowno, colName)
		) {
			td.classList.add("selected-cell");
		}

		const inputContainer = document.createElement("div");
		inputContainer.className = "container";

		const input = document.createElement("input");
		input.type = "text";
		input.className = `${colName} input-cell`;
		input.name = sheetName;

		// Retrieve Data & Style from SpreadsheetModel
		const cellVal = this.SpreadsheetModel
			? this.SpreadsheetModel.GetCell(rowno, colKey)
			: null;
		input.value =
			cellVal == null || cellVal.value === undefined ? "" : cellVal.value;

		const cellStyle = cellVal == null ? null : cellVal.style;
		if (cellStyle && typeof cellStyle === "object") {
			Object.assign(td.style, cellStyle);
		}

		input.dataset.rowno = rowno;
		input.dataset.colno = colKey;
		input.dataset.isinmemory = isInMemory.toString();

		// Suggestion dropdown
		const ul = document.createElement("ul");
		ul.type = "none";
		ul.className = "dropdown";
		ul.id = `${sheetName}-${rowno}-${colKey}-dropdown`;

		inputContainer.appendChild(input);
		inputContainer.appendChild(ul);
		td.appendChild(inputContainer);

		return td;
	}

	/**
	 * Updates a single cell's value and style in the DOM in O(1) time.
	 * @param {number} rowKey
	 * @param {number|string} colKey
	 * @param {*} [value]
	 * @param {object} [style]
	 */
	UpdateCell(rowKey, colKey, value, style) {
		if (
			typeof document === "undefined" ||
			typeof document.querySelector !== "function"
		)
			return;

		const currentSheet = this.SpreadsheetModel?.CurrentSpreadsheet;
		if (!currentSheet) return;

		const columns = currentSheet.Columns || currentSheet.columns || [];
		const colIdx =
			typeof colKey === "number" ? colKey : columns.indexOf(colKey);

		if (value !== undefined) {
			const input = this.GetCellInput(rowKey, colIdx);
			if (input) {
				input.value = value ?? "";
			}
		}

		if (style !== undefined) {
			const td = this.GetCellElement(rowKey, colIdx);
			if (td) {
				td.style.backgroundColor = style?.backgroundColor || "";
				if (style) {
					Object.assign(td.style, style);
				}
			}
		}
	}

	/**
	 * Removes all selection highlight classes from table elements.
	 */
	ClearHighlights() {
		if (
			typeof document === "undefined" ||
			typeof document.querySelectorAll !== "function"
		)
			return;

		document
			.querySelectorAll(".selected-row")
			.forEach((el) => el.classList.remove("selected-row"));

		document
			.querySelectorAll(".selected-col")
			.forEach((el) => el.classList.remove("selected-col"));

		document
			.querySelectorAll(".selected-cell")
			.forEach((el) => el.classList.remove("selected-cell"));
	}

	/**
	 * Updates row, column, and rectangular range highlights based on SelectionModel state.
	 */
	UpdateHighlights() {
		this.ClearHighlights();
		if (!this.SelectionModel) return;

		const currentSheet = this.SpreadsheetModel?.CurrentSpreadsheet;
		if (!currentSheet) return;

		const sheetName = currentSheet.SheetName || currentSheet.sheetName;
		const tableBody =
			(typeof document !== "undefined" &&
				document.getElementById &&
				document.getElementById(`${sheetName}-data-input`)) ||
			this.TBodyElement;

		if (!tableBody || typeof tableBody.querySelector !== "function") return;

		// 1. Highlight Rows
		this.SelectionModel.SelectedRowKeys.forEach((rowKey) => {
			const tr = tableBody.querySelector(`tr[data-rowno="${rowKey}"]`);
			if (tr) {
				tr.classList.add("selected-row");
			}
		});

		// 2. Highlight Columns
		if (typeof document.querySelectorAll === "function") {
			this.SelectionModel.SelectedColKeys.forEach((colKey) => {
				document.querySelectorAll(`.${colKey}`).forEach((el) => {
					el.classList.add("selected-col");
				});
			});
		}

		// 3. Highlight Intersection
		if (
			this.SelectionModel.SelectedRowKeys.size > 0 &&
			this.SelectionModel.SelectedColKeys.size > 0
		) {
			this.HighlightIntersection(tableBody);
		}
	}

	/**
	 * Applies .selected-cell class to cells at the intersection of selected rows and columns.
	 * @param {HTMLElement} [tableBody]
	 */
	HighlightIntersection(tableBody) {
		const targetBody = tableBody || this.TBodyElement;
		if (!targetBody || typeof targetBody.querySelector !== "function") return;

		this.SelectionModel.SelectedRowKeys.forEach((rowKey) => {
			const tr = targetBody.querySelector(`tr[data-rowno="${rowKey}"]`);
			if (tr && typeof tr.querySelector === "function") {
				this.SelectionModel.SelectedColKeys.forEach((colKey) => {
					const td = tr.querySelector(`td.${colKey}`);
					if (td) {
						td.classList.add("selected-cell");
					}
				});
			}
		});
	}

	/**
	 * Configures mouse event listeners for interactive column width adjustment.
	 * @param {Function} [onResize]
	 */
	AttachResizing(onResize) {
		if (
			typeof document === "undefined" ||
			typeof document.querySelectorAll !== "function"
		)
			return;

		let styleSheet = document.getElementById("arbor-dynamic-styles");
		if (
			!styleSheet &&
			document.head &&
			typeof document.createElement === "function"
		) {
			styleSheet = document.createElement("style");
			styleSheet.id = "arbor-dynamic-styles";
			document.head.appendChild(styleSheet);
		}
		this.DynamicStyleSheet = styleSheet;

		const resizers = document.querySelectorAll(".resize");
		resizers.forEach((resizer) => {
			resizer.addEventListener("mousedown", (e) => {
				const th = e.target.parentElement;
				if (!th) return;
				const colClass = th.classList[0];
				const startWidth = th.offsetWidth || 100;
				const startX = e.pageX;

				const onMouseMove = (moveEvent) => {
					moveEvent.preventDefault();
					const newWidth = Math.max(
						50,
						startWidth + (moveEvent.pageX - startX),
					);
					this.CustomColWidths.set(colClass, newWidth);

					let combinedCSS = "";
					this.CustomColWidths.forEach((width, colName) => {
						combinedCSS += `
							td.${colName}, th.${colName} { width: ${width}px !important; min-width: ${width}px !important; max-width: ${width}px !important; }
							td.${colName} input { width: ${width - 3}px !important; }
						`;
					});

					if (this.DynamicStyleSheet) {
						this.DynamicStyleSheet.innerHTML = combinedCSS;
					}

					if (typeof onResize === "function") {
						onResize(colClass, newWidth);
					}
				};

				const onMouseUp = () => {
					document.removeEventListener("mousemove", onMouseMove);
					document.removeEventListener("mouseup", onMouseUp);
				};

				document.addEventListener("mousemove", onMouseMove);
				document.addEventListener("mouseup", onMouseUp);
			});
		});
	}

	/**
	 * Returns the input element for specific cell coordinates.
	 * @param {number} rowKey
	 * @param {number|string} colKey
	 * @returns {HTMLInputElement|null}
	 */
	GetCellInput(rowKey, colKey) {
		if (
			typeof document === "undefined" ||
			typeof document.querySelector !== "function"
		)
			return null;
		return document.querySelector(
			`input[data-rowno="${rowKey}"][data-colno="${colKey}"]`,
		);
	}

	/**
	 * Returns the table cell (td) element for specific cell coordinates.
	 * @param {number} rowKey
	 * @param {number|string} colKey
	 * @returns {HTMLTableCellElement|null}
	 */
	GetCellElement(rowKey, colKey) {
		if (
			typeof document === "undefined" ||
			typeof document.querySelector !== "function"
		)
			return null;
		return document.querySelector(
			`tr[data-rowno="${rowKey}"] td[data-colno="${colKey}"]`,
		);
	}

	/**
	 * Returns the table row (tr) element for specific row number.
	 * @param {number} rowKey
	 * @returns {HTMLTableRowElement|null}
	 */
	GetRowElement(rowKey) {
		if (
			typeof document === "undefined" ||
			typeof document.querySelector !== "function"
		)
			return null;
		return document.querySelector(`tr[data-rowno="${rowKey}"]`);
	}

	/**
	 * Clears the table and all rendered DOM elements.
	 */
	Clear() {
		if (this.ContainerElement) {
			this.ContainerElement.innerHTML = "";
		}
		this.TableElement = null;
		this.THeadElement = null;
		this.TBodyElement = null;
	}
}

// Browser & Node module export
if (typeof window !== "undefined") {
	window.GridRenderer = GridRenderer;
}

if (typeof module !== "undefined" && module.exports) {
	module.exports = {
		GridRenderer,
	};
}
