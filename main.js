// main.js (No changes from previous step)

async function initializeApp() {
	try {
		const databaseService = new DatabaseService();
		await databaseService.initialize();

		const spreadsheetUI = await new SpreadsheetUI("root", databaseService);
		await spreadsheetUI.initializeUI();

		console.log("Application initialized successfully.");
	} catch (error) {
		console.error("Failed to initialize application:", error);
		alert("Application failed to start due to an initialization error.");
	}
}

document.addEventListener("DOMContentLoaded", initializeApp);
