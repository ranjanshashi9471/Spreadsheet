let db; // Global variable to hold the database instance
let rows = 0;
let row_on_page = 25;

// Function to initialize the database
function initializeDatabase() {
	return initSqlJs().then((SQL) => {
		db = new SQL.Database();
		console.log("Database created");
	});
}

function openSidePanel() {
	document.getElementById("table-list").style.width = "250px";
}

function closeSidePanel() {
	document.getElementById("table-list").style.width = "0";
}

function renderSidePanel() {
	const root = document.getElementById("root");
	const sidepanel = document.createElement("div");
	sidepanel.setAttribute("id", "table-list");
	sidepanel.classList.add("sidepanel");
	root.appendChild(sidepanel);
	const table = document.createElement("div");
	table.setAttribute("id", "table");
	root.appendChild(table);

	const anch = document.createElement("a");
	anch.setAttribute("href", "javascript:void(0)");
	anch.classList.add("sidepanel-close");
	anch.innerHTML = "&times;";
	anch.addEventListener("click", (event) => {
		closeSidePanel();
	});
	sidepanel.appendChild(anch);

	//constructing sidePanel using anchor tag
	const result = db.exec("SELECT name FROM sqlite_master WHERE type='table';");

	result[0].values.forEach((tablename, id) => {
		//listing table names
		const anch = document.createElement("a");
		anch.innerHTML = `${tablename[0]}`;
		anch.setAttribute("href", "#");
		anch.classList.add("anch");
		anch.addEventListener("click", (event) => {
			event.preventDefault();
			closeSidePanel();
			renderStructure(tablename[0], 0);
		});
		sidepanel.appendChild(anch);
	});
}

function renderStructure(tablename, pagesRendered) {
	const table = document.getElementById("table");
	table.innerHTML = "";

	const tablediv = document.createElement("div");
	tablediv.setAttribute("id", `${tablename}-div`);
	tablediv.innerHTML = `<h2>  ${tablename}</h2>
    <div id='${tablename}'>
      <div id="${tablename}_input">
        <div>
          <h3>${tablename} Input Table</h3>
          <table border="1">
            <thead>
              <tr class = "${tablename}_column_header"></tr>
              <tr class="${tablename}_header"></tr>
            </thead>
            <tbody id="${tablename}-data-output">
              <!-- Dynamic rows will be added here -->
            </tbody>
          </table>
        </div>

        <div class = "pagination">
          <div id = "${tablename}-pagination-prev">
            <!-- Prev will be added here -->
          </div>
          <div id = "${tablename}-pagination">
            <!-- Dynamic pages will be added here -->
          </div>
          <div id = "${tablename}-pagination-next">
            <!-- Next will be added here -->
          </div>
        </div>
        <div style="margin-top: 10px">
          <button name="${tablename}" id ="${tablename}-add" onclick = "add('${tablename}', ${pagesRendered})">Add ${tablename}</button>
          <button name="${tablename}" onclick="saveJson(event)" style="margin-left: 10px">
              Save JSON
          </button>
          <input name="${tablename}" type="file" id ="${tablename}-loadjson" onchange = "loadJson(event, ${pagesRendered})" style="margin-left: 10px" />
          <button name="${tablename}" onclick="generateOutput(event)" style="margin-left: 10px">
              Generate Output
          </button>
        </div>
      </div>

      <div id="${tablename}-output-section" class="hidden">
        <h3>${tablename} Output Table</h3>
        <table border="1">
          <thead>
            <tr class = "${tablename}_column_header"></tr>
            <tr class = "${tablename}_header"></tr>
          </thead>
          <tbody id="${tablename}-output-table">
            <!-- Dynamic output rows will be added here -->
          </tbody>
        </table>
      </div>
    </div>`;
	table.appendChild(tablediv);
	renderHeader(tablename, pagesRendered);
}

function renderHeader(tablename, renderedPages) {
	//rendering header for a table.
	const tablerow1 = document.getElementsByClassName(
		`${tablename}_column_header`
	);
	const tablerow = document.getElementsByClassName(`${tablename}_header`);
	for (var i = 0; i < tablerow.length; i++) {
		tablerow[i].innerHTML = "";
		const res = db.exec(`PRAGMA table_info(${tablename});`);
		res[0].values.forEach((data, index) => {
			var ques = `c${index}`;
			const th = document.createElement("th");
			th.innerHTML = ques;
			const th1 = document.createElement("th");
			th1.innerHTML = data[1];
			tablerow1[i].appendChild(th);
			tablerow[i].appendChild(th1);
		});
	}
	renderData(tablename, renderedPages);
}

// function runQuery(event) {
// 	// console.log(event);
// 	const query = document.getElementById(`query-input`).value;
// 	console.log(query);
// 	if (query != "") {
// 		const regexp = /(?<=from)(.*?)(?=where)/g
// 		const query_table = query
// 			.match(regexp)[0]
// 			.split(",")
// 			.map((tablename, index) => {
// 				return tablename.trim();
// 			});
// 		console.log(query_table);
// 		const table_attr = query_table.map((element, index) => {
// 			const tabname = element.split(" ")[0];
// 			const res = db.exec(`PRAGMA table_info(${tabname});`);
// 			const cols = res[0].values.map((colArr, id)=>{
// 				return colArr[1];
// 			});
// 			return cols;
// 		});
// 		console.log(table_attr);

// 	}
// }

function returnTables(query) {}

function runQuery(event) {
	const query = document.getElementById("query-input").value;
	console.log("Original Query:", query);
	let table_attr;
	let query_table;
	if (query.indexOf("SELECT") != -1) {
		const regexp =
			/(?<=from\s)(.*?)(?=;$|\swhere|\sWHERE|\sGROUP\sBY|\sgroup\sby|\sEND|\send|$)/g;
		query_table = query
			.match(regexp)[0]
			.split(",")
			.map((tablename) => tablename.trim());
		console.log("Tables found in query:", query_table);
	} else if (query.indexOf("ALTER") != -1) {
		const regexp =
			/(?<=TABLE|table\s)(.*)(?=\sDROP|\sdrop|\sSET|\sset|\sADD|\sadd|\sRENAME|\srename|\sENABLE|\senable|\sDISABLE|\sdisable|\sMODIFY|\smodify)/g;
		console.log(query.match(regexp));
	} else if (query.indexOf("UPDATE") != -1) {
		const regexp = /(?<=UPDATE|update\s)(.*)(?=\sSET|\sset)/g;
		console.log(query.match(regexp));
	} else if (query.indexOf("DELETE") != -1) {
		const regexp = /(?<=FROM|from\s)(.*?)(?=\swhere|\sWHERE|;$|$)/g;
		console.log(query.match(regexp));
	}
	let modifiedQuery = query;
	table_attr = query_table.map((tablename) => {
		const tableName = tablename.split(" ");
		const res = db.exec(`PRAGMA table_info(${tableName[0]});`);
		if (tableName[1]) {
			//alias exist
			const regexp = new RegExp(`/(${tableName[1]}.c\d)/g`);
			console.log(modifiedQuery.match(regexp));
			// modifiedQuery = modifiedQuery.replace(regexp, (match) => {
			// 	console.log("Match is ", match);
			// const placeholder = match;
			// const columnIndex = parseInt(placeholder.slice(1));
			// for (let { tableName, cols } of table_attr) {
			// 	if (columnIndex < cols.length) {
			// 		return cols[columnIndex];
			// 	}
			// }
			// return placeholder;
			// });
		}
		const cols = res[0].values.map((colArr) => colArr[1]);
		return { tableName, cols };
	});
	console.log("Columns for each table:", table_attr);

	const placeholderRegex = /\b(c\d+)\b/g;

	console.log("Modified Query:", modifiedQuery);
	if (query != "") {
		// You can now run the modifiedQuery or return it for further processing
	}
}

function pagination(tablename) {
	const res = db.exec(`SELECT COUNT(id) from ${tablename};`);
	if (res[0]) {
		rows = res[0].values[0][0];
	}
	const pages = Math.ceil(rows / row_on_page);
	const pagination = document.getElementById(`${tablename}-pagination`);
	pagination.innerHTML = "";
	// const prev = document.getElementById(`${tablename}-pagination-prev`);
	// prev.innerHTML = "Prev";
	// pagination.appendChild(prev);
	for (let i = 0; i < pages; i++) {
		const anch = document.createElement("a");
		anch.innerHTML = `${i + 1}`;
		anch.addEventListener("click", (event) => {
			renderStructure(tablename, row_on_page * i);
		});
		pagination.appendChild(anch);
	}
	// const next = document.getElementById(`${tablename}-pagination-next`);
	// next.innerHTML="Next";
	// next.addEventListener("click",(event)=>{

	// })
	// pagination.appendChild(next);
}

function renderData(tablename, rowsCount) {
	pagination(tablename);
	const output = document.getElementById(`${tablename}-data-output`);
	output.innerHTML = "";
	const res = db.exec(`SELECT * from ${tablename};`);
	if (res[0]) {
		const rowlen = res[0].values.length;
		res[0].values.forEach((data, rowindex) => {
			if (rowindex + 1 > rowsCount && rowindex + 1 <= rowsCount + row_on_page) {
				const row = document.createElement("tr");
				row.innerHTML = "";
				data.forEach((coldata, colId) => {
					if (colId == 0) {
						const tableColumn = document.createElement("td");
						tableColumn.innerHTML = `r${coldata}`;
						row.appendChild(tableColumn);
					}
					if (colId > 0) {
						const tableColumn = document.createElement("td");
						tableColumn.innerHTML = `
              				<div class="container">
                				<input type="text" name="${res[0].columns[colId]}" value="${coldata}" onkeydown = "insertNewRow('${tablename}', event, ${colId}, ${rowsCount})" oninput="handleInputChange(${data[0]}, event, '${tablename}', ${rowsCount})" }/>
                				<ul type = "none" id="${tablename}-${res[0].columns[colId]}-dropdown" class="dropdown">
                  					<!-- List items will be dynamically inserted here -->
                				</ul>
              				</div>`;
						row.appendChild(tableColumn);
					}
				});
				const tableColumn = document.createElement("td");
				tableColumn.innerHTML = `<button onclick="remove(${data[0]}, '${tablename}', ${rowsCount})">Remove</button>`;
				row.appendChild(tableColumn);
				output.appendChild(row);
			}
		});
	}
}

function insertNewRow(tableName, event, colNo, pagesRendered) {
	const totColNo =
		event.target.parentNode.parentNode.parentNode.childElementCount;
	if (colNo == totColNo - 1 && event.key == "Enter") {
		add(tableName, pagesRendered);
	}
}

function add(tablename, pagesRendered) {
	// console.log("add called");
	// console.log(tablename);
	const res = db.exec(`PRAGMA table_info (${tablename});`);
	const result = db.exec(`SELECT MAX(id) from ${tablename};`);
	// console.log(result);
	var length = 1;
	if (result[0].values[0][0]) {
		length = result[0].values[0][0] - "0";
		length++;
		console.log(length);
	}
	var query = `INSERT INTO ${tablename} values(${length}`;
	res[0].values.forEach((data, index) => {
		if (index > 0) {
			query = query + `, ""`;
		}
	});
	query = query + `);`;
	(async () => {
		await db.run(query);
	})();
	renderStructure(tablename, Math.floor(rows / row_on_page) * row_on_page);
}

function handleInputChange(index, event, tableName, renderedPages) {
	const { name, value } = event.target;
	const result = db.exec(`PRAGMA foreign_key_list(${tableName});`);
	if (result[0]) {
		let tab = "";
		var relColumns = [];
		result[0].values.forEach((col, colId) => {
			if (col[3] == name) {
				//col[3] represents colname of refereing table
				tab = col[2];
			}
		});
		if (tab != "") {
			result[0].values.forEach((col, colId) => {
				if (col[2] == tab && col[3] != name) {
					relColumns.push(col[3]);
				}
			});
			var len = relColumns.length;
			var query1 = "";
			var result1;
			if (len > 0) {
				query1 = `select `;
				relColumns.forEach((data, id) => {
					if (id != len - 1) {
						query1 += `${data},`;
					} else {
						query1 += `${data} `;
					}
				});
				query1 += `from ${tableName} where id = ${index}`;
				result1 = db.exec(query1);
			}
			query1 = `SELECT distinct(${name}) from ${tab} where`;
			if (result1) {
				len = result1[0].columns.length;
				result1[0].values[0].forEach((data, id) => {
					if (data != "") {
						query1 += ` ${result1[0].columns[id]} = "${data}" AND`;
					}
				});
			}
			query1 += ` ${name} LIKE "%${value}%";`;
			// console.log(query1);
			result1 = db.exec(query1);
			// console.log(result1);
			const dropdown = document.getElementById(`${tableName}-${name}-dropdown`);
			dropdown.style.display = "block";
			dropdown.innerHTML = "";
			if (result1[0]) {
				result1[0].values.forEach((data, id) => {
					const li = document.createElement("li");
					li.innerHTML = data;
					li.id = data;
					li.addEventListener("click", (e) => {
						dropdown.style.display = "none";
						(async () => {
							await db.run(
								`UPDATE ${tableName} SET ${name} = "${e.target.id}" where id = ${index};`
							);
							renderStructure(tableName, renderedPages);
						})();
					});
					dropdown.appendChild(li);
				});
			}
		} else {
			db.exec(
				`UPDATE ${tableName} set ${name} = "${value}" where id = ${index};`
			);
		}
	} else {
		db.exec(
			`UPDATE ${tableName} set ${name} = "${value}" where id = ${index};`
		);
	}
}

function generateOutput(event) {
	const tableName = event.target.name;
	const outputSection = document.getElementById(`${tableName}-output-section`);
	const outputTable = document.getElementById(`${tableName}-output-table`);
	const res = db.exec(`SELECT * FROM ${tableName};`);
	outputTable.innerHTML = "";
	if (res[0]) {
		res[0].values.forEach((data, index) => {
			console.log(data);
			const row = document.createElement("tr");
			data.forEach((colData, colId) => {
				if (colId) {
					const col = document.createElement("td");
					col.innerHTML = `<td><input type="text" value="${colData}" readonly /></td>`;
					row.appendChild(col);
				}
			});
			outputTable.appendChild(row);
		});
	}
	outputSection.classList.remove("hidden");
}

function remove(index, tableName, renderedRows) {
	const res = db.exec(`DELETE FROM ${tableName} where id = ${index}`);
	const temp = rows - 1;
	if (temp % row_on_page == 0) {
		renderStructure(tableName, temp - row_on_page);
	} else {
		renderStructure(tableName, renderedRows);
	}
}

function saveJson(event) {
	const res = db.exec(`SELECT * FROM ${event.target.name};`);
	const jsonData = JSON.stringify(res);
	const blob = new Blob([jsonData], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${event.target.name}_data.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function loadJson(event, pagesRendered) {
	const file = event.target.files[0];
	const result = db.exec(`SELECT MAX(id) from ${event.target.name};`);
	let len = 1;
	if (result[0]) {
		len = result[0].values[0][0] - "0";
		len += 1;
	}
	const reader = new FileReader();
	reader.onload = (e) => {
		const res = JSON.parse(e.target.result);
		res[0].values.forEach((data) => {
			var query = `INSERT INTO ${event.target.name} VALUES (${len}`;
			data.forEach((value, id) => {
				if (id > 0) {
					query += `, `;
					query += `"${value}"`;
				}
			});
			len++;
			query += `);`;
			db.exec(query);
		});
		renderStructure(event.target.name, 0);
	};
	reader.readAsText(file);
}

function render_rows(event) {
	if (event.key == "Enter") {
		const res = document.getElementById("rows");
		const rowNum = parseInt(res.value);

		const tbody = document.getElementById("data-table");
		tbody.innerHTML = "";
		for (let i = 0; i < rowNum; i++) {
			const create_row = document.createElement("tr");
			tbody.appendChild(create_row);
		}
	}
}

function render_row_col() {
	const root = document.getElementById("root");
	const userInp = document.createElement("div");
	userInp.innerHTML = `
  		<div id="user-input">
    		<label for="rows">Enter number of rows</label>
    		<input type="number" id="rows" />
    
    		<label for="columns">Enter number of columns</label>
    		<input type="number" id="columns"/>
			<button onclick= "renderSpreadsheet()">Render Spreadsheet</button>
  		<div>`;
	const table = document.createElement("table");
	const tbody = document.createElement("tbody");
	tbody.setAttribute("id", "data-table");
	table.appendChild(tbody);
	root.appendChild(userInp);
	root.appendChild(tbody);
}

function initialUI() {
	const root = document.getElementById("root");
	root.innerHTML = "";
	const fileInp = document.createElement("div");
	fileInp.setAttribute("id", "query-parent");
	fileInp.innerHTML = `
		<div id = "schema-inp">
  			<button class = "sidepanel-open" onclick = "openSidePanel()">&#9776;</button>
  			<input name="schema-input" type="file" onchange="loadSchema(event)" style="margin-left: 10px" />
		</div>`;
	root.appendChild(fileInp);
	render_row_col();
}

function loadSchema(event) {
	const file = event.target.files[0];
	const reader = new FileReader();
	reader.readAsText(file);
	reader.onload = (e) => {
		db.run(e.target.result);
		renderSidePanel();
		openSidePanel();
	};
	const queryBox = document.createElement("div");
	queryBox.setAttribute("id", "query-input-div");
	const root = document.getElementById("query-parent");
	queryBox.innerHTML = `
	<div>
	 	<h3>Enter your query</h3>
        <textarea rows = "5" cols="40" id = "query-input" spellcheck="false"></textarea>
		<input type="button"  onclick="runQuery(event)" value="Submit">
    </div>`;
	queryBox.setAttribute("id", "query-box");
	root.appendChild(queryBox);
}

//Initialize the database and render data
initializeDatabase().then(() => {
	initialUI();
});
