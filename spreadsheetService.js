class BackendService {
	/**
	 * @classdesc A service layer that encapsulates all business logic and database interactions
	 * for the spreadsheet application. It provides a high-level API to the UI.
	 * @constructor
	 */
	constructor(databaseService) {
		/**
		 * @property {object} databaseService - A low-level service for direct database operations.
		 */
		this.databaseService = databaseService;
		/**
		 * @property {Spreadsheet|null} currentInMemorySpreadsheet - The current in-memory data structure for new sheets.
		 */
		this.currentInMemorySpreadsheet = null;
	}

	/**
	 * Retrieves the names of all tables (sheets) from the database.
	 * @returns {Promise<Array<string>>} A promise that resolves to an array of table names.
	 */
	async getTableNames() {
		return this.databaseService.getTableNames();
	}

	/**
	 * Retrieves all data from a specified table.
	 * @param {string} sheetName - The name of the sheet (table) to retrieve data from.
	 * @returns {Promise<object|null>} A promise that resolves to the result object (columns and values) or null.
	 */
	async getTableData(sheetName) {
		return this.databaseService.selectAllFromTable(sheetName);
	}

	/**
	 * Retrieves column information for a specified table.
	 * @param {string} sheetName - The name of the sheet (table).
	 * @returns {Promise<Array<Array<string>>>} A promise that resolves to an array of arrays, where each inner array is column info.
	 */
	async getTableInfo(sheetName) {
		return this.databaseService.getTableInfo(sheetName);
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
	 * @param {string} sheetName - The name for the new database sheet.
	 * @param {Spreadsheet} inMemorySpreadsheet - The in-memory AVL of AVL instance.
	 * @returns {Promise<void>} A promise that resolves when the save operation is complete.
	 */
	async saveInMemorySpreadsheet(inMemorySpreadsheet) {
		const sheetName = inMemorySpreadsheet.sheetName;

		//Check if table exists
		const query = `SELECT * FROM sheets WHERE sheet_name = "${sheetName}"`;
		const result = await this.databaseService.runQuery(query);
		if (result && result.values.length == 0) {
			console.log("Table doesn't exists.");
			this.databaseService.runQuery(
				`INSERT INTO sheets (sheet_id, sheet_name) VALUES (NULL, "${sheetName}")`
			);
		}
		let createTableQuery = `CREATE TABLE "${inMemorySpreadsheet.sheetName}" (c0 INTEGER PRIMARY KEY`;
		const dbColumnNames = ["c0"];

		const inMemoryColumns = inMemorySpreadsheet.columnTree._traverseInOrder(
			inMemorySpreadsheet.columnTree.root
		);
		inMemoryColumns.forEach((colNode) => {
			if (colNode.key !== "c0") {
				createTableQuery += ` ,"${colNode.key}" TEXT`;
				dbColumnNames.push(colNode.key);
			}
		});
		createTableQuery += `);`;
		await this.databaseService.runQuery(createTableQuery);

		const allRowKeys = Array.from(inMemorySpreadsheet.uniqueRowKeys).sort(
			(a, b) => a - b
		);
		const chunkSize = 50;

		for (let i = 0; i < allRowKeys.length; i += chunkSize) {
			const batchRowKeys = allRowKeys.slice(i, i + chunkSize);
			let insertQuery = `INSERT INTO "${sheetName}" (${dbColumnNames
				.map((c) => `"${c}"`)
				.join(", ")}) VALUES `;
			const batchValues = [];

			for (const rowKey of batchRowKeys) {
				const rowValues = [`${rowKey}`];
				for (let j = 1; j < dbColumnNames.length; j++) {
					const colName = dbColumnNames[j];
					const cellValue = inMemorySpreadsheet.retrieveCellData(
						rowKey,
						colName
					);
					rowValues.push(`"${String(cellValue || "").replace(/"/g, '""')}"`);
				}
				batchValues.push(`(${rowValues.join(", ")})`);
			}
			if (batchValues.length > 0) {
				insertQuery += batchValues.join(", ") + ";";
				await this.databaseService.runQuery(insertQuery);
			}
		}
	}

	async loadDump(file) {
		this.databaseService.loadDump(file);
	}

	async runSchema(schemaSQL) {
		this.databaseService.runSchema(schemaSQL);
	}

	async runQuery(query) {
		this.databaseService.runQuery(query);
	}

	getTableInfo(sheetName) {
		this.databaseService.getTableInfo(sheetName);
	}

	getTableMetadata(sheetName) {
		this.databaseService.getTableMetadata(sheetName);
	}

	getForeignKeyList(sheetName) {
		this.databaseService.getForeignKeyList(sheetName);
	}

	async exportDb() {
		this.databaseService.exportDb();
	}
}
