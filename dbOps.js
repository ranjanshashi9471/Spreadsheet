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
	async initialize() {
		if (this.db) {
			console.warn("Database already initialized.");
			return;
		}
		try {
			if (typeof initSqlJs === "undefined") {
				console.error(
					"initSqlJs is not defined. Please ensure sql.js is loaded."
				);
				throw new Error("SQL.js library not loaded.");
			}
			this.SQL = await initSqlJs();
			this.db = new this.SQL.Database();

			// --- FIX: Corrected schema with proper syntax and ON DELETE CASCADE ---
			this.runSchema(`
                PRAGMA foreign_keys = ON;
				-- Table: sheets
				CREATE TABLE IF NOT EXISTS sheets (
					sheet_id INTEGER PRIMARY KEY AUTOINCREMENT,
					sheet_name TEXT UNIQUE NOT NULL,
					max_row INTEGER DEFAULT 0,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				);

				-- Table: sheet_columns
				CREATE TABLE IF NOT EXISTS sheet_columns (
					id INTEGER PRIMARY KEY AUTOINCREMENT, -- Fixed PRIMARY KEY
					sheet_id INTEGER NOT NULL,
					column_name TEXT NOT NULL,
					UNIQUE(sheet_id, column_name), -- Ensures uniqueness for each column per sheet
					FOREIGN KEY (sheet_id) REFERENCES sheets(sheet_id) ON DELETE CASCADE
				);
				-- Table: sheet_data
				CREATE TABLE IF NOT EXISTS sheet_data (
					id INTEGER PRIMARY KEY AUTOINCREMENT, -- Fixed PRIMARY KEY
					sheet_id INTEGER NOT NULL,
					col_id TEXT NOT NULL,
					row_id TEXT NOT NULL,
					cell_value TEXT,
    				cell_style TEXT,
    				UNIQUE(sheet_id, col_id, row_id), -- Composite unique constraint
    				FOREIGN KEY (sheet_id) REFERENCES sheets(sheet_id) ON DELETE CASCADE
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
	async startTransaction() {
		this.#ensureDbInitialized();
		this.db.run("BEGIN TRANSACTION;");
	}

	/**
	 * Commits the current database transaction.
	 * @returns {Promise<void>}
	 */
	async commitTransaction() {
		this.#ensureDbInitialized();
		this.db.run("COMMIT;");
	}

	/**
	 * Rolls back the current database transaction.
	 * @returns {Promise<void>}
	 */
	async rollbackTransaction() {
		this.#ensureDbInitialized();
		this.db.run("ROLLBACK;");
	}

	/**
	 * Loads a database dump file, replacing the current database.
	 * @param {File} file - The dump file.
	 * @returns {Promise<void>}
	 */
	async loadDump(file) {
		this.#ensureDbInitialized();
		try {
			const buffer = await file.arrayBuffer();
			if (this.db) this.db.close();
			this.db = new this.SQL.Database(new Uint8Array(buffer));
			console.log("Database dump loaded successfully.");
		} catch (error) {
			console.error("Error loading database dump:", error);
			throw new Error("Error loading database dump. Please check the file.");
		}
	}

	/**
	 * Executes SQL schema content.
	 * @param {string} schemaSql - The SQL schema content.
	 */
	runSchema(schemaSql) {
		this.#ensureDbInitialized();
		try {
			this.db.run(schemaSql);
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
	async findSheetByName(sheetName) {
		const result = await this.runQuery(
			`SELECT * FROM sheets WHERE sheet_name = '${sheetName}';`
		);
		return result ? result.values[0] : null;
	}

	/**
	 * Finds a sheet's metadata by ID.
	 * @param {number} sheetId - The ID of the sheet.
	 * @returns {Promise<Array<any>|null>} A promise that resolves to the sheet's metadata or null.
	 */
	async findSheetById(sheetId) {
		const result = await this.runQuery(
			`SELECT * FROM sheets WHERE sheet_id = ${sheetId};`
		);
		return result ? result.values[0] : null;
	}

	/**
	 * Adds a new sheet entry to the sheets table.
	 * @param {string} sheetName - The name of the new sheet.
	 * @param {number} maxRow - The maximum number of rows for the sheet.
	 * @returns {Promise<number>} A promise that resolves to the ID of the newly added sheet.
	 */
	async addSheet(sheetName, maxRow) {
		this.#ensureDbInitialized();
		// --- FIX: Use db.run for INSERT and get lastInsertRowId ---
		this.db.run(`INSERT INTO sheets (sheet_name, max_row) VALUES (?, ?);`, [
			sheetName,
			maxRow,
		]);
		return this.db.getRowsModified();
	}

	/**
	 * Sets the updated_at timestamp for a sheet.
	 * @param {number} sheetId - The ID of the sheet.
	 * @returns {Promise<void>}
	 */
	async setUpdatedAtTimestamp(sheetId) {
		this.#ensureDbInitialized();
		const query = `UPDATE sheets SET updated_at = CURRENT_TIMESTAMP WHERE sheet_id = ?;`;
		await this.runQuery(query, [sheetId]);
	}

	/**
	 * Inserts column names into the sheet_columns table.
	 * @param {number} sheetId - The ID of the sheet.
	 * @param {Array<string>} columnNames - The column names to insert.
	 * @returns {Promise<void>}
	 */
	async insertColumnNames(sheetId, columnNames) {
		this.#ensureDbInitialized();
		let stmt = null;
		try {
			stmt = this.db.prepare(
				`INSERT INTO sheet_columns (sheet_id, column_name) VALUES (?, ?);`
			);
			for (let colName of columnNames) {
				stmt.run([sheetId, colName]);
			}
			console.log("inserted columns into db");
		} catch (error) {
			throw new Error("Error inserting column names: " + error.message);
		} finally {
			stmt.free();
		}
	}

	/**
	 * Inserts column names into the sheet_columns table.
	 * @param {number} sheetId - The ID of the sheet.
	 * @returns {Promise<void>}
	 */
	async getSheetColumns(sheetId) {
		this.#ensureDbInitialized();
		const result = await this.runQuery(
			`SELECT column_name FROM sheet_columns WHERE sheet_id = ${sheetId} ORDER BY id;`
		);
		return result ? result.values : null;
	}

	/**
	 * Inserts data in bulk into the sheet_data table using a transaction.
	 * @param {number} sheetId - The ID of the sheet.
	 * @param {Array<object>} largeDataSet - An array of cell data objects.
	 * @returns {Promise<void>}
	 */
	async insertBulkData(sheetId, largeDataSet) {
		this.#ensureDbInitialized();
		let stmt = null;
		try {
			stmt = this.db.prepare(
				"INSERT INTO sheet_data (sheet_id, col_id, row_id, cell_value, cell_style) VALUES (?, ?, ?, ?, ?);"
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
			console.error(error);
			throw new Error("insertBulkData Error inserting bulk data");
		} finally {
			stmt.free();
		}
	}

	/**
	 * Retrives data in bulk from the sheet_data table.
	 * @param {number} sheetId - The ID of the sheet.
	 * @returns {Promise<void>}
	 */
	async getSheetData(sheetId) {
		const result = await this.runQuery(
			`SELECT * FROM sheet_data WHERE sheet_id = ${sheetId} ORDER BY col_id;`
		);
		return result ? result.values : null;
	}

	/**
	 * Executes a generic SQL query.
	 * @param {string} query - The query string.
	 * @param {Array<*>} [params=[]] - An optional array of parameters.
	 * @returns {Promise<object|null>} A promise that resolves to the result object or null.
	 */
	async runQuery(query, params = []) {
		this.#ensureDbInitialized();
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
	async exportDb() {
		try {
			this.#ensureDbInitialized();
			return this.db.export();
		} catch (error) {
			throw new Error("Error Exporting Db", error);
		}
	}

	/**
	 * Closes the database connection.
	 */
	close() {
		if (this.db) {
			this.db.close();
			this.db = null;
			this.SQL = null;
			console.log("Database closed.");
		}
	}

	/**
	 * Retrieves column information using PRAGMA.
	 * @param {string} tableName - The name of the table.
	 * @returns {Promise<Array<Array<string>>>} A promise that resolves to the column info.
	 */
	async getTableInfo(tableName) {
		const result = await this.runQuery(`PRAGMA table_info("${tableName}");`);
		return result ? result.values : [];
	}

	/**
	 * Selects all data from a specified table.
	 * @param {string} tableName - The name of the table.
	 * @returns {Promise<object|null>} A promise that resolves to the result object or null.
	 */
	async selectAllFromTable(tableName) {
		return await this.runQuery(`SELECT * FROM "${tableName}";`);
	}

	/**
	 * Retrieves a list of all table names in the database.
	 * @returns {Promise<Array<string>>} A promise that resolves to an array of table names.
	 */
	async getSheetNames() {
		const result = await this.runQuery("SELECT sheet_name FROM sheets;");
		return result ? result.values.map((row) => row[0]) : [];
	}

	/**
	 * Retrieves foreign key list information for a given table.
	 * @param {string} tableName - The name of the table.
	 * @returns {Promise<Array<Array<any>>>} A promise that resolves to the foreign key info.
	 */
	async getForeignKeyList(tableName) {
		const result = await this.runQuery(
			`PRAGMA foreign_key_list("${tableName}");`
		);
		return result ? result.values : [];
	}

	/**
	 * Retrieves column count and max ID for a given table.
	 * @param {string} tableName - The name of the table.
	 * @returns {Promise<object|null>} A promise that resolves to an object with column_count and max_id.
	 */
	async getTableMetadata(tableName) {
		const result = await this.runQuery(
			`SELECT cc.column_count, m.max_id from (SELECT MAX(c0) as max_id from "${tableName}") m, (SELECT COUNT(*) as column_count from pragma_table_info("${tableName}")) cc;`
		);
		if (result && result.values.length > 0) {
			return {
				column_count: result.values[0][0],
				max_id: result.values[0][1],
			};
		}
		return null;
	}

	#ensureDbInitialized() {
		if (!this.db) {
			throw new Error("Database not initialized. Call initialize() first.");
		}
	}
}
