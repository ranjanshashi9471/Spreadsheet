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
		this.databaseService = databaseReference;
	}

	/**
	 * Retrieves the names of all tables (sheets) from the database.
	 * @returns {Promise<Array<string>>} A promise that resolves to an array of table names.
	 */
	async getSheetNames() {
		return await this.databaseService.getSheetNames();
	}

	/**
	 * Retrieves all data from a specified table.
	 * @param {string} sheetName - The name of the sheet (table) to retrieve data from.
	 * @returns {Promise<object|null>} A promise that resolves to the result object (columns and values) or null.
	 */
	async getTableData(sheetName) {
		return await this.databaseService.selectAllFromTable(sheetName);
	}

	/**
	 * Retrieves column information for a specified table.
	 * @param {string} sheetName - The name of the sheet (table).
	 * @returns {Promise<Array<Array<string>>>} A promise that resolves to an array of arrays, where each inner array is column info.
	 */
	async getTableInfo(sheetName) {
		return await this.databaseService.getTableInfo(sheetName);
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
	 * @param {number} rowno - The row number (key) of the cell.
	 * @param {string} colname - The name of the column (key) of the cell.
	 * @param {string} value - The current value of the cell.
	 * @returns {Promise<object>} A promise that resolves to an object containing foreign key suggestions or an update query.
	 */
	async getCellUpdateInfo(sheetName, rowno, colname, value) {
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

			let relatedValuesResult = null;
			if (referringColumns.length > 0) {
				const relatedValuesQuery = `SELECT ${referringColumns
					.map((c) => `"${c}"`)
					.join(", ")} FROM "${sheetName}" WHERE c0 = ${rowno}`;
				relatedValuesResult = await this.databaseService.runQuery(
					relatedValuesQuery
				);
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
			const dropdownResult = await this.databaseService.runQuery(dropdownQuery);

			return {
				type: "foreignKey",
				suggestions: dropdownResult ? dropdownResult.values : [],
				updateQuery: `UPDATE "${sheetName}" SET "${colname}" = ? WHERE c0 = ${rowno};`,
			};
		} else {
			return {
				type: "directUpdate",
				updateQuery: `UPDATE "${sheetName}" SET "${colname}" = "${value}" WHERE c0 = ${rowno};`,
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
			if (sheetResult == null) {
				console.log("Table doesn't exists.");
				sheetId = await this.databaseService.addSheet(spreadsheetName);
				console.log(sheetId);
				await this.databaseService.insertColumnNames(
					sheetId,
					inMemorySpreadsheet.columns
				);
			} else {
				sheetId = sheetResult[0];
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
			console.log(`Successfully saved in-memory spreadsheet to DB.`);
		} catch (error) {
			console.error("Error saving in-memory spreadsheet:", error);
			throw error; // Re-throw to allow the calling UI function to handle it
		}
	}

	async loadSpreadsheet(spreadsheetName) {
		try {
			console.log("Loading spreadsheet:", spreadsheetName);
			if (spreadsheetName == null) {
				return null;
			}
			const spreadsheet = new Spreadsheet(spreadsheetName);

			//check for sheet presence
			let sheetResult = await this.databaseService.findSheetByName(
				spreadsheetName
			);
			if (sheetResult == null) {
				console.log("Table doesn't exists.");
				throw new Error("Sheet not found!!");
			}

			const sheetId = sheetResult[0];

			//fetch columns
			const columnData = await this.databaseService.getSheetColumns(sheetId);
			if (columnData == null) {
				throw new Error("No Columns Found");
			}
			for (const col of columnData) {
				spreadsheet.columns.push(col[0]);
			}

			//fetch data
			const sheetData = await this.databaseService.getSheetData(sheetId);
			if (sheetData == null) {
				throw new Error("No Data found!!");
			}
			for (const data of sheetData) {
				spreadsheet.insertData(data[2], data[1], data[3], JSON.parse(data[4]));
			}
			spreadsheet.maxRows = sheetData.length;
			return spreadsheet;
		} catch (error) {
			console.log(error);
			throw new Error("Error Loading Sheet From DB!!");
		}
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
