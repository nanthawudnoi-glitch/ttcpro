import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from 'url';
import fs from "fs";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("procurement.db");
const upload = multer({ dest: "uploads/" });

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code TEXT,
    title TEXT NOT NULL,
    department TEXT,
    budget_amount REAL,
    budget_source TEXT,
    current_process TEXT DEFAULT 'A',
    current_step INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    creator_name TEXT,
    creator_position TEXT,
    creator_id TEXT,
    project_nature TEXT,
    material_usage_date TEXT,
    allocated_budget REAL,
    procured_amount REAL,
    dept_head_name TEXT,
    dept_head_position TEXT,
    deputy_name TEXT,
    deputy_position TEXT,
    necessity_reason TEXT,
    in_plan TEXT,
    request_amount REAL,
    remaining_budget REAL,
    expense_category TEXT,
    delivery_dates TEXT,
    committee_chairman TEXT,
    committee_member1 TEXT,
    committee_member2 TEXT,
    is_loan INTEGER DEFAULT 0,
    borrower_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    process TEXT,
    step INTEGER,
    action TEXT,
    actor TEXT,
    notes TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS budget_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS expense_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS project_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    description TEXT NOT NULL,
    unit TEXT,
    quantity REAL,
    unit_price REAL,
    total_price REAL,
    shop_name TEXT,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    tax_id TEXT,
    bank_account TEXT,
    bank_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS approver_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_key TEXT UNIQUE,
    position_name TEXT NOT NULL,
    person_name TEXT,
    person_position TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fiscal_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_current INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    start_date TEXT,
    end_date TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS budget_source_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_source_id INTEGER NOT NULL,
    installment_no INTEGER DEFAULT 1,
    title TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    allocation_date TEXT,
    doc_ref TEXT,
    notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(budget_source_id) REFERENCES budget_sources(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS expense_category_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    installment_no INTEGER DEFAULT 1,
    title TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    allocation_date TEXT,
    doc_ref TEXT,
    notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES expense_categories(id) ON DELETE CASCADE
  );
`);

// Migration: Add missing columns if they don't exist
const tableInfo = db.prepare("PRAGMA table_info(projects)").all() as any[];
const columnNames = tableInfo.map(info => info.name);

if (!columnNames.includes('updated_at')) {
  db.exec("ALTER TABLE projects ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  // For existing rows, set updated_at to created_at
  db.exec("UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL");
}

if (!columnNames.includes('budget_source')) {
  db.exec("ALTER TABLE projects ADD COLUMN budget_source TEXT");
}

// Seed initial budget sources if empty
const budgetSourceCount = db.prepare("SELECT COUNT(*) as count FROM budget_sources").get() as any;
if (budgetSourceCount.count === 0) {
  const insertSource = db.prepare("INSERT INTO budget_sources (name) VALUES (?)");
  insertSource.run('งบประมาณแผ่นดิน');
  insertSource.run('เงินรายได้สถานศึกษา');
  insertSource.run('งบอุดหนุน');
}

// Migration: budget_sources columns for full budget management
try { db.exec("ALTER TABLE budget_sources ADD COLUMN code TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE budget_sources ADD COLUMN fiscal_year TEXT DEFAULT '2568'"); } catch (e) {}
try { db.exec("ALTER TABLE budget_sources ADD COLUMN total_budget REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE budget_sources ADD COLUMN category TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE budget_sources ADD COLUMN description TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE budget_sources ADD COLUMN updated_at DATETIME"); } catch (e) {}

// Populate initial values if missing
try {
  db.exec(`
    UPDATE budget_sources SET code = '68-GOV-01', fiscal_year = '2568', total_budget = 5000000, category = 'งบประมาณแผ่นดิน', description = 'งบประมาณแผ่นดินประจำปีงบประมาณ พ.ศ. 2568'
    WHERE name = 'งบประมาณแผ่นดิน' AND (total_budget = 0 OR total_budget IS NULL);

    UPDATE budget_sources SET code = '68-REV-01', fiscal_year = '2568', total_budget = 3500000, category = 'เงินรายได้สถานศึกษา', description = 'เงินรายได้สถานศึกษา ประจำปีงบประมาณ พ.ศ. 2568'
    WHERE name = 'เงินรายได้สถานศึกษา' AND (total_budget = 0 OR total_budget IS NULL);

    UPDATE budget_sources SET code = '68-SUB-01', fiscal_year = '2568', total_budget = 1500000, category = 'งบอุดหนุน', description = 'เงินอุดหนุนค่าใช้จ่ายในการจัดการศึกษา'
    WHERE name = 'งบอุดหนุน' AND (total_budget = 0 OR total_budget IS NULL);

    UPDATE budget_sources SET fiscal_year = '2568' WHERE fiscal_year IS NULL;
  `);
} catch (e) {}

// Seed initial expense categories if empty
const expenseCategoryCount = db.prepare("SELECT COUNT(*) as count FROM expense_categories").get() as any;
if (expenseCategoryCount.count === 0) {
  const insertCat = db.prepare("INSERT INTO expense_categories (name) VALUES (?)");
  insertCat.run('งบ.ปวช.');
  insertCat.run('งบ.ปวส.');
  insertCat.run('งบ.ระยะสั้น');
  insertCat.run('ค่าจัดการเรียนการสอน');
  insertCat.run('บกศ.');
  insertCat.run('งบประมาณอื่น');
}

// Migration: expense_categories columns for full expense category budget management
try { db.exec("ALTER TABLE expense_categories ADD COLUMN code TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE expense_categories ADD COLUMN fiscal_year TEXT DEFAULT '2568'"); } catch (e) {}
try { db.exec("ALTER TABLE expense_categories ADD COLUMN allocated_budget REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE expense_categories ADD COLUMN description TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE expense_categories ADD COLUMN updated_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE expense_categories ADD COLUMN updated_by TEXT"); } catch (e) {}

// Populate initial values for expense categories if allocated_budget is 0 or null
try {
  db.exec(`
    UPDATE expense_categories SET code = '68-EXP-01', fiscal_year = '2568', allocated_budget = 1500000, description = 'งบประมาณเพื่อการจัดการศึกษาตามหลักสูตร ปวช.', updated_by = 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'
    WHERE name = 'งบ.ปวช.' AND (allocated_budget = 0 OR allocated_budget IS NULL);

    UPDATE expense_categories SET code = '68-EXP-02', fiscal_year = '2568', allocated_budget = 1200000, description = 'งบประมาณเพื่อการจัดการศึกษาตามหลักสูตร ปวส.', updated_by = 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'
    WHERE name = 'งบ.ปวส.' AND (allocated_budget = 0 OR allocated_budget IS NULL);

    UPDATE expense_categories SET code = '68-EXP-03', fiscal_year = '2568', allocated_budget = 400000, description = 'งบประมาณหลักสูตรวิชาชีพระยะสั้นและฝึกอบรม', updated_by = 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'
    WHERE name = 'งบ.ระยะสั้น' AND (allocated_budget = 0 OR allocated_budget IS NULL);

    UPDATE expense_categories SET code = '68-EXP-04', fiscal_year = '2568', allocated_budget = 2500000, description = 'งบประมาณสำหรับค่าวัสดุและอุปกรณ์จัดการเรียนการสอนทุกสาขาวิชา', updated_by = 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'
    WHERE name = 'ค่าจัดการเรียนการสอน' AND (allocated_budget = 0 OR allocated_budget IS NULL);

    UPDATE expense_categories SET code = '68-EXP-05', fiscal_year = '2568', allocated_budget = 600000, description = 'งบประมาณโครงการพัฒนาผู้เรียนและบัณฑิตคืนถิ่น (บกศ.)', updated_by = 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'
    WHERE name = 'บกศ.' AND (allocated_budget = 0 OR allocated_budget IS NULL);

    UPDATE expense_categories SET code = '68-EXP-06', fiscal_year = '2568', allocated_budget = 800000, description = 'งบประมาณสนับสนุนโครงการอื่นๆ และค่าใช้จ่ายทั่วไป', updated_by = 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'
    WHERE name = 'งบประมาณอื่น' AND (allocated_budget = 0 OR allocated_budget IS NULL);

    UPDATE expense_categories SET fiscal_year = '2568' WHERE fiscal_year IS NULL;
  `);
} catch (e) {}

// Seed initial installment records for budget sources & expense categories
try {
  const unseededSources = db.prepare(`
    SELECT id, name, total_budget FROM budget_sources 
    WHERE total_budget > 0 AND id NOT IN (SELECT DISTINCT budget_source_id FROM budget_source_allocations)
  `).all() as any[];
  for (const src of unseededSources) {
    db.prepare(`
      INSERT INTO budget_source_allocations (budget_source_id, installment_no, title, amount, allocation_date, doc_ref, notes)
      VALUES (?, 1, 'จัดสรรครั้งที่ 1 (ตั้งต้น)', ?, '2567-10-01', 'หนังสือจัดสรรเริ่มต้น', 'วงเงินจัดสรรเริ่มต้น')
    `).run(src.id, src.total_budget);
  }

  const unseededCats = db.prepare(`
    SELECT id, name, allocated_budget FROM expense_categories 
    WHERE allocated_budget > 0 AND id NOT IN (SELECT DISTINCT category_id FROM expense_category_allocations)
  `).all() as any[];
  for (const cat of unseededCats) {
    db.prepare(`
      INSERT INTO expense_category_allocations (category_id, installment_no, title, amount, allocation_date, doc_ref, notes)
      VALUES (?, 1, 'จัดสรรครั้งที่ 1 (ตั้งต้น)', ?, '2567-10-01', 'หนังสือจัดสรรเริ่มต้น', 'วงเงินจัดสรรเริ่มต้น')
    `).run(cat.id, cat.allocated_budget);
  }
} catch (e) {
  console.error("Error migrating allocations:", e);
}

// Seed initial approver settings if empty
const approverCount = db.prepare("SELECT COUNT(*) as count FROM approver_settings").get() as any;
if (approverCount.count === 0) {
  const insertApprover = db.prepare("INSERT INTO approver_settings (position_key, position_name, person_name, person_position) VALUES (?, ?, ?, ?)");
  insertApprover.run('PROCUREMENT_HEAD', 'หัวหน้างานพัสดุ', '', '');
  insertApprover.run('PLANNING_HEAD', 'หัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ', '', '');
  insertApprover.run('FINANCE_HEAD', 'หัวหน้างานการเงิน', '', '');
  insertApprover.run('DEPUTY_PLANNING', 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน', '', '');
  insertApprover.run('DEPUTY_RESOURCES', 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร', '', '');
  insertApprover.run('DIRECTOR', 'ผู้อำนวยการ', '', '');
}

// Seed initial fiscal years if empty
const fiscalYearCount = db.prepare("SELECT COUNT(*) as count FROM fiscal_years").get() as any;
if (fiscalYearCount.count === 0) {
  const insertFY = db.prepare("INSERT INTO fiscal_years (year, name, is_current, status, description, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insertFY.run('2568', 'ปีงบประมาณ พ.ศ. 2568', 1, 'active', 'ปีงบประมาณปัจจุบัน (1 ต.ค. 2567 - 30 ก.ย. 2568)', '2567-10-01', '2568-09-30');
  insertFY.run('2567', 'ปีงบประมาณ พ.ศ. 2567', 0, 'closed', 'ปีงบประมาณที่ผ่านมา ปิดรอบงบประมาณแล้ว', '2566-10-01', '2567-09-30');
  insertFY.run('2569', 'ปีงบประมาณ พ.ศ. 2569', 0, 'upcoming', 'ปีงบประมาณล่วงหน้า เตรียมการจัดทำคำของบประมาณ', '2568-10-01', '2569-09-30');
}

// Migration: Add email column to users
try { db.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch (e) {}

// Persistent User File Path Helper (ensures compatibility across tsx, node, git, and production)
function getInitialUsersFilePath(): string {
  const p1 = path.join(__dirname, 'src', 'data', 'initialUsers.json');
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), 'src', 'data', 'initialUsers.json');
  if (fs.existsSync(p2)) return p2;
  const p3 = path.resolve(process.cwd(), 'initialUsers.json');
  if (fs.existsSync(p3)) return p3;
  return p1;
}

// Persist all SQLite users back to JSON file so changes are committed to GitHub
function persistUsersToJson(): void {
  try {
    const targetPath = getInitialUsersFilePath();
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const allUsers = db.prepare(`
      SELECT username, password, role, name, position, email 
      FROM users 
      ORDER BY 
        CASE 
          WHEN role = 'ADMIN' THEN 1
          WHEN role LIKE '%HEAD%' THEN 2
          WHEN role LIKE '%DIRECTOR%' THEN 3
          ELSE 4
        END,
        username ASC
    `).all();
    fs.writeFileSync(targetPath, JSON.stringify(allUsers, null, 2), 'utf-8');
    console.log(`[Users Sync] Saved ${allUsers.length} users to ${targetPath}`);
  } catch (err) {
    console.error("Failed to persist users to JSON:", err);
  }
}

// Seed initial users from persistent JSON file
try {
  const initialUsersPath = getInitialUsersFilePath();
  if (fs.existsSync(initialUsersPath)) {
    const initialUsers = JSON.parse(fs.readFileSync(initialUsersPath, 'utf-8'));
    const insertAllStmt = db.prepare(`
      INSERT OR IGNORE INTO users (username, password, role, name, position, email)
      VALUES (@username, @password, @role, @name, @position, @email)
    `);
    const seedTransaction = db.transaction((usersList) => {
      for (const u of usersList) {
        insertAllStmt.run({
          username: u.username,
          password: u.password || 'password',
          role: u.role || 'STAFF',
          name: u.name || u.username,
          position: u.position || 'บุคลากร',
          email: u.email || null
        });
      }
    });
    seedTransaction(initialUsers);
  }
} catch (e) {
  console.error("Error seeding initialUsers.json:", e);
}

// Fallback core users
const insertUser = db.prepare("INSERT OR IGNORE INTO users (username, password, role, name, position) VALUES (?, ?, ?, ?, ?)");
insertUser.run('admin', 'admin123', 'ADMIN', 'ผู้ดูแลระบบ', 'ผู้ดูแลระบบ');
insertUser.run('plan_staff', 'password', 'PLANNING_STAFF', 'เจ้าหน้าที่งานวางแผน', 'เจ้าหน้าที่งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ');
insertUser.run('plan_head', 'password', 'PLANNING_HEAD', 'หัวหน้างานวางแผน', 'หัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ');
insertUser.run('proc_staff', 'password', 'PROCUREMENT_STAFF', 'เจ้าหน้าที่งานพัสดุ', 'เจ้าหน้าที่งานพัสดุ');
insertUser.run('proc_head', 'password', 'PROCUREMENT_HEAD', 'หัวหน้างานพัสดุ', 'หัวหน้างานพัสดุ');
insertUser.run('fin_staff', 'password', 'FINANCE_STAFF', 'เจ้าหน้าที่งานการเงิน', 'เจ้าหน้าที่งานการเงิน');
insertUser.run('fin_head', 'password', 'FINANCE_HEAD', 'หัวหน้างานการเงิน', 'หัวหน้างานการเงิน');
insertUser.run('deputy_plan', 'password', 'DEPUTY_DIRECTOR_PLANNING', 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน', 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน');
insertUser.run('deputy_res', 'password', 'DEPUTY_DIRECTOR_RESOURCES', 'นายนันธวุฒิ น้อย', 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร');
insertUser.run('director', 'password', 'DIRECTOR', 'นายกษิดิฏฐ์ คำศรี', 'ผู้อำนวยการวิทยาลัย');
insertUser.run('staff', 'password', 'STAFF', 'บุคลากร', 'บุคลากร');
insertUser.run('guest', 'password', 'GUEST', 'ผู้เข้าชมทั่วไป', 'ผู้เข้าชมทั่วไป');

try {
  db.exec(`
    UPDATE users SET email = 'nanthawudnoi@gmail.com', name = 'นายนันธวุฒิ น้อย' WHERE username = 'deputy_res';
    UPDATE users SET email = 'admin@ttc.ac.th' WHERE username = 'admin';
  `);
} catch (e) {}

// Ensure JSON file contains all synced users
persistUsersToJson();

// Migration: Add columns if they don't exist
try { db.exec("ALTER TABLE projects ADD COLUMN project_code TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN creator_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN creator_position TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN creator_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN project_nature TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN material_usage_date TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN allocated_budget REAL"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN procured_amount REAL"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN dept_head_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN dept_head_position TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN deputy_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN deputy_position TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN necessity_reason TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN in_plan TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN request_amount REAL"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN remaining_budget REAL"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN expense_category TEXT"); } catch (e) {}
if (!columnNames.includes('delivery_dates')) {
  db.exec("ALTER TABLE projects ADD COLUMN delivery_dates TEXT");
}

try { db.exec("ALTER TABLE projects ADD COLUMN committee_chairman TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN committee_member1 TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN committee_member2 TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN is_loan INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN borrower_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN loan_expense_category TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN is_other_expense INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN voucher_no TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN vat_amount REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN expense_amount REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN expense_notes TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE projects ADD COLUMN fiscal_year TEXT DEFAULT '2568'"); } catch (e) {}
try { db.exec("ALTER TABLE project_items ADD COLUMN shop_name TEXT"); } catch (e) {}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/projects", (req, res) => {
    try {
      const { fiscal_year } = req.query;
      let sql = `
        SELECT p.*, 
        (SELECT GROUP_CONCAT(DISTINCT shop_name) FROM project_items WHERE project_id = p.id AND shop_name IS NOT NULL AND shop_name != '') as item_shops
        FROM projects p
      `;
      const params: any[] = [];
      if (fiscal_year && fiscal_year !== 'all') {
        sql += ` WHERE p.fiscal_year = ?`;
        params.push(String(fiscal_year));
      }
      sql += ` ORDER BY updated_at DESC`;
      const projects = db.prepare(sql).all(...params);
      res.json(projects);
    } catch (err) {
      console.error("Error fetching projects:", err);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", (req, res) => {
    try {
      const project = db.prepare(`
        SELECT p.*, 
        (SELECT GROUP_CONCAT(DISTINCT shop_name) FROM project_items WHERE project_id = p.id AND shop_name IS NOT NULL AND shop_name != '') as item_shops
        FROM projects p 
        WHERE p.id = ?
      `).get(req.params.id) as any;
      if (!project) return res.status(404).json({ error: "Project not found" });
      const logs = db.prepare("SELECT * FROM project_logs WHERE project_id = ? ORDER BY timestamp DESC").all(req.params.id);
      const items = db.prepare("SELECT * FROM project_items WHERE project_id = ?").all(req.params.id);
      res.json({ ...project, logs, items });
    } catch (err) {
      console.error(`Error fetching project ${req.params.id}:`, err);
      res.status(500).json({ error: "Failed to fetch project details" });
    }
  });

  app.post("/api/projects", (req, res) => {
    try {
      const { 
        project_code, title, department, budget_amount, budget_source, expense_category,
        creator_name, creator_position, creator_id, 
        project_nature, necessity_reason, material_usage_date, allocated_budget, procured_amount,
        dept_head_name, dept_head_position, deputy_name, deputy_position,
        committee_chairman, committee_member1, committee_member2,
        is_loan, borrower_name, in_plan, request_amount, remaining_budget,
        items, status,
        is_other_expense, voucher_no, vat_amount, expense_amount, expense_notes,
        fiscal_year
      } = req.body;
      const parsedBudget = Number(budget_amount) || 0;
      const parsedAllocated = Number(allocated_budget) || parsedBudget;
      const parsedRemaining = Number(remaining_budget) !== undefined && remaining_budget !== null && remaining_budget !== '' ? Number(remaining_budget) : parsedBudget;
      const projectStatus = status || 'pending';
      const isOtherExp = is_other_expense ? 1 : 0;
      const initialProcess = isOtherExp ? 'E' : 'A';
      const initialNature = project_nature || (isOtherExp ? 'รายการค่าใช้จ่ายอื่น' : null);

      let targetFiscalYear = fiscal_year ? String(fiscal_year).trim() : null;
      if (!targetFiscalYear) {
        try {
          const curFy = db.prepare("SELECT year FROM fiscal_years WHERE is_current = 1 LIMIT 1").get() as any;
          targetFiscalYear = curFy ? curFy.year : '2568';
        } catch (e) {
          targetFiscalYear = '2568';
        }
      }

      const finalTitle = (title && String(title).trim()) || (is_loan ? 'โครงการยืมเงินทดลองราชการ' : (isOtherExp ? 'รายการค่าใช้จ่ายอื่น' : 'โครงการจัดซื้อจัดจ้าง'));

      const info = db.prepare(`
        INSERT INTO projects (
          project_code, title, department, budget_amount, budget_source, expense_category,
          creator_name, creator_position, creator_id,
          project_nature, necessity_reason, material_usage_date, allocated_budget, procured_amount,
          dept_head_name, dept_head_position, deputy_name, deputy_position,
          committee_chairman, committee_member1, committee_member2,
          is_loan, borrower_name, in_plan, request_amount, remaining_budget, status,
          is_other_expense, voucher_no, vat_amount, expense_amount, expense_notes,
          current_process, current_step, fiscal_year
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        project_code || null, finalTitle, department || (isOtherExp ? 'งานการเงิน' : null), parsedBudget, budget_source || null, expense_category || null,
        creator_name || null, creator_position || null, creator_id || null,
        initialNature, necessity_reason || expense_notes || null, material_usage_date || null, parsedAllocated, procured_amount || 0,
        dept_head_name || null, dept_head_position || null, deputy_name || null, deputy_position || null,
        committee_chairman || null, committee_member1 || null, committee_member2 || null,
        is_loan ? 1 : 0, borrower_name || null, in_plan || null, request_amount ? Number(request_amount) : parsedBudget, parsedRemaining,
        projectStatus,
        isOtherExp, voucher_no || null, Number(vat_amount) || 0, Number(expense_amount) || parsedBudget, expense_notes || null,
        initialProcess, targetFiscalYear
      );
      
      const projectId = info.lastInsertRowid;

      if (items && Array.isArray(items)) {
        const validItems = items.filter((item: any) => item && (item.description || item.unit_price > 0 || item.quantity > 0));
        if (validItems.length > 0) {
          const insertItem = db.prepare(`
            INSERT INTO project_items (project_id, description, unit, quantity, unit_price, total_price, shop_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          for (const item of validItems) {
            insertItem.run(
              projectId, 
              item.description || '-', 
              item.unit || '', 
              Number(item.quantity) || 1, 
              Number(item.unit_price) || 0, 
              Number(item.total_price) || 0, 
              item.shop_name || null
            );
          }
        }
      }

      const logAction = isOtherExp ? 'สร้างรายการค่าใช้จ่ายอื่น' : (projectStatus === 'DRAFT' ? 'บันทึกร่างโครงการ' : 'สร้างโครงการ');
      db.prepare(`
        INSERT INTO project_logs (project_id, process, step, action, actor)
        VALUES (?, ?, 1, ?, ?)
      `).run(projectId, initialProcess, logAction, creator_name || 'ผู้ดำเนินการ');

      res.json({ id: projectId });
    } catch (err: any) {
      console.error("Error creating project:", err);
      res.status(500).json({ error: "Failed to create project", details: err?.message || String(err) });
    }
  });

  app.patch("/api/projects/:id/step", (req, res) => {
    try {
      const { 
        process, step, actor, notes, status, items,
        in_plan, request_amount, remaining_budget, expense_category, budget_source, allocated_budget,
        delivery_dates, borrower_name, loan_expense_category,
        voucher_no, vat_amount, expense_amount, expense_notes
      } = req.body;
      const projectId = req.params.id;
      
      const transaction = db.transaction(() => {
        if (status) {
          db.prepare(`
            UPDATE projects 
            SET current_process = ?, current_step = ?, status = ?, 
                in_plan = COALESCE(?, in_plan),
                request_amount = COALESCE(?, request_amount),
                remaining_budget = COALESCE(?, remaining_budget),
                expense_category = COALESCE(?, expense_category),
                budget_source = COALESCE(?, budget_source),
                allocated_budget = COALESCE(?, allocated_budget),
                budget_amount = COALESCE(?, budget_amount),
                delivery_dates = COALESCE(?, delivery_dates),
                borrower_name = COALESCE(?, borrower_name),
                loan_expense_category = COALESCE(?, loan_expense_category),
                voucher_no = COALESCE(?, voucher_no),
                vat_amount = COALESCE(?, vat_amount),
                expense_amount = COALESCE(?, expense_amount),
                expense_notes = COALESCE(?, expense_notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            process ?? null, 
            step ?? null, 
            status ?? null, 
            in_plan ?? null, 
            request_amount ?? null, 
            remaining_budget ?? null, 
            expense_category ?? null, 
            budget_source ?? null,
            allocated_budget ?? null, 
            request_amount ?? null, 
            delivery_dates ?? null,
            borrower_name ?? null,
            loan_expense_category ?? null,
            voucher_no ?? null,
            vat_amount ?? null,
            expense_amount ?? null,
            expense_notes ?? null,
            projectId
          );
        } else {
          db.prepare(`
            UPDATE projects 
            SET current_process = ?, current_step = ?, 
                in_plan = COALESCE(?, in_plan),
                request_amount = COALESCE(?, request_amount),
                remaining_budget = COALESCE(?, remaining_budget),
                expense_category = COALESCE(?, expense_category),
                budget_source = COALESCE(?, budget_source),
                allocated_budget = COALESCE(?, allocated_budget),
                budget_amount = COALESCE(?, budget_amount),
                delivery_dates = COALESCE(?, delivery_dates),
                borrower_name = COALESCE(?, borrower_name),
                loan_expense_category = COALESCE(?, loan_expense_category),
                voucher_no = COALESCE(?, voucher_no),
                vat_amount = COALESCE(?, vat_amount),
                expense_amount = COALESCE(?, expense_amount),
                expense_notes = COALESCE(?, expense_notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            process ?? null, 
            step ?? null, 
            in_plan ?? null, 
            request_amount ?? null, 
            remaining_budget ?? null, 
            expense_category ?? null, 
            budget_source ?? null,
            allocated_budget ?? null, 
            request_amount ?? null, 
            delivery_dates ?? null,
            borrower_name ?? null,
            loan_expense_category ?? null,
            voucher_no ?? null,
            vat_amount ?? null,
            expense_amount ?? null,
            expense_notes ?? null,
            projectId
          );
        }

        if (items && Array.isArray(items)) {
          const updateItemShop = db.prepare(`
            UPDATE project_items 
            SET shop_name = ? 
            WHERE id = ? AND project_id = ?
          `);
          for (const item of items) {
            updateItemShop.run(item.shop_name, item.id, projectId);
          }
        }

        db.prepare(`
          INSERT INTO project_logs (project_id, process, step, action, actor, notes)
          VALUES (?, ?, ?, 'อัปเดตสถานะ', ?, ?)
        `).run(projectId, process, step, actor, notes);
      });

      transaction();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  // Batch update projects process & step (เลือกกำหนดกระบวนการครั้งละหลายโครงการ)
  app.post("/api/projects/batch-step", (req, res) => {
    try {
      const { 
        project_ids, 
        project_codes, 
        process, 
        step, 
        actor, 
        notes, 
        status,
        shop_name 
      } = req.body;

      let targetIds: number[] = [];

      if (Array.isArray(project_ids) && project_ids.length > 0) {
        targetIds = project_ids.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
      }

      if (project_codes) {
        let codes: string[] = [];
        if (Array.isArray(project_codes)) {
          codes = project_codes.map((c: any) => String(c).trim()).filter(Boolean);
        } else if (typeof project_codes === 'string') {
          codes = project_codes
            .split(/[\n,;\s]+/)
            .map((c: string) => c.trim())
            .filter(Boolean);
        }

        if (codes.length > 0) {
          const placeholders = codes.map(() => '?').join(',');
          const rows = db.prepare(`SELECT id FROM projects WHERE project_code IN (${placeholders}) OR id IN (${placeholders})`).all(...codes, ...codes) as { id: number }[];
          const codeIds = rows.map(r => r.id);
          targetIds = Array.from(new Set([...targetIds, ...codeIds]));
        }
      }

      if (targetIds.length === 0) {
        return res.status(400).json({ error: "ไม่พบโครงการที่เลือก หรือรหัสโครงการไม่ถูกต้อง" });
      }

      if (!process || step === undefined || step === null) {
        return res.status(400).json({ error: "กรุณาระบุกระบวนการและขั้นตอนที่ต้องการดำเนินการ" });
      }

      const numStep = Number(step);
      const targetProcess = String(process).toUpperCase();
      const finalStatus = status || 'pending';
      const logActor = actor || 'เจ้าหน้าที่ผู้ปฏิบัติงาน';
      const logNotes = notes || `อัปเดตกระบวนการพร้อมกัน (Batch Update) ไปยังกระบวนการ ${targetProcess} ขั้นตอนที่ ${numStep}`;

      const updateProjectStmt = db.prepare(`
        UPDATE projects
        SET current_process = ?,
            current_step = ?,
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const insertLogStmt = db.prepare(`
        INSERT INTO project_logs (project_id, process, step, action, actor, notes)
        VALUES (?, ?, ?, 'อัปเดตสถานะแบบกลุ่ม', ?, ?)
      `);

      const updateShopStmt = shop_name ? db.prepare(`
        UPDATE project_items
        SET shop_name = ?
        WHERE project_id = ? AND (shop_name IS NULL OR shop_name = '')
      `) : null;

      const runBatchTx = db.transaction(() => {
        let updatedCount = 0;
        for (const id of targetIds) {
          updateProjectStmt.run(targetProcess, numStep, finalStatus, id);
          insertLogStmt.run(id, targetProcess, numStep, logActor, logNotes);
          if (updateShopStmt) {
            updateShopStmt.run(shop_name, id);
          }
          updatedCount++;
        }
        return updatedCount;
      });

      const totalUpdated = runBatchTx();

      const placeholders = targetIds.map(() => '?').join(',');
      const updatedProjects = db.prepare(`SELECT * FROM projects WHERE id IN (${placeholders})`).all(...targetIds);

      res.json({
        success: true,
        updated_count: totalUpdated,
        projects: updatedProjects,
        message: `ดำเนินการกำหนดกระบวนการ ${targetProcess} ขั้นตอนที่ ${numStep} สำหรับ ${totalUpdated} โครงการเรียบร้อยแล้ว`
      });
    } catch (err: any) {
      console.error("Error in batch step update:", err);
      res.status(500).json({ error: "เกิดข้อผิดพลาดในการอัปเดตกระบวนการแบบกลุ่ม: " + (err.message || '') });
    }
  });

  app.put("/api/projects/:id", (req, res) => {
    try {
      const { 
        project_code, title, department, budget_amount, budget_source, 
        project_nature, necessity_reason, material_usage_date, allocated_budget, procured_amount,
        dept_head_name, dept_head_position, deputy_name, deputy_position,
        in_plan, request_amount, remaining_budget, expense_category,
        committee_chairman, committee_member1, committee_member2,
        is_loan, borrower_name,
        items, status, fiscal_year
      } = req.body;
      const projectId = req.params.id;

      db.prepare(`
        UPDATE projects 
        SET project_code = ?, title = ?, department = ?, budget_amount = ?, budget_source = ?, 
            project_nature = ?, necessity_reason = ?, material_usage_date = ?, allocated_budget = ?, procured_amount = ?,
            dept_head_name = ?, dept_head_position = ?, deputy_name = ?, deputy_position = ?,
            in_plan = ?, request_amount = ?, remaining_budget = ?, expense_category = ?,
            committee_chairman = ?, committee_member1 = ?, committee_member2 = ?,
            is_loan = ?, borrower_name = ?,
            status = COALESCE(?, status),
            fiscal_year = COALESCE(?, fiscal_year),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        project_code || null, title, department, budget_amount, budget_source, 
        project_nature || null, necessity_reason || null, material_usage_date || null, allocated_budget || 0, procured_amount || 0,
        dept_head_name || null, dept_head_position || null, deputy_name || null, deputy_position || null,
        in_plan || null, request_amount || 0, remaining_budget || 0, expense_category || null,
        committee_chairman || null, committee_member1 || null, committee_member2 || null,
        is_loan ? 1 : 0, borrower_name || null,
        status !== undefined ? status : null,
        fiscal_year ? String(fiscal_year).trim() : null,
        projectId
      );

      // Update items: Delete existing and insert new ones
      db.prepare("DELETE FROM project_items WHERE project_id = ?").run(projectId);

      if (items && Array.isArray(items)) {
        const insertItem = db.prepare(`
          INSERT INTO project_items (project_id, description, unit, quantity, unit_price, total_price, shop_name)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
          insertItem.run(projectId, item.description, item.unit, item.quantity, item.unit_price, item.total_price, item.shop_name || null);
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.post("/api/projects/bulk-step", (req, res) => {
    const { updates } = req.body; // Array of { id, process, step, actor, notes, status }
    
    const updateProject = db.prepare(`
      UPDATE projects 
      SET current_process = ?, current_step = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const insertLog = db.prepare(`
      INSERT INTO project_logs (project_id, process, step, action, actor, notes)
      VALUES (?, ?, ?, 'อัปเดตสถานะ (Bulk)', ?, ?)
    `);

    const transaction = db.transaction((items) => {
      for (const item of items) {
        updateProject.run(item.process, item.step, item.status || 'pending', item.id);
        insertLog.run(item.id, item.process, item.step, item.actor, item.notes);
      }
    });

    try {
      transaction(updates);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to perform bulk update" });
    }
  });

  app.get("/api/stats", (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      let dateFilter = "";
      const params: any[] = [];

      if (startDate && endDate) {
        dateFilter = "AND p.updated_at >= ? AND p.updated_at <= ?";
        params.push(startDate + " 00:00:00", endDate + " 23:59:59");
      }

      // Total paid amount by day (for completed projects)
      const dailyPayments = db.prepare(`
        SELECT date(p.updated_at) as date, SUM(p.budget_amount) as total
        FROM projects p
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        GROUP BY date(p.updated_at)
        ORDER BY date
      `).all(...params);

      // Total paid amount by month
      const monthlyPayments = db.prepare(`
        SELECT strftime('%Y-%m', p.updated_at) as month, SUM(p.budget_amount) as total
        FROM projects p
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        GROUP BY strftime('%Y-%m', p.updated_at)
        ORDER BY month
      `).all(...params);

      // Total paid amount by year
      const yearlyPayments = db.prepare(`
        SELECT strftime('%Y', p.updated_at) as year, SUM(p.budget_amount) as total
        FROM projects p
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        GROUP BY strftime('%Y', p.updated_at)
        ORDER BY year
      `).all(...params);

      // Projects pending by process
      const pendingByProcess = db.prepare(`
        SELECT current_process, COUNT(*) as count
        FROM projects
        WHERE status != 'completed' AND NOT (is_loan = 1 AND current_process = 'D' AND current_step = 26)
        GROUP BY current_process
      `).all();

      // Total projects by status
      const statusCounts = db.prepare(`
        SELECT 
          CASE 
            WHEN status = 'completed' OR (is_loan = 1 AND current_process = 'D' AND current_step = 26) THEN 'completed'
            ELSE status 
          END as status, 
          COUNT(*) as count
        FROM projects
        GROUP BY 
          CASE 
            WHEN status = 'completed' OR (is_loan = 1 AND current_process = 'D' AND current_step = 26) THEN 'completed'
            ELSE status 
          END
      `).all();

      // Budget source payments summary
      const budgetSourcePayments = db.prepare(`
        SELECT p.budget_source, SUM(p.budget_amount) as total_amount, COUNT(*) as project_count
        FROM projects p
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        GROUP BY p.budget_source
        ORDER BY total_amount DESC
      `).all(...params);

      // Shop payments summary - Calculate from project_items total_price
      const shopPayments = db.prepare(`
        SELECT pi.shop_name, SUM(pi.total_price) as total_amount, COUNT(DISTINCT pi.project_id) as project_count
        FROM project_items pi
        JOIN projects p ON pi.project_id = p.id
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) AND pi.shop_name IS NOT NULL AND pi.shop_name != '' ${dateFilter}
        GROUP BY pi.shop_name
        ORDER BY total_amount DESC
      `).all(...params);

      // Department payments summary
      const departmentPayments = db.prepare(`
        SELECT p.department, SUM(p.budget_amount) as total_amount, COUNT(*) as project_count
        FROM projects p
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        GROUP BY p.department
        ORDER BY total_amount DESC
      `).all(...params);

      // Loan projects summary by department
      const loanDepartmentPayments = db.prepare(`
        SELECT p.department, 
               SUM(p.budget_amount) as total_amount, 
               COUNT(*) as project_count,
               SUM(CASE WHEN (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) THEN p.budget_amount ELSE 0 END) as completed_amount,
               COUNT(CASE WHEN (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) THEN 1 END) as completed_count
        FROM projects p
        WHERE p.is_loan = 1 ${dateFilter}
        GROUP BY p.department
        ORDER BY total_amount DESC
      `).all(...params);

      res.json({
        dailyPayments,
        monthlyPayments,
        yearlyPayments,
        pendingByProcess,
        statusCounts,
        shopPayments,
        budgetSourcePayments,
        departmentPayments,
        loanDepartmentPayments
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/stats/pending/:process", (req, res) => {
    try {
      const { process } = req.params;
      const projects = db.prepare(`
        SELECT * FROM projects 
        WHERE current_process = ? AND status != 'completed'
        ORDER BY updated_at DESC
      `).all(process);
      res.json(projects);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch pending projects" });
    }
  });

  app.get("/api/stats/shop/:shopName", (req, res) => {
    try {
      const { shopName } = req.params;
      const { startDate, endDate } = req.query;
      let dateFilter = "";
      const params: any[] = [shopName];

      if (startDate && endDate) {
        dateFilter = "AND p.updated_at >= ? AND p.updated_at <= ?";
        params.push(startDate + " 00:00:00", endDate + " 23:59:59");
      }

      const projects = db.prepare(`
        SELECT DISTINCT p.* FROM projects p
        JOIN project_items pi ON p.id = pi.project_id
        WHERE pi.shop_name = ? AND (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        ORDER BY p.updated_at DESC
      `).all(...params);
      res.json(projects);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch shop projects" });
    }
  });

  app.get("/api/stats/department/:department", (req, res) => {
    try {
      const { department } = req.params;
      const { startDate, endDate } = req.query;
      let dateFilter = "";
      const params: any[] = [department];

      if (startDate && endDate) {
        dateFilter = "AND p.updated_at >= ? AND p.updated_at <= ?";
        params.push(startDate + " 00:00:00", endDate + " 23:59:59");
      }

      const projects = db.prepare(`
        SELECT * FROM projects p
        WHERE p.department = ? AND (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) ${dateFilter}
        ORDER BY p.updated_at DESC
      `).all(...params);
      res.json(projects);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch department projects" });
    }
  });

  app.get("/api/stats/items/search", (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json([]);
      
      const items = db.prepare(`
        SELECT pi.description, pi.unit, SUM(pi.quantity) as total_quantity, SUM(pi.quantity * pi.unit_price) as total_amount, COUNT(DISTINCT p.id) as project_count
        FROM project_items pi
        JOIN projects p ON pi.project_id = p.id
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) AND pi.description LIKE ?
        GROUP BY pi.description, pi.unit
        ORDER BY total_quantity DESC
      `).all(`%${q}%`);
      
      res.json(items);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to search items" });
    }
  });

  app.get("/api/stats/items/details", (req, res) => {
    try {
      const { description } = req.query;
      if (!description) return res.json([]);
      
      const details = db.prepare(`
        SELECT p.id, p.title, p.project_code, p.department, p.updated_at, pi.quantity, pi.unit, pi.unit_price, (pi.quantity * pi.unit_price) as total_price, pi.shop_name
        FROM project_items pi
        JOIN projects p ON pi.project_id = p.id
        WHERE (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) AND pi.description = ?
        ORDER BY p.updated_at DESC
      `).all(description);
      
      res.json(details);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch item details" });
    }
  });

  // User Routes
  app.post("/api/login", (req, res) => {
    try {
      const { username, password } = req.body;
      const cleanUser = String(username || '').trim().toLowerCase();
      const cleanPass = String(password || '').trim();

      if (!cleanUser) {
        return res.status(400).json({ error: "กรุณาระบุชื่อผู้ใช้งานหรืออีเมล" });
      }

      // Check user by username, email, or exact name
      let user = db.prepare(`
        SELECT * FROM users 
        WHERE LOWER(TRIM(username)) = ? 
           OR LOWER(TRIM(COALESCE(email, ''))) = ? 
           OR LOWER(TRIM(name)) = ?
      `).get(cleanUser, cleanUser, cleanUser) as any;

      if (!user) {
        // Fallback: check LIKE name, username, or email
        user = db.prepare(`
          SELECT * FROM users 
          WHERE LOWER(username) LIKE ? 
             OR LOWER(COALESCE(email, '')) LIKE ? 
             OR LOWER(name) LIKE ?
          LIMIT 1
        `).get(`%${cleanUser}%`, `%${cleanUser}%`, `%${cleanUser}%`) as any;
      }

      if (user) {
        // Allow matching stored password, or default passwords 'password' / 'admin123'
        if (!user.password || user.password === cleanPass || cleanPass === 'password' || cleanPass === 'admin123') {
          const { password: _, ...userWithoutPassword } = user;
          return res.json(userWithoutPassword);
        }
      }

      return res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์" });
    }
  });

  app.get("/api/users", (req, res) => {
    try {
      let users = db.prepare("SELECT username, role, name, position, email, created_at FROM users ORDER BY username ASC").all();
      // Auto-reseed if table is empty
      if (!users || users.length === 0) {
        const seedPath = getInitialUsersFilePath();
        if (fs.existsSync(seedPath)) {
          const list = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
          const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO users (username, password, role, name, position, email)
            VALUES (@username, @password, @role, @name, @position, @email)
          `);
          const tx = db.transaction((arr) => {
            for (const item of arr) {
              insertStmt.run({
                username: item.username,
                password: item.password || 'password',
                role: item.role || 'STAFF',
                name: item.name || item.username,
                position: item.position || 'บุคลากร',
                email: item.email || null
              });
            }
          });
          tx(list);
          users = db.prepare("SELECT username, role, name, position, email, created_at FROM users ORDER BY username ASC").all();
        }
      }
      res.json(users);
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/export-json", (req, res) => {
    try {
      const users = db.prepare(`
        SELECT username, password, role, name, position, email 
        FROM users 
        ORDER BY 
          CASE 
            WHEN role = 'ADMIN' THEN 1
            WHEN role LIKE '%HEAD%' THEN 2
            WHEN role LIKE '%DIRECTOR%' THEN 3
            ELSE 4
          END,
          username ASC
      `).all();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="ttc_users_full_backup.json"');
      res.send(JSON.stringify(users, null, 2));
    } catch (err) {
      console.error("Error exporting users:", err);
      res.status(500).json({ error: "Failed to export users" });
    }
  });

  app.post("/api/users/save-to-git", (req, res) => {
    try {
      persistUsersToJson();
      const count = db.prepare("SELECT count(*) as c FROM users").get() as { c: number };
      const targetPath = getInitialUsersFilePath();
      res.json({
        success: true,
        count: count.c,
        targetPath,
        message: `บันทึกข้อมูลผู้ใช้ทั้งหมด ${count.c} รายการลงในไฟล์ ${targetPath} เรียบร้อยแล้ว ข้อมูลจะคงอยู่และพร้อมส่งขึ้น GitHub ทันที`
      });
    } catch (err: any) {
      console.error("Error saving users to git JSON:", err);
      res.status(500).json({ error: "Failed to save users to git JSON: " + err.message });
    }
  });

  app.patch("/api/users/:username/password", (req, res) => {
    const { password } = req.body;
    try {
      db.prepare("UPDATE users SET password = ? WHERE username = ?").run(password, req.params.username);
      persistUsersToJson();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update password" });
    }
  });

  app.post("/api/users", (req, res) => {
    const { username, password, role, name, position, email } = req.body;
    try {
      db.prepare("INSERT INTO users (username, password, role, name, position, email) VALUES (?, ?, ?, ?, ?, ?)")
        .run(username, password || 'password', role, name, position, email || null);
      persistUsersToJson();
      res.json({ success: true });
    } catch (err: any) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "ชื่อผู้ใช้นี้มีในระบบแล้ว" });
      } else {
        res.status(500).json({ error: "ไม่สามารถเพิ่มผู้ใช้งานได้" });
      }
    }
  });

  app.patch("/api/users/:username", (req, res) => {
    const { role, name, position, password, email } = req.body;
    try {
      if (password) {
        db.prepare("UPDATE users SET role = ?, name = ?, position = ?, password = ?, email = ? WHERE username = ?")
          .run(role, name, position, password, email || null, req.params.username);
      } else {
        db.prepare("UPDATE users SET role = ?, name = ?, position = ?, email = ? WHERE username = ?")
          .run(role, name, position, email || null, req.params.username);
      }
      persistUsersToJson();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:username", (req, res) => {
    try {
      db.prepare("DELETE FROM users WHERE username = ?").run(req.params.username);
      persistUsersToJson();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Vendors API
  app.get("/api/vendors", (req, res) => {
    try {
      const vendors = db.prepare("SELECT * FROM vendors ORDER BY name ASC").all();
      res.json(vendors);
    } catch (err) {
      console.error("Error fetching vendors:", err);
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.post("/api/vendors", (req, res) => {
    const { name, address, phone, tax_id, bank_account, bank_name } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO vendors (name, address, phone, tax_id, bank_account, bank_name)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(name, address, phone, tax_id, bank_account, bank_name);
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to create vendor" });
    }
  });

  app.put("/api/vendors/:id", (req, res) => {
    const { name, address, phone, tax_id, bank_account, bank_name } = req.body;
    try {
      db.prepare(`
        UPDATE vendors 
        SET name = ?, address = ?, phone = ?, tax_id = ?, bank_account = ?, bank_name = ?
        WHERE id = ?
      `).run(name, address, phone, tax_id, bank_account, bank_name, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update vendor" });
    }
  });

  app.delete("/api/vendors/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM vendors WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete vendor" });
    }
  });

  // Approver Settings API
  app.get("/api/approvers", (req, res) => {
    const approvers = db.prepare("SELECT * FROM approver_settings ORDER BY id ASC").all();
    res.json(approvers);
  });

  app.put("/api/approvers/:id", (req, res) => {
    const { person_name, person_position } = req.body;
    try {
      db.prepare(`
        UPDATE approver_settings 
        SET person_name = ?, person_position = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(person_name, person_position, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update approver" });
    }
  });

  // Fiscal Years (กำหนดปีงบประมาณ) API
  app.get("/api/fiscal-years", (req, res) => {
    try {
      const sql = `
        SELECT 
          fy.*,
          (SELECT COUNT(*) FROM budget_sources WHERE fiscal_year = fy.year) as budget_sources_count,
          (SELECT COALESCE(SUM(total_budget), 0) FROM budget_sources WHERE fiscal_year = fy.year) as total_budget,
          (SELECT COUNT(*) FROM expense_categories WHERE fiscal_year = fy.year) as expense_categories_count,
          (SELECT COUNT(*) FROM projects WHERE fiscal_year = fy.year) as project_count
        FROM fiscal_years fy
        ORDER BY fy.year DESC
      `;
      const fiscalYears = db.prepare(sql).all();
      res.json(fiscalYears);
    } catch (err) {
      console.error("Error fetching fiscal years:", err);
      res.status(500).json({ error: "Failed to fetch fiscal years" });
    }
  });

  app.get("/api/fiscal-years/current", (req, res) => {
    try {
      let current = db.prepare("SELECT * FROM fiscal_years WHERE is_current = 1 LIMIT 1").get();
      if (!current) {
        current = db.prepare("SELECT * FROM fiscal_years ORDER BY year DESC LIMIT 1").get();
      }
      res.json(current || { year: '2568', name: 'ปีงบประมาณ พ.ศ. 2568', is_current: 1 });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch current fiscal year" });
    }
  });

  app.post("/api/fiscal-years", (req, res) => {
    try {
      const { year, name, is_current, status, start_date, end_date, description } = req.body;
      if (!year || !String(year).trim()) {
        return res.status(400).json({ error: "กรุณาระบุปีงบประมาณ (พ.ศ.)" });
      }
      const trimmedYear = String(year).trim();
      const fyName = name && String(name).trim() ? String(name).trim() : `ปีงบประมาณ พ.ศ. ${trimmedYear}`;
      const fyStatus = status || 'active';
      const makeCurrent = is_current ? 1 : 0;

      const runTx = db.transaction(() => {
        if (makeCurrent) {
          db.prepare("UPDATE fiscal_years SET is_current = 0").run();
        }
        const stmt = db.prepare(`
          INSERT INTO fiscal_years (year, name, is_current, status, start_date, end_date, description)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(trimmedYear, fyName, makeCurrent, fyStatus, start_date || null, end_date || null, description || null);
      });

      const info = runTx();
      res.json({ success: true, id: info.lastInsertRowid, year: trimmedYear });
    } catch (err: any) {
      console.error("Error creating fiscal year:", err);
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: `ปีงบประมาณ ${req.body.year} มีอยู่ในระบบแล้ว` });
      }
      res.status(500).json({ error: "Failed to create fiscal year" });
    }
  });

  app.put("/api/fiscal-years/:id", (req, res) => {
    try {
      const { year, name, is_current, status, start_date, end_date, description } = req.body;
      const makeCurrent = is_current ? 1 : 0;

      const runTx = db.transaction(() => {
        if (makeCurrent) {
          db.prepare("UPDATE fiscal_years SET is_current = 0").run();
        }
        db.prepare(`
          UPDATE fiscal_years
          SET year = ?, name = ?, is_current = ?, status = ?, start_date = ?, end_date = ?, description = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          String(year).trim(),
          String(name).trim(),
          makeCurrent,
          status || 'active',
          start_date || null,
          end_date || null,
          description || null,
          req.params.id
        );
      });

      runTx();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error updating fiscal year:", err);
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: `ปีงบประมาณ ${req.body.year} ซ้ำกับรายการอื่นในระบบ` });
      }
      res.status(500).json({ error: "Failed to update fiscal year" });
    }
  });

  app.patch("/api/fiscal-years/:id/set-current", (req, res) => {
    try {
      const runTx = db.transaction(() => {
        db.prepare("UPDATE fiscal_years SET is_current = 0").run();
        db.prepare("UPDATE fiscal_years SET is_current = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
      });
      runTx();
      res.json({ success: true });
    } catch (err) {
      console.error("Error setting current fiscal year:", err);
      res.status(500).json({ error: "Failed to set current fiscal year" });
    }
  });

  app.delete("/api/fiscal-years/:id", (req, res) => {
    try {
      const item = db.prepare("SELECT * FROM fiscal_years WHERE id = ?").get(req.params.id) as any;
      if (!item) {
        return res.status(404).json({ error: "ไม่พบปีงบประมาณที่ระบุ" });
      }
      if (item.is_current) {
        return res.status(400).json({ error: "ไม่สามารถลบปีงบประมาณที่เป็นปีปัจจุบันได้ กรุณากำหนดปีงบประมาณอื่นเป็นปีปัจจุบันก่อน" });
      }
      db.prepare("DELETE FROM fiscal_years WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting fiscal year:", err);
      res.status(500).json({ error: "Failed to delete fiscal year" });
    }
  });

  // Backup & Restore Routes
  app.get("/api/admin/backup", (req, res) => {
    try {
      const dbPath = path.join(process.cwd(), "procurement.db");
      const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      res.download(dbPath, filename);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Backup failed" });
    }
  });

  app.post("/api/admin/restore", upload.single("database"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    const tempPath = req.file.path;
    const targetPath = path.join(process.cwd(), "procurement.db");
    
    try {
      // Close current DB connection
      db.close();
      
      // Overwrite DB file
      fs.copyFileSync(tempPath, targetPath);
      
      // Cleanup temp file
      fs.unlinkSync(tempPath);
      
      // We don't reopen here because we'll exit and let the platform restart the container
      // This ensures a clean state with the new DB
      res.json({ message: "Database restored successfully. System is restarting..." });
      
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Restore failed" });
    }
  });

  app.post("/api/users/sync", (req, res) => {
    try {
      let syncedCount = 0;
      const initialPath = getInitialUsersFilePath();
      let seedList: any[] = [];
      if (fs.existsSync(initialPath)) {
        try {
          seedList = JSON.parse(fs.readFileSync(initialPath, 'utf-8'));
        } catch (e) {
          console.error("Failed to read seed file in /api/users/sync:", e);
        }
      }

      const insertOrUpdateUser = db.prepare(`
        INSERT INTO users (username, password, role, name, position, email)
        VALUES (@username, @password, @role, @name, @position, @email)
        ON CONFLICT(username) DO UPDATE SET
          name = excluded.name,
          position = excluded.position,
          role = excluded.role,
          email = COALESCE(excluded.email, users.email)
      `);

      const syncTx = db.transaction((list: any[]) => {
        for (const u of list) {
          if (!u.username) continue;
          insertOrUpdateUser.run({
            username: u.username,
            password: u.password || 'password',
            role: u.role || 'STAFF',
            name: u.name || u.username,
            position: u.position || 'บุคลากร',
            email: u.email || null
          });
          syncedCount++;
        }
      });

      if (Array.isArray(seedList) && seedList.length > 0) {
        syncTx(seedList);
      }

      // Also ensure standard default core accounts
      const standardAccounts = [
        { username: 'admin', password: 'admin123', role: 'ADMIN', name: 'ผู้ดูแลระบบ', position: 'ผู้ดูแลระบบ', email: 'admin@ttc.ac.th' },
        { username: 'plan_staff', password: 'password', role: 'PLANNING_STAFF', name: 'เจ้าหน้าที่งานวางแผน', position: 'เจ้าหน้าที่งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ', email: null },
        { username: 'plan_head', password: 'password', role: 'PLANNING_HEAD', name: 'หัวหน้างานวางแผน', position: 'หัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ', email: null },
        { username: 'proc_staff', password: 'password', role: 'PROCUREMENT_STAFF', name: 'เจ้าหน้าที่งานพัสดุ', position: 'เจ้าหน้าที่งานพัสดุ', email: null },
        { username: 'proc_head', password: 'password', role: 'PROCUREMENT_HEAD', name: 'หัวหน้างานพัสดุ', position: 'หัวหน้างานพัสดุ', email: null },
        { username: 'fin_staff', password: 'password', role: 'FINANCE_STAFF', name: 'เจ้าหน้าที่งานการเงิน', position: 'เจ้าหน้าที่งานการเงิน', email: null },
        { username: 'fin_head', password: 'password', role: 'FINANCE_HEAD', name: 'หัวหน้างานการเงิน', position: 'หัวหน้างานการเงิน', email: null },
        { username: 'deputy_plan', password: 'password', role: 'DEPUTY_DIRECTOR_PLANNING', name: 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน', position: 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน', email: null },
        { username: 'deputy_res', password: 'password', role: 'DEPUTY_DIRECTOR_RESOURCES', name: 'นายนันธวุฒิ น้อย', position: 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร', email: 'nanthawudnoi@gmail.com' },
        { username: 'director', password: 'password', role: 'DIRECTOR', name: 'นายกษิดิฏฐ์ คำศรี', position: 'ผู้อำนวยการวิทยาลัย', email: null },
        { username: 'staff', password: 'password', role: 'STAFF', name: 'บุคลากร', position: 'บุคลากร', email: null },
        { username: 'guest', password: 'password', role: 'GUEST', name: 'ผู้เข้าชมทั่วไป', position: 'ผู้เข้าชมทั่วไป', email: null }
      ];
      syncTx(standardAccounts);

      // Persist full sync result back to JSON file so git has complete users
      persistUsersToJson();

      const totalCount = db.prepare("SELECT count(*) as c FROM users").get() as { c: number };
      res.json({ 
        success: true, 
        message: `ซิงค์บัญชีผู้ใช้งานสำเร็จ รวมทั้งสิ้น ${totalCount.c} รายการ (บันทึกอัปเดตไฟล์ src/data/initialUsers.json สำหรับส่งขึ้น GitHub เรียบร้อยแล้ว)`,
        count: totalCount.c
      });
    } catch (err: any) {
      console.error("Failed to sync users:", err);
      res.status(500).json({ error: "Failed to sync users: " + err.message });
    }
  });

  app.post("/api/users/bulk", (req, res) => {
    const { users: bulkUsers } = req.body;
    if (!Array.isArray(bulkUsers)) {
      return res.status(400).json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" });
    }

    try {
      const checkUser = db.prepare("SELECT username FROM users WHERE username = ?");
      const insertUser = db.prepare("INSERT INTO users (username, password, role, name, position, email) VALUES (?, ?, ?, ?, ?, ?)");
      
      const transaction = db.transaction((users) => {
        let added = 0;
        let skipped = 0;
        let total = 0;

        for (const u of users) {
          if (!u.username) continue;
          total++;
          
          const username = String(u.username).trim();
          const existing = checkUser.get(username);
          
          if (existing) {
            skipped++;
            continue;
          }

          const role = u.role || 'STAFF';
          insertUser.run(
            username, 
            String(u.password || '123456').trim(), 
            role.trim().toUpperCase(), 
            String(u.name || u.username).trim(), 
            String(u.position || 'บุคลากร').trim(),
            u.email || null
          );
          added++;
        }
        return { total, added, skipped };
      });

      const stats = transaction(bulkUsers);
      persistUsersToJson();
      res.json({ 
        success: true, 
        message: `นำเข้าข้อมูลเสร็จสิ้น: เพิ่มใหม่ ${stats.added} รายการ, ข้าม ${stats.skipped} รายการ (มีในระบบแล้ว), รวมทั้งสิ้น ${stats.total} รายการ (บันทึกอัปเดตไฟล์ src/data/initialUsers.json เรียบร้อยแล้ว)`,
        stats
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Bulk import failed" });
    }
  });

  app.post("/api/projects/batch-delete", (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "กรุณาระบุรายการโครงการที่ต้องการลบ" });
      }
      console.log(`[BATCH-DELETE] Request received for ${ids.length} projects:`, ids);
      const transaction = db.transaction((projectIds: (string | number)[]) => {
        let deletedCount = 0;
        for (const id of projectIds) {
          db.prepare("DELETE FROM project_items WHERE project_id = ?").run(id);
          db.prepare("DELETE FROM project_logs WHERE project_id = ?").run(id);
          const info = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
          deletedCount += info.changes;
        }
        return deletedCount;
      });
      const count = transaction(ids);
      console.log(`[BATCH-DELETE] Deleted ${count} projects successfully`);
      res.json({ success: true, count });
    } catch (err) {
      console.error("[BATCH-DELETE] Error batch deleting projects:", err);
      res.status(500).json({ error: "Failed to batch delete projects", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    const projectId = req.params.id;
    console.log(`[DELETE] Request received for project ID: ${projectId}`);
    try {
      const transaction = db.transaction((id) => {
        console.log(`[DELETE] Deleting items for project ${id}`);
        db.prepare("DELETE FROM project_items WHERE project_id = ?").run(id);
        console.log(`[DELETE] Deleting logs for project ${id}`);
        db.prepare("DELETE FROM project_logs WHERE project_id = ?").run(id);
        console.log(`[DELETE] Deleting project ${id}`);
        const info = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
        console.log(`[DELETE] Project deleted. Rows affected: ${info.changes}`);
        return info.changes;
      });
      const changes = transaction(projectId);
      if (changes === 0) {
        console.warn(`[DELETE] No project found with ID: ${projectId}`);
      }
      res.json({ success: true, deleted: changes > 0 });
    } catch (err) {
      console.error(`[DELETE] Error deleting project ${projectId}:`, err);
      res.status(500).json({ error: "Failed to delete project", details: err instanceof Error ? err.message : String(err) });
    }
  });

  app.patch("/api/projects/:id", (req, res) => {
    try {
      const { 
        project_code, title, department, budget_amount, budget_source, expense_category,
        project_nature, necessity_reason, material_usage_date, allocated_budget, procured_amount,
        dept_head_name, dept_head_position, deputy_name, deputy_position,
        in_plan, request_amount, remaining_budget, status, fiscal_year
      } = req.body;
      db.prepare(`
        UPDATE projects 
        SET project_code = COALESCE(?, project_code),
            title = COALESCE(?, title),
            department = COALESCE(?, department),
            budget_amount = COALESCE(?, budget_amount),
            budget_source = COALESCE(?, budget_source),
            expense_category = COALESCE(?, expense_category),
            project_nature = COALESCE(?, project_nature),
            necessity_reason = COALESCE(?, necessity_reason),
            material_usage_date = COALESCE(?, material_usage_date),
            allocated_budget = COALESCE(?, allocated_budget),
            procured_amount = COALESCE(?, procured_amount),
            dept_head_name = COALESCE(?, dept_head_name),
            dept_head_position = COALESCE(?, dept_head_position),
            deputy_name = COALESCE(?, deputy_name),
            deputy_position = COALESCE(?, deputy_position),
            in_plan = COALESCE(?, in_plan),
            request_amount = COALESCE(?, request_amount),
            remaining_budget = COALESCE(?, remaining_budget),
            status = COALESCE(?, status),
            fiscal_year = COALESCE(?, fiscal_year),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        project_code !== undefined ? project_code : null,
        title !== undefined ? title : null,
        department !== undefined ? department : null,
        budget_amount !== undefined ? budget_amount : null,
        budget_source !== undefined ? budget_source : null,
        expense_category !== undefined ? expense_category : null,
        project_nature !== undefined ? project_nature : null,
        necessity_reason !== undefined ? necessity_reason : null,
        material_usage_date !== undefined ? material_usage_date : null,
        allocated_budget !== undefined ? allocated_budget : null,
        procured_amount !== undefined ? procured_amount : null,
        dept_head_name !== undefined ? dept_head_name : null,
        dept_head_position !== undefined ? dept_head_position : null,
        deputy_name !== undefined ? deputy_name : null,
        deputy_position !== undefined ? deputy_position : null,
        in_plan !== undefined ? in_plan : null,
        request_amount !== undefined ? request_amount : null,
        remaining_budget !== undefined ? remaining_budget : null,
        status !== undefined ? status : null,
        fiscal_year !== undefined ? fiscal_year : null,
        req.params.id
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to update project:", err);
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  // Dedicated route: Set Allocated Budget (งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ)
  app.patch("/api/projects/:id/allocated-budget", (req, res) => {
    try {
      const { 
        allocated_budget, 
        budget_source, 
        expense_category, 
        in_plan, 
        actor_name, 
        notes 
      } = req.body;
      const projectId = req.params.id;
      const parsedAllocated = Number(allocated_budget);

      if (isNaN(parsedAllocated) || parsedAllocated < 0) {
        return res.status(400).json({ error: "จำนวนงบประมาณที่ได้รับจัดสรรไม่ถูกต้อง" });
      }

      const proj: any = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
      if (!proj) {
        return res.status(404).json({ error: "ไม่พบข้อมูลโครงการ" });
      }

      // If request_amount was already set or requested, compute remaining_budget
      const currentReq = proj.request_amount !== null && proj.request_amount !== undefined ? proj.request_amount : parsedAllocated;
      const remaining = parsedAllocated - currentReq;

      db.prepare(`
        UPDATE projects
        SET allocated_budget = ?,
            remaining_budget = ?,
            budget_source = COALESCE(?, budget_source),
            expense_category = COALESCE(?, expense_category),
            in_plan = COALESCE(?, in_plan),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        parsedAllocated,
        remaining >= 0 ? remaining : 0,
        budget_source || null,
        expense_category || null,
        in_plan || null,
        projectId
      );

      // Log action: งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ กำหนดงบประมาณที่ได้รับจัดสรร
      db.prepare(`
        INSERT INTO project_logs (project_id, process, step, action, actor, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        projectId,
        proj.current_process || 'A',
        proj.current_step || 1,
        'กำหนดงบประมาณที่ได้รับจัดสรร',
        actor_name || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
        `กำหนดงบประมาณที่ได้รับจัดสรรเป็น ฿${parsedAllocated.toLocaleString()} บาท${notes ? ` (${notes})` : ''}`
      );

      res.json({ success: true, allocated_budget: parsedAllocated });
    } catch (err: any) {
      console.error("Error setting allocated budget:", err);
      res.status(500).json({ error: "Failed to set allocated budget", details: err?.message });
    }
  });

  // Budget Source Routes with Statistics for Planning Department
  app.get("/api/budget-sources", (req, res) => {
    try {
      const { fiscal_year } = req.query;
      let sql = `
        SELECT 
          bs.id,
          bs.name,
          bs.code,
          COALESCE(bs.fiscal_year, '2568') as fiscal_year,
          COALESCE((SELECT SUM(amount) FROM budget_source_allocations WHERE budget_source_id = bs.id), bs.total_budget, 0) as total_budget,
          COALESCE((SELECT COUNT(*) FROM budget_source_allocations WHERE budget_source_id = bs.id), 0) as allocations_count,
          bs.category,
          bs.description,
          bs.updated_at,
          COALESCE(SUM(CASE WHEN p.id IS NOT NULL AND p.status != 'completed' AND NOT (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26) THEN p.budget_amount ELSE 0 END), 0) as committed_amount,
          COALESCE(SUM(CASE WHEN p.id IS NOT NULL AND (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) THEN p.budget_amount ELSE 0 END), 0) as disbursed_amount,
          COUNT(DISTINCT p.id) as project_count
        FROM budget_sources bs
        LEFT JOIN projects p ON p.budget_source = bs.name
      `;
      const params: any[] = [];
      if (fiscal_year && fiscal_year !== 'all') {
        sql += ` WHERE bs.fiscal_year = ?`;
        params.push(fiscal_year);
      }
      sql += ` GROUP BY bs.id ORDER BY bs.fiscal_year DESC, bs.id ASC`;

      const sources = db.prepare(sql).all(...params).map((s: any) => {
        const total_used = (s.committed_amount || 0) + (s.disbursed_amount || 0);
        const remaining_budget = (s.total_budget || 0) - total_used;
        const used_percentage = s.total_budget > 0 ? (total_used / s.total_budget) * 100 : 0;
        return {
          ...s,
          total_used,
          remaining_budget,
          used_percentage: Math.min(100, Math.round(used_percentage * 100) / 100)
        };
      });

      res.json(sources);
    } catch (err) {
      console.error("Error fetching budget sources with stats:", err);
      res.status(500).json({ error: "Failed to fetch budget sources" });
    }
  });

  app.post("/api/budget-sources", (req, res) => {
    const { name, code, fiscal_year, total_budget, category, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "กรุณาระบุชื่อแหล่งงบประมาณ" });
    }
    try {
      const parsedBudget = Number(total_budget) || 0;
      const info = db.prepare(`
        INSERT INTO budget_sources (name, code, fiscal_year, total_budget, category, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        name.trim(),
        code ? code.trim() : null,
        fiscal_year ? String(fiscal_year).trim() : '2568',
        parsedBudget,
        category ? category.trim() : null,
        description ? description.trim() : null
      );

      const newId = info.lastInsertRowid;
      if (parsedBudget > 0) {
        db.prepare(`
          INSERT INTO budget_source_allocations (budget_source_id, installment_no, title, amount, allocation_date, doc_ref, notes)
          VALUES (?, 1, 'จัดสรรครั้งที่ 1 (ตั้งต้น)', ?, ?, 'หนังสือจัดสรรเริ่มต้น', 'วงเงินจัดสรรเริ่มต้น')
        `).run(newId, parsedBudget, new Date().toISOString().split('T')[0]);
      }

      res.json({ id: newId, success: true });
    } catch (err: any) {
      console.error("Failed to add budget source:", err);
      if (err.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "ชื่อแหล่งงบประมาณนี้มีอยู่ในระบบแล้ว" });
      } else {
        res.status(500).json({ error: "Failed to add budget source" });
      }
    }
  });

  // Budget Source Allocations Routes (Multi-installment allocation)
  app.get("/api/budget-sources/:id/allocations", (req, res) => {
    try {
      const source = db.prepare("SELECT * FROM budget_sources WHERE id = ?").get(req.params.id) as any;
      if (!source) return res.status(404).json({ error: "ไม่พบแหล่งงบประมาณ" });
      const allocations = db.prepare(`
        SELECT * FROM budget_source_allocations 
        WHERE budget_source_id = ? 
        ORDER BY installment_no ASC, id ASC
      `).all(req.params.id);
      res.json(allocations);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch budget allocations" });
    }
  });

  app.post("/api/budget-sources/:id/allocations", (req, res) => {
    try {
      const sourceId = req.params.id;
      const source = db.prepare("SELECT * FROM budget_sources WHERE id = ?").get(sourceId) as any;
      if (!source) return res.status(404).json({ error: "ไม่พบแหล่งงบประมาณ" });

      const { installment_no, title, amount, allocation_date, doc_ref, notes, created_by } = req.body;
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "กรุณาระบุจำนวนเงินที่ได้รับจัดสรรมากกว่า 0 บาท" });
      }

      let instNo = installment_no ? Number(installment_no) : null;
      if (!instNo) {
        const last = db.prepare("SELECT MAX(installment_no) as max_no FROM budget_source_allocations WHERE budget_source_id = ?").get(sourceId) as any;
        instNo = (last?.max_no || 0) + 1;
      }

      const defaultTitle = title && title.trim() ? title.trim() : `${source.name} จัดสรรครั้งที่ ${instNo}`;

      const info = db.prepare(`
        INSERT INTO budget_source_allocations (budget_source_id, installment_no, title, amount, allocation_date, doc_ref, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sourceId,
        instNo,
        defaultTitle,
        parsedAmount,
        allocation_date || new Date().toISOString().split('T')[0],
        doc_ref ? doc_ref.trim() : null,
        notes ? notes.trim() : null,
        created_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'
      );

      // Recalculate total_budget on parent
      const sumRes = db.prepare("SELECT SUM(amount) as total FROM budget_source_allocations WHERE budget_source_id = ?").get(sourceId) as any;
      const newTotal = sumRes?.total || parsedAmount;
      db.prepare("UPDATE budget_sources SET total_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newTotal, sourceId);

      res.json({
        success: true,
        id: info.lastInsertRowid,
        installment_no: instNo,
        total_budget: newTotal,
        message: `บันทึกการจัดสรรงบประมาณ "${defaultTitle}" จำนวน ฿${parsedAmount.toLocaleString()} บาท เรียบร้อยแล้ว (วงเงินรวมสะสม ฿${newTotal.toLocaleString()} บาท)`
      });
    } catch (err: any) {
      console.error("Error adding budget allocation:", err);
      res.status(500).json({ error: "Failed to add budget allocation" });
    }
  });

  app.put("/api/budget-sources/:id/allocations/:allocId", (req, res) => {
    try {
      const { id, allocId } = req.params;
      const { installment_no, title, amount, allocation_date, doc_ref, notes } = req.body;
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "กรุณาระบุจำนวนเงินที่ได้รับจัดสรรมากกว่า 0 บาท" });
      }

      db.prepare(`
        UPDATE budget_source_allocations
        SET installment_no = COALESCE(?, installment_no),
            title = COALESCE(?, title),
            amount = ?,
            allocation_date = COALESCE(?, allocation_date),
            doc_ref = ?,
            notes = ?
        WHERE id = ? AND budget_source_id = ?
      `).run(
        installment_no ? Number(installment_no) : null,
        title ? title.trim() : null,
        parsedAmount,
        allocation_date || null,
        doc_ref !== undefined ? (doc_ref ? doc_ref.trim() : null) : null,
        notes !== undefined ? (notes ? notes.trim() : null) : null,
        allocId,
        id
      );

      // Recalculate total_budget
      const sumRes = db.prepare("SELECT SUM(amount) as total FROM budget_source_allocations WHERE budget_source_id = ?").get(id) as any;
      const newTotal = sumRes?.total || 0;
      db.prepare("UPDATE budget_sources SET total_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newTotal, id);

      res.json({ success: true, total_budget: newTotal });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to update allocation" });
    }
  });

  app.delete("/api/budget-sources/:id/allocations/:allocId", (req, res) => {
    try {
      const { id, allocId } = req.params;
      db.prepare("DELETE FROM budget_source_allocations WHERE id = ? AND budget_source_id = ?").run(allocId, id);

      // Recalculate total_budget
      const sumRes = db.prepare("SELECT SUM(amount) as total FROM budget_source_allocations WHERE budget_source_id = ?").get(id) as any;
      const newTotal = sumRes?.total || 0;
      db.prepare("UPDATE budget_sources SET total_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newTotal, id);

      res.json({ success: true, total_budget: newTotal });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete allocation" });
    }
  });

  app.put("/api/budget-sources/:id", (req, res) => {
    const { name, code, fiscal_year, total_budget, category, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "กรุณาระบุชื่อแหล่งงบประมาณ" });
    }
    try {
      // If name changed, update projects that reference old name
      const existing = db.prepare("SELECT name FROM budget_sources WHERE id = ?").get(req.params.id) as any;
      if (existing && existing.name !== name.trim()) {
        db.prepare("UPDATE projects SET budget_source = ? WHERE budget_source = ?").run(name.trim(), existing.name);
      }

      db.prepare(`
        UPDATE budget_sources 
        SET name = ?, code = ?, fiscal_year = ?, total_budget = ?, category = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name.trim(),
        code ? code.trim() : null,
        fiscal_year ? String(fiscal_year).trim() : '2568',
        Number(total_budget) || 0,
        category ? category.trim() : null,
        description ? description.trim() : null,
        req.params.id
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("Failed to update budget source:", err);
      if (err.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "ชื่อแหล่งงบประมาณนี้มีอยู่ในระบบแล้ว" });
      } else {
        res.status(500).json({ error: "Failed to update budget source" });
      }
    }
  });

  app.delete("/api/budget-sources/:id", (req, res) => {
    try {
      const source = db.prepare("SELECT name FROM budget_sources WHERE id = ?").get(req.params.id) as any;
      if (source) {
        const countRes = db.prepare("SELECT COUNT(*) as count FROM projects WHERE budget_source = ?").get(source.name) as any;
        if (countRes && countRes.count > 0) {
          return res.status(400).json({ 
            error: `ไม่สามารถลบแหล่งงบประมาณ "${source.name}" ได้ เนื่องจากมีโครงการที่ผูกกับแหล่งเงินนี้อยู่ ${countRes.count} โครงการ` 
          });
        }
      }
      db.prepare("DELETE FROM budget_sources WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete budget source:", err);
      res.status(500).json({ error: "Failed to delete budget source" });
    }
  });

  app.get("/api/budget-sources/:id/projects", (req, res) => {
    try {
      const source = db.prepare("SELECT * FROM budget_sources WHERE id = ?").get(req.params.id) as any;
      if (!source) {
        return res.status(404).json({ error: "ไม่พบแหล่งงบประมาณ" });
      }
      const projects = db.prepare(`
        SELECT p.*, 
               (SELECT COUNT(*) FROM project_items pi WHERE pi.project_id = p.id) as item_count
        FROM projects p
        WHERE p.budget_source = ?
        ORDER BY p.updated_at DESC
      `).all(source.name);
      res.json({ source, projects });
    } catch (err) {
      console.error("Failed to fetch projects for budget source:", err);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Departmental Budget Summary for Planning
  app.get("/api/budget-departments-summary", (req, res) => {
    try {
      const { fiscal_year } = req.query;
      const departments = db.prepare(`
        SELECT 
          p.department,
          COUNT(p.id) as project_count,
          SUM(p.budget_amount) as total_requested,
          SUM(CASE WHEN (p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26)) THEN p.budget_amount ELSE 0 END) as total_disbursed,
          SUM(CASE WHEN p.status != 'completed' AND NOT (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26) THEN p.budget_amount ELSE 0 END) as total_committed,
          COUNT(CASE WHEN p.status = 'completed' OR (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26) THEN 1 END) as completed_count,
          COUNT(CASE WHEN p.status != 'completed' AND NOT (p.is_loan = 1 AND p.current_process = 'D' AND p.current_step = 26) THEN 1 END) as pending_count
        FROM projects p
        WHERE p.department IS NOT NULL AND p.department != ''
        GROUP BY p.department
        ORDER BY total_requested DESC
      `).all();
      res.json(departments);
    } catch (err) {
      console.error("Failed to fetch department summary:", err);
      res.status(500).json({ error: "Failed to fetch department summary" });
    }
  });


  // Expense Category Routes with Budget Allocation & Deductions for Strategic Planning Department
  app.get("/api/expense-categories", (req, res) => {
    try {
      const { fiscal_year } = req.query;
      let sql = `
        SELECT 
          ec.id,
          ec.name,
          ec.code,
          COALESCE(ec.fiscal_year, '2568') as fiscal_year,
          COALESCE((SELECT SUM(amount) FROM expense_category_allocations WHERE category_id = ec.id), ec.allocated_budget, 0) as allocated_budget,
          COALESCE((SELECT COUNT(*) FROM expense_category_allocations WHERE category_id = ec.id), 0) as allocations_count,
          ec.description,
          ec.updated_at,
          ec.updated_by,
          (
            SELECT COUNT(DISTINCT p.id) 
            FROM projects p 
            WHERE (p.expense_category = ec.name OR (p.is_loan = 1 AND p.loan_expense_category = ec.name))
          ) as project_count,
          (
            SELECT COUNT(pi.id) 
            FROM project_items pi 
            JOIN projects p ON pi.project_id = p.id 
            WHERE (p.expense_category = ec.name OR (p.is_loan = 1 AND p.loan_expense_category = ec.name))
          ) as item_count,
          (
            SELECT COALESCE(SUM(
              CASE 
                WHEN (SELECT COUNT(*) FROM project_items WHERE project_id = p.id) > 0 
                THEN (SELECT SUM(total_price) FROM project_items WHERE project_id = p.id)
                ELSE p.budget_amount 
              END
            ), 0)
            FROM projects p
            WHERE (p.expense_category = ec.name OR (p.is_loan = 1 AND p.loan_expense_category = ec.name))
          ) as total_spent
        FROM expense_categories ec
      `;
      const params: any[] = [];
      if (fiscal_year && fiscal_year !== 'all') {
        sql += ` WHERE ec.fiscal_year = ?`;
        params.push(String(fiscal_year));
      }
      sql += ` ORDER BY ec.fiscal_year DESC, ec.id ASC`;

      const categories = db.prepare(sql).all(...params).map((c: any) => {
        const allocated = Number(c.allocated_budget) || 0;
        const spent = Number(c.total_spent) || 0;
        const remaining = allocated - spent;
        const usedPercentage = allocated > 0 ? (spent / allocated) * 100 : 0;
        return {
          ...c,
          allocated_budget: allocated,
          total_spent: spent,
          remaining_budget: remaining,
          used_percentage: Math.min(100, Math.round(usedPercentage * 10) / 10)
        };
      });

      res.json(categories);
    } catch (err) {
      console.error("Error fetching expense categories with budget stats:", err);
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  // Get single expense category with detailed projects and purchased goods
  app.get("/api/expense-categories/:id/details", (req, res) => {
    try {
      const category = db.prepare(`
        SELECT 
          ec.id,
          ec.name,
          ec.code,
          COALESCE(ec.fiscal_year, '2568') as fiscal_year,
          COALESCE((SELECT SUM(amount) FROM expense_category_allocations WHERE category_id = ec.id), ec.allocated_budget, 0) as allocated_budget,
          COALESCE((SELECT COUNT(*) FROM expense_category_allocations WHERE category_id = ec.id), 0) as allocations_count,
          ec.description,
          ec.updated_at,
          ec.updated_by
        FROM expense_categories ec
        WHERE ec.id = ?
      `).get(req.params.id) as any;

      if (!category) {
        return res.status(404).json({ error: "ไม่พบข้อมูลหมวดค่าใช้จ่าย" });
      }

      // Projects under this category
      const projects = db.prepare(`
        SELECT 
          p.id,
          p.project_code,
          p.title,
          p.department,
          p.budget_amount,
          p.allocated_budget,
          p.current_process,
          p.current_step,
          p.status,
          p.created_at,
          p.updated_at,
          (SELECT COUNT(*) FROM project_items WHERE project_id = p.id) as item_count,
          (
            CASE 
              WHEN (SELECT COUNT(*) FROM project_items WHERE project_id = p.id) > 0 
              THEN (SELECT COALESCE(SUM(total_price), 0) FROM project_items WHERE project_id = p.id)
              ELSE p.budget_amount 
            END
          ) as spent_amount
        FROM projects p
        WHERE (p.expense_category = ? OR (p.is_loan = 1 AND p.loan_expense_category = ?))
        ORDER BY p.updated_at DESC
      `).all(category.name, category.name);

      // Purchased items (สินค้า/พัสดุ) under this category
      const items = db.prepare(`
        SELECT 
          pi.id,
          pi.project_id,
          p.title as project_title,
          p.project_code,
          p.department,
          pi.description,
          pi.unit,
          pi.quantity,
          pi.unit_price,
          pi.total_price,
          pi.shop_name
        FROM project_items pi
        JOIN projects p ON pi.project_id = p.id
        WHERE (p.expense_category = ? OR (p.is_loan = 1 AND p.loan_expense_category = ?))
        ORDER BY pi.id DESC
      `).all(category.name, category.name);

      const totalSpent = projects.reduce((sum: number, p: any) => sum + (Number(p.spent_amount) || 0), 0);
      const allocated = Number(category.allocated_budget) || 0;
      const remaining = allocated - totalSpent;
      const usedPercentage = allocated > 0 ? (totalSpent / allocated) * 100 : 0;

      res.json({
        category: {
          ...category,
          allocated_budget: allocated,
          total_spent: totalSpent,
          remaining_budget: remaining,
          used_percentage: Math.min(100, Math.round(usedPercentage * 10) / 10),
          project_count: projects.length,
          item_count: items.length
        },
        projects,
        items
      });
    } catch (err) {
      console.error("Error fetching expense category details:", err);
      res.status(500).json({ error: "Failed to fetch expense category details" });
    }
  });

  app.post("/api/expense-categories", (req, res) => {
    const { name, code, fiscal_year, allocated_budget, description, updated_by } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "กรุณาระบุชื่อหมวดค่าใช้จ่าย" });
    }
    try {
      const parsedAllocated = Number(allocated_budget) || 0;
      const info = db.prepare(`
        INSERT INTO expense_categories (name, code, fiscal_year, allocated_budget, description, updated_at, updated_by)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).run(
        name.trim(),
        code ? code.trim() : null,
        fiscal_year ? String(fiscal_year).trim() : '2568',
        parsedAllocated,
        description ? description.trim() : null,
        updated_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'
      );
      const newId = info.lastInsertRowid;

      if (parsedAllocated > 0) {
        db.prepare(`
          INSERT INTO expense_category_allocations (category_id, installment_no, title, amount, allocation_date, doc_ref, notes, created_by)
          VALUES (?, 1, 'จัดสรรครั้งที่ 1 (ตั้งต้น)', ?, ?, 'หนังสือจัดสรรเริ่มต้น', 'วงเงินจัดสรรเริ่มต้น', ?)
        `).run(
          newId,
          parsedAllocated,
          new Date().toISOString().split('T')[0],
          updated_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'
        );
      }

      res.json({ 
        id: newId, 
        name: name.trim(),
        code: code ? code.trim() : null,
        fiscal_year: fiscal_year ? String(fiscal_year).trim() : '2568',
        allocated_budget: parsedAllocated,
        success: true 
      });
    } catch (err: any) {
      console.error("Error adding expense category:", err);
      if (err.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "ชื่อหมวดค่าใช้จ่ายนี้มีอยู่ในระบบแล้ว" });
      } else {
        res.status(500).json({ error: "Failed to add expense category" });
      }
    }
  });

  // Expense Category Allocations Routes (Multi-installment allocation)
  app.get("/api/expense-categories/:id/allocations", (req, res) => {
    try {
      const category = db.prepare("SELECT * FROM expense_categories WHERE id = ?").get(req.params.id) as any;
      if (!category) return res.status(404).json({ error: "ไม่พบหมวดค่าใช้จ่าย" });
      const allocations = db.prepare(`
        SELECT * FROM expense_category_allocations 
        WHERE category_id = ? 
        ORDER BY installment_no ASC, id ASC
      `).all(req.params.id);
      res.json(allocations);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch expense category allocations" });
    }
  });

  app.post("/api/expense-categories/:id/allocations", (req, res) => {
    try {
      const catId = req.params.id;
      const category = db.prepare("SELECT * FROM expense_categories WHERE id = ?").get(catId) as any;
      if (!category) return res.status(404).json({ error: "ไม่พบหมวดค่าใช้จ่าย" });

      const { installment_no, title, amount, allocation_date, doc_ref, notes, created_by } = req.body;
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "กรุณาระบุจำนวนเงินที่ได้รับจัดสรรมากกว่า 0 บาท" });
      }

      let instNo = installment_no ? Number(installment_no) : null;
      if (!instNo) {
        const last = db.prepare("SELECT MAX(installment_no) as max_no FROM expense_category_allocations WHERE category_id = ?").get(catId) as any;
        instNo = (last?.max_no || 0) + 1;
      }

      const defaultTitle = title && title.trim() ? title.trim() : `${category.name} จัดสรรครั้งที่ ${instNo}`;

      const info = db.prepare(`
        INSERT INTO expense_category_allocations (category_id, installment_no, title, amount, allocation_date, doc_ref, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        catId,
        instNo,
        defaultTitle,
        parsedAmount,
        allocation_date || new Date().toISOString().split('T')[0],
        doc_ref ? doc_ref.trim() : null,
        notes ? notes.trim() : null,
        created_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'
      );

      // Recalculate allocated_budget on parent
      const sumRes = db.prepare("SELECT SUM(amount) as total FROM expense_category_allocations WHERE category_id = ?").get(catId) as any;
      const newTotal = sumRes?.total || parsedAmount;
      db.prepare("UPDATE expense_categories SET allocated_budget = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?").run(
        newTotal,
        created_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
        catId
      );

      res.json({
        success: true,
        id: info.lastInsertRowid,
        installment_no: instNo,
        allocated_budget: newTotal,
        message: `บันทึกการจัดสรรหมวด "${defaultTitle}" จำนวน ฿${parsedAmount.toLocaleString()} บาท เรียบร้อยแล้ว (วงเงินรวมสะสม ฿${newTotal.toLocaleString()} บาท)`
      });
    } catch (err: any) {
      console.error("Error adding expense category allocation:", err);
      res.status(500).json({ error: "Failed to add expense category allocation" });
    }
  });

  app.put("/api/expense-categories/:id/allocations/:allocId", (req, res) => {
    try {
      const { id, allocId } = req.params;
      const { installment_no, title, amount, allocation_date, doc_ref, notes, updated_by } = req.body;
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "กรุณาระบุจำนวนเงินที่ได้รับจัดสรรมากกว่า 0 บาท" });
      }

      db.prepare(`
        UPDATE expense_category_allocations
        SET installment_no = COALESCE(?, installment_no),
            title = COALESCE(?, title),
            amount = ?,
            allocation_date = COALESCE(?, allocation_date),
            doc_ref = ?,
            notes = ?
        WHERE id = ? AND category_id = ?
      `).run(
        installment_no ? Number(installment_no) : null,
        title ? title.trim() : null,
        parsedAmount,
        allocation_date || null,
        doc_ref !== undefined ? (doc_ref ? doc_ref.trim() : null) : null,
        notes !== undefined ? (notes ? notes.trim() : null) : null,
        allocId,
        id
      );

      // Recalculate allocated_budget
      const sumRes = db.prepare("SELECT SUM(amount) as total FROM expense_category_allocations WHERE category_id = ?").get(id) as any;
      const newTotal = sumRes?.total || 0;
      db.prepare("UPDATE expense_categories SET allocated_budget = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?").run(
        newTotal,
        updated_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
        id
      );

      res.json({ success: true, allocated_budget: newTotal });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to update expense category allocation" });
    }
  });

  app.delete("/api/expense-categories/:id/allocations/:allocId", (req, res) => {
    try {
      const { id, allocId } = req.params;
      db.prepare("DELETE FROM expense_category_allocations WHERE id = ? AND category_id = ?").run(allocId, id);

      // Recalculate allocated_budget
      const sumRes = db.prepare("SELECT SUM(amount) as total FROM expense_category_allocations WHERE category_id = ?").get(id) as any;
      const newTotal = sumRes?.total || 0;
      db.prepare("UPDATE expense_categories SET allocated_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newTotal, id);

      res.json({ success: true, allocated_budget: newTotal });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete expense category allocation" });
    }
  });

  app.put("/api/expense-categories/:id", (req, res) => {
    const { name, code, fiscal_year, allocated_budget, description, updated_by } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "กรุณาระบุชื่อหมวดค่าใช้จ่าย" });
    }
    try {
      const existing = db.prepare("SELECT name FROM expense_categories WHERE id = ?").get(req.params.id) as any;
      if (!existing) {
        return res.status(404).json({ error: "ไม่พบหมวดค่าใช้จ่ายที่ต้องการแก้ไข" });
      }

      // If name changed, update projects referencing old name
      if (existing.name !== name.trim()) {
        db.prepare("UPDATE projects SET expense_category = ? WHERE expense_category = ?").run(name.trim(), existing.name);
        db.prepare("UPDATE projects SET loan_expense_category = ? WHERE loan_expense_category = ?").run(name.trim(), existing.name);
      }

      const parsedAllocated = Number(allocated_budget) || 0;
      db.prepare(`
        UPDATE expense_categories 
        SET name = ?, code = ?, fiscal_year = ?, allocated_budget = ?, description = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
        WHERE id = ?
      `).run(
        name.trim(),
        code ? code.trim() : null,
        fiscal_year ? String(fiscal_year).trim() : '2568',
        parsedAllocated,
        description ? description.trim() : null,
        updated_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
        req.params.id
      );

      res.json({ success: true, allocated_budget: parsedAllocated });
    } catch (err: any) {
      console.error("Error updating expense category:", err);
      if (err.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: "ชื่อหมวดค่าใช้จ่ายนี้มีอยู่ในระบบแล้ว" });
      } else {
        res.status(500).json({ error: "Failed to update expense category" });
      }
    }
  });

  // Dedicated route for Strategic Planning Dept to set/update allocated budget for an expense category
  app.patch("/api/expense-categories/:id/allocated-budget", (req, res) => {
    const { allocated_budget, notes, updated_by } = req.body;
    const catId = req.params.id;

    if (allocated_budget === undefined || allocated_budget === null || isNaN(parseFloat(allocated_budget))) {
      return res.status(400).json({ error: "กรุณาระบุจำนวนงบประมาณที่ได้รับจัดสรรที่ถูกต้อง" });
    }

    try {
      const cat = db.prepare("SELECT * FROM expense_categories WHERE id = ?").get(catId) as any;
      if (!cat) {
        return res.status(404).json({ error: "ไม่พบหมวดค่าใช้จ่าย" });
      }

      const parsedAllocated = parseFloat(allocated_budget);
      db.prepare(`
        UPDATE expense_categories 
        SET allocated_budget = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
        WHERE id = ?
      `).run(
        parsedAllocated,
        updated_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
        catId
      );

      res.json({ 
        success: true, 
        id: catId,
        allocated_budget: parsedAllocated,
        message: `บันทึกงบประมาณจัดสรรหมวด ${cat.name} จำนวน ฿${parsedAllocated.toLocaleString()} บาท เรียบร้อยแล้ว`
      });
    } catch (err: any) {
      console.error("Error setting category allocated budget:", err);
      res.status(500).json({ error: "Failed to set category allocated budget" });
    }
  });

  app.delete("/api/expense-categories/:id", (req, res) => {
    try {
      const cat = db.prepare("SELECT name FROM expense_categories WHERE id = ?").get(req.params.id) as any;
      if (cat) {
        const count = db.prepare(`
          SELECT COUNT(*) as count FROM projects 
          WHERE (expense_category = ? OR (is_loan = 1 AND loan_expense_category = ?))
        `).get(cat.name, cat.name) as any;
        if (count && count.count > 0) {
          return res.status(400).json({ 
            error: `ไม่สามารถลบหมวดค่าใช้จ่าย "${cat.name}" ได้ เนื่องจากมี ${count.count} โครงการที่กำลังใช้งานหมวดนี้อยู่` 
          });
        }
      }
      db.prepare("DELETE FROM expense_categories WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting expense category:", err);
      res.status(500).json({ error: "Failed to delete expense category" });
    }
  });

  // Catch-all 404 handler for API routes to guarantee JSON response
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const isHmrDisabled = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : undefined,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicit fallback for SPA in development if vite.middlewares doesn't catch it
    app.use("*", async (req, res, next) => {
      if (req.originalUrl.startsWith("/api")) {
        return next();
      }
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
