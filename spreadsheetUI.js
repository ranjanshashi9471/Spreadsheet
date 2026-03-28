// SpreadsheetUI.js (Updated)

class SpreadsheetUI {
	constructor(rootElementId) {
		this.rootElement = document.getElementById(rootElementId);
		if (!this.rootElement) {
			console.error(`Root element with ID '${rootElementId}' not found.`);
			return;
		}
		this.spreadsheetService = new BackendService(); // Reference to the backend service

		this.selectedRowKeys = new Set();
		this.selectedColKeys = new Set();
		this.lastClickedRowKey = null;
		this.lastClickedColKey = null;

		this.anchorCell = null;
		this.isDragging = false;
		this.dragStartRowKey = null;
		this.dragStartColKey = null;

		this.currentSpreadsheet = null;
	}

	/**
	 * Renders the initial,Complete Start UI of the application.
	 */
	initializeUI() {
		this.#renderBaseUI();
		this.#attachGlobalEventListeners();

		document.addEventListener("mousemove", (e) => this.#handleDragMove(e));
		document.addEventListener("mouseup", (e) => this.#handleDragEnd(e));
	}

	/**
	 * Renders the initial, base UI structure of the application.
	 * @private
	 */
	#renderBaseUI() {
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
				this.addNewSheetInput();
			});
		document
			.getElementById("renderDbDumpInputBtn")
			?.addEventListener("click", (e) => {
				e.preventDefault();
				this.renderDbDumpInput();
			});
		document
			.getElementById("renderSchemaInputBtn")
			?.addEventListener("click", (e) => {
				e.preventDefault();
				this.renderSchemaInput();
			});
		document
			.getElementById("renderSQLInputBtn")
			?.addEventListener("click", (e) => {
				e.preventDefault();
				this.renderSQLInput();
			});
	}

	/**
	 * Displays UI for adding a new sheet (rows and columns input).
	 */
	addNewSheetInput() {
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
				await this.startBlankSpreadsheet();
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
	renderDbDumpInput() {
		const space = document.getElementById("global-input-space");
		space.innerHTML = `
            <input type="file" id="dbDumpFileInput" class="styled-input">
            <button class="toolbar-btn" id="cancelInputBtn">Cancel</button>
        `;
		document
			.getElementById("dbDumpFileInput")
			.addEventListener("change", (e) => {
				this.handleDbDumpFile(e);
				space.innerHTML = "";
			});
		document
			.getElementById("cancelInputBtn")
			.addEventListener("click", () => (space.innerHTML = ""));
	}

	/**
	 * Displays UI for loading a schema SQL file.
	 */
	renderSchemaInput() {
		const space = document.getElementById("global-input-space");
		space.innerHTML = `
            <input type="file" id="schemaFileInput" class="styled-input">
            <button class="toolbar-btn" id="cancelInputBtn">Cancel</button>
        `;
		document
			.getElementById("schemaFileInput")
			.addEventListener("change", (e) => {
				this.handleDbDumpFile(e);
				space.innerHTML = "";
			});

		document
			.getElementById("cancelInputBtn")
			.addEventListener("click", () => (space.innerHTML = ""));
	}

	/**
	 * Displays UI for running an arbitrary SQL query in the top toolbar.
	 */
	renderSQLInput() {
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
				this.executeUserQuery(event);
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
	async handleDbDumpFile(event) {
		event.preventDefault();
		try {
			const file = event.target.files[0];
			await this.spreadsheetService.loadDump(file);
			await this.renderSheetsNames(event, false);
		} catch (error) {
			console.error(error);
			alert(error.message || "Error Loading Dump!!");
		}
	}

	/**
	 * Handles loading a SQL schema file selected by the user.
	 * @param {Event} event - The file input change event.
	 */
	handleSchemaFile(event) {
		event.preventDefault();
		try {
			const file = event.target.files[0];
			const reader = new FileReader();
			reader.readAsText(file);
			reader.onload = async (e) => {
				e.preventDefault();
				await this.spreadsheetService.runSchema(e.target.result);
				this.renderSheetsNames(e, false);
			};
		} catch (error) {
			console.error(error);
			alert(error.message || "Error in running the schema file");
		}
	}

	/**
	 * Executes a user-provided SQL query and displays the results.
	 */
	async executeUserQuery(event) {
		event.preventDefault();
		const query = document.getElementById("query-input").value;
		if (!query.trim()) {
			alert("Please enter an SQL query.");
			return;
		}
		console.log("Executing query:", query);
		try {
			const res = await this.spreadsheetService.runQuery(query);
			const output = document.getElementById("user-select");
			output.innerHTML = "";
			if (res) {
				output.innerHTML = `
                    <table border="1">
                        <thead>
                            <tr class="table-header" id="tmp_header"></tr>
                        </thead>
                        <tbody id="tmp-data-output" class="table-body">
                            </tbody>
                    </table>`;
				const header = document.getElementById("tmp_header");
				const tbody = document.getElementById("tmp-data-output");
				const headrow = document.createElement("tr");
				res.columns.forEach((colName) => {
					const th = document.createElement("th");
					th.innerHTML = colName;
					headrow.appendChild(th);
				});
				header.appendChild(headrow);
				res.values.forEach((row) => {
					const bodyrow = document.createElement("tr");
					row.forEach((col) => {
						const td = document.createElement("td");
						td.innerHTML = col;
						bodyrow.appendChild(td);
					});
					tbody.appendChild(bodyrow);
				});
			} else {
				alert("Query executed successfully (no data returned for display).");
				this.renderSheetsNames(event, false);
			}
		} catch (error) {
			alert(error.message || "Error Executing Query");
			console.error(error);
		}
	}

	/**
	 * Converts a 0-based integer index to a string "C" + index.
	 * Example: 0 -> "C0", 25 -> "C25", 26 -> "C26"
	 * @param {number} n - The 0-based column index.
	 * @returns {string} The column name.
	 * @private
	 */
	#toColumnName(n) {
		return `C${n}`;
	}

	#toColumnIndex(colName) {
		return parseInt(colName.substring(1), 10);
	}

	/**
	 * Refreshes the entire table UI (Headers, Body, Features, Resizers).
	 * Call this whenever the full sheet needs to be drawn or redrawn.
	 */
	#refreshTableUI() {
		if (!this.currentSpreadsheet) return;

		// 1. Setup the container
		this.#renderTableStructure();

		// 2. Render Column Headers (A, B, C...)
		this.#renderColHead();

		// 3. Render Top Bar Features (Buttons, Search, etc.)
		this.#renderSheetFeatures(this.currentSpreadsheet.isInMemory);

		// 4. Render the Grid Data (The Unified Renderer)
		this.#renderTableBody();

		// 5. Re-attach resizing listeners
		this.#addResizing();
	}

	/**
	 * Renders the table rows and cells based on the currentSpreadsheet data structure.
	 * This works for both In-Memory new sheets and DB-loaded sheets.
	 */
	#renderTableBody() {
		const sheetName = this.currentSpreadsheet.sheetName;
		const rows = this.currentSpreadsheet.maxRows;
		const cols = this.currentSpreadsheet.columns; // This should be an array of column keys
		const isInMemory = this.currentSpreadsheet.isInMemory;

		const tbody = document.getElementById(`${sheetName}-data-input`);
		tbody.innerHTML = "";

		// Performance: Use DocumentFragment to batch DOM insertions
		const fragment = document.createDocumentFragment();

		for (let rowno = 1; rowno <= rows; rowno++) {
			const tr = document.createElement("tr");

			// 1. Render Row Header (c0 / ID column)
			const tdId = document.createElement("td");
			tdId.innerHTML = `${rowno}`;
			tdId.classList.add("C0");
			// Store metadata for selection logic
			tdId.dataset.rowKey = rowno;
			tdId.addEventListener("click", (e) => this.selectRow(rowno, e));
			tr.appendChild(tdId);

			// 2. Render Data Columns
			cols.forEach((colName, colKey) => {
				colName = isInMemory ? this.#toColumnName(colKey + 1) : colName;

				const td = document.createElement("td");
				const inputContainer = document.createElement("div");
				inputContainer.className = "container";

				td.addEventListener("mousedown", (e) => {
					// If user clicks the cell background (not the input specifically)
					if (e.target === td) {
						this.#handleDragStart(rowno, colKey, "cell", e);
					}
				});

				const input = document.createElement("input");
				input.type = "text";
				input.className = `${colName} input-cell`;
				input.name = sheetName;

				// RETRIEVE DATA: Get value,style from the data structure
				const cellVal = this.currentSpreadsheet.retrieveCellData(rowno, colKey);
				input.value = cellVal == null ? "" : cellVal.value;

				// RETRIEVE STYLE: Get style from the data structure
				const cellStyle = cellVal == null ? null : cellVal.style;
				if (cellStyle && typeof cellStyle === "object") {
					// Apply saved styles (e.g., background color) to the TD
					Object.assign(td.style, cellStyle);
				}

				// DATASET attributes for Event Handling
				input.dataset.rowno = rowno;
				input.dataset.colno = colKey;
				input.dataset.isinmemory = isInMemory.toString();

				// EVENT LISTENER: Unified Handler
				input.addEventListener("input", (e) =>
					this.handleInputChange(e, rowno, colKey, isInMemory),
				);

				// Dropdown for Suggestions
				const ul = document.createElement("ul");
				ul.type = "none";
				ul.className = "dropdown";
				ul.id = `${sheetName}-${rowno}-${colKey}-dropdown`;

				inputContainer.appendChild(input);
				inputContainer.appendChild(ul);
				td.appendChild(inputContainer);

				// Add class for column selection
				td.classList.add(colName);

				tr.appendChild(td);
			});

			fragment.appendChild(tr);
		}

		// Single Reflow
		tbody.appendChild(fragment);
	}

	/**
	 * Initiates the creation of a new in-memory spreadsheet and prepares the UI.
	 * This does NOT immediately save to the database.
	 */
	startBlankSpreadsheet() {
		const rowCountInput = document.getElementById("user-rows");
		const colCountInput = document.getElementById("user-columns");

		const rows = parseInt(rowCountInput.value, 10);
		const columns = parseInt(colCountInput.value, 10);

		if (isNaN(rows) || rows <= 0 || isNaN(columns) || columns <= 0) {
			alert("Please enter valid positive numbers.");
			return;
		}

		const tempSheetName = `sheet_${Math.floor(Math.random() * 100000)}`;

		// 1. Initialize Data Structure
		this.currentSpreadsheet = new Spreadsheet(tempSheetName);
		this.currentSpreadsheet.maxRows = rows;
		this.currentSpreadsheet.isInMemory = true;

		// 2. Populate Column Keys
		// We store the generated name (A, B, C) as the key in the structure
		for (let i = 1; i <= columns; i++) {
			this.currentSpreadsheet.columns.push(this.#toColumnName(i));
		}

		// 4. Render
		this.#refreshTableUI();

		alert(`New sheet '${tempSheetName}' created.`);
	}

	/**
	 * Renders the UI for a specific spreadsheet (table) from the database.
	 * This will clear any active in-memory spreadsheet.
	 * @param {Event} event - The event object.
	 * @param {string} sheetName - The name of the sheet (table) to render.
	 * @param {boolean} isInMemory - True if this is an in-memory spreadsheet, false if DB-backed.
	 */
	async renderSheet(event, sheetName, isInMemory) {
		if (event) event.preventDefault();

		try {
			this.#clearSelection();

			// 1. Load Data into Structure (handled by Service)
			this.currentSpreadsheet = await this.spreadsheetService.loadSpreadsheet(
				sheetName,
				isInMemory,
			);

			if (this.currentSpreadsheet) {
				// 2. Render
				this.#refreshTableUI();
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
	#renderColHead() {
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
				this.selectColumn(colName, e);
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
	 * @param {string} sheetName - The name of the sheet.
	 * @private
	 */
	#renderTableStructure() {
		const sheetName = this.currentSpreadsheet.sheetName;
		const userSelect = document.getElementById("user-select");
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

	/**
	 * Renders additional UI features like insert rows, save buttons.
	 * @param {boolean} isInMemory - True if this is an in-memory spreadsheet (show save button), false otherwise.
	 * @private
	 */
	#renderSheetFeatures(isInMemory) {
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
			this.applyBackgroundColor(
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
		insertRowsButton.addEventListener("click", (e) => this.insertRows(e));

		layoutGroup.appendChild(rowCountInput);
		layoutGroup.appendChild(insertRowsButton);

		// --- Sync/Data Group ---
		const syncGroup = document.createElement("div");
		syncGroup.style.cssText = "display: flex; align-items: center; gap: 5px;";

		const saveToDbButton = document.createElement("button");
		saveToDbButton.className = "toolbar-btn success";
		saveToDbButton.textContent = "Save to DB";
		saveToDbButton.addEventListener("click", (e) =>
			this.saveSpreadsheetToDb(e),
		);

		const exportJsonButton = document.createElement("button");
		exportJsonButton.className = "toolbar-btn";
		exportJsonButton.textContent = "Export JSON";
		exportJsonButton.addEventListener("click", (e) => this.exportJson(e));

		const renderJsonInputBtn = document.createElement("button");
		renderJsonInputBtn.className = "toolbar-btn";
		renderJsonInputBtn.textContent = "Import JSON";
		renderJsonInputBtn.addEventListener("click", (e) => {
			e.preventDefault();
			this.#renderJsonInput();
		});

		const exportDbDumpButton = document.createElement("button");
		exportDbDumpButton.className = "toolbar-btn";
		exportDbDumpButton.textContent = "Export Dump";
		exportDbDumpButton.addEventListener("click", (e) =>
			this.handleExportDBdump(e),
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
	#renderJsonInput() {
		const space = document.getElementById("global-input-space");

		// Inject the file input and cancel button
		space.innerHTML = `
            <span style="font-size: 13px; color: #5f6368; font-weight: 500;">Select JSON:</span>
            <input type="file" id="jsonFileInput" class="styled-input" accept=".json">
            <button class="toolbar-btn" id="cancelJsonInputBtn">Cancel</button>
        `;

		// 1. Listen for the file selection
		document.getElementById("jsonFileInput").addEventListener("change", (e) => {
			// We pass the event to your existing loadJson method
			this.loadJson(e);
			// Instantly clear the input space so the UI returns to normal
			space.innerHTML = "";
		});

		// 2. Listen for the Cancel action
		document
			.getElementById("cancelJsonInputBtn")
			.addEventListener("click", (e) => {
				e.preventDefault();
				space.innerHTML = "";
			});
	}

	/**
	 * Inserts empty rows into the current sheet.
	 * Behavior differs for in-memory vs. database-backed sheets.
	 * @param {string} sheetName - The name of the sheet.
	 * @param {string} colsListString - Comma-separated string of column names.
	 * @param {boolean} isInMemory - True if inserting into the in-memory AVL spreadsheet.
	 */
	async insertRows(event) {
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
						await this.spreadsheetService.getTableMetadata(sheetName);
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

			for (let i = 0; i < rowsToInsert; i++) {
				const currentRowId = startRowId + i;
				const bodyRow = document.createElement("tr");
				for (let j = 0; j < columns.length; j++) {
					const tableCol = document.createElement("td");
					if (j !== 0) {
						const inputContainer = document.createElement("div");
						inputContainer.className = "container";
						const input = document.createElement("input");
						input.className = `${columns[j]} input-cell`;
						input.type = "text";
						input.name = sheetName;
						input.value = "";
						input.dataset.rowno = currentRowId;
						input.dataset.colname = columns[j];
						input.dataset.isinmemory = isInMemory;
						input.addEventListener("input", (event) => {
							event.preventDefault();
							this.handleInputChange(
								event,
								currentRowId,
								columns[j],
								isInMemory,
							);
						});
						const dropdownList = document.createElement("ul");
						dropdownList.type = "none";
						dropdownList.id = `${sheetName}-${columns[j]}-dropdown`;
						dropdownList.className = "dropdown";
						inputContainer.appendChild(input);
						inputContainer.appendChild(dropdownList);
						tableCol.appendChild(inputContainer);
						tableCol.classList.add(columns[j]);
					} else {
						tableCol.innerHTML = `${currentRowId}`;
						tableCol.classList.add(columns[j]);
						tableCol.addEventListener("click", (e) => {
							e.preventDefault();
							this.selectRow(currentRowId, e);
						});
					}
					bodyRow.appendChild(tableCol);
				}
				tableBody.appendChild(bodyRow);
			}
			rowsInput.value = "";
		} catch (error) {
			console.error("Error Inserting Rows");
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
	async handleInputChange(event, rowno, colno, isInMemory) {
		event.preventDefault();
		const { name: sheetName, value } = event.target;
		const dropdown = document.getElementById(
			`${sheetName}-${rowno}-${colno}-dropdown`,
		);

		if (isInMemory) {
			this.currentSpreadsheet.insertData(rowno, colno, value);
			dropdown.style.display = "none";
			return;
		}

		try {
			const pKeyList = Array.from(this.currentSpreadsheet.primaryKeys).map(
				(colId, _id) => this.currentSpreadsheet.columns[colId],
			);

			const pKeyValues = this.currentSpreadsheet.primaryKeyMap.get(rowno);

			const updateInfo = await this.spreadsheetService.getCellUpdateInfo(
				sheetName,
				pKeyList,
				pKeyValues,
				this.currentSpreadsheet.columns[colno],
				value,
			);

			if (updateInfo.type !== "foreignKey") {
				dropdown.style.display = "none";
				this.currentSpreadsheet.insertData(rowno, colno, value);
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
								this.currentSpreadsheet.insertData(
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
			console.error("Error in handleInputChange (DB-backed):", error);
			dropdown.style.display = "none";
			alert("Error handling cell input. Check console for details.");
		}
	}

	/**
	 * Saves the current in-memory spreadsheet (AVL of AVL) to the database.
	 * This will create a new table in the DB and populate it.
	 */
	async saveSpreadsheetToDb(event) {
		if (!this.currentSpreadsheet) {
			alert("No in-memory spreadsheet to save.");
			return;
		}
		try {
			if (this.currentSpreadsheet.isInMemory) {
				this.currentSpreadsheet.columns = this.currentSpreadsheet.columns.map(
					(col) => this.#toColumnIndex(col),
				);
			}

			await this.spreadsheetService.SaveSpreadsheetChanges(
				this.currentSpreadsheet,
			);

			alert(
				`Spreadsheet '${this.currentSpreadsheet.sheetName}' successfully saved to database.`,
			);

			this.currentSpreadsheet.clear();
			await this.renderSheetsNames(event, this.currentSpreadsheet.isInMemory);
		} catch (error) {
			console.error("Error saving in-memory spreadsheet to DB:", error);
			alert(`Error saving spreadsheet to database: ${error.message}`);
		}
	}

	/**
	 * Generates and downloads a database dump file.
	 * @param {Event} event - The click event (not directly used, but passed for consistency).
	 */
	async handleExportDBdump(event) {
		event.preventDefault();
		try {
			const dump = await this.spreadsheetService.exportDb();
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
	async exportJson(event) {
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
	async loadJson(event) {
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
			this.#renderTableBody();
			alert("JSON file imported successfully.");
		} catch (error) {
			console.error("Error importing JSON file:", error);
			alert(error.message || "Error importing JSON file.");
		}
	}

	/**
	 * Renders the names of all sheets (tables) in the side panel.
	 * @param {Event} event - The event object.
	 * @param {boolean} isInMemory - True to load sheets as in-memory AVL spreadsheets, false for DB-backed.
	 */
	async renderSheetsNames(event, isInMemory = true) {
		try {
			const sheetTabsContainer = document.getElementById("sheet-tabs");
			if (!sheetTabsContainer) return;

			sheetTabsContainer.innerHTML = ""; // Clear existing tabs

			const tableNames =
				await this.spreadsheetService.getSheetNames(isInMemory);

			if (tableNames.length > 0) {
				tableNames.forEach((tableName) => {
					const tab = document.createElement("div");
					tab.textContent = tableName;
					// Check if this is the currently active sheet to highlight the tab
					const isActive =
						this.currentSpreadsheet &&
						this.currentSpreadsheet.sheetName === tableName;

					tab.className = `sheet-tab ${isActive ? "active" : ""}`;

					tab.addEventListener("click", async (e) => {
						e.preventDefault();
						await this.renderSheet(e, tableName, isInMemory);
						// Re-render tabs to update the 'active' class
						this.renderSheetsNames(e, isInMemory);
					});

					sheetTabsContainer.appendChild(tab);
				});
			} else {
				sheetTabsContainer.innerHTML = `<span style="color: #888; font-size: 0.9em;">No sheets available in DB.</span>`;
			}
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
	#addResizing() {
		const divclass = document.querySelectorAll(".resize");
		divclass.forEach((resizer) => {
			resizer.removeEventListener("mousedown", resizer._boundMouseDownHandler);
			resizer._boundMouseDownHandler = (e) => {
				const th = e.target.parentElement;
				const col_class = th.classList[0];
				const startWidth = th.offsetWidth;
				const startX = e.pageX;
				const onMouseMove = (moveEvent) => {
					moveEvent.preventDefault();
					const newWidth = startWidth + (moveEvent.pageX - startX);
					if (newWidth >= 50) {
						document.querySelectorAll(`.${col_class}`).forEach((element) => {
							if (element.tagName === "INPUT") {
								element.style.width = `${newWidth - 3}px`;
							} else {
								element.style.width = `${newWidth}px`;
							}
						});
					}
				};
				const onMouseUp = (e) => {
					e.preventDefault();
					document.removeEventListener("mousemove", onMouseMove);
					document.removeEventListener("mouseup", onMouseUp);
				};
				document.addEventListener("mousemove", onMouseMove);
				document.addEventListener("mouseup", onMouseUp);
			};
			resizer.addEventListener("mousedown", resizer._boundMouseDownHandler);
		});
	}

	/**
	 * Attaches global event listeners like keyboard navigation.
	 * @private
	 */
	#attachGlobalEventListeners() {
		document.addEventListener("keydown", (e) => this.#handleGlobalKeyDown(e));
		document.addEventListener("click", (e) => {
			if (!e.target.closest(".container")) {
				document.querySelectorAll(".dropdown").forEach((dropdown) => {
					dropdown.style.display = "none";
				});
			}
		});
	}

	#selectCellRange(startRow, startColIdx, endRow, endColIdx) {
		this.selectedRowKeys.clear();
		this.selectedColKeys.clear();

		// Rows
		const rStart = Math.min(startRow, endRow);
		const rEnd = Math.max(startRow, endRow);
		for (let r = rStart; r <= rEnd; r++) this.selectedRowKeys.add(r);

		// Columns
		const cStart = Math.min(startColIdx, endColIdx);
		const cEnd = Math.max(startColIdx, endColIdx);
		for (let c = cStart; c <= cEnd; c++) {
			const colKey = this.currentSpreadsheet.columns[c];
			this.selectedColKeys.add(colKey);
		}
	}

	/**
	 * Clears value data for all cells in the current selection.
	 * @private
	 */
	#clearSelectedCellValues() {
		this.selectedRowKeys.forEach((rowKey) => {
			this.selectedColKeys.forEach((colKey) => {
				const colIdx = this.currentSpreadsheet.columns.indexOf(colKey);

				// 1. Update AVL Tree
				this.currentSpreadsheet.insertData(rowKey, colIdx, "");

				// 2. Update DOM
				const input = document.querySelector(
					`input[data-rowno="${rowKey}"][data-colno="${colIdx}"]`,
				);
				if (input) input.value = "";
			});
		});
	}

	/**
	 * Handles global keyboard navigation for spreadsheet cells.
	 * @param {KeyboardEvent} e - The keyboard event.
	 * @private
	 */
	#handleGlobalKeyDown(e) {
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
				this.#clearSelectedCellValues();
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
			this.#selectCellRange(
				this.anchorCell.row,
				this.anchorCell.colIdx,
				nextRow,
				nextCol,
			);

			// Move Focus to the expansion edge
			const nextInput = getCellInput(nextRow, nextCol);
			if (nextInput) nextInput.focus();

			this.#updateHighlights();
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

			const nextInput = getCellInput(targetRow, targetCol);
			if (nextInput) {
				e.preventDefault();
				nextInput.focus();

				// Clear selection when moving focus normally to behave like Excel
				this.#clearSelection();
				this.#updateHighlights();
			}
		}
	}

	/**
	 * Clears all current selection highlights.
	 * @private
	 */
	#clearSelection() {
		this.selectedRowKeys.clear();
		this.selectedColKeys.clear();
		this.anchorCell = { row: null, colIdx: null };

		// Visually update the UI to reflect the empty state
		this.#removeAllHighlights();
	}

	#handleDragStart(rowKey, colIdx, type, event) {
		event.preventDefault(); // Prevents browser's native text selection on drag
		this.isDragging = true;
		this.#removeAllHighlights(); // Start with a fresh selection

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
		this.#updateHighlights();
	}

	#handleDragMove(event) {
		if (!this.isDragging) return;

		const target = event.target.closest("td");
		if (!target) return;

		const input = target.querySelector("input");
		if (!input) return;

		const currentRow = parseInt(input.dataset.rowno);
		const currentColIdx = parseInt(input.dataset.colno);

		if (this.dragStartRowKey !== null && this.dragStartColKey !== null) {
			this.#selectCellRange(
				this.dragStartRowKey,
				this.dragStartColKey,
				currentRow,
				currentColIdx,
			);
			this.#updateHighlights();
		}
	}

	#handleDragEnd(event) {
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
	#selectRowRange(startKey, endKey) {
		this.selectedRowKeys.clear();
		this.selectedColKeys.clear();
		const start = Math.min(startKey, endKey);
		const end = Math.max(startKey, endKey);
		const tableBody = document.getElementById(
			`${this.currentSpreadsheet.sheetName}-data-input`,
		);
		if (tableBody) {
			Array.from(tableBody.children).forEach((tr) => {
				const rowId = parseInt(tr.children[0].textContent, 10);
				if (rowId >= start && rowId <= end) {
					this.selectedRowKeys.add(rowId);
				}
			});
		}
	}

	#selectColumnRange(startKey, endKey) {
		this.selectedColKeys.clear();
		this.selectedRowKeys.clear();
		const colNames = this.currentSpreadsheet.columns;
		const startIndex = colNames.indexOf(startKey);
		const endIndex = colNames.indexOf(endKey);
		const start = Math.min(startIndex, endIndex);
		const end = Math.max(startIndex, endIndex);
		for (let i = start; i <= end; i++) {
			this.selectedColKeys.add(colNames[i]);
		}
	}

	selectRow(rowKey, event) {
		event.preventDefault();
		if (event.shiftKey && this.lastClickedRowKey !== null) {
			this.#selectRowRange(this.lastClickedRowKey, rowKey);
		} else if (event.ctrlKey || event.metaKey) {
			this.#toggleSingleRow(rowKey);
			this.lastClickedRowKey = rowKey;
		} else {
			this.#selectSingleRow(rowKey);
		}
		this.#updateHighlights();
	}

	selectColumn(colKey, event) {
		if (event.shiftKey && this.lastClickedColKey !== null) {
			this.#selectColumnRange(this.lastClickedColKey, colKey);
		} else if (event.ctrlKey || event.metaKey) {
			this.#toggleSingleCol(colKey);
			this.lastClickedColKey = colKey;
		} else {
			this.#selectSingleCol(colKey);
		}
		this.#updateHighlights();
	}

	#selectSingleRow(rowKey) {
		this.selectedRowKeys.clear();
		this.selectedColKeys.clear();
		this.selectedRowKeys.add(rowKey);
		this.lastClickedRowKey = rowKey;
	}

	#toggleSingleRow(rowKey) {
		if (this.selectedRowKeys.has(rowKey)) {
			this.selectedRowKeys.delete(rowKey);
		} else {
			this.selectedRowKeys.add(rowKey);
		}
	}

	#selectSingleCol(colKey) {
		this.selectedColKeys.clear();
		this.selectedRowKeys.clear();
		this.selectedColKeys.add(colKey);
		this.lastClickedColKey = colKey;
	}

	#toggleSingleCol(colKey) {
		if (this.selectedColKeys.has(colKey)) {
			this.selectedColKeys.delete(colKey);
		} else {
			this.selectedColKeys.add(colKey);
		}
	}

	/**
	 * Highlights only the cells where selected rows and selected columns overlap.
	 * @param {HTMLElement} tableBody - The tbody element of the current sheet.
	 * @private
	 */
	#highlightIntersection(tableBody) {
		// We only iterate through the selected rows to save performance
		this.selectedRowKeys.forEach((rowKey) => {
			const tr = Array.from(tableBody.children).find(
				(row) => parseInt(row.children[0].textContent, 10) === rowKey,
			);

			if (tr) {
				// Within the selected row, check every cell
				Array.from(tr.children).forEach((td, index) => {
					if (index === 0) return; // Skip the row header (c0)

					// Get the column name/key for this cell index
					const colKey = this.currentSpreadsheet.columns[index - 1];

					// If this column is ALSO selected, we have an intersection!
					if (this.selectedColKeys.has(colKey)) {
						td.classList.add("selected-cell");
					}
				});
			}
		});
	}

	#updateHighlights() {
		// 1. Wipe the slate clean
		this.#removeAllHighlights();

		if (!this.currentSpreadsheet) return;
		const sheetName = this.currentSpreadsheet.sheetName;
		const tableBody = document.getElementById(`${sheetName}-data-input`);
		if (!tableBody) return;

		// 2. Highlight Rows
		this.selectedRowKeys.forEach((rowKey) => {
			const tr = Array.from(tableBody.children).find(
				(row) => parseInt(row.children[0].textContent, 10) === rowKey,
			);
			tr?.classList.add("selected-row");
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
			this.#highlightIntersection(tableBody);
		}
	}

	/**
	 * Removes all selection-related CSS classes from the DOM.
	 * @private
	 */
	#removeAllHighlights() {
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
	applyBackgroundColor(color) {
		if (this.selectedRowKeys.size === 0 || this.selectedColKeys.size === 0) {
			alert("Please select a range of cells first.");
			return;
		}

		const sheetName = this.currentSpreadsheet.sheetName;
		const styleUpdate = { backgroundColor: color };

		// Efficiently loop through the selection Sets
		this.selectedRowKeys.forEach((rowKey) => {
			this.selectedColKeys.forEach((colKey) => {
				const colIdx = this.currentSpreadsheet.columns.indexOf(colKey);

				// 1. Update In-Memory AVL Tree (Merge style)
				this.currentSpreadsheet.insertData(
					rowKey,
					colIdx,
					undefined,
					styleUpdate,
				);

				// 2. Update the UI
				const input = document.querySelector(
					`input[data-rowno="${rowKey}"][data-colno="${colIdx}"]`,
				);
				if (input) {
					const td = input.closest("td");
					td.style.backgroundColor = color;
				}
			});
		});

		this.#clearSelection();
	}

	/**
	 * Applies a persistent style to a row and saves it to the internal data structure.
	 * @param {number} rowKey - The row number.
	 * @param {Object} styleObj - Style properties (e.g., { backgroundColor: 'red' }).
	 * @private
	 */
	#applyStyleToRowUI(rowKey, styleObj) {
		const sheetName = this.currentSpreadsheet.sheetName;
		const tableBody = document.getElementById(`${sheetName}-data-input`);
		if (!tableBody) return;

		// 1. Find the TR in the DOM
		const rows = Array.from(tableBody.children);
		const tr = rows.find(
			(row) => parseInt(row.children[0].innerText) === rowKey,
		);

		if (tr) {
			// 2. Update the UI for every cell in that row
			Array.from(tr.children).forEach((td, index) => {
				if (index === 0) return; // Skip the ID column
				Object.assign(td.style, styleObj);

				// 3. IMPORTANT: Update the internal data structure!
				// This ensures the style persists during AVL tree traversals and saves.
				const colKey = this.currentSpreadsheet.columns[index - 1];
				this.currentSpreadsheet.insertData(rowKey, colKey, undefined, styleObj);
			});
		}
	}

	/**
	 * Applies a color to all selected rows.
	 * @param {string} color - The CSS color string (e.g., "#FF0000", "blue").
	 */
	applyColorToSelectedRows(color) {
		this.selectedRowKeys.forEach((rowKey) => {
			this.#applyStyleToRowUI(rowKey, { backgroundColor: color });
		});
		// Optional: clear selection after applying color
		this.#clearSelection();
	}
}
