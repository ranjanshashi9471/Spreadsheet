// SpreadsheetUI.js (Updated)

class SpreadsheetUI {
	constructor(rootElementId) {
		this.RootElement = document.getElementById(rootElementId);
		if (!this.RootElement) {
			console.error(`Root element with ID '${rootElementId}' not found.`);
			return;
		}

		this.SpreadsheetService = new BackendService();
		this.SpreadsheetModel = new SpreadsheetModel();
		this.SelectionModel = new SelectionModel();
		this.CommandManager = this.SpreadsheetModel.CommandManager;
		this.GridRenderer =
			typeof GridRenderer !== "undefined"
				? new GridRenderer(null, this.SpreadsheetModel, this.SelectionModel)
				: null;
		if (this.GridRenderer) {
			this.SpreadsheetModel.GridRenderer = this.GridRenderer;
		}
	}

	get rootElement() {
		return this.RootElement;
	}
	get spreadsheetService() {
		return this.SpreadsheetService;
	}
	get spreadsheetModel() {
		return this.SpreadsheetModel;
	}
	get selectionModel() {
		return this.SelectionModel;
	}
	get commandManager() {
		return this.CommandManager;
	}
	get gridRenderer() {
		return this.GridRenderer;
	}

	Undo() {
		return this.SpreadsheetModel ? this.SpreadsheetModel.Undo() : null;
	}

	Redo() {
		return this.SpreadsheetModel ? this.SpreadsheetModel.Redo() : null;
	}

	get CurrentSpreadsheet() {
		return this.SpreadsheetModel
			? this.SpreadsheetModel.GetCurrentSpreadsheet()
			: null;
	}
	set CurrentSpreadsheet(spreadsheet) {
		if (this.SpreadsheetModel) {
			this.SpreadsheetModel.SetCurrentSpreadsheet(spreadsheet);
		}
	}

	get currentSpreadsheet() {
		return this.CurrentSpreadsheet;
	}
	set currentSpreadsheet(spreadsheet) {
		this.CurrentSpreadsheet = spreadsheet;
	}

	get SelectedRowKeys() {
		return this.SelectionModel.SelectedRowKeys;
	}
	get selectedRowKeys() {
		return this.SelectedRowKeys;
	}

	get SelectedColKeys() {
		return this.SelectionModel.SelectedColKeys;
	}
	get selectedColKeys() {
		return this.SelectedColKeys;
	}

	get LastClickedRowKey() {
		return this.SelectionModel.LastClickedRowKey;
	}
	set LastClickedRowKey(val) {
		this.SelectionModel.LastClickedRowKey = val;
	}
	get lastClickedRowKey() {
		return this.LastClickedRowKey;
	}
	set lastClickedRowKey(val) {
		this.LastClickedRowKey = val;
	}

	get LastClickedColKey() {
		return this.SelectionModel.LastClickedColKey;
	}
	set LastClickedColKey(val) {
		this.SelectionModel.LastClickedColKey = val;
	}
	get lastClickedColKey() {
		return this.LastClickedColKey;
	}
	set lastClickedColKey(val) {
		this.LastClickedColKey = val;
	}

	get AnchorCell() {
		return this.SelectionModel.AnchorCell;
	}
	set AnchorCell(val) {
		this.SelectionModel.AnchorCell = val;
	}
	get anchorCell() {
		return this.AnchorCell;
	}
	set anchorCell(val) {
		this.AnchorCell = val;
	}

	get IsDragging() {
		return this.SelectionModel.IsDragging;
	}
	set IsDragging(val) {
		this.SelectionModel.IsDragging = val;
	}
	get isDragging() {
		return this.IsDragging;
	}
	set isDragging(val) {
		this.IsDragging = val;
	}

	get DragStartRowKey() {
		return this.SelectionModel.DragStartRowKey;
	}
	set DragStartRowKey(val) {
		this.SelectionModel.DragStartRowKey = val;
	}
	get dragStartRowKey() {
		return this.DragStartRowKey;
	}
	set dragStartRowKey(val) {
		this.DragStartRowKey = val;
	}

	get DragStartColKey() {
		return this.SelectionModel.DragStartColKey;
	}
	set DragStartColKey(val) {
		this.SelectionModel.DragStartColKey = val;
	}
	get dragStartColKey() {
		return this.DragStartColKey;
	}
	set dragStartColKey(val) {
		this.DragStartColKey = val;
	}

	/**
	 * Renders the initial,Complete Start UI of the application.
	 */
	InitializeUI() {
		this.#RenderBaseUI();
		this.#AttachGlobalEventListeners();

		document.addEventListener("mousemove", (e) => this.#HandleDragMove(e));
		document.addEventListener("mouseup", (e) => this.#HandleDragEnd(e));
	}

	/**
	 * Renders the initial, base UI structure of the application.
	 * @private
	 */
	#RenderBaseUI() {
		this.rootElement.innerHTML = `
            <div id="arbor-app-container" style="display: flex; flex-direction: column; height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9fbfd;">
                
                <header id="top-toolbar" style="border-bottom: 1px solid #e0e4e8; background: #ffffff; padding: 10px 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); z-index: 10;">
                    
                    <div id="file-operations" style="display: flex; gap: 8px; margin-bottom: 10px; align-items: center; flex-wrap: wrap;">
                        <button class="toolbar-btn primary" id="addNewSheetInputBtn">+ New Sheet</button>
                        <div class="divider"></div>
                        <button class="toolbar-btn" id="renderDbDumpInputBtn">Load DB</button>
                        <button class="toolbar-btn" id="renderSchemaInputBtn">Load Schema</button>
                        <button class="toolbar-btn" id="renderSQLInputBtn">SQL Query</button>
                        
                        <div id="global-input-space" style="margin-left: 10px; display: flex; align-items: center; gap: 8px;"></div>
                    </div>

                    <div id="sheet-features" style="display: flex; gap: 15px; align-items: center; min-height: 32px;">
                        <span style="color: #888; font-size: 0.9em; font-style: italic;">Select or create a sheet to view tools</span>
                    </div>
                </header>

                <main id="user-select" style="flex: 1; overflow: auto; background: #ffffff; position: relative;">
                    </main>

                <footer id="sheet-tabs" style="border-top: 1px solid #e0e4e8; background: #f1f4f9; display: flex; padding: 5px 10px; gap: 5px; overflow-x: auto; min-height: 40px; align-items: center;">
                    </footer>
            </div>
        `;

		// Attach Global Listeners
		document
			.getElementById("addNewSheetInputBtn")
			?.addEventListener("click", (e) => {
				e.preventDefault();
				this.AddNewSheetInput();
			});
		document
			.getElementById("renderDbDumpInputBtn")
			?.addEventListener("click", (e) => {
				e.preventDefault();
				this.RenderDbDumpInput();
			});
		document
			.getElementById("renderSchemaInputBtn")
			?.addEventListener("click", (e) => {
				e.preventDefault();
				this.RenderSchemaInput();
			});
		document
			.getElementById("renderSQLInputBtn")
			?.addEventListener("click", (e) => {
				e.preventDefault();
				this.RenderSQLInput();
			});
	}

	/**
	 * Displays UI for adding a new sheet (rows and columns input).
	 */
	AddNewSheetInput() {
		const space = document.getElementById("global-input-space");
		space.innerHTML = `
            <input type="number" id="user-rows" class="styled-input" placeholder="Rows" style="width: 70px;">
            <input type="number" id="user-columns" class="styled-input" placeholder="Cols" style="width: 70px;">
            <button class="toolbar-btn primary" id="confirmNewSheetBtn">Create</button>
            <button class="toolbar-btn" id="cancelInputBtn">Cancel</button>
        `;

		document
			.getElementById("confirmNewSheetBtn")
			.addEventListener("click", async (e) => {
				e.preventDefault();
				await this.StartBlankSpreadsheet();
				space.innerHTML = ""; // Clear input space after creation
			});

		document.getElementById("cancelInputBtn").addEventListener("click", (e) => {
			e.preventDefault();
			space.innerHTML = "";
		});
	}

	/**
	 * Displays UI for loading a database dump file.
	 */
	RenderDbDumpInput() {
		const space = document.getElementById("global-input-space");
		space.innerHTML = `
            <input type="file" id="dbDumpFileInput" class="styled-input">
            <button class="toolbar-btn" id="cancelInputBtn">Cancel</button>
        `;
		document
			.getElementById("dbDumpFileInput")
			.addEventListener("change", (e) => {
				this.HandleDbDumpFile(e);
				space.innerHTML = "";
			});
		document
			.getElementById("cancelInputBtn")
			.addEventListener("click", () => (space.innerHTML = ""));
	}

	/**
	 * Displays UI for loading a schema SQL file.
	 */
	RenderSchemaInput() {
		const space = document.getElementById("global-input-space");
		space.innerHTML = `
            <input type="file" id="schemaFileInput" class="styled-input">
            <button class="toolbar-btn" id="cancelInputBtn">Cancel</button>
        `;
		document
			.getElementById("schemaFileInput")
			.addEventListener("change", (e) => {
				this.HandleDbDumpFile(e);
				space.innerHTML = "";
			});

		document
			.getElementById("cancelInputBtn")
			.addEventListener("click", () => (space.innerHTML = ""));
	}

	/**
	 * Displays UI for running an arbitrary SQL query in the top toolbar.
	 */
	RenderSQLInput() {
		// Target the new toolbar input area
		const space = document.getElementById("global-input-space");

		// Inject a compact textarea and our styled toolbar buttons
		space.innerHTML = `
            <textarea 
                id="query-input" 
                class="styled-input" 
                rows="1" 
                spellcheck="false" 
                placeholder="Enter SQL (e.g., SELECT * FROM _sheets)" 
                style="width: 350px; min-height: 28px; resize: vertical; font-family: 'Courier New', monospace; margin-right: 5px;"
            ></textarea>
            <button class="toolbar-btn primary" id="submitQueryBtn">Execute</button>
            <button class="toolbar-btn" id="cancelQueryBtn">Cancel</button>
        `;

		// Attach event listener for execution
		document
			.getElementById("submitQueryBtn")
			.addEventListener("click", (event) => {
				event.preventDefault();
				this.ExecuteUserQuery(event);
			});

		// Attach event listener to easily close/hide the SQL input
		document
			.getElementById("cancelQueryBtn")
			.addEventListener("click", (event) => {
				event.preventDefault();
				space.innerHTML = "";
			});

		// Auto-focus the textarea so the user can start typing immediately
		document.getElementById("query-input").focus();
	}

	/**
	 * Handles loading a database dump file selected by the user.
	 * @param {Event} event - The file input change event.
	 */
	async HandleDbDumpFile(event) {
		event.preventDefault();
		try {
			const file = event.target.files[0];
			const dbType = await this.spreadsheetService.LoadDump(file);

			if (dbType === DATABASEDUMPTYPE.ARBOR_DUMP) {
				await this.RenderSheetsNames(event, true);
			} else {
				await this.RenderSheetsNames(event, false);
			}

			this.spreadsheetModel.Clear();

			const firstTab = document.querySelector(".sheet-tab");
			await firstTab?.click();
		} catch (error) {
			console.error(error);
			alert(error.message || "Error Loading Dump!!");
		} finally {
			event.target.value = "";
		}
	}

	/**
	 * Handles loading a SQL schema file selected by the user.
	 * @param {Event} event - The file input change event.
	 */
	HandleSchemaFile(event) {
		event.preventDefault();
		try {
			const file = event.target.files[0];
			const reader = new FileReader();
			reader.readAsText(file);
			reader.onload = async (e) => {
				e.preventDefault();
				await this.spreadsheetService.RunSchema(e.target.result);
				this.RenderSheetsNames(e, false);
			};
		} catch (error) {
			console.error(error);
			alert(error.message || "Error in running the schema file");
		}
	}

	/**
	 * Executes a user-provided SQL query and displays the results.
	 * @param {Event} event - The button click event.
	 */
	async ExecuteUserQuery(event) {
		event.preventDefault();
		const query = document.getElementById("query-input").value;

		if (!query.trim()) {
			alert("Please enter an SQL query.");
			return;
		}

		console.log("Executing query:", query);

		try {
			const res = await this.spreadsheetService.RunQuery(query);
			const output = document.getElementById("user-select");

			output.innerHTML = "";

			// Check if we actually have data to display
			if (res && res.columns && res.values) {
				// Setup the table shell
				output.innerHTML = `
                    <table border="1">
                        <thead>
                            <tr class="table-header" id="tmp_header"></tr>
                        </thead>
                        <tbody id="tmp-data-output" class="table-body">
                        </tbody>
                    </table>`;

				const headerrow = document.getElementById("tmp_header");
				const tbody = document.getElementById("tmp-data-output");

				// 1. Render Headers
				res.columns.forEach((colName) => {
					const th = document.createElement("th");
					th.innerHTML = colName;
					headerrow.appendChild(th);
				});

				// 2. BATCH RENDERING: Use DocumentFragment for massive result sets
				const fragment = document.createDocumentFragment();

				res.values.forEach((row) => {
					const bodyrow = document.createElement("tr");

					row.forEach((col) => {
						const td = document.createElement("td");
						td.innerHTML = col;
						bodyrow.appendChild(td);
					});

					// Append the finished row to the invisible fragment
					fragment.appendChild(bodyrow);
				});

				// 3. SINGLE REPAINT: Push all rows to the screen at exactly the same time
				tbody.appendChild(fragment);
			} else {
				alert("Query executed successfully (no data returned for display).");
				// Updated to match our new, cleaner method signature
				this.RenderSheetsNames(false);
			}
		} catch (error) {
			console.error("Error Executing Query:", error);
			alert(error.message || "Error Executing Query");
		}
	}

	/**
	 * Converts a 0-based integer index to a string "C" + index.
	 * Example: 0 -> "C0", 25 -> "C25", 26 -> "C26"
	 * @param {number} n - The 0-based column index.
	 * @returns {string} The column name.
	 * @private
	 */
	#ToColumnName(n) {
		return `C${n}`;
	}

	#ToColumnIndex(colName) {
		return parseInt(colName.substring(1), 10);
	}

	/**
	 * Refreshes the entire table UI (Headers, Body, Features, Resizers).
	 * Call this whenever the full sheet needs to be drawn or redrawn.
	 */
	#RefreshTableUI() {
		const currentSpreadsheet = this.spreadsheetModel.GetCurrentSpreadsheet();
		if (!currentSpreadsheet) return;

		const userSelect = document.getElementById("user-select");
		if (this.GridRenderer) {
			this.GridRenderer.ContainerElement = userSelect;
			this.GridRenderer.RenderGrid(
				(colName, e) => this.SelectColumn(colName, e),
				(colClass, newWidth) => {
					this.customColWidths.set(colClass, newWidth);
				},
			);
		} else {
			// 1. Setup the container
			this.#RenderTableStructure();

			// 2. Render Column Headers (A, B, C...)
			this.#RenderColHead();

			// 3. Render the Grid Data
			this.#RenderTableBody();

			// 4. Re-attach resizing listeners
			this.#AddResizing();
		}

		// Attach delegated event listeners to tbody
		const sheetName =
			currentSpreadsheet.SheetName || currentSpreadsheet.sheetName;
		const tbody = document.getElementById(`${sheetName}-data-input`);
		if (tbody) {
			this.#AttachTableBodyListeners(tbody);
		}

		// Render Top Bar Features (Buttons, Search, etc.)
		this.#RenderSheetFeatures(
			currentSpreadsheet.IsInMemory ?? currentSpreadsheet.isInMemory,
		);
	}

	/**
	 * Renders the table rows and cells based on the currentSpreadsheet data structure.
	 */
	#RenderTableBody() {
		if (this.GridRenderer) {
			this.GridRenderer.RenderTableBody();
			return;
		}

		const sheetName = this.currentSpreadsheet.sheetName;
		const rows = this.currentSpreadsheet.maxRows;
		const cols = this.currentSpreadsheet.columns;
		const isInMemory = this.currentSpreadsheet.isInMemory;

		const tbody = document.getElementById(`${sheetName}-data-input`);
		if (!tbody) return;
		tbody.innerHTML = "";

		const fragment = document.createDocumentFragment();

		for (let rowno = 1; rowno <= rows; rowno++) {
			const tr = document.createElement("tr");

			// CRITICAL FOR PERFORMANCE: Add the dataset to the TR for O(1) lookups
			tr.dataset.rowno = rowno;

			// 1. Render Row Header (C0 / ID column)
			const tdId = document.createElement("td");
			tdId.innerHTML = `${rowno}`;
			tdId.classList.add("C0");
			tdId.dataset.rowKey = rowno;
			tr.appendChild(tdId);

			// 2. Render Data Columns
			cols.forEach((colName, colKey) => {
				colName = isInMemory ? this.#ToColumnName(colKey + 1) : colName;

				const td = document.createElement("td");
				td.classList.add(colName); // Moved this up for clarity

				// Add dataset to TD for drag selection delegation
				td.dataset.rowno = rowno;
				td.dataset.colno = colKey;

				const inputContainer = document.createElement("div");
				inputContainer.className = "container";

				const input = document.createElement("input");
				input.type = "text";
				input.className = `${colName} input-cell`;
				input.name = sheetName;

				// RETRIEVE DATA & STYLE
				const cellVal = this.currentSpreadsheet.RetrieveCellData(rowno, colKey);
				input.value = cellVal == null ? "" : cellVal.value;

				const cellStyle = cellVal == null ? null : cellVal.style;
				if (cellStyle && typeof cellStyle === "object") {
					Object.assign(td.style, cellStyle);
				}

				// DATASET attributes for Event Handling
				input.dataset.rowno = rowno;
				input.dataset.colno = colKey;
				input.dataset.isinmemory = isInMemory.toString();

				// Dropdown for Suggestions
				const ul = document.createElement("ul");
				ul.type = "none";
				ul.className = "dropdown";
				ul.id = `${sheetName}-${rowno}-${colKey}-dropdown`;

				inputContainer.appendChild(input);
				inputContainer.appendChild(ul);
				td.appendChild(inputContainer);
				tr.appendChild(td);
			});

			fragment.appendChild(tr);
		}

		tbody.appendChild(fragment);
	}

	/**
	 * Initiates the creation of a new in-memory spreadsheet and prepares the UI.
	 * This does NOT immediately save to the database.
	 */
	StartBlankSpreadsheet() {
		const rowCountInput = document.getElementById("user-rows");
		const colCountInput = document.getElementById("user-columns");

		const rows = parseInt(rowCountInput.value, 10);
		const columns = parseInt(colCountInput.value, 10);

		if (isNaN(rows) || rows <= 0 || isNaN(columns) || columns <= 0) {
			alert("Please enter valid positive numbers.");
			return;
		}

		const tempSheetName = `sheet_${Math.floor(Math.random() * 100000)}`;

		// 1. ARCHITECTURAL WIN: The UI no longer configures the spreadsheet.
		// It simply issues a command to the Model.
		this.spreadsheetModel.CreateBlank(tempSheetName, rows, columns);

		// 2. Render the new state
		this.#RefreshTableUI();

		alert(`New sheet '${tempSheetName}' created.`);
	}

	/**
	 * Renders the UI for a specific spreadsheet (table) from the database.
	 * This will clear any active in-memory spreadsheet.
	 * @param {Event} event - The event object.
	 * @param {string} sheetName - The name of the sheet (table) to render.
	 * @param {boolean} isInMemory - True if this is an in-memory spreadsheet, false if DB-backed.
	 */
	async RenderSheet(event, sheetName, isInMemory) {
		if (event) event.preventDefault();

		try {
			this.#ClearSelection();

			// 1. Load Data into Structure (handled by Service)
			const spreadsheet = await this.spreadsheetService.LoadSpreadsheet(
				sheetName,
				isInMemory,
			);
			this.spreadsheetModel.SetCurrentSpreadsheet(spreadsheet);

			if (this.currentSpreadsheet) {
				// 2. Render
				this.#RefreshTableUI();
			}
		} catch (error) {
			console.error("Error rendering sheet:", error);
			alert(error.message);
		}
	}

	/**
	 * Renders column headers for a new sheet (e.g., c0, A, B, C...).
	 * @param {string} sheetName - The name of the sheet.
	 * @param {Array<string>} colNames - An array of column names to render.
	 * @private
	 */
	#RenderColHead() {
		const sheetName = this.currentSpreadsheet.sheetName;
		const cols = this.currentSpreadsheet.columns; // These are already correct names (A, B...)
		const tableHeader = document.getElementById(`${sheetName}_header`);

		if (!tableHeader) return;
		tableHeader.innerHTML = "";

		// Add Row Number Header
		const cornerTh = document.createElement("th");
		cornerTh.innerHTML = "#";
		cornerTh.classList.add("c0");
		tableHeader.appendChild(cornerTh);

		// Add Data Column Headers
		cols.forEach((colName) => {
			const th = document.createElement("th");
			th.innerHTML = `${colName}`;
			th.classList.add(colName);

			// Selection Listener
			th.addEventListener("click", (e) => {
				e.preventDefault();
				this.SelectColumn(colName, e);
			});

			// Resizer
			const div = document.createElement("div");
			div.classList.add(`${colName}_resize`, "resize");
			th.appendChild(div);

			tableHeader.appendChild(th);
		});
	}

	/**
	 * Renders the basic HTML structure for a table.
	 * @private
	 */
	#RenderTableStructure() {
		const currentSheet = this.spreadsheetModel.GetCurrentSpreadsheet();
		if (!currentSheet) return;
		const sheetName = currentSheet.SheetName || currentSheet.sheetName;

		if (this.GridRenderer) {
			this.GridRenderer.RenderStructure(sheetName);
		} else {
			const userSelect = document.getElementById("user-select");
			if (userSelect) {
				userSelect.innerHTML = `
					<table border="1">
						<thead>
						  <tr class="table-header" id="${sheetName}_header"></tr>
						</thead>
						<tbody id="${sheetName}-data-input" class="table-body">
						</tbody>
					</table>
				`;
			}
		}

		const tbody = document.getElementById(`${sheetName}-data-input`);
		if (tbody) {
			this.#AttachTableBodyListeners(tbody);
		}
	}

	/**
	 * Attaches master event listeners (focusin, change, input, click, mousedown) to tbody.
	 * @param {HTMLElement} tbody
	 * @private
	 */
	#AttachTableBodyListeners(tbody) {
		if (!tbody || tbody._listenersAttached) return;
		tbody._listenersAttached = true;

		// 1. Master Focusin Listener (Caches original value before edit)
		tbody.addEventListener("focusin", (e) => {
			if (e.target.classList.contains("input-cell")) {
				e.target.dataset.originalValue = e.target.value;
			}
		});

		// 2. Master Change Listener (Dispatches SetCellCommand on commit)
		tbody.addEventListener("change", (e) => {
			if (e.target.classList.contains("input-cell")) {
				const rowno = parseInt(e.target.dataset.rowno, 10);
				const colno = parseInt(e.target.dataset.colno, 10);
				const originalValue = e.target.dataset.originalValue ?? "";
				const newValue = e.target.value;

				if (newValue !== originalValue) {
					const command = new SetCellCommand(
						this.SpreadsheetModel,
						rowno,
						colno,
						newValue,
						null,
						originalValue,
					);
					if (this.CommandManager) {
						this.CommandManager.ExecuteCommand(command);
					}
					e.target.dataset.originalValue = newValue;
				}
			}
		});

		// 3. Master Input Listener (Handles typing in ANY cell)
		tbody.addEventListener("input", (e) => {
			if (e.target.classList.contains("input-cell")) {
				const rowno = parseInt(e.target.dataset.rowno, 10);
				const colno = parseInt(e.target.dataset.colno, 10);
				const isInMemory = e.target.dataset.isinmemory === "true";
				this.HandleInputChange(e, rowno, colno, isInMemory);
			}
		});

		// 4. Master Click Listener (Handles clicking row headers for selection)
		tbody.addEventListener("click", (e) => {
			const tdId = e.target.closest("td.C0");
			if (tdId) {
				const rowKey = parseInt(tdId.dataset.rowKey, 10);
				this.SelectRow(rowKey, e);
			}
		});

		// 5. Master Mousedown Listener (Handles drag selection on cells)
		tbody.addEventListener("mousedown", (e) => {
			const td = e.target.closest("td:not(.C0)"); // Ignore row headers

			// If they clicked the TD background, but NOT the input text itself
			if (td && e.target === td) {
				const rowno = parseInt(td.dataset.rowno, 10);
				const colno = parseInt(td.dataset.colno, 10);
				this.#HandleDragStart(rowno, colno, "cell", e);
			}
		});
	}

	/**
	 * Renders additional UI features like insert rows, save buttons.
	 * @param {boolean} isInMemory - True if this is an in-memory spreadsheet (show save button), false otherwise.
	 * @private
	 */
	#RenderSheetFeatures(isInMemory) {
		const sheetName = this.currentSpreadsheet.sheetName;
		const featuresContainer = document.getElementById("sheet-features");
		featuresContainer.innerHTML = ""; // Clear placeholder or previous sheet's tools

		// --- Formatting Group ---
		const formatGroup = document.createElement("div");
		formatGroup.style.cssText =
			"display: flex; align-items: center; gap: 5px; border-right: 1px solid #ccc; padding-right: 15px;";

		const colorPicker = document.createElement("input");
		colorPicker.type = "color";
		colorPicker.id = "cellColorPicker";
		colorPicker.value = "#dbeafe";
		colorPicker.title = "Choose highlight color";
		colorPicker.style.cssText =
			"cursor: pointer; border: none; padding: 0; width: 25px; height: 25px; border-radius: 4px;";

		const fillBtn = document.createElement("button");
		fillBtn.className = "toolbar-btn";
		fillBtn.textContent = "Fill Color";
		fillBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.ApplyBackgroundColor(
				document.getElementById("cellColorPicker").value,
			);
		});

		formatGroup.appendChild(colorPicker);
		formatGroup.appendChild(fillBtn);

		// --- Layout Group (Rows/Cols) ---
		const layoutGroup = document.createElement("div");
		layoutGroup.style.cssText =
			"display: flex; align-items: center; gap: 5px; border-right: 1px solid #ccc; padding-right: 15px;";

		const rowCountInput = document.createElement("input");
		rowCountInput.type = "number";
		rowCountInput.id = `${sheetName}-row-input`;
		rowCountInput.className = "styled-input";
		rowCountInput.placeholder = "Rows";
		rowCountInput.style.width = "60px";

		const insertRowsButton = document.createElement("button");
		insertRowsButton.className = "toolbar-btn";
		insertRowsButton.textContent = "Insert Rows";
		insertRowsButton.addEventListener("click", (e) => this.InsertRows(e));

		layoutGroup.appendChild(rowCountInput);
		layoutGroup.appendChild(insertRowsButton);

		// --- Sync/Data Group ---
		const syncGroup = document.createElement("div");
		syncGroup.style.cssText = "display: flex; align-items: center; gap: 5px;";

		const saveToDbButton = document.createElement("button");
		saveToDbButton.className = "toolbar-btn success";
		saveToDbButton.textContent = "Save to DB";
		saveToDbButton.addEventListener("click", (e) =>
			this.SaveSpreadsheetToDb(e),
		);

		const exportJsonButton = document.createElement("button");
		exportJsonButton.className = "toolbar-btn";
		exportJsonButton.textContent = "Export JSON";
		exportJsonButton.addEventListener("click", (e) => this.ExportJson(e));

		const renderJsonInputBtn = document.createElement("button");
		renderJsonInputBtn.className = "toolbar-btn";
		renderJsonInputBtn.textContent = "Import JSON";
		renderJsonInputBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.#RenderJsonInput();
		});

		const exportDbDumpButton = document.createElement("button");
		exportDbDumpButton.className = "toolbar-btn";
		exportDbDumpButton.textContent = "Export Dump";
		exportDbDumpButton.addEventListener("click", (e) =>
			this.HandleExportDBdump(e),
		);

		syncGroup.appendChild(saveToDbButton);
		syncGroup.appendChild(exportJsonButton);
		syncGroup.appendChild(renderJsonInputBtn);
		syncGroup.appendChild(exportDbDumpButton);

		// Append all groups
		featuresContainer.appendChild(formatGroup);
		featuresContainer.appendChild(layoutGroup);
		featuresContainer.appendChild(syncGroup);
	}

	/**
	 * Displays UI for loading a JSON file into the active spreadsheet.
	 */
	#RenderJsonInput() {
		const space = document.getElementById("global-input-space");

		// Inject the file input and cancel button
		space.innerHTML = `
            <span style="font-size: 13px; color: #5f6368; font-weight: 500;">Select JSON:</span>
            <input type="file" id="jsonFileInput" class="styled-input" accept=".json">
            <button class="toolbar-btn" id="cancelJsonInputBtn">Cancel</button>
        `;

		const fileInput = document.getElementById("jsonFileInput");
		const cancelBtn = document.getElementById("cancelJsonInputBtn");

		// 1. Listen for the file selection (Made async)
		fileInput.addEventListener("change", async (e) => {
			// UX Enhancement: Disable inputs to prevent double-clicks during loading
			fileInput.disabled = true;
			cancelBtn.disabled = true;

			try {
				// Wait for the file reader, parser, and UI refresh to completely finish
				await this.LoadJson(e);
			} catch (error) {
				console.error("JSON Import failed:", error);
			} finally {
				// Only clear the UI once the grid has safely updated
				space.innerHTML = "";
			}
		});

		// 2. Listen for the Cancel action
		cancelBtn.addEventListener("click", (e) => {
			e.preventDefault();
			space.innerHTML = "";
		});
	}

	/**
	 * Inserts empty rows into the current sheet.
	 * Behavior differs for in-memory vs. database-backed sheets.
	 * @param {Event} event - The form submission event.
	 */
	async InsertRows(event) {
		event.preventDefault();

		const { sheetName, columns, isInMemory } = this.currentSpreadsheet;

		try {
			const rowsInput = document.getElementById(`${sheetName}-row-input`);
			const rowsToInsert = parseInt(rowsInput.value, 10);

			if (isNaN(rowsToInsert) || rowsToInsert <= 0) {
				alert("Please enter a valid positive number of rows to insert.");
				return;
			}

			const tableBody = document.getElementById(`${sheetName}-data-input`);
			let startRowId = 1;

			if (isInMemory) {
				const maxKey = this.currentSpreadsheet.maxRows;
				startRowId = maxKey + 1;
			} else {
				try {
					const metadata =
						await this.spreadsheetService.GetTableMetadata(sheetName);
					if (metadata && metadata.max_id !== null) {
						startRowId = parseInt(metadata.max_id, 10) + 1;
					}
				} catch (error) {
					console.warn(
						"Could not determine previous max row ID from DB, starting from 1.",
						error,
					);
				}
			}

			// 1. BATCH RENDERING: Use a DocumentFragment to prevent UI freezing
			const fragment = document.createDocumentFragment();

			for (let i = 0; i < rowsToInsert; i++) {
				const currentRowId = startRowId + i;
				const tr = document.createElement("tr");

				// 2. CRITICAL: Add dataset to the TR so O(1) highlighting can find it
				tr.dataset.rowno = currentRowId;

				// Render Row Header (C0 / ID column)
				const tdId = document.createElement("td");
				tdId.innerHTML = `${currentRowId}`;
				tdId.classList.add("C0");
				tdId.dataset.rowKey = currentRowId; // Used by delegated click listener
				tr.appendChild(tdId);

				// Render Data Columns
				columns.forEach((colName, colIdx) => {
					const td = document.createElement("td");
					td.classList.add(colName);

					// Add datasets for delegated drag-selection
					td.dataset.rowno = currentRowId;
					td.dataset.colno = colIdx;

					const inputContainer = document.createElement("div");
					inputContainer.className = "container";

					const input = document.createElement("input");
					input.className = `${colName} input-cell`;
					input.type = "text";
					input.name = sheetName;
					input.value = "";

					// Add datasets for delegated input change listener
					input.dataset.rowno = currentRowId;
					input.dataset.colno = colIdx;
					input.dataset.isinmemory = isInMemory.toString();

					const dropdownList = document.createElement("ul");
					dropdownList.type = "none";
					dropdownList.id = `${sheetName}-${currentRowId}-${colIdx}-dropdown`;
					dropdownList.className = "dropdown";

					inputContainer.appendChild(input);
					inputContainer.appendChild(dropdownList);
					td.appendChild(inputContainer);
					tr.appendChild(td);
				});

				fragment.appendChild(tr);
			}

			// 3. SINGLE REPAINT: Push all new rows to the DOM at once
			tableBody.appendChild(fragment);
			rowsInput.value = "";

			// 4. STATE UPDATE: Ensure the AVL tree knows the new max boundary!
			if (isInMemory) {
				this.currentSpreadsheet.maxRows += rowsToInsert;
			}
		} catch (error) {
			console.error("Error Inserting Rows", error);
			throw new Error("InsertRows");
		}
	}

	/**
	 * Handles changes in input cells, updating either the in-memory spreadsheet or the database directly.
	 * @param {Event} event - The input change event.
	 * @param {number} rowno - The row number (primary key value).
	 * @param {number} colno - The column number (0-based index).
	 * @param {boolean} isInMemory - True if updating the in-memory AVL spreadsheet.
	 */
	async HandleInputChange(event, rowno, colno, isInMemory) {
		event.preventDefault();
		const { name: sheetName, value } = event.target;
		const dropdown = document.getElementById(
			`${sheetName}-${rowno}-${colno}-dropdown`,
		);

		if (isInMemory) {
			this.currentSpreadsheet.InsertData(rowno, colno, value);
			dropdown.style.display = "none";
			return;
		}

		try {
			const pKeyList = Array.from(this.currentSpreadsheet.primaryKeys).map(
				(colId, _id) => this.currentSpreadsheet.columns[colId],
			);

			const pKeyValues = this.currentSpreadsheet.primaryKeyMap.get(rowno);

			const updateInfo = await this.spreadsheetService.GetCellUpdateInfo(
				sheetName,
				pKeyList,
				pKeyValues,
				this.currentSpreadsheet.columns[colno],
				value,
			);

			if (updateInfo.type !== "foreignKey") {
				dropdown.style.display = "none";
				this.currentSpreadsheet.InsertData(rowno, colno, value);
			} else {
				dropdown.innerHTML = "";
				if (updateInfo.suggestions.length > 0) {
					dropdown.style.display = "block";
					updateInfo.suggestions.forEach((data) => {
						const li = document.createElement("li");
						li.innerHTML = data[0];
						li.dataset.value = data[0];
						li.addEventListener("click", async (e) => {
							e.preventDefault();
							try {
								dropdown.style.display = "none";
								event.target.value = e.target.dataset.value;
								this.currentSpreadsheet.InsertData(
									rowno,
									colno,
									e.target.dataset.value,
								);
							} catch (updateError) {
								console.error(
									"Error updating cell with dropdown value:",
									updateError,
								);
								alert("Error updating cell value.");
							}
						});
						dropdown.appendChild(li);
					});
				}
			}
		} catch (error) {
			console.error("Error in HandleInputChange (DB-backed):", error);
			dropdown.style.display = "none";
			alert("Error handling cell input. Check console for details.");
		}
	}

	/**
	 * Saves the current in-memory spreadsheet (AVL of AVL) to the database.
	 * This will create a new table in the DB and populate it.
	 */
	async SaveSpreadsheetToDb(event) {
		if (!this.currentSpreadsheet) {
			alert("No in-memory spreadsheet to save.");
			return;
		}
		try {
			const isInMemory = this.currentSpreadsheet.isInMemory;
			const sheetName = this.currentSpreadsheet.sheetName;

			if (isInMemory) {
				this.currentSpreadsheet.columns = this.currentSpreadsheet.columns.map(
					(col) => this.#ToColumnIndex(col),
				);
			}

			await this.spreadsheetService.SaveSpreadsheetChanges(
				this.currentSpreadsheet,
			);

			alert(`Spreadsheet '${sheetName}' successfully saved to database.`);

			this.spreadsheetModel.Clear();
			await this.RenderSheetsNames(event, isInMemory);
		} catch (error) {
			console.error("Error saving in-memory spreadsheet to DB:", error);
			alert(`Error saving spreadsheet to database: ${error.message}`);
		}
	}

	/**
	 * Generates and downloads a database dump file.
	 * @param {Event} event - The click event (not directly used, but passed for consistency).
	 */
	async HandleExportDBdump(event) {
		event.preventDefault();
		try {
			const dump = await this.spreadsheetService.ExportDb();
			const dumpBlob = new Blob([dump], { type: "application/octet-stream" });
			const dumpUrl = URL.createObjectURL(dumpBlob);

			const a = document.createElement("a");
			a.href = dumpUrl;
			a.download = "database-dump.sql";
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(dumpUrl);
		} catch (error) {
			console.error("Error generating DB dump:", error);
			alert(error.message || "Error generating database dump.");
		}
	}

	/**
	 * Saves the current sheet's data as a JSON file.
	 * @param {Event} event - The click event.
	 */
	async ExportJson(event) {
		event.preventDefault();
		const sheetName = this.currentSpreadsheet.sheetName;
		try {
			const blob = await this.spreadsheetService.HandleJsonExport(
				this.currentSpreadsheet,
			);
			if (blob) {
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `${sheetName}_data.json`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			} else {
				alert(`No data found for sheet '${sheetName}' to save as JSON.`);
			}
		} catch (error) {
			console.error("Error saving JSON:", error);
			alert(error.message || "Error saving sheet data as JSON.");
		}
	}

	/**
	 * Loads sheet data from a JSON file and inserts it into an existing or new table.
	 * @param {Event} event - The file input change event.
	 */
	async LoadJson(event) {
		event.preventDefault();
		try {
			const file = event.target.files[0];

			if (!file) {
				alert("No file selected.");
				return;
			}

			await this.spreadsheetService.HandleJsonImport(
				this.currentSpreadsheet,
				file,
			);

			console.log("File Import Handled");
			this.#RenderTableBody();
			alert("JSON file imported successfully.");
		} catch (error) {
			console.error("Error importing JSON file:", error);
			alert(error.message || "Error importing JSON file.");
		}
	}

	/**
	 * Renders the names of all sheets (tables) in the side panel.
	 * @param {boolean} isInMemory - True to load sheets as in-memory AVL spreadsheets, false for DB-backed.
	 */
	async RenderSheetsNames(isInMemory = true) {
		try {
			const sheetTabsContainer = document.getElementById("sheet-tabs");
			if (!sheetTabsContainer) return;

			const tableNames =
				await this.spreadsheetService.GetSheetNames(isInMemory);

			sheetTabsContainer.innerHTML = ""; // Now it is safe to clear

			// Handle empty state immediately to avoid nesting
			if (!tableNames || tableNames.length === 0) {
				sheetTabsContainer.innerHTML = `<span style="color: #888; font-size: 0.9em;">No sheets available in DB.</span>`;
				return;
			}

			// 2. Use a DocumentFragment. This acts as an invisible memory container.
			// Appending 50 tabs to this causes ZERO screen lag, unlike appending to the live DOM.
			const fragment = document.createDocumentFragment();

			tableNames.forEach((tableName) => {
				const tab = document.createElement("div");
				tab.textContent = tableName;

				// Optional Chaining (?.) makes this safer if currentSpreadsheet is null
				const isActive = this.currentSpreadsheet?.sheetName === tableName;
				tab.className = `sheet-tab ${isActive ? "active" : ""}`;

				tab.addEventListener("click", async (e) => {
					e.preventDefault();

					// 3. O(1) DOM Update: Swap the active class instantly
					const currentActive = sheetTabsContainer.querySelector(".active");
					if (currentActive) currentActive.classList.remove("active");
					tab.classList.add("active");

					// Load the spreadsheet data
					await this.RenderSheet(e, tableName, isInMemory);
				});

				fragment.appendChild(tab);
			});

			// 4. Paint all tabs to the screen in a single, lightning-fast DOM update
			sheetTabsContainer.appendChild(fragment);
		} catch (error) {
			console.error("Error rendering sheet names:", error);
			alert(error.message || "Could not retrieve sheet names.");
		}
	}

	//#region Event Handlers for Selection and Dragging

	/**
	 * Adds event listeners for column resizing.
	 * @private
	 */
	#AddResizing() {
		let styleSheet = document.getElementById("arbor-dynamic-styles");
		if (!styleSheet) {
			styleSheet = document.createElement("style");
			styleSheet.id = "arbor-dynamic-styles";
			document.head.appendChild(styleSheet);
		}

		const divclass = document.querySelectorAll(".resize");
		divclass.forEach((resizer) => {
			resizer.addEventListener("mousedown", (e) => {
				const th = e.target.parentElement;
				const col_class = th.classList[0];
				const startWidth = th.offsetWidth;
				const startX = e.pageX;

				const onMouseMove = (moveEvent) => {
					moveEvent.preventDefault();
					const newWidth = Math.max(
						50,
						startWidth + (moveEvent.pageX - startX),
					);

					// 1. Save the new width for THIS specific column into our Map
					this.customColWidths.set(col_class, newWidth);

					// 2. Rebuild the CSS string for ALL custom-sized columns
					let combinedCSS = "";
					this.customColWidths.forEach((width, colName) => {
						combinedCSS += `
                            td.${colName}, th.${colName} { width: ${width}px !important; min-width: ${width}px !important; max-width: ${width}px !important; }
                            td.${colName} input { width: ${width - 3}px !important; }
                        `;
					});

					// 3. Apply the combined CSS
					styleSheet.innerHTML = combinedCSS;
				};

				const onMouseUp = (e) => {
					e.preventDefault();
					document.removeEventListener("mousemove", onMouseMove);
					document.removeEventListener("mouseup", onMouseUp);
				};

				document.addEventListener("mousemove", onMouseMove);
				document.addEventListener("mouseup", onMouseUp);
			});
		});
	}

	/**
	 * Attaches global event listeners like keyboard navigation.
	 * @private
	 */
	#AttachGlobalEventListeners() {
		document.addEventListener("keydown", (e) => this.#HandleGlobalKeyDown(e));
		document.addEventListener("click", (e) => {
			if (!e.target.closest(".container")) {
				document.querySelectorAll(".dropdown").forEach((dropdown) => {
					dropdown.style.display = "none";
				});
			}
		});
	}

	#SelectCellRange(startRow, startColIdx, endRow, endColIdx) {
		this.SelectionModel.SelectCellRange(
			startRow,
			startColIdx,
			endRow,
			endColIdx,
			this.CurrentSpreadsheet?.Columns ||
				this.CurrentSpreadsheet?.columns ||
				[],
		);
	}

	/**
	 * Clears value data for all cells in the current selection.
	 * @private
	 */
	#ClearSelectedCellValues() {
		const entries = [];
		const columns =
			this.CurrentSpreadsheet?.Columns ||
			this.CurrentSpreadsheet?.columns ||
			[];

		this.SelectedRowKeys.forEach((rowKey) => {
			this.SelectedColKeys.forEach((colKey) => {
				const colIdx = columns.indexOf(colKey);
				if (colIdx !== -1) {
					entries.push({ RowKey: rowKey, ColKey: colIdx });
				}
			});
		});

		if (entries.length === 0) return;

		const command = new ClearRangeCommand(this.SpreadsheetModel, entries);
		if (this.CommandManager) {
			this.CommandManager.ExecuteCommand(command);
		} else {
			command.Execute();
		}
	}

	/**
	 * Handles global keyboard navigation for spreadsheet cells.
	 * @param {KeyboardEvent} e - The keyboard event.
	 * @private
	 */
	#HandleGlobalKeyDown(e) {
		// 0. Handle Undo / Redo Shortcuts (Ctrl+Z / Cmd+Z and Ctrl+Y / Cmd+Y)
		if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
			e.preventDefault();
			if (e.shiftKey) {
				this.Redo();
			} else {
				this.Undo();
			}
			return;
		}

		if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
			e.preventDefault();
			this.Redo();
			return;
		}

		const focused = document.activeElement;
		const isInputFocused =
			focused &&
			focused.tagName === "INPUT" &&
			focused.classList.contains("input-cell");

		// 1. Handle Bulk Delete / Clear Range
		if (e.key === "Delete" || e.key === "Backspace") {
			// Only trigger bulk delete if there's a multi-cell range selected.
			// If it's just 1 cell, let the user use backspace natively to edit their typo.
			const hasMultiSelection =
				this.selectedRowKeys.size > 1 || this.selectedColKeys.size > 1;

			if (hasMultiSelection) {
				e.preventDefault();
				this.#ClearSelectedCellValues();
				return;
			}
		}

		// 2. Stop executing if we aren't focused on a spreadsheet cell
		if (!isInputFocused) {
			return;
		}

		// Use current state from datasets
		const rowIdx = parseInt(focused.dataset.rowno);
		const colIdx = parseInt(focused.dataset.colno);

		const tableBody = focused.closest("tbody");

		// Helper to get input at specific coordinates
		const getCellInput = (rIdx, cIdx) => {
			const targetRow = Array.from(tableBody.children).find(
				(tr) => parseInt(tr.children[0].textContent) === rIdx,
			);

			if (targetRow) {
				const targetCell = targetRow.children[cIdx + 1];
				return targetCell?.querySelector("input.input-cell");
			}

			return null;
		};

		// 3. Handle Range Selection (Shift + Arrows)
		if (e.shiftKey && e.key.startsWith("Arrow")) {
			e.preventDefault();

			// FIX: Null-safe check applied here
			if (!this.anchorCell || this.anchorCell.row === null) {
				this.anchorCell = { row: rowIdx, colIdx: colIdx };
			}

			let nextRow = rowIdx;
			let nextCol = colIdx;

			// Determine target based on direction
			switch (e.key) {
				case "ArrowUp":
					nextRow = Math.max(1, rowIdx - 1);
					break;
				case "ArrowDown":
					nextRow = Math.min(this.currentSpreadsheet.maxRows, rowIdx + 1);
					break;
				case "ArrowLeft":
					nextCol = Math.max(0, colIdx - 1);
					break;
				case "ArrowRight":
					nextCol = Math.min(
						this.currentSpreadsheet.columns.length - 1,
						colIdx + 1,
					);
					break;
			}

			// Update Range Selection: Anchor -> current Arrow Target
			this.#SelectCellRange(
				this.anchorCell.row,
				this.anchorCell.colIdx,
				nextRow,
				nextCol,
			);

			// Move Focus to the expansion edge
			if (
				this.GridRenderer &&
				(nextRow < this.GridRenderer.StartRow ||
					nextRow > this.GridRenderer.EndRow)
			) {
				this.GridRenderer.ScrollToRow(nextRow);
			}
			const nextInput = getCellInput(nextRow, nextCol);
			if (nextInput) nextInput.focus();

			this.#UpdateHighlights();
		}
		// 4. Handle Standard Navigation (Arrows Only)
		else if (e.key.startsWith("Arrow")) {
			this.anchorCell = { row: null, colIdx: null }; // Reset selection anchor

			let targetRow = rowIdx;
			let targetCol = colIdx;

			switch (e.key) {
				case "ArrowUp":
					targetRow = Math.max(1, rowIdx - 1);
					break;
				case "ArrowDown":
					targetRow = Math.min(this.currentSpreadsheet.maxRows, rowIdx + 1);
					break;
				case "ArrowLeft":
					targetCol = Math.max(0, colIdx - 1);
					break;
				case "ArrowRight":
					targetCol = Math.min(
						this.currentSpreadsheet.columns.length - 1,
						colIdx + 1,
					);
					break;
			}

			if (
				this.GridRenderer &&
				(targetRow < this.GridRenderer.StartRow ||
					targetRow > this.GridRenderer.EndRow)
			) {
				this.GridRenderer.ScrollToRow(targetRow);
			}
			const nextInput = getCellInput(targetRow, targetCol);
			if (nextInput) {
				e.preventDefault();
				nextInput.focus();

				// Clear selection when moving focus normally to behave like Excel
				this.#ClearSelection();
				this.#UpdateHighlights();
			}
		}
	}

	/**
	 * Clears all current selection highlights.
	 * @private
	 */
	#ClearSelection() {
		this.SelectionModel.ClearSelection();
		this.#RemoveAllHighlights();
	}

	#HandleDragStart(rowKey, colIdx, type, event) {
		event.preventDefault(); // Prevents browser's native text selection on drag
		this.isDragging = true;
		this.#RemoveAllHighlights(); // Start with a fresh selection

		if (type === "cell") {
			this.dragStartRowKey = rowKey;
			this.dragStartColKey = colIdx; // This is the index
		} else if (type === "row") {
			this.dragStartRowKey = rowKey;
			this.selectedRowKeys.add(rowKey);
			this.selectedColKeys.clear(); // Clear other type of selection
		} else if (type === "col") {
			this.dragStartColKey = colIdx;
			this.selectedColKeys.add(colIdx);
			this.selectedRowKeys.clear(); // Clear other type of selection
		}
		this.#UpdateHighlights();
	}

	#HandleDragMove(event) {
		if (!this.isDragging) return;

		const target = event.target.closest("td");
		if (!target) return;

		const input = target.querySelector("input");
		if (!input) return;

		const currentRow = parseInt(input.dataset.rowno);
		const currentColIdx = parseInt(input.dataset.colno);

		if (this.dragStartRowKey !== null && this.dragStartColKey !== null) {
			this.#SelectCellRange(
				this.dragStartRowKey,
				this.dragStartColKey,
				currentRow,
				currentColIdx,
			);
			this.#UpdateHighlights();
		}
	}

	#HandleDragEnd(event) {
		if (!this.isDragging) return;

		this.isDragging = false;
		this.dragStartRowKey = null;
		this.dragStartColKey = null;
		// Important: Reset last clicked keys so that Shift+Click works correctly after a drag
		this.lastClickedRowKey =
			this.selectedRowKeys.size > 0 ? [...this.selectedRowKeys].pop() : null;
		this.lastClickedColKey =
			this.selectedColKeys.size > 0 ? [...this.selectedColKeys].pop() : null;
	}

	// You will need to make the existing #selectRowRange and #selectColumnRange methods
	// accessible to be called from the drag logic.
	#SelectRowRange(startKey, endKey) {
		this.SelectionModel.SelectRowRange(startKey, endKey);
	}

	#SelectColumnRange(startKey, endKey) {
		const colNames =
			this.CurrentSpreadsheet?.Columns ||
			this.CurrentSpreadsheet?.columns ||
			[];
		this.SelectionModel.SelectColumnRange(startKey, endKey, colNames);
	}

	SelectRow(rowKey, event) {
		event.preventDefault();
		const isRange = Boolean(event.shiftKey && this.LastClickedRowKey !== null);
		const isMulti = Boolean(event.ctrlKey || event.metaKey);
		this.SelectionModel.SelectRow(rowKey, isMulti, isRange);
		this.#UpdateHighlights();
	}

	SelectColumn(colKey, event) {
		const isRange = Boolean(event.shiftKey && this.LastClickedColKey !== null);
		const isMulti = Boolean(event.ctrlKey || event.metaKey);
		const colNames =
			this.CurrentSpreadsheet?.Columns ||
			this.CurrentSpreadsheet?.columns ||
			[];
		this.SelectionModel.SelectColumn(colKey, isMulti, isRange, colNames);
		this.#UpdateHighlights();
	}

	#SelectSingleRow(rowKey) {
		this.SelectionModel.SelectRow(rowKey, false, false);
	}

	#ToggleSingleRow(rowKey) {
		this.SelectionModel.ToggleSingleRow(rowKey);
	}

	#SelectSingleCol(colKey) {
		const colNames =
			this.CurrentSpreadsheet?.Columns ||
			this.CurrentSpreadsheet?.columns ||
			[];
		this.SelectionModel.SelectColumn(colKey, false, false, colNames);
	}

	#ToggleSingleCol(colKey) {
		this.SelectionModel.ToggleSingleCol(colKey);
	}

	/**
	 * Highlights only the cells where selected rows and selected columns overlap.
	 * @param {HTMLElement} tableBody - The tbody element of the current sheet.
	 * @private
	 */
	#HighlightIntersection(tableBody) {
		this.selectedRowKeys.forEach((rowKey) => {
			const tr = tableBody.querySelector(`tr[data-rowno="${rowKey}"]`);

			if (tr) {
				this.selectedColKeys.forEach((colKey) => {
					const td = tr.querySelector(`td.${colKey}`);

					if (td) {
						td.classList.add("selected-cell");
					}
				});
			}
		});
	}

	#UpdateHighlights() {
		if (this.GridRenderer) {
			this.GridRenderer.UpdateHighlights();
			return;
		}

		// 1. Wipe the slate clean
		this.#RemoveAllHighlights();

		if (!this.currentSpreadsheet) return;
		const sheetName = this.currentSpreadsheet.sheetName;
		const tableBody = document.getElementById(`${sheetName}-data-input`);
		if (!tableBody) return;

		// 2. Highlight Rows
		this.selectedRowKeys.forEach((rowKey) => {
			const tr = tableBody.querySelector(`tr[data-rowno="${rowKey}"]`);
			if (tr) {
				tr.classList.add("selected-row");
			}
		});

		// 3. Highlight Columns
		this.selectedColKeys.forEach((colKey) => {
			document.querySelectorAll(`.${colKey}`).forEach((el) => {
				el.classList.add("selected-col");
			});
		});

		// 4. Highlight the Intersection (The actual selected cells)
		// This is optional but makes it look like a real spreadsheet
		if (this.selectedRowKeys.size > 0 && this.selectedColKeys.size > 0) {
			this.#HighlightIntersection(tableBody);
		}
	}

	/**
	 * Removes all selection-related CSS classes from the DOM.
	 * @private
	 */
	#RemoveAllHighlights() {
		if (this.GridRenderer) {
			this.GridRenderer.ClearHighlights();
			return;
		}

		// 1. Clear Row highlights
		document
			.querySelectorAll(".selected-row")
			.forEach((el) => el.classList.remove("selected-row"));

		// 2. Clear Column highlights
		document
			.querySelectorAll(".selected-col")
			.forEach((el) => el.classList.remove("selected-col"));

		// 3. Clear Individual Cell highlights (The rectangular range)
		document
			.querySelectorAll(".selected-cell")
			.forEach((el) => el.classList.remove("selected-cell"));
	}

	/**
	 * Applies a background color to the currently selected row or column.
	 * @param {string} color - The CSS color string (e.g., "#FF0000", "blue").
	 */
	ApplyBackgroundColor(color) {
		if (this.SelectedRowKeys.size === 0 || this.SelectedColKeys.size === 0)
			return;

		const styleUpdate = { backgroundColor: color };
		const compoundCmd = new CompoundCommand([], "Apply Background Color");
		const columns =
			this.CurrentSpreadsheet?.Columns ||
			this.CurrentSpreadsheet?.columns ||
			[];

		this.SelectedRowKeys.forEach((rowKey) => {
			this.SelectedColKeys.forEach((colKey) => {
				const colIdx = columns.indexOf(colKey);
				if (colIdx !== -1) {
					const cellCmd = new SetCellCommand(
						this.SpreadsheetModel,
						rowKey,
						colIdx,
						undefined,
						styleUpdate,
					);
					compoundCmd.AddCommand(cellCmd);
				}
			});
		});

		if (compoundCmd.Commands.length > 0) {
			if (this.CommandManager) {
				this.CommandManager.ExecuteCommand(compoundCmd);
			} else {
				compoundCmd.Execute();
			}
		}

		this.#ClearSelection();
	}

	/**
	 * Applies a color to all selected rows.
	 * @param {string} color - The CSS color string (e.g., "#FF0000", "blue").
	 */
	ApplyColorToSelectedRows(color) {
		if (this.SelectedRowKeys.size === 0) return;

		const styleUpdate = { backgroundColor: color };
		const compoundCmd = new CompoundCommand([], "Apply Row Color");
		const columns =
			this.CurrentSpreadsheet?.Columns ||
			this.CurrentSpreadsheet?.columns ||
			[];

		this.SelectedRowKeys.forEach((rowKey) => {
			columns.forEach((colName, colIdx) => {
				const cellCmd = new SetCellCommand(
					this.SpreadsheetModel,
					rowKey,
					colIdx,
					undefined,
					styleUpdate,
				);
				compoundCmd.AddCommand(cellCmd);
			});
		});

		if (compoundCmd.Commands.length > 0) {
			if (this.CommandManager) {
				this.CommandManager.ExecuteCommand(compoundCmd);
			} else {
				compoundCmd.Execute();
			}
		}

		this.#ClearSelection();
	}
}
