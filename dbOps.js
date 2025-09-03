// DatabaseService.js

class DatabaseService {
	constructor() {
		this.db = null; // The SQLite database instance
		this.SQL = null; // Reference to the sql.js module itself
	}

	/**
	 * Initializes the SQLite database. Must be called before any other operations.
	 * @returns {Promise<void>} A promise that resolves when the database is initialized.
	 */
	async initialize() {
		if (this.db) {
			console.warn("Database already initialized.");
			return;
		}
		try {
			// initSqlJs needs to be loaded/available.
			// You might import it here if it's a module, or assume it's global.
			// For browser, it's often a global.
			if (typeof initSqlJs === "undefined") {
				// Fallback if initSqlJs isn't global, you might load it dynamically
				// Or ensure it's loaded via a script tag before this module
				console.error(
					"initSqlJs is not defined. Please ensure sql.js is loaded."
				);
				throw new Error("SQL.js library not loaded.");
			}
			this.SQL = await initSqlJs();
			this.db = new this.SQL.Database();

			// Ensure the sheets table exists
			this.runSchema(`
				CREATE TABLE IF NOT EXISTS sheets (
					sheet_id INTEGER PRIMARY KEY AUTOINCREMENT,
					sheet_name TEXT
				);

				PRAGMA foreign_keys = ON;

				CREATE TABLE IF NOT EXISTS sheet_columns (
					sheet_id INTEGER PRIMARY KEY,
					column_name TEXT
				);

				CREATE TABLE IF NOT EXISTS sheet_data (
					sheet_id INTEGER,
					col_id TEXT,
					row_id TEXT,
					cell_value TEXT,
					cell_style TEXT,
					PRIMARY KEY (sheet_id, col_id, row_id)
				);
			`);
			console.log("Database created and initialized.");
		} catch (error) {
			console.error("Error initializing database:", error);
			throw error;
		}
	}

	/**
	 * Loads a database dump file into the current database instance.
	 * This will replace the current in-memory database.
	 * @param {File} file - The database dump file (Blob or File object).
	 * @returns {Promise<void>} A promise that resolves when the dump is loaded.
	 */
	async loadDump(file) {
		if (!this.SQL) {
			throw new Error("SQL.js not loaded. Call initialize() first.");
		}
		try {
			const buffer = await file.arrayBuffer();
			if (this.db) {
				// Close existing DB if any
				this.db.close();
			}
			this.db = new this.SQL.Database(new Uint8Array(buffer));
			console.log("Database dump loaded successfully.");
		} catch (error) {
			console.error("Error loading database dump:", error);
			throw new Error("Error loading database dump. Please check the file.");
		}
	}

	/**
	 * Executes SQL schema from a file.
	 * @param {string} schemaSql - The SQL schema content as a string.
	 * @returns {void}
	 * @throws {Error} If there's an error running the schema.
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
	 * Executes a given SQL query against the database.
	 * @param {string} query - The SQL query string to execute.
	 * @returns {Array<object>|null} The query result (columns and values) or null if no result.
	 * @throws {Error} If there's an error executing the query.
	 */
	runQuery(query) {
		this.#ensureDbInitialized();
		try {
			const results = this.db.exec(query);
			console.log("Query executed successfully:", query);
			return results.length > 0 ? results[0] : null;
		} catch (error) {
			console.error("Error executing query:", query, error);
			throw new Error("Error executing SQL query: " + error.message);
		}
	}

	/**
	 * Exports the current database as a Uint8Array (database dump).
	 * @returns {Uint8Array} The database dump.
	 * @throws {Error} If the database is not initialized.
	 */
	exportDb() {
		this.#ensureDbInitialized();
		return this.db.export();
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

	// --- Specific methods for common operations ---

	/**
	 * Retrieves column information for a given table.
	 * @param {string} tableName - The name of the table.
	 * @returns {Array<Array<string>>} An array of arrays, where each inner array is column info.
	 * @throws {Error} If there's an error.
	 */
	getTableInfo(tableName) {
		const result = this.runQuery(`PRAGMA table_info("${tableName}");`);
		return result ? result.values : [];
	}

	/**
	 * Selects all data from a specified table.
	 * @param {string} tableName - The name of the table to select from.
	 * @returns {object|null} The result object from db.exec, or null if no data.
	 * @throws {Error} If there's an error.
	 */
	selectAllFromTable(tableName) {
		return this.runQuery(`SELECT * FROM "${tableName}";`);
	}

	/**
	 * Retrieves a list of all table names in the database.
	 * @returns {Array<string>} An array of table names.
	 * @throws {Error} If there's an error.
	 */
	getTableNames() {
		const result = this.runQuery(
			"SELECT name FROM sqlite_master WHERE type='table';"
		);
		return result ? result.values.map((row) => row[0]) : [];
	}

	/**
	 * Retrieves foreign key list information for a given table.
	 * @param {string} tableName - The name of the table.
	 * @returns {Array<Array<any>>} An array of foreign key information.
	 * @throws {Error} If there's an error.
	 */
	getForeignKeyList(tableName) {
		const result = this.runQuery(`PRAGMA foreign_key_list("${tableName}");`);
		return result ? result.values : [];
	}

	/**
	 * Retrieves column count and max ID for a given table.
	 * @param {string} tableName - The name of the table.
	 * @returns {object|null} An object with column_count and max_id, or null if no results.
	 * @throws {Error} If there's an error.
	 */
	getTableMetadata(tableName) {
		const result = this.runQuery(
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

	// Private helper method to ensure DB is initialized
	#ensureDbInitialized() {
		if (!this.db) {
			throw new Error("Database not initialized. Call initialize() first.");
		}
	}
}
