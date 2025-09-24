# Spreadsheet Application

A web-based spreadsheet application built with JavaScript, featuring an in-memory AVL tree data structure for efficient data manipulation, and a SQLite database backend (via sql.js) for persistent storage. The app provides a modern UI for spreadsheet operations, including sheet management, data editing, and import/export capabilities.

## Features

- **In-Memory Spreadsheet:** Uses an AVL tree of AVL trees for fast row/column operations.
- **Persistent Storage:** Data is saved in a SQLite database (runs in-browser using sql.js).
- **Sheet Management:** Create, load, and manage multiple sheets (tables).
- **Data Editing:** Edit cells, insert rows, and update data with UI interactions.
- **Import/Export:**
  - Load database dump files and SQL schema files.
  - Export database as a dump or save sheet data as JSON.
  - Load sheet data from JSON files.
- **Foreign Key Suggestions:** UI provides dropdown suggestions for foreign key columns.
- **Column/Row Selection:** Select, highlight, and apply styles to rows/columns.
- **Modern UI:** Responsive design with side panel navigation and interactive table features.

## Project Structure

```
constants.js            # Selection type constants
main.js                 # App entry point and initialization
index.html              # Main HTML file
style.css               # Application styles
spreadsheetUI.js        # UI logic and rendering
spreadsheetService.js   # Backend service (business logic, DB API)
dbOps.js                # Database service (SQLite operations)
datastructure.js        # AVL tree and Spreadsheet data structures
sql.js                  # sql.js (SQLite in browser)
overwrite_styles.js     # (Optional) Custom style overrides
schema.sql              # Example schema file
readme.md               # This file
```

## How It Works

- **Initialization:**
  - `main.js` initializes the database and backend, then starts the UI.
- **UI Layer:**
  - `spreadsheetUI.js` handles rendering, user interactions, and calls backend services.
- **Backend Service:**
  - `spreadsheetService.js` provides high-level spreadsheet operations and interacts with the database.
- **Database Layer:**
  - `dbOps.js` manages all SQLite operations using sql.js.
- **Data Structure:**
  - `datastructure.js` implements the AVL tree-based spreadsheet for in-memory operations.

## Getting Started

1. **Clone the repository** and open the project folder.
2. **Open `index.html` in a modern browser** (no server required; all logic runs client-side).
3. **Use the UI** to create sheets, edit data, import/export, and manage your spreadsheets.

## Development Notes

- The app is modular, with clear separation between UI, backend logic, and database operations.
- All data is stored in-browser using sql.js (no external server required).
- The AVL tree structure enables efficient in-memory manipulation before saving to the database.
- The UI supports keyboard navigation, drag selection, and style application for rows/columns.

## Dependencies

- [sql.js](https://github.com/sql-js/sql.js) (bundled as `sql.js`)

## Author

Shashi Ranjan Kumar
