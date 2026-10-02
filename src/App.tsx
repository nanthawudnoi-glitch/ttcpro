import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Plus, 
  PlusCircle,
  Search, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  FileText, 
  LayoutDashboard, 
  Settings,
  ArrowRight,
  User,
  Building2,
  Coins,
  History,
  AlertCircle,
  Lock,
  LogOut,
  List,
  Grid,
  CheckSquare,
  Square,
  TrendingUp,
  PieChart as PieChartIcon,
  Calendar,
  Filter,
  Printer,
  FileDown,
  Database,
  Upload,
  Download,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  X,
  Menu,
  Landmark,
  FolderKanban,
  Zap,
  Receipt,
  Layers,
  KeyRound,
  Copy,
  Check,
  ShieldCheck,
  Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import initialUsersData from './data/initialUsers.json';
import initialVendorsData from './data/initialVendors.json';
import { BudgetDatabaseView } from './components/BudgetDatabaseView';
import { ProjectDatabaseView } from './components/ProjectDatabaseView';
import { FiscalYearManager } from './components/FiscalYearManager';
import { BatchProcessOperations } from './components/BatchProcessOperations';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { format, subDays, startOfMonth, startOfYear, endOfDay } from 'date-fns';
import { Project, PROCESS_STEPS } from './types';
import { safeParseJson, safeDate, formatThaiDate, formatThaiDateTime } from './utils';

type UserRole = 
  | 'ADMIN' 
  | 'PLANNING_STAFF' 
  | 'PLANNING_HEAD' 
  | 'PROCUREMENT_STAFF' 
  | 'PROCUREMENT_HEAD' 
  | 'FINANCE_STAFF' 
  | 'FINANCE_HEAD' 
  | 'DEPUTY_DIRECTOR_PLANNING' 
  | 'DEPUTY_DIRECTOR_RESOURCES' 
  | 'DIRECTOR'
  | 'STAFF' 
  | 'GUEST';

interface User {
  username: string;
  role: UserRole;
  name: string;
  position: string;
  email?: string;
  created_at?: string;
}

interface Vendor {
  id: number;
  name: string;
  address: string;
  phone: string;
  tax_id: string;
  bank_account: string;
  bank_name: string;
  created_at: string;
}

// Helper function to convert number to Thai Baht text
const thaiBaht = (amount: number): string => {
  if (isNaN(amount) || amount === null) return "-";
  if (amount === 0) return "ศูนย์บาทถ้วน";
  
  const thaiNumber = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const thaiUnit = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
  
  const [intPart, decPart] = amount.toFixed(2).split(".");
  
  const convert = (numStr: string) => {
    let res = "";
    for (let i = 0; i < numStr.length; i++) {
      const digit = parseInt(numStr[i]);
      const pos = numStr.length - 1 - i;
      if (digit !== 0) {
        if (pos % 6 === 1 && digit === 1) {
          res += "";
        } else if (pos % 6 === 1 && digit === 2) {
          res += "ยี่";
        } else if (pos % 6 === 0 && digit === 1 && i > 0) {
          res += "เอ็ด";
        } else {
          res += thaiNumber[digit];
        }
        res += thaiUnit[pos % 6];
      }
      if (pos % 6 === 0 && pos > 0 && i < numStr.length - 1) {
        if (!res.endsWith("ล้าน")) res += thaiUnit[6];
      }
    }
    return res;
  };
  
  let result = convert(intPart) + "บาท";
  if (decPart !== "00") {
    result += convert(decPart) + "สตางค์";
  }
  return result;
};

// ตัวช่วยบัญชีทดลองใช้งาน (Demo Accounts for Trial/Testing)
interface DemoAccount {
  category: 'admin' | 'planning' | 'procurement' | 'finance' | 'director' | 'staff';
  role: string;
  roleName: string;
  username: string;
  password: string;
  name: string;
  department: string;
  badge: string;
  badgeColor: string;
  desc: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    category: 'admin',
    role: 'ADMIN',
    roleName: 'ผู้ดูแลระบบ (Admin)',
    username: 'admin',
    password: 'admin123',
    name: 'ผู้ดูแลระบบ',
    department: 'งานศูนย์ข้อมูลและเทคโนโลยีสารสนเทศ',
    badge: 'ผู้ดูแลระบบ',
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
    desc: 'สิทธิ์สูงสุด: จัดการระบบทั้งหมด, กำหนดสิทธิ์ผู้ใช้, จัดสรรงบประมาณ, หมวดค่าใช้จ่าย'
  },
  {
    category: 'planning',
    role: 'PLANNING_STAFF',
    roleName: 'เจ้าหน้าที่งานวางแผน (ยุทธศาสตร์)',
    username: 'plan_staff',
    password: 'password',
    name: 'เจ้าหน้าที่งานวางแผน',
    department: 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
    badge: 'งานยุทธศาสตร์ฯ',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    desc: 'เพิ่มวงเงินงวดที่ 1, 2, 3... (แหล่งงบประมาณ & หมวดค่าใช้จ่าย), ตรวจสอบ Process A (A02)'
  },
  {
    category: 'planning',
    role: 'PLANNING_HEAD',
    roleName: 'หัวหน้างานแผนงานและงบประมาณ',
    username: 'plan_head',
    password: 'password',
    name: 'หัวหน้างานวางแผน',
    department: 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
    badge: 'หัวหน้างานแผน',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    desc: 'กำกับดูแลและตรวจสอบงบประมาณ, ให้ความเห็นชอบโครงการ'
  },
  {
    category: 'procurement',
    role: 'PROCUREMENT_STAFF',
    roleName: 'เจ้าหน้าที่งานพัสดุ',
    username: 'proc_staff',
    password: 'password',
    name: 'เจ้าหน้าที่งานพัสดุ',
    department: 'งานพัสดุ',
    badge: 'งานพัสดุ',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    desc: 'ดำเนินงานจัดซื้อจัดจ้าง Process B (B01-B08), บันทึกร้านค้า, ออกใบสั่งซื้อ'
  },
  {
    category: 'finance',
    role: 'FINANCE_STAFF',
    roleName: 'เจ้าหน้าที่งานการเงิน',
    username: 'fin_staff',
    password: 'password',
    name: 'เจ้าหน้าที่งานการเงิน',
    department: 'งานการเงิน',
    badge: 'งานการเงิน',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    desc: 'ตรวจสอบและดำเนินการเบิกจ่ายเงิน Process C/D, จัดการสัญญายืมเงิน'
  },
  {
    category: 'director',
    role: 'DIRECTOR',
    roleName: 'ผู้อำนวยการวิทยาลัย',
    username: 'director',
    password: 'password',
    name: 'ผู้อำนวยการ',
    department: 'ผู้บริหารสถานศึกษา',
    badge: 'ผู้บริหาร',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    desc: 'อนุมัติโครงการและงบประมาณ, ดูภาพรวมผู้บริหาร (Executive Dashboard)'
  },
  {
    category: 'staff',
    role: 'STAFF',
    roleName: 'บุคลากรทั่วไป (Staff)',
    username: 'staff',
    password: 'password',
    name: 'บุคลากร',
    department: 'แผนกวิชา / งานทั่วไป',
    badge: 'ผู้เสนอโครงการ',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    desc: 'เสนอโครงการขอจัดซื้อวัสดุ/ครุภัณฑ์, ยื่นคำขอยืมเงินทดรองราชการ'
  }
];

// Fallback users mapping for static hosting (e.g., Vercel static deployment where backend /api is unavailable)
const SYSTEM_FALLBACK_USERS: Record<string, { role: string; name: string; position: string; defaultPass: string; email?: string }> = {
  admin: { role: 'ADMIN', name: 'ผู้ดูแลระบบ', position: 'ผู้ดูแลระบบ', defaultPass: 'admin123', email: 'admin@ttc.ac.th' },
  plan_staff: { role: 'PLANNING_STAFF', name: 'เจ้าหน้าที่งานวางแผน', position: 'เจ้าหน้าที่งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ', defaultPass: 'password' },
  plan_head: { role: 'PLANNING_HEAD', name: 'หัวหน้างานวางแผน', position: 'หัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ', defaultPass: 'password' },
  proc_staff: { role: 'PROCUREMENT_STAFF', name: 'เจ้าหน้าที่งานพัสดุ', position: 'เจ้าหน้าที่งานพัสดุ', defaultPass: 'password' },
  proc_head: { role: 'PROCUREMENT_HEAD', name: 'หัวหน้างานพัสดุ', position: 'หัวหน้างานพัสดุ', defaultPass: 'password' },
  fin_staff: { role: 'FINANCE_STAFF', name: 'เจ้าหน้าที่งานการเงิน', position: 'เจ้าหน้าที่งานการเงิน', defaultPass: 'password' },
  fin_head: { role: 'FINANCE_HEAD', name: 'หัวหน้างานการเงิน', position: 'หัวหน้างานการเงิน', defaultPass: 'password' },
  director: { role: 'DIRECTOR', name: 'ผู้อำนวยการ', position: 'ผู้อำนวยการวิทยาลัย', defaultPass: 'password' },
  deputy_plan: { role: 'DEPUTY_DIRECTOR_PLANNING', name: 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน', position: 'รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน', defaultPass: 'password' },
  deputy_res: { role: 'DEPUTY_DIRECTOR_RESOURCES', name: 'นายนันธวุฒิ น้อย', position: 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร', defaultPass: 'password', email: 'nanthawudnoi@gmail.com' },
  staff: { role: 'STAFF', name: 'บุคลากร', position: 'บุคลากร', defaultPass: 'password' },
  guest: { role: 'GUEST', name: 'ผู้เข้าชมทั่วไป', position: 'ผู้เข้าชมทั่วไป', defaultPass: 'password' }
};

// Merge all 203 institutional users into fallback mapping
if (Array.isArray(initialUsersData)) {
  for (const u of initialUsersData as any[]) {
    if (u && u.username) {
      const uKey = String(u.username).trim().toLowerCase();
      SYSTEM_FALLBACK_USERS[uKey] = {
        role: u.role || 'STAFF',
        name: u.name || u.username,
        position: u.position || 'บุคลากร',
        defaultPass: u.password || u.username,
        email: u.email || undefined
      };
    }
  }
}

const FALLBACK_PROJECTS: Project[] = [
  {
    id: 1,
    project_code: 'PR-68-001',
    title: 'โครงการจัดซื้อวัสดุฝึกสำหรับจัดการเรียนการสอน แผนกวิชาช่างไฟฟ้ากำลัง',
    department: 'แผนกวิชาช่างไฟฟ้ากำลัง',
    budget_amount: 120000,
    budget_source: 'งบประมาณแผ่นดิน',
    expense_category: 'ค่าจัดการเรียนการสอน',
    current_process: 'B',
    current_step: 6,
    status: 'pending',
    creator_name: 'นายสมชาย มุ่งมั่น',
    creator_position: 'ครู ชำนาญการ',
    creator_id: 'staff',
    fiscal_year: '2568',
    allocated_budget: 120000,
    procured_amount: 118500,
    created_at: '2026-09-15 09:30:00',
    updated_at: '2026-09-20 14:20:00'
  },
  {
    id: 2,
    project_code: 'PR-68-002',
    title: 'โครงการจัดซื้อวัสดุสำนักงานและครุภัณฑ์คอมพิวเตอร์',
    department: 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
    budget_amount: 85000,
    budget_source: 'เงินรายได้สถานศึกษา',
    expense_category: 'งบ.ปวช.',
    current_process: 'A',
    current_step: 2,
    status: 'pending',
    creator_name: 'เจ้าหน้าที่งานวางแผน',
    creator_position: 'เจ้าหน้าที่งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
    creator_id: 'plan_staff',
    fiscal_year: '2568',
    allocated_budget: 85000,
    procured_amount: 0,
    created_at: '2026-09-18 10:15:00',
    updated_at: '2026-09-25 11:00:00'
  },
  {
    id: 3,
    project_code: 'PR-68-003',
    title: 'โครงการจัดซื้อวัสดุฝึกอบรมวิชาชีพระยะสั้นสำหรับชุมชน',
    department: 'งานวิชาชีพระยะสั้น',
    budget_amount: 50000,
    budget_source: 'งบประมาณแผ่นดิน',
    expense_category: 'งบ.ระยะสั้น',
    current_process: 'C',
    current_step: 18,
    status: 'pending',
    creator_name: 'นางสมศรี ใจดี',
    creator_position: 'ครู ชำนาญการพิเศษ',
    creator_id: 'staff',
    fiscal_year: '2568',
    allocated_budget: 50000,
    procured_amount: 49200,
    created_at: '2026-09-10 08:45:00',
    updated_at: '2026-09-28 16:30:00'
  }
];

const FALLBACK_BUDGET_SOURCES = [
  { id: 1, name: 'งบประมาณแผ่นดิน', code: '68-GOV-01', fiscal_year: '2568', total_budget: 5000000, allocated_budget: 5000000, allocations_count: 2, category: 'งบประมาณแผ่นดิน', description: 'งบประมาณแผ่นดินประจำปีงบประมาณ พ.ศ. 2568' },
  { id: 2, name: 'เงินรายได้สถานศึกษา', code: '68-REV-01', fiscal_year: '2568', total_budget: 3500000, allocated_budget: 3500000, allocations_count: 1, category: 'เงินรายได้สถานศึกษา', description: 'เงินรายได้สถานศึกษา ประจำปีงบประมาณ พ.ศ. 2568' },
  { id: 3, name: 'งบอุดหนุน', code: '68-SUB-01', fiscal_year: '2568', total_budget: 1500000, allocated_budget: 1500000, allocations_count: 1, category: 'งบอุดหนุน', description: 'เงินอุดหนุนค่าใช้จ่ายในการจัดการศึกษา' }
];

const FALLBACK_EXPENSE_CATEGORIES = [
  { id: 1, name: 'งบ.ปวช.', code: '68-EXP-01', fiscal_year: '2568', allocated_budget: 1600000, allocations_count: 1, total_spent: 18, remaining_budget: 1599982, used_percentage: 0 },
  { id: 2, name: 'งบ.ปวส.', code: '68-EXP-02', fiscal_year: '2568', allocated_budget: 1200000, allocations_count: 1, total_spent: 0, remaining_budget: 1200000, used_percentage: 0 },
  { id: 3, name: 'งบ.ระยะสั้น', code: '68-EXP-03', fiscal_year: '2568', allocated_budget: 400000, allocations_count: 1, total_spent: 0, remaining_budget: 400000, used_percentage: 0 },
  { id: 4, name: 'ค่าจัดการเรียนการสอน', code: '68-EXP-04', fiscal_year: '2568', allocated_budget: 2500000, allocations_count: 1, total_spent: 0, remaining_budget: 2500000, used_percentage: 0 },
  { id: 8, name: 'ค่าสาธารณูปโภค', code: '68-EXP-08', fiscal_year: '2568', allocated_budget: 350000, allocations_count: 2, total_spent: 0, remaining_budget: 350000, used_percentage: 0 }
];

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<'dashboard' | 'projects-db' | 'new' | 'create-project-loan' | 'create-other-expense' | 'detail' | 'users' | 'vendors' | 'budgets' | 'executive' | 'manual' | 'print-a01' | 'print-a02' | 'print-a03' | 'print-b01' | 'print-b02' | 'print-b03' | 'print-b04' | 'print-b05' | 'print-b08' | 'print-c01' | 'print-c02' | 'print-d01' | 'print-d02'>('dashboard');
  const [dashboardTab, setDashboardTab] = useState<'all' | 'mine' | 'A' | 'B' | 'C' | 'D' | 'E'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [printSearchQuery, setPrintSearchQuery] = useState('');
  const [printDateFilter, setPrintDateFilter] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');
  const [otherExpenseForm, setOtherExpenseForm] = useState({
    fiscal_year: '',
    expense_category: '',
    title: '',
    voucher_no: '',
    expense_amount: '',
    vat_amount: '',
    total_amount: '',
    expense_notes: ''
  });
  const [otherExpensePlanningForm, setOtherExpensePlanningForm] = useState({
    budget_source: '',
    expense_category: ''
  });
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('ttc_smartprocure_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isSavingToGit, setIsSavingToGit] = useState(false);
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('ttc_smartprocure_users');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    if (Array.isArray(initialUsersData) && initialUsersData.length > 0) {
      return (initialUsersData as any[]).map(u => ({
        username: u.username,
        role: (u.role || 'STAFF') as UserRole,
        name: u.name || u.username,
        position: u.position || 'บุคลากร',
        email: u.email || undefined
      }));
    }
    return [];
  });
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userForm, setUserForm] = useState<Partial<User & { password?: string }>>({});
  const [showUserModal, setShowUserModal] = useState(false);
  const [budgetSources, setBudgetSources] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [fiscalYears, setFiscalYears] = useState<{year: string, name: string, is_current: boolean | number}[]>([]);
  const [currentFiscalYear, setCurrentFiscalYear] = useState<string>('2568');
  const [dashboardFiscalYear, setDashboardFiscalYear] = useState<string>('2568');
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editProjectForm, setEditProjectForm] = useState<Partial<Project>>({});
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsDateRange, setStatsDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [pendingProjectsList, setPendingProjectsList] = useState<Project[]>([]);
  const [selectedProcessForList, setSelectedProcessForList] = useState<'A' | 'B' | 'C' | null>(null);
  const [shopProjectsList, setShopProjectsList] = useState<Project[]>([]);
  const [selectedShopForList, setSelectedShopForList] = useState<string | null>(null);
  const [departmentProjectsList, setDepartmentProjectsList] = useState<Project[]>([]);
  const [selectedDepartmentForList, setSelectedDepartmentForList] = useState<string | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState<any[]>([]);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState<any[]>([]);
  const [showItemDetailsModal, setShowItemDetailsModal] = useState(false);
  const [isSavingVendorsToGit, setIsSavingVendorsToGit] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>(() => {
    try {
      const saved = localStorage.getItem('ttc_smartprocure_vendors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    if (Array.isArray(initialVendorsData) && initialVendorsData.length > 0) {
      return (initialVendorsData as any[]).map(v => ({
        id: v.id,
        name: v.name,
        address: v.address || '',
        phone: v.phone || '',
        tax_id: v.tax_id || '',
        bank_account: v.bank_account || '',
        bank_name: v.bank_name || ''
      }));
    }
    return [];
  });
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [isEditingVendor, setIsEditingVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState<Partial<Vendor>>({});
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [selectedItemName, setSelectedItemName] = useState('');
  const [manualTab, setManualTab] = useState<'general' | 'planning' | 'procurement' | 'finance'>('general');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigateTo = (newView: any) => {
    if ((newView === 'projects-db' || newView === 'budgets') && (!currentUser || currentUser.role === 'GUEST')) {
      setShowLogin(true);
      return;
    }
    setView(newView);
    setIsMobileMenuOpen(false);
  };

  const handleItemSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSearchQuery.trim()) return;
    setItemSearchLoading(true);
    try {
      const res = await fetch(`/api/stats/items/search?q=${encodeURIComponent(itemSearchQuery)}`);
      const data = await safeParseJson(res);
      if (data) setItemSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setItemSearchLoading(false);
    }
  };

  const fetchItemDetails = async (description: string) => {
    try {
      const res = await fetch(`/api/stats/items/details?description=${encodeURIComponent(description)}`);
      const data = await safeParseJson(res);
      if (data) {
        setSelectedItemDetails(data);
        setSelectedItemName(description);
        setShowItemDetailsModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBackup = () => {
    window.location.href = '/api/admin/backup';
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการคืนค่าฐานข้อมูล? ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมดและระบบจะรีสตาร์ท')) {
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('database', file);

    try {
      const res = await fetch('/api/admin/restore', {
        method: 'POST',
        body: formData,
      });
      const data = (await safeParseJson(res)) || {};
      alert(data.message || data.error);
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการคืนค่าฐานข้อมูล');
    } finally {
      e.target.value = '';
    }
  };

  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);

  const fetchDepartmentProjectsDetail = async (department: string) => {
    try {
      const { startDate, endDate } = statsDateRange;
      const res = await fetch(`/api/stats/department/${encodeURIComponent(department)}?startDate=${startDate}&endDate=${endDate}`);
      const data = await safeParseJson(res);
      if (data) {
        setDepartmentProjectsList(data);
        setSelectedDepartmentForList(department);
        setShowDepartmentModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };
  const [showA01Modal, setShowA01Modal] = useState(false);
  const [showB01Modal, setShowB01Modal] = useState(false);
  const [showB02Modal, setShowB02Modal] = useState(false);
  const [showB03Modal, setShowB03Modal] = useState(false);
  const [showB04Modal, setShowB04Modal] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showA02Modal, setShowA02Modal] = useState(false);
  const [showA03Modal, setShowA03Modal] = useState(false);
  const [showB05Modal, setShowB05Modal] = useState(false);
  const [showB08Modal, setShowB08Modal] = useState(false);
  const [showC01Modal, setShowC01Modal] = useState(false);
  const [showC02Modal, setShowC02Modal] = useState(false);
  const [showD01Modal, setShowD01Modal] = useState(false);
  const [showD02Modal, setShowD02Modal] = useState(false);
  const [selectedShopForB05, setSelectedShopForB05] = useState<string | null>(null);
  const [selectedShopForB08, setSelectedShopForB08] = useState<string | null>(null);
  const [showExecutivePreview, setShowExecutivePreview] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

  const [showLogin, setShowLogin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [demoRoleFilter, setDemoRoleFilter] = useState<'all' | 'admin' | 'planning' | 'procurement' | 'finance' | 'director' | 'staff'>('all');
  const [showDemoAccounts, setShowDemoAccounts] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dashboardViewMode, setDashboardViewMode] = useState<'card' | 'table'>('card');

  // Toast State
  const [toastMessage, setToastMessage] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Delete Project Modals State
  const [projectToDeleteModal, setProjectToDeleteModal] = useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const canDeleteProject = (proj: Project | null | undefined): boolean => {
    if (!proj || !currentUser || userRole === 'GUEST') return false;
    if (['ADMIN', 'PLANNING_STAFF', 'PLANNING_HEAD', 'DEPUTY_DIRECTOR_PLANNING'].includes(userRole)) {
      return true;
    }
    if (
      proj.creator_id === currentUser.username ||
      proj.creator_name === currentUser.name
    ) {
      if (proj.status === 'DRAFT' || proj.current_process === 'A') {
        return true;
      }
    }
    return false;
  };

  const handleLogin = async (e?: React.FormEvent, customCredentials?: { username: string; password?: string }) => {
    if (e) e.preventDefault();
    const creds = customCredentials || loginForm;
    const cleanUser = String(creds.username || '').trim().toLowerCase();
    const cleanPass = String(creds.password || '').trim();

    if (!cleanUser) {
      setLoginError('กรุณาระบุชื่อผู้ใช้งานหรืออีเมล');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds)
      });

      if (res.ok) {
        const user = await safeParseJson(res);
        if (user) {
          setCurrentUser(user);
          try {
            localStorage.setItem('ttc_smartprocure_user', JSON.stringify(user));
          } catch (e) {}
          setLoginError('');
          setShowLogin(false);
          setView('dashboard');
          return;
        }
      }

      // If backend returns 404 (e.g. Vercel static hosting) or invalid response:
      // Check fallback system/demo accounts so users can test seamlessly on any host!
      const fallback = SYSTEM_FALLBACK_USERS[cleanUser];
      if (fallback && (cleanPass === fallback.defaultPass || cleanPass === 'password' || cleanPass === 'admin123' || !cleanPass)) {
        const fallbackUser: User = {
          username: cleanUser,
          role: fallback.role as any,
          name: fallback.name,
          position: fallback.position,
          created_at: new Date().toISOString()
        };
        setCurrentUser(fallbackUser);
        try {
          localStorage.setItem('ttc_smartprocure_user', JSON.stringify(fallbackUser));
        } catch (e) {}
        setLoginError('');
        setShowLogin(false);
        setView('dashboard');
        return;
      }

      const err = await safeParseJson(res);
      if (res.status === 404) {
        setLoginError('ไม่พบ Backend API (/api/login 404) บนโฮสต์นี้ แต่ท่านสามารถกดปุ่ม "เข้าสู่ระบบทันที" จากตัวช่วยด้านขวาได้ครับ');
      } else {
        setLoginError(err?.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      // Network error or offline host:
      const fallback = SYSTEM_FALLBACK_USERS[cleanUser];
      if (fallback && (cleanPass === fallback.defaultPass || cleanPass === 'password' || cleanPass === 'admin123' || !cleanPass)) {
        const fallbackUser: User = {
          username: cleanUser,
          role: fallback.role as any,
          name: fallback.name,
          position: fallback.position,
          created_at: new Date().toISOString()
        };
        setCurrentUser(fallbackUser);
        try {
          localStorage.setItem('ttc_smartprocure_user', JSON.stringify(fallbackUser));
        } catch (e) {}
        setLoginError('');
        setShowLogin(false);
        setView('dashboard');
        return;
      }
      setLoginError('เกิดข้อผิดพลาดในการเชื่อมต่อ (ท่านสามารถกดปุ่ม "เข้าสู่ระบบทันที" จากแถบตัวช่วยได้ครับ)');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('ttc_smartprocure_user');
    } catch (e) {}
    setLoginForm({ username: '', password: '' });
    setView('dashboard');
  };

  const userRole = currentUser?.role || 'GUEST';

  const canEditProcess = (process: 'A' | 'B' | 'C' | 'D' | 'E', step: number, projectCreatorId?: string, projectStatus?: string) => {
    if (userRole === 'ADMIN') return true;
    
    // ผู้สร้างโครงการ (ทุกสิทธิ์ยกเว้น GUEST สามารถแก้ไขโครงการที่ตนเองสร้างได้ในสถานะร่าง หรือขั้นตอนเริ่มต้น)
    if (userRole !== 'GUEST' && projectCreatorId === currentUser?.username) {
      if (projectStatus === 'DRAFT') return true;
      if (process === 'A' && step <= 4) return true;
      if (process === 'D' && [6, 7, 13].includes(step)) return true;
      if (process === 'E' && step === 1) return true;
    }

    // กระบวนการ E (รายการค่าใช้จ่ายอื่น)
    if (process === 'E') {
      if (userRole === 'FINANCE_STAFF') return [1, 4, 10, 11].includes(step);
      if (userRole === 'FINANCE_HEAD') return [1, 2, 4, 10, 11].includes(step);
      if (userRole === 'DEPUTY_DIRECTOR_RESOURCES') return [3].includes(step);
      if (userRole === 'PLANNING_STAFF') return [5, 6].includes(step);
      if (userRole === 'PLANNING_HEAD') return [5, 6, 7].includes(step);
      if (userRole === 'DEPUTY_DIRECTOR_PLANNING') return [8].includes(step);
      if (userRole === 'DIRECTOR') return [9].includes(step);
      return false;
    }

    // งานพัฒนายุทธศาสตร์ฯ
    if (userRole === 'PLANNING_STAFF') {
      return (process === 'A' && [5, 6, 7, 11].includes(step)) || (process === 'B' && [16, 17].includes(step)) || (process === 'D' && step === 21);
    }
    if (userRole === 'PLANNING_HEAD') {
      return process === 'A' && step === 7; // เห็นชอบขั้นตอนที่ 7
    }

    // งานพัสดุ
    if (userRole === 'PROCUREMENT_STAFF') {
      return (process === 'B' && [1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(step)) || (process === 'D' && [1, 2, 3, 4, 5].includes(step));
    }
    if (userRole === 'PROCUREMENT_HEAD') {
      return (process === 'B' && step === 2) || (process === 'D' && step === 3);
    }

    // งานการเงิน
    if (userRole === 'FINANCE_STAFF') {
      return (process === 'C' && [1, 2, 5, 6, 7].includes(step)) || (process === 'D' && [8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 22, 23, 24, 25].includes(step));
    }
    if (userRole === 'FINANCE_HEAD') {
      return (process === 'C' && step === 3) || (process === 'D' && [9, 16].includes(step));
    }

    // รองผู้อำนวยการ
    if (userRole === 'DEPUTY_DIRECTOR_PLANNING') {
      return (process === 'A' && step === 8) || (process === 'D' && step === 22);
    }
    if (userRole === 'DEPUTY_DIRECTOR_RESOURCES') {
      return (process === 'A' && step === 9) || (process === 'B' && step === 3) || (process === 'C' && step === 3) || (process === 'D' && [4, 10, 17, 20].includes(step));
    }

    // ผู้อำนวยการ
    if (userRole === 'DIRECTOR') {
      return (process === 'A' && step === 10) || (process === 'B' && step === 4) || (process === 'C' && step === 4) || (process === 'D' && [5, 11, 18, 23].includes(step));
    }

    return false;
  };

  const canPerformStepRange = (project: Project, targetStep: number) => {
    if (project.current_process !== activeTab) return false;
    if (targetStep < project.current_step) return false;
    if (project.status === 'completed') return false;
    
    for (let i = project.current_step; i <= targetStep; i++) {
      if (!canEditProcess(project.current_process, i, project.creator_id, project.status)) {
        return false;
      }
    }
    return true;
  };

  const availableFiscalYears = React.useMemo(() => {
    const yearsSet = new Set<string>();
    if (currentFiscalYear) yearsSet.add(String(currentFiscalYear));
    fiscalYears.forEach(fy => fy.year && yearsSet.add(String(fy.year)));
    projects.forEach(p => p.fiscal_year && yearsSet.add(String(p.fiscal_year)));
    if (yearsSet.size === 0) yearsSet.add('2568');
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  }, [currentFiscalYear, fiscalYears, projects]);

  const dashboardProjects = React.useMemo(() => {
    if (dashboardFiscalYear === 'all') return projects;
    return projects.filter(p => String(p.fiscal_year || currentFiscalYear || '2568').trim() === String(dashboardFiscalYear).trim());
  }, [projects, dashboardFiscalYear, currentFiscalYear]);

  const filteredProjects = dashboardProjects.filter(p => {
    let matchesTab = false;
    if (dashboardTab === 'all') {
      matchesTab = true;
    } else if (dashboardTab === 'mine') {
      matchesTab = canEditProcess(p.current_process, p.current_step, p.creator_id, p.status);
    } else {
      matchesTab = p.current_process === dashboardTab;
    }

    const matchesSearch = p.title.toLowerCase().includes(activeSearchQuery.toLowerCase()) || 
                          p.id.toString().includes(activeSearchQuery) ||
                          (p.project_code && p.project_code.toLowerCase().includes(activeSearchQuery.toLowerCase())) ||
                          (p.department && p.department.toLowerCase().includes(activeSearchQuery.toLowerCase())) ||
                          (p.item_shops && p.item_shops.toLowerCase().includes(activeSearchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const filteredPrintProjects = projects.filter(p => {
    const query = printSearchQuery.toLowerCase();
    const matchesSearch = p.title.toLowerCase().includes(query) ||
           (p.project_code && p.project_code.toLowerCase().includes(query)) ||
           (p.department && p.department.toLowerCase().includes(query)) ||
           (p.item_shops && p.item_shops.toLowerCase().includes(query)) ||
           p.id.toString().includes(query);
    
    let matchesDate = true;
    if (printDateFilter) {
      // Assuming p.created_at is in a format that starts with YYYY-MM-DD
      matchesDate = p.created_at.startsWith(printDateFilter);
    }
    
    let matchesView = true;
    if (view === 'print-d01' || view === 'print-d02') {
      matchesView = !!p.is_loan;
    } else if (['print-b01', 'print-b02', 'print-b03', 'print-b04', 'print-b05', 'print-b08', 'print-c01', 'print-c02'].includes(view)) {
      matchesView = !p.is_loan;
    }
    
    return matchesSearch && matchesDate && matchesView;
  });

  // Form states
  const [newProject, setNewProject] = useState({
    project_code: '',
    fiscal_year: '2568',
    title: '',
    department: '',
    budget_amount: 0,
    budget_source: '',
    creator_name: '',
    creator_position: '',
    project_nature: '',
    necessity_reason: '',
    material_usage_date: '',
    allocated_budget: 0,
    procured_amount: 0,
    dept_head_name: '',
    dept_head_position: '',
    deputy_name: '',
    deputy_position: '',
    committee_chairman: '',
    committee_member1: '',
    committee_member2: '',
    is_loan: false,
    items: [{ description: '', unit: '', quantity: 1, unit_price: 0, total_price: 0, shop_name: '' }]
  });

  const addItem = () => {
    setNewProject({
      ...newProject,
      items: [...newProject.items, { description: '', unit: '', quantity: 1, unit_price: 0, total_price: 0, shop_name: '' }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...newProject.items];
    newItems.splice(index, 1);
    const totalBudget = newItems.reduce((sum, item) => sum + item.total_price, 0);
    setNewProject({ ...newProject, items: newItems, budget_amount: totalBudget });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...newProject.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    const totalBudget = newItems.reduce((sum, item) => sum + item.total_price, 0);
    setNewProject({ ...newProject, items: newItems, budget_amount: totalBudget });
  };

  const addEditItem = () => {
    setEditProjectForm({
      ...editProjectForm,
      items: [...(editProjectForm.items || []), { description: '', unit: '', quantity: 1, unit_price: 0, total_price: 0, shop_name: '' }]
    });
  };

  const removeEditItem = (index: number) => {
    const newItems = [...(editProjectForm.items || [])];
    newItems.splice(index, 1);
    const totalBudget = newItems.reduce((sum, item) => sum + item.total_price, 0);
    setEditProjectForm({ ...editProjectForm, items: newItems, budget_amount: totalBudget });
  };

  const updateEditItem = (index: number, field: string, value: any) => {
    const newItems = [...(editProjectForm.items || [])];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }
    const totalBudget = newItems.reduce((sum, item) => sum + item.total_price, 0);
    setEditProjectForm({ ...editProjectForm, items: newItems, budget_amount: totalBudget });
  };

  const [manualCover, setManualCover] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

  const generateManualCover = async () => {
    try {
      setIsGeneratingCover(true);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const prompt = "A professional and modern book cover for a 'User Manual' of a digital procurement and project tracking system. The design features minimalist icons of document folders, checkmarks, and a digital dashboard on a tablet screen. Clean white background with elegant blue and slate grey accents. High-quality corporate style, minimalist, organized, and trustworthy.";
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          imageConfig: {
            aspectRatio: "3:4",
            imageSize: "1K"
          }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setManualCover(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error) {
      console.error("Error generating cover:", error);
      alert("ไม่สามารถสร้างภาพหน้าปกได้ในขณะนี้");
    } finally {
      setIsGeneratingCover(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchBudgetSources();
    fetchExpenseCategories();
    fetchVendors();
    fetchFiscalYears();
  }, []);

  useEffect(() => {
    if (view === 'new' && currentUser) {
      setNewProject(prev => ({
        ...prev,
        creator_name: currentUser.name,
        creator_position: currentUser.position
      }));
    }
  }, [view, currentUser]);

  const [tempProjectCode, setTempProjectCode] = useState('');
  const [procurementItems, setProcurementItems] = useState<any[]>([]);
  const [deliveryDates, setDeliveryDates] = useState<{[key: string]: string}>({});
  const [borrowerName, setBorrowerName] = useState('');
  const [loanExpenseCategory, setLoanExpenseCategory] = useState('');
  const [planningForm, setPlanningForm] = useState({
    in_plan: 'มีอยู่ในแผน',
    allocated_budget: 0,
    request_amount: 0,
    remaining_budget: 0,
    expense_category: 'งบ.ปวช.'
  });

  useEffect(() => {
    if (selectedProject) {
      setTempProjectCode(selectedProject.project_code || '');
      setProcurementItems(selectedProject.items || []);
      setBorrowerName(selectedProject.borrower_name || '');
      setLoanExpenseCategory(selectedProject.loan_expense_category || '');
      const allocated = selectedProject.allocated_budget || 0;
      const requested = selectedProject.request_amount || selectedProject.budget_amount || 0;
      setPlanningForm({
        in_plan: selectedProject.in_plan || 'มีอยู่ในแผน',
        allocated_budget: allocated,
        request_amount: requested,
        remaining_budget: allocated - requested,
        expense_category: selectedProject.expense_category || 'งบ.ปวช.'
      });
      if (selectedProject.is_other_expense) {
        setActiveTab('E');
        setOtherExpensePlanningForm({
          budget_source: selectedProject.budget_source || '',
          expense_category: selectedProject.expense_category || ''
        });
      } else if (selectedProject.is_loan) {
        setActiveTab((selectedProject.current_process as 'A' | 'D') || 'A');
      } else {
        setActiveTab((selectedProject.current_process as 'A' | 'B' | 'C') || 'A');
      }
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await safeParseJson(res) || [];
        setProjects(data);
        try {
          localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(data));
        } catch (e) {}
        return data;
      }
      // Fallback for static/offline hosting (e.g. Vercel)
      const saved = localStorage.getItem('ttc_smartprocure_projects');
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            setProjects(list);
            return list;
          }
        } catch (e) {}
      }
      setProjects(FALLBACK_PROJECTS);
      try {
        localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(FALLBACK_PROJECTS));
      } catch (e) {}
      return FALLBACK_PROJECTS;
    } catch (err) {
      console.warn("fetchProjects using fallback:", err);
      const saved = localStorage.getItem('ttc_smartprocure_projects');
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            setProjects(list);
            return list;
          }
        } catch (e) {}
      }
      setProjects(FALLBACK_PROJECTS);
      return FALLBACK_PROJECTS;
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetSources = async () => {
    try {
      const res = await fetch('/api/budget-sources');
      if (res.ok) {
        const data = await safeParseJson(res) || [];
        setBudgetSources(data);
        return;
      }
      setBudgetSources(FALLBACK_BUDGET_SOURCES);
    } catch (err) {
      console.warn("fetchBudgetSources using fallback:", err);
      setBudgetSources(FALLBACK_BUDGET_SOURCES);
    }
  };

  const fetchExpenseCategories = async () => {
    try {
      const res = await fetch('/api/expense-categories');
      if (res.ok) {
        const data = await safeParseJson(res) || [];
        setExpenseCategories(data);
        return;
      }
      setExpenseCategories(FALLBACK_EXPENSE_CATEGORIES);
    } catch (err) {
      console.warn("fetchExpenseCategories using fallback:", err);
      setExpenseCategories(FALLBACK_EXPENSE_CATEGORIES);
    }
  };

  const fetchFiscalYears = async () => {
    try {
      const res = await fetch('/api/fiscal-years');
      if (res.ok) {
        const data = await safeParseJson<any[]>(res) || [];
        if (data.length > 0) {
          setFiscalYears(data);
          try {
            localStorage.setItem('ttc_smartprocure_fiscal_years', JSON.stringify(data));
          } catch (e) {}
          const current = data.find((f: any) => Boolean(f.is_current));
          if (current) {
            setCurrentFiscalYear(current.year);
            setDashboardFiscalYear(prev => (prev === '2568' ? current.year : prev));
          }
          return;
        }
      }
      // Fallback
      const saved = localStorage.getItem('ttc_smartprocure_fiscal_years');
      if (saved) {
        const data = JSON.parse(saved);
        setFiscalYears(data);
        const current = data.find((f: any) => Boolean(f.is_current));
        if (current) {
          setCurrentFiscalYear(current.year);
          setDashboardFiscalYear(prev => (prev === '2568' ? current.year : prev));
        }
      } else {
        const defaultYears = [
          { year: '2568', name: 'ปีงบประมาณ พ.ศ. 2568', is_current: 1 },
          { year: '2569', name: 'ปีงบประมาณ พ.ศ. 2569', is_current: 0 }
        ];
        setFiscalYears(defaultYears);
      }
    } catch (err) {
      console.warn("fetchFiscalYears fallback:", err);
      const saved = localStorage.getItem('ttc_smartprocure_fiscal_years');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setFiscalYears(data);
          const current = data.find((f: any) => Boolean(f.is_current));
          if (current) {
            setCurrentFiscalYear(current.year);
            setDashboardFiscalYear(prev => (prev === '2568' ? current.year : prev));
          }
        } catch (e) {}
      }
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/vendors');
      if (res.ok) {
        const data = await safeParseJson(res) || [];
        if (Array.isArray(data) && data.length > 0) {
          setVendors(data);
          try {
            localStorage.setItem('ttc_smartprocure_vendors', JSON.stringify(data));
          } catch (e) {}
          return;
        }
      }
    } catch (err) {
      console.warn("fetchVendors API warning / static mode fallback:", err);
    }
    // Fallback if API is unreachable (e.g. static GitHub Pages or offline)
    if (Array.isArray(initialVendorsData) && initialVendorsData.length > 0) {
      setVendors((initialVendorsData as any[]).map(v => ({
        id: v.id,
        name: v.name,
        address: v.address || '',
        phone: v.phone || '',
        tax_id: v.tax_id || '',
        bank_account: v.bank_account || '',
        bank_name: v.bank_name || ''
      })));
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const { startDate, endDate } = statsDateRange;
      const res = await fetch(`/api/stats?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) {
        const errorData = await safeParseJson(res);
        throw new Error(errorData?.error || `Error ${res.status}: Failed to fetch statistics`);
      }
      const data = await safeParseJson(res);
      if (data) setStats(data);
    } catch (err) {
      console.error(err);
      setStatsError('ไม่สามารถโหลดข้อมูลสถิติได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchPendingProjectsDetail = async (process: 'A' | 'B' | 'C') => {
    try {
      const res = await fetch(`/api/stats/pending/${process}`);
      if (!res.ok) {
        const errorData = await safeParseJson(res);
        throw new Error(errorData?.error || `Error ${res.status}: Failed to fetch pending projects`);
      }
      const data = await safeParseJson(res) || [];
      setPendingProjectsList(data);
      setSelectedProcessForList(process);
      setShowPendingModal(true);
    } catch (err) {
      console.error("fetchPendingProjectsDetail error:", err);
      alert('ไม่สามารถโหลดข้อมูลโครงการที่ค้างอยู่ได้');
    }
  };

  const fetchShopProjectsDetail = async (shopName: string) => {
    try {
      const { startDate, endDate } = statsDateRange;
      const res = await fetch(`/api/stats/shop/${encodeURIComponent(shopName)}?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) {
        const errorData = await safeParseJson(res);
        throw new Error(errorData?.error || `Error ${res.status}: Failed to fetch shop projects`);
      }
      const data = await safeParseJson(res) || [];
      setShopProjectsList(data);
      setSelectedShopForList(shopName);
      setShowShopModal(true);
    } catch (err) {
      console.error("fetchShopProjectsDetail error:", err);
      alert('ไม่สามารถโหลดข้อมูลโครงการของร้านค้าได้');
    }
  };

  useEffect(() => {
    if (view === 'executive') {
      fetchStats();
    }
  }, [view, statsDateRange]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await safeParseJson(res) || [];
        if (Array.isArray(data) && data.length > 0) {
          setUsers(data);
          try {
            localStorage.setItem('ttc_smartprocure_users', JSON.stringify(data));
          } catch (e) {}
          return;
        }
      }
    } catch (err) {
      console.warn("fetchUsers API not reachable or in static mode:", err);
    }
    // Fallback if API fails (e.g. running statically from GitHub Pages or disconnected)
    if (Array.isArray(initialUsersData) && initialUsersData.length > 0) {
      setUsers((initialUsersData as any[]).map(u => ({
        username: u.username,
        role: (u.role || 'STAFF') as UserRole,
        name: u.name || u.username,
        position: u.position || 'บุคลากร',
        email: u.email || undefined
      })));
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const myTasks = projects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id));
      // STAFF role should see all projects by default to track progress like GUEST
      if (myTasks.length > 0 && userRole !== 'STAFF') {
        setDashboardTab('mine');
      } else {
        setDashboardTab('all');
      }
    }
    if (view === 'users' && userRole === 'ADMIN') {
      fetchUsers();
    }
    if (view === 'vendors' && ['ADMIN', 'PROCUREMENT_STAFF'].includes(userRole)) {
      fetchVendors();
    }
  }, [currentUser, projects.length, view, userRole]);

  useEffect(() => {
    if (showA03Modal) {
      fetchBudgetSources();
      fetchExpenseCategories();
    }
  }, [showA03Modal]);

  const handleDeleteVendor = async (id: number) => {
    if (!confirm('คุณแน่瞭หรือไม่ว่าต้องการลบข้อมูลร้านค้านี้?')) return;
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchVendors();
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  const openAddVendorModal = () => {
    setIsEditingVendor(false);
    setVendorForm({
      name: '',
      address: '',
      phone: '',
      tax_id: '',
      bank_account: '',
      bank_name: ''
    });
    setShowVendorModal(true);
  };

  const openEditVendorModal = (vendor: Vendor) => {
    setIsEditingVendor(true);
    setVendorForm(vendor);
    setShowVendorModal(true);
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = isEditingVendor ? `/api/vendors/${vendorForm.id}` : '/api/vendors';
    const method = isEditingVendor ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorForm)
      });
      if (res.ok) {
        setShowVendorModal(false);
        fetchVendors();
      } else {
        alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleSaveVendorsToGit = async () => {
    setIsSavingVendorsToGit(true);
    try {
      const res = await fetch('/api/vendors/save-to-git', { method: 'POST' });
      if (res.ok) {
        const data = await safeParseJson(res);
        alert(`✅ ${data?.message || 'บันทึกข้อมูลร้านค้าลงไฟล์ Git เรียบร้อยแล้ว'}\n\nคำแนะนำ: เมื่อท่านรันคำสั่ง git add src/data/initialVendors.json, git commit และ git push ไปยัง GitHub ข้อมูลร้านค้าทั้งหมด ${vendors.length} ร้านจะถูกบันทึกขึ้น GitHub อย่างสมบูรณ์`);
        fetchVendors();
      } else {
        const data = await safeParseJson(res);
        alert('เกิดข้อผิดพลาด: ' + (data?.error || 'ไม่สามารถบันทึกได้'));
      }
    } catch (err) {
      try {
        localStorage.setItem('ttc_smartprocure_vendors', JSON.stringify(vendors));
        alert(`✅ บันทึกข้อมูลร้านค้า ${vendors.length} รายการลง Local Cache เรียบร้อยแล้ว (โหมด Static / Offline)`);
      } catch (e) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      }
    } finally {
      setIsSavingVendorsToGit(false);
    }
  };

  const handleSyncVendors = async () => {
    if (!confirm('ยืนยันการซิงค์ข้อมูลร้านค้า? (ระบบจะโหลดรายชื่อร้านค้าทั้งหมดจาก initialVendors.json เข้าสู่ฐานข้อมูล SQLite)')) return;
    try {
      const res = await fetch('/api/vendors/sync', { method: 'POST' });
      if (res.ok) {
        const data = await safeParseJson(res);
        alert(data?.message || 'ซิงค์ข้อมูลร้านค้าสำเร็จ');
        fetchVendors();
      } else {
        const data = await safeParseJson(res);
        alert('เกิดข้อผิดพลาดในการซิงค์ข้อมูลร้านค้า: ' + (data?.error || ''));
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleExportVendorsJson = () => {
    try {
      const jsonContent = JSON.stringify(vendors, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ttc_vendors_full_backup_${new Date().toISOString().slice(0, 10)}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการส่งออก JSON');
    }
  };

  const handleExportVendorsCsv = () => {
    try {
      const headers = ['name', 'address', 'phone', 'tax_id', 'bank_account', 'bank_name'];
      const rows = vendors.map(v => [
        `"${(v.name || '').replace(/"/g, '""')}"`,
        `"${(v.address || '').replace(/"/g, '""')}"`,
        `"${(v.phone || '').replace(/"/g, '""')}"`,
        `"${(v.tax_id || '').replace(/"/g, '""')}"`,
        `"${(v.bank_account || '').replace(/"/g, '""')}"`,
        `"${(v.bank_name || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ttc_vendors_all_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการส่งออก CSV');
    }
  };

  const downloadVendorCsvTemplate = () => {
    const headers = ['name', 'address', 'phone', 'tax_id', 'bank_account', 'bank_name'];
    const sample = ['ห้างหุ้นส่วนจำกัด ตัวอย่างการค้า', '123 ถ.พัทลุง ต.ทับเที่ยง อ.เมือง จ.ตรัง 92000', '075-123456', '0925559000123', '9310001234', 'ธนาคารกรุงไทย จำกัด (มหาชน)'];
    const csvContent = headers.join(',') + '\n' + sample.map(s => `"${s}"`).join(',');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'vendor_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvImportVendors = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        const h = header.trim().toLowerCase().replace(/^\ufeff/, '');
        if (h === 'ชื่อร้านค้า' || h === 'ชื่อร้าน' || h === 'ร้านค้า' || h === 'name') return 'name';
        if (h === 'ที่อยู่' || h === 'address') return 'address';
        if (h === 'เบอร์โทร' || h === 'โทรศัพท์' || h === 'phone') return 'phone';
        if (h === 'เลขประจำตัวผู้เสียภาษี' || h === 'เลขผู้เสียภาษี' || h === 'tax_id') return 'tax_id';
        if (h === 'เลขที่บัญชี' || h === 'เลขบัญชี' || h === 'bank_account') return 'bank_account';
        if (h === 'ธนาคาร' || h === 'ชื่อธนาคาร' || h === 'bank_name') return 'bank_name';
        return h;
      },
      complete: async (results) => {
        const parsedVendors = results.data as any[];
        if (parsedVendors.length === 0) {
          alert('ไม่พบข้อมูลร้านค้าในไฟล์');
          return;
        }
        if (!confirm(`ยืนยันการนำเข้าร้านค้าจำนวน ${parsedVendors.length} รายการ?`)) return;

        try {
          const res = await fetch('/api/vendors/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vendors: parsedVendors })
          });
          if (res.ok) {
            const data = await safeParseJson(res);
            alert(`✅ นำเข้าร้านค้าสำเร็จ\n${data?.message || ''}`);
            fetchVendors();
          } else {
            const data = await safeParseJson(res);
            alert(`❌ นำเข้าล้มเหลว: ${data?.error || 'เกิดข้อผิดพลาด'}`);
          }
        } catch (err) {
          alert('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        }
        e.target.value = '';
      },
      error: (err) => {
        alert(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`);
      }
    });
  };

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');

  const handleUpdatePassword = async (username: string) => {
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setShowPasswordModal(true);
  };

  const submitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (passwordForm.newPassword.length < 4) {
      setPasswordError('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    try {
      const res = await fetch(`/api/users/${currentUser?.username}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordForm.newPassword })
      });
      if (res.ok) {
        alert('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
        setShowPasswordModal(false);
      } else {
        setPasswordError('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
      }
    } catch (err) {
      setPasswordError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleSyncUsers = async () => {
    if (!confirm('ยืนยันการซิงค์ข้อมูลผู้ใช้งาน? (ระบบจะโหลดรายชื่อบุคลากรทั้งหมด 203 คนจาก initialUsers.json และบันทึกเข้าสู่ฐานข้อมูล SQLite)')) return;
    try {
      const res = await fetch('/api/users/sync', { method: 'POST' });
      if (res.ok) {
        const data = await safeParseJson(res);
        alert(data?.message || 'ซิงค์ข้อมูลสำเร็จ');
        fetchUsers();
      } else {
        const data = await safeParseJson(res);
        alert('เกิดข้อผิดพลาดในการซิงค์ข้อมูล: ' + (data?.error || ''));
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleSaveUsersToGit = async () => {
    setIsSavingToGit(true);
    try {
      const res = await fetch('/api/users/save-to-git', { method: 'POST' });
      if (res.ok) {
        const data = await safeParseJson(res);
        alert(`✅ ${data?.message || 'บันทึกข้อมูลสำเร็จ'}\n\nคำแนะนำ: เมื่อท่านรันคำสั่ง git add, git commit และ git push ไปยัง GitHub ข้อมูลรายชื่อผู้ใช้งานทั้งหมด ${users.length} คนจะถูกบันทึกขึ้น GitHub อย่างสมบูรณ์`);
        fetchUsers();
      } else {
        const data = await safeParseJson(res);
        alert('เกิดข้อผิดพลาด: ' + (data?.error || 'ไม่สามารถบันทึกได้'));
      }
    } catch (err) {
      // In offline / static mode, save to localStorage
      try {
        localStorage.setItem('ttc_smartprocure_users', JSON.stringify(users));
        alert(`✅ บันทึกรายชื่อผู้ใช้ ${users.length} รายการลง Local Cache สำเร็จแล้ว (โหมด Static / Offline)`);
      } catch (e) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      }
    } finally {
      setIsSavingToGit(false);
    }
  };

  const handleExportUsersJson = () => {
    try {
      const jsonContent = JSON.stringify(users, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ttc_users_full_backup_${new Date().toISOString().slice(0, 10)}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการส่งออก JSON');
    }
  };

  const handleExportUsersCsv = () => {
    try {
      const headers = ['username', 'role', 'name', 'position', 'email'];
      const rows = users.map(u => [
        u.username,
        u.role,
        `"${(u.name || '').replace(/"/g, '""')}"`,
        `"${(u.position || '').replace(/"/g, '""')}"`,
        `"${(u.email || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ttc_users_all_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการส่งออก CSV');
    }
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use FileReader to handle encoding if needed, but for now we'll stick to Papa defaults
    // and focus on robust header mapping.
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        const h = header.trim().toLowerCase().replace(/^\ufeff/, '');
        // Map common Thai headers to English keys expected by server
        if (h === 'ชื่อผู้ใช้' || h === 'รหัสผู้ใช้' || h === 'username') return 'username';
        if (h === 'รหัสผ่าน' || h === 'password') return 'password';
        if (h === 'ชื่อ' || h === 'ชื่อ-นามสกุล' || h === 'name') return 'name';
        if (h === 'ตำแหน่ง' || h === 'position') return 'position';
        if (h === 'บทบาท' || h === 'สิทธิ์' || h === 'role') return 'role';
        return h;
      },
      complete: async (results) => {
        const users = results.data as any[];
        if (users.length === 0) {
          alert('ไม่พบข้อมูลในไฟล์');
          return;
        }

        // Validate headers - check if we have at least 'username' or something equivalent
        const firstRow = users[0];
        const hasUsername = 'username' in firstRow;
        
        if (!hasUsername) {
          alert('ไม่พบหัวข้อ "username" ในไฟล์ CSV กรุณาตรวจสอบหัวข้อในบรรทัดแรก');
          return;
        }

        if (!confirm(`ยืนยันการนำเข้าผู้ใช้งานจำนวน ${users.length} รายการ?`)) return;

        try {
          const res = await fetch('/api/users/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users })
          });
          
          if (res.ok) {
            const data = await safeParseJson(res);
            alert(`✅ นำเข้าสำเร็จ\n${data?.message || ''}`);
            fetchUsers();
          } else {
            const data = await safeParseJson(res);
            alert(`❌ นำเข้าล้มเหลว\nสาเหตุ: ${data?.error || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'}`);
          }
        } catch (err) {
          alert('❌ นำเข้าล้มเหลว\nไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
        }
        // Reset input
        e.target.value = '';
      },
      error: (err) => {
        alert(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${err.message}`);
      }
    });
  };

  const downloadCsvTemplate = () => {
    const headers = ['username', 'password', 'role', 'name', 'position'];
    const sample = ['user01', '123456', 'STAFF', 'ชื่อ-นามสกุล', 'ตำแหน่ง'];
    const csvContent = headers.join(',') + '\n' + sample.join(',');
    
    // Create a blob with UTF-8 BOM to ensure Thai characters display correctly in Excel
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'user_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = isEditingUser ? `/api/users/${userForm.username}` : '/api/users';
    const method = isEditingUser ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm)
      });

      if (res.ok) {
        alert(isEditingUser ? 'แก้ไขข้อมูลผู้ใช้เรียบร้อยแล้ว' : 'เพิ่มผู้ใช้ใหม่เรียบร้อยแล้ว');
        setShowUserModal(false);
        fetchUsers();
      } else {
        const data = await safeParseJson(res);
        alert(data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === currentUser?.username) {
      alert('ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้');
      return;
    }
    if (!confirm(`ยืนยันการลบผู้ใช้ ${username}?`)) return;

    try {
      const res = await fetch(`/api/users/${username}`, { method: 'DELETE' });
      if (res.ok) {
        alert('ลบผู้ใช้เรียบร้อยแล้ว');
        fetchUsers();
      } else {
        alert('เกิดข้อผิดพลาดในการลบผู้ใช้');
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const openAddUserModal = () => {
    setIsEditingUser(false);
    setUserForm({
      username: '',
      password: '',
      name: '',
      position: '',
      role: 'STAFF'
    });
    setShowUserModal(true);
  };

  const openEditUserModal = (user: User) => {
    setIsEditingUser(true);
    setUserForm({
      ...user,
      password: '' // Don't show password, but allow changing it
    });
    setShowUserModal(true);
  };

  const handleAddBudgetSource = async () => {
    const name = prompt('กรุณาระบุชื่อแหล่งงบประมาณใหม่ (เช่น งบประมาณแผ่นดิน, เงินรายได้สถานศึกษา, งบอุดหนุน...):');
    if (!name || !name.trim()) return;

    const amountStr = prompt(`ระบุวงเงินที่ได้รับจัดสรรสำหรับ "${name.trim()}" (บาท) [เว้นว่างได้หากยังไม่ได้รับเงิน]:`, '0');
    const amountVal = amountStr ? parseFloat(amountStr) || 0 : 0;

    try {
      const res = await fetch('/api/budget-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), total_budget: amountVal })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        alert(`✅ ${data?.message || 'บันทึกแหล่งงบประมาณเรียบร้อยแล้ว'}`);
        fetchBudgetSources();
      } else {
        alert('เกิดข้อผิดพลาด: ' + (data?.error || 'ไม่สามารถบันทึกแหล่งงบประมาณได้'));
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleDeleteBudgetSource = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบแหล่งงบประมาณนี้?')) return;

    try {
      const res = await fetch(`/api/budget-sources/${id}`, { method: 'DELETE' });
      const data = await safeParseJson(res);
      if (res.ok) {
        alert('ลบแหล่งงบประมาณเรียบร้อยแล้ว');
        fetchBudgetSources();
      } else {
        alert('เกิดข้อผิดพลาด: ' + (data?.error || 'ไม่สามารถลบแหล่งงบประมาณได้'));
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleAddExpenseCategory = async () => {
    const name = prompt('กรุณาระบุชื่อหมวดค่าใช้จ่ายใหม่ (เช่น ค่าจัดการเรียนการสอน, ค่าวัสดุ, ค่าครุภัณฑ์...):');
    if (!name || !name.trim()) return;

    const amountStr = prompt(`ระบุวงเงินที่ได้รับจัดสรรสำหรับ "${name.trim()}" (บาท) [เว้นว่างได้หากยังไม่ได้รับเงิน]:`, '0');
    const amountVal = amountStr ? parseFloat(amountStr) || 0 : 0;

    try {
      const res = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), allocated_budget: amountVal })
      });
      const data = await safeParseJson(res);
      if (res.ok) {
        alert(`✅ ${data?.message || 'บันทึกหมวดค่าใช้จ่ายเรียบร้อยแล้ว'}`);
        fetchExpenseCategories();
      } else {
        alert('เกิดข้อผิดพลาด: ' + (data?.error || 'ไม่สามารถบันทึกหมวดค่าใช้จ่ายได้'));
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const handleDeleteExpenseCategory = async (id: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบหมวดค่าใช้จ่ายนี้?')) return;

    try {
      const res = await fetch(`/api/expense-categories/${id}`, { method: 'DELETE' });
      const data = await safeParseJson(res);
      if (res.ok) {
        alert('ลบหมวดค่าใช้จ่ายเรียบร้อยแล้ว');
        fetchExpenseCategories();
      } else {
        alert('เกิดข้อผิดพลาด: ' + (data?.error || 'ไม่สามารถลบหมวดค่าใช้จ่ายได้'));
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteProjectFromLocalStorageById = (id: number) => {
    try {
      const saved = localStorage.getItem('ttc_smartprocure_projects');
      const currentList: Project[] = saved ? JSON.parse(saved) : projects;
      const updatedList = currentList.filter(p => p.id !== id);
      localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
      setProjects(updatedList);
    } catch (e) {}
    showToast('ลบโครงการเรียบร้อยแล้ว');
    setShowDeleteConfirm(false);
    setProjectToDeleteModal(null);
    setSelectedIds(prev => prev.filter(selId => selId !== id));
    if (selectedProject?.id === id) {
      setSelectedProject(null);
      setView('dashboard');
    }
  };

  const handleDeleteProject = async (id: number) => {
    setIsDeletingProject(true);
    // Optimistic local state update
    const previousProjects = [...projects];
    const updatedProjects = projects.filter(p => p.id !== id);
    setProjects(updatedProjects);
    try {
      localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedProjects));
    } catch (e) {}

    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok || res.status === 404) {
        showToast('ลบโครงการเรียบร้อยแล้ว');
        setShowDeleteConfirm(false);
        setProjectToDeleteModal(null);
        setSelectedIds(prev => prev.filter(selId => selId !== id));
        if (selectedProject?.id === id) {
          setSelectedProject(null);
          setView('dashboard');
        }
        await fetchProjects();
        return;
      }
      const errorData = await safeParseJson(res);
      showToast('เกิดข้อผิดพลาดในการลบโครงการ: ' + (errorData?.error || 'Unknown error'), 'error');
      setProjects(previousProjects);
    } catch (err) {
      deleteProjectFromLocalStorageById(id);
    } finally {
      setIsDeletingProject(false);
    }
  };

  const handleBatchDeleteProjects = async () => {
    if (selectedIds.length === 0) return;
    setIsBatchDeleting(true);
    const count = selectedIds.length;
    const idsToDelete = [...selectedIds];

    // Optimistic update
    const previousProjects = [...projects];
    const updatedProjects = projects.filter(p => !idsToDelete.includes(p.id));
    setProjects(updatedProjects);
    try {
      localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedProjects));
    } catch (e) {}

    try {
      const res = await fetch('/api/projects/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete })
      });
      if (res.ok || res.status === 404) {
        showToast(`ลบโครงการที่เลือกจำนวน ${count} รายการ เรียบร้อยแล้ว`);
        setSelectedIds([]);
        setShowBatchDeleteModal(false);
        if (selectedProject && idsToDelete.includes(selectedProject.id)) {
          setSelectedProject(null);
          setView('dashboard');
        }
        await fetchProjects();
        return;
      }
      const err = await safeParseJson(res);
      showToast('เกิดข้อผิดพลาด: ' + (err?.error || 'ไม่สามารถลบได้'), 'error');
      setProjects(previousProjects);
    } catch (e) {
      showToast(`ลบโครงการที่เลือกจำนวน ${count} รายการ เรียบร้อยแล้ว`);
      setSelectedIds([]);
      setShowBatchDeleteModal(false);
      if (selectedProject && idsToDelete.includes(selectedProject.id)) {
        setSelectedProject(null);
        setView('dashboard');
      }
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editProjectForm)
      });
      
      if (!res.ok) throw new Error('Failed to update project');
      
      setIsEditingProject(false);
      fetchProjectDetail(selectedProject.id);
      fetchProjects();
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
    }
  };

  const fetchProjectDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await safeParseJson(res);
      if (!data) return;
      setSelectedProject(data);
      setActiveTab(data.current_process || (data.is_other_expense ? 'E' : 'A'));
      setTempProjectCode(data.project_code || '');
      setOtherExpensePlanningForm({
        budget_source: data.budget_source || '',
        expense_category: data.expense_category || ''
      });
      
      if (data.delivery_dates) {
        try {
          setDeliveryDates(JSON.parse(data.delivery_dates));
        } catch (e) {
          setDeliveryDates({});
        }
      } else {
        setDeliveryDates({});
      }

      setView('detail');
    } catch (err) {
      console.error(err);
    }
  };

  const handleOtherExpenseAmountChange = (expStr: string, vatStr: string) => {
    const expNum = parseFloat(expStr) || 0;
    const vatNum = parseFloat(vatStr) || 0;
    const total = expNum + vatNum;
    setOtherExpenseForm(prev => ({
      ...prev,
      expense_amount: expStr,
      vat_amount: vatStr,
      total_amount: total > 0 ? total.toString() : ''
    }));
  };

  const handleCreateOtherExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expNum = parseFloat(otherExpenseForm.expense_amount) || 0;
      const vatNum = parseFloat(otherExpenseForm.vat_amount) || 0;
      const totalNum = parseFloat(otherExpenseForm.total_amount) || (expNum + vatNum);

      if (!otherExpenseForm.title.trim()) {
        showToast('กรุณากรอกชื่อรายการค่าใช้จ่ายอื่น', 'error');
        return;
      }
      if (!totalNum || totalNum <= 0) {
        showToast('กรุณาระบุจำนวนเงินรวมทั้งสิ้น', 'error');
        return;
      }

      const otherExpensePayload = {
        title: otherExpenseForm.title.trim(),
        expense_category: otherExpenseForm.expense_category || 'ค่าใช้จ่ายอื่น',
        voucher_no: otherExpenseForm.voucher_no.trim() || null,
        expense_amount: expNum,
        vat_amount: vatNum,
        budget_amount: totalNum,
        allocated_budget: totalNum,
        remaining_budget: totalNum,
        expense_notes: otherExpenseForm.expense_notes.trim(),
        necessity_reason: otherExpenseForm.expense_notes.trim(),
        project_nature: 'รายการค่าใช้จ่ายอื่น',
        department: 'งานการเงิน',
        creator_id: currentUser?.username || 'FINANCE',
        creator_name: currentUser?.name || 'งานการเงิน',
        creator_position: currentUser?.position || 'เจ้าหน้าที่งานการเงิน',
        is_other_expense: true,
        fiscal_year: otherExpenseForm.fiscal_year || currentFiscalYear || '2568',
        status: 'pending'
      };

      const resetOtherForm = () => {
        setOtherExpenseForm({
          fiscal_year: currentFiscalYear,
          expense_category: '',
          title: '',
          voucher_no: '',
          expense_amount: '',
          vat_amount: '',
          total_amount: '',
          expense_notes: ''
        });
      };

      const createOtherExpenseLocally = () => {
        try {
          const localId = Date.now();
          const createdProject: Project = {
            id: localId,
            project_code: `EXP-${new Date().getFullYear() + 543}-${String(localId).slice(-4)}`,
            title: otherExpensePayload.title,
            department: 'งานการเงิน',
            budget_amount: totalNum,
            allocated_budget: totalNum,
            request_amount: totalNum,
            remaining_budget: totalNum,
            budget_source: otherExpensePayload.expense_category,
            expense_category: otherExpensePayload.expense_category,
            creator_id: currentUser?.username || 'FINANCE',
            creator_name: currentUser?.name || 'งานการเงิน',
            creator_position: currentUser?.position || 'เจ้าหน้าที่งานการเงิน',
            is_other_expense: true,
            voucher_no: otherExpenseForm.voucher_no.trim() || undefined,
            expense_amount: expNum,
            vat_amount: vatNum,
            expense_notes: otherExpenseForm.expense_notes.trim(),
            necessity_reason: otherExpenseForm.expense_notes.trim(),
            project_nature: 'รายการค่าใช้จ่ายอื่น',
            fiscal_year: otherExpensePayload.fiscal_year,
            current_process: 'E',
            current_step: 1,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const saved = localStorage.getItem('ttc_smartprocure_projects');
          const currentList: Project[] = saved ? JSON.parse(saved) : projects;
          const updatedList = [createdProject, ...currentList.filter(p => p.id !== localId)];
          localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
          setProjects(updatedList);

          showToast('บันทึกรายการค่าใช้จ่ายอื่นเรียบร้อยแล้ว');
          resetOtherForm();
          setSelectedProject(createdProject);
          setView('detail');
        } catch (err: any) {
          showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (err.message || ''), 'error');
        }
      };

      try {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(otherExpensePayload)
        });

        if (res.ok) {
          const data = await safeParseJson(res);
          showToast('บันทึกรายการค่าใช้จ่ายอื่นเรียบร้อยแล้ว');
          resetOtherForm();
          await fetchProjects();
          if (data && data.id) {
            fetchProjectDetail(data.id);
          } else {
            setView('dashboard');
          }
          return;
        }

        // Fallback for static hosting / offline
        createOtherExpenseLocally();
      } catch (err: any) {
        console.warn('Network error creating other expense, fallback locally:', err);
        createOtherExpenseLocally();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
  };

  const handleCreateProject = async (e: React.FormEvent, isLoan: boolean = false, isDraft: boolean = false) => {
    e.preventDefault();

    const validItems = (newProject.items || []).filter(
      it => it && (it.description?.trim() || Number(it.unit_price) > 0 || Number(it.quantity) > 0)
    );
    const calculatedBudget = validItems.reduce((sum, it) => sum + (Number(it.quantity || 1) * Number(it.unit_price || 0)), 0);
    const finalBudget = Number(newProject.budget_amount) || calculatedBudget;
    const finalTitle = newProject.title?.trim() || (isLoan ? 'โครงการยืมเงินทดลองราชการ' : 'โครงการจัดซื้อจัดจ้าง');

    const projectPayload = {
      ...newProject,
      title: finalTitle,
      budget_amount: finalBudget,
      allocated_budget: Number(newProject.allocated_budget) || finalBudget,
      request_amount: finalBudget,
      remaining_budget: (Number(newProject.allocated_budget) || finalBudget) - finalBudget,
      items: validItems,
      is_loan: isLoan,
      creator_id: currentUser?.username || 'STAFF',
      creator_name: newProject.creator_name?.trim() || currentUser?.name || 'บุคลากร',
      creator_position: newProject.creator_position?.trim() || currentUser?.position || '',
      status: isDraft ? 'DRAFT' : 'pending'
    };

    const resetNewForm = () => {
      setNewProject({
        project_code: '',
        fiscal_year: currentFiscalYear || '2568',
        title: '',
        department: '',
        budget_amount: 0,
        budget_source: '',
        creator_name: '',
        creator_position: '',
        project_nature: '',
        necessity_reason: '',
        material_usage_date: '',
        allocated_budget: 0,
        procured_amount: 0,
        dept_head_name: '',
        dept_head_position: '',
        deputy_name: '',
        deputy_position: '',
        committee_chairman: '',
        committee_member1: '',
        committee_member2: '',
        is_loan: false,
        items: [{ description: '', unit: '', quantity: 1, unit_price: 0, total_price: 0, shop_name: '' }]
      });
    };

    const createProjectLocally = () => {
      try {
        const localId = Date.now();
        const createdProject: Project = {
          ...projectPayload,
          id: localId,
          project_code: newProject.project_code?.trim() || `PR-${new Date().getFullYear() + 543}-${String(localId).slice(-4)}`,
          fiscal_year: newProject.fiscal_year || currentFiscalYear || '2568',
          department: newProject.department?.trim() || 'งานพัฒนายุทธศาสตร์ฯ',
          budget_source: newProject.budget_source || 'เงินรายได้สถานศึกษา',
          procured_amount: Number(newProject.procured_amount) || 0,
          current_process: isLoan ? 'D' : 'A',
          current_step: 1,
          status: isDraft ? 'DRAFT' : 'pending',
          borrower_name: isLoan ? (newProject.creator_name || currentUser?.name) : undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const saved = localStorage.getItem('ttc_smartprocure_projects');
        const currentList: Project[] = saved ? JSON.parse(saved) : projects;
        const updatedList = [createdProject, ...currentList.filter(p => p.id !== localId)];
        localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
        setProjects(updatedList);

        showToast(isDraft ? 'บันทึกร่างโครงการเรียบร้อยแล้ว' : 'บันทึกโครงการและเริ่มต้นกระบวนการ A เรียบร้อยแล้ว');
        resetNewForm();
        setSelectedProject(createdProject);
        setView('detail');
      } catch (err: any) {
        showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + (err.message || ''), 'error');
      }
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectPayload)
      });
      
      if (res.ok) {
        const data = await safeParseJson(res);
        showToast(isDraft ? 'บันทึกร่างโครงการเรียบร้อยแล้ว' : 'บันทึกโครงการและเริ่มต้นกระบวนการ A เรียบร้อยแล้ว');
        resetNewForm();
        await fetchProjects();
        if (data && data.id) {
          fetchProjectDetail(data.id);
        } else {
          setView('dashboard');
        }
        return;
      }

      // If backend returned 404 (e.g. Vercel static hosting) or network error
      if (res.status === 404 || !res.status) {
        createProjectLocally();
        return;
      }

      const errorData = await safeParseJson(res);
      showToast('เกิดข้อผิดพลาด: ' + (errorData?.details || errorData?.error || 'Failed to create project'), 'error');
      createProjectLocally();
    } catch (err: any) {
      console.warn('Network error creating project, saving locally:', err);
      createProjectLocally();
    }
  };

  const handleUpdateProjectCode = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...selectedProject,
          project_code: tempProjectCode 
        })
      });
      if (res.ok) {
        await fetchProjects();
        // Update local selected project state
        setSelectedProject(prev => prev ? { ...prev, project_code: tempProjectCode } : null);
        alert('บันทึกรหัสโครงการเรียบร้อยแล้ว');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกรหัสโครงการ');
    }
  };

  const handleUpdateStep = async (projectId: number, process: string, targetStep: number, extraData?: any) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      
      const currentStep = project.current_step;
      let nextProcess = process;
      let nextStep = targetStep + 1;
      let status = 'pending';

      // Logic to transition between processes
      if (process === 'A' && nextStep > PROCESS_STEPS.A.length) {
        if (project.is_loan) {
          nextProcess = 'D';
        } else {
          nextProcess = 'B';
        }
        nextStep = 1;
      } else if (process === 'B' && nextStep > PROCESS_STEPS.B.length) {
        nextProcess = 'C';
        nextStep = 1;
      } else if (process === 'C' && nextStep > PROCESS_STEPS.C.length) {
        // Finished
        nextStep = targetStep; 
        status = 'completed';
      } else if (process === 'D' && nextStep === 26) {
        // Loan project reached final step D26
        nextStep = 26;
        status = 'completed';
      } else if (process === 'D' && nextStep > 26) {
        // Already at D26 or beyond
        nextStep = 26;
        status = 'completed';
      } else if (process === 'E' && nextStep > 11) {
        // Other expense completed!
        nextStep = 11;
        status = 'completed';
      }

      const notes = status === 'completed' 
        ? (project.is_loan ? 'เบิกจ่ายสำเร็จ' : (project.is_other_expense ? 'จ่ายเงินเสร็จสิ้นกระบวนการ' : 'จ่ายเงินสำเร็จ'))
        : (targetStep > currentStep 
            ? `ดำเนินการขั้นตอนที่ ${currentStep} ถึง ${targetStep} ของกระบวนการ ${process} สำเร็จ`
            : `ดำเนินการขั้นตอนที่ ${targetStep} ของกระบวนการ ${process} สำเร็จ`);

      const payload: any = {
        process: nextProcess,
        step: nextStep,
        status: status,
        actor: currentUser?.name || 'เจ้าหน้าที่',
        notes: notes
      };

      if (process === 'B' && targetStep === 1 && extraData) {
        payload.items = extraData;
      }

      if (process === 'A' && targetStep === 6 && extraData) {
        payload.in_plan = extraData.in_plan;
        payload.allocated_budget = extraData.allocated_budget;
        payload.request_amount = extraData.request_amount;
        payload.remaining_budget = extraData.remaining_budget;
        payload.expense_category = extraData.expense_category;
      }

      if (process === 'E' && targetStep === 6 && extraData) {
        payload.budget_source = extraData.budget_source;
        payload.expense_category = extraData.expense_category;
        payload.allocated_budget = extraData.allocated_budget;
        payload.request_amount = extraData.request_amount;
      }

      if (process === 'B' && targetStep === 8 && extraData) {
        payload.delivery_dates = extraData.delivery_dates;
      }
      
      if (process === 'D' && targetStep === 1 && extraData) {
        payload.borrower_name = extraData.borrower_name;
      }
      
      if (process === 'D' && targetStep === 19 && extraData) {
        payload.loan_expense_category = extraData.loan_expense_category;
      }

      const res = await fetch(`/api/projects/${projectId}/step`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await safeParseJson(res);
        throw new Error(errorData?.error || 'Failed to update step');
      }

      const updatedProjects = await fetchProjects();
      await fetchProjectDetail(projectId);
      
      // คำนวณงานที่เหลือจากข้อมูลล่าสุด
      const remainingTasks = updatedProjects.filter((p: Project) => 
        canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)
      ).length;
      
      if (remainingTasks > 0) {
        alert(`ดำเนินการสำเร็จ! คุณยังมีงานที่ต้องดำเนินการอีก ${remainingTasks} รายการ`);
      } else {
        alert('ดำเนินการสำเร็จ! คุณไม่มีงานค้างในขณะนี้');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ');
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.length === 0) return;
    
    const confirmMsg = `ยืนยันการเลื่อนสถานะ ${selectedIds.length} โครงการที่เลือกไปยังขั้นตอนถัดไป?`;
    if (!window.confirm(confirmMsg)) return;

    const updates = selectedIds.map(id => {
      const p = projects.find(proj => proj.id === id);
      if (!p) return null;
      
      // Check permission
      if (!canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)) {
        return null;
      }
      
      let nextProcess = p.current_process;
      let nextStep = p.current_step + 1;
      let status = 'pending';

      if (p.current_process === 'A' && p.current_step === PROCESS_STEPS.A.length) {
        if (p.is_loan) {
          nextProcess = 'D';
        } else {
          nextProcess = 'B';
        }
        nextStep = 1;
      } else if (p.current_process === 'B' && p.current_step === PROCESS_STEPS.B.length) {
        nextProcess = 'C';
        nextStep = 1;
      } else if (p.current_process === 'C' && p.current_step === PROCESS_STEPS.C.length) {
        nextStep = p.current_step; 
        status = 'completed';
      } else if (p.current_process === 'D' && p.current_step === 25) {
        // Reaching D26 in bulk update
        nextStep = 26;
        status = 'completed';
      } else if (p.current_process === 'D' && p.current_step === 26) {
        nextStep = 26;
        status = 'completed';
      } else if (p.current_process === 'E' && p.current_step >= 11) {
        nextStep = 11;
        status = 'completed';
      }

      return {
        id: p.id,
        process: nextProcess,
        step: nextStep,
        status: status,
        actor: currentUser?.name || 'เจ้าหน้าที่',
        notes: status === 'completed' ? (p.is_loan ? 'เบิกจ่ายสำเร็จ (Bulk)' : (p.is_other_expense ? 'จ่ายเงินเสร็จสิ้นกระบวนการ (Bulk)' : 'จ่ายเงินสำเร็จ (Bulk)')) : `ดำเนินการขั้นตอนที่ ${p.current_step} ของกระบวนการ ${p.current_process} สำเร็จ (Bulk)`
      };
    }).filter(Boolean);

    if (updates.length === 0) {
      alert('คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนปัจจุบันของโครงการที่เลือก');
      return;
    }

    try {
      const res = await fetch('/api/projects/bulk-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      
      if (!res.ok) throw new Error('Bulk update failed');
      
      setSelectedIds([]);
      const updatedProjects = await fetchProjects();
      setDashboardTab('mine');
      
      const remainingTasks = updatedProjects.filter((p: Project) => 
        canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)
      ).length;

      if (remainingTasks > 0) {
        alert(`อัปเดตสำเร็จ! คุณยังมีงานที่ต้องดำเนินการอีก ${remainingTasks} รายการ`);
      } else {
        alert('อัปเดตสำเร็จ! คุณไม่มีงานค้างในขณะนี้');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการอัปเดตแบบกลุ่ม');
    }
  };

  const toggleSelectProject = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredProjects.map(p => p.id);
    if (selectedIds.length === filteredIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredIds);
    }
  };

  if (showLogin && !currentUser) {
    const filteredDemoAccounts = DEMO_ACCOUNTS.filter(
      acc => demoRoleFilter === 'all' || acc.category === demoRoleFilter
    );

    return (
      <div className="min-h-screen bg-slate-900/50 backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 font-sarabun overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 my-auto flex flex-col lg:flex-row max-h-[94vh]"
        >
          {/* Left Column: Form เข้าสู่ระบบ */}
          <div className="lg:w-5/12 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-100 bg-white">
            <div className="bg-gradient-to-br from-red-700 via-red-800 to-rose-900 p-6 sm:p-7 text-white text-center relative shrink-0">
              <button 
                onClick={() => setShowLogin(false)}
                className="absolute right-4 top-4 p-2 hover:bg-white/10 rounded-full transition-colors lg:hidden"
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm shadow-inner">
                <FileText size={26} className="text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">เข้าสู่ระบบเจ้าหน้าที่</h1>
              <p className="text-red-100 text-xs sm:text-sm mt-1 opacity-90">ระบบ TTC SmartProcure วิทยาลัยเทคนิคตรัง</p>
              
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-[11px] font-semibold text-red-50 backdrop-blur-xs">
                <Sparkles size={13} className="text-amber-300" />
                <span>มีตัวช่วยเข้าระบบสำหรับทดลองใช้งาน</span>
              </div>
            </div>

            <div className="p-6 sm:p-7 space-y-4 overflow-y-auto flex-1 flex flex-col justify-between">
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-xs font-bold border border-rose-200 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-rose-600" />
                    <span>{loginError}</span>
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>ชื่อผู้ใช้งาน หรือ อีเมล</span>
                    {loginForm.username && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        ผู้ใช้: <strong className="text-slate-600">{loginForm.username}</strong>
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input 
                      type="text"
                      required
                      autoFocus
                      value={loginForm.username}
                      onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none text-xs sm:text-sm font-medium"
                      placeholder="เช่น admin, plan_staff, proc_staff"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>รหัสผ่าน</span>
                    {loginForm.password && (
                      <span className="text-[10px] text-emerald-600 font-bold">
                        ✓ ระบุรหัสผ่านแล้ว
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input 
                      type="password"
                      required
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all outline-none text-xs sm:text-sm font-medium"
                      placeholder="กรอกรหัสผ่าน"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-red-200 active:scale-[0.98] text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <Lock size={15} />
                  <span>{isLoggingIn ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</span>
                </button>
              </form>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-1 font-medium"
                >
                  ← กลับหน้าหลัก (เข้าชมทั่วไป)
                </button>
                <button
                  type="button"
                  onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                  className="text-red-700 font-bold hover:underline lg:hidden flex items-center gap-1"
                >
                  <KeyRound size={13} />
                  <span>{showDemoAccounts ? 'ซ่อนตัวช่วย' : 'ดูบัญชีทดลองใช้'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: ตัวช่วยเข้าระบบเพื่อทดลองใช้ (Demo Accounts) */}
          <div className={`lg:w-7/12 bg-slate-50/90 flex flex-col overflow-hidden ${showDemoAccounts ? 'flex' : 'hidden lg:flex'}`}>
            {/* Header ของตัวช่วย */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-white/95 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                  <KeyRound size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      ตัวช่วยเข้าระบบเพื่อทดลองใช้
                    </h3>
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-black text-[10px] rounded-full uppercase tracking-wider">
                      Demo Helper
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    คลิก <strong>"เข้าสู่ระบบทันที"</strong> เพื่อทดลองใช้งานแต่ละสิทธิ์หน้าที่ได้ทันที
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowLogin(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors hidden lg:flex"
                title="ปิด"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick role filter pills */}
            <div className="px-4 sm:px-5 py-2.5 bg-slate-100/70 border-b border-slate-200/60 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
              <span className="text-slate-400 font-semibold mr-1 shrink-0">เลือกบทบาท:</span>
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'admin', label: 'ผู้ดูแลระบบ' },
                { id: 'planning', label: 'ยุทธศาสตร์/งบประมาณ' },
                { id: 'procurement', label: 'พัสดุ' },
                { id: 'finance', label: 'การเงิน' },
                { id: 'director', label: 'ผู้บริหาร' },
                { id: 'staff', label: 'บุคลากร' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setDemoRoleFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    demoRoleFilter === f.id
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-200/80'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Account Cards List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              {filteredDemoAccounts.map((acc) => (
                <div
                  key={acc.username}
                  className="p-3.5 bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 hover:shadow-sm transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-800">
                          {acc.roleName}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${acc.badgeColor}`}>
                          {acc.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        {acc.desc}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
                        <span className="text-slate-500 font-mono">
                          User: <strong className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{acc.username}</strong>
                        </span>
                        <span className="text-slate-500 font-mono">
                          Pass: <strong className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">{acc.password}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText?.(`${acc.username} / ${acc.password}`);
                            setCopiedField(acc.username);
                            setTimeout(() => setCopiedField(null), 2000);
                          }}
                          className="text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 text-[10px]"
                          title="คัดลอกชื่อและรหัสผ่าน"
                        >
                          {copiedField === acc.username ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                              <Check size={11} /> คัดลอกแล้ว
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <Copy size={11} /> คัดลอก
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-2 sm:shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginForm({ username: acc.username, password: acc.password });
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors border border-slate-200"
                        title="กรอกชื่อผู้ใช้และรหัสผ่านลงฟอร์ม"
                      >
                        กรอกฟอร์ม
                      </button>
                      <button
                        type="button"
                        disabled={isLoggingIn}
                        onClick={() => {
                          handleLogin(undefined, { username: acc.username, password: acc.password });
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 ${
                          acc.role === 'ADMIN'
                            ? 'bg-red-700 hover:bg-red-800 text-white'
                            : acc.category === 'planning'
                            ? 'bg-blue-700 hover:bg-blue-800 text-white'
                            : acc.category === 'procurement'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : acc.category === 'finance'
                            ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                            : acc.category === 'director'
                            ? 'bg-purple-700 hover:bg-purple-800 text-white'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                      >
                        <Zap size={13} />
                        <span>เข้าสู่ระบบทันที</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom info banner */}
            <div className="p-3 sm:p-3.5 bg-amber-50/80 border-t border-amber-200/60 text-[11px] text-amber-900 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-amber-700 shrink-0" />
                <span>สำหรับทดสอบระบบ: สามารถสลับบัญชีเพื่อทดสอบแต่ละขั้นตอนได้อย่างอิสระ</span>
              </span>
              <span className="font-mono text-[10px] text-amber-700 font-bold bg-amber-100/70 px-2 py-0.5 rounded">
                TTC SmartProcure
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const isAnyPrintModalOpen = 
    showA01Modal || 
    showA02Modal || 
    showA03Modal || 
    showB01Modal || 
    showB02Modal || 
    showB03Modal || 
    showB04Modal || 
    showB05Modal || 
    showB08Modal || 
    showC01Modal || 
    showC02Modal || 
    showD01Modal || 
    showD02Modal || 
    showExecutivePreview;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sarabun">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden print:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-50 transition-transform duration-300 ease-in-out print:hidden print-hidden ${
        isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="p-6 h-full overflow-y-auto flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-700 rounded-xl flex items-center justify-center text-white shrink-0">
                  <FileText size={24} />
                </div>
                <h1 className="font-bold text-base leading-tight">TTC SmartProcure<br/>วท.ตรัง</h1>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 md:hidden"
                aria-label="ปิดเมนู"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="space-y-1">
              <div className="mb-4">
                <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">เมนูหลัก</p>
                <button 
                  onClick={() => navigateTo('dashboard')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${view === 'dashboard' ? 'bg-red-700 text-white shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <LayoutDashboard size={18} />
                  <span className="text-sm font-bold">แผงควบคุม</span>
                </button>

                <button 
                  onClick={() => setShowPrintMenu(!showPrintMenu)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all mt-1 ${view.startsWith('print-') ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <Printer size={18} />
                    <span className="text-sm font-bold">พิมพ์เอกสาร</span>
                  </div>
                  <ChevronRight size={16} className={`transition-transform ${showPrintMenu ? 'rotate-90' : ''}`} />
                </button>
                
                <AnimatePresence>
                  {(showPrintMenu || view.startsWith('print-')) && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden ml-4 mt-1 space-y-1 border-l-2 border-slate-100 pl-2"
                    >
                      {['ADMIN', 'PLANNING_STAFF', 'FINANCE_STAFF', 'PROCUREMENT_STAFF', 'STAFF'].includes(userRole) && (
                        <>
                          <button onClick={() => navigateTo('print-a01')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-a01' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร A01</button>
                          <button onClick={() => navigateTo('print-a02')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-a02' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร A02</button>
                          {['ADMIN', 'PLANNING_STAFF'].includes(userRole) && (
                            <button onClick={() => navigateTo('print-a03')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-a03' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร A03</button>
                          )}
                        </>
                      )}
                      {['ADMIN', 'PROCUREMENT_STAFF'].includes(userRole) && (
                        <>
                          <button onClick={() => navigateTo('print-b01')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-b01' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร B01</button>
                          <button onClick={() => navigateTo('print-b02')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-b02' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร B02</button>
                          <button onClick={() => navigateTo('print-b03')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-b03' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร B03</button>
                          <button onClick={() => navigateTo('print-b04')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-b04' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร B04</button>
                          <button onClick={() => navigateTo('print-b05')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-b05' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร B05</button>
                          <button onClick={() => navigateTo('print-b08')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-b08' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร B08</button>
                          <button onClick={() => navigateTo('print-d01')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-d01' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร D01</button>
                        </>
                      )}
                      {['ADMIN', 'FINANCE_STAFF'].includes(userRole) && (
                        <>
                          <button onClick={() => navigateTo('print-c01')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-c01' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร C01</button>
                          <button onClick={() => navigateTo('print-c02')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-c02' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร C02</button>
                          <button onClick={() => navigateTo('print-d02')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${view === 'print-d02' ? 'text-red-700 bg-red-50' : 'text-slate-500 hover:bg-slate-50'}`}>• เอกสาร D02 (ใบเบิก)</button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {userRole !== 'GUEST' && (
                  <button 
                    onClick={() => navigateTo('new')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all mt-1 ${view === 'new' ? 'bg-red-700 text-white shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Plus size={18} />
                    <span className="text-sm font-bold">สร้างโครงการใหม่</span>
                  </button>
                )}
                {userRole !== 'GUEST' && (
                  <button 
                    onClick={() => navigateTo('create-project-loan')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all mt-1 ${view === 'create-project-loan' ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <PlusCircle size={18} />
                    <span className="text-sm font-bold">สร้างโครงการใหม่(ยืมเงิน)</span>
                  </button>
                )}
                {['ADMIN', 'FINANCE_STAFF', 'FINANCE_HEAD'].includes(userRole) && (
                  <button 
                    onClick={() => navigateTo('create-other-expense')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all mt-1 ${view === 'create-other-expense' ? 'bg-emerald-700 text-white shadow-lg shadow-emerald-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Receipt size={18} />
                    <span className="text-sm font-bold">รายการค่าใช้จ่ายอื่น</span>
                  </button>
                )}
                {!['GUEST', 'STAFF'].includes(userRole) && (
                  <button 
                    onClick={() => navigateTo('executive')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all mt-1 ${view === 'executive' ? 'bg-red-700 text-white shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <TrendingUp size={18} />
                    <span className="text-sm font-bold">บทสรุปผู้บริหาร</span>
                  </button>
                )}
              </div>

              <div className="mb-4">
                <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">ระบบจัดการ</p>
                {currentUser && userRole !== 'GUEST' && (
                  <button 
                    id="nav-project-database-btn"
                    onClick={() => navigateTo('projects-db')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all mb-1 ${view === 'projects-db' ? 'bg-red-700 text-white shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <FolderKanban size={18} />
                    <span className="text-sm font-bold">ฐานข้อมูลโครงการ</span>
                  </button>
                )}
                {!['GUEST', 'STAFF'].includes(userRole) && (
                  <button 
                    id="nav-batch-operations-btn"
                    onClick={() => navigateTo('batch-operations')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all mb-1 ${view === 'batch-operations' ? 'bg-red-700 text-white shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
                    title="เลือกและกำหนดกระบวนการพร้อมกันครั้งละหลายโครงการ"
                  >
                    <Layers size={18} />
                    <span className="text-sm font-bold">กำหนดกระบวนการหลายโครงการ</span>
                  </button>
                )}
                {currentUser && userRole !== 'GUEST' && (
                  <button 
                    id="nav-budget-database-btn"
                    onClick={() => navigateTo('budgets')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all mb-1 ${view === 'budgets' ? 'bg-red-700 text-white shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Landmark size={18} />
                    <span className="text-sm font-bold">ฐานข้อมูลงบประมาณ</span>
                  </button>
                )}
                {['ADMIN', 'PLANNING_HEAD', 'PLANNING_STAFF', 'DEPUTY_DIRECTOR_PLANNING'].includes(userRole) && (
                  <button 
                    onClick={() => navigateTo('users')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${view === 'users' ? 'bg-red-700 text-white shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Settings size={18} />
                    <span className="text-sm font-bold">จัดการระบบ {userRole === 'ADMIN' ? '/ ผู้ใช้งาน' : '/ ปีงบประมาณ'}</span>
                  </button>
                )}
                {['ADMIN', 'PROCUREMENT_STAFF'].includes(userRole) && (
                  <button 
                    onClick={() => navigateTo('vendors')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all mt-1 ${view === 'vendors' ? 'bg-red-700 text-white shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    <Building2 size={18} />
                    <span className="text-sm font-bold">ฐานข้อมูลร้านค้า</span>
                  </button>
                )}
                <button 
                  onClick={() => navigateTo('manual')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all mt-1 ${view === 'manual' ? 'bg-red-700 text-white shadow-lg shadow-red-100' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <FileText size={18} />
                  <span className="text-sm font-bold">คู่มือการใช้งาน</span>
                </button>
              </div>
            </nav>
          </div>

          <div className="pt-6">
            {!currentUser && (
              <div className="mb-4">
                <button 
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setShowLogin(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-red-700 text-white font-bold py-3 rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100"
                >
                  <Lock size={18} />
                  เข้าสู่ระบบเจ้าหน้าที่
                </button>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Developer</p>
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                พัฒนาโดย นายนันธวุฒิ น้อย<br/>
                <span className="text-slate-400">รองผู้อำนวยการ วิทยาลัยเทคนิคตรัง</span>
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`pl-0 md:pl-64 min-h-screen transition-all duration-300 print:pl-0 print:bg-white ${isAnyPrintModalOpen ? 'print:hidden' : ''}`}>
        <header className="min-h-16 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between px-4 sm:px-6 md:px-8 py-2 sticky top-0 z-40 print:hidden print-hidden gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl md:hidden shrink-0"
              aria-label="เปิดเมนู"
            >
              <Menu size={22} />
            </button>
            <h2 className="text-lg sm:text-xl font-semibold truncate">
              {view === 'dashboard' && 'ภาพรวมโครงการ'}
              {view === 'projects-db' && 'ฐานข้อมูลโครงการ'}
              {view === 'batch-operations' && 'กำหนดกระบวนการหลายโครงการ (Batch Update)'}
              {view === 'new' && 'เริ่มโครงการใหม่'}
              {view === 'detail' && 'รายละเอียดโครงการ'}
              {view === 'users' && 'จัดการผู้ใช้งาน'}
              {view === 'budgets' && 'ฐานข้อมูลงบประมาณ'}
              {view === 'vendors' && 'ฐานข้อมูลร้านค้า'}
              {view === 'executive' && 'บทสรุปผู้บริหาร'}
              {view === 'print-a01' && 'พิมพ์เอกสารขอซื้อข้อจ้าง A01'}
              {view === 'print-a02' && 'พิมพ์เอกสารรายละเอียดพัสดุ A02'}
              {view === 'print-a03' && ['ADMIN', 'PLANNING_STAFF'].includes(userRole) && 'เอกสารการพิจารณาอนุมัติ A03'}
              {view === 'print-b01' && 'เอกสารรายงานขอซื้อขอจ้าง B01'}
              {view === 'print-b02' && 'เอกสารรายละเอียดพัสดุ B02'}
              {view === 'print-b03' && 'ประกาศผู้ชนะการเสนอราคา B03'}
              {view === 'print-b04' && 'รายงานผลการพิจารณา B04'}
              {view === 'print-b05' && 'ใบสั่งซื้อ B05'}
              {view === 'print-b08' && 'ใบตรวจรับ B08'}
              {view === 'print-c01' && 'พิมพ์เอกสารใบเบิกเงิน C01'}
              {view === 'print-c02' && 'พิมพ์เอกสารบันทึกข้อความขออนุมัติเบิกจ่าย C02'}
              {view === 'print-d01' && 'พิมพ์เอกสารคำสั่งแต่งตั้งเจ้าหน้าที่พัสดุ D01'}
              {view === 'print-d02' && 'พิมพ์เอกสารใบเบิก D02'}
              {view === 'manual' && 'คู่มือการใช้งาน'}
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            {!['GUEST', 'STAFF'].includes(userRole) && (
              <button
                onClick={() => navigateTo('batch-operations')}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors shadow-2xs"
                title="เลือกและกำหนดกระบวนการพร้อมกันหลายโครงการ"
              >
                <Layers size={14} />
                <span>กำหนดกระบวนการหลายโครงการ</span>
              </button>
            )}
            {currentUser ? (
              <div className="flex items-center gap-2 sm:gap-3 bg-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-2xl border border-slate-200 shadow-xs">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-red-100 text-red-700 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Logged in as</p>
                  <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{currentUser.name}</p>
                </div>
                <div className="flex items-center gap-1 ml-1 sm:ml-2 border-l border-slate-100 pl-1 sm:pl-2">
                  <button 
                    onClick={() => handleUpdatePassword(currentUser.username)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title="เปลี่ยนรหัสผ่าน"
                  >
                    <Lock size={16} />
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="ออกจากระบบ"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3 bg-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-2xl border border-slate-200 shadow-xs">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                  <User size={16} />
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Status</p>
                  <p className="text-xs font-bold text-slate-700">ผู้เข้าชมทั่วไป</p>
                </div>
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                  title="เข้าสู่ระบบ หรือเลือกบัญชีเพื่อทดลองใช้งาน"
                >
                  <KeyRound size={13} />
                  <span>เข้าสู่ระบบ / ทดลองใช้</span>
                </button>
              </div>
            )}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                setActiveSearchQuery(searchQuery);
              }}
              className="relative hidden sm:block"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="ค้นหาชื่อ, รหัส, ร้านค้า..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-8 py-1.5 sm:py-2 bg-slate-100 border-none rounded-full text-xs sm:text-sm focus:ring-2 focus:ring-red-500 w-44 md:w-56 lg:w-64"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveSearchQuery('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <Plus className="rotate-45" size={16} />
                </button>
              )}
            </form>
          </div>
        </header>

        <div className="p-4 sm:p-6 md:p-8">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Welcome Banner */}
                <div className="bg-gradient-to-r from-red-700 to-red-900 rounded-3xl p-8 text-white shadow-xl shadow-red-100 relative overflow-hidden">
                  <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-2">สวัสดีคุณ {currentUser?.name || 'ผู้เข้าชมทั่วไป'}</h2>
                    <p className="text-red-100 opacity-90 max-w-md mb-6">
                      {userRole !== 'GUEST' && dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)).length > 0 
                        ? `คุณมีงานที่ต้องดำเนินการ ${dashboardFiscalYear === 'all' ? 'ทุกปีงบประมาณ' : `ปีงบประมาณ ${dashboardFiscalYear}`} ทั้งหมด ${dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)).length} รายการในขณะนี้`
                        : 'ยินดีต้อนรับสู่ TTC SmartProcure (ระบบจัดซื้อจัดจ้างอัจฉริยะ เทคนิคตรัง)'}
                    </p>
                    
                    {userRole === 'GUEST' || userRole === 'STAFF' ? (
                      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-2xl">
                        <div className="relative flex-1 w-full">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-red-300" size={20} />
                          <input 
                            type="text" 
                            placeholder="ค้นหาชื่อโครงการ, รหัส, ชื่อร้านค้า หรือแผนก..." 
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setActiveSearchQuery(e.target.value);
                            }}
                            className="w-full pl-12 pr-4 py-3.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder:text-red-200 focus:ring-2 focus:ring-white/30 outline-none backdrop-blur-sm transition-all"
                          />
                        </div>
                        {userRole === 'STAFF' && dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)).length > 0 && (
                          <button 
                            onClick={() => setDashboardTab('mine')}
                            className="bg-white text-red-700 px-6 py-3.5 rounded-2xl font-bold text-sm hover:bg-red-50 transition-colors shadow-lg whitespace-nowrap flex items-center gap-2"
                          >
                            <List size={18} />
                            ดูงานของฉัน ({dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)).length})
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        {dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)).length > 0 && (
                          <button 
                            onClick={() => setDashboardTab('mine')}
                            className="bg-white text-red-700 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors shadow-lg"
                          >
                            ดูงานของฉันทั้งหมด ({dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)).length})
                          </button>
                        )}
                        {!['GUEST', 'STAFF'].includes(userRole) && (
                          <button 
                            onClick={() => navigateTo('batch-operations')}
                            className="bg-white/15 hover:bg-white/25 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all border border-white/25 backdrop-blur-xs flex items-center gap-2 shadow-sm"
                          >
                            <Layers size={16} />
                            <span>กำหนดกระบวนการหลายโครงการ (Batch)</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
                    <FileText size={200} />
                  </div>
                </div>

                {/* Fiscal Year Selector Bar */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-50 text-red-700 rounded-xl">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">ปีงบประมาณ:</span>
                        <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                          {dashboardFiscalYear === 'all' ? 'ทุกปีงบประมาณ' : `ปี ${dashboardFiscalYear}`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">แยกแสดงภาพรวมโครงการ รายการโครงการ และค่าใช้จ่ายตามปีงบประมาณ</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                    <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
                      {availableFiscalYears.map(year => (
                        <button
                          key={year}
                          onClick={() => setDashboardFiscalYear(year)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                            dashboardFiscalYear === year
                              ? 'bg-white text-red-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span>ปี {year}</span>
                          {year === currentFiscalYear && (
                            <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-semibold">ปัจจุบัน</span>
                          )}
                        </button>
                      ))}
                      <button
                        onClick={() => setDashboardFiscalYear('all')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                          dashboardFiscalYear === 'all'
                            ? 'bg-white text-red-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        ทุกปีงบประมาณ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                        <FileText size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {dashboardFiscalYear === 'all' ? 'ทุกปี' : `ปี ${dashboardFiscalYear}`}
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium">โครงการทั้งหมด</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className="text-2xl font-bold text-slate-800">{dashboardProjects.length}</h3>
                      <span className="text-xs text-slate-400">โครงการ</span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                        <Coins size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                        งบประมาณ
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium">มูลค่างบประมาณรวม</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className="text-2xl font-bold text-purple-700 font-mono">
                        {dashboardProjects.reduce((sum, p) => sum + Number(p.budget_amount || 0), 0).toLocaleString()}
                      </h3>
                      <span className="text-xs text-slate-400">บาท</span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                        <Clock size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        กำลังดำเนินการ
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium">รอการอนุมัติ / ระหว่างทาง</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className="text-2xl font-bold text-slate-800">
                        {dashboardProjects.filter(p => p.status !== 'completed' && !(p.is_loan && p.current_process === 'D' && p.current_step === 26)).length}
                      </h3>
                      <span className="text-xs text-slate-400">โครงการ</span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                        <CheckCircle2 size={20} />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        สำเร็จ
                      </span>
                    </div>
                    <p className="text-slate-500 text-xs font-medium">จ่ายเงินเรียบร้อย</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <h3 className="text-2xl font-bold text-emerald-700">
                        {dashboardProjects.filter(p => p.status === 'completed' || (p.is_loan && p.current_process === 'D' && p.current_step === 26)).length}
                      </h3>
                      <span className="text-xs text-slate-400">โครงการ</span>
                    </div>
                  </div>
                </div>

                {/* Action Required Section */}
                {dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id)).length > 0 && (
                  <div className="bg-red-50/50 border border-red-100 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertCircle size={20} />
                        <h3 className="font-bold">
                          งานที่รอคุณดำเนินการ ({dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id)).length})
                        </h3>
                      </div>
                      <span className="text-xs font-bold text-red-600 bg-red-100/60 px-2.5 py-0.5 rounded-full border border-red-200">
                        {dashboardFiscalYear === 'all' ? 'ทุกปีงบประมาณ' : `ปี ${dashboardFiscalYear}`}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {dashboardProjects
                        .filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id))
                        .slice(0, 6)
                        .map(p => (
                          <div 
                            key={p.id} 
                            onClick={() => fetchProjectDetail(p.id)}
                            className="bg-white p-4 rounded-xl border border-red-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded uppercase">รอคุณดำเนินการ</span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {p.project_code ? `รหัส: ${p.project_code}` : `ID: ${p.id.toString().padStart(4, '0')}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-slate-800 text-sm line-clamp-1 group-hover:text-red-700 transition-colors">{p.title}</h4>
                              {p.is_loan ? (
                                <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-wider shrink-0">
                                  ยืมเงิน
                                </span>
                              ) : p.is_other_expense ? (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wider shrink-0">
                                  รายจ่ายอื่น
                                </span>
                              ) : null}
                            </div>
                            {p.voucher_no && (
                              <div className="text-[9px] font-bold text-emerald-700 mb-1">
                                ใบสำคัญ: {p.voucher_no}
                              </div>
                            )}
                            {p.item_shops && (
                              <div className="flex items-center gap-1 text-[9px] text-amber-600 font-bold mb-1">
                                <Building2 size={10} />
                                <span className="truncate">{p.item_shops}</span>
                              </div>
                            )}
                            <p className="text-[10px] text-slate-500 mb-3">{PROCESS_STEPS[p.current_process]?.[p.current_step - 1] || ''}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400">{p.department}</span>
                              <div className="flex items-center gap-1 text-red-600 font-bold text-[10px]">
                                ดำเนินการ <ChevronRight size={12} />
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Project List */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="font-bold text-lg">รายการโครงการและค่าใช้จ่าย</h3>
                        <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-lg">
                          {dashboardFiscalYear === 'all' ? 'ทุกปีงบประมาณ' : `ประจำปีงบประมาณ ${dashboardFiscalYear}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        ติดตามสถานะเอกสารแยกตามกระบวนการ (A - E) • รวม {filteredProjects.length} รายการ (งบประมาณ {filteredProjects.reduce((sum, p) => sum + Number(p.budget_amount || 0), 0).toLocaleString()} ฿)
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      {selectedIds.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={handleBulkUpdate}
                            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                          >
                            <CheckCircle2 size={16} />
                            <span>เลื่อนสถานะ ({selectedIds.length})</span>
                          </button>
                          {(userRole === 'ADMIN' || ['PLANNING_STAFF', 'PLANNING_HEAD', 'DEPUTY_DIRECTOR_PLANNING'].includes(userRole)) && (
                            <button 
                              onClick={() => setShowBatchDeleteModal(true)}
                              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
                            >
                              <Trash2 size={15} />
                              <span>ลบที่เลือก ({selectedIds.length})</span>
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
                        {[
                          { id: 'all', label: 'ทั้งหมด' },
                          ...(userRole !== 'GUEST' ? [{ 
                            id: 'mine', 
                            label: `งานที่ต้องทำ ${dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)).length > 0 ? `(${dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)).length})` : ''}` 
                          }] : []),
                          { id: 'A', label: 'A: ยุทธศาสตร์ฯ' },
                          { id: 'B', label: 'B: พัสดุ' },
                          { id: 'C', label: 'C: การเงิน' },
                          { id: 'D', label: 'D: ยืมเงิน' },
                          { id: 'E', label: 'E: รายจ่ายอื่น' }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setDashboardTab(tab.id as any)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                              dashboardTab === tab.id 
                                ? 'bg-white text-red-700 shadow-xs' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            {tab.label}
                            {tab.id === 'mine' && dashboardProjects.filter(p => canEditProcess(p.current_process, p.current_step, p.creator_id, p.status)).length > 0 && (
                              <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          {userRole !== 'GUEST' && (
                            <th className="px-6 py-4 font-semibold w-12">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectAllFiltered();
                                }}
                                className={`p-1 rounded transition-colors ${selectedIds.length === filteredProjects.length && filteredProjects.length > 0 ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-400'}`}
                              >
                                {selectedIds.length === filteredProjects.length && filteredProjects.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
                              </button>
                            </th>
                          )}
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ / รายการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก/งาน</th>
                          <th className="px-6 py-4 font-semibold">งบประมาณ</th>
                          <th className="px-6 py-4 font-semibold">สถานะกระบวนการ</th>
                          <th className="px-6 py-4 font-semibold">ความคืบหน้า</th>
                          <th className="px-6 py-4 font-semibold"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loading ? (
                          <tr><td colSpan={userRole !== 'GUEST' ? 7 : 6} className="px-6 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
                        ) : filteredProjects.length === 0 ? (
                          <tr><td colSpan={userRole !== 'GUEST' ? 7 : 6} className="px-6 py-12 text-center text-slate-400">ไม่พบข้อมูลโครงการใน{dashboardFiscalYear === 'all' ? 'ทุกปีงบประมาณ' : `ปีงบประมาณ ${dashboardFiscalYear}`} สำหรับเงื่อนไขนี้</td></tr>
                        ) : filteredProjects.map((project) => (
                          <tr 
                            key={project.id} 
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedIds.includes(project.id) ? 'bg-red-50/30' : ''}`} 
                            onClick={() => fetchProjectDetail(project.id)}
                          >
                            {userRole !== 'GUEST' && (
                              <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                <button 
                                  onClick={() => toggleSelectProject(project.id)}
                                  className={`p-1 rounded transition-colors ${selectedIds.includes(project.id) ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                                >
                                  {selectedIds.includes(project.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                                </button>
                              </td>
                            )}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900">{project.title}</p>
                                {project.is_loan ? (
                                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 uppercase tracking-wider shrink-0">
                                    ยืมเงิน
                                  </span>
                                ) : project.is_other_expense ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wider shrink-0">
                                    รายจ่ายอื่น
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                                  ปีงบฯ {project.fiscal_year || currentFiscalYear || '2568'}
                                </span>
                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                  {project.project_code ? `รหัส: ${project.project_code}` : `ID: ${project.id.toString().padStart(4, '0')}`}
                                </span>
                                {project.voucher_no ? (
                                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100">
                                    ใบสำคัญ: {project.voucher_no}
                                  </span>
                                ) : null}
                                {project.item_shops ? (
                                  <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded flex items-center gap-1 max-w-[250px]">
                                    <Building2 size={10} className="shrink-0" />
                                    <span className="truncate" title={project.item_shops}>ร้าน: {project.item_shops}</span>
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-mono font-bold text-slate-700">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    project.status === 'completed' ? 'bg-emerald-600 text-white' :
                                    project.status === 'DRAFT' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                    project.current_process === 'A' ? 'bg-blue-100 text-blue-600' :
                                    project.current_process === 'B' ? 'bg-amber-100 text-amber-600' :
                                    project.current_process === 'C' ? 'bg-emerald-100 text-emerald-600' :
                                    project.current_process === 'D' ? 'bg-indigo-100 text-indigo-600' :
                                    'bg-teal-100 text-teal-800'
                                  }`}>
                                    {project.status === 'completed' ? (project.is_loan ? 'เบิกจ่ายสำเร็จ' : (project.is_other_expense ? 'จ่ายเงินเสร็จสิ้น' : 'จ่ายเงินสำเร็จ')) : 
                                     project.status === 'DRAFT' ? 'ร่างโครงการ (รอส่งกระบวนการ A)' : (
                                      project.current_process === 'A' ? 'A: วางแผนและงบประมาณ' : 
                                      project.current_process === 'B' ? 'B: งานพัสดุ' : 
                                      project.current_process === 'C' ? 'C: งานการเงิน' :
                                      project.current_process === 'D' ? 'D: ยืมเงินทดลองราชการ' :
                                      'E: รายการค่าใช้จ่ายอื่น'
                                     )}
                                  </span>
                                  {canEditProcess(project.current_process, project.current_step, project.creator_id, project.status) && (
                                    <span className="animate-pulse bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">Action</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                  {PROCESS_STEPS[project.current_process]?.[project.current_step - 1] || ''}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[80px]">
                                  <div 
                                    className={`h-full transition-all duration-500 ${
                                      project.status === 'completed' ? 'bg-emerald-600' :
                                      project.current_process === 'A' ? 'bg-blue-500' :
                                      project.current_process === 'B' ? 'bg-amber-500' :
                                      project.current_process === 'C' ? 'bg-emerald-500' :
                                      project.current_process === 'D' ? 'bg-indigo-500' :
                                      'bg-teal-500'
                                    }`}
                                    style={{ width: `${project.status === 'completed' ? 100 : (project.current_step / (PROCESS_STEPS[project.current_process]?.length || 1)) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">
                                  {project.status === 'completed' ? (project.is_loan ? '100% เบิกจ่ายสำเร็จ' : (project.is_other_expense ? '100% เสร็จสิ้น' : '100% จ่ายเงินสำเร็จ')) : `${Math.round((project.current_step / (PROCESS_STEPS[project.current_process]?.length || 1)) * 100)}%`}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canDeleteProject(project) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProjectToDeleteModal(project);
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title={`ลบโครงการ "${project.title}"`}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                                <ChevronRight size={20} className="text-slate-300 shrink-0" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {(view === 'new' || view === 'create-project-loan') && (
              <motion.div 
                key={view}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-7xl mx-auto"
              >
                <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-lg shadow-slate-100">
                  <h3 className="text-2xl font-bold mb-6">
                    {view === 'create-project-loan' ? 'เริ่มโครงการจัดซื้อจัดจ้างใหม่ (ยืมเงินทดลองราชการ)' : 'เริ่มโครงการจัดซื้อจัดจ้างใหม่'}
                  </h3>
                  <form onSubmit={(e) => handleCreateProject(e, view === 'create-project-loan')} className="space-y-6">
                    {(userRole === 'PLANNING_STAFF' || userRole === 'ADMIN') && (
                      <div>
                        <label className="block text-sm font-bold text-red-700 mb-2">รหัสโครงการ (ถ้ามี)</label>
                        <input 
                          type="text" 
                          value={newProject.project_code}
                          onChange={e => setNewProject({...newProject, project_code: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-red-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all bg-red-50/30"
                          placeholder="เช่น P67-001"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อโครงการ / รายการขอซื้อขอจ้าง</label>
                      <input 
                        required
                        type="text" 
                        value={newProject.title}
                        onChange={e => setNewProject({...newProject, title: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                        placeholder="เช่น จัดซื้อวัสดุฝึกสำหรับแผนกวิชาช่างยนต์"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">ปีงบประมาณ</label>
                        <select
                          value={newProject.fiscal_year || currentFiscalYear}
                          onChange={e => setNewProject({...newProject, fiscal_year: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all font-semibold bg-white"
                        >
                          {fiscalYears.length > 0 ? (
                            fiscalYears.map(fy => (
                              <option key={fy.year} value={fy.year}>
                                ปีงบฯ {fy.year} {Boolean(fy.is_current) ? '(ปัจจุบัน)' : ''}
                              </option>
                            ))
                          ) : (
                            <option value={currentFiscalYear}>ปีงบฯ {currentFiscalYear} (ปัจจุบัน)</option>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">สาขาวิชา / งาน / ฝ่าย</label>
                        <input 
                          required
                          type="text" 
                          value={newProject.department}
                          onChange={e => setNewProject({...newProject, department: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                          placeholder="แผนกวิชา..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">จำนวนเงินงบประมาณรวม (บาท)</label>
                        <input 
                          readOnly
                          type="number" 
                          step="any"
                          value={newProject.budget_amount}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-red-700 outline-none transition-all"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">ลักษณะโครงการ</label>
                      <textarea 
                        value={newProject.project_nature}
                        onChange={e => setNewProject({...newProject, project_nature: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                        placeholder="อธิบายลักษณะโครงการ..."
                        rows={2}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">เหตุผลความจำเป็น</label>
                      <textarea 
                        value={newProject.necessity_reason}
                        onChange={e => setNewProject({...newProject, necessity_reason: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                        placeholder="ระบุเหตุผลความจำเป็นในการจัดซื้อจัดจ้าง..."
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-1">
                        <label className="block text-sm font-bold text-slate-700 mb-2">กำหนดการใช้วัสดุ</label>
                        <input 
                          type="text" 
                          value={newProject.material_usage_date}
                          onChange={e => setNewProject({...newProject, material_usage_date: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                          placeholder="วว/ดด/พ.ศ."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">งบประมาณที่ได้รับจัดสรร</label>
                        <input 
                          type="number" 
                          step="any"
                          value={newProject.allocated_budget}
                          onChange={e => setNewProject({...newProject, allocated_budget: Number(e.target.value)})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">จัดซื้อจัดจ้างมาแล้ว</label>
                        <input 
                          type="number" 
                          step="any"
                          value={newProject.procured_amount}
                          onChange={e => setNewProject({...newProject, procured_amount: Number(e.target.value)})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    </div>

                    {/* Items Section */}
                    <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">รายการที่จะซื้อหรือจ้าง</h4>
                          <p className="text-[10px] text-slate-400">ระบุรายการสินค้าแต่ละรายการ (เช่น ดินสอ, กระดาษ) เพื่อแสดงในเอกสาร A01</p>
                        </div>
                        <button 
                          type="button"
                          onClick={addItem}
                          className="flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-800 transition-colors"
                        >
                          <Plus size={14} /> เพิ่มรายการ
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {newProject.items.map((item, index) => (
                          <div key={index} className="grid grid-cols-12 gap-4 items-end bg-white p-4 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-red-100">
                            <div className="col-span-3">
                              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">รายการสินค้า/บริการ</label>
                              <input 
                                required
                                type="text"
                                value={item.description}
                                onChange={e => updateItem(index, 'description', e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 font-medium"
                                placeholder="เช่น ดินสอ, กระดาษ..."
                              />
                            </div>
                            <div className="col-span-1">
                              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">หน่วยนับ</label>
                              <input 
                                required
                                type="text"
                                value={item.unit}
                                onChange={e => updateItem(index, 'unit', e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-center"
                                placeholder="ชิ้น"
                              />
                            </div>
                            <div className="col-span-1">
                              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">จำนวน</label>
                              <input 
                                required
                                type="number"
                                value={item.quantity}
                                onChange={e => updateItem(index, 'quantity', Number(e.target.value))}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-center"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">ราคา/หน่วย</label>
                              <input 
                                required
                                type="number"
                                step="any"
                                value={item.unit_price}
                                onChange={e => updateItem(index, 'unit_price', Number(e.target.value))}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 font-bold text-right"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">ราคารวม</label>
                              <input 
                                readOnly
                                type="number"
                                value={item.total_price}
                                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-slate-700 text-right"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">ชื่อร้านค้า (ถ้ามี)</label>
                              <input 
                                type="text"
                                list="vendor-suggestions"
                                value={item.shop_name || ''}
                                onChange={e => updateItem(index, 'shop_name', e.target.value)}
                                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                                placeholder="ชื่อร้านค้า..."
                              />
                            </div>
                            <div className="col-span-1 flex justify-center pb-2">
                              {newProject.items.length > 1 && (
                                <button 
                                  type="button"
                                  onClick={() => removeItem(index)}
                                  className="text-slate-300 hover:text-red-600 transition-colors"
                                >
                                  <AlertCircle size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">ผู้เสนอชื่อโครงการ</label>
                        <input 
                          required
                          type="text" 
                          value={newProject.creator_name}
                          onChange={e => setNewProject({...newProject, creator_name: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                          placeholder="ชื่อ-นามสกุล..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">ตำแหน่ง/ทำหน้าที่</label>
                        <input 
                          required
                          type="text" 
                          value={newProject.creator_position}
                          onChange={e => setNewProject({...newProject, creator_position: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                          placeholder="ตำแหน่ง..."
                        />
                      </div>
                    </div>

                    {view === 'create-project-loan' && (
                      <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                        <label className="block text-sm font-bold text-indigo-900 mb-2">ชื่อผู้ยืมเงิน (เพื่อแต่งตั้งเป็นเจ้าหน้าที่พัสดุชั่วคราว D01)</label>
                        <input 
                          required
                          type="text" 
                          value={newProject.borrower_name || ''}
                          onChange={e => setNewProject({...newProject, borrower_name: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                          placeholder="ระบุชื่อ-นามสกุล ผู้ยืมเงิน..."
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">หัวหน้าแผนกวิชา/หัวหน้างาน</label>
                        <input 
                          required
                          type="text" 
                          value={newProject.dept_head_name}
                          onChange={e => setNewProject({...newProject, dept_head_name: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                          placeholder="ชื่อ-นามสกุล..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">ตำแหน่ง (หัวหน้าแผนก/งาน)</label>
                        <input 
                          required
                          type="text" 
                          value={newProject.dept_head_position}
                          onChange={e => setNewProject({...newProject, dept_head_position: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                          placeholder="ตำแหน่ง..."
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">รองผู้อำนวยการตามสายงาน</label>
                        <input 
                          required
                          type="text" 
                          value={newProject.deputy_name}
                          onChange={e => setNewProject({...newProject, deputy_name: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                          placeholder="ชื่อ-นามสกุล..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">ตำแหน่ง (รองฝ่าย)</label>
                        <input 
                          required
                          type="text" 
                          value={newProject.deputy_position}
                          onChange={e => setNewProject({...newProject, deputy_position: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                          placeholder="ตำแหน่ง..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">หมวดเงิน / แหล่งงบประมาณ</label>
                      <select 
                        value={newProject.budget_source}
                        onChange={e => setNewProject({...newProject, budget_source: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                      >
                        <option value="">เลือกหมวดเงิน...</option>
                        {budgetSources.map(source => (
                          <option key={source.id} value={source.name}>{source.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-4">
                      <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2">
                        <CheckSquare size={16} />
                        คณะกรรมการตรวจรับพัสดุ
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-emerald-600 mb-1">ประธานกรรมการ</label>
                          <input 
                            type="text" 
                            value={newProject.committee_chairman}
                            onChange={e => setNewProject({...newProject, committee_chairman: e.target.value})}
                            className="w-full px-4 py-2 text-sm rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all bg-white"
                            placeholder="ชื่อ-นามสกุล ประธานกรรมการ..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-emerald-600 mb-1">กรรมการ (1)</label>
                            <input 
                              type="text" 
                              value={newProject.committee_member1}
                              onChange={e => setNewProject({...newProject, committee_member1: e.target.value})}
                              className="w-full px-4 py-2 text-sm rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all bg-white"
                              placeholder="ชื่อ-นามสกุล กรรมการคนที่ 1..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-emerald-600 mb-1">กรรมการ (2)</label>
                            <input 
                              type="text" 
                              value={newProject.committee_member2}
                              onChange={e => setNewProject({...newProject, committee_member2: e.target.value})}
                              className="w-full px-4 py-2 text-sm rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all bg-white"
                              placeholder="ชื่อ-นามสกุล กรรมการคนที่ 2..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                      {userRole !== 'GUEST' ? (
                        <>
                          <button 
                            type="button"
                            onClick={(e) => handleCreateProject(e, view === 'create-project-loan', true)}
                            className="px-6 py-4 bg-amber-50 text-amber-800 border-2 border-amber-300 font-bold rounded-xl hover:bg-amber-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                          >
                            <FileText size={18} className="text-amber-600" />
                            บันทึกร่างโครงการ (ยังไม่เริ่มกระบวนการ A)
                          </button>
                          <button 
                            type="submit"
                            className="flex-1 bg-red-700 text-white font-bold py-4 rounded-xl hover:bg-red-800 transition-colors shadow-lg shadow-red-200"
                          >
                            {view === 'create-project-loan' ? 'บันทึกและเริ่มกระบวนการยืมเงิน' : 'บันทึกและเริ่มกระบวนการ A'}
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 bg-slate-100 text-slate-400 font-bold py-4 rounded-xl border border-slate-200 text-center flex items-center justify-center gap-2">
                          <Settings size={20} />
                          เฉพาะบุคลากรหรือเจ้าหน้าที่ที่ได้รับอนุญาตเท่านั้นที่สามารถสร้างโครงการได้
                        </div>
                      )}
                      <button 
                        type="button"
                        onClick={() => setView('dashboard')}
                        className="px-8 bg-slate-100 text-slate-600 font-bold py-4 rounded-xl hover:bg-slate-200 transition-colors"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {view === 'create-other-expense' && (
              <motion.div 
                key="create-other-expense"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-4xl mx-auto"
              >
                <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl shadow-slate-100">
                  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0">
                      <Receipt size={24} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-800">สร้างรายการค่าใช้จ่ายอื่น</h3>
                      <p className="text-xs text-slate-500 mt-1">สำหรับงานการเงินสร้างกระบวนการสำหรับรายจ่ายอื่น และส่งเข้าสู่กระบวนการ E (E1 - E11)</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateOtherExpense} className="space-y-6">
                    {/* ปีงบประมาณ & หมวดรายจ่ายงบประมาณ */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          ปีงบประมาณ
                        </label>
                        <select
                          value={otherExpenseForm.fiscal_year || currentFiscalYear}
                          onChange={e => setOtherExpenseForm({...otherExpenseForm, fiscal_year: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all bg-white font-semibold"
                        >
                          {fiscalYears.length > 0 ? (
                            fiscalYears.map(fy => (
                              <option key={fy.year} value={fy.year}>
                                ปีงบฯ {fy.year} {Boolean(fy.is_current) ? '(ปัจจุบัน)' : ''}
                              </option>
                            ))
                          ) : (
                            <option value={currentFiscalYear}>ปีงบฯ {currentFiscalYear} (ปัจจุบัน)</option>
                          )}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                          หมวดรายจ่ายงบประมาณ <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={otherExpenseForm.expense_category}
                          onChange={e => setOtherExpenseForm({...otherExpenseForm, expense_category: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all bg-white"
                        >
                          <option value="">-- กรุณาเลือกหมวดรายจ่ายงบประมาณ --</option>
                          {expenseCategories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* รายการ */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        รายการ <span className="text-red-500">*</span>
                      </label>
                      <input 
                        required
                        type="text" 
                        value={otherExpenseForm.title}
                        onChange={e => setOtherExpenseForm({...otherExpenseForm, title: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        placeholder="เช่น ค่าสาธารณูปโภค ค่าตอบแทนวิทยากร หรือระบุรายการค่าใช้จ่าย..."
                      />
                    </div>

                    {/* เลขที่ใบสำคัญ */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        เลขที่ใบสำคัญ
                      </label>
                      <input 
                        type="text" 
                        value={otherExpenseForm.voucher_no}
                        onChange={e => setOtherExpenseForm({...otherExpenseForm, voucher_no: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        placeholder="เช่น วจ. 12/2567 หรือเลขที่อ้างอิงใบสำคัญ"
                      />
                    </div>

                    {/* Financial Numbers: จำนวนเงิน, จำนวนภาษีมูลค่าเพิ่ม, รวมทั้งสิ้น */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                          จำนวนเงิน (บาท) <span className="text-red-500">*</span>
                        </label>
                        <input 
                          required
                          type="number"
                          step="any"
                          min="0"
                          value={otherExpenseForm.expense_amount}
                          onChange={e => handleOtherExpenseAmountChange(e.target.value, otherExpenseForm.vat_amount)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-mono font-bold"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                          จำนวนภาษีมูลค่าเพิ่ม (บาท)
                        </label>
                        <input 
                          type="number"
                          step="any"
                          min="0"
                          value={otherExpenseForm.vat_amount}
                          onChange={e => handleOtherExpenseAmountChange(otherExpenseForm.expense_amount, e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-mono font-bold"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-emerald-800 uppercase mb-2">
                          รวมทั้งสิ้น (บาท) <span className="text-red-500">*</span>
                        </label>
                        <input 
                          required
                          type="number"
                          step="any"
                          min="0"
                          value={otherExpenseForm.total_amount}
                          onChange={e => setOtherExpenseForm({...otherExpenseForm, total_amount: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border-2 border-emerald-300 focus:ring-2 focus:ring-emerald-500 outline-none bg-emerald-50/50 font-mono font-bold text-emerald-900 text-lg"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* หมายเหตุ */}
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        หมายเหตุ
                      </label>
                      <textarea 
                        rows={3}
                        value={otherExpenseForm.expense_notes}
                        onChange={e => setOtherExpenseForm({...otherExpenseForm, expense_notes: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all resize-none"
                        placeholder="ระบุรายละเอียดเพิ่มเติม หรือหมายเหตุประกอบรายการ..."
                      />
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                      <button 
                        type="submit"
                        className="flex-1 bg-emerald-700 text-white font-bold py-4 rounded-xl hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                      >
                        <Receipt size={20} />
                        บันทึกรายการและเริ่มกระบวนการ E
                      </button>
                      <button 
                        type="button"
                        onClick={() => setView('dashboard')}
                        className="px-8 bg-slate-100 text-slate-600 font-bold py-4 rounded-xl hover:bg-slate-200 transition-colors"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {view === 'detail' && selectedProject && (
              <motion.div 
                key="detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {/* Header Info */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex flex-col gap-1">
                          <h3 className="text-3xl font-bold text-slate-900">{selectedProject.title}</h3>
                          {selectedProject.is_loan && (
                            <span className="w-fit px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                              โครงการยืมเงินทดลองราชการ
                            </span>
                          )}
                        </div>
                        {((userRole === 'ADMIN' && selectedProject.current_process === 'A') || 
                          (userRole !== 'GUEST' && selectedProject.creator_id === currentUser?.username && (selectedProject.status === 'DRAFT' || (selectedProject.current_process === 'A' && selectedProject.current_step <= 4)))) && (
                          <button 
                            onClick={() => {
                              setIsEditingProject(true);
                              setEditProjectForm({
                                ...selectedProject,
                                items: selectedProject.items || []
                              });
                            }}
                            className="flex items-center gap-1 px-4 py-2 bg-red-50 text-red-700 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors border border-red-100"
                          >
                            <Settings size={14} /> แก้ไขข้อมูลโครงการ
                          </button>
                        )}
                        <button 
                          disabled={loadingProjectId === selectedProject.id}
                          onClick={async () => {
                            try {
                              setLoadingProjectId(selectedProject.id);
                              const res = await fetch(`/api/projects/${selectedProject.id}`);
                              const data = await safeParseJson(res);
                              if (data) {
                                setSelectedProject(data);
                                setShowA01Modal(true);
                              } else {
                                alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                              }
                            } catch (err) {
                              console.error(err);
                              alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                            } finally {
                              setLoadingProjectId(null);
                            }
                          }}
                          className={`flex items-center gap-1 px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900 transition-colors shadow-sm ${loadingProjectId === selectedProject.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Printer size={14} className={loadingProjectId === selectedProject.id ? 'animate-spin' : ''} /> 
                          {loadingProjectId === selectedProject.id ? 'กำลังโหลด...' : 'พิมพ์ / ส่งออก PDF (A01)'}
                        </button>
                        <button 
                          disabled={loadingProjectId === selectedProject.id}
                          onClick={async () => {
                            try {
                              setLoadingProjectId(selectedProject.id);
                              const res = await fetch(`/api/projects/${selectedProject.id}`);
                              const data = await safeParseJson(res);
                              if (data) {
                                setSelectedProject(data);
                                setShowA02Modal(true);
                              } else {
                                alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                              }
                            } catch (err) {
                              console.error(err);
                              alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                            } finally {
                              setLoadingProjectId(null);
                            }
                          }}
                          className={`flex items-center gap-1 px-4 py-2 bg-slate-700 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-sm ${loadingProjectId === selectedProject.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Printer size={14} className={loadingProjectId === selectedProject.id ? 'animate-spin' : ''} /> 
                          {loadingProjectId === selectedProject.id ? 'กำลังโหลด...' : 'พิมพ์ / ส่งออก PDF (A02)'}
                        </button>
                        {['ADMIN', 'PLANNING_STAFF', 'PLANNING_HEAD', 'DEPUTY_DIRECTOR_PLANNING'].includes(userRole) && (
                          <button 
                            disabled={loadingProjectId === selectedProject.id}
                            onClick={async () => {
                              try {
                                setLoadingProjectId(selectedProject.id);
                                fetchBudgetSources();
                                fetchExpenseCategories();
                                const res = await fetch(`/api/projects/${selectedProject.id}`);
                                const data = await safeParseJson(res);
                                if (data) {
                                  setSelectedProject(data);
                                  setShowA03Modal(true);
                                } else {
                                  alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                }
                              } catch (err) {
                                console.error(err);
                                alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                              } finally {
                                setLoadingProjectId(null);
                              }
                            }}
                            className={`flex items-center gap-1 px-4 py-2 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800 transition-colors shadow-sm ${loadingProjectId === selectedProject.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Printer size={14} className={loadingProjectId === selectedProject.id ? 'animate-spin' : ''} /> 
                            {loadingProjectId === selectedProject.id ? 'กำลังโหลด...' : 'พิมพ์ / ส่งออก PDF (A03)'}
                          </button>
                        )}
                        {selectedProject.is_loan && ['ADMIN', 'PROCUREMENT_STAFF'].includes(userRole) && (
                          <button 
                            disabled={loadingProjectId === selectedProject.id}
                            onClick={async () => {
                              try {
                                setLoadingProjectId(selectedProject.id);
                                const res = await fetch(`/api/projects/${selectedProject.id}`);
                                const data = await safeParseJson(res);
                                if (data) {
                                  setSelectedProject(data);
                                  setShowD01Modal(true);
                                } else {
                                  alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                }
                              } catch (err) {
                                console.error(err);
                                alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                              } finally {
                                setLoadingProjectId(null);
                              }
                            }}
                            className={`flex items-center gap-1 px-4 py-2 bg-indigo-700 text-white text-xs font-bold rounded-lg hover:bg-indigo-800 transition-colors shadow-sm ${loadingProjectId === selectedProject.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <Printer size={14} className={loadingProjectId === selectedProject.id ? 'animate-spin' : ''} /> 
                            {loadingProjectId === selectedProject.id ? 'กำลังโหลด...' : 'พิมพ์ / ส่งออก PDF (D01)'}
                          </button>
                        )}
                        {(userRole === 'PROCUREMENT_STAFF' || userRole === 'ADMIN') && (
                          <>
                            <button 
                              disabled={loadingProjectId === selectedProject.id}
                              onClick={async () => {
                                try {
                                  setLoadingProjectId(selectedProject.id);
                                  const res = await fetch(`/api/projects/${selectedProject.id}`);
                                  const data = await safeParseJson(res);
                                  if (data) {
                                    setSelectedProject(data);
                                    setShowB01Modal(true);
                                  } else {
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  }
                                } catch (err) {
                                  console.error(err);
                                  alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                } finally {
                                  setLoadingProjectId(null);
                                }
                              }}
                              className={`flex items-center gap-1 px-4 py-2 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800 transition-colors shadow-sm ${loadingProjectId === selectedProject.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <Printer size={14} className={loadingProjectId === selectedProject.id ? 'animate-spin' : ''} /> 
                              {loadingProjectId === selectedProject.id ? 'กำลังโหลด...' : 'พิมพ์ B01'}
                            </button>
                            <button 
                              disabled={loadingProjectId === selectedProject.id}
                              onClick={async () => {
                                try {
                                  setLoadingProjectId(selectedProject.id);
                                  const res = await fetch(`/api/projects/${selectedProject.id}`);
                                  const data = await safeParseJson(res);
                                  if (data) {
                                    setSelectedProject(data);
                                    setShowB02Modal(true);
                                  } else {
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  }
                                } catch (err) {
                                  console.error(err);
                                  alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                } finally {
                                  setLoadingProjectId(null);
                                }
                              }}
                              className={`flex items-center gap-1 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800 transition-colors shadow-sm ${loadingProjectId === selectedProject.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <Printer size={14} className={loadingProjectId === selectedProject.id ? 'animate-spin' : ''} /> 
                              {loadingProjectId === selectedProject.id ? 'กำลังโหลด...' : 'พิมพ์ B02'}
                            </button>
                          </>
                        )}
                      </div>
                      
                      {/* Draft Status Banner */}
                      {selectedProject.status === 'DRAFT' && (
                        <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center font-bold text-lg shrink-0">
                              <FileText size={20} className="text-amber-800" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                                โครงการนี้อยู่ในสถานะแบบร่าง (DRAFT)
                                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px] font-bold uppercase">ยังไม่เริ่มกระบวนการ A</span>
                              </h4>
                              <p className="text-xs text-amber-700 mt-0.5">ท่านสามารถแก้ไขข้อมูลโครงการและรายการสินค้า/บริการได้ตามต้องการ เมื่อตรวจสอบความถูกต้องครบถ้วนแล้ว ให้กดปุ่ม "ส่งเข้าสู่กระบวนการ A" เพื่อเริ่มดำเนินงาน</p>
                            </div>
                          </div>
                          {(userRole === 'ADMIN' || (userRole !== 'GUEST' && selectedProject.creator_id === currentUser?.username)) && (
                            <button
                              onClick={async () => {
                                if (!window.confirm('คุณต้องการส่งโครงการนี้เข้าสู่กระบวนการ A เพื่อเริ่มต้นการดำเนินงานใช่หรือไม่?')) return;
                                try {
                                  const res = await fetch(`/api/projects/${selectedProject.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      status: 'pending'
                                    })
                                  });
                                  if (res.ok) {
                                    alert('ส่งโครงการเข้าสู่กระบวนการ A สำเร็จเรียบร้อยแล้ว');
                                    const updatedRes = await fetch(`/api/projects/${selectedProject.id}`);
                                    const updated = await safeParseJson(updatedRes);
                                    if (updated) setSelectedProject(updated);
                                    fetchProjects();
                                  } else {
                                    alert('เกิดข้อผิดพลาดในการส่งโครงการ');
                                  }
                                } catch (e) {
                                  console.error(e);
                                  alert('เกิดข้อผิดพลาดในการส่งโครงการ');
                                }
                              }}
                              className="px-5 py-2.5 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-all shadow-md shadow-red-200 flex items-center gap-2 shrink-0 cursor-pointer"
                            >
                              <CheckCircle2 size={16} />
                              ส่งเข้าสู่กระบวนการ A (เริ่มดำเนินการ)
                            </button>
                          )}
                        </div>
                      )}

                      {/* Project Code Section */}
                      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 inline-block">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Lock size={16} className="text-red-700" />
                            <span className="text-xs font-bold uppercase tracking-wider">รหัสโครงการ:</span>
                          </div>
                          {(userRole === 'PLANNING_STAFF' || userRole === 'ADMIN') ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="text"
                                value={tempProjectCode}
                                onChange={(e) => setTempProjectCode(e.target.value)}
                                placeholder="ยังไม่ได้กำหนดรหัส..."
                                className="px-3 py-1.5 text-sm font-bold text-red-700 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white w-48"
                              />
                              <button 
                                onClick={handleUpdateProjectCode}
                                className="px-3 py-1.5 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800 transition-colors"
                              >
                                บันทึกรหัส
                              </button>
                            </div>
                          ) : (
                            <span className="text-lg font-bold text-red-700">
                              {selectedProject.project_code || 'ยังไม่ได้กำหนดรหัส'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delivery Dates Section */}
                      {selectedProject.delivery_dates && (
                        <div className="mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100 inline-block ml-4 align-top">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-emerald-700 mb-1">
                              <Calendar size={16} />
                              <span className="text-xs font-bold uppercase tracking-wider">วันที่รับพัสดุ:</span>
                            </div>
                            <div className="space-y-1">
                              {(() => {
                                try {
                                  return Object.entries(JSON.parse(selectedProject.delivery_dates)).map(([shop, date]) => (
                                    <div key={shop} className="flex items-center gap-2 text-xs">
                                      <span className="font-bold text-emerald-900">{shop}:</span>
                                      <span className="text-emerald-700">{date ? formatThaiDate(date as string) : 'ยังไม่ระบุ'}</span>
                                    </div>
                                  ));
                                } catch (e) {
                                  return null;
                                }
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-6">
                        <div className="flex items-center gap-2 text-slate-500">
                          <Building2 size={18} />
                          <span className="text-sm font-medium">{selectedProject.department}</span>
                        </div>
                        {selectedProject.item_shops && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <Building2 size={18} />
                            <span className="text-sm font-medium">ร้านค้า: {selectedProject.item_shops}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-slate-500">
                          <Coins size={18} />
                          <span className="text-sm font-medium">{selectedProject.budget_amount.toLocaleString()} ฿ ({selectedProject.budget_source})</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock size={18} />
                          <span className="text-sm font-medium">อัปเดตล่าสุด: {formatThaiDateTime(selectedProject.updated_at)}</span>
                        </div>
                        {selectedProject.creator_name && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <User size={18} />
                            <span className="text-sm font-medium">ผู้สร้าง: {selectedProject.creator_name} ({selectedProject.creator_position})</span>
                          </div>
                        )}
                        {selectedProject.borrower_name && (
                          <div className="flex items-center gap-2 text-red-700">
                            <Coins size={18} />
                            <span className="text-sm font-bold">ผู้ยืมเงิน: {selectedProject.borrower_name}</span>
                          </div>
                        )}
                        {selectedProject.loan_expense_category && (
                          <div className="flex items-center gap-2 text-red-700">
                            <Coins size={18} />
                            <span className="text-sm font-bold">หมวดรายจ่าย: {selectedProject.loan_expense_category}</span>
                          </div>
                        )}
                        {selectedProject.is_other_expense && (
                          <>
                            {selectedProject.voucher_no && (
                              <div className="flex items-center gap-2 text-emerald-700">
                                <Receipt size={18} />
                                <span className="text-sm font-bold">เลขที่ใบสำคัญ: {selectedProject.voucher_no}</span>
                              </div>
                            )}
                            {selectedProject.expense_category && (
                              <div className="flex items-center gap-2 text-emerald-700">
                                <Coins size={18} />
                                <span className="text-sm font-bold">หมวดรายจ่าย: {selectedProject.expense_category}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Additional Project Info Section */}
                      {selectedProject.is_other_expense ? (
                        <div className="mt-8 p-6 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                            <h4 className="text-base font-bold text-emerald-900 flex items-center gap-2">
                              <Receipt size={20} className="text-emerald-700" />
                              ข้อมูลรายการค่าใช้จ่ายอื่น
                            </h4>
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                              กระบวนการ E (E1 - E11)
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">หมวดรายจ่ายงบประมาณ</span>
                              <span className="text-sm font-bold text-slate-800">{selectedProject.expense_category || '-'}</span>
                            </div>
                            <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">เลขที่ใบสำคัญ</span>
                              <span className="text-sm font-bold text-slate-800">{selectedProject.voucher_no || '-'}</span>
                            </div>
                            <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">แหล่งงบประมาณ (ตัดยอด)</span>
                              <span className="text-sm font-bold text-emerald-800">{selectedProject.budget_source || 'รอดำเนินการตัดยอด (E6)'}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">จำนวนเงิน (ก่อน VAT)</span>
                              <span className="text-base font-bold text-slate-900 font-mono">{(selectedProject.expense_amount || 0).toLocaleString()} ฿</span>
                            </div>
                            <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">ภาษีมูลค่าเพิ่ม (VAT)</span>
                              <span className="text-base font-bold text-slate-900 font-mono">{(selectedProject.vat_amount || 0).toLocaleString()} ฿</span>
                            </div>
                            <div className="p-4 bg-emerald-700 rounded-xl shadow-lg shadow-emerald-100 text-white">
                              <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block mb-1">รวมทั้งสิ้น</span>
                              <span className="text-xl font-bold font-mono">{(selectedProject.budget_amount || 0).toLocaleString()} ฿</span>
                            </div>
                          </div>
                          {selectedProject.expense_notes && (
                            <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">หมายเหตุ</span>
                              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedProject.expense_notes}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">ลักษณะโครงการ</h4>
                              <p className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-100 min-h-[60px]">
                                {selectedProject.project_nature || 'ไม่ได้ระบุลักษณะโครงการ'}
                              </p>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">เหตุผลความจำเป็น</h4>
                              <p className="text-sm text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-100 min-h-[60px]">
                                {selectedProject.necessity_reason || 'ไม่ได้ระบุเหตุผลความจำเป็น'}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-red-100 rounded-lg">
                                <Calendar size={18} className="text-red-700" />
                              </div>
                              <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">กำหนดการใช้วัสดุ</h4>
                                <p className="text-sm font-bold text-slate-700">{selectedProject.material_usage_date || 'ไม่ได้ระบุกำหนดการ'}</p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">งบประมาณที่ได้รับจัดสรร</h4>
                                <p className="text-lg font-bold text-slate-900">{(selectedProject.allocated_budget || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">฿</span></p>
                              </div>
                              <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">จัดซื้อจัดจ้างมาแล้ว</h4>
                                <p className="text-lg font-bold text-emerald-600">{(selectedProject.procured_amount || 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">฿</span></p>
                              </div>
                            </div>
                            <div className="p-4 bg-red-700 rounded-xl shadow-lg shadow-red-100 text-white">
                              <h4 className="text-[10px] font-bold text-red-200 uppercase tracking-wider mb-1">งบประมาณคงเหลือ</h4>
                              <p className="text-2xl font-bold">
                                {((selectedProject.allocated_budget || 0) - (selectedProject.procured_amount || 0)).toLocaleString()} ฿
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Approvers Section */}
                      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                            <User size={24} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">หัวหน้าแผนกวิชา/หัวหน้างาน</h4>
                            <p className="text-sm font-bold text-slate-900">{selectedProject.dept_head_name || '-'}</p>
                            <p className="text-[10px] text-slate-500">{selectedProject.dept_head_position || '-'}</p>
                          </div>
                        </div>
                        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                            <User size={24} />
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">รองผู้อำนวยการตามสายงาน</h4>
                            <p className="text-sm font-bold text-slate-900">{selectedProject.deputy_name || '-'}</p>
                            <p className="text-[10px] text-slate-500">{selectedProject.deputy_position || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setView('dashboard')}
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                      <ArrowRight size={24} className="rotate-180 text-slate-400" />
                    </button>
                  </div>

                {/* Items Table */}
                {selectedProject.items && selectedProject.items.length > 0 && (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <List size={20} className="text-red-700" />
                        รายการสินค้า/บริการ
                      </h4>
                      {((userRole === 'ADMIN' && selectedProject.current_process === 'A') || 
                        (userRole !== 'GUEST' && selectedProject.creator_id === currentUser?.username && (selectedProject.status === 'DRAFT' || (selectedProject.current_process === 'A' && selectedProject.current_step <= 4)))) && (
                        <button 
                          onClick={() => {
                            setIsEditingProject(true);
                            setEditProjectForm({
                              ...selectedProject,
                              items: selectedProject.items || []
                            });
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-700 text-white text-xs font-bold rounded-lg hover:bg-red-800 transition-colors shadow-sm"
                        >
                          <Plus size={14} /> แก้ไขรายการสินค้า
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ลำดับ</th>
                            <th className="text-left py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">รายการ</th>
                            <th className="text-left py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ร้านค้า</th>
                            <th className="text-center py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">จำนวน</th>
                            <th className="text-center py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">หน่วยนับ</th>
                            <th className="text-right py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ราคา/หน่วย</th>
                            <th className="text-right py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">ราคารวม</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {selectedProject.items.map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td className="py-4 text-sm text-slate-500">{idx + 1}</td>
                              <td className="py-4 text-sm font-medium text-slate-900">{item.description}</td>
                              <td className="py-4 text-sm text-slate-500 italic">{item.shop_name || '-'}</td>
                              <td className="py-4 text-sm text-center text-slate-600">{item.quantity}</td>
                              <td className="py-4 text-sm text-center text-slate-600">{item.unit}</td>
                              <td className="py-4 text-sm text-right text-slate-600">{item.unit_price.toLocaleString()} ฿</td>
                              <td className="py-4 text-sm text-right font-bold text-slate-900">{item.total_price.toLocaleString()} ฿</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50">
                            <td colSpan={6} className="py-4 px-4 text-right text-sm font-bold text-slate-600">ยอดรวมทั้งสิ้น</td>
                            <td className="py-4 px-4 text-right text-lg font-bold text-red-700">{selectedProject.budget_amount.toLocaleString()} ฿</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                  {/* Process Stepper */}
                  <div className="relative mb-12">
                    {/* Background Line */}
                    <div className="absolute top-5 left-0 w-full h-1 bg-slate-100 -z-0 rounded-full"></div>
                    
                    {/* Active Progress Line */}
                    <div 
                      className={`absolute top-5 left-0 h-1 transition-all duration-700 -z-0 rounded-full ${selectedProject.is_other_expense ? 'bg-emerald-600' : 'bg-red-600'}`}
                      style={{ 
                        width: selectedProject.is_other_expense ? (
                          '100%'
                        ) : selectedProject.is_loan ? (
                          selectedProject.current_process === 'A' ? '0%' : '100%'
                        ) : (
                          selectedProject.current_process === 'A' ? '0%' : 
                          selectedProject.current_process === 'B' ? '50%' : '100%' 
                        )
                      }}
                    ></div>

                    <div className="flex justify-between relative z-10">
                      {(selectedProject.is_other_expense ? [
                        { id: 'E', label: 'กระบวนการ E', desc: 'รายการค่าใช้จ่ายอื่น' }
                      ] : selectedProject.is_loan ? [
                        { id: 'A', label: 'กระบวนการ A', desc: 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ' },
                        { id: 'D', label: 'กระบวนการ D', desc: 'งานยืมเงินทดลองราชการ' }
                      ] : [
                        { id: 'A', label: 'กระบวนการ A', desc: 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ' },
                        { id: 'B', label: 'กระบวนการ B', desc: 'งานพัสดุ' },
                        { id: 'C', label: 'กระบวนการ C', desc: 'งานการเงิน' }
                      ]).map((proc) => {
                        const isCompleted = selectedProject.status === 'completed' || 
                                           (selectedProject.is_other_expense ? (
                                             false
                                           ) : selectedProject.is_loan ? (
                                             selectedProject.current_process === 'D' && proc.id === 'A'
                                           ) : (
                                             (selectedProject.current_process === 'B' && proc.id === 'A') || 
                                             (selectedProject.current_process === 'C' && (proc.id === 'A' || proc.id === 'B'))
                                           ));
                        const isCurrent = selectedProject.status !== 'completed' && selectedProject.current_process === proc.id;
                        
                        return (
                          <button 
                            key={proc.id}
                            onClick={() => setActiveTab(proc.id as 'A' | 'B' | 'C' | 'D' | 'E')}
                            className="flex flex-col items-center group cursor-pointer"
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${
                              isCompleted ? 'bg-emerald-500 border-emerald-100 text-white' :
                              isCurrent ? (selectedProject.is_other_expense ? 'bg-emerald-600 border-emerald-100 text-white shadow-lg shadow-emerald-200 scale-110' : 'bg-red-700 border-red-100 text-white shadow-lg shadow-red-200 scale-110') :
                              'bg-white border-slate-200 text-slate-400'
                            } ${activeTab === proc.id ? (selectedProject.is_other_expense ? 'ring-2 ring-offset-4 ring-emerald-600' : 'ring-2 ring-offset-4 ring-red-700') : ''}`}>
                              {isCompleted ? <CheckCircle2 size={20} /> : <span className="font-bold">{proc.id}</span>}
                            </div>
                            <div className="mt-4 text-center">
                              <p className={`text-sm font-bold transition-colors ${activeTab === proc.id ? (selectedProject.is_other_expense ? 'text-emerald-700' : 'text-red-700') : 'text-slate-600'}`}>{proc.label}</p>
                              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mt-1">{proc.desc}</p>
                              {isCurrent && <span className={`inline-block mt-2 px-2 py-0.5 text-[9px] font-bold rounded-full animate-pulse ${selectedProject.is_other_expense ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>สถานะปัจจุบัน</span>}
                              {isCompleted && <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] font-bold rounded-full">ดำเนินการเสร็จสิ้น</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Steps Progress */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="font-bold text-lg flex items-center gap-2">
                          <FileText className={selectedProject.is_other_expense ? "text-emerald-700" : "text-red-700"} size={20} />
                          รายละเอียดขั้นตอน: {
                            activeTab === 'A' ? 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ' : 
                            activeTab === 'B' ? 'งานพัสดุ' : 
                            activeTab === 'C' ? 'งานการเงิน' : 
                            activeTab === 'D' ? 'งานยืมเงินทดลองราชการ' : 
                            'รายการค่าใช้จ่ายอื่น (งานการเงิน / งานพัฒนายุทธศาสตร์)'
                          }
                        </h4>
                        {selectedProject.current_process === activeTab && selectedProject.status !== 'completed' && (
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${selectedProject.is_other_expense ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            กำลังดำเนินการในส่วนนี้
                          </span>
                        )}
                        {selectedProject.status === 'completed' && (selectedProject.is_other_expense ? activeTab === 'E' : selectedProject.is_loan ? activeTab === 'D' : activeTab === 'C') && (
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[10px] font-bold uppercase">
                            ดำเนินการเสร็จสิ้นทั้งหมดแล้ว
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-4 relative before:absolute before:left-[1.25rem] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
                        {PROCESS_STEPS[activeTab].map((stepName, idx) => {
                          const stepNum = idx + 1;
                          const isProcessCompleted = selectedProject.is_other_expense ? (
                                                       selectedProject.status === 'completed'
                                                     ) : selectedProject.is_loan ? (
                                                       selectedProject.current_process === 'D' && activeTab === 'A'
                                                     ) : (
                                                       (selectedProject.current_process === 'B' && activeTab === 'A') || 
                                                       (selectedProject.current_process === 'C' && (activeTab === 'A' || activeTab === 'B'))
                                                     );
                          const isStepCompleted = isProcessCompleted || (selectedProject.current_process === activeTab && (selectedProject.status === 'completed' || stepNum < selectedProject.current_step));
                          const isCurrentStep = selectedProject.current_process === activeTab && selectedProject.status !== 'completed' && stepNum === selectedProject.current_step;
                          
                          return (
                            <div 
                              key={idx}
                              className={`relative pl-12 p-4 rounded-xl border transition-all duration-300 ${
                                isCurrentStep ? (selectedProject.is_other_expense ? 'border-emerald-200 bg-emerald-50/40 ring-1 ring-emerald-100 shadow-sm' : 'border-red-200 bg-red-50/50 ring-1 ring-red-100 shadow-sm') : 
                                isStepCompleted ? 'border-emerald-100 bg-emerald-50/5' : 'border-transparent opacity-60'
                              }`}
                            >
                              {/* Step Indicator Dot on Line */}
                              <div className={`absolute left-[1.05rem] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10 ${
                                isStepCompleted ? 'bg-emerald-500' : 
                                isCurrentStep ? (selectedProject.is_other_expense ? 'bg-emerald-600 ring-4 ring-emerald-100' : 'bg-red-700 ring-4 ring-red-100') : 'bg-slate-200'
                              }`}></div>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                                    isStepCompleted ? 'bg-emerald-500 text-white' : 
                                    isCurrentStep ? (selectedProject.is_other_expense ? 'bg-emerald-600 text-white' : 'bg-red-700 text-white') : 'bg-slate-100 text-slate-400'
                                  }`}>
                                    {isStepCompleted ? <CheckCircle2 size={16} /> : stepNum}
                                  </div>
                                  <div>
                                    <p className={`text-sm font-bold ${isCurrentStep ? (selectedProject.is_other_expense ? 'text-emerald-950' : 'text-red-900') : isStepCompleted ? 'text-emerald-900' : 'text-slate-600'}`}>
                                      {stepName}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {isStepCompleted && (
                                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                          <CheckCircle2 size={10} /> เสร็จสิ้นแล้ว
                                        </span>
                                      )}
                                      {isCurrentStep && (
                                        <span className={`text-[10px] font-bold flex items-center gap-1 ${selectedProject.is_other_expense ? 'text-emerald-700' : 'text-red-700'}`}>
                                          <Clock size={10} className="animate-spin-slow" /> กำลังดำเนินการ
                                        </span>
                                      )}
                                      {!isStepCompleted && !isCurrentStep && (
                                        <span className="text-[10px] font-bold text-slate-400">รอดำเนินการ</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {selectedProject.status !== 'completed' && (
                                  canPerformStepRange(selectedProject, stepNum) ? (
                                    <div className="flex flex-col items-end gap-3">
                                      {selectedProject.current_process === 'A' && activeTab === 'A' && stepNum === 6 && isCurrentStep && (
                                        <div className="w-full max-w-2xl mt-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                                          <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                            <Coins size={14} className="text-red-700" />
                                            ข้อมูลการตรวจสอบยอดเงิน (งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ)
                                          </h5>
                                          
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">สถานะในแผน</label>
                                              <div className="flex gap-4 mt-1">
                                                {['มีอยู่ในแผน', 'ไม่มีในแผน'].map(opt => (
                                                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                                    <input 
                                                      type="radio" 
                                                      name="in_plan" 
                                                      value={opt}
                                                      checked={planningForm.in_plan === opt}
                                                      onChange={(e) => setPlanningForm({...planningForm, in_plan: e.target.value})}
                                                      className="text-red-700 focus:ring-red-500"
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">{opt}</span>
                                                  </label>
                                                ))}
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">หมวดค่าใช้จ่าย</label>
                                              <select 
                                                value={planningForm.expense_category}
                                                onChange={(e) => setPlanningForm({...planningForm, expense_category: e.target.value})}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                              >
                                                {expenseCategories.map(cat => (
                                                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                ))}
                                              </select>
                                            </div>

                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">ยอดที่ได้รับจัดสรร (บาท)</label>
                                              <input 
                                                type="number"
                                                value={planningForm.allocated_budget}
                                                onChange={(e) => {
                                                  const val = Number(e.target.value);
                                                  setPlanningForm({
                                                    ...planningForm, 
                                                    allocated_budget: val,
                                                    request_amount: val, // Set request_amount to match allocated_budget
                                                    remaining_budget: 0 // Remaining becomes 0 when they are equal
                                                  });
                                                }}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                                placeholder="0.00"
                                              />
                                            </div>

                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">ขออนุมัติครั้งนี้ (บาท)</label>
                                              <input 
                                                type="number"
                                                value={planningForm.request_amount}
                                                onChange={(e) => {
                                                  const val = Number(e.target.value);
                                                  setPlanningForm({
                                                    ...planningForm, 
                                                    request_amount: val,
                                                    remaining_budget: planningForm.allocated_budget - val
                                                  });
                                                }}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                                placeholder="0.00"
                                              />
                                            </div>

                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">คงเหลือ (บาท)</label>
                                              <input 
                                                type="number"
                                                value={planningForm.remaining_budget}
                                                readOnly
                                                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none font-bold text-red-700 cursor-not-allowed"
                                                placeholder="0.00"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      {activeTab === 'A' && [7, 8, 9, 10].includes(stepNum) && isCurrentStep && (selectedProject.in_plan || selectedProject.expense_category) && (
                                        <div className="w-full max-w-2xl mt-4 bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
                                          <h5 className="text-[10px] font-bold text-blue-500 uppercase mb-3 flex items-center gap-2">
                                            <Coins size={14} />
                                            ข้อมูลการตรวจสอบยอดเงิน (จากงานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ)
                                          </h5>
                                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                            <div>
                                              <p className="text-[9px] font-bold text-blue-400 uppercase">สถานะในแผน</p>
                                              <p className="text-xs font-bold text-blue-900">{selectedProject.in_plan}</p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-bold text-blue-400 uppercase">หมวดค่าใช้จ่าย</p>
                                              <p className="text-xs font-bold text-blue-900">{selectedProject.expense_category}</p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-bold text-blue-400 uppercase">ยอดที่ได้รับจัดสรร</p>
                                              <p className="text-xs font-bold text-blue-900">{selectedProject.allocated_budget?.toLocaleString()} ฿</p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-bold text-blue-400 uppercase">ขออนุมัติครั้งนี้</p>
                                              <p className="text-xs font-bold text-blue-900">{selectedProject.request_amount?.toLocaleString()} ฿</p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-bold text-blue-400 uppercase">คงเหลือ</p>
                                              <p className="text-xs font-bold text-blue-900">{selectedProject.remaining_budget?.toLocaleString()} ฿</p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      {selectedProject.current_process === 'B' && activeTab === 'B' && stepNum === 1 && isCurrentStep && (
                                        <div className="w-full max-w-2xl mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                          <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                            <List size={14} className="text-red-700" />
                                            รายละเอียดพัสดุและระบุร้านค้า
                                          </h5>
                                          <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                            <table className="w-full text-[10pt]">
                                              <thead className="sticky top-0 bg-white z-10">
                                                <tr className="border-b border-slate-100">
                                                  <th className="text-left py-2 px-2 text-xs font-bold text-slate-400 uppercase">รายการ</th>
                                                  <th className="text-left py-2 px-2 w-48 text-xs font-bold text-slate-400 uppercase">ชื่อร้านค้า (พัสดุระบุ)</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-50">
                                                {procurementItems.map((item, idx) => (
                                                  <tr key={item.id || idx}>
                                                    <td className="py-2 px-2 text-sm text-slate-700">{item.description}</td>
                                                    <td className="py-2 px-2">
                                                      <select 
                                                        value={item.shop_name || ''}
                                                        onChange={(e) => {
                                                          const newItems = [...procurementItems];
                                                          newItems[idx] = { ...newItems[idx], shop_name: e.target.value };
                                                          setProcurementItems(newItems);
                                                        }}
                                                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-red-500 outline-none bg-white"
                                                      >
                                                        <option value="">-- เลือกชื่อร้านค้า --</option>
                                                        {[...vendors].sort((a, b) => a.name.localeCompare(b.name, 'th')).map(v => (
                                                          <option key={v.id} value={v.name}>{v.name}</option>
                                                        ))}
                                                      </select>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}
                                      {selectedProject.current_process === 'B' && activeTab === 'B' && stepNum === 8 && isCurrentStep && (
                                        <div className="w-full max-w-2xl mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                          <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                            <Calendar size={14} className="text-red-700" />
                                            ระบุวันที่รับพัสดุ (แยกรายร้านค้า)
                                          </h5>
                                          <div className="space-y-4">
                                            {Array.from(new Set(selectedProject.items?.map(item => item.shop_name).filter(Boolean))).map((shopName) => (
                                              <div key={shopName} className="flex flex-col md:flex-row md:items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <span className="text-sm font-bold text-slate-700">{shopName}</span>
                                                <div className="flex items-center gap-2">
                                                  <label className="text-[10px] font-bold text-slate-400 uppercase">วันที่รับพัสดุ:</label>
                                                  <input 
                                                    type="date"
                                                    value={deliveryDates[shopName!] || ''}
                                                    onChange={(e) => {
                                                      const name = shopName as string;
                                                      setDeliveryDates({
                                                        ...deliveryDates,
                                                        [name]: e.target.value
                                                      });
                                                    }}
                                                    className="px-2 py-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-red-500 outline-none bg-white"
                                                  />
                                                </div>
                                              </div>
                                            ))}
                                            {(!selectedProject.items || selectedProject.items.filter(i => i.shop_name).length === 0) && (
                                              <p className="text-xs text-slate-400 italic text-center py-4">ไม่พบข้อมูลร้านค้าในรายการพัสดุ</p>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {selectedProject.current_process === 'D' && activeTab === 'D' && stepNum === 1 && isCurrentStep && (
                                        <div className="w-full max-w-2xl mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                          <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                            <User size={14} className="text-red-700" />
                                            ระบุชื่อผู้ยืมเงิน (งานพัสดุ)
                                          </h5>
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">ชื่อผู้ยืมเงิน:</label>
                                            <input 
                                              type="text"
                                              value={borrowerName}
                                              onChange={(e) => setBorrowerName(e.target.value)}
                                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                              placeholder="ระบุชื่อ-นามสกุล ผู้ยืมเงิน"
                                            />
                                          </div>
                                        </div>
                                      )}
                                      {selectedProject.current_process === 'D' && activeTab === 'D' && stepNum === 19 && isCurrentStep && (
                                        <div className="w-full max-w-2xl mt-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                          <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                            <Coins size={14} className="text-red-700" />
                                            ระบุหมวดรายจ่ายงบประมาณ(ยืมเงิน) (งานการเงิน)
                                          </h5>
                                          <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">หมวดรายจ่ายงบประมาณ(ยืมเงิน):</label>
                                            <select 
                                              value={loanExpenseCategory}
                                              onChange={(e) => setLoanExpenseCategory(e.target.value)}
                                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                            >
                                              <option value="">เลือกหมวดรายจ่าย</option>
                                              {expenseCategories.map(cat => (
                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>
                                      )}
                                      {selectedProject.current_process === 'E' && activeTab === 'E' && stepNum === 6 && isCurrentStep && (
                                        <div className="w-full max-w-2xl mt-4 bg-white p-6 rounded-xl border border-emerald-200 shadow-sm space-y-4">
                                          <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                            <Coins size={14} className="text-emerald-700" />
                                            ตรวจสอบยอดเงิน ลงข้อมูลการตัดยอดเงิน (งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ)
                                          </h5>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">แหล่งงบประมาณ</label>
                                              <input 
                                                type="text"
                                                value={otherExpensePlanningForm.budget_source || selectedProject.budget_source || ''}
                                                onChange={(e) => setOtherExpensePlanningForm({...otherExpensePlanningForm, budget_source: e.target.value})}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="เช่น เงินงบประมาณแผ่นดิน / เงินรายได้สถานศึกษา"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">หมวดค่าใช้จ่าย</label>
                                              <select 
                                                value={otherExpensePlanningForm.expense_category || selectedProject.expense_category || ''}
                                                onChange={(e) => setOtherExpensePlanningForm({...otherExpensePlanningForm, expense_category: e.target.value})}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                              >
                                                <option value="">-- เลือกหมวดค่าใช้จ่าย --</option>
                                                {expenseCategories.map(cat => (
                                                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-between">
                                            <span className="text-xs font-bold text-emerald-800">ยอดเงินตัดงบประมาณทั้งสิ้น:</span>
                                            <span className="text-base font-bold text-emerald-900 font-mono">{(selectedProject.budget_amount || 0).toLocaleString()} บาท</span>
                                          </div>
                                        </div>
                                      )}
                                      {activeTab === 'E' && [7, 8, 9, 10, 11].includes(stepNum) && isCurrentStep && (selectedProject.budget_source || selectedProject.expense_category) && (
                                        <div className="w-full max-w-2xl mt-4 bg-teal-50 p-4 rounded-xl border border-teal-100 shadow-sm">
                                          <h5 className="text-[10px] font-bold text-teal-600 uppercase mb-3 flex items-center gap-2">
                                            <Coins size={14} />
                                            ข้อมูลการตรวจสอบยอดเงินและการตัดงบประมาณ (งานพัฒนายุทธศาสตร์)
                                          </h5>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                              <p className="text-[9px] font-bold text-teal-500 uppercase">แหล่งงบประมาณ</p>
                                              <p className="text-xs font-bold text-teal-950">{selectedProject.budget_source || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-bold text-teal-500 uppercase">หมวดค่าใช้จ่าย</p>
                                              <p className="text-xs font-bold text-teal-950">{selectedProject.expense_category || '-'}</p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-bold text-teal-500 uppercase">ยอดเงินรวมทั้งสิ้น</p>
                                              <p className="text-xs font-bold text-teal-950">{selectedProject.budget_amount?.toLocaleString()} ฿</p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] font-bold text-teal-500 uppercase">เลขที่ใบสำคัญ</p>
                                              <p className="text-xs font-bold text-teal-950">{selectedProject.voucher_no || '-'}</p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      <button 
                                        onClick={() => {
                                          let extraData = undefined;
                                          if (selectedProject.current_process === 'B' && activeTab === 'B' && stepNum === 1) {
                                            extraData = procurementItems;
                                          } else if (selectedProject.current_process === 'B' && activeTab === 'B' && stepNum === 8) {
                                            extraData = { delivery_dates: JSON.stringify(deliveryDates) };
                                          } else if (selectedProject.current_process === 'A' && activeTab === 'A' && stepNum === 6) {
                                            extraData = planningForm;
                                          } else if (selectedProject.current_process === 'D' && activeTab === 'D' && stepNum === 1) {
                                            extraData = { borrower_name: borrowerName };
                                          } else if (selectedProject.current_process === 'D' && activeTab === 'D' && stepNum === 19) {
                                            extraData = { loan_expense_category: loanExpenseCategory };
                                          } else if (selectedProject.current_process === 'E' && activeTab === 'E' && stepNum === 6) {
                                            extraData = { 
                                              budget_source: otherExpensePlanningForm.budget_source || selectedProject.budget_source, 
                                              expense_category: otherExpensePlanningForm.expense_category || selectedProject.expense_category,
                                              allocated_budget: selectedProject.budget_amount,
                                              request_amount: selectedProject.budget_amount
                                            };
                                          }
                                          handleUpdateStep(selectedProject.id, selectedProject.current_process, stepNum, extraData);
                                        }}
                                        className={`px-4 py-2 text-white text-sm font-bold rounded-lg transition-colors shadow-md ${
                                          isCurrentStep ? (selectedProject.is_other_expense ? 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-100' : 'bg-red-700 hover:bg-red-800 shadow-red-100') : 'bg-slate-700 hover:bg-slate-800 shadow-slate-100'
                                        }`}
                                      >
                                        {isCurrentStep ? 'ดำเนินการแล้ว' : `ดำเนินการถึงขั้นตอนนี้ (${stepNum})`}
                                      </button>
                                    </div>
                                  ) : (
                                    isCurrentStep && (
                                      <div className="px-4 py-2 bg-slate-100 text-slate-400 text-xs font-bold rounded-lg border border-slate-200 flex items-center gap-2">
                                        <Settings size={14} />
                                        เฉพาะ{activeTab === 'A' ? (selectedProject.current_step <= 4 ? 'ผู้สร้างโครงการ/เจ้าหน้าที่วางแผน' : 'เจ้าหน้าที่วางแผน') : activeTab === 'B' ? 'พัสดุ' : activeTab === 'C' ? 'การเงิน' : activeTab === 'D' ? 'พัสดุ/การเงิน/ผู้เกี่ยวข้อง' : 'งานการเงิน/งานพัฒนายุทธศาสตร์/ผู้บริหารตามขั้นตอน'}
                                      </div>
                                    )
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Planning Info (if available) */}
                  {(selectedProject.in_plan || selectedProject.expense_category) && (
                    <div className="mt-6 p-6 bg-blue-50 rounded-2xl border border-blue-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">สถานะในแผน</h4>
                        <p className="text-sm font-bold text-blue-900">{selectedProject.in_plan || '-'}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">หมวดค่าใช้จ่าย</h4>
                        <p className="text-sm font-bold text-blue-900">{selectedProject.expense_category || '-'}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">ขออนุมัติครั้งนี้ / คงเหลือ</h4>
                        <p className="text-sm font-bold text-blue-900">
                          {(selectedProject.request_amount || 0).toLocaleString()} / {(selectedProject.remaining_budget || 0).toLocaleString()} ฿
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Committee Info */}
                  {(selectedProject.committee_chairman || selectedProject.committee_member1 || selectedProject.committee_member2) && (
                    <div className="mt-6 p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <CheckSquare size={16} />
                        คณะกรรมการตรวจรับพัสดุ
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">ประธานกรรมการ</h4>
                          <p className="text-sm font-bold text-emerald-900">{selectedProject.committee_chairman || '-'}</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">กรรมการ</h4>
                          <p className="text-sm font-bold text-emerald-900">{selectedProject.committee_member1 || '-'}</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">กรรมการ</h4>
                          <p className="text-sm font-bold text-emerald-900">{selectedProject.committee_member2 || '-'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* History & Logs */}
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                        <History className="text-slate-400" size={20} />
                        ประวัติการดำเนินการ
                      </h4>
                      <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                        {selectedProject.logs?.map((log, idx) => (
                          <div key={idx} className="relative pl-10">
                            <div className="absolute left-2.5 top-1.5 w-3 h-3 rounded-full bg-white border-2 border-red-600 z-10"></div>
                            <p className="text-xs text-slate-400 font-medium mb-1">{formatThaiDateTime(log.timestamp)}</p>
                            <p className="text-sm font-bold text-slate-800">{log.action}</p>
                            <p className="text-xs text-slate-500 mt-1">โดย: {log.actor}</p>
                            {log.notes && <p className="text-xs text-slate-400 mt-1 italic">"{log.notes}"</p>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-red-900 p-6 rounded-2xl text-white shadow-xl shadow-red-200">
                      <h4 className="font-bold mb-4">{selectedProject.status === 'completed' ? (selectedProject.is_loan ? 'เบิกจ่ายสำเร็จ' : 'จ่ายเงินสำเร็จ') : 'สรุปสถานะปัจจุบัน'}</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="opacity-70">กระบวนการ</span>
                          <span className="font-bold">{selectedProject.current_process}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="opacity-70">ขั้นตอนที่</span>
                          <span className="font-bold">{selectedProject.current_step}</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full mt-4 overflow-hidden">
                          <div 
                            className="h-full bg-red-400 transition-all duration-500" 
                            style={{ width: `${(selectedProject.current_step / PROCESS_STEPS[selectedProject.current_process].length) * 100}%` }}
                          ></div>
                        </div>
                        <p className="text-[10px] text-center opacity-50 font-bold uppercase tracking-widest mt-2">
                          {selectedProject.status === 'completed' ? (selectedProject.is_loan ? '100% เบิกจ่ายสำเร็จ' : '100% จ่ายเงินสำเร็จ') : `${Math.round((selectedProject.current_step / PROCESS_STEPS[selectedProject.current_process].length) * 100)}% Complete`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {canDeleteProject(selectedProject) && (
                      <div className="flex-1 flex flex-col gap-2">
                        {!showDeleteConfirm ? (
                          <div className="flex gap-2">
                            {(['ADMIN', 'PLANNING_STAFF', 'PLANNING_HEAD', 'DEPUTY_DIRECTOR_PLANNING'].includes(userRole) || (selectedProject.creator_id === currentUser?.username && selectedProject.status === 'DRAFT')) && (
                              <button 
                                onClick={() => {
                                  setEditProjectForm({
                                    title: selectedProject.title,
                                    department: selectedProject.department,
                                    budget_amount: selectedProject.budget_amount,
                                    budget_source: selectedProject.budget_source
                                  });
                                  setIsEditingProject(true);
                                }}
                                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                              >
                                <Settings size={18} />
                                แก้ไขข้อมูลโครงการ
                              </button>
                            )}
                            <button 
                              onClick={() => setShowDeleteConfirm(true)}
                              className="flex-1 bg-slate-100 text-red-600 font-bold py-3 rounded-xl hover:bg-red-50 border border-red-100 transition-colors flex items-center justify-center gap-2"
                            >
                              <Trash2 size={18} />
                              ลบโครงการ
                            </button>
                          </div>
                        ) : (
                          <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                            <p className="text-red-700 text-sm font-bold text-center">ยืนยันการลบโครงการ &quot;{selectedProject.title}&quot;? (ไม่สามารถย้อนกลับได้)</p>
                            <div className="flex gap-2">
                              <button 
                                disabled={isDeletingProject}
                                onClick={() => handleDeleteProject(selectedProject.id)}
                                className="flex-1 bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {isDeletingProject ? (
                                  <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>กำลังลบ...</span>
                                  </>
                                ) : (
                                  'ยืนยันลบ'
                                )}
                              </button>
                              <button 
                                disabled={isDeletingProject}
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 bg-white text-slate-600 font-bold py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <button 
                      onClick={() => setView('dashboard')}
                      className="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      กลับหน้าหลัก
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'executive' && !['GUEST', 'STAFF'].includes(userRole) && (
              <motion.div 
                key="executive"
                id="executive-summary"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6 p-6 print:p-0 print:bg-white print:block print:static print-container motion-div"
              >
                {!stats && statsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-700"></div>
                    <p className="text-slate-500 font-medium">กำลังโหลดข้อมูลสถิติ...</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden print:block text-center mb-8">
                      <h1 className="text-2xl font-bold">บทสรุปผู้บริหาร</h1>
                      <p className="text-sm">ข้อมูลสถิติการเบิกจ่ายงบประมาณ วิทยาลัยเทคนิคตรัง</p>
                      <p className="text-xs mt-1">ข้อมูลระหว่างวันที่ {statsDateRange.startDate} ถึง {statsDateRange.endDate}</p>
                    </div>

                    {/* Date Filter */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
                  <div>
                    <h3 className="font-bold text-lg">ตัวกรองข้อมูล</h3>
                    <p className="text-xs text-slate-400">กำหนดช่วงเวลาเพื่อดูสถิติการเบิกจ่าย</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {statsLoading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-700 mr-2"></div>}
                    <button 
                      onClick={() => setShowExecutivePreview(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"
                    >
                      <Printer size={18} />
                      <span>พรีวิว / พิมพ์ PDF</span>
                    </button>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="date" 
                        value={statsDateRange.startDate}
                        onChange={(e) => setStatsDateRange({...statsDateRange, startDate: e.target.value})}
                        className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                    <span className="text-slate-400">ถึง</span>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="date" 
                        value={statsDateRange.endDate}
                        onChange={(e) => setStatsDateRange({...statsDateRange, endDate: e.target.value})}
                        className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                    <button 
                      onClick={fetchStats}
                      className="p-2 bg-red-700 text-white rounded-xl hover:bg-red-800 transition-colors"
                    >
                      <Filter size={20} />
                    </button>
                  </div>
                </div>

                {statsError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle size={20} />
                    <p className="text-sm font-medium">{statsError}</p>
                    <button onClick={fetchStats} className="ml-auto text-xs font-bold underline">ลองใหม่</button>
                  </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                        <List size={24} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded uppercase">ทั้งหมด</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">จำนวนโครงการทั้งหมด</p>
                    <h3 className="text-3xl font-bold mt-1">
                      {stats?.statusCounts?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0}
                    </h3>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <Coins size={24} />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase">เบิกจ่ายแล้ว</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">ยอดเงินเบิกจ่ายรวม</p>
                    <h3 className="text-2xl font-bold mt-1">
                      {stats?.dailyPayments?.reduce((acc: number, curr: any) => acc + curr.total, 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB' }) || '฿0.00'}
                    </h3>
                  </div>
                  <button 
                    onClick={() => fetchPendingProjectsDetail('A')}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-blue-500 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <FileText size={24} />
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase">งานพัฒนายุทธศาสตร์ฯ</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">โครงการค้างที่งานพัฒนายุทธศาสตร์ฯ (A)</p>
                    <div className="flex items-end justify-between">
                      <h3 className="text-3xl font-bold mt-1">
                        {stats?.pendingByProcess?.find((p: any) => p.current_process === 'A')?.count || 0}
                      </h3>
                      <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mb-1">ดูรายชื่อ <ChevronRight size={12} /></span>
                    </div>
                  </button>
                  <button 
                    onClick={() => fetchPendingProjectsDetail('B')}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-amber-500 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
                        <Building2 size={24} />
                      </div>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded uppercase">งานพัสดุ</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">โครงการค้างที่งานพัสดุ (B)</p>
                    <div className="flex items-end justify-between">
                      <h3 className="text-3xl font-bold mt-1">
                        {stats?.pendingByProcess?.find((p: any) => p.current_process === 'B')?.count || 0}
                      </h3>
                      <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mb-1">ดูรายชื่อ <ChevronRight size={12} /></span>
                    </div>
                  </button>
                  <button 
                    onClick={() => fetchPendingProjectsDetail('C')}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-left hover:border-purple-500 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Coins size={24} />
                      </div>
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded uppercase">งานการเงิน</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">โครงการค้างที่งานการเงิน (C)</p>
                    <div className="flex items-end justify-between">
                      <h3 className="text-3xl font-bold mt-1">
                        {stats?.pendingByProcess?.find((p: any) => p.current_process === 'C')?.count || 0}
                      </h3>
                      <span className="text-[10px] text-purple-600 font-bold flex items-center gap-1 mb-1">ดูรายชื่อ <ChevronRight size={12} /></span>
                    </div>
                  </button>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h4 className="font-bold text-lg">สถิติการเบิกจ่ายรายวัน</h4>
                        <p className="text-xs text-slate-400">แสดงยอดเงินที่เบิกจ่ายสำเร็จในช่วงเวลาที่เลือก</p>
                      </div>
                    </div>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.dailyPayments || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            tickFormatter={(val) => {
                              if (!val) return '';
                              try {
                                const d = safeDate(val);
                                return !d || isNaN(d.getTime()) ? val : format(d, 'dd/MM');
                              } catch (e) {
                                return val;
                              }
                            }}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            tickFormatter={(val) => `฿${(val/1000).toFixed(0)}k`}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [value.toLocaleString('th-TH', { style: 'currency', currency: 'THB' }), 'ยอดเงิน']}
                            labelFormatter={(label) => {
                              if (!label) return '';
                              try {
                                const d = safeDate(label);
                                return !d || isNaN(d.getTime()) ? label : format(d, 'dd MMMM yyyy');
                              } catch (e) {
                                return label;
                              }
                            }}
                          />
                          <Bar dataKey="total" fill="#b91c1c" radius={[4, 4, 0, 0]} barSize={30} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-lg mb-8">สัดส่วนโครงการค้างจ่าย</h4>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats?.pendingByProcess || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="count"
                            nameKey="current_process"
                          >
                            {stats?.pendingByProcess?.map((entry: any, index: number) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.current_process === 'A' ? '#3b82f6' : entry.current_process === 'B' ? '#f59e0b' : '#a855f7'} 
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                          <span className="text-slate-600">งานพัฒนายุทธศาสตร์ฯ (A)</span>
                        </div>
                        <span className="font-bold">{stats?.pendingByProcess?.find((p: any) => p.current_process === 'A')?.count || 0} โครงการ</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                          <span className="text-slate-600">งานพัสดุ (B)</span>
                        </div>
                        <span className="font-bold">{stats?.pendingByProcess?.find((p: any) => p.current_process === 'B')?.count || 0} โครงการ</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                          <span className="text-slate-600">งานการเงิน (C)</span>
                        </div>
                        <span className="font-bold">{stats?.pendingByProcess?.find((p: any) => p.current_process === 'C')?.count || 0} โครงการ</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly/Yearly Summary & Shop Payments */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                      <Calendar className="text-slate-400" size={20} />
                      สรุปรายเดือน
                    </h4>
                    <div className="space-y-4">
                      {stats?.monthlyPayments?.slice(-5).reverse().map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{item.month}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">ยอดเบิกจ่าย</p>
                          </div>
                          <p className="font-bold text-emerald-600">{item.total.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                        </div>
                      ))}
                      {(!stats?.monthlyPayments || stats.monthlyPayments.length === 0) && (
                        <p className="text-center text-slate-400 py-8 text-sm italic">ไม่มีข้อมูลการเบิกจ่ายในเดือนที่เลือก</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                      <Building2 className="text-slate-400" size={20} />
                      ยอดเบิกจ่ายรายแผนกวิชา/งาน
                    </h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {stats?.departmentPayments?.map((item: any, idx: number) => (
                        <button 
                          key={idx} 
                          onClick={() => fetchDepartmentProjectsDetail(item.department)}
                          className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left"
                        >
                          <div className="flex-1 mr-4">
                            <p className="text-sm font-bold text-slate-800 truncate">{item.department || 'ไม่ระบุแผนก'}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">{item.project_count} โครงการ</p>
                          </div>
                          <p className="font-bold text-emerald-700 whitespace-nowrap">{item.total_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                        </button>
                      ))}
                      {(!stats?.departmentPayments || stats.departmentPayments.length === 0) && (
                        <p className="text-center text-slate-400 py-8 text-sm italic">ไม่มีข้อมูลแผนกในช่วงเวลาที่เลือก</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                      <Coins className="text-red-600" size={20} />
                      โครงการยืมเงินรายแผนกวิชา/งาน
                    </h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {stats?.loanDepartmentPayments?.map((item: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="w-full flex items-center justify-between p-4 bg-red-50/50 rounded-xl border border-red-100"
                        >
                          <div className="flex-1 mr-4">
                            <p className="text-sm font-bold text-slate-800 truncate">{item.department || 'ไม่ระบุแผนก'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-500 uppercase font-bold">ทั้งหมด {item.project_count}</span>
                              <span className="text-[10px] text-emerald-600 uppercase font-bold">สำเร็จ {item.completed_count}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-red-700 whitespace-nowrap">{item.total_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })}</p>
                            <p className="text-[10px] text-emerald-600 font-bold">เบิกจ่าย: {item.completed_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })}</p>
                          </div>
                        </div>
                      ))}
                      {(!stats?.loanDepartmentPayments || stats.loanDepartmentPayments.length === 0) && (
                        <p className="text-center text-slate-400 py-8 text-sm italic">ไม่มีข้อมูลโครงการยืมเงินในช่วงเวลาที่เลือก</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                      <Building2 className="text-slate-400" size={20} />
                      ยอดเบิกจ่ายรายร้านค้า
                    </h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {stats?.shopPayments?.map((item: any, idx: number) => (
                        <button 
                          key={idx} 
                          onClick={() => fetchShopProjectsDetail(item.shop_name)}
                          className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-left"
                        >
                          <div className="flex-1 mr-4">
                            <p className="text-sm font-bold text-slate-800 truncate">{item.shop_name}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">{item.project_count} โครงการ</p>
                          </div>
                          <p className="font-bold text-red-700 whitespace-nowrap">{item.total_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                        </button>
                      ))}
                      {(!stats?.shopPayments || stats.shopPayments.length === 0) && (
                        <p className="text-center text-slate-400 py-8 text-sm italic">ไม่มีข้อมูลร้านค้าในช่วงเวลาที่เลือก</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-lg mb-6 flex items-center gap-2">
                      <Coins className="text-slate-400" size={20} />
                      ยอดเบิกจ่ายแยกตามแหล่งงบประมาณ
                    </h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {stats?.budgetSourcePayments?.map((item: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl"
                        >
                          <div className="flex-1 mr-4">
                            <p className="text-sm font-bold text-slate-800 truncate">{item.budget_source || 'ไม่ระบุแหล่งงบประมาณ'}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-bold">{item.project_count} โครงการ</p>
                          </div>
                          <p className="font-bold text-blue-700 whitespace-nowrap">{item.total_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                        </div>
                      ))}
                      {(!stats?.budgetSourcePayments || stats.budgetSourcePayments.length === 0) && (
                        <p className="text-center text-slate-400 py-8 text-sm italic">ไม่มีข้อมูลแหล่งงบประมาณในช่วงเวลาที่เลือก</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Item Analysis Section */}
                <div id="item-analysis-section" className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="hidden print:block mb-6 border-b pb-4">
                    <h2 className="text-2xl font-bold text-center">รายงานวิเคราะห์การจัดซื้อรายการสินค้า</h2>
                    <p className="text-sm text-center">ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH')} เวลา {new Date().toLocaleTimeString('th-TH')}</p>
                    {itemSearchQuery && <p className="text-sm text-center mt-2">คำค้นหา: "{itemSearchQuery}"</p>}
                  </div>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                      <h4 className="font-bold text-xl flex items-center gap-2">
                        <Search className="text-red-700" size={24} />
                        วิเคราะห์การจัดซื้อรายการสินค้า
                      </h4>
                      <p className="text-sm text-slate-400">ค้นหาและตรวจสอบจำนวนการจัดซื้อสินค้าแต่ละรายการจากโครงการที่เบิกจ่ายแล้ว</p>
                    </div>
                    <form onSubmit={handleItemSearch} className="flex-1 max-w-md w-full relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="ค้นหาชื่อสินค้า... (เช่น กระดาษ, หมึกพิมพ์)"
                        value={itemSearchQuery}
                        onChange={(e) => setItemSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      />
                      <button 
                        type="submit"
                        disabled={itemSearchLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors disabled:opacity-50"
                      >
                        {itemSearchLoading ? 'กำลังค้น...' : 'ค้นหา'}
                      </button>
                    </form>
                    <button 
                      onClick={() => window.print()}
                      className="flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 text-xs font-bold rounded-2xl hover:bg-slate-200 transition-colors print:hidden"
                    >
                      <Printer size={18} />
                      พิมพ์ผลการค้นหา
                    </button>
                  </div>

                  {itemSearchResults.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-semibold">รายการสินค้า</th>
                            <th className="px-6 py-4 font-semibold text-center">จำนวนรวม</th>
                            <th className="px-6 py-4 font-semibold text-center">หน่วยนับ</th>
                            <th className="px-6 py-4 font-semibold text-right">ยอดเงินรวม</th>
                            <th className="px-6 py-4 font-semibold text-center">จำนวนโครงการ</th>
                            <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itemSearchResults.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-800">{item.description}</td>
                              <td className="px-6 py-4 text-center font-bold text-red-700">{item.total_quantity.toLocaleString()}</td>
                              <td className="px-6 py-4 text-center text-slate-500">{item.unit}</td>
                              <td className="px-6 py-4 text-right font-bold text-emerald-600">{item.total_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</td>
                              <td className="px-6 py-4 text-center">
                                <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg">{item.project_count} โครงการ</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button 
                                  onClick={() => fetchItemDetails(item.description)}
                                  className="text-xs font-bold text-blue-600 hover:underline"
                                >
                                  ดูประวัติการซื้อ
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : itemSearchQuery && !itemSearchLoading ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-slate-400 italic">ไม่พบข้อมูลสินค้าที่ค้นหา</p>
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <p className="text-slate-400">พิมพ์ชื่อสินค้าที่ต้องการวิเคราะห์ในช่องค้นหาด้านบน</p>
                    </div>
                  )}
                </div>

                {/* Modals for Details */}
                <AnimatePresence>
                  {showPendingModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sarabun"
                      >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                          <div>
                            <h3 className="font-bold text-xl">โครงการค้างที่งาน {selectedProcessForList === 'A' ? 'วางแผน' : selectedProcessForList === 'B' ? 'พัสดุ' : 'การเงิน'}</h3>
                            <p className="text-xs text-slate-500">พบทั้งหมด {pendingProjectsList.length} รายการ</p>
                          </div>
                          <button onClick={() => setShowPendingModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <Plus className="rotate-45 text-slate-400" size={24} />
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                          <div className="space-y-4">
                            {pendingProjectsList.map((p) => (
                              <div key={p.id} className="p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors flex justify-between items-center">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.project_code || 'ยังไม่มีรหัส'}</p>
                                  <h4 className="font-bold text-slate-800">{p.title}</h4>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {p.department} • {p.budget_source}
                                    {p.item_shops && (
                                      <span className="block text-[10px] text-amber-600 font-bold mt-0.5">ร้าน: {p.item_shops}</span>
                                    )}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-red-700">{p.budget_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                                  <button 
                                    onClick={() => {
                                      setSelectedProject(p);
                                      setView('detail');
                                      setShowPendingModal(false);
                                    }}
                                    className="text-[10px] font-bold text-blue-600 hover:underline mt-1"
                                  >
                                    ดูรายละเอียด
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {showShopModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sarabun"
                      >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                          <div>
                            <h3 className="font-bold text-xl">ประวัติการเบิกจ่าย: {selectedShopForList}</h3>
                            <p className="text-xs text-slate-500">ยอดรวม {shopProjectsList.reduce((acc, curr) => acc + curr.budget_amount, 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB' })} ({shopProjectsList.length} รายการ)</p>
                          </div>
                          <button onClick={() => setShowShopModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <Plus className="rotate-45 text-slate-400" size={24} />
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                          <div className="space-y-4">
                            {shopProjectsList.map((p) => (
                              <div key={p.id} className="p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors flex justify-between items-center">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.project_code}</p>
                                  <h4 className="font-bold text-slate-800">{p.title}</h4>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {p.department} • {formatThaiDate(p.updated_at)}
                                    {p.item_shops && (
                                      <span className="block text-[10px] text-amber-600 font-bold mt-0.5">ร้านทั้งหมด: {p.item_shops}</span>
                                    )}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-emerald-600">{p.budget_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                                  <button 
                                    onClick={() => {
                                      setSelectedProject(p);
                                      setView('detail');
                                      setShowShopModal(false);
                                    }}
                                    className="text-[10px] font-bold text-blue-600 hover:underline mt-1"
                                  >
                                    ดูรายละเอียด
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {showDepartmentModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sarabun"
                      >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                          <div>
                            <h3 className="font-bold text-xl">ประวัติการเบิกจ่าย: {selectedDepartmentForList}</h3>
                            <p className="text-xs text-slate-500">ยอดรวม {departmentProjectsList.reduce((acc, curr) => acc + curr.budget_amount, 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB' })} ({departmentProjectsList.length} รายการ)</p>
                          </div>
                          <button onClick={() => setShowDepartmentModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <Plus className="rotate-45 text-slate-400" size={24} />
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                          <div className="space-y-4">
                            {departmentProjectsList.map((p) => (
                              <div key={p.id} className="p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors flex justify-between items-center">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.project_code}</p>
                                  <h4 className="font-bold text-slate-800">{p.title}</h4>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {p.department} • {formatThaiDate(p.updated_at)}
                                    {p.item_shops && (
                                      <span className="block text-[10px] text-amber-600 font-bold mt-0.5">ร้านทั้งหมด: {p.item_shops}</span>
                                    )}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-emerald-600">{p.budget_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB' })}</p>
                                  <button 
                                    onClick={() => {
                                      setSelectedProject(p);
                                      setView('detail');
                                      setShowDepartmentModal(false);
                                    }}
                                    className="text-[10px] font-bold text-blue-600 hover:underline mt-1"
                                  >
                                    ดูรายละเอียด
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {showItemDetailsModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                      <motion.div 
                        id="item-details-modal"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white w-full max-w-5xl max-h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col font-sarabun"
                      >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                          <div className="hidden print:block mb-4">
                            <h2 className="text-2xl font-bold">รายงานประวัติการจัดซื้อสินค้า</h2>
                            <p className="text-sm">ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH')} เวลา {new Date().toLocaleTimeString('th-TH')}</p>
                          </div>
                          <div>
                            <h3 className="font-bold text-xl">ประวัติการจัดซื้อ: {selectedItemName}</h3>
                            <p className="text-xs text-slate-500">พบทั้งหมด {selectedItemDetails.length} รายการจัดซื้อ</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => window.print()}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors print:hidden"
                            >
                              <Printer size={16} />
                              พิมพ์ประวัติ
                            </button>
                            <button onClick={() => setShowItemDetailsModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors print:hidden">
                              <Plus className="rotate-45 text-slate-400" size={24} />
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                                  <th className="px-4 py-3 font-semibold">วันที่เบิกจ่าย</th>
                                  <th className="px-4 py-3 font-semibold">โครงการ</th>
                                  <th className="px-4 py-3 font-semibold">แผนก/งาน</th>
                                  <th className="px-4 py-3 font-semibold text-center">จำนวน</th>
                                  <th className="px-4 py-3 font-semibold text-center">หน่วย</th>
                                  <th className="px-4 py-3 font-semibold text-right">ราคา/หน่วย</th>
                                  <th className="px-4 py-3 font-semibold text-right">รวม</th>
                                  <th className="px-4 py-3 font-semibold">ร้านค้า</th>
                                  <th className="px-4 py-3 font-semibold"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {selectedItemDetails.map((detail, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 transition-colors text-xs">
                                    <td className="px-4 py-3 text-slate-500">{formatThaiDate(detail.updated_at)}</td>
                                    <td className="px-4 py-3">
                                      <p className="font-bold text-slate-800">{detail.title}</p>
                                      <p className="text-[10px] text-slate-400">{detail.project_code}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{detail.department}</td>
                                    <td className="px-4 py-3 text-center font-bold">{detail.quantity.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-center text-slate-500">{detail.unit}</td>
                                    <td className="px-4 py-3 text-right">{detail.unit_price.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{detail.total_price.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-slate-600">{detail.shop_name || '-'}</td>
                                    <td className="px-4 py-3 text-right">
                                      <button 
                                        onClick={() => {
                                          const p = projects.find(proj => proj.id === detail.id);
                                          if (p) {
                                            setSelectedProject(p);
                                            setView('detail');
                                            setShowItemDetailsModal(false);
                                          }
                                        }}
                                        className="text-[10px] font-bold text-blue-600 hover:underline"
                                      >
                                        ดูโครงการ
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        )}

            {view === 'users' && ['ADMIN', 'PLANNING_HEAD', 'PLANNING_STAFF', 'DEPUTY_DIRECTOR_PLANNING'].includes(userRole) && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* กำหนดและจัดการปีงบประมาณ สำหรับ ADMIN และงานยุทธศาสตร์ */}
                <FiscalYearManager 
                  currentUser={currentUser} 
                  userRole={userRole} 
                  onFiscalYearChanged={(year) => {
                    setCurrentFiscalYear(year);
                    fetchFiscalYears();
                    fetchBudgetSources();
                    fetchExpenseCategories();
                  }}
                />

                {userRole === 'ADMIN' && (() => {
                  const filteredUsers = users.filter((u) => {
                    if (!userSearchQuery.trim()) return true;
                    const q = userSearchQuery.toLowerCase().trim();
                    return (
                      (u.username || '').toLowerCase().includes(q) ||
                      (u.name || '').toLowerCase().includes(q) ||
                      (u.position || '').toLowerCase().includes(q) ||
                      (u.role || '').toLowerCase().includes(q) ||
                      (u.email || '').toLowerCase().includes(q)
                    );
                  });

                  return (
                    <div className="space-y-4">
                      {/* GitHub & Persistence Information Banner */}
                      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-indigo-500/30 shadow-lg">
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                          <div className="space-y-1.5 max-w-3xl">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                ระบบพร้อมเชื่อมต่อ GitHub
                              </span>
                              <span className="text-xs text-slate-300 font-medium">
                                ฐานข้อมูลบุคลากรวิทยาลัย: <strong className="text-amber-300 font-bold">{users.length} บัญชี</strong>
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white flex items-center gap-2">
                              💡 ทำไมนำข้อมูลไปลงใน GitHub จึงไม่มีข้อมูลชื่อผู้ใช้งานทั้งหมด?
                            </h4>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              Git เป็นระบบเก็บซอร์สโค้ด (Source Code) ไม่ใช่ฐานข้อมูลสด โดยปกติฐานข้อมูล SQLite (<code className="text-amber-300 bg-slate-800/80 px-1 py-0.5 rounded font-mono">procurement.db</code>) จะทำงานเฉพาะบนเครื่องนั้นๆ ระบบจึงได้ทำการเชื่อมโยงข้อมูลผู้ใช้ทั้งหมด <strong className="text-white">203 บัญชี</strong> บันทึกลงในไฟล์ <code className="text-amber-300 bg-slate-800/80 px-1.5 py-0.5 rounded font-mono font-bold">src/data/initialUsers.json</code> เพื่อให้ไฟล์นี้ถูกส่งขึ้น GitHub ได้ 100% และทุกครั้งที่มีการเพิ่ม/แก้ไขผู้ใช้ ระบบจะอัปเดตไฟล์นี้ให้อัตโนมัติ
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button 
                              type="button"
                              onClick={handleSaveUsersToGit}
                              disabled={isSavingToGit}
                              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-950/60 disabled:opacity-50"
                            >
                              <Save size={16} />
                              {isSavingToGit ? 'กำลังบันทึกลงไฟล์...' : 'บันทึกลงไฟล์ Git (Sync to GitHub)'}
                            </button>
                            <button 
                              type="button"
                              onClick={handleExportUsersJson}
                              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700"
                            >
                              <FileDown size={15} />
                              ส่งออก JSON
                            </button>
                            <button 
                              type="button"
                              onClick={handleExportUsersCsv}
                              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700"
                            >
                              <Download size={15} />
                              ส่งออก CSV
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Main Users Management Card */}
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg text-slate-800">จัดการผู้ใช้งานและบุคลากร</h3>
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                                {users.length} รายการ
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">ตรวจสอบ แก้ไขรหัสผ่าน บทบาท และนำเข้า/ส่งออกบัญชีบุคลากร</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button 
                              onClick={openAddUserModal}
                              className="flex items-center gap-2 px-3.5 py-2 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors shadow-xs"
                            >
                              <Plus size={16} />
                              เพิ่มผู้ใช้งานใหม่
                            </button>
                            <button 
                              onClick={downloadCsvTemplate}
                              className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors border border-slate-200"
                            >
                              <Download size={15} />
                              เทมเพลต CSV
                            </button>
                            <label className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-xs">
                              <Upload size={15} />
                              นำเข้า CSV
                              <input 
                                type="file" 
                                accept=".csv" 
                                className="hidden" 
                                onChange={handleCsvImport}
                              />
                            </label>
                            <button 
                              onClick={handleSyncUsers}
                              className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors border border-blue-200"
                              title="โหลดข้อมูลบุคลากรทั้งหมด 203 คนจากไฟล์ initialUsers.json กลับเข้าสู่ระบบ"
                            >
                              <Settings size={15} />
                              ซิงค์บัญชี 203 คน
                            </button>
                          </div>
                        </div>

                        {/* Search & Filter Bar */}
                        <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                          <div className="relative flex-1 min-w-[240px] max-w-md">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                              type="text"
                              value={userSearchQuery}
                              onChange={(e) => setUserSearchQuery(e.target.value)}
                              placeholder="ค้นหาชื่อผู้ใช้, ชื่อ-นามสกุล, ตำแหน่ง, บทบาท (STAFF, ADMIN, etc.)..."
                              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-500"
                            />
                            {userSearchQuery && (
                              <button 
                                onClick={() => setUserSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>แสดง <strong>{filteredUsers.length}</strong> จาก <strong>{users.length}</strong> บัญชี</span>
                          </div>
                        </div>

                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                          <table className="w-full text-left">
                            <thead className="sticky top-0 z-10 bg-slate-100">
                              <tr className="text-slate-600 text-xs uppercase tracking-wider">
                                <th className="px-6 py-3.5 font-bold">ชื่อผู้ใช้ (Username)</th>
                                <th className="px-6 py-3.5 font-bold">ชื่อ-นามสกุล</th>
                                <th className="px-6 py-3.5 font-bold">ตำแหน่ง</th>
                                <th className="px-6 py-3.5 font-bold">บทบาท (Role)</th>
                                <th className="px-6 py-3.5 font-bold">อีเมล</th>
                                <th className="px-6 py-3.5 font-bold text-right">การจัดการ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredUsers.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                                    ไม่พบรายชื่อผู้ใช้งานที่ตรงกับ "{userSearchQuery}"
                                  </td>
                                </tr>
                              ) : (
                                filteredUsers.map((user) => (
                                  <tr key={user.username} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-6 py-3.5 font-mono text-xs font-bold text-slate-700">
                                      {user.username}
                                    </td>
                                    <td className="px-6 py-3.5 text-sm font-semibold text-slate-800">
                                      {user.name}
                                    </td>
                                    <td className="px-6 py-3.5 text-xs text-slate-600">
                                      {user.position}
                                    </td>
                                    <td className="px-6 py-3.5">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                        user.role === 'ADMIN' ? 'bg-red-600 text-white' :
                                        user.role.includes('HEAD') ? 'bg-amber-100 text-amber-800' :
                                        user.role.includes('DIRECTOR') ? 'bg-purple-100 text-purple-800' :
                                        'bg-slate-100 text-slate-700'
                                      }`}>
                                        {user.role}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3.5 text-xs text-slate-500 font-mono">
                                      {user.email || '-'}
                                    </td>
                                    <td className="px-6 py-3.5 text-right">
                                      <div className="flex items-center justify-end gap-2.5">
                                        <button 
                                          onClick={() => openEditUserModal(user)}
                                          className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                        >
                                          <Settings size={12} />
                                          แก้ไข
                                        </button>
                                        {user.username !== 'admin' && (
                                          <button 
                                            onClick={() => handleDeleteUser(user.username)}
                                            className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline flex items-center gap-1"
                                          >
                                            <Plus size={12} className="rotate-45" />
                                            ลบ
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">จัดการแหล่งงบประมาณ</h3>
                      <p className="text-xs text-slate-400">เพิ่มหรือลบหมวดเงิน/แหล่งงบประมาณในระบบ</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button"
                        onClick={() => setView('budgets')}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors border border-slate-200"
                      >
                        <Landmark size={15} />
                        เปิดฐานข้อมูลงบประมาณฉบับเต็ม
                      </button>
                      <button 
                        onClick={handleAddBudgetSource}
                        className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors"
                      >
                        <Plus size={16} />
                        เพิ่มแหล่งงบประมาณ
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">ชื่อแหล่งงบประมาณ</th>
                          <th className="px-6 py-4 font-semibold">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {budgetSources.map((source) => (
                          <tr key={source.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{source.name}</td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => handleDeleteBudgetSource(source.id)}
                                className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                              >
                                <Plus size={12} className="rotate-45" />
                                ลบ
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg">จัดการหมวดค่าใช้จ่าย</h3>
                      <p className="text-xs text-slate-400">เพิ่มหรือลบหมวดค่าใช้จ่ายในระบบ</p>
                    </div>
                    <button 
                      onClick={handleAddExpenseCategory}
                      className="flex items-center gap-2 px-4 py-2 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors"
                    >
                      <Plus size={16} />
                      เพิ่มหมวดค่าใช้จ่าย
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">ชื่อหมวดค่าใช้จ่าย</th>
                          <th className="px-6 py-4 font-semibold">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {expenseCategories.map((cat) => (
                          <tr key={cat.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{cat.name}</td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => handleDeleteExpenseCategory(cat.id)}
                                className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                              >
                                <Plus size={12} className="rotate-45" />
                                ลบ
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {userRole === 'ADMIN' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="font-bold text-lg">สำรองและคืนค่าข้อมูล</h3>
                      <p className="text-xs text-slate-400">สำรองฐานข้อมูลเก็บไว้ หรือคืนค่าฐานข้อมูลจากไฟล์สำรอง</p>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-4">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                          <Download size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">สำรองข้อมูล (Backup)</h4>
                          <p className="text-xs text-slate-500 mt-1">ดาวน์โหลดไฟล์ฐานข้อมูล (.db) เก็บไว้ในเครื่องของคุณ</p>
                        </div>
                        <button 
                          onClick={handleBackup}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          <Download size={18} />
                          ดาวน์โหลดไฟล์สำรอง
                        </button>
                      </div>

                      <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center text-center space-y-4">
                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                          <Upload size={24} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800">คืนค่าข้อมูล (Restore)</h4>
                          <p className="text-xs text-slate-500 mt-1 text-red-500 font-medium">คำเตือน: ข้อมูลปัจจุบันจะถูกแทนที่ด้วยข้อมูลจากไฟล์สำรอง</p>
                        </div>
                        <label className="w-full cursor-pointer">
                          <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition-colors">
                            <Upload size={18} />
                            เลือกไฟล์เพื่อคืนค่า
                          </div>
                          <input 
                            type="file" 
                            accept=".db" 
                            onChange={handleRestore}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {view === 'vendors' && ['ADMIN', 'PROCUREMENT_STAFF'].includes(userRole) && (() => {
              const filteredVendors = vendors.filter(v => 
                (v.name || '').toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
                (v.tax_id || '').includes(vendorSearchQuery) ||
                (v.address || '').toLowerCase().includes(vendorSearchQuery.toLowerCase()) ||
                (v.phone || '').includes(vendorSearchQuery) ||
                (v.bank_account || '').includes(vendorSearchQuery) ||
                (v.bank_name || '').toLowerCase().includes(vendorSearchQuery.toLowerCase())
              );

              return (
                <motion.div 
                  key="vendors"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {/* GitHub & Persistence Information Banner */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-indigo-500/30 shadow-lg">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                      <div className="space-y-1.5 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            ระบบพร้อมเชื่อมต่อ GitHub
                          </span>
                          <span className="text-xs text-slate-300 font-medium">
                            ฐานข้อมูลร้านค้า: <strong className="text-amber-300 font-bold">{vendors.length} ร้านค้า</strong>
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          💡 นำข้อมูลร้านค้าลงไฟล์ Git เพื่อพร้อมใช้งานบน GitHub
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          ระบบได้บันทึกข้อมูลร้านค้าทั้งหมด <strong className="text-white">38 ร้านค้า</strong> ลงในไฟล์ <code className="text-amber-300 bg-slate-800/80 px-1.5 py-0.5 rounded font-mono font-bold">src/data/initialVendors.json</code> เรียบร้อยแล้ว เพื่อให้ข้อมูลนี้ถูกส่งขึ้น GitHub ได้ 100% ทุกครั้งที่มีการเพิ่ม แก้ไข หรือนำเข้าร้านค้า ระบบจะอัปเดตไฟล์ JSON นี้ให้อัตโนมัติทันที
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button 
                          type="button"
                          onClick={handleSaveVendorsToGit}
                          disabled={isSavingVendorsToGit}
                          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-950/60 disabled:opacity-50"
                        >
                          <Save size={16} />
                          {isSavingVendorsToGit ? 'กำลังบันทึกลงไฟล์...' : 'บันทึกลงไฟล์ Git (Sync to GitHub)'}
                        </button>
                        <button 
                          type="button"
                          onClick={handleExportVendorsJson}
                          className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700"
                        >
                          <FileDown size={15} />
                          ส่งออก JSON
                        </button>
                        <button 
                          type="button"
                          onClick={handleExportVendorsCsv}
                          className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-700"
                        >
                          <Download size={15} />
                          ส่งออก CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Main Vendors Management Card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg text-slate-800">ฐานข้อมูลร้านค้าและคู่ค้า</h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                            {vendors.length} ร้าน
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">จัดการข้อมูลร้านค้า คู่สัญญา และเลขบัญชีธนาคารสำหรับออกเอกสารจัดซื้อจัดจ้าง</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button 
                          onClick={openAddVendorModal}
                          className="flex items-center gap-2 px-3.5 py-2 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors shadow-xs"
                        >
                          <Plus size={16} />
                          เพิ่มร้านค้าใหม่
                        </button>
                        <button 
                          onClick={downloadVendorCsvTemplate}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors border border-slate-200"
                        >
                          <Download size={15} />
                          เทมเพลต CSV
                        </button>
                        <label className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-xs">
                          <Upload size={15} />
                          นำเข้า CSV
                          <input 
                            type="file" 
                            accept=".csv" 
                            className="hidden" 
                            onChange={handleCsvImportVendors}
                          />
                        </label>
                        <button 
                          onClick={handleSyncVendors}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors border border-blue-200"
                          title="โหลดข้อมูลร้านค้าทั้งหมด 38 ร้านจากไฟล์ initialVendors.json กลับเข้าสู่ระบบ"
                        >
                          <Settings size={15} />
                          ซิงค์ร้านค้า 38 ร้าน
                        </button>
                      </div>
                    </div>

                    {/* Search Bar */}
                    <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="relative flex-1 min-w-[240px] max-w-md">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text"
                          placeholder="ค้นหาร้านค้า, เลขผู้เสียภาษี, เลขที่บัญชี, ที่อยู่, เบอร์โทร..."
                          value={vendorSearchQuery}
                          onChange={(e) => setVendorSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-red-500"
                        />
                        {vendorSearchQuery && (
                          <button 
                            onClick={() => setVendorSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>แสดง <strong>{filteredVendors.length}</strong> จาก <strong>{vendors.length}</strong> ร้านค้า</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 z-10 bg-slate-100">
                          <tr className="text-slate-600 text-xs uppercase tracking-wider">
                            <th className="px-6 py-3.5 font-bold">ชื่อร้านค้า / ที่อยู่</th>
                            <th className="px-6 py-3.5 font-bold">เบอร์โทรศัพท์</th>
                            <th className="px-6 py-3.5 font-bold">เลขผู้เสียภาษี</th>
                            <th className="px-6 py-3.5 font-bold">ธนาคาร</th>
                            <th className="px-6 py-3.5 font-bold">เลขที่บัญชี</th>
                            <th className="px-6 py-3.5 font-bold text-right">การจัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredVendors.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                                ไม่พบข้อมูลร้านค้าที่ตรงกับ "{vendorSearchQuery}"
                              </td>
                            </tr>
                          ) : (
                            filteredVendors.map((vendor) => (
                              <tr key={vendor.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-3.5">
                                  <div className="text-sm font-bold text-slate-800">{vendor.name}</div>
                                  <div className="text-xs text-slate-400 max-w-sm truncate mt-0.5">{vendor.address || '-'}</div>
                                </td>
                                <td className="px-6 py-3.5 text-xs text-slate-600">{vendor.phone || '-'}</td>
                                <td className="px-6 py-3.5 text-xs font-mono text-slate-600">{vendor.tax_id || '-'}</td>
                                <td className="px-6 py-3.5 text-xs text-slate-600">{vendor.bank_name || '-'}</td>
                                <td className="px-6 py-3.5 text-xs font-mono text-slate-600">{vendor.bank_account || '-'}</td>
                                <td className="px-6 py-3.5 text-right">
                                  <div className="flex items-center justify-end gap-2.5">
                                    <button 
                                      onClick={() => openEditVendorModal(vendor)}
                                      className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                                    >
                                      <Settings size={12} />
                                      แก้ไข
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteVendor(vendor.id)}
                                      className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline flex items-center gap-1"
                                    >
                                      <Plus size={12} className="rotate-45" />
                                      ลบ
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {view === 'projects-db' && (
              currentUser && userRole !== 'GUEST' ? (
                <motion.div 
                  key="projects-db"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <ProjectDatabaseView
                    currentUser={currentUser}
                    userRole={userRole}
                    projects={projects}
                    budgetSources={budgetSources}
                    expenseCategories={expenseCategories}
                    onRefreshProjects={fetchProjects}
                    onSelectProject={(proj) => {
                      setSelectedProject(proj);
                      setView('detail');
                    }}
                    onNavigateToPrint={(proj, formType) => {
                      setSelectedProject(proj);
                      setView(formType as any);
                    }}
                  />
                </motion.div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-md mx-auto my-12 shadow-sm">
                  <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Lock size={30} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">ต้องเข้าสู่ระบบก่อนเข้าใช้งาน</h3>
                  <p className="text-xs text-slate-500 mb-6">เมนู "ฐานข้อมูลโครงการ" สงวนสิทธิ์การเข้าถึงเฉพาะผู้ที่เข้าสู่ระบบเท่านั้น</p>
                  <button
                    onClick={() => setShowLogin(true)}
                    className="px-6 py-2.5 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors shadow-md shadow-red-100"
                  >
                    เข้าสู่ระบบ
                  </button>
                </div>
              )
            )}

            {view === 'batch-operations' && (
              <motion.div 
                key="batch-operations"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <BatchProcessOperations
                  currentUser={currentUser}
                  userRole={userRole}
                  projects={projects}
                  onRefreshProjects={fetchProjects}
                  onSelectProject={(proj) => {
                    setSelectedProject(proj);
                    setView('detail');
                  }}
                />
              </motion.div>
            )}

            {view === 'budgets' && (
              currentUser && userRole !== 'GUEST' ? (
                <motion.div 
                  key="budgets"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <BudgetDatabaseView
                    currentUser={currentUser}
                    userRole={userRole}
                    onSelectProject={(proj) => {
                      setSelectedProject(proj);
                      setView('detail');
                    }}
                    expenseCategories={expenseCategories}
                    onRefreshExpenseCategories={fetchExpenseCategories}
                  />
                </motion.div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center max-w-md mx-auto my-12 shadow-sm">
                  <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Lock size={30} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">ต้องเข้าสู่ระบบก่อนเข้าใช้งาน</h3>
                  <p className="text-xs text-slate-500 mb-6">เมนู "ฐานข้อมูลงบประมาณ" สงวนสิทธิ์การเข้าถึงเฉพาะผู้ที่เข้าสู่ระบบเท่านั้น</p>
                  <button
                    onClick={() => setShowLogin(true)}
                    className="px-6 py-2.5 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors shadow-md shadow-red-100"
                  >
                    เข้าสู่ระบบ
                  </button>
                </div>
              )
            )}

            {view === 'manual' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="max-w-5xl mx-auto space-y-8">
                  <div className="text-center space-y-4">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">คู่มือการใช้งาน TTC SmartProcure</h1>
                    <p className="text-slate-500 max-w-2xl mx-auto">คู่มือแนะนำขั้นตอนการปฏิบัติงานสำหรับบุคลากรและเจ้าหน้าที่แต่ละฝ่าย</p>
                    
                    <div className="flex justify-center gap-2 pt-4">
                      {[
                        { id: 'general', label: 'บุคลากรทั่วไป', icon: User },
                        { id: 'planning', label: 'งานพัฒนายุทธศาสตร์ฯ', icon: Calendar },
                        { id: 'procurement', label: 'งานพัสดุ', icon: Building2 },
                        { id: 'finance', label: 'งานการเงิน', icon: Coins }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setManualTab(tab.id as any)}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold transition-all ${
                            manualTab === tab.id 
                              ? 'bg-red-700 text-white shadow-lg shadow-red-100 scale-105' 
                              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <tab.icon size={18} />
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {manualTab === 'general' && (
                      <motion.div
                        key="general"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-8"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                              <Plus size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">1. การสร้างโครงการใหม่</h3>
                            <ul className="space-y-3 text-slate-600 text-sm">
                              <li className="flex gap-2">
                                <span className="font-bold text-red-600">•</span>
                                คลิกที่ปุ่ม "สร้างโครงการใหม่" ที่แถบเมนูด้านซ้าย
                              </li>
                              <li className="flex gap-2">
                                <span className="font-bold text-red-600">•</span>
                                กรอกข้อมูลรายละเอียดโครงการให้ครบถ้วน (ชื่อโครงการ, แผนก, งบประมาณ)
                              </li>
                              <li className="flex gap-2">
                                <span className="font-bold text-red-600">•</span>
                                เพิ่มรายการพัสดุที่ต้องการจัดซื้อ พร้อมระบุจำนวนและราคา
                              </li>
                              <li className="flex gap-2">
                                <span className="font-bold text-red-600">•</span>
                                เลือกผู้พิจารณาและผู้อนุมัติตามลำดับขั้น
                              </li>
                            </ul>
                          </div>

                          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                              <PlusCircle size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">2. การสร้างโครงการยืมเงิน</h3>
                            <ul className="space-y-3 text-slate-600 text-sm">
                              <li className="flex gap-2">
                                <span className="font-bold text-indigo-600">•</span>
                                คลิกปุ่ม "สร้างโครงการใหม่(ยืมเงิน)" สีน้ำเงินด้านซ้าย
                              </li>
                              <li className="flex gap-2">
                                <span className="font-bold text-indigo-600">•</span>
                                ใช้สำหรับกรณีที่ต้องการยืมเงินทดลองราชการไปดำเนินการเอง
                              </li>
                              <li className="flex gap-2">
                                <span className="font-bold text-indigo-600">•</span>
                                ระบุ "ชื่อผู้ยืม" และ "หมวดรายจ่าย" เพิ่มเติมจากข้อมูลปกติ
                              </li>
                              <li className="flex gap-2">
                                <span className="font-bold text-indigo-600">•</span>
                                ระบบจะสร้างขั้นตอน D เพื่อรองรับกระบวนการยืมเงิน
                              </li>
                            </ul>
                          </div>

                          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                              <Search size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">3. การติดตามสถานะ</h3>
                            <ul className="space-y-3 text-slate-600 text-sm">
                              <li className="flex gap-2">
                                <span className="font-bold text-blue-600">•</span>
                                ดูภาพรวมโครงการทั้งหมดได้ที่หน้า "แดชบอร์ด"
                              </li>
                              <li className="flex gap-2">
                                <span className="font-bold text-blue-600">•</span>
                                ใช้แถบ "โครงการของฉัน" เพื่อดูเฉพาะโครงการที่คุณเป็นเจ้าของ
                              </li>
                              <li className="flex gap-2">
                                <span className="font-bold text-blue-600">•</span>
                                สถานะจะเปลี่ยนไปตามขั้นตอน (A01 → A02 → A03 → B01 → ...)
                              </li>
                              <li className="flex gap-2">
                                <span className="font-bold text-blue-600">•</span>
                                โครงการยืมเงินจะมีขั้นตอน D เพิ่มเติมสำหรับการเคลียร์เงินยืม
                              </li>
                            </ul>
                          </div>
                        </div>

                        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                              <History size={28} />
                            </div>
                            <div>
                              <h2 className="text-2xl font-bold text-slate-900">การเคลียร์เงินยืม (ขั้นตอน D)</h2>
                              <p className="text-slate-500">ขั้นตอนการส่งหลักฐานการจ่ายเงินเพื่อปิดยอดเงินยืม</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <h4 className="font-bold text-slate-900">สิ่งที่ต้องเตรียม:</h4>
                              <ul className="space-y-3 text-slate-600 text-sm">
                                <li className="flex gap-2">
                                  <span className="font-bold text-indigo-600">1.</span>
                                  ใบเสร็จรับเงิน/ใบกำกับภาษี จากร้านค้าที่ไปจัดซื้อจริง
                                </li>
                                <li className="flex gap-2">
                                  <span className="font-bold text-indigo-600">2.</span>
                                  ภาพถ่ายพัสดุที่ได้รับ (ถ้ามี)
                                </li>
                                <li className="flex gap-2">
                                  <span className="font-bold text-indigo-600">3.</span>
                                  เงินทอน (กรณีใช้เงินไม่หมดตามที่ยืมไป)
                                </li>
                              </ul>
                            </div>
                            <div className="space-y-4">
                              <h4 className="font-bold text-slate-900">ขั้นตอนการดำเนินการ:</h4>
                              <div className="space-y-3">
                                {[
                                  "พิมพ์เอกสาร D01 และ D02 จากระบบ",
                                  "รวบรวมใบเสร็จรับเงินแนบกับเอกสาร D02",
                                  "ส่งเอกสารให้งานพัสดุตรวจสอบความถูกต้อง",
                                  "ส่งเอกสารให้งานการเงินเพื่อบันทึกการเคลียร์เงินยืม",
                                  "ตรวจสอบสถานะโครงการในระบบจนเป็น 'Completed'"
                                ].map((step, i) => (
                                  <div key={i} className="flex gap-4 items-start">
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                                      {i + 1}
                                    </div>
                                    <p className="text-slate-600 text-sm">{step}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                          <div className="relative z-10 space-y-6">
                            <h3 className="text-2xl font-bold">การพิมพ์เอกสาร</h3>
                            <p className="text-slate-400 text-sm max-w-lg">
                              เมื่อโครงการผ่านการอนุมัติในแต่ละขั้นตอน คุณสามารถพิมพ์เอกสารที่เกี่ยวข้องได้ทันทีจากหน้าโครงการ
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10 text-center">
                                <p className="text-xs font-bold text-slate-400 mb-1">ขั้นตอน A</p>
                                <p className="text-sm font-bold">A01, A02, A03</p>
                              </div>
                              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10 text-center">
                                <p className="text-xs font-bold text-slate-400 mb-1">ขั้นตอน B</p>
                                <p className="text-sm font-bold">B01, B02, B03</p>
                              </div>
                              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10 text-center">
                                <p className="text-xs font-bold text-slate-400 mb-1">ขั้นตอน B</p>
                                <p className="text-sm font-bold">B04, B05</p>
                              </div>
                              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10 text-center">
                                <p className="text-xs font-bold text-slate-400 mb-1">ขั้นตอน C</p>
                                <p className="text-sm font-bold">C01, C02</p>
                              </div>
                              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10 text-center">
                                <p className="text-xs font-bold text-slate-400 mb-1">ขั้นตอน D (ยืมเงิน)</p>
                                <p className="text-sm font-bold">D01, D02</p>
                              </div>
                            </div>
                          </div>
                          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/20 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                        </div>
                      </motion.div>
                    )}

                    {manualTab === 'planning' && (
                      <motion.div
                        key="planning"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-8"
                      >
                        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">
                              <Calendar size={28} />
                            </div>
                            <div>
                              <h2 className="text-2xl font-bold text-slate-900">คู่มือสำหรับงานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ</h2>
                              <p className="text-slate-500">การตรวจสอบงบประมาณและการอนุมัติเบื้องต้น</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                              <h4 className="font-bold text-slate-900">1. ตรวจสอบงบประมาณ</h4>
                              <p className="text-sm text-slate-600">ตรวจสอบความถูกต้องของแหล่งเงินและวงเงินงบประมาณที่แผนกเสนอมา</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                              <h4 className="font-bold text-slate-900">2. อนุมัติขั้นตอน A</h4>
                              <p className="text-sm text-slate-600">พิจารณาเห็นชอบรายงานขอซื้อขอจ้าง (A01-A03) เพื่อส่งต่อให้งานพัสดุ</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                              <h4 className="font-bold text-slate-900">3. จัดการแหล่งเงิน</h4>
                              <p className="text-sm text-slate-600">เพิ่มหรือแก้ไขรายชื่อแหล่งงบประมาณในระบบเพื่อให้แผนกเลือกใช้</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-bold text-slate-900">ขั้นตอนการปฏิบัติงาน:</h4>
                            <div className="space-y-3">
                              {[
                                "เข้าสู่ระบบด้วยสิทธิ์ PLANNING_STAFF หรือ PLANNING_HEAD",
                                "ตรวจสอบโครงการที่มีสถานะ 'รอตรวจสอบงบประมาณ'",
                                "ตรวจสอบความถูกต้องของรายการและวงเงิน",
                                "กด 'ดำเนินการขั้นตอนถัดไป' เพื่อส่งต่อให้หัวหน้างานพัฒนายุทธศาสตร์ฯ หรือรองผู้อำนวยการ",
                                "ติดตามภาพรวมการใช้งบประมาณผ่านหน้า Dashboard"
                              ].map((step, i) => (
                                <div key={i} className="flex gap-4 items-start">
                                  <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                                    {i + 1}
                                  </div>
                                  <p className="text-slate-600 text-sm">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {manualTab === 'procurement' && (
                      <motion.div
                        key="procurement"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-8"
                      >
                        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                              <Building2 size={28} />
                            </div>
                            <div>
                              <h2 className="text-2xl font-bold text-slate-900">คู่มือสำหรับงานพัสดุ</h2>
                              <p className="text-slate-500">การดำเนินการจัดซื้อจัดจ้างและบริหารพัสดุ</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                              <h4 className="font-bold text-slate-900">1. ดำเนินการจัดซื้อ</h4>
                              <p className="text-sm text-slate-600">จัดทำเอกสารรายงานผลการพิจารณาและขออนุมัติสั่งซื้อ (B01-B04)</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                              <h4 className="font-bold text-slate-900">2. จัดการร้านค้า</h4>
                              <p className="text-sm text-slate-600">บันทึกข้อมูลผู้ประกอบการ/ร้านค้า เพื่อใช้ในการออกใบสั่งซื้อ (B05)</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                              <h4 className="font-bold text-slate-900">3. ตรวจรับพัสดุ</h4>
                              <p className="text-sm text-slate-600">บันทึกการตรวจรับพัสดุเมื่อผู้ขายส่งมอบของครบถ้วน</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-bold text-slate-900">ขั้นตอนการปฏิบัติงาน:</h4>
                            <div className="space-y-3">
                              {[
                                "เข้าสู่ระบบด้วยสิทธิ์ PROCUREMENT_STAFF หรือ PROCUREMENT_HEAD",
                                "เลือกโครงการที่ผ่านการอนุมัติจากงานพัฒนายุทธศาสตร์ฯ แล้ว (ขั้นตอน B)",
                                "ระบุชื่อร้านค้าสำหรับแต่ละรายการพัสดุ",
                                "พิมพ์เอกสาร B01-B04 เพื่อเสนอลงนาม",
                                "เมื่อได้รับอนุมัติ พิมพ์ใบสั่งซื้อ (B05) ส่งให้ร้านค้า",
                                "บันทึกวันที่รับพัสดุในระบบ โดยสามารถระบุแยกตามรายร้านค้าที่สั่งซื้อได้",
                                "ดำเนินการตรวจรับพัสดุ (B08) และส่งเบิกเงิน"
                              ].map((step, i) => (
                                <div key={i} className="flex gap-4 items-start">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                                    {i + 1}
                                  </div>
                                  <p className="text-slate-600 text-sm">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {manualTab === 'finance' && (
                      <motion.div
                        key="finance"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-8"
                      >
                        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                              <Coins size={28} />
                            </div>
                            <div>
                              <h2 className="text-2xl font-bold text-slate-900">คู่มือสำหรับงานการเงิน</h2>
                              <p className="text-slate-500">การเบิกจ่ายเงินและการสรุปงบประมาณ</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                              <h4 className="font-bold text-slate-900">1. ตรวจสอบการเบิกจ่าย</h4>
                              <p className="text-sm text-slate-600">ตรวจสอบเอกสารการตรวจรับจากงานพัสดุเพื่อดำเนินการจ่ายเงิน</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                              <h4 className="font-bold text-slate-900">2. บันทึกการจ่ายเงิน</h4>
                              <p className="text-sm text-slate-600">บันทึกเลขที่เอกสารการจ่ายเงินและวันที่จ่ายเงินจริง (ขั้นตอน C)</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-3xl space-y-3">
                              <h4 className="font-bold text-slate-900">3. รายงานการเงิน</h4>
                              <p className="text-sm text-slate-600">ดูสรุปยอดการใช้จ่ายจริงเปรียบเทียบกับงบประมาณที่ตั้งไว้</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-bold text-slate-900">ขั้นตอนการปฏิบัติงาน:</h4>
                            <div className="space-y-3">
                              {[
                                "เข้าสู่ระบบด้วยสิทธิ์ FINANCE_STAFF หรือ FINANCE_HEAD",
                                "เลือกโครงการที่มีสถานะ 'รอการเบิกจ่าย' (ขั้นตอน C)",
                                "ตรวจสอบความถูกต้องของยอดเงินและชื่อผู้รับเงิน",
                                "บันทึกข้อมูลการจ่ายเงิน (C01-C02)",
                                "กดยืนยันการจ่ายเงินเพื่อปิดโครงการ (Status: Completed)",
                                "ตรวจสอบรายงานสรุปการใช้จ่ายรายเดือน/รายปี"
                              ].map((step, i) => (
                                <div key={i} className="flex gap-4 items-start">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex-shrink-0 flex items-center justify-center text-xs font-bold">
                                    {i + 1}
                                  </div>
                                  <p className="text-slate-600 text-sm">{step}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="text-center pt-8">
                    <p className="text-xs text-slate-400 italic">© 2024 TTC SmartProcure (ระบบจัดซื้อจัดจ้างอัจฉริยะ เทคนิคตรัง)</p>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-a01' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสาร A01</h3>
                      <p className="text-xs text-slate-400">รายการโครงการทั้งหมดที่สามารถพิมพ์เอกสารขอซื้อขอจ้างได้</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก, ร้านค้า..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="text-right hidden lg:block">
                        <p className="text-[10px] font-bold text-red-700 bg-red-50 px-3 py-1 rounded-lg border border-red-100 inline-block">
                          คำแนะนำ: เมื่อกดปุ่มพิมพ์ ให้เลือกปลายทางเป็น "Save as PDF"
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก/งาน</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณ</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowA01Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ / PDF'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-a02' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสาร A02</h3>
                      <p className="text-xs text-slate-400">เอกสารรายละเอียดพัสดุ แนบท้ายบันทึกข้อความขอซื้อขอจ้าง (A02)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก/งาน</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณ</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowA02Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ A02'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-a03' && ['ADMIN', 'PLANNING_STAFF'].includes(userRole) && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสาร A03</h3>
                      <p className="text-xs text-slate-400">เอกสารการพิจารณาอนุมัติการขอซื้อขอจ้าง (A03)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก/งาน</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณ</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    fetchBudgetSources();
                                    fetchExpenseCategories();
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowA03Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ A03'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
            {view === 'print-b01' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสาร B01</h3>
                      <p className="text-xs text-slate-400">เอกสารรายงานขอซื้อขอจ้าง (B01)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก, ร้านค้า..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="text-right hidden lg:block">
                        <p className="text-[10px] font-bold text-red-700 bg-red-50 px-3 py-1 rounded-lg border border-red-100 inline-block">
                          คำแนะนำ: เมื่อกดปุ่มพิมพ์ ให้เลือกปลายทางเป็น "Save as PDF"
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก/งาน</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณ</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowB01Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-colors shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ B01'}
                              </button>
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowB02Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-colors shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ B02'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-b02' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสาร B02</h3>
                      <p className="text-xs text-slate-400">เอกสารรายละเอียดพัสดุ (B02)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก, ร้านค้า..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก/งาน</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณ</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowB02Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-colors shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ B02'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-b03' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสาร B03</h3>
                      <p className="text-xs text-slate-400">ประกาศผู้ชนะการเสนอราคา (B03)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก, ร้านค้า..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก/งาน</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณ</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowB03Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ B03'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-b04' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสาร B04</h3>
                      <p className="text-xs text-slate-400">รายงานผลการพิจารณาและขออนุมัติสั่งซื้อสั่งจ้าง (B04)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก, ร้านค้า..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก/งาน</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณ</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowB04Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ B04'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-b05' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกรายการร้านค้าเพื่อพิมพ์เอกสารใบสั่งซื้อ B05</h3>
                      <p className="text-xs text-slate-400">ใบสั่งซื้อ (B05) แยกตามแต่ละร้านค้า</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก, ร้านค้า..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ร้านค้า</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณรวม</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.flatMap((project) => {
                          const shops = project.item_shops ? project.item_shops.split(',').map(s => s.trim()) : ['รอกำหนด'];
                          return shops.map((shop, sIdx) => (
                            <tr key={`${project.id}-${shop}-${sIdx}`} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                                {project.project_code || 'รอกำหนด'}
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                              <td className="px-6 py-4 text-sm text-slate-500">{shop}</td>
                              <td className="px-6 py-4 text-sm font-bold text-right">
                                {project.budget_amount.toLocaleString()} ฿
                              </td>
                              <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                                <button 
                                  disabled={loadingProjectId === project.id}
                                  onClick={async () => {
                                    try {
                                      setLoadingProjectId(project.id);
                                      const res = await fetch(`/api/projects/${project.id}`);
                                      const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                      setSelectedProject(data);
                                      setSelectedShopForB05(shop === 'รอกำหนด' ? null : shop);
                                      setShowB05Modal(true);
                                    } catch (err) {
                                      console.error(err);
                                      alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                    } finally {
                                      setLoadingProjectId(null);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                  {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ B05'}
                                </button>
                              </td>
                            </tr>
                          ));
                        })}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-b08' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกรายการร้านค้าเพื่อพิมพ์เอกสารใบตรวจรับ B08</h3>
                      <p className="text-xs text-slate-400">ใบตรวจรับสิ่งของ (B08) แยกตามแต่ละร้านค้า</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก, ร้านค้า..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ร้านค้า</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณรวม</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.flatMap((project) => {
                          const shops = project.item_shops ? project.item_shops.split(',').map(s => s.trim()) : ['รอกำหนด'];
                          return shops.map((shop, sIdx) => (
                            <tr key={`${project.id}-${shop}-${sIdx}`} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                                {project.project_code || 'รอกำหนด'}
                              </td>
                              <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                              <td className="px-6 py-4 text-sm text-slate-500">{shop}</td>
                              <td className="px-6 py-4 text-sm font-bold text-right">
                                {project.budget_amount.toLocaleString()} ฿
                              </td>
                              <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                                <button 
                                  disabled={loadingProjectId === project.id}
                                  onClick={async () => {
                                    try {
                                      setLoadingProjectId(project.id);
                                      const res = await fetch(`/api/projects/${project.id}`);
                                      const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                      setSelectedProject(data);
                                      setSelectedShopForB08(shop === 'รอกำหนด' ? null : shop);
                                      setShowB08Modal(true);
                                    } catch (err) {
                                      console.error(err);
                                      alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                    } finally {
                                      setLoadingProjectId(null);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                  {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ B08'}
                                </button>
                              </td>
                            </tr>
                          ));
                        })}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-c01' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสารใบเบิกเงิน C01</h3>
                      <p className="text-xs text-slate-400">ใบเบิกเงิน (C01) แสดงแหล่งงบประมาณ</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณรวม</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowC01Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ C01'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-c02' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสารบันทึกข้อความขออนุมัติเบิกจ่าย C02</h3>
                      <p className="text-xs text-slate-400">บันทึกข้อความขออนุมัติเบิกจ่ายเงิน (C02)</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณรวม</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowC02Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ C02'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-d01' && ['ADMIN', 'PROCUREMENT_STAFF'].includes(userRole) && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสาร D01</h3>
                      <p className="text-xs text-slate-400">คำสั่งแต่งตั้งเจ้าหน้าที่พัสดุชั่วคราว (D01) *เฉพาะโครงการยืมเงิน</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณรวม</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowD01Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-indigo-700 text-white text-xs font-bold rounded-xl hover:bg-indigo-800 transition-all shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ D01'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการยืมเงินที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'print-d02' && ['ADMIN', 'FINANCE_STAFF'].includes(userRole) && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-8 space-y-8"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-lg">เลือกโครงการเพื่อพิมพ์เอกสาร D02</h3>
                      <p className="text-xs text-slate-400">ใบเบิก (D02) *เฉพาะโครงการยืมเงิน</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <div className="relative w-full sm:w-48">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="date" 
                          value={printDateFilter}
                          onChange={(e) => setPrintDateFilter(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="ค้นหาชื่อ, รหัส, แผนก..." 
                          value={printSearchQuery}
                          onChange={(e) => setPrintSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">รหัสโครงการ</th>
                          <th className="px-6 py-4 font-semibold">ชื่อโครงการ</th>
                          <th className="px-6 py-4 font-semibold">แผนก</th>
                          <th className="px-6 py-4 font-semibold text-right">งบประมาณรวม</th>
                          <th className="px-6 py-4 font-semibold text-center">การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrintProjects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-red-700 font-bold">
                              {project.project_code || 'รอกำหนด'}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-700">{project.title}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{project.department}</td>
                            <td className="px-6 py-4 text-sm font-bold text-right">
                              {project.budget_amount.toLocaleString()} ฿
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                disabled={loadingProjectId === project.id}
                                onClick={async () => {
                                  try {
                                    setLoadingProjectId(project.id);
                                    const res = await fetch(`/api/projects/${project.id}`);
                                    const data = await safeParseJson(res); if (!data) throw new Error("Failed to parse response");
                                    setSelectedProject(data);
                                    setShowD02Modal(true);
                                  } catch (err) {
                                    console.error(err);
                                    alert('ไม่สามารถโหลดข้อมูลโครงการได้');
                                  } finally {
                                    setLoadingProjectId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-red-700 text-white text-xs font-bold rounded-xl hover:bg-red-800 transition-all shadow-md ${loadingProjectId === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <Printer size={14} className={loadingProjectId === project.id ? 'animate-spin' : ''} />
                                {loadingProjectId === project.id ? 'กำลังโหลด...' : 'พิมพ์ D02'}
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredPrintProjects.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่พบข้อมูลโครงการยืมเงินที่ค้นหา
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      {/* Vendor Datalist for suggestions */}
      <datalist id="vendor-suggestions">
        {vendors.map(vendor => (
          <option key={vendor.id} value={vendor.name} />
        ))}
      </datalist>

      {/* User Management Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden font-sarabun"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-xl">{isEditingUser ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}</h3>
              <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <Plus className="rotate-45 text-slate-400" size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">ชื่อผู้ใช้ (Username)</label>
                <input 
                  type="text" 
                  disabled={isEditingUser}
                  value={userForm.username || ''}
                  onChange={e => setUserForm({...userForm, username: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none disabled:bg-slate-50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">รหัสผ่าน {isEditingUser && '(เว้นว่างหากไม่ต้องการเปลี่ยน)'}</label>
                <input 
                  type="password" 
                  value={userForm.password || ''}
                  onChange={e => setUserForm({...userForm, password: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  required={!isEditingUser}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">ชื่อ-นามสกุล</label>
                <input 
                  type="text" 
                  value={userForm.name || ''}
                  onChange={e => setUserForm({...userForm, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">ตำแหน่ง</label>
                <input 
                  type="text" 
                  value={userForm.position || ''}
                  onChange={e => setUserForm({...userForm, position: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">บทบาท (Role)</label>
                <select 
                  value={userForm.role || 'STAFF'}
                  onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                >
                  <option value="ADMIN">ADMIN (ผู้ดูแลระบบ)</option>
                  <option value="PLANNING_STAFF">PLANNING_STAFF (เจ้าหน้าที่งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ)</option>
                  <option value="PLANNING_HEAD">PLANNING_HEAD (หัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ)</option>
                  <option value="PROCUREMENT_STAFF">PROCUREMENT_STAFF (เจ้าหน้าที่งานพัสดุ)</option>
                  <option value="PROCUREMENT_HEAD">PROCUREMENT_HEAD (หัวหน้างานพัสดุ)</option>
                  <option value="FINANCE_STAFF">FINANCE_STAFF (เจ้าหน้าที่งานการเงิน)</option>
                  <option value="FINANCE_HEAD">FINANCE_HEAD (หัวหน้างานการเงิน)</option>
                  <option value="DEPUTY_DIRECTOR_PLANNING">DEPUTY_DIRECTOR_PLANNING (รองฯ ฝ่ายยุทธศาสตร์และแผนงาน)</option>
                  <option value="DEPUTY_DIRECTOR_RESOURCES">DEPUTY_DIRECTOR_RESOURCES (รองฯ ฝ่ายบริหารทรัพยากร)</option>
                  <option value="DIRECTOR">DIRECTOR (ผู้อำนวยการ)</option>
                  <option value="STAFF">STAFF (บุคลากรทั่วไป)</option>
                  <option value="GUEST">GUEST (ผู้เข้าชมทั่วไป)</option>
                </select>
              </div>
              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-red-700 text-white font-bold py-3 rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Vendor Management Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden font-sarabun"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-xl">{isEditingVendor ? 'แก้ไขข้อมูลร้านค้า' : 'เพิ่มร้านค้าใหม่'}</h3>
              <button onClick={() => setShowVendorModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <Plus className="rotate-45 text-slate-400" size={24} />
              </button>
            </div>
            <form onSubmit={handleVendorSubmit} className="p-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">ชื่อร้านค้า</label>
                <input 
                  type="text" 
                  value={vendorForm.name || ''}
                  onChange={e => setVendorForm({...vendorForm, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">ที่อยู่</label>
                <textarea 
                  value={vendorForm.address || ''}
                  onChange={e => setVendorForm({...vendorForm, address: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none h-20 resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">เบอร์โทรศัพท์</label>
                  <input 
                    type="text" 
                    value={vendorForm.phone || ''}
                    onChange={e => setVendorForm({...vendorForm, phone: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">เลขประจำตัวผู้เสียภาษี</label>
                  <input 
                    type="text" 
                    value={vendorForm.tax_id || ''}
                    onChange={e => setVendorForm({...vendorForm, tax_id: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">ชื่อธนาคาร</label>
                  <input 
                    type="text" 
                    value={vendorForm.bank_name || ''}
                    onChange={e => setVendorForm({...vendorForm, bank_name: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">เลขที่บัญชีธนาคาร</label>
                  <input 
                    type="text" 
                    value={vendorForm.bank_account || ''}
                    onChange={e => setVendorForm({...vendorForm, bank_account: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>
              </div>
              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-red-700 text-white font-bold py-3 rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* A01 Document Modal */}
      <AnimatePresence>
        {showA01Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button 
                    onClick={() => setZoom(0.75)} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    75%
                  </button>
                  <button 
                    onClick={() => setZoom(1)} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    100%
                  </button>
                  <button 
                    onClick={() => setZoom(1.25)} 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    125%
                  </button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  ตัวอย่างเอกสาร A01
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"
                >
                  <Printer size={18} />
                  <FileDown size={18} />
                  <span>พิมพ์ / PDF</span>
                </button>
                <button 
                  onClick={() => setShowA01Modal(false)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"
                >
                  <Plus className="rotate-45" size={20} />
                  <span>ปิดหน้าต่าง</span>
                </button>
              </div>
            </div>

            {/* Document Container with Zoom */}
            <div 
              style={{ 
                transform: `scale(${zoom})`, 
                transformOrigin: 'top center',
                marginBottom: `${(zoom - 1) * 300}px` 
              }} 
              className="transition-transform duration-300 ease-out"
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.5cm_2cm_1.5cm_3cm] relative print:p-[1.5cm_2cm_1.5cm_3cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto"
                id="a01-document"
              >
                {/* เฉพาะโครงการยืมเงิน แสดงข้อความ ยืมเงินทดลองราชการ ด้านบนขวา อักษรสีแดงชัดๆ */}
                {Boolean(selectedProject.is_loan === true || selectedProject.is_loan === 1 || selectedProject.is_loan === '1' || selectedProject.is_loan === 'true') && (
                  <div className="absolute top-[0.8cm] right-[2cm] text-right z-10 select-none">
                    <div 
                      className="font-sarabun font-bold text-[14pt] text-red-600 border-2 border-red-600 px-3 py-0.5 rounded inline-block bg-red-50/50 print:bg-transparent"
                      style={{ color: '#dc2626', borderColor: '#dc2626' }}
                    >
                      ยืมเงินทดลองราชการ
                    </div>
                  </div>
                )}

                {/* Document Content */}
                <div className="font-sarabun text-[14pt] leading-[1.6] text-black">
                  {/* Header */}
                  <div className="relative mb-3 h-[1.5cm]">
                    <img 
                      src="https://fortsurasi.rta.mi.th/srshos-e-form/doc_file/krut-3-cm.png?1773708237" 
                      alt="Garuda" 
                      className="w-[1.5cm] h-[1.5cm] absolute left-0 top-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-center w-full">
                      <h1 className="text-[24pt] font-bold leading-none mt-1">บันทึกข้อความ</h1>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 text-[14pt]">
                    <p className="flex"><span className="font-bold w-[3cm] flex-shrink-0">ส่วนราชการ</span> <span className="border-b border-dotted border-black flex-1">{selectedProject.department} วิทยาลัยเทคนิคตรัง</span></p>
                    <div className="flex justify-between gap-4">
                      <p className="flex flex-1"><span className="font-bold w-[1cm] flex-shrink-0">ที่</span> <span className="border-b border-dotted border-black flex-1">{selectedProject.project_code || '................................'}</span></p>
                      <p className="flex flex-1"><span className="font-bold w-[1.5cm] flex-shrink-0">วันที่</span> <span className="border-b border-dotted border-black flex-1 text-center">{new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                    </div>
                    <p className="flex"><span className="font-bold w-[1.5cm] flex-shrink-0">เรื่อง</span> <span className="border-b border-dotted border-black flex-1 font-bold">ขออนุญาตจัดซื้อจัดจ้าง</span></p>
                  </div>

                  <div className="mt-4">
                    <p><span className="font-bold">เรียน</span> ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                    
                    <div className="mt-4 space-y-4 text-justify indent-[2.5cm]">
                      <p>
                        ด้วย {selectedProject.department} มีความประสงค์จะดำเนินการโครงการ <span className="font-bold">{selectedProject.title}</span> 
                        ซึ่งมีลักษณะโครงการคือ {selectedProject.project_nature || '................................................................................'} 
                        {selectedProject.necessity_reason && (
                          <> และมีเหตุผลความจำเป็นคือ {selectedProject.necessity_reason}</>
                        )}
                        โดยมีกำหนดการใช้วัสดุในวันที่ {selectedProject.material_usage_date || '................................'}
                      </p>
                      <p>
                        ในการนี้ ได้รับจัดสรรงบประมาณทั้งสิ้น {selectedProject.allocated_budget?.toLocaleString() || '0'} บาท 
                        จัดซื้อจัดจ้างมาแล้ว {selectedProject.procured_amount?.toLocaleString() || '0'} บาท 
                        และในครั้งนี้มีความประสงค์จะขออนุมัติจัดซื้อจัดจ้าง เป็นเงินจำนวน {selectedProject.budget_amount.toLocaleString()} บาท 
                        ({thaiBaht(selectedProject.budget_amount)}) 
                      </p>
                    </div>

                    <div className="mt-6 space-y-4">
                      <p className="indent-[2.5cm]">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
                    </div>

                    {/* Signatures */}
                    <div className="mt-16 grid grid-cols-1 gap-4">
                      <div className="ml-auto w-[400px] text-center space-y-16 text-[12pt]">
                        <div>
                          <p>(ลงชื่อ)...........................................................</p>
                          <p>( {selectedProject.creator_name} )</p>
                          <p>ตำแหน่ง {selectedProject.creator_position}</p>
                          <p>ผู้เสนอโครงการ</p>
                        </div>

                        <div>
                          <p>(ลงชื่อ)...........................................................</p>
                          <p>( {selectedProject.dept_head_name} )</p>
                          <p>ตำแหน่ง {selectedProject.dept_head_position}</p>
                          <p>หัวหน้าแผนกวิชา/หัวหน้างาน</p>
                        </div>

                        <div>
                          <p>(ลงชื่อ)...........................................................</p>
                          <p>( {selectedProject.deputy_name} )</p>
                          <p>ตำแหน่ง {selectedProject.deputy_position}</p>
                          <p>รองผู้อำนวยการตามสายงาน</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  size: A4;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 0;
                  background: white !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                /* Specific classes to hide */
                .print\\:hidden, 
                header, 
                nav, 
                footer, 
                button,
                .sticky,
                .fixed:not(.print-container) {
                  display: none !important;
                }

                /* Ensure the container is visible and takes full page */
                .print-container {
                  display: block !important;
                  position: absolute !important;
                  top: 0 !important;
                  left: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  background: white !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  z-index: 9999 !important;
                  visibility: visible !important;
                }

                /* Reset zoom and transforms */
                .transition-transform {
                  transform: none !important;
                  margin-bottom: 0 !important;
                  display: block !important;
                }

                #a01-document {
                  position: relative !important;
                  width: 210mm !important;
                  height: 297mm !important;
                  padding: 1.5cm 2cm 1.5cm 3cm !important;
                  margin: 0 auto !important;
                  box-shadow: none !important;
                  border: none !important;
                  visibility: visible !important;
                  transform: none !important;
                  display: block !important;
                }

                #a01-document * {
                  visibility: visible !important;
                }

                #executive-summary {
                  position: static !important;
                  width: 100% !important;
                  padding: 2cm !important;
                  margin: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                  visibility: visible !important;
                  transform: none !important;
                  display: block !important;
                  background: white !important;
                }

                #executive-summary * {
                  visibility: visible !important;
                }
              }
            `}} />
          </div>
        )}
      </AnimatePresence>
      {/* B01 Document Modal */}
      <AnimatePresence>
        {showB01Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร B01</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowB01Modal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.5cm_2cm_1.5cm_3cm] relative print:p-[1.5cm_2cm_1.5cm_3cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto" id="b01-document">
                <div className="font-sarabun text-[12pt] leading-[1.3] text-black">
                  <div className="relative mb-3 h-[1.5cm]">
                    <img src="https://fortsurasi.rta.mi.th/srshos-e-form/doc_file/krut-3-cm.png?1773708237" alt="Garuda" className="w-[1.5cm] h-[1.5cm] absolute left-0 top-0" referrerPolicy="no-referrer" />
                    <div className="text-center w-full"><h1 className="text-[24pt] font-bold leading-none mt-1">บันทึกข้อความ</h1></div>
                  </div>
                  <div className="space-y-2 mb-4 text-[12pt]">
                    <p className="flex"><span className="font-bold w-[3cm] flex-shrink-0">ส่วนราชการ</span> <span className="border-b border-dotted border-black flex-1">งานพัสดุ วิทยาลัยเทคนิคตรัง</span></p>
                    <div className="flex justify-between gap-4">
                      <p className="flex flex-1"><span className="font-bold w-[1cm] flex-shrink-0">ที่</span> <span className="border-b border-dotted border-black flex-1">................................</span></p>
                      <p className="flex flex-1"><span className="font-bold w-[1.5cm] flex-shrink-0">วันที่</span> <span className="border-b border-dotted border-black flex-1 text-center">{new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                    </div>
                    <p className="flex"><span className="font-bold w-[1.5cm] flex-shrink-0">เรื่อง</span> <span className="border-b border-dotted border-black flex-1 font-bold">รายงานขอซื้อขอจ้าง</span></p>
                  </div>
                  <div className="mt-4">
                    <p><span className="font-bold">เรียน</span> ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                    <div className="mt-2 space-y-2 text-justify">
                      <p className="indent-[2.5cm]">ด้วย {selectedProject.department} มีความประสงค์จัดซื้อวัสดุ/บริการจำนวน {selectedProject.items?.length || 1} รายการ เป็นเงิน {selectedProject.budget_amount.toLocaleString()} บาท ตามรายละเอียดดังแนบ</p>
                      <p className="indent-[2.5cm]">งานพัสดุ ได้ตรวจสอบแล้วเห็นควรจัดซื้อ/จัดจ้างตามเสนอ และเพื่อให้เป็นไปตามพระราชบัญญัติการจัดซื้อจัดจ้างและบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 56 วรรคหนึ่ง (2) (ข) จึงขอรายงานขอซื้อขอจ้าง ดังนี้</p>
                      
                      <div className="space-y-2 ml-[1cm]">
                        <p>1. เหตุผลความจำเป็น: {selectedProject.necessity_reason || '................................'}</p>
                        <p>2. รายละเอียดที่จะขอซื้อ/ของจ้าง: ตามรายละเอียดที่แนบ</p>
                        <p>3. ราคากลางของพัสดุที่จะซื้อ/จ้างเป็นเงิน: {selectedProject.budget_amount.toLocaleString()} บาท</p>
                        <p>4. วงเงินที่จะขอซื้อ/จ้างครั้งนี้: {selectedProject.budget_amount.toLocaleString()} บาท</p>
                        <p>5. กำหนดเวลาที่ต้องการใช้พัสดุภายใน 15 วัน นับจากวันลงนามในสัญญา</p>
                        <p>6. ซื้อโดยวิธีเฉพาะเจาะจง เนื่องจาก การจัดซื้อ/จัดจ้างพัสดุที่มีการผลิต จำหน่าย ก่อสร้างหรือให้บริการทั่วไปและวงเงินในการจัดซื้อจัดจ้างครั้งหนึ่งไม่เกิน 500,000 บาท ที่กำหนดในกฎกระทรวง</p>
                        <p>7. หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ โดยใช้เกณฑ์ราคา</p>
                        <p>8. ข้อเสนออื่นๆ เห็นควรแต่งตั้งผู้ตรวจรับพัสดุ ตามเสนอ</p>
                      </div>

                      <p className="indent-[2.5cm] mt-4">จึงเรียนมาเพื่อโปรดพิจารณา</p>
                      <p className="ml-[2.5cm]">1. เห็นชอบรายงานขอซื้อขอจ้าง</p>
                      <p className="ml-[2.5cm]">2. อนุมัติ ให้บุคคลต่อไปนี้ เป็นผู้ตรวจรับ พัสดุ</p>
                      <div className="ml-[3.5cm] space-y-2">
                        {selectedProject.committee_chairman && (
                          <div className="grid grid-cols-[200px_1fr]">
                            <span>{selectedProject.committee_chairman}</span>
                            <span>ประธานกรรมการ</span>
                          </div>
                        )}
                        {selectedProject.committee_member1 && (
                          <div className="grid grid-cols-[200px_1fr]">
                            <span>{selectedProject.committee_member1}</span>
                            <span>กรรมการ</span>
                          </div>
                        )}
                        {selectedProject.committee_member2 && (
                          <div className="grid grid-cols-[200px_1fr]">
                            <span>{selectedProject.committee_member2}</span>
                            <span>กรรมการ</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-4 text-[10pt]">
                      <div className="text-center">
                        <p className="mb-4">(ลงชื่อ)...........................................................</p>
                        <p>( ........................................................... )</p>
                        <p>เจ้าหน้าที่พัสดุ</p>
                        <p className="mt-2">........../........../...........</p>
                      </div>
                      <div className="text-center">
                        <p className="mb-4">(ลงชื่อ)...........................................................</p>
                        <p>( นายชัยยัน สีวิน )</p>
                        <p>หัวหน้างานพัสดุ</p>
                        <p className="mt-2">........../........../...........</p>
                      </div>
                    </div>

                    <div className="mt-8 space-y-12 text-[10pt]">
                      <div className="mx-auto w-[400px] text-center">
                        <p className="mb-8">ความเห็นควรอนุมัติ</p>
                        <p className="mb-4">(ลงชื่อ)...........................................................</p>
                        <p>( นายนันธวุฒิ น้อย )</p>
                        <p>รองผู้อำนวยการฝ่ายบริหารทรัพยากร</p>
                        <p className="mt-2">........../........../...........</p>
                      </div>

                      <div className="mx-auto w-[400px] text-center">
                        <p className="mb-10">(&nbsp;&nbsp;) อนุมัติ (&nbsp;&nbsp;) ไม่อนุมัติ เนื่องจาก .....................</p>
                        <p className="mb-4">(ลงชื่อ)...........................................................</p>
                        <p>( นายกษิดิฏฐ์ คำศรี )</p>
                        <p>ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                        <p className="mt-2">........../........../...........</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } #b01-document { position: static !important; width: 210mm !important; height: 297mm !important; padding: 1.5cm 2cm 1.5cm 3cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } #b01-document * { visibility: visible !important; } }` }} />
          </div>
        )}
      </AnimatePresence>

      {/* B02 Document Modal */}
      <AnimatePresence>
        {showB02Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร B02</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowB02Modal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[2.5cm_2cm_2cm_3cm] relative print:p-[2.5cm_2cm_2cm_3cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto" id="b02-document">
                <div className="font-sarabun text-[14pt] leading-[1.6] text-black">
                  <div className="text-center mb-8">
                    <h2 className="text-[18pt] font-bold">รายละเอียดพัสดุ แนบท้ายขอซื้อ/ขอจ้าง</h2>
                  </div>

                  <div className="mt-4">
                    <table className="w-full border-collapse border border-black text-[12pt]">
                      <thead>
                        <tr className="bg-slate-50 print:bg-transparent">
                          <th className="border border-black px-2 py-1 w-[8%]">ลำดับ</th>
                          <th className="border border-black px-2 py-1 w-[47%]">รายการสินค้า</th>
                          <th className="border border-black px-2 py-1 w-[10%]">หน่วยนับ</th>
                          <th className="border border-black px-2 py-1 w-[10%]">จำนวน</th>
                          <th className="border border-black px-2 py-1 w-[12.5%] text-center">ราคา/หน่วย</th>
                          <th className="border border-black px-2 py-1 w-[12.5%] text-center">ราคารวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProject.items && selectedProject.items.length > 0 ? (
                          selectedProject.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                              <td className="border border-black px-2 py-1">{item.description}</td>
                              <td className="border border-black px-2 py-1 text-center">{item.unit}</td>
                              <td className="border border-black px-2 py-1 text-center">{item.quantity}</td>
                              <td className="border border-black px-2 py-1 text-center">{item.unit_price.toLocaleString()}</td>
                              <td className="border border-black px-2 py-1 text-center">{(item.quantity * item.unit_price).toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="border border-black px-2 py-1 text-center">1</td>
                            <td className="border border-black px-2 py-1">{selectedProject.title}</td>
                            <td className="border border-black px-2 py-1 text-center">งาน</td>
                            <td className="border border-black px-2 py-1 text-center">1</td>
                            <td className="border border-black px-2 py-1 text-center">{selectedProject.budget_amount.toLocaleString()}</td>
                            <td className="border border-black px-2 py-1 text-center">{selectedProject.budget_amount.toLocaleString()}</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold">
                          <td colSpan={5} className="border border-black px-2 py-1 text-right">รวมทั้งสิ้น</td>
                          <td className="border border-black px-2 py-1 text-center">{selectedProject.budget_amount.toLocaleString()}</td>
                        </tr>
                        <tr className="font-bold">
                          <td colSpan={6} className="border border-black px-2 py-1 text-center">({thaiBaht(selectedProject.budget_amount)})</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="mt-16 flex justify-center">
                    <div className="w-[400px] text-center space-y-8 text-[11pt]">
                      <div>
                        <p>(ลงชื่อ)...........................................................</p>
                        <p>( นายชัยยัน สีวิน )</p>
                        <p>หัวหน้างานพัสดุ</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } #b02-document { position: static !important; width: 210mm !important; height: 297mm !important; padding: 2.5cm 2cm 2cm 3cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } #b02-document * { visibility: visible !important; } }` }} />
          </div>
        )}

        {showB03Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร B03</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowB03Modal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[2.5cm_2cm_2cm_3cm] relative print:p-[2.5cm_2cm_2cm_3cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto" id="b03-document">
                <div className="font-sarabun text-[14pt] leading-[1.6] text-black">
                  {/* Header with Garuda */}
                  <div className="flex justify-center mb-4">
                    <img 
                      src="https://fortsurasi.rta.mi.th/srshos-e-form/doc_file/krut-3-cm.png?1773708237" 
                      alt="Garuda" 
                      className="w-[3cm] h-[3cm]"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <div className="text-center mb-8">
                    <h2 className="text-[18pt] font-bold">ประกาศวิทยาลัยเทคนิคตรัง</h2>
                    <h2 className="text-[16pt] font-bold">เรื่อง ประกาศผู้ชนะการเสนอราคา</h2>
                  </div>

                  <div className="space-y-4 text-justify indent-[2.5cm]">
                    <p>
                      ตามที่วิทยาลัยเทคนิคตรัง ประสงค์จะซื้อพัสดุ <span className="font-bold">{selectedProject.title}</span> 
                      เพื่อ {selectedProject.necessity_reason || 'ใช้ในการดำเนินงานของวิทยาลัย'} 
                      จำนวน {selectedProject.items?.length || 0} รายการ โดยวิธีเฉพาะเจาะจง ตามระเบียบกระทรวงการคลัง ว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 28(3) และตามกฎกระทรวงการคลัง ลงวันที่ 23 สิงหาคม พ.ศ. 2560 นั้น 
                      มีผู้เสนอราคาและชนะการเสนอราคาจำนวน {
                        Object.keys(selectedProject?.items?.reduce((acc: any, item: any) => {
                          const shopName = item.shop_name || 'ไม่ระบุชื่อร้าน';
                          acc[shopName] = true;
                          return acc;
                        }, {}) || {}).length
                      } ราย ประกอบด้วย
                    </p>
                    
                    <div className="space-y-2 mt-4">
                      {Object.values(selectedProject?.items?.reduce((acc: any, item: any) => {
                        const shopName = item.shop_name || 'ไม่ระบุชื่อร้าน';
                        if (!acc[shopName]) {
                          acc[shopName] = {
                            name: shopName,
                            itemCount: 0,
                            totalAmount: 0
                          };
                        }
                        acc[shopName].itemCount += 1;
                        acc[shopName].totalAmount += (item.quantity * item.unit_price);
                        return acc;
                      }, {}) || {}).map((vendor: any, idx: number) => (
                        <p key={idx} className="indent-[1cm]">
                          {idx + 1}. {vendor.name} จำนวน {vendor.itemCount} รายการ ในราคา {vendor.totalAmount.toLocaleString()} บาท ({thaiBaht(vendor.totalAmount)})
                        </p>
                      ))}
                    </div>

                    <div className="mt-12">
                      <p className="indent-[2.5cm]">ประกาศ ณ วันที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric' })} เดือน {new Date().toLocaleDateString('th-TH', { month: 'long' })} พ.ศ. {new Date().toLocaleDateString('th-TH', { year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="mt-20 flex flex-col items-center ml-auto w-[300px] text-center">
                    <div className="space-y-1">
                      <p>(ลงชื่อ)...........................................................</p>
                      <p>( นายกษิดิฏฐ์  คำศรี )</p>
                      <p>ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } #b03-document { position: static !important; width: 210mm !important; height: 297mm !important; padding: 2.5cm 2cm 2cm 3cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } #b03-document * { visibility: visible !important; } }` }} />
          </div>
        )}

        {showB04Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร B04</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowB04Modal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.5cm_2cm_1.5cm_3cm] relative print:p-[1.5cm_2cm_1.5cm_3cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto" id="b04-document">
                <div className="font-sarabun text-[12pt] leading-[1.3] text-black">
                  <div className="relative mb-3 h-[1.5cm]">
                    <img src="https://fortsurasi.rta.mi.th/srshos-e-form/doc_file/krut-3-cm.png?1773708237" alt="Garuda" className="w-[1.5cm] h-[1.5cm] absolute left-0 top-0" referrerPolicy="no-referrer" />
                    <div className="text-center w-full"><h1 className="text-[20pt] font-bold leading-none mt-1">บันทึกข้อความ</h1></div>
                  </div>
                  <div className="space-y-2 mb-4 text-[12pt]">
                    <p className="flex"><span className="font-bold w-[3cm] flex-shrink-0">ส่วนราชการ</span> <span className="border-b border-dotted border-black flex-1">งานพัสดุ วิทยาลัยเทคนิคตรัง</span></p>
                    <div className="flex justify-between gap-4">
                      <p className="flex flex-1"><span className="font-bold w-[1cm] flex-shrink-0">ที่</span> <span className="border-b border-dotted border-black flex-1">................................</span></p>
                      <p className="flex flex-1"><span className="font-bold w-[1.5cm] flex-shrink-0">วันที่</span> <span className="border-b border-dotted border-black flex-1 text-center">{new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                    </div>
                    <p className="flex"><span className="font-bold w-[1.5cm] flex-shrink-0">เรื่อง</span> <span className="border-b border-dotted border-black flex-1 font-bold">รายงานผลการพิจารณาและขออนุมัติสั่งซื้อสั่งจ้าง</span></p>
                  </div>
                  <div className="mt-4">
                    <p><span className="font-bold">เรียน</span> ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                    <div className="mt-2 space-y-2 text-justify">
                      <p className="indent-[2.5cm]">
                        ตามที่ วิทยาลัยเทคนิคตรัง ได้อนุมัติรายงานขอซื้อขอจ้าง เลขที่ <span className="font-bold">{selectedProject.project_code || '................................'}</span> 
                        จำนวนเงิน <span className="font-bold">{selectedProject.budget_amount.toLocaleString()}</span> บาท 
                        (<span className="font-bold">{thaiBaht(selectedProject.budget_amount)}</span>) 
                        ตามระเบียบกระทรวงการคลัง ว่าด้วยการจัดซื้อจัดจ้างและบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 24 รายละเอียดดังแนบ
                      </p>
                      <p className="indent-[2.5cm]">ในการนี้ งานพัสดุ ขอรายงานผลการพิจารณาการจัดซื้อ/จัดจ้าง โดยวิธีเฉพาะเจาะจง ดังนี้</p>
                      
                      <div className="mt-4">
                        <table className="w-full border-collapse border border-black text-[11pt]">
                          <thead>
                            <tr className="bg-slate-50 print:bg-transparent">
                              <th className="border border-black px-2 py-1 w-[40%]">รายชื่อร้านค้า</th>
                              <th className="border border-black px-2 py-1 w-[15%]">จำนวนรายการ</th>
                              <th className="border border-black px-2 py-1 w-[22.5%] text-center">ราคารวมที่เสนอ</th>
                              <th className="border border-black px-2 py-1 w-[22.5%] text-center">ราคาที่ตกลงซื้อหรือจ้าง</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.values(selectedProject?.items?.reduce((acc: any, item: any) => {
                              const shopName = item.shop_name || 'ไม่ระบุชื่อร้าน';
                              if (!acc[shopName]) {
                                acc[shopName] = {
                                  name: shopName,
                                  itemCount: 0,
                                  totalAmount: 0
                                };
                              }
                              acc[shopName].itemCount += 1;
                              acc[shopName].totalAmount += (item.quantity * item.unit_price);
                              return acc;
                            }, {}) || {}).map((vendor: any, idx: number) => (
                              <tr key={idx}>
                                <td className="border border-black px-2 py-1">{vendor.name}</td>
                                <td className="border border-black px-2 py-1 text-center">{vendor.itemCount}</td>
                                <td className="border border-black px-2 py-1 text-right">{vendor.totalAmount.toLocaleString()}</td>
                                <td className="border border-black px-2 py-1 text-right">{vendor.totalAmount.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="font-bold">
                              <td className="border border-black px-2 py-1 text-right">รวม</td>
                              <td className="border border-black px-2 py-1 text-center">{selectedProject.items?.length || 0}</td>
                              <td className="border border-black px-2 py-1 text-right">{selectedProject.budget_amount.toLocaleString()}</td>
                              <td className="border border-black px-2 py-1 text-right">{selectedProject.budget_amount.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="mt-2 space-y-1">
                        <p>ราคาที่เสนอและราคาที่ตกลงซื้อหรือจ้าง เป็นราคารวมภาษีมูลค่าเพิ่มและภาษีอื่น ค่าขนส่ง ค่าจดทะเบียน และค่าใช้จ่ายอื่นๆ ทั้งปวง</p>
                        <p>เกณฑ์การพิจารณาผลกากรยื่นข้อเสนอครั้งนี้ จะพิจารณาตัดสินโดยใช้หลักเกณฑ์ราคา พิจารณาแล้ว เห็นสมควรจัดซื้อ/จัดจ้างผู้เสนอราคาดังกล่าว</p>
                        <p className="indent-[2.5cm] mt-4">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
                      </div>
                    </div>

                    <div className="mt-8 flex flex-col items-center ml-auto w-[400px] text-center">
                      <div className="space-y-1">
                        <p>(ลงชื่อ)...........................................................</p>
                        <p>( นายชัยยัน  สีวิน )</p>
                        <p>หัวหน้างานพัสดุ</p>
                        <p className="mt-2 text-[10pt]">........../........../...........</p>
                      </div>
                    </div>

                    <div className="mt-8 space-y-10 text-[11pt]">
                      <div className="mx-auto w-[400px] text-center">
                        <p className="mb-4 font-bold">ควรอนุมัติ</p>
                        <p className="mb-4">(ลงชื่อ)...........................................................</p>
                        <p>( นายนันธวุฒิ น้อย )</p>
                        <p>รองผู้อำนวยการฝ่ายบริหารทรัพยากร</p>
                        <p className="mt-2 text-[10pt]">........../........../...........</p>
                      </div>

                      <div className="mx-auto w-[400px] text-center">
                        <p className="mb-8">(&nbsp;&nbsp;) อนุมัติ (&nbsp;&nbsp;) ไม่อนุมัติ เนื่องจาก .....................</p>
                        <p className="mb-4">(ลงชื่อ)...........................................................</p>
                        <p>( นายกษิดิฏฐ์ คำศรี )</p>
                        <p>ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                        <p className="mt-2 text-[10pt]">........../........../...........</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } #b04-document { position: static !important; width: 210mm !important; height: 297mm !important; padding: 1.5cm 2cm 1.5cm 3cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } #b04-document * { visibility: visible !important; } }` }} />
          </div>
        )}

        {showB05Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร B05</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowB05Modal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out flex flex-col gap-8 print:gap-0">
              {Array.from(new Set(selectedProject.items?.map((item: any) => item.shop_name) || []))
                .filter(shopName => !selectedShopForB05 || shopName === selectedShopForB05)
                .map((shopName: any, shopIdx: number) => {
                const shopItems = selectedProject.items?.filter((item: any) => item.shop_name === shopName) || [];
                const shopTotal = shopItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
                const vendorInfo = vendors.find(v => v.name === shopName);

                return (
                  <motion.div 
                    key={shopName}
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.95 }} 
                    className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.5cm_1.5cm_1.5cm_1.5cm] relative print:p-[1.5cm_1.5cm_1.5cm_1.5cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto b05-document-page print:break-after-page"
                  >
                    <div className="font-sarabun text-[11pt] leading-[1.5] text-black">
                      {/* Header */}
                      <div className="flex flex-col items-center mb-6">
                        <img src="https://fortsurasi.rta.mi.th/srshos-e-form/doc_file/krut-3-cm.png?1773708237" alt="Garuda" className="w-[3cm] h-[3cm] mb-2" referrerPolicy="no-referrer" />
                        <h1 className="text-[18pt] font-bold leading-none">ใบสั่งซื้อ</h1>
                      </div>

                      {/* Vendor and Document Info */}
                      <div className="grid grid-cols-2 gap-8 mb-6">
                        <div className="space-y-1">
                          <p className="flex"><span className="font-bold w-[2.5cm]">ผู้ขาย</span> <span>{shopName || '................................'}</span></p>
                          <p className="flex"><span className="font-bold w-[2.5cm]">ที่อยู่</span> <span className="flex-1">{vendorInfo?.address || '................................'}</span></p>
                          <p className="flex"><span className="font-bold w-[2.5cm]">โทรศัพท์</span> <span>{vendorInfo?.phone || '................................'}</span></p>
                          <p className="flex"><span className="font-bold w-[2.5cm]">เลขประจำตัวผู้เสียภาษี</span> <span>{vendorInfo?.tax_id || '................................'}</span></p>
                        </div>
                        <div className="space-y-1">
                          <p className="flex"><span className="font-bold w-[3cm]">ใบสั่งซื้อเลขที่</span> <span>{selectedProject.project_code || '................................'}</span></p>
                          <p className="flex"><span className="font-bold w-[3cm]">วันที่</span> <span>{new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span></p>
                          <p className="flex"><span className="font-bold w-[3cm]">ส่วนราชการ</span> <span>วิทยาลัยเทคนิคตรัง</span></p>
                          <p className="flex"><span className="font-bold w-[3cm]">ที่อยู่</span> <span>อำเภอเมือง จังหวัดตรัง</span></p>
                          <p className="flex"><span className="font-bold w-[3cm]">ฝ่าย/งาน</span> <span>{selectedProject.department}</span></p>
                        </div>
                      </div>

                      {/* Body Text */}
                      <div className="mb-6">
                        <p className="indent-[1cm]">
                          ตามที่ {shopName || '................................'} ได้เสนอราคาไว้ต่อ
                          วิทยาลัยเทคนิคตรัง จึงขอสั่งซื้อ/สั่งจ้าง ตามรายการดังต่อไปนี้
                        </p>
                      </div>

                      {/* Items Table */}
                      <div className="mb-6">
                        <table className="w-full border-collapse border border-black text-[10pt]">
                          <thead>
                            <tr className="bg-slate-50 print:bg-transparent">
                              <th className="border border-black px-2 py-1 w-[10%] text-center">ลำดับ</th>
                              <th className="border border-black px-2 py-1 w-[50%] text-center">รายการ</th>
                              <th className="border border-black px-2 py-1 w-[20%] text-center">ราคาต่อหน่วย</th>
                              <th className="border border-black px-2 py-1 w-[20%] text-center">จำนวนเงิน</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shopItems.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                                <td className="border border-black px-2 py-1">{item.description} ({item.quantity} {item.unit})</td>
                                <td className="border border-black px-2 py-1 text-right">{item.unit_price.toLocaleString()}</td>
                                <td className="border border-black px-2 py-1 text-right">{(item.quantity * item.unit_price).toLocaleString()}</td>
                              </tr>
                            ))}
                            {/* Fill empty rows to maintain height if needed */}
                            {Array.from({ length: Math.max(0, 10 - (shopItems.length || 0)) }).map((_, i) => (
                              <tr key={`empty-${i}`}>
                                <td className="border border-black px-2 py-1 text-center">&nbsp;</td>
                                <td className="border border-black px-2 py-1">&nbsp;</td>
                                <td className="border border-black px-2 py-1 text-right">&nbsp;</td>
                                <td className="border border-black px-2 py-1 text-right">&nbsp;</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="font-bold">
                              <td colSpan={3} className="border border-black px-2 py-1 text-right">รวมเป็นเงินทั้งสิ้น</td>
                              <td className="border border-black px-2 py-1 text-right">{shopTotal.toLocaleString()}</td>
                            </tr>
                            <tr className="font-bold">
                              <td colSpan={4} className="border border-black px-2 py-1 text-center bg-slate-50 print:bg-transparent italic">
                                ({thaiBaht(shopTotal)})
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Conditions and Signatures */}
                      <div className="grid grid-cols-2 gap-12 mt-12">
                        <div className="space-y-4">
                          <p className="font-bold underline">เงื่อนไขการสั่งซื้อ/สั่งจ้าง</p>
                          <ol className="list-decimal list-inside text-[9pt] space-y-1">
                            <li>ผู้ขายต้องส่งมอบพัสดุให้ถูกต้องครบถ้วนตามใบสั่งซื้อ</li>
                            <li>การส่งมอบพัสดุต้องส่งภายในวันที่ ................................</li>
                            <li>หากพ้นกำหนดเวลาดังกล่าว ผู้ขายยินยอมให้ปรับเป็นรายวัน</li>
                            <li>สงวนสิทธิ์ค่าปรับกรณีส่งมอบเกินกำหนด โดยคิดค่าปรับรายวันในอัตราร้อยละ 0.20 ของราคาสินค้าที่ยังไม่ได้ส่งมอบแต่จะต้องไม่ต่ำกว่าวันละ 100 บาท</li>
                            <li>วิทยาลัยฯ สงวนสิทธิ์ที่จะไม่รับมอบถ้าปรากฏว่าสินค้านั้นมีลักษณะไม่ตรงตามรายการที่ระบุไว้ในใบสั่งซื้อ</li>
                          </ol>
                        </div>
                        <div className="space-y-12 text-center">
                          <div className="space-y-2">
                            <p>(ลงชื่อ)...........................................................</p>
                            <p>( นายกษิดิฏฐ์ คำศรี )</p>
                            <p>ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                            <p>ผู้สั่งซื้อ/สั่งจ้าง</p>
                          </div>
                          <div className="space-y-2">
                            <p>(ลงชื่อ)...........................................................</p>
                            <p>(...........................................................)</p>
                            <p>ผู้รับใบสั่งซื้อ/สั่งจ้าง</p>
                            <p>วันที่ ........../........../..........</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } .b05-document-page { position: static !important; width: 210mm !important; height: 297mm !important; padding: 1.5cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } .b05-document-page * { visibility: visible !important; } }` }} />
          </div>
        )}

        {showB08Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร B08</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowB08Modal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out flex flex-col gap-8 print:gap-0">
              {Array.from(new Set(selectedProject.items?.map((item: any) => item.shop_name) || []))
                .filter(shopName => !selectedShopForB08 || shopName === selectedShopForB08)
                .map((shopName: any, shopIdx: number) => {
                const shopItems = selectedProject.items?.filter((item: any) => item.shop_name === shopName) || [];
                const shopTotal = shopItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);

                return (
                  <motion.div 
                    key={shopName}
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.95 }} 
                    className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.5cm_3cm_1.5cm_2cm] relative print:p-[1.5cm_3cm_1.5cm_2cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto b08-document-page print:break-after-page"
                  >
                    <div className="font-sarabun text-[11pt] leading-[1.5] text-black">
                      {/* Header */}
                      <div className="flex flex-col items-center mb-6">
                        <h1 className="text-[14pt] font-bold text-center leading-tight">ใบตรวจรับสิ่งของ</h1>
                        <p className="text-[12pt] font-bold text-center leading-tight">ตามระเบียบกระทรวงการคลัง ว่าด้วย การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 175</p>
                      </div>

                      <div className="flex justify-center mb-4">
                        <div className="text-center">
                          <p>เขียนที่ วิทยาลัยเทคนิคตรัง</p>
                          <p>วันที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="indent-[1cm]">
                          {shopName || '................................'} ได้ส่ง พัสดุ ตามรายการข้างล่างนี้ไว้ให้แก่วิทยาลัยเทคนิคตรัง
                        </p>
                      </div>

                      {/* Items Table */}
                      <div className="mb-6">
                        <table className="w-full border-collapse border border-black text-[10pt]">
                          <thead>
                            <tr className="bg-slate-50 print:bg-transparent">
                              <th className="border border-black px-2 py-1 w-[10%] text-center">ลำดับ</th>
                              <th className="border border-black px-2 py-1 w-[50%] text-center">รายการ</th>
                              <th className="border border-black px-2 py-1 w-[20%] text-center">จำนวนสิ่งของ</th>
                              <th className="border border-black px-2 py-1 w-[20%] text-center">จำนวนเงิน</th>
                              <th className="border border-black px-2 py-1 w-[10%] text-center">หมายเหตุ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shopItems.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                                <td className="border border-black px-2 py-1">{item.description}</td>
                                <td className="border border-black px-2 py-1 text-center">{item.quantity} {item.unit}</td>
                                <td className="border border-black px-2 py-1 text-center">{item.total_price.toLocaleString()}</td>
                                <td className="border border-black px-2 py-1 text-center"></td>
                              </tr>
                            ))}
                            {/* Fill empty rows */}
                            {Array.from({ length: Math.max(0, 8 - (shopItems.length || 0)) }).map((_, i) => (
                              <tr key={`empty-${i}`}>
                                <td className="border border-black px-2 py-1 text-center">&nbsp;</td>
                                <td className="border border-black px-2 py-1">&nbsp;</td>
                                <td className="border border-black px-2 py-1 text-center">&nbsp;</td>
                                <td className="border border-black px-2 py-1 text-center">&nbsp;</td>
                                <td className="border border-black px-2 py-1 text-center">&nbsp;</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="font-bold">
                              <td colSpan={3} className="border border-black px-2 py-1 text-right">รวมทั้งสิ้น</td>
                              <td className="border border-black px-2 py-1 text-center">{shopTotal.toLocaleString()}</td>
                              <td className="border border-black px-2 py-1 text-center"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="space-y-2 mb-8">
                        <p>พัสดุ ตามรายการข้างบนนี้</p>
                        <p className="ml-4">1. ได้ตรวจรับ ณ งานพัสดุ วิทยาลัยเทคนิคตรัง</p>
                        <p className="ml-4">2. ได้ตรวจนับบันทึกทดลองสิ่งของถูกต้องครบถ้วนตามหลักฐานที่ตกลงกันไว้</p>
                        <p className="ml-4">3. ได้มอบแก่ นายชัยยัน สีวิน ซึ่งเป็นหัวหน้าเจ้าหน้าที่</p>
                        <p className="ml-4">4. ผู้ตรวจรับพัสดุได้ตรวจเห็นเป็นการถูกต้องครบถ้วนแล้ว จึงขอรายงานต่อผู้อำนวยการวิทยาลัยเทคนิคตรัง เพื่อทราบ ตามระเบียบกระทรวงการคลัง ว่าด้วย การจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 175</p>
                      </div>

                      {/* Signatures */}
                      <div className="grid grid-cols-1 gap-8 mt-8">
                        <div className="space-y-6">
                          <div className="flex flex-col items-center">
                            <p className="mb-8">ลงชื่อ ...................................... ประธานกรรมการ</p>
                            <p>( {selectedProject.committee_chairman || '......................................'} )</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col items-center">
                              <p className="mb-8">ลงชื่อ ...................................... กรรมการ</p>
                              <p>( {selectedProject.committee_member1 || '......................................'} )</p>
                            </div>
                            <div className="flex flex-col items-center">
                              <p className="mb-8">ลงชื่อ ...................................... กรรมการ</p>
                              <p>( {selectedProject.committee_member2 || '......................................'} )</p>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-black pt-8 mt-8">
                          <div className="flex flex-col items-center space-y-4">
                            <p>ได้รับของตามรายการข้างบนนี้ไว้ถูกต้อง</p>
                            <div className="text-center">
                              <p className="mb-8">ลงชื่อ ...................................... หัวหน้าเจ้าหน้าที่</p>
                              <p>( นายชัยยัน สีวิน )</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } .b08-document-page { position: static !important; width: 210mm !important; height: 297mm !important; padding: 1.5cm 2cm 1.5cm 3cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } .b08-document-page * { visibility: visible !important; } }` }} />
          </div>
        )}

        {showC01Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร C01</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowC01Modal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out flex flex-col gap-8 print:gap-0">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
                className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.5cm_2cm_1.5cm_3cm] relative print:p-[1.5cm_2cm_1.5cm_3cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto c01-document-page"
              >
                <div className="font-sarabun text-[11pt] leading-[1.5] text-black">
                  {/* Header */}
                  <div className="flex flex-col items-center mb-6">
                    <h1 className="text-[14pt] font-bold text-center leading-tight">ใบเบิกเงิน</h1>
                    <p className="text-[12pt] font-bold text-center leading-tight">({selectedProject.budget_source || '................................'})</p>
                  </div>

                  <div className="flex justify-between mb-4">
                    <div className="w-1/2">
                      <p>ชื่อสถานศึกษา วิทยาลัยเทคนิคตรัง</p>
                      <p>สำนักงานคณะกรรมการการอาชีวศึกษา</p>
                    </div>
                    <div className="w-1/2 text-right">
                      <p>ใบเบิกที่ ............. / .............</p>
                      <p>ลงวันที่ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="indent-[1cm]">ข้าพเจ้าขอเบิกเงิน ({selectedProject.budget_source || '................................'})</p>
                  </div>

                  {/* Items Table */}
                  <div className="mb-6">
                    <table className="w-full border-collapse border border-black text-[10pt]">
                      <thead>
                        <tr className="bg-slate-50 print:bg-transparent">
                          <th className="border border-black px-2 py-1 w-[15%] text-center">หมวดงบประมาณ</th>
                          <th className="border border-black px-2 py-1 w-[40%] text-center">รายการ(แสดงชื่อโครงการ)</th>
                          <th className="border border-black px-2 py-1 w-[15%] text-center">ใบสำคัญที่</th>
                          <th className="border border-black px-2 py-1 w-[15%] text-center">จำนวนเงิน</th>
                          <th className="border border-black px-2 py-1 w-[15%] text-center">รวมเงิน</th>
                          <th className="border border-black px-2 py-1 w-[10%] text-center">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-black px-2 py-1 text-center">{selectedProject.budget_category || '................'}</td>
                          <td className="border border-black px-2 py-1">{selectedProject.title}</td>
                          <td className="border border-black px-2 py-1 text-center">................</td>
                          <td className="border border-black px-2 py-1 text-right">{selectedProject.budget_amount.toLocaleString()}</td>
                          <td className="border border-black px-2 py-1 text-right">{selectedProject.budget_amount.toLocaleString()}</td>
                          <td className="border border-black px-2 py-1"></td>
                        </tr>
                        {/* Empty rows */}
                        {Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td className="border border-black px-2 py-1">&nbsp;</td>
                            <td className="border border-black px-2 py-1">&nbsp;</td>
                            <td className="border border-black px-2 py-1">&nbsp;</td>
                            <td className="border border-black px-2 py-1">&nbsp;</td>
                            <td className="border border-black px-2 py-1">&nbsp;</td>
                            <td className="border border-black px-2 py-1">&nbsp;</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="border border-black px-2 py-1 text-right font-bold">รวม</td>
                          <td className="border border-black px-2 py-1 text-right font-bold">{selectedProject.budget_amount.toLocaleString()}</td>
                          <td className="border border-black px-2 py-1 text-right font-bold">{selectedProject.budget_amount.toLocaleString()}</td>
                          <td className="border border-black px-2 py-1"></td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="border border-black px-2 py-1 text-right font-bold">ภาษีมูลค่าเพิ่ม</td>
                          <td className="border border-black px-2 py-1 text-right font-bold">0</td>
                          <td className="border border-black px-2 py-1 text-right font-bold">0</td>
                          <td className="border border-black px-2 py-1"></td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="border border-black px-2 py-1 text-right font-bold">รวมทั้งสิ้น</td>
                          <td className="border border-black px-2 py-1 text-right font-bold">{selectedProject.budget_amount.toLocaleString()}</td>
                          <td className="border border-black px-2 py-1 text-right font-bold">{selectedProject.budget_amount.toLocaleString()}</td>
                          <td className="border border-black px-2 py-1"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="mb-6">
                    <p className="font-bold">( {thaiBaht(selectedProject.budget_amount)} )</p>
                  </div>

                  <div className="space-y-4 mb-8">
                    <p className="indent-[1cm]">ขอรับรองว่าการเบิกเงินตามรายการข้างต้นได้ดำเนินการเป็นการถูกต้องตามระเบียบแล้ว และตรวจการจ่ายและใบสำคัญที่ขอเบิกมานี้รวม {selectedProject.items?.length || 0} รายการ ถูกต้องแล้ว</p>
                  </div>

                  <div className="grid grid-cols-1 gap-6 mb-8">
                    <div className="flex flex-col items-center ml-auto w-1/2">
                      <p className="mb-8">ลงชื่อ ........................................................... เจ้าหน้าที่การเงิน</p>
                      <p>( นางศิริกุล ไชยพลบาล )</p>
                    </div>

                    <div className="flex flex-col items-center ml-auto w-1/2">
                      <p className="mb-8">ลงชื่อ ........................................................... หัวหน้างานการเงิน</p>
                      <p>( ........................................................... )</p>
                    </div>

                    <div className="flex flex-col items-center ml-auto w-1/2 border-t border-slate-100 pt-4">
                      <div className="flex gap-8 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border border-black"></div>
                          <span className="text-[10pt]">เห็นควรอนุมัติ</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border border-black"></div>
                          <span className="text-[10pt]">ไม่เห็นควรอนุมัติ</span>
                        </div>
                      </div>
                      <p className="mb-8">ลงชื่อ ...........................................................</p>
                      <p>( นายนันธวุฒิ น้อย )</p>
                      <p>รองผู้อำนวยการฝ่ายบริหารทรัพยากร</p>
                    </div>

                    <div className="flex flex-col items-center border-t border-slate-100 pt-4">
                      <div className="flex gap-8 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border border-black"></div>
                          <span className="text-[10pt]">อนุมัติ</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border border-black"></div>
                          <span className="text-[10pt]">ไม่อนุมัติ</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="mb-8">ลงชื่อ ...........................................................</p>
                        <p>( นายกษิดิฏฐ์ คำศรี )</p>
                        <p>ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } .c01-document-page { position: static !important; width: 210mm !important; height: 297mm !important; padding: 1.5cm 2cm 1.5cm 3cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } .c01-document-page * { visibility: visible !important; } }` }} />
          </div>
        )}

        {showC02Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร C02</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowC02Modal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out flex flex-col gap-8 print:gap-0">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }} 
                className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.5cm_2cm_1.5cm_3cm] relative print:p-[1.5cm_2cm_1.5cm_3cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto c02-document-page"
              >
                <div className="font-sarabun text-[11pt] leading-[1.5] text-black">
                  {/* Garuda Header */}
                  <div className="relative mb-3 h-[1.5cm]">
                    <img src="https://fortsurasi.rta.mi.th/srshos-e-form/doc_file/krut-3-cm.png?1773708237" alt="Garuda" className="w-[1.5cm] h-[1.5cm] absolute left-0 top-0" referrerPolicy="no-referrer" />
                    <div className="text-center w-full">
                      <h1 className="text-[24pt] font-bold leading-none mt-1">บันทึกข้อความ</h1>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p><span className="font-bold">ส่วนราชการ</span> งานการเงิน ฝ่ายบริหารทรัพยากร วิทยาลัยเทคนิคตรัง</p>
                    <div className="flex justify-between">
                      <p><span className="font-bold">ที่</span> .................................................................................</p>
                      <p><span className="font-bold">วันที่</span> {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <p><span className="font-bold">เรื่อง</span> ขออนุมัติเบิกจ่ายเงิน</p>
                  </div>

                  <div className="mb-4">
                    <p><span className="font-bold">เรียน</span> ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                  </div>

                  <div className="mb-6 space-y-4">
                    <p className="indent-[1cm]">
                      ตามบันทึกข้อความงานพัสดุ ที่ {selectedProject.project_code || '................'} ลงวันที่ {
                        selectedProject.logs?.find(l => l.action.includes('B01'))?.timestamp 
                        ? formatThaiDate(selectedProject.logs.find(l => l.action.includes('B01'))!.timestamp, { day: 'numeric', month: 'long', year: 'numeric' })
                        : '................'
                      } รายงานขอซื้อ/ขอจ้างพัสดุจ่ายเงินจาก {selectedProject.budget_source || '................'} สำหรับ {selectedProject.department || '................'} จัดซื้อจัดจ้างโดยวิธีเฉพาะเจาะจง ตามระเบียบกระทรวงการคลัง ว่าด้วยการจัดซื้อจัดจ้างและบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 28(3) ซึ่งวิทยาลัยได้อนุมัติให้จัดซื้อ/จัดจ้างดังนี้
                    </p>

                    <div className="space-y-1">
                      {Object.entries(
                        (selectedProject.items || []).reduce((acc: any, item) => {
                          const shop = item.shop_name || 'ไม่ระบุร้านค้า';
                          if (!acc[shop]) acc[shop] = { count: 0, total: 0 };
                          acc[shop].count += 1;
                          acc[shop].total += item.total_price;
                          return acc;
                        }, {})
                      ).map(([shop, data]: [string, any], index) => (
                        <p key={shop} className="indent-[1.5cm]">
                          {index + 1}. {data.count} รายการ ซื้อ/จ้าง จาก {shop} รวมเป็นเงิน {data.total.toLocaleString()} บาท
                        </p>
                      ))}
                    </div>

                    <div className="pt-4 space-y-1">
                      <p className="indent-[1cm]">เป็นค่าวัสดุ/ค่าจ้าง {selectedProject.budget_amount.toLocaleString()} บาท ( {thaiBaht(selectedProject.budget_amount)} )</p>
                      <p className="indent-[1cm]">เป็นเงินภาษีมูลค่าเพิ่ม 7% (ถ้ามี) ................ บาท ( ................................ )</p>
                      <p className="indent-[1cm]">รวมทั้งสิ้น {selectedProject.budget_amount.toLocaleString()} บาท ( {thaiBaht(selectedProject.budget_amount)} )</p>
                    </div>

                    <p className="indent-[1cm]">
                      บัดนี้ บริษัท/ร้านค้า ได้ส่งมอบพัสดุเหล่านี้ให้วิทยาลัยฯ ซึ่งคณะกรรมการได้ทำการตรวจรับครบถ้วนถูกต้องและได้ส่งมอบให้งานพัสดุเรียบร้อยแล้ว
                    </p>

                    <p className="indent-[1cm]">จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ</p>
                  </div>

                  {/* Signatures */}
                  <div className="mt-12 space-y-8">
                    <div className="flex flex-col items-center ml-auto w-1/2">
                      <p className="mb-8">ลงชื่อ ...........................................................</p>
                      <p>( นางศิริกุล ไชยพลบาล )</p>
                      <p>หัวหน้างานการเงิน</p>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <p className="font-bold mb-2">ควรอนุมัติ</p>
                      <div className="flex flex-col items-center ml-auto w-1/2">
                        <p className="mb-8">ลงชื่อ ...........................................................</p>
                        <p>( นายนันธวุฒิ น้อย )</p>
                        <p>รองผู้อำนวยการฝ่ายบริหารทรัพยากร</p>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                      <div className="flex gap-8 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border border-black"></div>
                          <span>อนุมัติ</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border border-black"></div>
                          <span>ไม่อนุมัติ</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <p className="mb-8">ลงชื่อ ...........................................................</p>
                        <p>( นายกษิดิฏฐ์ คำศรี )</p>
                        <p>ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } .c02-document-page { position: static !important; width: 210mm !important; height: 297mm !important; padding: 1.5cm 2cm 1.5cm 3cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } .c02-document-page * { visibility: visible !important; } }` }} />
          </div>
        )}

        {showA02Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร A02</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowA02Modal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[2.5cm_2cm_2cm_3cm] relative print:p-[2.5cm_2cm_2cm_3cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto" id="a02-document">
                {/* เฉพาะโครงการยืมเงิน แสดงข้อความ ยืมเงินทดลองราชการ ด้านบนขวา อักษรสีแดงชัดๆ */}
                {Boolean(selectedProject.is_loan === true || selectedProject.is_loan === 1 || selectedProject.is_loan === '1' || selectedProject.is_loan === 'true') && (
                  <div className="absolute top-[1.2cm] right-[2cm] text-right z-10 select-none">
                    <div 
                      className="font-sarabun font-bold text-[14pt] text-red-600 border-2 border-red-600 px-3 py-0.5 rounded inline-block bg-red-50/50 print:bg-transparent"
                      style={{ color: '#dc2626', borderColor: '#dc2626' }}
                    >
                      ยืมเงินทดลองราชการ
                    </div>
                  </div>
                )}

                <div className="font-sarabun text-[14pt] leading-[1.6] text-black">
                  <div className="text-center mb-8">
                    <h2 className="text-[18pt] font-bold">รายละเอียดพัสดุ แนบท้ายบันทึกข้อความขอซื้อขอจ้าง</h2>
                  </div>

                  <div className="mt-4">
                    <table className="w-full border-collapse border border-black text-[12pt]">
                      <thead>
                        <tr className="bg-slate-50 print:bg-transparent text-[10pt]">
                          <th className="border border-black px-2 py-1 w-[5%]">ลำดับ</th>
                          <th className="border border-black px-2 py-1 w-[40%]">รายละเอียด</th>
                          <th className="border border-black px-2 py-1 w-[10%]">จำนวน</th>
                          <th className="border border-black px-2 py-1 w-[10%]">หน่วยนับ</th>
                          <th className="border border-black px-2 py-1 w-[15%] text-center">หน่วยละ(บาท)</th>
                          <th className="border border-black px-2 py-1 w-[20%] text-center">จำนวนเงิน(บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProject.items && selectedProject.items.length > 0 ? (
                          selectedProject.items.map((item, idx) => (
                            <tr key={idx}>
                              <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                              <td className="border border-black px-2 py-1">{item.description}</td>
                              <td className="border border-black px-2 py-1 text-center">{item.quantity}</td>
                              <td className="border border-black px-2 py-1 text-center">{item.unit}</td>
                              <td className="border border-black px-2 py-1 text-right">{item.unit_price.toLocaleString()}</td>
                              <td className="border border-black px-2 py-1 text-right">{(item.quantity * item.unit_price).toLocaleString()}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="border border-black px-2 py-1 text-center">1</td>
                            <td className="border border-black px-2 py-1">{selectedProject.title}</td>
                            <td className="border border-black px-2 py-1 text-center">1</td>
                            <td className="border border-black px-2 py-1 text-center">งาน</td>
                            <td className="border border-black px-2 py-1 text-right">{selectedProject.budget_amount.toLocaleString()}</td>
                            <td className="border border-black px-2 py-1 text-right">{selectedProject.budget_amount.toLocaleString()}</td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold">
                          <td colSpan={5} className="border border-black px-2 py-1 text-right">รวมทั้งสิ้น</td>
                          <td className="border border-black px-2 py-1 text-right">{selectedProject.budget_amount.toLocaleString()}</td>
                        </tr>
                        <tr className="font-bold">
                          <td colSpan={6} className="border border-black px-2 py-1 text-center">({thaiBaht(selectedProject.budget_amount)})</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="mt-16 grid grid-cols-2 gap-8 text-[11pt]">
                    <div className="text-center space-y-8">
                      <div>
                        <p className="mb-8">(ลงชื่อ)...........................................................</p>
                        <p>( {selectedProject.creator_name} )</p>
                        <p>{selectedProject.creator_position || 'ผู้รับผิดชอบโครงการ'}</p>
                        <p>ผู้เสนอโครงการ</p>
                      </div>
                    </div>
                    <div className="text-center space-y-4">
                      <p className="font-bold underline mb-4">คณะกรรมการตรวจรับพัสดุ</p>
                      <div className="space-y-3 text-left max-w-[300px] mx-auto">
                        {selectedProject.committee_chairman && (
                          <div className="flex justify-between gap-4">
                            <span>1. {selectedProject.committee_chairman}</span>
                            <span className="shrink-0">ประธานกรรมการ</span>
                          </div>
                        )}
                        {selectedProject.committee_member1 && (
                          <div className="flex justify-between gap-4">
                            <span>2. {selectedProject.committee_member1}</span>
                            <span className="shrink-0">กรรมการ</span>
                          </div>
                        )}
                        {selectedProject.committee_member2 && (
                          <div className="flex justify-between gap-4">
                            <span>3. {selectedProject.committee_member2}</span>
                            <span className="shrink-0">กรรมการ</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } #a02-document { position: relative !important; width: 210mm !important; height: 297mm !important; padding: 2.5cm 2cm 2cm 3cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } #a02-document * { visibility: visible !important; } }` }} />
          </div>
        )}

        {showA03Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร A03</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowA03Modal(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.2cm_2cm_1.2cm_3cm] relative print:p-[1.2cm_2cm_1.2cm_3cm] print:shadow-none print:rounded-none print:w-[210mm] print:h-[297mm] print:mx-auto" id="a03-document">
                {/* เลขรหัสโครงการ ด้านบนขวา อักษรสีแดงชัดๆ */}
                <div className="flex justify-end select-none mb-3">
                  <div className="text-right space-y-1">
                    <div 
                      className="font-sarabun font-bold text-[14pt] text-red-600 border-2 border-red-600 px-3.5 py-1 rounded inline-block bg-red-50/50 print:bg-transparent shadow-sm"
                      style={{ color: '#dc2626', borderColor: '#dc2626' }}
                    >
                      รหัสโครงการ : {selectedProject.project_code?.trim() || `PRJ-${selectedProject.id}`}
                    </div>
                    {Boolean(selectedProject.is_loan === true || selectedProject.is_loan === 1 || selectedProject.is_loan === '1' || selectedProject.is_loan === 'true') && (
                      <div>
                        <span 
                          className="font-sarabun font-bold text-[12pt] text-red-600 border border-red-600 px-2 py-0.5 rounded inline-block bg-red-50/40 print:bg-transparent"
                          style={{ color: '#dc2626', borderColor: '#dc2626' }}
                        >
                          (ยืมเงินทดลองราชการ)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="font-sarabun text-[14pt] leading-[1.3] text-black">
                  {/* เว้นบรรทัด ระหว่าง รหัสโครงการ กับข้อความ เอกสารการพิจารณาอนุมัติการขอซื้อขอจ้าง */}
                  <div className="text-center mb-5 mt-4 pt-1">
                    <h2 className="text-[18pt] font-bold">เอกสารการพิจารณาอนุมัติการขอซื้อขอจ้าง</h2>
                  </div>

                  <div className="space-y-1.5 text-[13pt]">
                    <div className="flex gap-2">
                      <span className="font-bold shrink-0">ชื่อโครงการ / รายการขอซื้อขอจ้าง:</span>
                      <span className="border-b border-dotted border-black grow">{selectedProject.title}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold shrink-0">ชื่อผู้เสนอโครงการ:</span>
                      <span className="border-b border-dotted border-black grow">{selectedProject.creator_name}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold shrink-0">ตำแหน่ง/ทำหน้าที่:</span>
                      <span className="border-b border-dotted border-black grow">{selectedProject.creator_position || '-'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold shrink-0">แผนกวิชา / งาน / ฝ่าย:</span>
                      <span className="border-b border-dotted border-black grow">{selectedProject.department}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold shrink-0">จำนวนรายการสินค้า:</span>
                      <span className="border-b border-dotted border-black grow">{selectedProject.items?.length || 0} รายการ</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-bold shrink-0">จำนวนเงิน:</span>
                      <span className="border-b border-dotted border-black grow">{(selectedProject.request_amount || selectedProject.budget_amount || 0).toLocaleString()} บาท</span>
                    </div>
                  </div>

                  <div className="mt-3.5 border-t-2 border-black pt-3">
                    <h2 className="text-[14pt] font-bold underline mb-1.5">การตรวจสอบ</h2>
                    <div className="space-y-2 text-[13pt]">
                      <div className="flex gap-8">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 border border-black flex items-center justify-center ${selectedProject.in_plan === 'yes' || selectedProject.in_plan === 'มีอยู่ในแผน' ? 'bg-black' : ''}`}>
                            {(selectedProject.in_plan === 'yes' || selectedProject.in_plan === 'มีอยู่ในแผน') && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                          <span>มีอยู่ในแผน</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 border border-black flex items-center justify-center ${selectedProject.in_plan === 'no' || selectedProject.in_plan === 'ไม่มีในแผน' ? 'bg-black' : ''}`}>
                            {(selectedProject.in_plan === 'no' || selectedProject.in_plan === 'ไม่มีในแผน') && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                          <span>ไม่มีในแผน</span>
                        </div>
                      </div>

                      {(() => {
                        const projFiscalYear = String(selectedProject.fiscal_year || '').trim();
                        const requestAmount = Number(
                          selectedProject.request_amount !== undefined && selectedProject.request_amount !== null && !isNaN(Number(selectedProject.request_amount))
                            ? selectedProject.request_amount
                            : (selectedProject.budget_amount || 0)
                        );

                        // 1. แหล่งงบประมาณ (นำยอดจากฐานข้อมูลงบประมาณมาคำนวณ)
                        const projSource = (selectedProject.budget_source || '').trim();
                        let matchedSource = budgetSources.find(s => 
                          s.name?.trim() === projSource && projFiscalYear && String(s.fiscal_year || '').trim() === projFiscalYear
                        );
                        if (!matchedSource) {
                          matchedSource = budgetSources.find(s => s.name?.trim().toLowerCase() === projSource.toLowerCase());
                        }

                        const sourceAllocated = matchedSource?.total_budget !== undefined && matchedSource?.total_budget !== null
                          ? Number(matchedSource.total_budget) 
                          : 0;
                        const sourceRequest = requestAmount;
                        const rawSourceBefore = matchedSource?.remaining_budget !== undefined && matchedSource?.remaining_budget !== null
                          ? Number(matchedSource.remaining_budget) + sourceRequest
                          : sourceAllocated;
                        const sourceBeforeRequest = Math.min(sourceAllocated, Math.max(0, rawSourceBefore));
                        const sourceRemaining = Math.max(0, sourceBeforeRequest - sourceRequest);

                        // 2. หมวดค่าใช้จ่าย (นำยอดจัดสรร ในฐานข้อมูลงบประมาณมาคำนวณ ให้ถูกต้อง)
                        const projCategoryName = (selectedProject.expense_category || selectedProject.loan_expense_category || '').trim();
                        let matchedCategory = expenseCategories.find(c => 
                          c.name?.trim() === projCategoryName && projFiscalYear && String(c.fiscal_year || '').trim() === projFiscalYear
                        );
                        if (!matchedCategory) {
                          matchedCategory = expenseCategories.find(c => c.name?.trim().toLowerCase() === projCategoryName.toLowerCase());
                        }

                        const categoryAllocated = matchedCategory?.allocated_budget !== undefined && matchedCategory?.allocated_budget !== null
                          ? Number(matchedCategory.allocated_budget)
                          : 0;
                        const categoryRequest = requestAmount;
                        const rawCategoryBefore = matchedCategory?.remaining_budget !== undefined && matchedCategory?.remaining_budget !== null
                          ? Number(matchedCategory.remaining_budget) + categoryRequest
                          : categoryAllocated;
                        const categoryBeforeRequest = Math.min(categoryAllocated, Math.max(0, rawCategoryBefore));
                        const categoryRemaining = Math.max(0, categoryBeforeRequest - categoryRequest);

                        // 3. ค่าใช้จ่ายโครงการ (โดยนำตัวเลขจากเจ้าหน้าที่งานยุทธศาสตร์ ในฐานข้อมูลโครงการ ยอดที่ได้รับจัดสรร งบประมาณคงเหลือก่อนขออนุมัติ ขออนุมัติครั้งนี้ คงเหลือ)
                        const projectAllocated = selectedProject.allocated_budget !== undefined && selectedProject.allocated_budget !== null && Number(selectedProject.allocated_budget) > 0
                          ? Number(selectedProject.allocated_budget)
                          : Number(selectedProject.budget_amount || 0);
                        const projectRequest = requestAmount;
                        const projectProcured = Number(selectedProject.procured_amount || 0);
                        const projectBeforeRequest = Math.max(0, projectAllocated - projectProcured);
                        const projectRemaining = Math.max(0, projectBeforeRequest - projectRequest);

                        return (
                          <div className="space-y-2.5 pt-1 text-[12pt]">
                            {/* 1. ส่วน แหล่งงบประมาณ */}
                            <div className="space-y-0.5">
                              <div className="flex gap-2">
                                <span className="font-bold shrink-0">แหล่งงบประมาณ:</span>
                                <span className="border-b border-dotted border-black grow">{selectedProject.budget_source || '-'}</span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">ยอดที่ได้รับจัดสรร (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {sourceAllocated.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">งบประมาณคงเหลือก่อนขออนุมัติ (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {sourceBeforeRequest.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">ขออนุมัติครั้งนี้ (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {sourceRequest.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">คงเหลือ (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {sourceRemaining.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 2. ส่วน หมวดค่าใช้จ่าย */}
                            <div className="space-y-0.5">
                              <div className="flex gap-2">
                                <span className="font-bold shrink-0">หมวดค่าใช้จ่าย:</span>
                                <span className="border-b border-dotted border-black grow">{projCategoryName || '-'}</span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">ยอดที่ได้รับจัดสรร (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {categoryAllocated.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">งบประมาณคงเหลือก่อนขออนุมัติ (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {categoryBeforeRequest.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">ขออนุมัติครั้งนี้ (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {categoryRequest.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">คงเหลือ (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {categoryRemaining.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 3. ส่วน ค่าใช้จ่ายโครงการ (จากเจ้าหน้าที่งานยุทธศาสตร์ ในฐานข้อมูลโครงการ) */}
                            <div className="space-y-0.5">
                              <div className="flex gap-2">
                                <span className="font-bold shrink-0">ค่าใช้จ่ายโครงการ:</span>
                                <span className="border-b border-dotted border-black grow truncate">
                                  {selectedProject.title} {selectedProject.project_code ? `(${selectedProject.project_code})` : ''}
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">ยอดที่ได้รับจัดสรร (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {projectAllocated.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">งบประมาณคงเหลือก่อนขออนุมัติ (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {projectBeforeRequest.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">ขออนุมัติครั้งนี้ (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {projectRequest.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-center text-[10.5pt] leading-tight flex items-center justify-center min-h-[2.2rem]">คงเหลือ (บาท)</span>
                                  <span className="border-b border-dotted border-black text-center h-5 font-mono text-[10.5pt]">
                                    {projectRemaining.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="mt-3.5 flex justify-end">
                      <div className="text-center space-y-1 text-[11pt]">
                        <p>(ลงชื่อ)...........................................................</p>
                        <p>( นายธีรวัฒน์  เดชอรัญ )</p>
                        <p>หัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ</p>
                        <p>........../........./.......</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-black pt-3">
                    <div className="flex justify-between items-start gap-8">
                      <div className="space-y-1.5 flex-1 text-[12pt]">
                        <p className="font-bold">ควรอนุมัติ</p>
                        <div className="text-center space-y-0.5">
                          <p>(ลงชื่อ)........................................</p>
                          <p>( นางจุฑามาศ ศรีวุฒิชาญ )</p>
                          <p className="text-[10pt]">รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน</p>
                          <p>........../........./.......</p>
                        </div>
                      </div>
                      <div className="space-y-1.5 flex-1 text-[12pt]">
                        <p className="font-bold">ควรอนุมัติ</p>
                        <div className="text-center space-y-0.5">
                          <p>(ลงชื่อ)........................................</p>
                          <p>( นายนันธวุฒิ น้อย )</p>
                          <p className="text-[10pt]">รองผู้อำนวยการฝ่ายบริหารทรัพยากร</p>
                          <p>........../........./.......</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 border-t-2 border-black pt-3">
                    <div className="space-y-3">
                      <div className="flex gap-8">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border border-black"></div>
                          <span>อนุมัติ</span>
                        </div>
                        <div className="flex items-center gap-2 grow">
                          <div className="w-4 h-4 border border-black"></div>
                          <span>ไม่อนุมัติ</span>
                        </div>
                      </div>
                      <div className="flex justify-center mt-3 text-[12pt]">
                        <div className="text-center space-y-0.5">
                          <p>(ลงชื่อ)...........................................................</p>
                          <p>( นายกษิดิฏฐ์ คำศรี )</p>
                          <p>ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                          <p>........../........./.......</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } #a03-document { position: relative !important; width: 210mm !important; height: 297mm !important; padding: 1.2cm 2cm 1.2cm 3cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } #a03-document * { visibility: visible !important; } }` }} />
          </div>
        )}
      </AnimatePresence>

      {/* Executive Summary Preview Modal */}
      <AnimatePresence>
        {showExecutivePreview && stats && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">พรีวิวบทสรุปผู้บริหาร</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-100 active:scale-95"><Printer size={18} /><FileDown size={18} /><span>พิมพ์ / PDF</span></button>
                <button onClick={() => setShowExecutivePreview(false)} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"><Plus className="rotate-45" size={20} /><span>ปิดหน้าต่าง</span></button>
              </div>
            </div>

            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 300}px` }} className="transition-transform duration-300 ease-out">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.5cm] relative print:p-0 print:shadow-none print:rounded-none print:w-[210mm] print:h-auto print:mx-auto font-sarabun" id="executive-preview">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold">บทสรุปผู้บริหาร</h1>
                  <p className="text-sm">ข้อมูลสถิติการเบิกจ่ายงบประมาณ วิทยาลัยเทคนิคตรัง</p>
                  <p className="text-xs mt-1">ข้อมูลระหว่างวันที่ {statsDateRange.startDate} ถึง {statsDateRange.endDate}</p>
                </div>

                <div className="space-y-8">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-5 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-slate-500 text-[10px] font-bold uppercase">ทั้งหมด</p>
                      <h3 className="text-xl font-bold">
                        {stats?.statusCounts?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0}
                      </h3>
                      <p className="text-[8px] text-slate-400">โครงการ</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <p className="text-emerald-600 text-[10px] font-bold uppercase">เบิกจ่ายแล้ว</p>
                      <h3 className="text-lg font-bold text-emerald-700">
                        {stats?.dailyPayments?.reduce((acc: number, curr: any) => acc + curr.total, 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }) || '฿0'}
                      </h3>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="text-blue-600 text-[10px] font-bold uppercase">วางแผน (A)</p>
                      <h3 className="text-xl font-bold text-blue-700">
                        {stats?.pendingByProcess?.find((p: any) => p.current_process === 'A')?.count || 0}
                      </h3>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <p className="text-amber-600 text-[10px] font-bold uppercase">พัสดุ (B)</p>
                      <h3 className="text-xl font-bold text-amber-700">
                        {stats?.pendingByProcess?.find((p: any) => p.current_process === 'B')?.count || 0}
                      </h3>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                      <p className="text-purple-600 text-[10px] font-bold uppercase">การเงิน (C)</p>
                      <h3 className="text-xl font-bold text-purple-700">
                        {stats?.pendingByProcess?.find((p: any) => p.current_process === 'C')?.count || 0}
                      </h3>
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 bg-white p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-sm mb-4">สถิติการเบิกจ่ายรายวัน</h4>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats?.dailyPayments || []}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 8, fill: '#94a3b8' }}
                              tickFormatter={(val) => {
                                if (!val) return '';
                                try {
                                  const d = safeDate(val);
                                  return !d || isNaN(d.getTime()) ? val : format(d, 'dd/MM');
                                } catch (e) {
                                  return val;
                                }
                              }}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 8, fill: '#94a3b8' }}
                              tickFormatter={(val) => `฿${(val/1000).toFixed(0)}k`}
                            />
                            <Bar dataKey="total" fill="#b91c1c" radius={[2, 2, 0, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-sm mb-4">สัดส่วนโครงการค้างจ่าย</h4>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats?.pendingByProcess || []}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={60}
                              paddingAngle={5}
                              dataKey="count"
                              nameKey="current_process"
                            >
                              {stats?.pendingByProcess?.map((entry: any, index: number) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.current_process === 'A' ? '#3b82f6' : entry.current_process === 'B' ? '#f59e0b' : '#a855f7'} 
                                />
                              ))}
                            </Pie>
                            <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: '8px' }}/>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Tables */}
                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-xs mb-4 flex items-center gap-2">
                        <Calendar className="text-slate-400" size={14} />
                        สรุปรายเดือน
                      </h4>
                      <div className="space-y-2">
                        {stats?.monthlyPayments?.slice(-5).reverse().map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-[10px]">
                            <p className="font-bold text-slate-800">{item.month}</p>
                            <p className="font-bold text-emerald-600">{item.total.toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-xs mb-4 flex items-center gap-2">
                        <Building2 className="text-slate-400" size={14} />
                        ยอดเบิกจ่ายรายแผนกวิชา/งาน
                      </h4>
                      <div className="space-y-2">
                        {stats?.departmentPayments?.slice(0, 5).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-[10px]">
                            <p className="font-bold text-slate-800 truncate max-w-[80px]">{item.department || 'ไม่ระบุ'}</p>
                            <p className="font-bold text-emerald-600">{item.total_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-xs mb-4 flex items-center gap-2">
                        <Coins className="text-red-600" size={14} />
                        โครงการยืมเงินรายแผนก
                      </h4>
                      <div className="space-y-2">
                        {stats?.loanDepartmentPayments?.slice(0, 5).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-red-50/30 rounded-lg text-[10px] border border-red-50">
                            <p className="font-bold text-slate-800 truncate max-w-[80px]">{item.department || 'ไม่ระบุ'}</p>
                            <div className="text-right">
                              <p className="font-bold text-red-700">{item.total_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })}</p>
                              <p className="text-[8px] text-emerald-600 font-bold">สำเร็จ: {item.completed_count}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-xs mb-4 flex items-center gap-2">
                        <Building2 className="text-slate-400" size={14} />
                        ยอดเบิกจ่ายรายร้านค้า
                      </h4>
                      <div className="space-y-2">
                        {stats?.shopPayments?.slice(0, 5).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-[10px]">
                            <p className="font-bold text-slate-800 truncate max-w-[80px]">{item.shop_name}</p>
                            <p className="font-bold text-red-700">{item.total_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-xs mb-4 flex items-center gap-2">
                        <Coins className="text-slate-400" size={14} />
                        แหล่งงบประมาณ
                      </h4>
                      <div className="space-y-2">
                        {stats?.budgetSourcePayments?.slice(0, 5).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-[10px]">
                            <p className="font-bold text-slate-800 truncate max-w-[80px]">{item.budget_source || 'ไม่ระบุ'}</p>
                            <p className="font-bold text-blue-700">{item.total_amount.toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } #executive-preview { position: static !important; width: 210mm !important; height: auto !important; padding: 1.5cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } #executive-preview * { visibility: visible !important; } }` }} />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditingProject && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-y-auto font-sarabun"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-slate-900">แก้ไขรายละเอียดโครงการ</h3>
                  <button 
                    onClick={() => setIsEditingProject(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ArrowRight size={24} className="text-slate-400 rotate-180" />
                  </button>
                </div>

                <form onSubmit={handleUpdateProject} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ชื่อโครงการ / รายการขอซื้อขอจ้าง</label>
                    <input 
                      required
                      type="text" 
                      value={editProjectForm.title || ''}
                      onChange={e => setEditProjectForm({...editProjectForm, title: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">สาขาวิชา / งาน / ฝ่าย</label>
                      <input 
                        required
                        type="text" 
                        value={editProjectForm.department || ''}
                        onChange={e => setEditProjectForm({...editProjectForm, department: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">จำนวนเงินงบประมาณรวม (บาท)</label>
                      <input 
                        readOnly
                        type="number" 
                        value={editProjectForm.budget_amount || 0}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-red-700 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">ลักษณะโครงการ</label>
                    <textarea 
                      value={editProjectForm.project_nature || ''}
                      onChange={e => setEditProjectForm({...editProjectForm, project_nature: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">เหตุผลความจำเป็น</label>
                    <textarea 
                      value={editProjectForm.necessity_reason || ''}
                      onChange={e => setEditProjectForm({...editProjectForm, necessity_reason: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">กำหนดการใช้วัสดุ</label>
                      <input 
                        type="text" 
                        value={editProjectForm.material_usage_date || ''}
                        onChange={e => setEditProjectForm({...editProjectForm, material_usage_date: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                        placeholder="วว/ดด/พ.ศ."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">งบประมาณที่ได้รับจัดสรร</label>
                      <input 
                        type="number" 
                        step="any"
                        value={editProjectForm.allocated_budget || 0}
                        onChange={e => setEditProjectForm({...editProjectForm, allocated_budget: Number(e.target.value)})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">จัดซื้อจัดจ้างมาแล้ว</label>
                      <input 
                        type="number" 
                        step="any"
                        value={editProjectForm.procured_amount || 0}
                        onChange={e => setEditProjectForm({...editProjectForm, procured_amount: Number(e.target.value)})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <input 
                      type="checkbox"
                      id="edit-is-loan"
                      checked={!!editProjectForm.is_loan}
                      onChange={e => setEditProjectForm({...editProjectForm, is_loan: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="edit-is-loan" className="text-sm font-bold text-indigo-900 cursor-pointer">
                      โครงการยืมเงินทดลองราชการ (สำหรับพิมพ์เอกสาร D01)
                    </label>
                  </div>

                  {editProjectForm.is_loan && (
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <label className="block text-sm font-bold text-indigo-900 mb-2">ชื่อผู้ยืมเงิน (เพื่อแต่งตั้งเป็นเจ้าหน้าที่พัสดุชั่วคราว D01)</label>
                      <input 
                        required
                        type="text" 
                        value={editProjectForm.borrower_name || ''}
                        onChange={e => setEditProjectForm({...editProjectForm, borrower_name: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                        placeholder="ระบุชื่อ-นามสกุล ผู้ยืมเงิน..."
                      />
                    </div>
                  )}

                  {/* Items Section */}
                  <div className="space-y-4 p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">รายการที่จะซื้อหรือจ้าง</h4>
                        <p className="text-[10px] text-slate-400">ระบุรายการสินค้าแต่ละรายการ (เช่น ดินสอ, กระดาษ) เพื่อแสดงในเอกสาร A01</p>
                      </div>
                      <button 
                        type="button"
                        onClick={addEditItem}
                        className="flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-800 transition-colors"
                      >
                        <Plus size={14} /> เพิ่มรายการ
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {(editProjectForm.items || []).map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-4 items-end bg-white p-4 rounded-xl border border-slate-100 shadow-sm transition-all hover:border-red-100">
                          <div className="col-span-3">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">รายการสินค้า/บริการ</label>
                            <input 
                              required
                              type="text"
                              value={item.description}
                              onChange={e => updateEditItem(index, 'description', e.target.value)}
                              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 font-medium"
                              placeholder="เช่น ดินสอ, กระดาษ..."
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">หน่วยนับ</label>
                            <input 
                              required
                              type="text"
                              value={item.unit}
                              onChange={e => updateEditItem(index, 'unit', e.target.value)}
                              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-center"
                            />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">จำนวน</label>
                            <input 
                              required
                              type="number"
                              value={item.quantity}
                              onChange={e => updateEditItem(index, 'quantity', Number(e.target.value))}
                              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-center"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">ราคา/หน่วย</label>
                            <input 
                              required
                              type="number"
                              step="any"
                              value={item.unit_price}
                              onChange={e => updateEditItem(index, 'unit_price', Number(e.target.value))}
                              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500 font-bold text-right"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">ราคารวม</label>
                            <input 
                              readOnly
                              type="number"
                              value={item.total_price}
                              className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-100 rounded-lg outline-none font-bold text-slate-700 text-right"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">ชื่อร้านค้า (ถ้ามี)</label>
                            <input 
                              type="text"
                              list="vendor-suggestions"
                              value={item.shop_name || ''}
                              onChange={e => updateEditItem(index, 'shop_name', e.target.value)}
                              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                              placeholder="ชื่อร้านค้า..."
                            />
                          </div>
                          <div className="col-span-1 flex justify-center pb-2">
                            {(editProjectForm.items || []).length > 1 && (
                              <button 
                                type="button"
                                onClick={() => removeEditItem(index)}
                                className="text-slate-300 hover:text-red-600 transition-colors"
                              >
                                <AlertCircle size={18} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">หัวหน้าแผนกวิชา/หัวหน้างาน</label>
                      <input 
                        required
                        type="text" 
                        value={editProjectForm.dept_head_name || ''}
                        onChange={e => setEditProjectForm({...editProjectForm, dept_head_name: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">ตำแหน่ง (หัวหน้าแผนก/งาน)</label>
                      <input 
                        required
                        type="text" 
                        value={editProjectForm.dept_head_position || ''}
                        onChange={e => setEditProjectForm({...editProjectForm, dept_head_position: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">รองผู้อำนวยการตามสายงาน</label>
                      <input 
                        required
                        type="text" 
                        value={editProjectForm.deputy_name || ''}
                        onChange={e => setEditProjectForm({...editProjectForm, deputy_name: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">ตำแหน่ง (รองฝ่าย)</label>
                      <input 
                        required
                        type="text" 
                        value={editProjectForm.deputy_position || ''}
                        onChange={e => setEditProjectForm({...editProjectForm, deputy_position: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsEditingProject(false)}
                      className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 bg-red-700 text-white font-bold py-4 rounded-xl hover:bg-red-800 transition-colors shadow-lg shadow-red-200"
                    >
                      บันทึกการแก้ไข
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}

        {showD01Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร D01</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-200 active:scale-95"><Printer size={16} /> พิมพ์เอกสาร</button>
                <button onClick={() => setShowD01Modal(false)} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all active:scale-95"><X size={20} /></button>
              </div>
            </div>

            {/* Document Page */}
            <div className="transition-transform duration-300 ease-out origin-top mb-20 print:m-0 print:transform-none" style={{ transform: `scale(${zoom})` }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.5cm_2cm_1.5cm_3cm] relative d01-document-page font-thai">
                {/* Garuda Header */}
                <div className="flex justify-center mb-4">
                  <img src="https://fortsurasi.rta.mi.th/srshos-e-form/doc_file/krut-3-cm.png?1773708237" alt="Garuda" className="w-[3cm] h-[3cm]" referrerPolicy="no-referrer" />
                </div>

                <div className="text-center mb-8">
                  <h2 className="text-[16pt] font-bold">คำสั่งวิทยาลัยเทคนิคตรัง</h2>
                  <p className="text-[12pt]">ที่ ............ / ........................</p>
                  <p className="text-[12pt]">เรื่อง แต่งตั้งเจ้าหน้าที่พัสดุชั่วคราวดำเนินการจัดซื้อจัดจ้าง</p>
                </div>

                <div className="text-[12pt] leading-[1.6] text-justify space-y-4">
                  <p className="indent-[2.5cm]">
                    อาศัยอำนาจตามคำสั่งสำนักงานคณะกรรมการการการอาชีวศึกษา ที่ 1291/2560 ลงวันที่ 30 สิงหาคม 2560 เรื่อง มอบอำนาจให้ผู้อำนวยการวิทยาลัยและผู้อำนวยการในสถาบันการอาชีวศึกษา สังกัดสำนักสำนักงานคณะกรรมการการอาชีวศึกษา ปฏิบัติราชการแทนเลขาธิการคณะกรรมการอาชีวศึกษา (เกี่ยวกับพัสดุ) ให้เป็นไปตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 และระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560
                  </p>
                  <p className="indent-[2.5cm]">
                    วิทยาลัยเทคนิคตรัง จึงแต่งตั้ง <span className="font-bold underline">{selectedProject.borrower_name || '...........................................................'}</span> เป็นเจ้าหน้าที่พัสดุชั่วคราว ทำหน้าที่ดำเนินการจัดซื้อจัดจ้าง เพื่อใช้ใน <span className="font-bold underline">{selectedProject.title}</span> จำนวน <span className="font-bold underline">{selectedProject.items?.length || 0}</span> รายการ เป็นจำนวนเงินทั้งสิ้น <span className="font-bold underline">{selectedProject.budget_amount.toLocaleString()}</span> บาท (<span className="font-bold underline">{thaiBaht(selectedProject.budget_amount)}</span>)
                  </p>
                  <p className="indent-[2.5cm]">
                    ให้ผู้ที่ได้รับการแต่งตั้งปฏิบัติหน้าที่ดังกล่าว ให้เป็นไปตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 และระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 อย่างเคร่งครัดต่อไป
                  </p>
                  <p className="indent-[2.5cm]">
                    ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไปจนกว่าจะแล้วเสร็จ
                  </p>
                </div>

                <div className="mt-12 w-full text-center">
                  <p className="text-[12pt]">สั่ง ณ วันที่ ........ เดือน ........................ พ.ศ. ................</p>
                  <div className="mt-16 space-y-1">
                    <p className="text-[12pt]">( นายกษิดิฏฐ์ คำศรี )</p>
                    <p className="text-[12pt]">ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } .d01-document-page { position: static !important; width: 210mm !important; height: 297mm !important; padding: 1.5cm 2cm 1.5cm 3cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } .d01-document-page * { visibility: visible !important; } }` }} />
          </div>
        )}

        {showD02Modal && selectedProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex flex-col items-center p-4 overflow-y-auto print:p-0 print:bg-white print:block print:static print:overflow-visible print-container">
            {/* Sticky Toolbar */}
            <div className="sticky top-0 w-full max-w-[210mm] mb-6 flex justify-between items-center bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl z-[160] print:hidden border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setZoom(0.75)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 0.75 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>75%</button>
                  <button onClick={() => setZoom(1)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>100%</button>
                  <button onClick={() => setZoom(1.25)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${zoom === 1.25 ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>125%</button>
                </div>
                <div className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ตัวอย่างเอกสาร D02 (ใบเบิก)</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-red-700 text-white text-sm font-bold rounded-xl hover:bg-red-800 transition-all shadow-lg shadow-red-200 active:scale-95"><Printer size={16} /> พิมพ์เอกสาร</button>
                <button onClick={() => setShowD02Modal(false)} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all active:scale-95"><X size={20} /></button>
              </div>
            </div>

            {/* Document Page */}
            <div className="transition-transform duration-300 ease-out origin-top mb-20 print:m-0 print:transform-none" style={{ transform: `scale(${zoom})` }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white w-[210mm] min-h-[297mm] shadow-2xl p-[1.5cm_2cm_1.5cm_2cm] relative d02-document-page font-thai text-[12pt]">
                <div className="text-center mb-6">
                  <h2 className="text-[16pt] font-bold underline">ใบเบิก {selectedProject.budget_source || '................'}</h2>
                  <p className="font-bold mt-2">วิทยาลัยเทคนิคตรัง สำนักงานคณะกรรมการการอาชีวศึกษา</p>
                </div>

                <div className="flex justify-center mb-4">
                  <div className="text-center">
                    <p>ใบเบิกที่ ............ / ............</p>
                    <p>ลงวันที่ ............ เดือน ........................ พ.ศ. ................</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="indent-[1cm]">ข้าพเจ้าขอเบิก {selectedProject.budget_source || '................'} ดังรายการดังนี้</p>
                </div>

                <table className="w-full border-collapse border border-black mb-4 text-[12pt]">
                  <thead>
                    <tr className="text-center font-bold">
                      <th className="border border-black px-2 py-1 w-[25%]">หมวดรายจ่ายงบประมาณ</th>
                      <th className="border border-black px-2 py-1 w-[35%]">รายการ</th>
                      <th className="border border-black px-2 py-1 w-[15%]">เลขที่ใบสำคัญ</th>
                      <th className="border border-black px-2 py-1 w-[12%]">จำนวนเงิน</th>
                      <th className="border border-black px-2 py-1 w-[12%]">รวมเงิน</th>
                      <th className="border border-black px-2 py-1">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black px-2 py-1 align-top h-[7cm] text-center">
                        {selectedProject.loan_expense_category || '................................'}
                      </td>
                      <td className="border border-black px-2 py-1 align-top">
                        {selectedProject.title}
                      </td>
                      <td className="border border-black px-2 py-1 align-top"></td>
                      <td className="border border-black px-2 py-1 align-top text-center">
                        {selectedProject.budget_amount.toLocaleString()}
                      </td>
                      <td className="border border-black px-2 py-1 align-top text-center">
                        {selectedProject.budget_amount.toLocaleString()}
                      </td>
                      <td className="border border-black px-2 py-1 align-top"></td>
                    </tr>
                    <tr className="font-bold">
                      <td colSpan={3} className="border border-black px-2 py-1 text-right">รวม</td>
                      <td className="border border-black px-2 py-1 text-center">{selectedProject.budget_amount.toLocaleString()}</td>
                      <td className="border border-black px-2 py-1 text-center">{selectedProject.budget_amount.toLocaleString()}</td>
                      <td className="border border-black px-2 py-1"></td>
                    </tr>
                    <tr className="font-bold">
                      <td colSpan={3} className="border border-black px-2 py-1 text-right">ภาษีมูลค่าเพิ่มถ้ามี</td>
                      <td className="border border-black px-2 py-1 text-center"></td>
                      <td className="border border-black px-2 py-1 text-center"></td>
                      <td className="border border-black px-2 py-1"></td>
                    </tr>
                    <tr className="font-bold">
                      <td colSpan={3} className="border border-black px-2 py-1 text-right">รวมทั้งสิ้น</td>
                      <td className="border border-black px-2 py-1 text-center">{selectedProject.budget_amount.toLocaleString()}</td>
                      <td className="border border-black px-2 py-1 text-center">{selectedProject.budget_amount.toLocaleString()}</td>
                      <td className="border border-black px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="border border-black px-2 py-1 text-center font-bold">
                        ( {thaiBaht(selectedProject.budget_amount)} )
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="grid grid-cols-2 gap-8 text-[12pt]">
                  {/* Left Column: Requester, Checker, Payer */}
                  <div className="space-y-6">
                    {/* Requester */}
                    <div>
                      <p className="indent-[1cm]">ขอรับรองว่าการเบิกเงินตามรายการข้างต้นนี้ได้ดำเนินการเป็นการถูกต้องตามระเบียบแล้วและได้ตรวจการจ่ายและใบสำคัญที่ขอมาเบิกเห็นถูกต้องแล้ว</p>
                      <div className="mt-6 text-center">
                        <p>ลงชื่อ ......................................... ผู้เบิก</p>
                        <p>( นางศิริกุล ไชยพลบาล )</p>
                        <p>............ / ............ / ............</p>
                      </div>
                    </div>
                    
                    {/* Checker (Planning Head) */}
                    <div className="border border-black p-3">
                      <p className="font-bold underline mb-2">ได้ตรวจสอบแล้ว ดังนี้</p>
                      <div className="space-y-1">
                        <p>ใช้ยอดเงิน ...................................................</p>
                        <p>ยอดยกมา ...................................................</p>
                        <p>จ่ายครั้งนี้ ...................................................</p>
                        <p>คงเหลือ ...................................................</p>
                      </div>
                      <div className="mt-4 text-center">
                        <p>ลงชื่อ .........................................</p>
                        <p>( นายธีรวัตน์ เดชอรัญ )</p>
                        <p>หัวหน้างานพัฒนายุทธศาสตร์ฯ</p>
                      </div>
                    </div>

                    {/* Payer */}
                    <div className="text-center pt-4">
                      <p>ลงชื่อ ......................................... ผู้จ่ายเงิน</p>
                      <p>............ / ............ / ............</p>
                    </div>
                  </div>

                  {/* Right Column: Approvers */}
                  <div className="space-y-6">
                    {/* Deputy Director Planning */}
                    <div className="text-center">
                      <p>เห็นควรอนุมัติ</p>
                      <div className="mt-6">
                        <p>ลงชื่อ .........................................</p>
                        <p>( นางจุฑามาศ ศรีวุฒิชาญ )</p>
                        <p>รองผู้อำนวยการฝ่ายแผนฯ</p>
                        <p>............ / ............ / ............</p>
                      </div>
                    </div>

                    {/* Deputy Director Resource Management */}
                    <div className="text-center">
                      <p>เห็นควรอนุมัติ</p>
                      <div className="mt-6">
                        <p>ลงชื่อ .........................................</p>
                        <p>( นายนันธวุฒิ น้อย )</p>
                        <p>รองผู้อำนวยการฝ่ายบริหารทรัพยากร</p>
                        <p>............ / ............ / ............</p>
                      </div>
                    </div>

                    {/* Director */}
                    <div className="text-center p-4">
                      <div className="font-bold mb-4 flex justify-center gap-12">
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-3.5 h-3.5 border border-black"></span> อนุมัติ
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-3.5 h-3.5 border border-black"></span> ไม่อนุมัติ
                        </span>
                      </div>
                      <div className="mt-6">
                        <p>ลงชื่อ .........................................</p>
                        <p>( นายกษิดิฏฐ์ คำศรี )</p>
                        <p>ผู้อำนวยการวิทยาลัยเทคนิคตรัง</p>
                        <p>............ / ............ / ............</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { @page { size: A4; margin: 0; } body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print\\:hidden, header, nav, footer, button, .sticky, .fixed:not(.print-container) { display: none !important; } .print-container { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; padding: 0 !important; margin: 0 !important; z-index: 9999 !important; visibility: visible !important; } .transition-transform { transform: none !important; margin-bottom: 0 !important; display: block !important; } .d02-document-page { position: static !important; width: 210mm !important; height: 297mm !important; padding: 1.5cm 2cm 1.5cm 2cm !important; margin: 0 auto !important; box-shadow: none !important; border: none !important; visibility: visible !important; transform: none !important; display: block !important; } .d02-document-page * { visibility: visible !important; } }` }} />
          </div>
        )}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-10 space-y-8"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">เปลี่ยนรหัสผ่านใหม่</h3>
                <p className="text-slate-500 text-sm">กรุณาระบุรหัสผ่านใหม่ที่คุณต้องการใช้งาน</p>
              </div>

              <form onSubmit={submitPasswordChange} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">รหัสผ่านใหม่</label>
                    <input 
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-700/5 focus:border-indigo-700 outline-none transition-all text-sm"
                      placeholder="ระบุรหัสผ่านใหม่"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">ยืนยันรหัสผ่านใหม่</label>
                    <input 
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-700/5 focus:border-indigo-700 outline-none transition-all text-sm"
                      placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
                      required
                    />
                  </div>
                </div>

                {passwordError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-3 text-red-600 text-xs font-medium"
                  >
                    <AlertCircle size={16} />
                    {passwordError}
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95 text-sm"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-indigo-700 text-white font-bold rounded-2xl hover:bg-indigo-800 transition-all shadow-lg shadow-indigo-100 active:scale-95 text-sm"
                  >
                    บันทึกข้อมูล
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Single Project Delete In-App Confirmation Modal */}
      <AnimatePresence>
        {projectToDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
                ยืนยันการลบโครงการ?
              </h3>
              <p className="text-sm text-slate-500 text-center mb-4">
                คุณกำลังจะลบโครงการ <strong className="text-slate-800">&quot;{projectToDeleteModal.title}&quot;</strong> ออกจากฐานข้อมูล การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">รหัสโครงการ:</span>
                  <span className="font-bold text-slate-700">{projectToDeleteModal.project_code || `ID: ${projectToDeleteModal.id}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">แผนก/ฝ่าย:</span>
                  <span className="font-bold text-slate-700">{projectToDeleteModal.department || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">วงเงินงบประมาณ:</span>
                  <span className="font-bold text-red-600">฿{Number(projectToDeleteModal.budget_amount || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeletingProject}
                  onClick={() => setProjectToDeleteModal(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeletingProject}
                  onClick={() => handleDeleteProject(projectToDeleteModal.id)}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeletingProject ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>กำลังลบ...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>ยืนยันลบ</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Delete Projects In-App Confirmation Modal */}
      <AnimatePresence>
        {showBatchDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">
                ยืนยันลบโครงการที่เลือกทั้งหมด?
              </h3>
              <p className="text-sm text-slate-500 text-center mb-5">
                คุณได้เลือกโครงการจำนวน <strong className="text-red-600 font-bold">{selectedIds.length}</strong> โครงการเพื่อลบออกจากระบบ การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isBatchDeleting}
                  onClick={() => setShowBatchDeleteModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isBatchDeleting}
                  onClick={handleBatchDeleteProjects}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isBatchDeleting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>กำลังลบ...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>ยืนยันลบ {selectedIds.length} รายการ</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global In-App Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border text-sm font-bold ${
              toastMessage.type === 'error'
                ? 'bg-red-900/90 text-white border-red-700 shadow-red-900/30'
                : 'bg-slate-900/90 text-white border-slate-700 shadow-slate-900/30'
            }`}
          >
            <CheckCircle2 size={18} className={toastMessage.type === 'error' ? 'text-red-400' : 'text-emerald-400'} />
            <span>{toastMessage.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
