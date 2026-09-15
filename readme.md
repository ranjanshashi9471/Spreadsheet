# Arbor Spreadsheet

An enterprise-grade, high-performance web spreadsheet application built with vanilla JavaScript. Arbor features an in-memory AVL-tree-of-AVL-trees data store, an Ohm-powered formula compiler, a Directed Acyclic Graph (DAG) for reactive topological recalculations, a Command-pattern Undo/Redo engine, a decoupled presentation renderer, and an in-browser SQLite database backend (via `sql.js`).

---

## Architecture Overview

Arbor is engineered with clean domain boundaries, strict separation of concerns, and zero DOM dependencies across all calculation and data storage layers. Every property and method across modern classes adheres strictly to **Universal PascalCase**.

```
                                 SpreadsheetUI
                       (Application Controller & Events)
                         │              │             │
                         ▼              │             ▼
                   CommandManager       │       SelectionModel
                         │              │     (Isolated Range State)
                         ▼              ▼
                      Commands    GridRenderer ◄── [Presentation Engine]
                         │              ▲
                         ▼              │ (SpreadsheetEvents: cellsChanged, sheetReset)
                  SpreadsheetModel ─────┘
               (Domain State & Batching)
                   │             │
                   │             ▼
                   │     CalculationEngine ◄── [Pure Calculation Coordinator]
                   │     ├── FormulaParser (Ohm Grammar & AST Builder)
                   │     ├── DependencyAnalyzer (AST -> Cells & Ranges)
                   │     ├── DependencyGraph (DAG, Cycle Detection & Topological Sort)
                   │     ├── FormulaEvaluator (Tree-Walking AST Evaluator)
                   │     ├── FunctionRegistry (SUM, AVERAGE, IF, etc.)
                   │     └── ReferenceResolver (Coordinate Mapping)
                   ▼
              Spreadsheet
                   │
                   ▼
               CellStore (Base Contract)
                   │
                   ▼
              AVLCellStore (Balanced BST-of-BSTs)
                   │
                   ▼
           SpreadsheetService & DbOps (SQLite via sql.js)
```

### Architectural Invariants

Arbor enforces two foundational architectural invariants:

1. **Zero-DOM Boundary**:
   - `SpreadsheetModel.js`, `CalculationEngine.js`, `Command.js`, `DependencyGraph.js`, `FormulaEvaluator.js`, and `CellStore.js` have **zero references** to `document`, `window.document`, `querySelector`, or `GridRenderer`.
   - The entire core model, command stack, and calculation pipeline can execute headlessly in pure Node.js environments or Web Workers.
2. **Single-Notification Transaction Invariant**:
   - Every user command operation (single cell edit, multi-cell clear, undo, redo) emits **exactly one** `cellsChanged` event.
   - The mutation delta contains the complete, deduplicated set of directly modified and downstream cascaded cells, where the latest mutation snapshot wins.

---

## Core Subsystems

### 1. Calculation Engine & Reactive DAG (`Phase 7`)

- **Formula Parsing (`FormulaParser.js` & `FormulaAST.js`)**:
  - Uses an encapsulated Ohm grammar (`ohm.min.js`) to parse formula expressions starting with `'='`.
  - Produces pure, immutable AST nodes (`NumberNode`, `StringNode`, `BooleanNode`, `CellReferenceNode`, `RangeNode`, `UnaryOpNode`, `BinaryOpNode`, `FunctionCallNode`, `ErrorNode`).
- **AST Dependency Analysis (`DependencyAnalyzer.js`)**:
  - Pure data extractor that traverses AST nodes and returns `{ Cells: Set<string>, Ranges: RangeNode[] }`.
- **Directed Acyclic Graph & Cycle Detection (`DependencyGraph.js`)**:
  - Maintains precedent and dependent adjacency maps, as well as 2D range dependency bounding boxes (`RangeDependency`).
  - **Non-Destructive Cycle Validation (`WouldCreateCycle`)**: Performs DFS traversal on proposed dependencies _prior_ to committing edges. If a cycle is detected, graph state remains completely unmutated, and the cell is safely flagged with `#CIRCULAR!`.
  - **Topological Recalculation Order (`GetRecalculationOrder` / `GetFullRecalculationOrder`)**: Uses Kahn's algorithm to compute the exact execution order ($O(V + E)$) so all upstream precedents are evaluated before their dependents.
- **AST Evaluator (`FormulaEvaluator.js`)**:
  - Tree-walking evaluator with support for arithmetic (`+`, `-`, `*`, `/`, `^`), unary negation/plus, comparison operators (`=`, `<>`, `<`, `<=`, `>`, `>=`), and string concatenation.
  - **Special Syntactic Forms (Lazy Control Flow)**: In accordance with **Invariant 6**, special forms (`IF`, `IFERROR`) are handled natively with lazy control flow:
    - `IF(condition, trueBranch, falseBranch)` evaluates only the active branch, avoiding unselected errors (e.g. `IF(TRUE, 10, 1/0)` yields `10`).
    - `IFERROR(expr, fallback)` evaluates fallback only when the primary expression produces an error token.
  - Injected with `FunctionRegistry` and `ReferenceResolver` (sharing the exact same resolver instance as `DependencyGraph`).
- **Function Registry (`FunctionRegistry.js`)**:
  - **Invariant 6 (Eager Functions Only)**: Contains only eager functions; special forms `IF`/`IFERROR` are completely purged and guarded against shadowing.
  - **Boundary Arity Validation**: Automatically wraps functions with `MinArgs`/`MaxArgs` verification, uniformly returning `#VALUE!` on arity mismatches.
  - **Extensible & Introspectable**: Ships with 27 built-in functions across 5 categories (`Math`, `Statistical`, `Logical`, `Text`, `Information`) including spreadsheet floor modulo `MOD`, `POWER`, `PRODUCT`, `ROUND`, `SQRT`, `CONCATENATE`, `TRIM`, `ISNUMBER`, `ISTEXT`, `ISBLANK`, `ISERROR`. Supports runtime registration with frozen metadata.
- **Calculation Coordinator (`CalculationEngine.js`)**:
  - Integrates the parser, analyzer, DAG, and evaluator with **zero DOM references**.
  - Maintains an internal AST cache (`FormulaCache`) to eliminate redundant re-parsing during reactive cascades.
  - **Mutation Deltas**: `ProcessCellUpdate`, `RecalculateDependents`, `RecalculateAll`, `ClearCells`, and `RestoreCells` return complete, deduplicated arrays of affected cell descriptors: `Array<{ RowKey, ColKey, Value, ComputedValue, Style }>`.
  - **Single-Pass Batch Operations**: `ClearCells` and `RestoreCells` clear and restore multi-cell ranges, manage dependencies, and execute a single topological recalculation pass.
  - **Dynamic Cycle Recovery**: When a cycle is broken (e.g. `A1=B1, B1=C1, C1=A1` broken by `A1=10`), `CalculationEngine` automatically identifies unblocked formulas in `CircularFormulas`, recovers their dependencies, and restores valid calculation state.
  - **Dual Value Model**: Stores both the raw input/formula (`Value`) and the computed outcome (`ComputedValue`). Grid cells display `ComputedValue`, switching to raw `Value` on `focusin` for editing.

### 2. Command Pattern & Undo/Redo Engine (`Phase 4`)

- **`CommandManager.js`**:
  - Manages bounded `UndoStack` and `RedoStack` history.
  - Dispatches undo/redo change notifications to registered listeners.
- **`Command.js`**:
  - **Zero View Coupling**: Commands do not manipulate DOM elements or invoke renderers.
  - `SetCellCommand`: Encapsulates single-cell edits with prior value/style preservation, delegating strictly to `SpreadsheetModel.SetCell`.
  - `ClearRangeCommand`: Clears multi-cell ranges via `SpreadsheetModel.ClearCells(entries)`, triggering a single recalculation pass.
  - `CompoundCommand`: Batches arbitrary command sets into an atomic transaction within a batch context.
  - **Atomic Undo**: `ClearRangeCommand.Undo()` delegates to `SpreadsheetModel.RestoreCells(this.CellEntries)`, executing a single bulk restore and recalculation pass.
  - **Command Transaction Invariant**: `SpreadsheetModel.ExecuteCommand()`, `Undo()`, and `Redo()` wrap command executions in `BatchUpdate(...)`, guaranteeing that any operation emits **strictly one** `cellsChanged` event.

### 3. Event-Driven Grid Presentation Engine (`Phase 5`)

- **`GridRenderer.js`**:
  - Decoupled as an event subscriber listening to `SpreadsheetModel`'s `cellsChanged` and `sheetReset` events.
  - Performs $O(1)$ single-cell DOM updates (`UpdateCell`) in response to model mutation events without full grid re-renders.
  - Generates table structure, column headers with resize handles, row headers (`C0`), and virtualized data cells using `DocumentFragment`.
  - Provides clean lifecycle cleanup via `Destroy()`, setting model references and listeners to `null`, with automatic re-binding on `SpreadsheetModel` setter.

### 4. Headless Selection & Domain Models (`Phases 1 & 3`)

- **`SpreadsheetModel.js`**:
  - State owner for active spreadsheets with zero view dependencies.
  - **Event Bus**: Emits standardized `SpreadsheetEvents` (`cellsChanged`, `sheetReset`) via `AddListener`, `RemoveListener`, and `NotifyListeners`.
  - **Batching Context**: Supports nested `BeginBatch()`, `EndBatch()`, and `BatchUpdate(fn)` with a `_PendingChanges` Map ensuring latest-snapshot-wins deduplication.
  - **Explicit Recalculation**: `SetCurrentSpreadsheet` triggers `sheetReset` without implicit recalculation; `RecalculateAll()` provides explicit full-sheet evaluation.
- **`SelectionModel.js`**:
  - Pure state engine for cell, row, column, and rectangular range selections.
  - Computes rectangular bounding boxes and selection queries with zero DOM references.

### 5. In-Memory AVL Storage (`Phase 2`)

- **`CellStore.js` & `Datastructure.js`**:
  - Abstract `CellStore` contract implemented by `AVLCellStore`.
  - Backed by an AVL tree of columns, where each column node contains a secondary AVL tree of rows.
  - Fast $O(\log C + \log R)$ cell reads and writes.
  - Serializes sparse trees to bulk data arrays (`ToDataArray`) for database persistence.

### 6. Persistence & SQLite Integration (`Phase 6`)

- **`DbOps.js` & `SpreadsheetService.js`**:
  - Full relational database engine running client-side in WebAssembly via `sql.js`.
  - Automatically provisions schema (`_sheets`, `_columns`, `_sheet_data`).
  - Pre-insert null coalescing protects SQLite parameterized bulk inserts from `undefined` binding errors.
  - Supports SQL queries, SQL dumps, and JSON file import/export.

---

## Supported Formula Syntax

### Arithmetic & Precedence

```excel
=10 + 20 * 3             => 70
=(10 + 20) * 3           => 90
=2 ^ 3 ^ 2               => 512 (right-associative)
=-10 + 25                => 15
=100 / 4 - 5             => 20
```

### Cell & Range References

```excel
=A1 + B1 * 2             => Uses computed values of A1 and B1
=SUM(A1:B5)              => Aggregates compact 2D bounding box
=AVERAGE(A1:A10, 50, B1) => Multi-argument variadic aggregate
=MIN(C1:C20)             => Smallest numeric value
=MAX(C1:C20)             => Largest numeric value
=COUNT(A1:Z100)          => Count of numeric values
=COUNTA(A1:Z100)         => Count of non-empty cells
```

### Comparisons & Logical Functions

```excel
=A1 > 50                 => TRUE / FALSE
="apple" = "APPLE"       => TRUE (case-insensitive string equality)
=IF(A1 >= 70, "Pass", "Fail")
=IF(A1 = 0, 0, 100 / A1) => Safe short-circuit (no division by zero)
=IFERROR(A1 / B1, "N/A") => Returns "N/A" on error
=AND(A1 > 0, B1 < 10)
=OR(A1 = 1, A1 = 2)
=NOT(A1 > 100)
```

---

## Project Structure

```
.
├── CalculationEngine.js    # Master calculation coordinator & AST cache
├── CellStore.js            # CellStore interface & AVLCellStore implementation
├── Command.js              # Command pattern (SetCell, ClearRange, Compound)
├── CommandManager.js       # Undo/Redo transaction engine
├── Constants.js            # Input types, selection modes, and UI labels
├── Datastructure.js        # AVLTree, RowNode, ColumnNode, and Spreadsheet model
├── DbOps.js                # SQLite client-side operations via sql.js
├── DependencyAnalyzer.js   # AST visitor extracting cell and range dependencies
├── DependencyGraph.js      # Directed Acyclic Graph, cycle detection & Kahn's sort
├── FormulaAST.js           # Pure AST node data classes
├── FormulaEvaluator.js     # Tree-walking formula evaluator & function executor
├── FormulaParser.js        # Ohm grammar encapsulation & AST builder
├── FunctionRegistry.js     # Extensible built-in & custom function registry
├── GridRenderer.js         # DOM grid generation, cell rendering & resizing
├── Main.js                 # Application bootstrap & entry point
├── ReferenceResolver.js    # Coordinate mapping (A1 <-> [RowKey, ColKey])
├── SelectionModel.js       # DOM-independent selection & range calculation
├── SpreadsheetModel.js     # Active spreadsheet state owner & model boundary
├── SpreadsheetService.js   # Business logic, import/export & database sync
├── SpreadsheetUI.js        # Main UI controller & user event handling
├── index.html              # Main HTML entry point (dependency-ordered scripts)
├── ohm.min.js              # Vendored Ohm parser library
├── schema.sql              # Relational database schema
├── sql.js                  # Vendored SQLite WebAssembly engine
├── style.css               # Application stylesheet & grid theme
└── scratch/                # Automated verification test suites
    ├── test_decoupling.js  # Architectural boundary, Zero-DOM & Single-Notification tests
    ├── test_slice1.js      # Arithmetic Expression Engine tests
    ├── test_slice2.js      # Cell References & Coordinate Mapping tests
    ├── test_slice3.js      # Exponentiation & Unary Operator tests
    ├── test_slice4.js      # Range references & FunctionRegistry tests
    ├── test_slice6.js      # Comparison operators & Booleans tests
    ├── test_slice7.js      # Logical functions & Short-circuit tests
    ├── test_slice8.js      # Dependency analysis & Cycle detection tests
    ├── test_slice9.js      # Reactive cascade, Dual UI display & Full regression
    └── test_db_save.js     # SQLite in-memory save & bulk insert tests
```

---

## Getting Started

### 1. Running the Application in Browser

No compilation, bundling, or node server is required:

1. Clone or download the workspace.
2. Open `index.html` directly in any modern browser (or serve with a static server, e.g. `npx serve .` or Python's `python3 -m http.server`).
3. Click any cell to enter text or formulas (`=10 + 20 * 3`, `=SUM(A1:B3)`).
4. Use **Ctrl+Z** (Cmd+Z) to Undo and **Ctrl+Y** (Cmd+Shift+Z) to Redo.

### 2. Running Automated Test Suites

The entire calculation engine, DAG, and storage stack are verified via Node.js:

```bash
# Run Commit 3 Function Registry & Formula Architecture verification suite
node scratch/test_function_registry.js

# Run Commit 2 Dependency Graph Performance benchmark suite
node scratch/test_graph_perf.js

# Run Commit 1 Architectural Decoupling & Invariant Verification suite
node scratch/test_decoupling.js

# Run the complete Phase 7 test suite (includes regression across all slices)
node scratch/test_slice9.js

# Run individual test suites
node scratch/test_slice1.js   # Arithmetic
node scratch/test_slice2.js   # Cell references
node scratch/test_slice4.js   # Ranges & aggregates
node scratch/test_slice7.js   # Logical functions & short-circuit
node scratch/test_slice8.js   # DAG & cycle detection
node scratch/test_db_save.js  # SQLite persistence
```

---

## Keyboard Shortcuts

| Shortcut                       | Action                                          |
| :----------------------------- | :---------------------------------------------- |
| `Ctrl + Z` / `Cmd + Z`         | **Undo** last cell edit, clear, or style change |
| `Ctrl + Y` / `Cmd + Shift + Z` | **Redo** undone operation                       |
| `Enter`                        | Commit cell edit and advance to next row        |
| `Arrow Keys`                   | Navigate between cells                          |
| `Shift + Arrow Keys`           | Expand/contract rectangular range selection     |
| `Delete` / `Backspace`         | Clear values for all cells in multi-selection   |

---

## License & Credits

Developed as part of the Arbor Spreadsheet architecture re-platforming. Powered by `sql.js` (SQLite compiled to WebAssembly) and `ohm-js`.
