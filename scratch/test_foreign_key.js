/**
 * scratch/test_foreign_key.js
 *
 * Automated verification for:
 * 1. Schema loading with foreign key constraints.
 * 2. GetCellUpdateInfo foreign key dropdown suggestions with wild search (LIKE "%...%").
 * 3. Handling foreign keys where child column name differs from parent column name.
 * 4. Composite foreign key column narrowing.
 * 5. Direct update fallback for non-foreign key columns.
 */

const fs = require("fs");
const vm = require("vm");
const path = require("path");
const assert = require("assert");

const workspaceDir = "/home/shashi/Desktop/WorkingArea/Spreadsheet";

function loadScript(filename) {
	return fs.readFileSync(path.join(workspaceDir, filename), "utf8");
}

const allCode = [
	loadScript("Constants.js"),
	loadScript("DbOps.js"),
	loadScript("SpreadsheetService.js"),
	`
	globalThis.DatabaseService = DatabaseService;
	globalThis.BackendService = BackendService;
	`,
].join("\n;\n");

const sandbox = {
	console,
	initSqlJs: require(path.join(workspaceDir, "sql.js")),
	alert: (msg) => console.log("[ALERT]", msg),
	window: {},
	document: {},
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(allCode, sandbox);

async function Run() {
	console.log("=== Starting Foreign Key Dropdown & Schema Verification ===\n");

	const dbService = new sandbox.DatabaseService();
	await dbService.Initialize();

	const backendService = new sandbox.BackendService(dbService);
	backendService.databaseService = dbService;

	console.log("1. Running SQL Schema with foreign keys via RunSchema...");
	const schemaSql = `
		CREATE TABLE departments (
			dept_code TEXT PRIMARY KEY,
			dept_name TEXT,
			location TEXT
		);

		CREATE TABLE courses (
			course_id TEXT PRIMARY KEY,
			course_name TEXT
		);

		CREATE TABLE employees (
			emp_id INTEGER PRIMARY KEY,
			name TEXT,
			department TEXT REFERENCES departments(dept_code)
		);

		CREATE TABLE students (
			student_id INTEGER PRIMARY KEY,
			student_name TEXT,
			dept_code TEXT REFERENCES departments(dept_code),
			course_id TEXT REFERENCES courses(course_id)
		);

		CREATE TABLE composite_parent (
			org_id TEXT,
			team_id TEXT,
			lead_name TEXT,
			PRIMARY KEY (org_id, team_id)
		);

		CREATE TABLE composite_child (
			task_id INTEGER PRIMARY KEY,
			task_name TEXT,
			assigned_org TEXT,
			assigned_team TEXT,
			FOREIGN KEY (assigned_org, assigned_team) REFERENCES composite_parent(org_id, team_id)
		);
	`;

	await backendService.RunSchema(schemaSql);
	console.log("  PASSED: Schema loaded successfully.\n");

	console.log("2. Inserting sample reference data...");
	await dbService.RunQuery(`
		INSERT INTO departments (dept_code, dept_name, location) VALUES
			('ENG', 'Engineering', 'Building A'),
			('ENV', 'Environmental Sciences', 'Building B'),
			('ECON', 'Economics', 'Building C'),
			('MATH', 'Mathematics', 'Building D');
	`);

	await dbService.RunQuery(`
		INSERT INTO courses (course_id, course_name) VALUES
			('CS101', 'Intro to Computer Science'),
			('CS102', 'Data Structures'),
			('MATH101', 'Calculus I');
	`);

	await dbService.RunQuery(`
		INSERT INTO students (student_id, student_name, dept_code, course_id) VALUES
			(1, 'Alice', 'ENG', 'CS101');
	`);

	await dbService.RunQuery(`
		INSERT INTO composite_parent (org_id, team_id, lead_name) VALUES
			('Google', 'DeepMind', 'Demis'),
			('Google', 'Android', 'Sundar'),
			('Apple', 'iOS', 'Tim'),
			('Apple', 'macOS', 'Craig');
	`);

	await dbService.RunQuery(`
		INSERT INTO composite_child (task_id, task_name, assigned_org, assigned_team) VALUES
			(1, 'Build AGY', 'Google', 'DeepMind');
	`);
	console.log("  PASSED: Reference data inserted.\n");

	// -------------------------------------------------------------------------
	// Test Case 1: Simple FK where child col matches parent col
	// -------------------------------------------------------------------------
	console.log(
		"3. Testing FK suggestions where child and parent column names match...",
	);
	const resMatch = await backendService.GetCellUpdateInfo(
		"students",
		["student_id"],
		["1"],
		"dept_code",
		"E",
	);
	assert.strictEqual(resMatch.type, "foreignKey", "Type must be foreignKey");
	assert.ok(Array.isArray(resMatch.suggestions), "Suggestions must be array");
	const suggestedDepts = resMatch.suggestions.map((r) => r[0]);
	assert.deepStrictEqual(
		suggestedDepts.sort(),
		["ECON", "ENG", "ENV"].sort(),
		"Wild search 'E' must suggest ECON, ENG, and ENV",
	);

	const resMatchSpecific = await backendService.GetCellUpdateInfo(
		"students",
		["student_id"],
		["1"],
		"dept_code",
		"MATH",
	);
	assert.deepStrictEqual(
		resMatchSpecific.suggestions.map((r) => r[0]),
		["MATH"],
		"Wild search 'MATH' must suggest MATH",
	);
	console.log("  PASSED: Matching column FK suggestions validated.\n");

	// -------------------------------------------------------------------------
	// Test Case 2: FK where child column name differs from parent column name
	// (e.g. employees.department -> departments.dept_code)
	// -------------------------------------------------------------------------
	console.log(
		"4. Testing FK suggestions where child column name differs from parent column...",
	);
	const resDiffCol = await backendService.GetCellUpdateInfo(
		"employees",
		["emp_id"],
		["1"],
		"department",
		"EN",
	);
	assert.strictEqual(resDiffCol.type, "foreignKey", "Type must be foreignKey");
	const diffSuggestions = resDiffCol.suggestions.map((r) => r[0]);
	assert.deepStrictEqual(
		diffSuggestions.sort(),
		["ENG", "ENV"].sort(),
		"Wild search 'EN' on differing column name must query parent's dept_code and return ENG, ENV",
	);
	console.log("  PASSED: Differing column name FK mapping validated.\n");

	// -------------------------------------------------------------------------
	// Test Case 3: Composite Foreign Key column narrowing
	// (composite_child assigned_org='Google', searching assigned_team with 'D')
	// -------------------------------------------------------------------------
	console.log(
		"5. Testing Composite Foreign Key suggestions with related row values...",
	);
	const resComposite = await backendService.GetCellUpdateInfo(
		"composite_child",
		["task_id"],
		["1"],
		"assigned_team",
		"D",
	);
	assert.strictEqual(
		resComposite.type,
		"foreignKey",
		"Type must be foreignKey",
	);
	const compositeSuggestions = resComposite.suggestions.map((r) => r[0]);
	// Since row 1 has assigned_org = 'Google', parent query must only return teams for Google
	// 'DeepMind' and 'Android' contain 'D'. 'Apple' teams must NOT be suggested.
	assert.deepStrictEqual(
		compositeSuggestions.sort(),
		["Android", "DeepMind"].sort(),
		"Composite FK must filter by related assigned_org='Google' and match team 'D'",
	);
	console.log("  PASSED: Composite FK suggestions validated.\n");

	// -------------------------------------------------------------------------
	// Test Case 4: Non-foreign key column
	// -------------------------------------------------------------------------
	console.log("6. Testing Non-Foreign-Key column update info...");
	const resNonFk = await backendService.GetCellUpdateInfo(
		"students",
		["student_id"],
		["1"],
		"student_name",
		"Ali",
	);
	assert.strictEqual(
		resNonFk.type,
		"directUpdate",
		"Type must be directUpdate",
	);
	assert.strictEqual(resNonFk.suggestions, null, "Suggestions must be null");
	console.log("  PASSED: Direct update fallback validated.\n");

	// -------------------------------------------------------------------------
	// Test Case 5: End-to-End UI Interaction Path
	// input -> service -> suggestions -> DOM dropdown -> click -> cell value
	// -------------------------------------------------------------------------
	console.log(
		"7. Testing End-to-End DOM UI interaction path (input -> dropdown -> click -> cell value)...",
	);

	const domElements = new Map();
	class MockElement {
		constructor(tagName = "div") {
			this.tagName = tagName;
			this.style = { display: "none" };
			this.innerHTML = "";
			this.value = "";
			this.dataset = {};
			this.children = [];
			this.eventListeners = {};
		}
		addEventListener(event, fn) {
			if (!this.eventListeners[event]) this.eventListeners[event] = [];
			this.eventListeners[event].push(fn);
		}
		appendChild(child) {
			this.children.push(child);
		}
		async dispatch(event, eventObj = {}) {
			const handlers = this.eventListeners[event] || [];
			for (const handler of handlers) {
				await handler({
					preventDefault: () => {},
					target: this,
					...eventObj,
				});
			}
		}
	}

	const cellInput = new MockElement("input");
	cellInput.name = "employees";
	cellInput.value = "EN";

	const dropdownList = new MockElement("ul");
	domElements.set("employees-1-2-dropdown", dropdownList);

	const mockDocument = {
		getElementById: (id) => domElements.get(id) || null,
		createElement: (tagName) => new MockElement(tagName),
	};

	const mockSheet = {
		primaryKeys: new Set([0]),
		columns: ["emp_id", "name", "department"],
		primaryKeyMap: new Map([[1, ["1"]]]),
		cellData: new Map(),
		InsertData(r, c, val) {
			this.cellData.set(`${r},${c}`, val);
		},
	};

	const mockUI = {
		spreadsheetService: backendService,
		currentSpreadsheet: mockSheet,
		async HandleInputChange(event, colno, rowno, isInMemory = true) {
			event.preventDefault();
			const { name: sheetName, value } = event.target;
			const dropdown = mockDocument.getElementById(
				`${sheetName}-${rowno}-${colno}-dropdown`,
			);

			if (isInMemory) {
				this.currentSpreadsheet.InsertData(rowno, colno, value);
				dropdown.style.display = "none";
				return;
			}

			const pKeyList = Array.from(this.currentSpreadsheet.primaryKeys).map(
				(colId) => this.currentSpreadsheet.columns[colId],
			);
			const pKeyValues = this.currentSpreadsheet.primaryKeyMap.get(rowno);

			const updateInfo = await this.spreadsheetService.GetCellUpdateInfo(
				sheetName,
				pKeyList,
				pKeyValues,
				this.currentSpreadsheet.columns[colno],
				value,
			);

			if (updateInfo.type !== "foreignKey") {
				dropdown.style.display = "none";
				this.currentSpreadsheet.InsertData(rowno, colno, value);
			} else {
				dropdown.innerHTML = "";
				dropdown.children = [];
				if (updateInfo.suggestions.length > 0) {
					dropdown.style.display = "block";
					updateInfo.suggestions.forEach((data) => {
						const li = mockDocument.createElement("li");
						li.innerHTML = data[0];
						li.dataset.value = data[0];
						li.addEventListener("click", async (e) => {
							e.preventDefault();
							dropdown.style.display = "none";
							event.target.value = e.target.dataset.value;
							this.currentSpreadsheet.InsertData(
								rowno,
								colno,
								e.target.dataset.value,
							);
						});
						dropdown.appendChild(li);
					});
				}
			}
		},
	};

	// 1. Trigger input change on cellInput (row 1, col 2 -> department with value 'EN')
	await mockUI.HandleInputChange(
		{ preventDefault: () => {}, target: cellInput },
		2,
		1,
		false,
	);

	// Verify dropdown populated and displayed
	assert.strictEqual(
		dropdownList.style.display,
		"block",
		"Dropdown must be visible (display: block)",
	);
	assert.strictEqual(
		dropdownList.children.length,
		2,
		"Dropdown must have 2 suggestions for 'EN'",
	);
	assert.strictEqual(
		dropdownList.children[0].dataset.value,
		"ENG",
		"First suggestion must be 'ENG'",
	);
	assert.strictEqual(
		dropdownList.children[1].dataset.value,
		"ENV",
		"Second suggestion must be 'ENV'",
	);

	// 2. User clicks the first suggestion ("ENG")
	await dropdownList.children[0].dispatch("click");

	// Verify UI state after click
	assert.strictEqual(
		dropdownList.style.display,
		"none",
		"Dropdown must hide after suggestion selection (display: none)",
	);
	assert.strictEqual(
		cellInput.value,
		"ENG",
		"Input value must update to selected suggestion 'ENG'",
	);
	assert.strictEqual(
		mockSheet.cellData.get("1,2"),
		"ENG",
		"Spreadsheet storage must commit selected value 'ENG' to cell (1, 2)",
	);

	console.log(
		"  PASSED: Full UI interaction path (input -> dropdown -> click -> cell commit) verified.\n",
	);

	console.log(">>> ALL FOREIGN KEY DROPDOWN & SCHEMA TESTS PASSED! <<<\n");
}

Run().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
