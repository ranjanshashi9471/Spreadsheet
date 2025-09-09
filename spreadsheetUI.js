// SpreadsheetUI.js (Updated)

class SpreadsheetUI {
	constructor(rootElementId, backendReference) {
		this.rootElement = document.getElementById(rootElementId);
		if (!this.rootElement) {
			console.error(`Root element with ID '${rootElementId}' not found.`);
			return;
		}
		this.spreadsheetService = backendReference; // Reference to the backend service

		this.selectedRowKeys = new Set();
		this.selectedColKeys = new Set();
		this.lastClickedRowKey = null;
		this.lastClickedColKey = null;

		this.isDragging = false;
		this.dragStartRowKey = null;
		this.dragStartColKey = null;

		this.currentInMemorySpreadsheet = null;
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
		createButton.addEventListener("click", (event) => {
			event.preventDefault();
			this.startBlankSpreadsheet();
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
		try {
			const file = event.target.files[0];
			await this.spreadsheetService.loadDump(file);
			this.renderSheetsNames();
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
		const file = event.target.files[0];
		const reader = new FileReader();
		reader.readAsText(file);
		reader.onload = async (e) => {
			try {
				await this.spreadsheetService.runSchema(e.target.result);
				this.renderSheetsNames();
				this.openSidePanel();
			} catch (error) {
				console.error(error);
				alert(error.message || "Error in running the schema file");
			}
		};
	}

	/**
	 * Executes a user-provided SQL query and displays the results.
	 */
	async executeUserQuery() {
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
				this.renderSheetsNames();
			}
		} catch (error) {
			alert(error.message || "Error Executing Query");
			console.error(error);
		}
	}

	/**
	 * Converts a 1-based integer index to its corresponding spreadsheet column name (A, B, C, ..., AA, AB).
	 * @param {number} index - The 1-based column index.
	 * @returns {string} The spreadsheet column name.
	 * @private
	 */
	#toColumnName(n) {
		let result = "";
		n++; // Convert from 0-indexed to 1-indexed

		while (n > 0) {
			n--; // Adjust because A starts at 0, not 1
			result = String.fromCharCode(65 + (n % 26)) + result;
			n = Math.floor(n / 26);
		}

		return result;
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
			alert("Please enter valid positive numbers for rows and columns.");
			return;
		}

		const tempSheetName = `temp_sheet_${Math.floor(Math.random() * 100000)}`;
		this.currentInMemorySpreadsheet = new Spreadsheet(tempSheetName);
		this.currentInMemorySpreadsheet.maxRows = rows;

		for (let i = 0; i < columns; i++) {
			this.currentInMemorySpreadsheet.columns.push(this.#toColumnName(i));
		}

		this.#renderTableStructure(tempSheetName);
		this.#renderColHead(tempSheetName, this.currentInMemorySpreadsheet.columns);
		this.#renderSheetFeatures(
			tempSheetName,
			this.currentInMemorySpreadsheet.columns,
			true
		);
		this.#addResizing();
		this.#clearSelection();

		const tableBody = document.getElementById(`${tempSheetName}-data-input`);
		tableBody.innerHTML = "";

		for (let i = 0; i < rows; i++) {
			const currentRowId = i + 1;
			const bodyRow = document.createElement("tr");

			for (let j = 0; j < columns; j++) {
				const colName = this.currentInMemorySpreadsheet.columns[j];
				const tableCol = document.createElement("td");
				if (j !== 0) {
					const inputContainer = document.createElement("div");
					inputContainer.className = "container";
					const input = document.createElement("input");
					input.className = `${colName} input-cell`;
					input.type = "text";
					input.name = tempSheetName;
					input.value = "";
					input.dataset.rowno = currentRowId;
					input.dataset.colname = colName;
					input.dataset.isinmemory = true;
					input.addEventListener("input", (event) => {
						event.preventDefault();
						this.handleInputChange(event, currentRowId, colName, true);
					});

					const dropdownList = document.createElement("ul");
					dropdownList.type = "none";
					dropdownList.id = `${tempSheetName}-${colName}-dropdown`;
					dropdownList.className = "dropdown";

					inputContainer.appendChild(input);
					inputContainer.appendChild(dropdownList);
					tableCol.appendChild(inputContainer);
					tableCol.classList.add(colName);
				} else {
					tableCol.innerHTML = `${currentRowId}`;
					tableCol.classList.add(colName);
					tableCol.addEventListener("click", (e) =>
						this.selectRow(currentRowId, e)
					);
				}
				bodyRow.appendChild(tableCol);
			}

			tableBody.appendChild(bodyRow);
		}
	}

	/**
	 * Renders the UI for a specific spreadsheet (table) from the database.
	 * This will clear any active in-memory spreadsheet.
	 * @param {string} sheetName - The name of the sheet (table) to render.
	 */
	async renderSheet(event, sheetName) {
		event.preventDefault();
		this.closeSidePanel();
		this.#clearSelection();
		this.currentInMemorySpreadsheet =
			await this.spreadsheetService.loadSpreadsheet(sheetName);
		this.#renderTableStructure();
		this.#renderColHead();
		this.#renderSheetFeatures(true);
		this.#renderTableData(sheetName);
		this.#addResizing();
	}

	/**
	 * Renders column headers for a new sheet (e.g., c0, A, B, C...).
	 * @param {string} sheetName - The name of the sheet.
	 * @param {Array<string>} colNames - An array of column names to render.
	 * @private
	 */
	#renderColHead() {
		debugger;
		const sheetName = this.currentInMemorySpreadsheet.sheetName;
		const colNames = this.currentInMemorySpreadsheet.columns;
		const tableHeader = document.getElementById(`${sheetName}_header`);
		tableHeader.innerHTML = "";
		colNames.forEach((colName) => {
			const headerDesc = document.createElement("th");
			headerDesc.innerHTML = `${colName}`;
			headerDesc.classList.add(colName);
			headerDesc.addEventListener("click", (e) => {
				e.preventDefault();
				this.selectColumn(colName, e);
			});
			const div = document.createElement("div");
			div.classList.add(`${colName}_resize`);
			div.classList.add(`resize`);
			headerDesc.appendChild(div);
			tableHeader.appendChild(headerDesc);
		});
	}

	/**
	 * Renders the basic HTML structure for a table.
	 * @param {string} sheetName - The name of the sheet.
	 * @private
	 */
	#renderTableStructure() {
		const sheetName = this.currentInMemorySpreadsheet.sheetName;
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
	 * Renders the table data by fetching it from the database AND attaches click listeners for row headers.
	 * @param {string} sheetName - The name of the sheet to render data for.
	 * @private
	 */
	#renderTableData() {
		const sheetName = this.currentInMemorySpreadsheet.sheetName;
		const dataInput = document.getElementById(`${sheetName}-data-input`);
		dataInput.innerHTML = "";
		try {
			const rows = this.currentInMemorySpreadsheet.maxRows;
			for (let rowno = 0; rowno < rows; rowno++) {
				const tableRow = document.createElement("tr");
				this.currentInMemorySpreadsheet.columns.forEach((col, colId) => {
					const tableCol = document.createElement("td");
					if (colId !== 0) {
						const inputContainer = document.createElement("div");
						inputContainer.className = "container";
						const input = document.createElement("input");
						input.className = `${col} input-cell`;
						input.type = "text";
						input.name = sheetName;
						const cellVal = this.currentInMemorySpreadsheet.retrieveCellData(
							rowno,
							col
						);
						input.value = cellVal == null ? "" : cellVal;
						input.dataset.rowno = rowno;
						input.dataset.colname = col;
						input.dataset.isinmemory = false;
						input.addEventListener("input", async (event) => {
							event.preventDefault();
							await this.handleInputChange(event, rowno, col, false);
						});
						const dropdownList = document.createElement("ul");
						dropdownList.type = "none";
						dropdownList.id = `${sheetName}-${col}-dropdown`;
						dropdownList.className = "dropdown";
						inputContainer.appendChild(input);
						inputContainer.appendChild(dropdownList);
						tableCol.appendChild(inputContainer);
						tableCol.classList.add(`${col}`);
					} else {
						tableCol.innerHTML = `${rowno + 1}`;
						tableCol.classList.add(col);
						tableCol.addEventListener("click", (e) => this.selectRow(rowno, e));
					}
					tableRow.appendChild(tableCol);
				});
				dataInput.appendChild(tableRow);
			}
		} catch (error) {
			console.error(error);
			alert(error.message || "Error rendering table data.");
		}
	}

	/**
	 * Renders additional UI features like insert rows, save buttons.
	 * @param {string} sheetName - The name of the sheet.
	 * @param {Array<string>} sheetColList - List of column names for the sheet.
	 * @param {boolean} isInMemory - True if this is an in-memory spreadsheet (show save button), false otherwise.
	 * @private
	 */
	#renderSheetFeatures(isInMemory) {
		const sheetName = this.currentInMemorySpreadsheet.sheetName;
		const restInput = document.getElementById("rest-all-input");
		restInput.innerHTML = "";

		const mainContainerDiv = document.createElement("div");
		mainContainerDiv.style.cssText =
			"margin: 10px 0px; display: flex; flex-direction: row;";
		const rowInputContainerDiv = document.createElement("div");
		const rowCountInput = document.createElement("input");
		rowCountInput.type = "number";
		rowCountInput.id = `${sheetName}-row-input`;
		rowCountInput.placeholder = "Enter Row Count.";
		rowInputContainerDiv.appendChild(rowCountInput);
		const insertRowsButton = document.createElement("button");
		insertRowsButton.textContent = "Insert Empty Rows";
		insertRowsButton.id = "insertRowsBtn";
		insertRowsButton.style.marginLeft = "10px";
		insertRowsButton.dataset.sheetName = sheetName;
		insertRowsButton.dataset.colList = this.currentInMemorySpreadsheet.columns;
		insertRowsButton.dataset.isInMemory = isInMemory.toString();
		insertRowsButton.addEventListener("click", (event) => {
			event.preventDefault();
			const btn = event.currentTarget;
			this.insertRows(
				event,
				sheetName,
				this.currentInMemorySpreadsheet.columns
			);
		});
		rowInputContainerDiv.appendChild(insertRowsButton);
		mainContainerDiv.appendChild(rowInputContainerDiv);
		if (isInMemory) {
			const saveToDbButton = document.createElement("button");
			saveToDbButton.textContent = `Save '${sheetName}' to DB`;
			saveToDbButton.id = "saveToDbBtn";
			saveToDbButton.style.marginLeft = "10px";
			saveToDbButton.addEventListener("click", (event) => {
				event.preventDefault();
				this.saveInMemorySpreadsheetToDb(event);
			});
			mainContainerDiv.appendChild(saveToDbButton);
		}
		const saveJsonButton = document.createElement("button");
		saveJsonButton.textContent = "Save JSON";
		saveJsonButton.id = "saveJsonBtn";
		saveJsonButton.style.marginLeft = "10px";
		saveJsonButton.dataset.sheetName = sheetName;
		saveJsonButton.addEventListener("click", (event) => {
			event.preventDefault();
			this.saveJson(event);
		});
		mainContainerDiv.appendChild(saveJsonButton);
		const loadJsonInput = document.createElement("input");
		loadJsonInput.type = "file";
		loadJsonInput.id = "loadJsonFileInput";
		loadJsonInput.style.marginLeft = "10px";
		loadJsonInput.dataset.sheetName = sheetName;
		loadJsonInput.addEventListener("change", (event) => {
			event.preventDefault();
			this.loadJson(event);
		});
		mainContainerDiv.appendChild(loadJsonInput);
		const generateDbDumpButton = document.createElement("button");
		generateDbDumpButton.textContent = "Generate DB dump";
		generateDbDumpButton.id = "generateDbDumpBtn";
		generateDbDumpButton.style.marginLeft = "10px";
		generateDbDumpButton.dataset.sheetName = sheetName;
		generateDbDumpButton.addEventListener("click", (event) => {
			event.preventDefault();
			this.handleGenerateDBdump(event);
		});
		mainContainerDiv.appendChild(generateDbDumpButton);
		restInput.appendChild(mainContainerDiv);
	}

	/**
	 * Inserts empty rows into the current sheet.
	 * Behavior differs for in-memory vs. database-backed sheets.
	 * @param {string} sheetName - The name of the sheet.
	 * @param {string} colsListString - Comma-separated string of column names.
	 * @param {boolean} isInMemory - True if inserting into the in-memory AVL spreadsheet.
	 */
	async insertRows(event, sheetName, columnsArray, isInMemory) {
		event.preventDefault();
		const rowsInput = document.getElementById(`${sheetName}-row-input`);
		const rowsToInsert = parseInt(rowsInput.value, 10);
		if (isNaN(rowsToInsert) || rowsToInsert <= 0) {
			alert("Please enter a valid positive number of rows to insert.");
			return;
		}
		const tableBody = document.getElementById(`${sheetName}-data-input`);
		let startRowId = 1;
		if (isInMemory) {
			const maxKey = this.currentInMemorySpreadsheet.maxRows;
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
			for (let j = 0; j < columnsArray.length; j++) {
				const tableCol = document.createElement("td");
				if (j !== 0) {
					const inputContainer = document.createElement("div");
					inputContainer.className = "container";
					const input = document.createElement("input");
					input.className = `${columnsArray[j]} input-cell`;
					input.type = "text";
					input.name = sheetName;
					input.value = "";
					input.dataset.rowno = currentRowId;
					input.dataset.colname = columnsArray[j];
					input.dataset.isinmemory = isInMemory;
					input.addEventListener("input", (event) => {
						event.preventDefault();
						this.handleInputChange(
							event,
							currentRowId,
							columnsArray[j],
							isInMemory
						);
					});
					const dropdownList = document.createElement("ul");
					dropdownList.type = "none";
					dropdownList.id = `${sheetName}-${columnsArray[j]}-dropdown`;
					dropdownList.className = "dropdown";
					inputContainer.appendChild(input);
					inputContainer.appendChild(dropdownList);
					tableCol.appendChild(inputContainer);
					tableCol.classList.add(columnsArray[j]);
				} else {
					tableCol.innerHTML = `${currentRowId}`;
					tableCol.classList.add(columnsArray[j]);
					tableCol.addEventListener("click", (e) => {
						e.preventDefault();
						this.selectRow(currentRowId, e);
					});
				}
				bodyRow.appendChild(tableCol);
			}
			tableBody.appendChild(bodyRow);
			if (isInMemory) {
				this.currentInMemorySpreadsheet.insertData(
					currentRowId,
					"c0",
					currentRowId
				);
				for (let j = 1; j < columnsArray.length; j++) {
					this.currentInMemorySpreadsheet.insertData(
						currentRowId,
						columnsArray[j],
						""
					);
				}
			}
		}
		if (!isInMemory) {
			await this.spreadsheetService.insertRowsIntoDb(
				sheetName,
				columnsArray,
				rowsToInsert,
				startRowId
			);
		}
		rowsInput.value = "";
	}

	/**
	 * Handles changes in input cells, updating either the in-memory spreadsheet or the database directly.
	 * @param {Event} event - The input change event.
	 * @param {number} rowno - The row number (primary key value).
	 * @param {string} colname - The column name.
	 * @param {boolean} isInMemory - True if updating the in-memory AVL spreadsheet.
	 */
	async handleInputChange(event, rowno, colname, isInMemory) {
		const { name: sheetName, value } = event.target;
		const dropdown = document.getElementById(
			`${sheetName}-${colname}-dropdown`
		);

		if (isInMemory) {
			this.currentInMemorySpreadsheet.insertData(rowno, colname, value);
			dropdown.style.display = "none";
			return;
		}

		try {
			const updateInfo = await this.spreadsheetService.getCellUpdateInfo(
				sheetName,
				rowno,
				colname,
				value
			);
			if (updateInfo.type === "foreignKey") {
				dropdown.innerHTML = "";
				if (updateInfo.suggestions.length > 0) {
					dropdown.style.display = "block";
					updateInfo.suggestions.forEach((data) => {
						const li = document.createElement("li");
						li.innerHTML = data[0];
						li.dataset.value = data[0];
						li.addEventListener("click", async (e) => {
							dropdown.style.display = "none";
							event.target.value = e.target.dataset.value;
							try {
								await this.spreadsheetService.updateCell(
									updateInfo.updateQuery,
									[e.target.dataset.value]
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
				} else {
					dropdown.style.display = "none";
				}
			} else {
				await this.spreadsheetService.updateCell(updateInfo.updateQuery);
				dropdown.style.display = "none";
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
	async saveInMemorySpreadsheetToDb(event) {
		event.preventDefault();
		if (!this.currentInMemorySpreadsheet) {
			alert("No in-memory spreadsheet to save.");
			return;
		}
		const spreadsheet = this.currentInMemorySpreadsheet;
		const newDbSheetName = `saved_sheet_${Math.floor(Math.random() * 100000)}`;
		try {
			await this.spreadsheetService.saveInMemorySpreadsheet(
				newDbSheetName,
				this.currentInMemorySpreadsheet
			);
			alert(
				`Spreadsheet '${spreadsheet.sheetName}' successfully saved to database as '${newDbSheetName}'.`
			);
			this.currentInMemorySpreadsheet = null;
			await this.renderSheetsNames(event);
		} catch (error) {
			console.error("Error saving in-memory spreadsheet to DB:", error);
			alert(`Error saving spreadsheet to database: ${error.message}`);
		}
	}

	/**
	 * Generates and downloads a database dump file.
	 * @param {Event} event - The click event (not directly used, but passed for consistency).
	 */
	async handleGenerateDBdump(event) {
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
	async saveJson(event) {
		event.preventDefault();
		const sheetName = event.target.name;
		try {
			const res = await this.spreadsheetService.selectAllFromTable(sheetName);
			if (res) {
				const jsonData = JSON.stringify(res, null, 2); // Pretty print JSON
				const blob = new Blob([jsonData], { type: "application/json" });
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
		const file = event.target.files[0];
		const sheetName = event.target.name; // This is the name of the existing sheet

		if (!file) {
			alert("No file selected.");
			return;
		}

		const reader = new FileReader();
		reader.readAsText(file);

		reader.onload = async (e) => {
			try {
				const res = JSON.parse(e.target.result);
				if (!res || !res.columns || !res.values) {
					// JSON format from runQuery result
					alert(
						"Invalid JSON file format. Expected an object with 'columns' and 'values' properties."
					);
					return;
				}

				const jsonColumns = res.columns;
				const jsonValues = res.values;
				const file_row_count = jsonValues.length;

				let db_col_count = 0;
				let nextRowId = 1;
				let tableExists = false;

				try {
					const metadata = await this.spreadsheetService.getTableMetadata(
						sheetName
					);
					if (metadata) {
						db_col_count = metadata.column_count;
						nextRowId = parseInt(metadata.max_id, 10) + 1;
						tableExists = true;
					}
				} catch (error) {
					console.warn(
						`Table '${sheetName}' might not exist. Will attempt to create if needed.`,
						error
					);
				}

				if (tableExists && db_col_count >= jsonColumns.length) {
					// Existing table compatible, insert data
					const colsToInsert = jsonColumns.map((col) => `"${col}"`).join(", ");

					for (let i = 0; i < file_row_count; i++) {
						const rowData = jsonValues[i];
						// Ensure rowData has enough elements for the columns
						if (rowData.length !== jsonColumns.length) {
							console.warn(
								`Skipping row ${i + 1} due to column count mismatch.`
							);
							continue;
						}

						const values = [];
						// Assuming the first JSON column corresponds to 'c0' (row ID) in DB if it's primary key
						// You might need more sophisticated mapping if column names differ.
						values.push(`${nextRowId}`); // Use generated ID for new rows
						for (let j = 1; j < rowData.length; j++) {
							values.push(`"${String(rowData[j]).replace(/"/g, '""')}"`); // Sanitize string values
						}
						let query = `INSERT INTO "${sheetName}" (c0, ${jsonColumns
							.slice(1)
							.map((col) => `"${col}"`)
							.join(", ")}) VALUES (${values.join(", ")});`;
						nextRowId++;

						try {
							await this.spreadsheetService.runQuery(query);
						} catch (error) {
							alert(
								`Error while inserting Data from file into existing table at row ${
									i + 1
								}. See console.`
							);
							console.error(error);
							break;
						}
					}
					await this.renderSheet(e, sheetName); // Re-render the sheet
				} else {
					// Table doesn't exist or has too few columns, create a new table
					const newSheetName = `imported_sheet_${Math.floor(
						Math.random() * 100000
					)}`;
					let createTableQuery = `CREATE TABLE "${newSheetName}" (c0 INTEGER PRIMARY KEY`;
					jsonColumns.forEach((colName, index) => {
						if (index !== 0) {
							// Assuming c0 is the ID, other columns come from JSON
							createTableQuery += ` ,"${colName}" TEXT`;
						}
					});
					createTableQuery += `);`;

					try {
						await this.spreadsheetService.runQuery(createTableQuery);
					} catch (error) {
						console.error("Error creating new table for JSON import:", error);
						alert("Error creating new table for JSON import.");
						return;
					}

					// Insert data into the newly created table
					const colsToInsert = jsonColumns.map((col) => `"${col}"`).join(" ,");
					let currentIdForNewTable = 1;

					for (let i = 0; i < file_row_count; i++) {
						const rowData = jsonValues[i];
						if (rowData.length !== jsonColumns.length) {
							console.warn(
								`Skipping row ${
									i + 1
								} due to column count mismatch for new table.`
							);
							continue;
						}

						const values = [];
						values.push(`${currentIdForNewTable}`); // Assign new sequential ID
						for (let j = 1; j < rowData.length; j++) {
							values.push(`"${String(rowData[j]).replace(/"/g, '""')}"`); // Sanitize string values
						}
						let query = `INSERT INTO "${newSheetName}" (c0, ${jsonColumns
							.slice(1)
							.map((col) => `"${col}"`)
							.join(", ")}) VALUES (${values.join(", ")});`;
						currentIdForNewTable++;

						try {
							await this.spreadsheetService.runQuery(query);
						} catch (error) {
							alert(
								`Error while inserting Data from file into new table at row ${
									i + 1
								}. See console.`
							);
							console.error(error);
							break;
						}
					}
					await this.renderSheet(e, newSheetName); // Render the newly created sheet
					this.renderSheetsNames(e); // Update side panel with new sheet
				}
			} catch (error) {
				console.error("Error processing JSON file:", error);
				alert("Error parsing or loading JSON file.");
			}
		};
	}

	/**
	 * Renders the names of all sheets (tables) in the side panel.
	 */
	async renderSheetsNames(event) {
		event.preventDefault();
		const sheetList = document.getElementById("sheet-list");
		sheetList.innerHTML = ""; // Clear existing list

		try {
			const tableNames = await this.spreadsheetService.getSheetNames();
			if (tableNames.length > 0) {
				tableNames.forEach((tableName) => {
					const anch = document.createElement("a");
					anch.innerHTML = `${tableName}`;
					anch.setAttribute("href", "#");
					anch.classList.add("anch");
					anch.addEventListener("click", async (e) => {
						e.preventDefault();
						await this.renderSheet(e, tableName); // Use class method
					});
					sheetList.appendChild(anch);
				});
			}
		} catch (error) {
			console.error("Error rendering sheet names:", error);
			alert(error.message || "Could not retrieve sheet names.");
		}
		this.openSidePanel();
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
			this.currentInMemorySpreadsheet?.columns &&
			this.currentInMemorySpreadsheet.columns.length > 0
		) {
			this.currentInMemorySpreadsheet.columns.forEach((colClass) => {
				document
					.querySelectorAll(`.${colClass}`)
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
		if (!this.currentInMemorySpreadsheet) return; // No active sheet to highlight on

		if (this.activeSelectionType === "row" && this.selectedRowKey !== null) {
			const tableBody = document.getElementById(
				`${this.currentInMemorySpreadsheet.sheetName}-data-input`
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
			`${this.currentInMemorySpreadsheet.sheetName}-data-input`
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
		const colNames = this.currentInMemorySpreadsheet.columns;
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
				`${this.currentInMemorySpreadsheet.sheetName}-data-input`
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
			alert("Please select a row or column first to apply color.");
			return;
		}
		this.selectedRowKeys.forEach((rowKey) => {
			const tableBody = document.getElementById(
				`${this.currentInMemorySpreadsheet.sheetName}-data-input`
			);
			const selectedRowElement =
				tableBody &&
				Array.from(tableBody.children).find((tr) => {
					const rowIdCell = tr.children[0];
					return rowIdCell && parseInt(rowIdCell.textContent, 10) === rowKey;
				});
			if (selectedRowElement) {
				Array.from(selectedRowElement.children).forEach((cell) => {
					cell.style.backgroundColor = color;
				});
			}
		});
		this.selectedColKeys.forEach((colKey) => {
			document.querySelectorAll(`.${colKey}`).forEach((el) => {
				if (el.tagName === "TD" || el.tagName === "TH") {
					el.style.backgroundColor = color;
				}
			});
		});
		this.selectedRowKeys.clear();
		this.selectedColKeys.clear();
		this.lastClickedRowKey = null;
		this.lastClickedColKey = null;
		this.#removeAllHighlights();
		alert(`Background color applied to selected cells.`);
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
