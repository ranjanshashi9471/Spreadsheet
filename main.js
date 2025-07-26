// main.js (No changes from previous step)

import { databaseService } from "./dbOps.js";
import { spreadsheetUI } from "./ui.js";

async function initializeApp() {
	try {
		await databaseService.initialize();
		await spreadsheetUI.renderSheetsNames();
		console.log("Application initialized successfully.");
	} catch (error) {
		console.error("Failed to initialize application:", error);
		alert("Application failed to start due to an initialization error.");
	}
}

document.addEventListener("DOMContentLoaded", initializeApp);
