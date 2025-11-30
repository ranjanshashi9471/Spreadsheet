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
				chunkSize
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
		debugger;
		const foreignKeysResult = await this.databaseService.getForeignKeyList(
			sheetName
		);
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
				relatedValuesResult = await this.databaseService.runQuery(
					relatedValuesQuery
				);
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

	/**
	 * Creates a new table for a new in-memory spreadsheet and populates it with data.
	 * @param {string} spreadsheetName - The name for the new database sheet.
	 * @param {Spreadsheet} inMemorySpreadsheet - The in-memory AVL of AVL instance.
	 * @returns {Promise<void>} A promise that resolves when the save operation is complete.
	 */
	async saveInMemorySpreadsheet(spreadsheetName, inMemorySpreadsheet) {
		let sheetId = null;
		const largeDataSet = [];

		try {
			if (inMemorySpreadsheet.columnTree.root === null) {
				throw new Error("In-memory spreadsheet has no columns to save.");
			}

			let sheetResult = await this.databaseService.findSheetByName(
				spreadsheetName
			);
			// Start a transaction
			await this.databaseService.startTransaction();

			if (sheetResult == null) {
				console.log("Table doesn't exists.");

				sheetId = await this.databaseService.addSheet(
					spreadsheetName,
					inMemorySpreadsheet.maxRows
				);

				await this.databaseService.insertColumnNames(
					sheetId,
					inMemorySpreadsheet.columns
				);
			} else {
				sheetId = sheetResult[0];
				await this.databaseService.setUpdatedAtTimestamp(sheetId);
				console.log("Using existing table with ID:", sheetId);
			}

			const inMemoryColumns = inMemorySpreadsheet.columnTree._traverseInOrder(
				inMemorySpreadsheet.columnTree.root
			);

			for (const col of inMemoryColumns) {
				const inMemoryRows = col.rows
					? col.rows._traverseInOrder(col.rows.root)
					: [];

				for (const row of inMemoryRows) {
					const sheetDataRow = {
						col_id: col.key,
						row_id: row.key,
						cell_value: row.value,
						cell_style: JSON.stringify(row.style), // Assuming style is a property on RowNode
					};
					largeDataSet.push(sheetDataRow);
				}
			}

			// Await the bulk insert call
			await this.databaseService.insertBulkData(sheetId, largeDataSet);
			await this.databaseService.commitTransaction();

			console.log(`Successfully saved in-memory spreadsheet to DB.`);
		} catch (error) {
			await this.databaseService.rollbackTransaction();
			console.error("Error saving in-memory spreadsheet:", error);
			throw error; // Re-throw to allow the calling UI function to handle it
		}
	}

	async #loadSheetData(spreadsheet) {
		debugger;
		const sheetResult = await this.databaseService.findSheetByName(
			spreadsheet.sheetName
		);

		if (sheetResult == null) {
			throw new Error("Sheet not found!!");
		}

		const sheetId = sheetResult[0];
		spreadsheet.maxRows = sheetResult[2];

		//fetch columns
		const columnData = await this.databaseService.getSheetColumns(sheetId);
		if (columnData == null) {
			throw new Error("No Columns Found");
		}

		spreadsheet.columns = columnData.map((col) => `C${col[0]}`);

		//fetch data
		const sheetData = await this.databaseService.getSheetData(sheetId);

		if (sheetData == null) {
			spreadsheet.maxRows = 0;
			console.log("No Data found!!", "Executing Load Sheet Data");
		}
		for (const data of sheetData.values) {
			//data format:
			// 0: "id", 1: "sheet_id", 2: "col_id", 3: "row_id", 4: "cell_value", 5: "cell_style"
			spreadsheet.insertData(
				data[3] - "0",
				data[2] - "0",
				data[4],
				JSON.parse(data[5])
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
			spreadsheet.sheetName
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
			spreadsheet.sheetName
		);
		console.log("DUMP", sheetData);

		if (sheetData == null) {
			spreadsheet.renderData = [];
			spreadsheet.maxRows = 0;
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
		debugger;
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
	 * Retrieves table information using PRAGMA.
	 * @param {string} sheetName - The sheet name.
	 * @returns {Promise<Array<Array<string>>>}
	 */
	async getTableMetadata(sheetName) {
		return await this.databaseService.getTableMetadata(sheetName);
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
}
