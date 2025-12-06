// main.js (No changes from previous step)

async function initializeApp() {
	try {
		const spreadsheetUI = new SpreadsheetUI("root");
		spreadsheetUI.initializeUI();

		console.log("Application initialized successfully.");
	} catch (error) {
		console.error("Failed to initialize application:", error);
	}
}

document.addEventListener("DOMContentLoaded", initializeApp);
