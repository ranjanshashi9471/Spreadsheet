// main.js (No changes from previous step)

async function initializeApp() {
	try {
		const databaseService = new DatabaseService();
		await databaseService.initialize();

		const backEndService = new BackendService(databaseService);

		const spreadsheetUI = new SpreadsheetUI("root", backEndService);
		spreadsheetUI.initializeUI();

		console.log("Application initialized successfully.");
	} catch (error) {
		console.error("Failed to initialize application:", error);
	}
}

document.addEventListener("DOMContentLoaded", initializeApp);
