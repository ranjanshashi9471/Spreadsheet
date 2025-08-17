// SpreadsheetUI.js (Updated)

class SpreadsheetUI {
	constructor(rootElementId, dbReference) {
		this.rootElement = document.getElementById(rootElementId);
		if (!this.rootElement) {
			console.error(`Root element with ID '${rootElementId}' not found.`);
			return;
		}
		this.databaseService = dbReference; // Reference to the database service

		// --- NEW: Properties to manage selection state ---
		this.selectedRowKey = null; // Stores the key (number) of the currently selected row
		this.selectedColKey = null; // Stores the key (string/number) of the currently selected column
		this.activeSelectionType = null; // 'row' | 'col' | null - indicates what's currently selected

		this.activeSheetName = null;
		this.sheetColList = []; // Stores current UI's column names
		this.currentInMemorySpreadsheet = null; // Holds the active Spreadsheet (AVL of AVL) instance
	}

	/**
	 * Renders the initial,Complete Start UI of the application.
	 */
	async initializeUI() {
		await this.#renderBaseUI();
		this.#attachGlobalEventListeners();
		this.openSidePanel();
	}

	/**
	 * Renders the initial, base UI structure of the application.
	 * @private
	 */
	async #renderBaseUI() {
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

		// Attach event listeners for the permanent UI elements
		document
			.getElementById("closeSidePanelBtn")
			?.addEventListener("click", () => this.closeSidePanel());
		document
			.getElementById("addNewSheetInputBtn")
			?.addEventListener("click", () => this.addNewSheetInput());
		document
			.getElementById("renderDbDumpInputBtn")
			?.addEventListener("click", () => this.renderDbDumpInput());
		document
			.getElementById("renderSchemaInputBtn")
			?.addEventListener("click", () => this.renderSchemaInput());
		document
			.getElementById("renderSQLInputBtn")
			?.addEventListener("click", () => this.renderSQLInput());

		// --- IMPORTANT: This is the specific part for your request ---
		document
			.getElementById("openSidePanelOpener")
			?.addEventListener("click", () => this.openSidePanel());
		// --- End of specific part ---
	}

	/**
	 * Attaches global event listeners like keyboard navigation.
	 * @private
	 */
	#attachGlobalEventListeners() {
		document.addEventListener("keydown", (e) => this.#handleGlobalKeyDown(e));
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
			focused_element.parentElement.parentElement.tagName === "TD"
		) {
			const cellIndex = focused_element.parentElement.parentElement.cellIndex;
			const rowIndex =
				focused_element.parentElement.parentElement.parentElement.rowIndex;
			const table = document.getElementById("user-select");
			if (!table || !table.firstElementChild) return; // Ensure table exists
			const rows = table.firstElementChild.rows;

			switch (e.key) {
				case "ArrowUp":
					if (rowIndex > 1) {
						// row 0 is thead, row 1 is the first data row
						e.preventDefault(); // Prevent page scroll
						rows[rowIndex - 1].cells[cellIndex].querySelector("input").focus();
					}
					break;
				case "ArrowDown":
					if (rowIndex < rows.length - 1) {
						e.preventDefault(); // Prevent page scroll
						rows[rowIndex + 1].cells[cellIndex].querySelector("input").focus();
					}
					break;
				case "ArrowLeft":
					if (cellIndex > 0) {
						// Cell 0 is row number, start from 1
						e.preventDefault(); // Prevent page scroll
						rows[rowIndex].cells[cellIndex - 1].querySelector("input").focus();
					}
					break;
				case "ArrowRight":
					if (cellIndex < rows[rowIndex].cells.length - 1) {
						e.preventDefault(); // Prevent page scroll
						rows[rowIndex].cells[cellIndex + 1].querySelector("input").focus();
					}
					break;
			}
		}
	}

	/**
	 * Displays UI for adding a new sheet (rows and columns input).
	 */
	addNewSheetInput() {
		const space = document.getElementById("rest-all-input");
		space.innerHTML = "";

		space.innerHTML = `
            <div id="user-input"></div>`; // Renamed function for clarity

		const userInputDiv = document.createElement("div");
		userInputDiv.id = "user-input";

		// 4. Create the 'user-rows' input element.
		const rowsInput = document.createElement("input");
		rowsInput.type = "number";
		rowsInput.id = "user-rows";
		rowsInput.placeholder = "Enter number of rows";
		userInputDiv.appendChild(rowsInput); // Add it to the div

		// 5. Create the 'user-columns' input element.
		const columnsInput = document.createElement("input");
		columnsInput.type = "number";
		columnsInput.id = "user-columns";
		columnsInput.placeholder = "Enter number of columns (max 26)";
		userInputDiv.appendChild(columnsInput); // Add it to the div

		// 6. Create the <button> element.
		const createButton = document.createElement("button");
		createButton.textContent = "Create New Sheet";

		// 7. IMPORTANT: Attach the event listener programmatically.
		//    'this' here refers to the instance of your SpreadsheetUI class.
		createButton.addEventListener("click", () => {
			this.startNewSpreadsheet();
		});
		userInputDiv.appendChild(createButton); // Add the button to the div

		// 8. Append the entire new UI block to the designated space.
		space.appendChild(userInputDiv);
		this.closeSidePanel();
	}

	/**
	 * Displays UI for loading a database dump file.
	 */
	renderDbDumpInput() {
		const space = document.getElementById("rest-all-input");
		space.innerHTML = ""; // Clear previous content

		// 1. Create the <input> element
		const fileInput = document.createElement("input");

		// 2. Set its attributes
		fileInput.name = "db-dump-input";
		fileInput.type = "file";
		fileInput.id = "dbDumpFileInput"; // Give it a unique ID for easier reference
		fileInput.style.marginLeft = "10px"; // Set the style

		// 3. IMPORTANT: Attach the event listener programmatically
		//    'this' inside this method refers to the SpreadsheetUI instance.
		//    So, we can directly call 'this.handleDbDumpFile(event)'.
		fileInput.addEventListener("change", (event) => {
			this.handleDbDumpFile(event);
		});

		// 4. Append the created input element to the designated space
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
		fileInput.id = "schemaFileInput"; // Give it a unique ID for easier reference
		fileInput.style.marginLeft = "10px"; // Set the style
		// 3. Attach the event listener programmatically
		fileInput.addEventListener("change", (event) => {
			this.handleSchemaFile(event);
		});

		// 4. Append the created input element to the designated space
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

		const submitButton = document.createElement("button");
		submitButton.textContent = "Submit";
		submitButton.onclick = () => this.executeUserQuery();

		space.appendChild(queryTextarea);
		space.appendChild(submitButton);
		this.closeSidePanel();
	}

	/**
	 * Handles loading a database dump file selected by the user.
	 * @param {Event} event - The file input change event.
	 */
	async handleDbDumpFile(event) {
		try {
			const file = event.target.files[0];
			await this.databaseService.loadDump(file);
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
		reader.onload = (e) => {
			try {
				this.databaseService.runSchema(e.target.result);
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
	executeUserQuery() {
		const query = document.getElementById("query-input").value;
		if (!query.trim()) {
			alert("Please enter an SQL query.");
			return;
		}
		console.log("Executing query:", query);
		try {
			const res = this.databaseService.runQuery(query);
			const output = document.getElementById("user-select");
			output.innerHTML = ""; // Clear previous output

			if (res) {
				// res is the result object from db.exec for SELECT queries
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

				// Render header row
				const headrow = document.createElement("tr");
				res.columns.forEach((colName) => {
					const th = document.createElement("th"); // Use th for header cells
					th.innerHTML = colName;
					headrow.appendChild(th);
				});
				header.appendChild(headrow);

				// Render data rows
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
				// For DML (INSERT, UPDATE, DELETE) or DDL (CREATE, DROP) queries
				alert("Query executed successfully (no data returned for display).");
				this.renderSheetsNames(); // Refresh sheet list in case of DDL
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
	#toColumnName(index) {
		let name = "";
		while (index > 0) {
			let rem = index % 26;
			if (rem === 0) {
				name = "Z" + name;
				index = index / 26 - 1;
			} else {
				name = String.fromCharCode(65 + rem - 1) + name;
				index = Math.floor(index / 26);
			}
		}
		return name;
	}

	/**
	 * Initiates the creation of a new in-memory spreadsheet and prepares the UI.
	 * This does NOT immediately save to the database.
	 */
	async startNewSpreadsheet() {
		// Renamed from renderNewSpreadsheet
		const rowCountInput = document.getElementById("user-rows");
		const colCountInput = document.getElementById("user-columns");

		const rows = parseInt(rowCountInput.value, 10);
		const columns = parseInt(colCountInput.value, 10);

		if (isNaN(rows) || rows <= 0 || isNaN(columns) || columns <= 0) {
			alert("Please enter valid positive numbers for rows and columns.");
			return;
		}
		// if (columns > 26) {
		// 	alert("Maximum 26 columns (A-Z) allowed for now.");
		// 	return;
		// }

		const tempSheetName = `temp_sheet_${Math.floor(Math.random() * 100000)}`;
		this.currentInMemorySpreadsheet = new Spreadsheet(tempSheetName); // Create in-memory instance
		this.activeSheetName = tempSheetName; // Set active sheet to this temp name

		// Populate the in-memory spreadsheet with empty cells (optional, but good for UI consistency)
		const newColList = [];
		newColList.push("c0"); // Primary key column

		// --- UPDATED LOGIC FOR COLUMN NAMING ---
		for (let i = 1; i < columns; i++) {
			// Use the new helper function for naming all subsequent columns
			newColList.push(this.#toColumnName(i));
		}

		this.sheetColList = newColList; // Update UI's column list

		// Render UI based on this in-memory structure
		this.#renderTableStructure(tempSheetName);
		this.#renderColHead(tempSheetName, newColList);
		this.#renderSheetFeatures(tempSheetName, newColList, true); // Pass true to show 'Save to DB' button
		this.#addResizing();
		this.#clearSelection();

		// Populate UI with empty rows without hitting DB yet
		const tableBody = document.getElementById(`${tempSheetName}-data-input`);
		tableBody.innerHTML = ""; // Clear existing content
		for (let i = 0; i < rows; i++) {
			const bodyRow = document.createElement("tr");
			for (let j = 0; j < newColList.length; j++) {
				const tableCol = document.createElement("td");
				if (j !== 0) {
					const inputContainer = document.createElement("div");
					inputContainer.className = "container"; // Set the class directly

					const input = document.createElement("input");

					input.className = `${newColList[j]} input-cell`; // Dynamic class
					input.type = "text";
					input.name = tempSheetName; // Dynamic name attribute
					input.value = ""; // Initial empty value

					// --- IMPORTANT: Attach the oninput event listener programmatically ---
					// Use an arrow function to maintain 'this' context, and pass all necessary arguments.
					input.addEventListener("input", (event) => {
						this.handleInputChange(event, i + 1, newColList[j], true);
					});

					// Optional but recommended: Store dynamic data in dataset attributes
					// This can simplify event handling if you need to access these values later
					// without re-parsing the DOM from event.target.
					input.dataset.rowno = i + 1;
					input.dataset.colname = newColList[j];
					input.dataset.isinmemory = true; // Use 'true' as a string for dataset, or convert later

					const dropdownList = document.createElement("ul");

					dropdownList.type = "none";
					dropdownList.id = `${tempSheetName}-${newColList[j]}-dropdown`; // Dynamic ID
					dropdownList.className = "dropdown"; // Set the class

					inputContainer.appendChild(input);
					inputContainer.appendChild(dropdownList);

					tableCol.appendChild(inputContainer);
					tableCol.classList.add(newColList[j]);
				} else {
					tableCol.innerHTML = `${i + 1}`; // Row number
				}
				bodyRow.appendChild(tableCol);
			}
			tableBody.appendChild(bodyRow);
			// Also add to in-memory spreadsheet (optional, for consistency if you fetch from it)
			// this.currentInMemorySpreadsheet.insertData(i + 1, 'c0', i + 1); // For the ID column
			// for (let j = 1; j < newColList.length; j++) {
			//     this.currentInMemorySpreadsheet.insertData(i + 1, newColList[j], "");
			// }
		}

		// Initially render sheet names, but don't add this temp sheet to the DB list yet.
		// this.renderSheetsNames();
		alert(
			`New temporary spreadsheet '${tempSheetName}' created. Data will be in-memory until saved.`
		);
	}

	/**
	 * Renders the UI for a specific spreadsheet (table) from the database.
	 * This will clear any active in-memory spreadsheet.
	 * @param {string} sheetName - The name of the sheet (table) to render.
	 */
	async renderSheet(sheetName) {
		this.closeSidePanel();
		this.#clearSelection(); // Clear any existing selection when loading new sheet

		this.activeSheetName = sheetName;
		this.currentInMemorySpreadsheet = null; // Clear in-memory spreadsheet when loading from DB

		this.#renderTableStructure(sheetName);
		const cols = await this.#renderColHeadFromDb(sheetName);
		this.#renderSheetFeatures(sheetName, cols, false); // Pass false, no 'Save to DB' button for DB sheets
		await this.#renderTableData(sheetName);
		this.#addResizing();
	}

	/**
	 * Renders column headers from database schema.
	 * @param {string} sheetName - The name of the sheet.
	 * @returns {Promise<Array<string>>} A promise resolving to an array of column names.
	 * @private
	 */
	async #renderColHeadFromDb(sheetName) {
		try {
			const tableHeader = document.getElementById(`${sheetName}_header`);
			tableHeader.innerHTML = ""; // Clear existing headers
			this.sheetColList = []; // Clear current UI column list

			const tableInfo = await this.databaseService.getTableInfo(sheetName);
			tableInfo.forEach((colInfo) => {
				const colName = colInfo[1]; // colInfo[1] is the column name
				this.sheetColList.push(colName);

				const headerDesc = document.createElement("th");
				headerDesc.innerHTML = `${colName}`;
				headerDesc.classList.add(`${colName}`); // Apply class for resizing

				// --- NEW: Attach click listener for column selection ---
				headerDesc.dataset.colKey = colName; // Store column key in dataset
				headerDesc.addEventListener("click", () => this.selectColumn(colName));

				const div = document.createElement("div");
				div.classList.add(`${colName}_resize`);
				div.classList.add(`resize`);
				headerDesc.appendChild(div);
				tableHeader.appendChild(headerDesc);
			});
			return this.sheetColList; // Return the updated list
		} catch (error) {
			console.error(error);
			alert(error.message || "Error rendering column headers from database.");
			return [];
		}
	}

	/**
	 * Renders column headers for a new sheet (e.g., c0, A, B, C...).
	 * @param {string} sheetName - The name of the sheet.
	 * @param {Array<string>} colNames - An array of column names to render.
	 * @private
	 */
	#renderColHead(sheetName, colNames) {
		try {
			const tableHeader = document.getElementById(`${sheetName}_header`);
			tableHeader.innerHTML = ""; // Clear existing headers
			this.sheetColList = colNames; // Update UI's column list

			colNames.forEach((colName) => {
				const headerDesc = document.createElement("th");
				headerDesc.innerHTML = `${colName}`;
				headerDesc.classList.add(colName); // Apply class for resizing

				// --- NEW: Attach click listener for column selection ---
				headerDesc.dataset.colKey = colName; // Store column key in dataset
				headerDesc.addEventListener("click", () => this.selectColumn(colName));

				const div = document.createElement("div");
				div.classList.add(`${colName}_resize`);
				div.classList.add(`resize`);

				headerDesc.appendChild(div);
				tableHeader.appendChild(headerDesc);
			});
		} catch (error) {
			console.error(error);
			alert("Error rendering column headers for new sheet.");
		}
	}

	/**
	 * Renders the basic HTML structure for a table.
	 * @param {string} sheetName - The name of the sheet.
	 * @private
	 */
	#renderTableStructure(sheetName) {
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
			resizer.addEventListener("mousedown", (e) => {
				const th = e.target.parentElement;
				const col_class = th.classList[0]; // Get the column class (e.g., 'c0', 'A')
				const startWidth = th.offsetWidth;
				const startX = e.pageX;

				const onMouseMove = (moveEvent) => {
					const newWidth = startWidth + (moveEvent.pageX - startX);
					if (newWidth >= 50) {
						// Minimum width
						document.querySelectorAll(`.${col_class}`).forEach((element) => {
							if (element.tagName === "INPUT") {
								element.style.width = `${newWidth - 3}px`; // Adjust for padding/border
							} else {
								element.style.width = `${newWidth}px`;
							}
						});
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
	 * Renders the table data by fetching it from the database.
	 * @param {string} sheetName - The name of the sheet to render data for.
	 * @private
	 */
	/**
	 * Renders the table data by fetching it from the database AND attaches click listeners for row headers.
	 * @param {string} sheetName - The name of the sheet to render data for.
	 * @private
	 */
	async #renderTableData(sheetName) {
		const dataInput = document.getElementById(`${sheetName}-data-input`);
		dataInput.innerHTML = "";

		try {
			const result = await databaseService.selectAllFromTable(sheetName);
			if (result) {
				result.values.forEach((row) => {
					const tableRow = document.createElement("tr"); // Each <tr> represents a row
					row.forEach((col, colId) => {
						const tableCol = document.createElement("td");
						if (colId !== 0) {
							// Editable data cells
							const inputContainer = document.createElement("div");
							inputContainer.className = "container";
							const input = document.createElement("input");
							input.className = `${result.columns[colId]} input-cell`;
							input.type = "text";
							input.name = sheetName;
							input.value = col;
							input.dataset.rowno = row[0];
							input.dataset.colname = result.columns[colId];
							input.dataset.isinmemory = false;
							input.addEventListener("input", (event) =>
								this.handleInputChange(
									event,
									row[0],
									result.columns[colId],
									false
								)
							);

							const dropdownList = document.createElement("ul");
							dropdownList.type = "none";
							dropdownList.id = `${sheetName}-${result.columns[colId]}-dropdown`;
							dropdownList.className = "dropdown";

							inputContainer.appendChild(input);
							inputContainer.appendChild(dropdownList);
							tableCol.appendChild(inputContainer);
							tableCol.classList.add(`${result.columns[colId]}`);
						} else {
							// Row number cell (c0) - make it clickable for row selection
							tableCol.innerHTML = `${col}`;
							tableCol.classList.add(result.columns[colId]); // Add c0 class for styling/selection

							// --- NEW: Attach click listener for row selection ---
							tableCol.dataset.rowKey = row[0]; // Store row key in dataset
							tableCol.addEventListener("click", () => this.selectRow(row[0]));
						}
						tableRow.appendChild(tableCol);
					});
					dataInput.appendChild(tableRow);
				});
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
	#renderSheetFeatures(sheetName, sheetColList, isInMemory) {
		const restInput = document.getElementById("rest-all-input");
		const colListString = Array.isArray(sheetColList)
			? sheetColList.join(",")
			: "";

		const saveToDbButton = isInMemory
			? `<button id="saveToDbBtn" style="margin-left: 10px">
                Save '${sheetName}' to DB
            </button>`
			: "";

		restInput.innerHTML = `
            <div style="margin: 10px 0px; display:flex; flex-direction:row;">
                <div>
                    <input type="number" class="append-rows" id="${sheetName}-row-input" placeholder="Enter Row Count."/>
                    <button id="insertRowsBtn" data-sheet-name="${sheetName}" data-col-list="${colListString}" data-is-in-memory="${isInMemory}" style="margin-left: 10px">Insert Empty Rows</button>
                </div>
                ${saveToDbButton}
                <button id="saveJsonBtn" data-sheet-name="${sheetName}" style="margin-left: 10px">
                  Save JSON
                </button>
                <input type="file" id="loadJsonFileInput" data-sheet-name="${sheetName}" style="margin-left: 10px" />
                <button id="generateDbDumpBtn" data-sheet-name="${sheetName}" style="margin-left: 10px">
                  Generate DB dump
                </button>

                <div style="margin-left: 20px; display: flex; align-items: center;">
                    <label for="colorPicker-${sheetName}">Cell Color:</label>
                    <input type="color" id="colorPicker-${sheetName}" value="#ffffff" style="margin-left: 5px;">
                    <button id="applyColorBtn-${sheetName}" style="margin-left: 5px;">Apply Color</button>
                </div>
            </div>`;
		// Attach event listeners for these dynamically rendered buttons
		if (isInMemory) {
			document
				.getElementById("saveToDbBtn")
				?.addEventListener("click", () => this.saveInMemorySpreadsheetToDb());
		}
		document
			.getElementById("insertRowsBtn")
			?.addEventListener("click", (event) => {
				const btn = event.target;
				this.insertRows(
					btn.dataset.sheetName,
					btn.dataset.colList,
					btn.dataset.isInMemory === "true"
				);
			});
		document
			.getElementById("saveJsonBtn")
			?.addEventListener("click", (event) => this.saveJson(event));
		document
			.getElementById("loadJsonFileInput")
			?.addEventListener("change", (event) => this.loadJson(event));
		document
			.getElementById("generateDbDumpBtn")
			?.addEventListener("click", (event) => this.handleGenerateDBdump(event));

		// --- NEW: Attach listener for Apply Color button ---
		document
			.getElementById(`applyColorBtn-${sheetName}`)
			?.addEventListener("click", () => {
				const selectedColor = document.getElementById(
					`colorPicker-${sheetName}`
				).value;
				this.applyBackgroundColor(selectedColor);
			});
	}

	/**
	 * Inserts empty rows into the current sheet.
	 * Behavior differs for in-memory vs. database-backed sheets.
	 * @param {string} sheetName - The name of the sheet.
	 * @param {string} colsListString - Comma-separated string of column names.
	 * @param {boolean} isInMemory - True if inserting into the in-memory AVL spreadsheet.
	 */
	async insertRows(sheetName, colsListString, isInMemory) {
		const rowsInput = document.getElementById(`${sheetName}-row-input`);
		const rowsToInsert = parseInt(rowsInput.value, 10);
		if (isNaN(rowsToInsert) || rowsToInsert <= 0) {
			alert("Please enter a valid positive number of rows to insert.");
			return;
		}

		const columnsArray = colsListString.split(",");
		const colCount = columnsArray.length;
		const tableBody = document.getElementById(`${sheetName}-data-input`);

		let startRowId = 1;
		if (isInMemory && this.currentInMemorySpreadsheet) {
			// Find max key in c0 column or get current rowCount + 1
			const maxKey =
				this.currentInMemorySpreadsheet.rowCount > 0
					? Array.from(this.currentInMemorySpreadsheet.uniqueRowKeys).reduce(
							(max, current) => Math.max(max, current),
							0
					  )
					: 0;
			startRowId = maxKey + 1;
		} else if (!isInMemory) {
			try {
				const metadata = await this.databaseService.getTableMetadata(sheetName);
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

		// UI Rendering Part (similar for both in-memory and DB-backed)
		for (let i = 0; i < rowsToInsert; i++) {
			const currentRowId = startRowId + i;
			const bodyRow = document.createElement("tr");
			for (let j = 0; j < colCount; j++) {
				const tableCol = document.createElement("td");
				if (j !== 0) {
					tableCol.innerHTML = "";

					const inputContainer = document.createElement("div");
					inputContainer.className = "container";

					const input = document.createElement("input");

					input.className = `${columnsArray[j]} input-cell`; // Dynamic class from column name
					input.type = "text";
					input.name = sheetName; // Sheet name as the form 'name'
					input.value = ""; // Initial empty value for new rows

					// --- IMPORTANT: Attach the oninput event listener programmatically ---
					// Use an arrow function to maintain 'this' context, and pass all necessary arguments.
					input.addEventListener("input", (event) => {
						// Pass the original boolean 'isInMemory' directly
						this.handleInputChange(
							event,
							currentRowId,
							columnsArray[j],
							isInMemory
						);
					});

					// Optional but recommended: Store dynamic data in dataset attributes
					input.dataset.rowno = currentRowId;
					input.dataset.colname = columnsArray[j];
					input.dataset.isinmemory = isInMemory.toString(); // Dataset values are strings, convert boolean to string

					const dropdownList = document.createElement("ul");

					dropdownList.type = "none"; // 'none' as string for type attribute
					dropdownList.id = `${sheetName}-${columnsArray[j]}-dropdown`; // Dynamic ID
					dropdownList.className = "dropdown"; // Set the class

					inputContainer.appendChild(input);
					inputContainer.appendChild(dropdownList);

					tableCol.appendChild(inputContainer);

					tableCol.classList.add(columnsArray[j]);
				} else {
					// For the non-editable row ID column
					tableCol.innerHTML = `${currentRowId}`;

					// --- NEW: Attach click listener for row selection ---
					tableCol.dataset.rowKey = currentRowId; // Store row key in dataset
					tableCol.addEventListener("click", () =>
						this.selectRow(currentRowId)
					);
				}
				bodyRow.appendChild(tableCol);
			}
			tableBody.appendChild(bodyRow);

			// Data Insertion Part (depends on whether it's in-memory or DB-backed)
			if (isInMemory && this.currentInMemorySpreadsheet) {
				this.currentInMemorySpreadsheet.insertData(
					currentRowId,
					"c0",
					currentRowId
				); // Insert ID
				for (let j = 1; j < columnsArray.length; j++) {
					this.currentInMemorySpreadsheet.insertData(
						currentRowId,
						columnsArray[j],
						""
					); // Insert empty string for other cells
				}
			}
		}

		// If it's a DB-backed sheet, also insert into DB
		if (!isInMemory) {
			const chunkSize = 50;
			const noOfIterations = Math.ceil(rowsToInsert / chunkSize);

			for (let k = 0; k < noOfIterations; k++) {
				const currentBatchSize = Math.min(
					rowsToInsert - k * chunkSize,
					chunkSize
				);
				let query = `INSERT INTO "${sheetName}" (${columnsArray
					.map((col) => `"${col}"`)
					.join(", ")}) VALUES `;
				const valuesToInsert = [];

				for (let i = 0; i < currentBatchSize; i++) {
					const rowId = startRowId + k * chunkSize + i;
					let rowValues = [`${rowId}`];
					for (let j = 1; j < colCount; j++) {
						rowValues.push(`''`);
					}
					valuesToInsert.push(`(${rowValues.join(", ")})`);
				}
				query += valuesToInsert.join(", ") + ";";

				try {
					await this.databaseService.runQuery(query);
				} catch (error) {
					alert(
						`Error Inserting Data into DB at iteration ${
							k + 1
						}. See console for details.`
					);
					console.error(error);
					break;
				}
			}
		}
		rowsInput.value = ""; // Clear input field after insertion
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

		if (
			isInMemory &&
			this.currentInMemorySpreadsheet &&
			this.activeSheetName === sheetName
		) {
			// Update the in-memory AVL tree
			this.currentInMemorySpreadsheet.insertData(rowno, colname, value);
			dropdown.style.display = "none"; // Hide dropdown
			// console.log("In-memory spreadsheet updated:", this.currentInMemorySpreadsheet.retrieveCellData(rowno, colname));
			return; // Exit as it's an in-memory update
		}

		// --- Database-backed update logic (copied from previous version) ---
		try {
			const foreignKeysResult = await this.databaseService.getForeignKeyList(
				sheetName
			);
			let referringTable = "";
			let referringColumns = [];

			foreignKeysResult.forEach((col) => {
				if (col[3] === colname) {
					referringTable = col[2];
				}
			});

			if (referringTable !== "") {
				foreignKeysResult.forEach((col) => {
					if (col[2] === referringTable && col[3] !== colname) {
						referringColumns.push(col[3]);
					}
				});

				let relatedValuesQuery = "";
				let relatedValuesResult = null;

				if (referringColumns.length > 0) {
					relatedValuesQuery = `SELECT ${referringColumns
						.map((c) => `"${c}"`)
						.join(", ")} FROM "${sheetName}" WHERE c0 = ${rowno}`;
					relatedValuesResult =
						this.databaseService.runQuery(relatedValuesQuery);
				}

				let dropdownQuery = `SELECT DISTINCT("${colname}") FROM "${referringTable}" WHERE`;
				if (relatedValuesResult && relatedValuesResult.values.length > 0) {
					relatedValuesResult.columns.forEach((relCol, id) => {
						const relValue = relatedValuesResult.values[0][id];
						if (relValue !== "") {
							dropdownQuery += ` "${relCol}" = "${relValue}" AND`;
						}
					});
				}
				dropdownQuery += ` "${colname}" LIKE "%${value}%" LIMIT 10;`;

				const dropdownResult = this.databaseService.runQuery(dropdownQuery);
				dropdown.innerHTML = "";

				if (dropdownResult && dropdownResult.values.length > 0) {
					dropdown.style.display = "block";
					dropdownResult.values.forEach((data) => {
						const li = document.createElement("li");
						li.innerHTML = data[0];
						li.id = data[0];
						li.addEventListener("click", async (e) => {
							dropdown.style.display = "none";
							event.target.value = e.target.id;
							try {
								await this.databaseService.runQuery(
									`UPDATE "${sheetName}" SET "${colname}" = "${e.target.id}" WHERE c0 = ${rowno};`
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
				// No foreign key relationship, simply update the cell in DB
				await this.databaseService.runQuery(
					`UPDATE "${sheetName}" SET "${colname}" = "${value}" WHERE c0 = ${rowno};`
				);
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
	async saveInMemorySpreadsheetToDb() {
		if (!this.currentInMemorySpreadsheet) {
			alert("No in-memory spreadsheet to save.");
			return;
		}

		const spreadsheet = this.currentInMemorySpreadsheet;
		const newDbSheetName = `saved_sheet_${Math.floor(Math.random() * 100000)}`;

		try {
			// 1. Create the table in the database
			let createTableQuery = `CREATE TABLE "${newDbSheetName}" (c0 INTEGER PRIMARY KEY`;
			const dbColumnNames = []; // Columns for the DB table
			dbColumnNames.push("c0");

			// Assuming your in-memory spreadsheet column keys are the same as what you want in DB
			const inMemoryColumns = spreadsheet.columnTree._traverseInOrder(
				spreadsheet.columnTree.root
			);
			inMemoryColumns.forEach((colNode) => {
				if (colNode.key !== "c0") {
					// Skip c0 as it's handled by PRIMARY KEY
					createTableQuery += ` ,"${colNode.key}" TEXT`;
					dbColumnNames.push(colNode.key);
				}
			});
			createTableQuery += `);`;

			this.databaseService.runQuery(createTableQuery);
			console.log(`Table '${newDbSheetName}' created in DB.`);

			// 2. Iterate through the in-memory spreadsheet and insert data into the new DB table
			const allCells = spreadsheet.traverseAll(); // Get all data from AVL of AVL
			const chunkSize = 50;

			if (allCells.length > 0) {
				// Check if there are columns
				// Get a flattened list of all unique row keys for batching inserts
				const allRowKeys = Array.from(spreadsheet.uniqueRowKeys).sort(
					(a, b) => a - b
				);

				for (let i = 0; i < allRowKeys.length; i += chunkSize) {
					const batchRowKeys = allRowKeys.slice(i, i + chunkSize);
					let insertQuery = `INSERT INTO "${newDbSheetName}" (${dbColumnNames
						.map((c) => `"${c}"`)
						.join(", ")}) VALUES `;
					const batchValues = [];

					for (const rowKey of batchRowKeys) {
						const rowValues = [];
						rowValues.push(`${rowKey}`); // Add the row ID (c0)

						for (let j = 1; j < dbColumnNames.length; j++) {
							// Start from 1 to skip c0
							const colName = dbColumnNames[j];
							const cellValue = spreadsheet.retrieveCellData(rowKey, colName);
							rowValues.push(
								`"${String(cellValue || "").replace(/"/g, '""')}"`
							); // Sanitize and quote
						}
						batchValues.push(`(${rowValues.join(", ")})`);
					}

					if (batchValues.length > 0) {
						insertQuery += batchValues.join(", ") + ";";
						await this.databaseService.runQuery(insertQuery);
					}
				}
			}
			alert(
				`Spreadsheet '${spreadsheet.sheetName}' successfully saved to database as '${newDbSheetName}'.`
			);
			this.currentInMemorySpreadsheet = null; // Clear the in-memory spreadsheet after saving
			this.renderSheetsNames(); // Refresh the side panel to show the new DB sheet
			this.renderSheet(newDbSheetName); // Render the newly saved sheet (now DB-backed)
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
		try {
			const dump = await this.databaseService.exportDb();
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
		const sheetName = event.target.name;
		try {
			const res = await this.databaseService.selectAllFromTable(sheetName);
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
					const metadata = await this.databaseService.getTableMetadata(
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
							await this.databaseService.runQuery(query);
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
					this.renderSheet(sheetName); // Re-render the sheet
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
						await this.databaseService.runQuery(createTableQuery);
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
							await this.databaseService.runQuery(query);
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
					this.renderSheet(newSheetName); // Render the newly created sheet
					this.renderSheetsNames(); // Update side panel with new sheet
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
	async renderSheetsNames() {
		const sheetList = document.getElementById("sheet-list");
		sheetList.innerHTML = ""; // Clear existing list

		try {
			const tableNames = await this.databaseService.getTableNames();
			if (tableNames.length > 0) {
				tableNames.forEach((tableName) => {
					const anch = document.createElement("a");
					anch.innerHTML = `${tableName}`;
					anch.setAttribute("href", "#");
					anch.classList.add("anch");
					anch.addEventListener("click", (event) => {
						event.preventDefault();
						this.renderSheet(tableName); // Use class method
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
	 * Handles selection of a row.
	 * @param {number} rowKey - The key of the row to select.
	 */
	selectRow(rowKey) {
		// If the same row is clicked again, deselect it
		if (this.activeSelectionType === "row" && this.selectedRowKey === rowKey) {
			this.#clearSelection();
		} else {
			this.#clearSelection(); // Clear any previous selection (row or column)
			this.selectedRowKey = rowKey;
			this.activeSelectionType = "row";
			this.#highlightSelection();
		}
	}

	/**
	 * Handles selection of a column.
	 * @param {string} colKey - The key of the column to select.
	 */
	selectColumn(colKey) {
		// If the same column is clicked again, deselect it
		if (this.activeSelectionType === "col" && this.selectedColKey === colKey) {
			this.#clearSelection();
		} else {
			this.#clearSelection(); // Clear any previous selection (row or column)
			this.selectedColKey = colKey;
			this.activeSelectionType = "col";
			this.#highlightSelection();
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
		if (this.sheetColList && this.sheetColList.length > 0) {
			this.sheetColList.forEach((colClass) => {
				console.log(colClass);
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
	#highlightSelection() {
		if (!this.activeSheetName) return; // No active sheet to highlight on

		if (this.activeSelectionType === "row" && this.selectedRowKey !== null) {
			const tableBody = document.getElementById(
				`${this.activeSheetName}-data-input`
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

	/**
	 * Applies a background color to the currently selected row or column.
	 * @param {string} color - The CSS color string (e.g., "#FF0000", "blue").
	 */
	applyBackgroundColor(color) {
		if (!this.activeSelectionType) {
			alert("Please select a row or column first to apply color.");
			return;
		}

		if (this.activeSelectionType === "row" && this.selectedRowKey !== null) {
			const tableBody = document.getElementById(
				`${this.activeSheetName}-data-input`
			);
			if (tableBody) {
				const selectedRowElement = Array.from(tableBody.children).find((tr) => {
					const rowIdCell = tr.children[0];
					return (
						rowIdCell &&
						parseInt(rowIdCell.textContent, 10) === this.selectedRowKey
					);
				});
				if (selectedRowElement) {
					Array.from(selectedRowElement.children).forEach((cell) => {
						cell.style.backgroundColor = color;
					});
				}
			}
		} else if (
			this.activeSelectionType === "col" &&
			this.selectedColKey !== null
		) {
			document.querySelectorAll(`.${this.selectedColKey}`).forEach((el) => {
				// Apply color only to actual table cells (TH and TD)
				if (el.tagName === "TD" || el.tagName === "TH") {
					el.style.backgroundColor = color;
				}
			});
		}
		this.#clearSelection(); // Clear selection after applying color
		alert(
			`Background color applied to ${this.activeSelectionType} ${
				this.activeSelectionType === "row"
					? this.selectedRowKey
					: this.selectedColKey
			}.`
		);
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
