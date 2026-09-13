// main.js (No changes from previous step)

async function InitializeApp() {
	try {
		const spreadsheetUI = new SpreadsheetUI("root");
		spreadsheetUI.InitializeUI();

		console.log("Application initialized successfully.");
	} catch (error) {
		console.error("Failed to initialize application:", error);
	}
}

document.addEventListener("DOMContentLoaded", InitializeApp);
