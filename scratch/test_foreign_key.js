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

	console.log(">>> ALL FOREIGN KEY DROPDOWN & SCHEMA TESTS PASSED! <<<\n");
}

Run().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
