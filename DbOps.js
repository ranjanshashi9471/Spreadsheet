// DatabaseService.js

class DatabaseService {
	constructor() {
		this.db = null;
		this.SQL = null;
	}

	/**
	 * Initializes the SQLite database and creates the necessary tables.
	 * @returns {Promise<void>} A promise that resolves when the database is initialized.
	 */
	async Initialize() {
		if (this.db) {
			console.warn("Database already initialized.");
			return;
		}
		try {
			if (typeof initSqlJs === "undefined") {
				console.error(
					"initSqlJs is not defined. Please ensure sql.js is loaded.",
				);
				throw new Error("SQL.js library not loaded.");
			}
			this.SQL = await initSqlJs();
			this.db = new this.SQL.Database();

			this.db.run("PRAGMA foreign_keys = ON;");

			await this.RunSchema(`
				CREATE TABLE IF NOT EXISTS _sheets (
					sheet_id INTEGER PRIMARY KEY AUTOINCREMENT,
					sheet_name TEXT UNIQUE NOT NULL,
					max_row INTEGER DEFAULT 0,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);

				CREATE TABLE IF NOT EXISTS _sheet_columns (
					id INTEGER PRIMARY KEY AUTOINCREMENT, -- Fixed PRIMARY KEY
					sheet_id INTEGER NOT NULL,
					column_name TEXT NOT NULL,
					UNIQUE(sheet_id, column_name), -- Ensures uniqueness for each column per sheet
					FOREIGN KEY (sheet_id) REFERENCES _sheets(sheet_id) ON DELETE CASCADE
				);

				CREATE TABLE IF NOT EXISTS _sheet_data (
					id INTEGER PRIMARY KEY AUTOINCREMENT, -- Fixed PRIMARY KEY
					sheet_id INTEGER NOT NULL,
					col_id TEXT NOT NULL,
					row_id TEXT NOT NULL,
					cell_value TEXT,
    				cell_style TEXT,
    				UNIQUE(sheet_id, col_id, row_id), -- Composite unique constraint
    				FOREIGN KEY (sheet_id) REFERENCES _sheets(sheet_id) ON DELETE CASCADE
				);
            `);
			console.log("Database created and initialized with schema.");
		} catch (error) {
			console.error("Error initializing database:", error);
			throw error;
		}
	}

	/**
	 * Starts a database transaction.
	 * @returns {Promise<void>}
	 */
	async StartTransaction() {
		this.#EnsureDbInitialized();
		this.db.run("BEGIN TRANSACTION;");
	}

	/**
	 * Commits the current database transaction.
	 * @returns {Promise<void>}
	 */
	async CommitTransaction() {
		this.#EnsureDbInitialized();
		this.db.run("COMMIT;");
	}

	/**
	 * Rolls back the current database transaction.
	 * @returns {Promise<void>}
	 */
	async RollbackTransaction() {
		this.#EnsureDbInitialized();
		this.db.run("ROLLBACK;");
	}

	/**
	 * Loads a database dump file, replacing the current database.
	 * @param {Uint8Array} array - The dump file.
	 * @returns {Promise<void>}
	 */
	async LoadDump(array) {
		this.#EnsureDbInitialized();
		try {
			if (this.db) {
				this.db.close();
			}

			this.db = await new this.SQL.Database(array);
			console.log("Database dump loaded successfully.");
		} catch (error) {
			console.error("Error loading database dump:", error);
			throw error;
		}
	}

	/**
	 * Executes SQL schema content.
	 * @param {string} schemaSql - The SQL schema content.
	 */
	async RunSchema(schemaSql) {
		this.#EnsureDbInitialized();
		try {
			await this.db.run(schemaSql);
			console.log("Schema loaded successfully.");
		} catch (error) {
			console.error("Error running schema:", error);
			throw new Error("Error in running the schema file: " + error.message);
		}
	}

	/**
	 * Finds a sheet's metadata by name.
	 * @param {string} sheetName - The name of the sheet.
	 * @returns {Promise<Array<any>|null>} A promise that resolves to the sheet's metadata or null.
	 */
	async FindSheetByName(sheetName) {
		const result = await this.RunQuery(
			`SELECT * FROM _sheets WHERE sheet_name = ?;`,
			[sheetName],
		);
		return result ? result.values[0] : null;
	}

	/**
	 * Finds a sheet's metadata by ID.
	 * @param {number} sheetId - The ID of the sheet.
	 * @returns {Promise<Array<any>|null>} A promise that resolves to the sheet's metadata or null.
	 */
	async FindSheetById(sheetId) {
		const result = await this.RunQuery(
			`SELECT * FROM _sheets WHERE sheet_id = ${sheetId};`,
		);
		return result ? result.values[0] : null;
	}

	/**
	 * Adds a new sheet entry to the sheets table.
	 * @param {string} sheetName - The name of the new sheet.
	 * @param {number} maxRow - The maximum number of rows for the sheet.
	 * @returns {Promise<number>} A promise that resolves to the ID of the newly added sheet.
	 */
	async AddSheet(sheetName, maxRow) {
		this.#EnsureDbInitialized();
		// --- FIX: Use db.run for INSERT and get lastInsertRowId ---
		this.db.run(`INSERT INTO _sheets (sheet_name, max_row) VALUES (?, ?);`, [
			sheetName,
			maxRow,
		]);

		const result = this.db.exec("SELECT last_insert_rowid() AS id;");

		return result[0].values[0][0];
	}

	/**
	 * Retrieves a list of all table names in the database.
	 * @returns {Promise<Array<string>>} A promise that resolves to an array of table names.
	 */
	async GetSheetNames() {
		try {
			const result = await this.RunQuery("SELECT sheet_name FROM _sheets;");
			return result ? result.values.map((row) => row[0]) : [];
		} catch (error) {
			console.error("Error retrieving sheet names:", error);
			throw new Error("Error retrieving sheet names: " + error.message);
		}
	}

	/**
	 * Sets the updated_at timestamp for a sheet.
	 * @param {number} sheetId - The ID of the sheet.
	 * @returns {Promise<void>}
	 */
	async SetUpdatedAtTimestamp(sheetId) {
		this.#EnsureDbInitialized();
		const query = `UPDATE _sheets SET updated_at = CURRENT_TIMESTAMP WHERE sheet_id = ?;`;
		await this.RunQuery(query, [sheetId]);
	}

	/**
	 * Inserts column names into the sheet_columns table.
	 * @param {number} sheetId - The ID of the sheet.
	 * @param {Array<string>} columnNames - The column names to insert.
	 * @returns {Promise<void>}
	 */
	async InsertColumnNames(sheetId, columnIds) {
		this.#EnsureDbInitialized();
		let stmt = null;
		try {
			stmt = this.db.prepare(
				`INSERT INTO _sheet_columns (sheet_id, column_name) VALUES (?, ?);`,
			);
			for (let colId of columnIds) {
				stmt.run([sheetId, colId]);
			}
			console.log("inserted columns into db");
		} catch (error) {
			throw new Error("Error inserting column names: " + error.message);
		} finally {
			if (stmt) {
				stmt.free();
			} else {
				console.error("Statement preparation failed, cannot free resources.");
			}
		}
	}

	/**
	 * Inserts column names into the sheet_columns table.
	 * @param {number} sheetId - The ID of the sheet.
	 * @returns {Promise<void>}
	 */
	async GetSheetColumns(sheetId) {
		this.#EnsureDbInitialized();
		const result = await this.RunQuery(
			`SELECT column_name FROM _sheet_columns WHERE sheet_id = ${sheetId} ORDER BY id;`,
		);
		return result ? result.values : null;
	}

	/**
	 * Inserts data in bulk into the sheet_data table using a transaction.
	 * @param {number} sheetId - The ID of the sheet.
	 * @param {Array<object>} largeDataSet - An array of cell data objects.
	 * @returns {Promise<void>}
	 */
	async InsertBulkDataForInMemory(sheetId, largeDataSet) {
		this.#EnsureDbInitialized();
		let stmt = null;
		try {
			stmt = this.db.prepare(
				"INSERT OR REPLACE INTO _sheet_data (sheet_id, col_id, row_id, cell_value, cell_style) VALUES (?, ?, ?, ?, ?);",
			);
			for (const row of largeDataSet) {
				stmt.run([
					sheetId,
					row.col_id,
					row.row_id,
					row.cell_value,
					row.cell_style,
				]);
			}
		} catch (error) {
			console.error("SQLite Engine Error during Bulk Insert:", error);
			throw new Error(`Database Insert Failed: ${error.message}`);
		} finally {
			stmt?.free();
		}
	}

	/**
	 * Retrives data in bulk from the sheet_data table.
	 * @param {number} sheetId - The ID of the sheet.
	 * @returns {Promise<void>}
	 */
	async GetSheetData(sheetId) {
		return await this.RunQuery(
			`SELECT * FROM _sheet_data WHERE sheet_id = ${sheetId} ORDER BY col_id;`,
		);
	}

	/**
	 * Executes a generic SQL query.
	 * @param {string} query - The query string.
	 * @param {Array<*>} [params=[]] - An optional array of parameters.
	 * @returns {Promise<object|null>} A promise that resolves to the result object or null.
	 */
	async RunQuery(query, params = []) {
		this.#EnsureDbInitialized();
		try {
			const results = this.db.exec(query, params);
			console.log("Query executed successfully:", query, results);
			return results.length > 0 ? results[0] : null;
		} catch (error) {
			console.error("Error executing query:", query, error);
			throw new Error("Error executing SQL query: " + error.message);
		}
	}

	/**
	 * Exports the current database as a dump.
	 * @returns {Promise<Uint8Array>} A promise that resolves to the database dump.
	 */
	async ExportDb() {
		try {
			this.#EnsureDbInitialized();
			return this.db.export();
		} catch (error) {
			throw new Error("Error Exporting Db", error);
		}
	}

	/**
	 * Closes the database connection.
	 */
	Close() {
		if (this.db) {
			this.db.close();
			this.db = null;
			this.SQL = null;
			console.log("Database closed.");
		}
	}

	/**
	 * Inserts or replaces bulk data into a specified table.
	 * @param {string} targetTableName - The name of the target table.
	 * @param {Array<string>} targetColumns - The list of target column names.
	 * @param {Array<Array<*>>} dataRows - An array of data rows to insert/replace.
	 * @returns {Promise<void>}
	 */
	async InsertReplaceBulkDataForNotInMemory(
		targetTableName,
		targetColumns,
		dataRows,
	) {
		console.log(targetColumns, targetTableName, dataRows);
		let stmt = null;
		try {
			// Build the INSERT OR REPLACE query using the raw column names
			const colNameList = targetColumns.map((col) => `"${col}"`).join(", ");
			const placeholders = targetColumns.map(() => "?").join(", ");

			stmt = this.db.prepare(
				`INSERT OR REPLACE INTO "${targetTableName}" (${colNameList}) VALUES (${placeholders});`,
			);

			// Execute bulk run
			dataRows.forEach((row) => stmt.run(row));
		} catch (error) {
			if (stmt) {
				stmt.free();
			}
			console.error("Error inserting/replacing bulk data:", error);
			throw new Error(
				`Error inserting/replacing bulk data into table "${targetTableName}": ${error.message}`,
			);
		}
	}

	/**
	 * Retrieves a list of all sheet names in the database.
	 * @returns {Promise<Array<string>>} A promise that resolves to an array of sheet names.
	 */
	async GetTableNames() {
		try {
			const result = await this.RunQuery(
				"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_sheet_columns', '_sheet_data', '_sheets');",
			);
			console.log(result);
			return result ? result.values.map((row) => row[0]) : [];
		} catch (error) {
			console.error("Error retrieving table names:", error);
			throw new Error("Error retrieving table names: " + error.message);
		}
	}

	/**
	 * Retrieves column information using PRAGMA.
	 * @param {string} tableName - The name of the table.
	 * @returns {Promise<Array<Array<string>>>} A promise that resolves to the column info.
	 */
	async GetTableInfo(tableName) {
		const result = await this.RunQuery(`PRAGMA table_info("${tableName}");`);
		console.log("getTableInfo result:", result);
		return result ? result.values : [];
	}

	/**
	 * Selects all data from a specified table.
	 * @param {string} tableName - The name of the table.
	 * @returns {Promise<object|null>} A promise that resolves to the result object or null.
	 */
	async SelectAllFromTable(tableName) {
		return await this.RunQuery(`SELECT * FROM "${tableName}";`);
	}

	/**
	 * Retrieves foreign key list information for a given table.
	 * @param {string} tableName - The name of the table.
	 * @returns {Promise<Array<Array<any>>>} A promise that resolves to the foreign key info.
	 */
	async GetForeignKeyList(tableName) {
		const result = await this.RunQuery(
			`PRAGMA foreign_key_list("${tableName}");`,
		);
		return result ? result.values : [];
	}

	/**
	 * Retrieves column count and max ID for a given table.
	 * @param {string} tableName - The name of the table.
	 * @returns {Promise<object|null>} A promise that resolves to an object with column_count and max_id.
	 */
	async GetTableMetadata(tableName) {
		const result = await this.RunQuery(
			`SELECT cc.column_count, m.max_id from (SELECT MAX(c0) as max_id from "${tableName}") m, (SELECT COUNT(*) as column_count from pragma_table_info("${tableName}")) cc;`,
		);
		if (result && result.values.length > 0) {
			return {
				column_count: result.values[0][0],
				max_id: result.values[0][1],
			};
		}
		return null;
	}

	#EnsureDbInitialized() {
		if (!this.db) {
			throw new Error("Database not initialized. Call Initialize() first.");
		}
	}
}
