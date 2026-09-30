import Database from "better-sqlite3";
const db = new Database("procurement.db");
const rows = db.prepare("SELECT id, status, budget_amount, created_at, updated_at FROM projects").all();
console.log(JSON.stringify(rows, null, 2));
