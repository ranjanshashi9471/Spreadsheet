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

		this.openSidePanel();
	}

	/**
	 * Renders the initial, base UI structure of the application.
	 * @private
	 */
	#renderBaseUI() {
		this.rootElement.innerHTML = `
            <div id="sidepanel-items" class="sidepanel">
                <div id="options">
                    <a class="sidepanel-close" id="closeSidePanelBtn">&times;</a>
                    <a id="addNewSheetInputBtn">Add new Sheet</a>
                    <a id="renderDbDumpInputBtn">Load from Database Dump</a>
                    <a id="renderSchemaInputBtn">Load from Schema File</a>
                    <a id="renderSQLInputBtn">Run SQL query</a>
                </div>
                <div id="sheet-list"></div>
            </div>
            <div id="input-space">
                <div id="sidepanel-btn">
                    <button class="sidepanel-open" id="openSidePanelOpener">&#9776;</button>
                </div>
                <div id="rest-all-input"></div>
            </div>
            <div id="user-select"></div>
        `;

		document
			.getElementById("closeSidePanelBtn")
			?.addEventListener("click", (event) => {
				event.preventDefault();
				this.closeSidePanel();
			});
		document
			.getElementById("addNewSheetInputBtn")
			?.addEventListener("click", (event) => {
				event.preventDefault();
				this.addNewSheetInput();
			});
		document
			.getElementById("renderDbDumpInputBtn")
			?.addEventListener("click", (event) => {
				event.preventDefault();
				this.renderDbDumpInput();
			});
		document
			.getElementById("renderSchemaInputBtn")
			?.addEventListener("click", (event) => {
				event.preventDefault();
				this.renderSchemaInput();
			});
		document
			.getElementById("renderSQLInputBtn")
			?.addEventListener("click", (event) => {
				event.preventDefault();
				this.renderSQLInput();
			});
		document
			.getElementById("openSidePanelOpener")
			?.addEventListener("click", (event) => {
				event.preventDefault();
				this.openSidePanel();
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

	/**
	 * Handles global keyboard navigation for spreadsheet cells.
	 * @param {KeyboardEvent} e - The keyboard event.
	 * @private
	 */
	#handleGlobalKeyDown(e) {
		const focused_element = document.activeElement;
		if (
			focused_element.tagName === "INPUT" &&
			focused_element.classList.contains("input-cell")
		) {
			const cell = focused_element.parentElement.parentElement;
			const row = cell.parentElement;
			const tableBody = row.parentElement;
			const rowIndex = Array.from(tableBody.children).indexOf(row);
			const cellIndex = Array.from(row.children).indexOf(cell);
			const getCellInput = (rIdx, cIdx) => {
				const targetRow = tableBody.children[rIdx];
				if (targetRow) {
					const targetCell = targetRow.children[cIdx];
					if (targetCell) {
						return targetCell.querySelector("input.input-cell");
					}
				}
				return null;
			};
			let nextInput = null;
			switch (e.key) {
				case "ArrowUp":
					if (rowIndex > 0) {
						e.preventDefault();
						nextInput = getCellInput(rowIndex - 1, cellIndex);
					}
					break;
				case "ArrowDown":
					if (rowIndex < tableBody.children.length - 1) {
						e.preventDefault();
						nextInput = getCellInput(rowIndex + 1, cellIndex);
					}
					break;
				case "ArrowLeft":
					if (cellIndex > 1) {
						e.preventDefault();
						nextInput = getCellInput(rowIndex, cellIndex - 1);
					}
					break;
				case "ArrowRight":
					if (cellIndex < row.children.length - 1) {
						e.preventDefault();
						nextInput = getCellInput(rowIndex, cellIndex + 1);
					}
					break;
			}
			if (nextInput) {
				nextInput.focus();
			}
		}
	}

	/**
	 * Displays UI for adding a new sheet (rows and columns input).
	 */
	addNewSheetInput() {
		const space = document.getElementById("rest-all-input");
		space.innerHTML = "";

		const userInputDiv = document.createElement("div");
		userInputDiv.id = "user-input";

		const rowsInput = document.createElement("input");
		rowsInput.type = "number";
		rowsInput.id = "user-rows";
		rowsInput.placeholder = "Enter number of rows";
		userInputDiv.appendChild(rowsInput);

		const columnsInput = document.createElement("input");
		columnsInput.type = "number";
		columnsInput.id = "user-columns";
		columnsInput.placeholder = "Enter number of columns (max 26)";
		userInputDiv.appendChild(columnsInput);

		const createButton = document.createElement("button");
		createButton.textContent = "Create New Sheet";
		createButton.addEventListener("click", async (event) => {
			event.preventDefault();
			await this.startBlankSpreadsheet();
		});
		userInputDiv.appendChild(createButton);
		space.appendChild(userInputDiv);
		this.closeSidePanel();
	}

	/**
	 * Displays UI for loading a database dump file.
	 */
	renderDbDumpInput() {
		const space = document.getElementById("rest-all-input");
		space.innerHTML = "";
		const fileInput = document.createElement("input");
		fileInput.name = "db-dump-input";
		fileInput.type = "file";
		fileInput.id = "dbDumpFileInput";
		fileInput.style.marginLeft = "10px";
		fileInput.addEventListener("change", (event) => {
			event.preventDefault();
			this.handleDbDumpFile(event);
		});
		space.appendChild(fileInput);
		this.closeSidePanel();
	}

	/**
	 * Displays UI for loading a schema SQL file.
	 */
	renderSchemaInput() {
		const space = document.getElementById("rest-all-input");
		space.innerHTML = "";
		const fileInput = document.createElement("input");
		fileInput.name = "schema-input";
		fileInput.type = "file";
		fileInput.id = "schemaFileInput";
		fileInput.style.marginLeft = "10px";
		fileInput.addEventListener("change", (event) => {
			event.preventDefault();
			this.handleSchemaFile(event);
		});
		space.appendChild(fileInput);
		this.closeSidePanel();
	}

	/**
	 * Displays UI for running an arbitrary SQL query.
	 */
	renderSQLInput() {
		const space = document.getElementById("rest-all-input");
		space.innerHTML = "";
		const queryTextarea = document.createElement("textarea");
		queryTextarea.rows = 5;
		queryTextarea.cols = 40;
		queryTextarea.id = "query-input";
		queryTextarea.spellcheck = false;
		queryTextarea.placeholder = "Enter your query";
		space.appendChild(queryTextarea);
		const submitButton = document.createElement("button");
		submitButton.textContent = "Submit";
		space.appendChild(submitButton);
		submitButton.addEventListener("click", (event) => {
			event.preventDefault();
			this.executeUserQuery();
		});
		this.closeSidePanel();
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
			this.openSidePanel();
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
				this.openSidePanel();
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
					this.handleInputChange(e, rowno, colKey, isInMemory)
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
	async startBlankSpreadsheet() {
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
			this.closeSidePanel();
			this.#clearSelection();

			// 1. Load Data into Structure (handled by Service)
			this.currentSpreadsheet = await this.spreadsheetService.loadSpreadsheet(
				sheetName,
				isInMemory
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
	 * Renders additional UI features like insert rows, save buttons.
	 * @param {string} sheetName - The name of the sheet.
	 * @param {Array<string>} sheetColList - List of column names for the sheet.
	 * @param {boolean} isInMemory - True if this is an in-memory spreadsheet (show save button), false otherwise.
	 * @private
	 */
	#renderSheetFeatures(isInMemory) {
		const sheetName = this.currentSpreadsheet.sheetName;
		const restInput = document.getElementById("rest-all-input");
		restInput.innerHTML = "";

		const mainContainerDiv = document.createElement("div");
		mainContainerDiv.style.cssText =
			"margin: 10px 0px; display: flex; flex-direction: row;";

		const rowInputContainerDiv = document.createElement("div");

		const rowCountInput = document.createElement("input");
		rowCountInput.type = InputType.Number;
		rowCountInput.id = `${sheetName}-row-input`;
		rowCountInput.classList.add("styled-input");
		rowCountInput.placeholder = placeholders.RowCount;
		rowInputContainerDiv.appendChild(rowCountInput);

		const insertRowsButton = document.createElement("button");
		insertRowsButton.textContent = ButtonsLabels.InsertEmptyRow;
		insertRowsButton.id = "insertRowsBtn";
		insertRowsButton.style.marginLeft = "10px";
		insertRowsButton.dataset.sheetName = sheetName;
		insertRowsButton.dataset.colList = this.currentSpreadsheet.columns;
		insertRowsButton.dataset.isInMemory = isInMemory.toString();
		insertRowsButton.addEventListener("click", (event) => {
			event.preventDefault();
			const btn = event.currentTarget;
			this.insertRows(event);
		});
		rowInputContainerDiv.appendChild(insertRowsButton);
		mainContainerDiv.appendChild(rowInputContainerDiv);

		const saveToDbButton = document.createElement("button");
		saveToDbButton.textContent = ButtonsLabels.SaveSyncSheet;
		saveToDbButton.id = "saveBtn";
		saveToDbButton.style.marginLeft = "10px";
		saveToDbButton.addEventListener("click", (event) => {
			event.preventDefault();
			this.saveSpreadsheetToDb(event);
		});
		mainContainerDiv.appendChild(saveToDbButton);

		const exportJsonButton = document.createElement("button");
		exportJsonButton.textContent = ButtonsLabels.ExportJSON;
		exportJsonButton.id = "exportJsonBtn";
		exportJsonButton.style.marginLeft = "10px";
		exportJsonButton.dataset.sheetName = sheetName;
		exportJsonButton.addEventListener("click", (event) => {
			event.preventDefault();
			this.exportJson(event);
		});

		mainContainerDiv.appendChild(exportJsonButton);

		const loadJsonInput = document.createElement("input");
		loadJsonInput.type = InputType.File;
		loadJsonInput.id = "loadJsonFileInput";
		loadJsonInput.classList.add("styled-input");
		loadJsonInput.style.marginLeft = "10px";
		loadJsonInput.dataset.sheetName = sheetName;
		loadJsonInput.addEventListener("change", (event) => {
			event.preventDefault();
			this.loadJson(event);
		});

		mainContainerDiv.appendChild(loadJsonInput);
		const exportDbDumpButton = document.createElement("button");
		exportDbDumpButton.textContent = ButtonsLabels.ExportDump;
		exportDbDumpButton.id = "generateDbDumpBtn";
		exportDbDumpButton.style.marginLeft = "10px";
		exportDbDumpButton.dataset.sheetName = sheetName;
		exportDbDumpButton.addEventListener("click", (event) => {
			event.preventDefault();
			this.handleExportDBdump(event);
		});

		mainContainerDiv.appendChild(exportDbDumpButton);
		restInput.appendChild(mainContainerDiv);
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
					const metadata = await this.spreadsheetService.getTableMetadata(
						sheetName
					);
					if (metadata && metadata.max_id !== null) {
						startRowId = parseInt(metadata.max_id, 10) + 1;
					}
				} catch (error) {
					console.warn(
						"Could not determine previous max row ID from DB, starting from 1.",
						error
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
								isInMemory
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
			`${sheetName}-${rowno}-${colno}-dropdown`
		);

		if (isInMemory) {
			this.currentSpreadsheet.insertData(rowno, colno, value);
			dropdown.style.display = "none";
			return;
		}

		try {
			const pKeyList = Array.from(this.currentSpreadsheet.primaryKeys).map(
				(colId, _id) => this.currentSpreadsheet.columns[colId]
			);

			const pKeyValues = this.currentSpreadsheet.primaryKeyMap.get(rowno);

			const updateInfo = await this.spreadsheetService.getCellUpdateInfo(
				sheetName,
				pKeyList,
				pKeyValues,
				this.currentSpreadsheet.columns[colno],
				value
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
									e.target.dataset.value
								);
							} catch (updateError) {
								console.error(
									"Error updating cell with dropdown value:",
									updateError
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
					(col) => this.#toColumnIndex(col)
				);
			}

			await this.spreadsheetService.SaveSpreadsheetChanges(
				this.currentSpreadsheet
			);

			alert(
				`Spreadsheet '${this.currentSpreadsheet.sheetName}' successfully saved to database.`
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
				this.currentSpreadsheet
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

			// --- FIX: AWAIT the HandleJsonImport promise ---
			await this.spreadsheetService.HandleJsonImport(
				this.currentSpreadsheet,
				file
			);

			// --- This code now executes ONLY after the data is inserted ---
			console.log("File Import Handled");
			this.#renderTableBody();
			alert("JSON file imported successfully.");
		} catch (error) {
			// Catch errors rejected by the promise
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
			const sheetList = document.getElementById("sheet-list");
			sheetList.innerHTML = ""; // Clear existing list
			const tableNames = await this.spreadsheetService.getSheetNames(
				isInMemory
			);
			if (tableNames.length > 0) {
				tableNames.forEach((tableName) => {
					const anch = document.createElement("a");
					anch.innerHTML = `${tableName}`;
					anch.setAttribute("href", "#");
					anch.classList.add("anch");
					anch.addEventListener("click", async (e) => {
						e.preventDefault();
						await this.renderSheet(e, tableName, isInMemory); // Use class method
					});
					sheetList.appendChild(anch);
				});
			}
			this.openSidePanel();
		} catch (error) {
			console.error("Error rendering sheet names:", error);
			alert(error.message || "Could not retrieve sheet names.");
		}
	}

	/**
	 * Clears all current selection highlights.
	 * @private
	 */
	#clearSelection() {
		// Remove 'selected-row' class from all rows (TRs)
		document
			.querySelectorAll(".selected-row")
			.forEach((tr) => tr.classList.remove("selected-row"));

		// Remove 'selected-col' class from all elements that might have it (THs and TDs)
		if (
			this.currentSpreadsheet?.columns &&
			this.currentSpreadsheet.columns.length > 0
		) {
			this.currentSpreadsheet.columns.forEach((col) => {
				document
					.querySelectorAll(`.${this.#toColumnName(col)}`)
					.forEach((el) => el.classList.remove("selected-col"));
			});
		}

		// Reset internal selection state
		this.selectedRowKey = null;
		this.selectedColKey = null;
		this.activeSelectionType = null;
	}

	/**
	 * Applies CSS classes to highlight the currently selected row or column.
	 * @private
	 */
	#highlightSelection(event) {
		event.preventDefault();
		if (!this.currentSpreadsheet) return; // No active sheet to highlight on

		if (this.activeSelectionType === "row" && this.selectedRowKey !== null) {
			const tableBody = document.getElementById(
				`${this.currentSpreadsheet.sheetName}-data-input`
			);
			if (tableBody) {
				// Find the <tr> element that contains the selected row key
				const selectedRowElement = Array.from(tableBody.children).find((tr) => {
					// Assuming the first TD (c0) contains the row number
					const rowIdCell = tr.children[0];
					return (
						rowIdCell &&
						parseInt(rowIdCell.textContent, 10) === this.selectedRowKey
					);
				});
				if (selectedRowElement) {
					selectedRowElement.classList.add("selected-row");
				}
			}
		} else if (
			this.activeSelectionType === "col" &&
			this.selectedColKey !== null
		) {
			// Select all elements (TH and TD) that have the column's class
			document.querySelectorAll(`.${this.selectedColKey}`).forEach((el) => {
				el.classList.add("selected-col");
			});
		}
	}

	#handleDragStart(key, type, event) {
		event.preventDefault(); // Prevents browser's native text selection on drag
		this.isDragging = true;
		this.#removeAllHighlights(); // Start with a fresh selection

		if (type === "row") {
			this.dragStartRowKey = key;
			this.selectedRowKeys.add(key);
			this.selectedColKeys.clear(); // Clear other type of selection
		} else if (type === "col") {
			this.dragStartColKey = key;
			this.selectedColKeys.add(key);
			this.selectedRowKeys.clear(); // Clear other type of selection
		}
		this.#updateHighlights();
	}

	#handleDragMove(event) {
		if (!this.isDragging) return;

		event.preventDefault(); // Prevents text selection
		const targetElement = event.target.closest("th, td");
		if (!targetElement) return;

		const isHeader = targetElement.tagName === "TH";
		const isRowNumberCell = targetElement.classList.contains("c0");

		// Logic for dragging rows
		if (this.dragStartRowKey !== null && isRowNumberCell) {
			const endRowKey = parseInt(targetElement.dataset.rowKey, 10);
			this.#selectRowRange(this.dragStartRowKey, endRowKey);
			this.#updateHighlights();
		}
		// Logic for dragging columns
		else if (this.dragStartColKey !== null && isHeader) {
			const endColKey = targetElement.dataset.colKey;
			this.#selectColumnRange(this.dragStartColKey, endColKey);
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
			`${this.currentSpreadsheet.sheetName}-data-input`
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

	#updateHighlights() {
		this.#removeAllHighlights();
		this.selectedRowKeys.forEach((rowKey) => {
			const tableBody = document.getElementById(
				`${this.currentSpreadsheet.sheetName}-data-input`
			);
			const selectedRowElement =
				tableBody &&
				Array.from(tableBody.children).find((tr) => {
					const rowIdCell = tr.children[0];
					return rowIdCell && parseInt(rowIdCell.textContent, 10) === rowKey;
				});
			selectedRowElement?.classList.add("selected-row");
		});
		this.selectedColKeys.forEach((colKey) => {
			document.querySelectorAll(`.${colKey}`).forEach((el) => {
				el.classList.add("selected-col");
			});
		});
	}

	#removeAllHighlights() {
		document
			.querySelectorAll(".selected-row")
			.forEach((el) => el.classList.remove("selected-row"));
		document
			.querySelectorAll(".selected-col")
			.forEach((el) => el.classList.remove("selected-col"));
	}

	/**
	 * Applies a background color to the currently selected row or column.
	 * @param {string} color - The CSS color string (e.g., "#FF0000", "blue").
	 */
	applyBackgroundColor(color) {
		if (this.selectedRowKeys.size === 0 && this.selectedColKeys.size === 0) {
			alert("Select cells first.");
			return;
		}

		// 1. Apply to Rows
		this.selectedRowKeys.forEach((rowKey) => {
			// Update UI immediately
			this.#applyStyleToRowUI(rowKey, { backgroundColor: color });

			// Update Data Structure (So it persists on save/redraw)
			this.currentSpreadsheet.columns.forEach((colKey) => {
				this.currentSpreadsheet.insertData(rowKey, colKey, undefined, {
					backgroundColor: color,
				});
			});
		});

		// 2. Apply to Columns
		this.selectedColKeys.forEach((colKey) => {
			// Update UI immediately
			document.querySelectorAll(`.${colKey}`).forEach((el) => {
				if (el.tagName === "TD") el.style.backgroundColor = color;
			});

			// Update Data Structure
			for (let r = 1; r <= this.currentSpreadsheet.maxRows; r++) {
				this.currentSpreadsheet.insertData(r, colKey, undefined, {
					backgroundColor: color,
				});
			}
		});

		this.#clearSelection();
	}

	// Helper for applying styles to specific row DOM elements
	#applyStyleToRowUI(rowKey, styleObj) {
		const tableBody = document.getElementById(
			`${this.currentSpreadsheet.sheetName}-data-input`
		);
		const rows = Array.from(tableBody.children);
		// Find the TR where the first TD (c0) equals rowKey
		const tr = rows.find(
			(row) => parseInt(row.children[0].innerText) === rowKey
		);

		if (tr) {
			Array.from(tr.children).forEach((td) => {
				Object.assign(td.style, styleObj);
			});
		}
	}

	/**
	 * Opens the side panel.
	 */
	openSidePanel() {
		document.getElementById("sidepanel-items").style.width = "250px";
	}

	/**
	 * Closes the side panel.
	 */
	closeSidePanel() {
		document.getElementById("sidepanel-items").style.width = "0";
	}
}
