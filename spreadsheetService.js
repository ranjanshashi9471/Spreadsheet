// spreadsheetService.js
class BackendService {
	/**
	 * @classdesc A service layer that encapsulates all business logic and database interactions
	 * for the spreadsheet application. It provides a high-level API to the UI.
	 * @constructor
	 * @param {object} databaseService - A low-level service for direct database operations.
	 */
	constructor(databaseReference) {
		// Removed unused dataStructure parameter
		/**
		 * @property {object} databaseService - A low-level service for direct database operations.
		 */
		this.databaseService = new DatabaseService();
		this.databaseService.initialize();
	}

	/**
	 * Retrieves the names of all tables (sheets) from the database.
	 * @returns {Promise<Array<string>>} A promise that resolves to an array of table names.
	 */
	async getSheetNames(isInMemory = true) {
		if (isInMemory) {
			return await this.databaseService.getSheetNames();
		} else {
			return await this.databaseService.getTableNames();
		}
	}

	/**
	 * Inserts new rows with empty values into a specified sheet's table.
	 * @param {string} sheetName - The name of the sheet.
	 * @param {Array<string>} colList - An array of column names.
	 * @param {number} rowsToInsert - The number of rows to insert.
	 * @param {number} startRowId - The starting row ID for the new rows.
	 * @returns {Promise<void>} A promise that resolves when the insertion is complete.
	 */
	async insertEmptyRows(sheetName, colList, rowsToInsert, startRowId) {
		const chunkSize = 50;
		const colCount = colList.length;
		const noOfIterations = Math.ceil(rowsToInsert / chunkSize);

		for (let k = 0; k < noOfIterations; k++) {
			const currentBatchSize = Math.min(
				rowsToInsert - k * chunkSize,
				chunkSize,
			);
			let query = `INSERT INTO "${sheetName}" (${colList
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
			if (valuesToInsert.length > 0) {
				query += valuesToInsert.join(", ") + ";";
				await this.databaseService.runQuery(query);
			}
		}
	}

	/**
	 * Retrieves data and foreign key suggestions for a cell based on its current value.
	 * @param {string} sheetName - The name of the sheet.
	 * @param {Array<string>} pKeyList - The list of primary key column names.
	 * @param {Array<string>} pKeyValues - The list of primary key values corresponding to pKeyList.
	 * @param {string} colname - The name of the column (key) of the cell.
	 * @param {string} value - The current value of the cell.
	 * @returns {Promise<object>} A promise that resolves to an object containing foreign key suggestions or an update query.
	 */
	async getCellUpdateInfo(sheetName, pKeyList, pKeyValues, colname, value) {
		const foreignKeysResult =
			await this.databaseService.getForeignKeyList(sheetName);
		let referringTable = "";
		let referringColumns = [];
		foreignKeysResult.forEach((col) => {
			//structure: [id, seq, referring_table, referring_column, referred_table, referred_column, update_rule, delete_rule, match]
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

			let relatedValuesResult = null;
			if (referringColumns.length > 0) {
				const relatedValuesQuery = `SELECT ${referringColumns
					.map((c) => `"${c}"`)
					.join(", ")} FROM "${sheetName}" WHERE ${pKeyList
					.map((key, _id) => `${key} = "${pKeyValues[_id]}"`)
					.join(" AND ")};`;
				relatedValuesResult =
					await this.databaseService.runQuery(relatedValuesQuery);
			}

			let dropdownQuery = `SELECT DISTINCT("${colname}") FROM "${referringTable}" WHERE`;
			if (relatedValuesResult && relatedValuesResult.values.length > 0) {
				relatedValuesResult.columns.forEach((relCol, _id) => {
					const relValue = relatedValuesResult.values[0][_id];
					if (relValue !== "") {
						dropdownQuery += ` "${relCol}" = "${relValue}" AND`;
					}
				});
			}
			dropdownQuery += ` "${colname}" LIKE "%${value}%" LIMIT 10;`;
			const dropdownResult = await this.databaseService.runQuery(dropdownQuery);

			return {
				type: "foreignKey",
				suggestions: dropdownResult ? dropdownResult.values : [],
			};
		} else {
			return {
				type: "directUpdate",
				suggestions: null,
			};
		}
	}

	/**
	 * Executes a database update query. This is a generic method for updating a cell.
	 * @param {string} query - The UPDATE SQL query string, possibly with '?' placeholders.
	 * @param {Array<*>} [params=[]] - An array of parameters to bind to the query's placeholders.
	 * @returns {Promise<void>} A promise that resolves when the update is complete.
	 */
	async updateCell(query, params = []) {
		await this.databaseService.runQuery(query, params);
	}

	//#region Helpers

	#ConvertTreeToDataArray(columnTree) {
		const largeDataSet = [];

		const inMemoryColumns = columnTree._traverseInOrder(columnTree.root);

		for (const col of inMemoryColumns) {
			const inMemoryRows = col.rows
				? col.rows._traverseInOrder(col.rows.root)
				: [];

			for (const row of inMemoryRows) {
				largeDataSet.push({
					col_id: String(col.key),
					row_id: String(row.key),
					cell_value: String(row.value ?? ""),
					cell_style:
						row.style && Object.keys(row.style).length > 0
							? JSON.stringify(row.style)
							: "{}",
				});
			}
		}
		return largeDataSet;
	}

	/**
	 * Iterates through the entire AVL tree to collect all unique row IDs
	 * that currently exist (meaning they contain modified data or styles).
	 * @param {Spreadsheet} spreadsheet
	 * @returns {Set<number|string>} Set of all modified row keys.
	 */
	#getAllModifiedRowKeys(columnTree) {
		const modifiedRowKeys = new Set();
		const allColumns = columnTree._traverseInOrder(columnTree.root);

		for (const colNode of allColumns) {
			if (colNode.rows) {
				// Traverse the inner row tree for this column
				const inMemoryRows = colNode.rows._traverseInOrder(colNode.rows.root);
				for (const rowNode of inMemoryRows) {
					modifiedRowKeys.add(rowNode.key); // Add the unique row ID to the Set
				}
			}
		}
		return modifiedRowKeys;
	}

	/**
	 * Constructs a 2D array of data rows from the sparse AVL tree structure,
	 * suitable for bulk insertion into the database.
	 * @param {Spreadsheet.columnTree} columnTree
	 * @param {Array<string>} targetColumns - The list of target column names.
	 * @returns {Array<Array<*>>} 2D array of data rows.
	 */
	#GetDataArrayFromSparseTree(spreadsheet) {
		//Used for DB dump and schema related tables only.

		const { columnTree, columns: targetColumns, isInMemory } = spreadsheet;

		// 1. Identify all unique row keys that have been modified in the sparse tree.
		const allModifiedRowKeys = this.#getAllModifiedRowKeys(columnTree);

		const dataRows = [];

		// Iterate over the SET of identified modified Row IDs
		for (const rowId of allModifiedRowKeys) {
			const rowValues = [];

			targetColumns.forEach((colName, colKey) => {
				const value = spreadsheet.retrieveCellData(rowId, colKey)?.value || "";
				rowValues.push(value);

				// const styles = spreadsheet.retrieveCellData(rowId, colKey)?.style || {};
				// Push value and style (as JSON string) into the row array
				// if (isInMemory && Object.keys(styles).length !== 0) {
				// 	rowValues.push(JSON.stringify(styles));
				// }
			});

			// Add the fully collected row array to the bulk insert batch
			dataRows.push(rowValues);
		}
		return dataRows;
	}

	//#endregion

	/**
	 * Saves the current sparse in-memory data to the appropriate persistence layer.
	 * This acts as the master save router.
	 * @param {Spreadsheet} inMemorySpreadsheet - The AVL of AVL instance.
	 * @returns {Promise<void>}
	 */
	async SaveSpreadsheetChanges(inMemorySpreadsheet) {
		try {
			if (
				!inMemorySpreadsheet ||
				inMemorySpreadsheet.columnTree.root === null
			) {
				throw new Error("No data changes to save.");
			}

			if (inMemorySpreadsheet.isInMemory) {
				await this.#SaveInMemorySpreadsheet(inMemorySpreadsheet);
			} else {
				await this.#SyncNotInMemorySpreadsheet(inMemorySpreadsheet);
			}
		} catch (error) {
			console.error("Error saving spreadsheet changes:", error);
			throw error; // Re-throw to allow the calling UI function to handle it
		}
	}

	/**
	 * Creates a new table for a new in-memory spreadsheet and populates it with data.
	 * @param {Spreadsheet} inMemorySpreadsheet - The in-memory AVL of AVL instance.
	 * @returns {Promise<void>} A promise that resolves when the save operation is complete.
	 */
	async #SaveInMemorySpreadsheet(inMemorySpreadsheet) {
		let sheetId = null;
		const spreadsheetName = inMemorySpreadsheet.sheetName;

		try {
			if (inMemorySpreadsheet.columnTree.root === null) {
				throw new Error("In-memory spreadsheet has no columns to save.");
			}

			let sheetResult =
				await this.databaseService.findSheetByName(spreadsheetName);

			try {
				// Start a transaction
				await this.databaseService.StartTransaction();

				if (sheetResult == null) {
					console.log("Table doesn't exists.");

					sheetId = await this.databaseService.addSheet(
						spreadsheetName,
						inMemorySpreadsheet.maxRows,
					);

					await this.databaseService.insertColumnNames(
						sheetId,
						inMemorySpreadsheet.columns,
					);
				} else {
					sheetId = sheetResult[0];
					await this.databaseService.setUpdatedAtTimestamp(sheetId);
					console.log("Using existing table with ID:", sheetId);
				}

				const largeDataSet = this.#ConvertTreeToDataArray(
					inMemorySpreadsheet.columnTree,
				);

				// Await the bulk insert call
				await this.databaseService.InsertBulkDataForInMemory(
					sheetId,
					largeDataSet,
				);
				await this.databaseService.CommitTransaction();

				console.log(`Successfully saved in-memory spreadsheet to DB.`);
			} catch (error) {
				await this.databaseService.rollbackTransaction();
				console.error("Error saving in-memory spreadsheet:", error);
				throw error; // Re-throw to allow the calling UI function to handle it
			}
		} catch (error) {
			console.error("Error saving in-memory spreadsheet:", error);
			throw error; // Re-throw to allow the calling UI function to handle it
		}
	}

	/**
	 * Syncs changes from a non-in-memory spreadsheet back to its database table.
	 * @param {Spreadsheet} spreadsheet - The non-in-memory AVL of AVL instance.
	 * @returns {Promise<void>}
	 */
	async #SyncNotInMemorySpreadsheet(spreadsheet) {
		// Implementation for syncing changes to the database
		try {
			const targetColumns = spreadsheet.columns; // Raw column names from the external table

			const dataRows = this.#GetDataArrayFromSparseTree(spreadsheet);

			// Mode 2: External Schema (Saving back to the raw user table)
			await this.databaseService.StartTransaction();

			await this.databaseService.InsertReplaceBulkDataForNotInMemory(
				spreadsheet.sheetName,
				targetColumns,
				dataRows,
			);

			await this.databaseService.CommitTransaction();

			console.log(
				`Successfully saved ${dataRows.length} rows to external table: ${spreadsheet.sheetName}`,
			);
		} catch (error) {
			await this.databaseService.rollbackTransaction();
			throw new Error(
				`Failed to save changes to external table "${targetTableName}": ${error.message}`,
			);
		}
	}

	async #loadSheetData(spreadsheet) {
		const sheetResult = await this.databaseService.findSheetByName(
			spreadsheet.sheetName,
		);

		if (sheetResult == null) {
			throw new Error("Sheet not found!!");
		}

		const sheetId = sheetResult[0];
		spreadsheet.maxRows = sheetResult[2];
		spreadsheet.sheetId = sheetId;

		//fetch columns
		const columnData = await this.databaseService.getSheetColumns(sheetId);
		if (columnData == null) {
			throw new Error("No Columns Found");
		}

		spreadsheet.columns = columnData.map((col) => `C${col[0]}`);

		//fetch data
		const sheetData = await this.databaseService.getSheetData(sheetId);

		if (sheetData == null) {
			spreadsheet.maxRows = 1;
			console.log("No Data found!!", "Executing Load Sheet Data");
		}

		for (const data of sheetData.values) {
			//data format:
			// 0: "id", 1: "sheet_id", 2: "col_id", 3: "row_id", 4: "cell_value", 5: "cell_style"
			let parsedStyle = {};

			if (data[5] && data[5] !== "{}" && data[5] !== "") {
				try {
					parsedStyle = JSON.parse(data[5]);
				} catch (e) {
					console.error("Failed to parse style from DB:", data[5]);
				}
			}

			spreadsheet.insertData(
				parseInt(data[3], 10), // row_id
				parseInt(data[2], 10), // col_id
				data[4], // cell_value
				parsedStyle, // cell_style
			);
		}

		console.log(spreadsheet);
	}

	async #loadTableData(spreadsheet) {
		const sheetResult = await this.databaseService.getTableNames();
		const sheetId = sheetResult.find((s) => s === spreadsheet.sheetName)?.[0];

		if (sheetId == null) {
			throw new Error("Table not found!!");
		}

		const tableInfo = await this.databaseService.getTableInfo(
			spreadsheet.sheetName,
		);

		if (tableInfo != null) {
			tableInfo.forEach((element) => {
				spreadsheet.columns.push(element[1]);
				if (element[5] > 0) {
					spreadsheet.primaryKeys.add(element[0]);
				}
			});
		}

		//incase of db dump and schema select statement gives column and values
		const sheetData = await this.databaseService.selectAllFromTable(
			spreadsheet.sheetName,
		);
		console.log("DUMP", sheetData);

		if (sheetData == null) {
			spreadsheet.renderData = [];
			spreadsheet.maxRows = 1;
		} else {
			// spreadsheet.columns = sheetData.columns;
			spreadsheet.maxRows = sheetData.values.length;

			//format
			//values: Array of rows
			//rows: Array of columns
			// e.g., [[row1col1, row1col2], [row2col1, row2col2], ...]

			// insert data into in-memory structure
			sheetData.values.forEach((row, _rowId) => {
				const rowId = _rowId + 1;
				row.forEach((cellValue, colId) => {
					if (spreadsheet.primaryKeys.has(colId)) {
						if (spreadsheet.primaryKeyMap.has(rowId)) {
							spreadsheet.primaryKeyMap.get(rowId).push(cellValue);
						} else {
							spreadsheet.primaryKeyMap.set(rowId, [cellValue]); // rowId + 1 to start from 1
						}
					}
					spreadsheet.insertData(rowId, colId, cellValue, {}); // rowId + 1 to start from 1
				});
			});
		}
	}

	/**
	 * Loads a spreadsheet from the database into an in-memory AVL of AVL structure.
	 * @param {string} spreadsheetName - The name of the sheet (table) to load.
	 * @param {boolean} isInMemory - True if this is an in-memory spreadsheet, false if DB-backed.
	 * @returns {Promise<Spreadsheet|null>} A promise that resolves to the loaded Spreadsheet instance or null.
	 */
	async loadSpreadsheet(spreadsheetName, isInMemory = true) {
		if (spreadsheetName == null) {
			return null;
		}

		const spreadsheet = new Spreadsheet(spreadsheetName);
		spreadsheet.isInMemory = isInMemory;

		try {
			if (isInMemory) {
				await this.#loadSheetData(spreadsheet);
			} else {
				await this.#loadTableData(spreadsheet);
			}
		} catch (error) {
			console.error(error);
			throw new Error("Error Loading Spreadsheet From DB!!");
		}
		return spreadsheet;
	}

	/**
	 * Loads a database dump file into the database.
	 * @param {File} file - The dump file.
	 * @returns {Promise<void>}
	 */
	async loadDump(file) {
		await this.databaseService.loadDump(file);
	}

	/**
	 * Executes a SQL schema script.
	 * @param {string} schemaSQL - The schema SQL as a string.
	 * @returns {Promise<void>}
	 */
	async runSchema(schemaSQL) {
		await this.databaseService.runSchema(schemaSQL);
	}

	/**
	 * Executes a SQL query.
	 * @param {string} query - The query string.
	 * @returns {Promise<object|null>} A promise resolving to the query result.
	 */
	async runQuery(query) {
		return await this.databaseService.runQuery(query);
	}

	/**
	 * Retrieves foreign key constraints for a table.
	 * @param {string} sheetName - The sheet name.
	 * @returns {Promise<Array<Array<any>>>}
	 */
	async getForeignKeyList(sheetName) {
		return await this.databaseService.getForeignKeyList(sheetName);
	}

	/**
	 * Exports the database as a dump.
	 * @returns {Promise<Uint8Array>} A promise resolving to the database dump.
	 */
	async exportDb() {
		return await this.databaseService.exportDb();
	}

	//#region JSON Import/Export

	/**
	 * Validates the imported JSON data against the expected schema.
	 * @param {Object} jsonData
	 * @param {Array<string>} columns
	 */
	#JsonDataValidator(jsonData, columns) {
		if (jsonData == null || jsonData.columns == null || jsonData.rows == null) {
			throw new Error(
				"Invalid JSON schema: Missing 'columns' or 'rows' array.",
			);
		}

		// 2. Validate Column Length
		// (If you want Arbor to adapt to new column sizes automatically, you can remove this check)
		if (jsonData.columns.length !== columns.length) {
			throw new Error(
				`Column mismatch: Expected ${columns.length} columns, but file has ${jsonData.columns.length}.`,
			);
		}

		// 3. Validate the internal structure of the new 'rows' objects
		jsonData.rows.forEach((rowObj, index) => {
			// Ensure rowId exists and is a valid number
			if (
				rowObj.rowId === undefined ||
				rowObj.rowId === null ||
				typeof rowObj.rowId !== "number"
			) {
				throw new Error(
					`Invalid data at index ${index}: Missing or invalid 'rowId'.`,
				);
			}

			// Ensure cells property is an actual array
			if (!rowObj.cells || !Array.isArray(rowObj.cells)) {
				throw new Error(
					`Invalid data at rowId ${rowObj.rowId}: Missing 'cells' array.`,
				);
			}

			// Ensure the data length matches the column length
			if (rowObj.cells.length !== columns.length) {
				throw new Error(
					`Data length mismatch at rowId ${rowObj.rowId}. Expected ${columns.length} cells, got ${rowObj.cells.length}.`,
				);
			}
		});
	}

	/**
	 * Handles importing JSON data into the spreadsheet.
	 * @param {Spreadsheet} spreadsheet
	 * @param {File} jsonFile - The JSON file to import.
	 */
	async HandleJsonImport(spreadsheet, jsonFile) {
		try {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();

				reader.onload = async (e) => {
					try {
						// 1. Parse and Validate
						const res = JSON.parse(e.target.result);

						// NOTE: Ensure #JsonDataValidator is updated to expect the new schema if needed
						if (this.#JsonDataValidator) {
							this.#JsonDataValidator(res, spreadsheet.columns);
						}

						// 2. Extract the new 'rows' array instead of 'values'
						const jsonRows = res.rows;

						if (!jsonRows || !Array.isArray(jsonRows)) {
							throw new Error("Invalid JSON schema: Missing 'rows' array.");
						}

						let highestImportedRowId = spreadsheet.maxRows;

						// 3. Insert Data into Spreadsheet at the EXACT Row IDs
						for (const rowObj of jsonRows) {
							const targetRowId = rowObj.rowId;
							const cells = rowObj.cells;

							// Track the highest row ID so the UI knows how far to scroll
							if (targetRowId > highestImportedRowId) {
								highestImportedRowId = targetRowId;
							}

							for (let c = 0; c < cells.length; c++) {
								const cellValue = cells[c];

								// Optimization: Only insert if there's actual data to save memory
								if (cellValue !== "" && cellValue !== null) {
									spreadsheet.insertData(targetRowId, c, cellValue, {});
								}
							}
						}

						// 4. Update Max Row Count
						spreadsheet.maxRows = highestImportedRowId;

						resolve(); // SUCCESS: Resolve the promise after all insertions
					} catch (ex) {
						console.error("reader.onload failed:", ex);
						reject(ex); // FAILURE: Reject the promise on error
					}
				};

				reader.onerror = () => {
					reject(new Error("Failed to read file."));
				};

				reader.readAsText(jsonFile);
			});
		} catch (ex) {
			console.error("HandleJsonImport", ex);
			throw ex;
		}
	}

	/**
	 * Handles exporting the spreadsheet data as a JSON Blob.
	 * @param {Spreadsheet} spreadsheet
	 * @returns {Blob}
	 */
	HandleJsonExport(spreadsheet) {
		let blob = null;
		const { columnTree, columns, isInMemory } = spreadsheet;

		try {
			//fetch columns
			const rowIdSet = this.#getAllModifiedRowKeys(columnTree);

			const exportPayload = {
				sheetName: spreadsheet.sheetName,
				columns: spreadsheet.columns,
				rows: [], // Changed from 'values' to 'rows'
			};

			rowIdSet.forEach((_rowId) => {
				const rowValue = [];
				columns.forEach((colName, colKey) => {
					const cellData = spreadsheet.retrieveCellData(_rowId, colKey);
					rowValue.push(cellData?.value ?? "");
				});

				// 3. Save the explicit rowId alongside its data
				exportPayload.rows.push({
					rowId: Number(_rowId),
					cells: rowValue,
				});
			});

			if (exportPayload != null) {
				blob = new Blob([JSON.stringify(exportPayload)], {
					type: "application/json",
				});
			}
		} catch (error) {
			console.log("ExportJsonForNotInMemory", error);
			throw error;
		}

		return blob;
	}

	//#endregion

	//#region
	//#endregion
}
