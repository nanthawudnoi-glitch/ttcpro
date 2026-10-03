import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  Coins,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  ShieldCheck,
  Building2,
  RefreshCw,
  FolderKanban,
  FileSpreadsheet,
  Package,
  Calendar,
  Info,
  ArrowRight,
  History
} from 'lucide-react';
import { ExpenseCategory, CategoryPurchasedItem, Project, FiscalYear, BudgetAllocation } from '../types';
import { safeParseJson } from '../utils';

interface ExpenseCategoriesManagerProps {
  currentUser: any;
  userRole: string;
  selectedYear?: string;
  onSelectProject?: (project: Project) => void;
  onRefreshAll?: () => void;
}

const DEFAULT_INITIAL_CATEGORIES: ExpenseCategory[] = [
  { id: 1, name: 'งบ.ปวช.', code: '68-EXP-01', fiscal_year: '2568', allocated_budget: 1500000, allocations_count: 1, total_spent: 0, remaining_budget: 1500000, used_percentage: 0, description: 'งบประมาณเพื่อการจัดการศึกษาตามหลักสูตร ปวช.' },
  { id: 2, name: 'งบ.ปวส.', code: '68-EXP-02', fiscal_year: '2568', allocated_budget: 1200000, allocations_count: 1, total_spent: 0, remaining_budget: 1200000, used_percentage: 0, description: 'งบประมาณเพื่อการจัดการศึกษาตามหลักสูตร ปวส.' },
  { id: 3, name: 'งบ.ระยะสั้น', code: '68-EXP-03', fiscal_year: '2568', allocated_budget: 400000, allocations_count: 1, total_spent: 0, remaining_budget: 400000, used_percentage: 0, description: 'งบประมาณหลักสูตรวิชาชีพระยะสั้นและฝึกอบรม' },
  { id: 4, name: 'ค่าจัดการเรียนการสอน', code: '68-EXP-04', fiscal_year: '2568', allocated_budget: 2500000, allocations_count: 1, total_spent: 0, remaining_budget: 2500000, used_percentage: 0, description: 'งบประมาณสำหรับค่าวัสดุและอุปกรณ์จัดการเรียนการสอนทุกสาขาวิชา' }
];

export const ExpenseCategoriesManager: React.FC<ExpenseCategoriesManagerProps> = ({
  currentUser,
  userRole,
  selectedYear = 'all',
  onSelectProject,
  onRefreshAll
}) => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [fiscalYearsList, setFiscalYearsList] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'warning' | 'danger'>('all');
  const [currentYear, setCurrentYear] = useState<string>(selectedYear);

  // Modal: ลงข้อมูลและจัดการงวดงบประมาณที่ได้รับจัดสรร (Planning Department Multi-Installment Allocation)
  const [isAllocationModalOpen, setIsAllocationModalOpen] = useState(false);
  const [allocatingCategory, setAllocatingCategory] = useState<ExpenseCategory | null>(null);
  const [categoryAllocations, setCategoryAllocations] = useState<BudgetAllocation[]>([]);
  const [loadingCategoryAllocations, setLoadingCategoryAllocations] = useState(false);
  const [categoryAllocationForm, setCategoryAllocationForm] = useState({
    installment_no: '1',
    title: '',
    amount: '',
    allocation_date: new Date().toISOString().split('T')[0],
    doc_ref: '',
    notes: ''
  });
  const [allocationSubmitting, setAllocationSubmitting] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  // Modal: ดูโครงการและรายการสินค้าในหมวด (Category Details & Purchased Items)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<{
    category: ExpenseCategory;
    projects: any[];
    items: CategoryPurchasedItem[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<'items' | 'projects'>('items');

  // Modal: เพิ่ม / แก้ไขหมวดค่าใช้จ่าย (Add/Edit Category Form)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    fiscal_year: '2568',
    allocated_budget: '',
    description: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Category In-App Modal
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);
  const [forceDeleteCategory, setForceDeleteCategory] = useState(false);

  // Delete Category Allocation In-App Modal
  const [catAllocToDelete, setCatAllocToDelete] = useState<{ id: number; title: string; amount: number; installment_no: number } | null>(null);
  const [isDeletingCatAlloc, setIsDeletingCatAlloc] = useState(false);

  // Rights: Strategic Planning, Plan and Budget Department + Admin
  const isPlanningDept = ['ADMIN', 'PLANNING_HEAD', 'PLANNING_STAFF', 'DEPUTY_DIRECTOR_PLANNING'].includes(userRole);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const safeJson = async (r: Response) => {
    return await safeParseJson(r);
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const url = currentYear === 'all' 
        ? '/api/expense-categories' 
        : `/api/expense-categories?fiscal_year=${currentYear}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await safeParseJson<ExpenseCategory[]>(res);
        if (data && Array.isArray(data) && data.length > 0) {
          setCategories(data);
          try {
            localStorage.setItem('ttc_smartprocure_expense_categories', JSON.stringify(data));
          } catch (e) {}
          return;
        }
      }
    } catch (err) {
      console.warn('fetchCategories API unavailable, falling back to local storage:', err);
    } finally {
      setLoading(false);
    }

    // Fallback for Vercel static deployment or offline
    try {
      const saved = localStorage.getItem('ttc_smartprocure_expense_categories');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = currentYear === 'all' 
            ? parsed 
            : parsed.filter((c: any) => !c.fiscal_year || c.fiscal_year === currentYear);
          setCategories(filtered);
          return;
        }
      }
    } catch (e) {}
    setCategories(currentYear === 'all' ? DEFAULT_INITIAL_CATEGORIES : DEFAULT_INITIAL_CATEGORIES.filter(c => c.fiscal_year === currentYear));
  };

  const fetchFiscalYearsList = async () => {
    try {
      const res = await fetch('/api/fiscal-years');
      if (res.ok) {
        const data = await safeParseJson<FiscalYear[]>(res);
        if (data) setFiscalYearsList(data);
      }
    } catch (err) {
      console.error('Failed to fetch fiscal years list in categories:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchFiscalYearsList();
  }, [currentYear]);

  // Derived available fiscal years
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    fiscalYearsList.forEach(fy => set.add(fy.year));
    categories.forEach(c => {
      if (c.fiscal_year) set.add(c.fiscal_year);
    });
    if (set.size === 0) {
      set.add('2568');
      set.add('2567');
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [fiscalYearsList, categories]);

  // Overall Financial Calculations for Expense Categories
  const metrics = useMemo(() => {
    const totalAllocated = categories.reduce((sum, c) => sum + (c.allocated_budget || 0), 0);
    const totalSpent = categories.reduce((sum, c) => sum + (c.total_spent || 0), 0);
    const remaining = totalAllocated - totalSpent;
    const usedPercentage = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
    const totalProjects = categories.reduce((sum, c) => sum + (c.project_count || 0), 0);
    const totalItems = categories.reduce((sum, c) => sum + (c.item_count || 0), 0);

    return {
      totalAllocated,
      totalSpent,
      remaining,
      usedPercentage: Math.min(100, Math.round(usedPercentage * 10) / 10),
      totalProjects,
      totalItems
    };
  }, [categories]);

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q));

      let matchesStatus = true;
      const rem = c.remaining_budget ?? (c.allocated_budget - (c.total_spent || 0));
      const ratio = c.allocated_budget > 0 ? rem / c.allocated_budget : 0;

      if (statusFilter === 'normal') {
        matchesStatus = rem > 0 && ratio > 0.2;
      } else if (statusFilter === 'warning') {
        matchesStatus = rem > 0 && ratio <= 0.2;
      } else if (statusFilter === 'danger') {
        matchesStatus = rem <= 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [categories, searchQuery, statusFilter]);

  // Open Allocation Modal (Loads all installments)
  const openAllocateModal = async (category: ExpenseCategory) => {
    setAllocatingCategory(category);
    setIsAllocationModalOpen(true);
    setLoadingCategoryAllocations(true);
    setAllocationError(null);
    try {
      const res = await fetch(`/api/expense-categories/${category.id}/allocations`);
      if (res.ok) {
        const data = await safeParseJson<BudgetAllocation[]>(res);
        if (data) {
          setCategoryAllocations(data);
          const nextNo = (data.length > 0 ? Math.max(...data.map(d => d.installment_no || 0)) : 0) + 1;
          setCategoryAllocationForm({
            installment_no: String(nextNo),
            title: `${category.name} จัดสรรครั้งที่ ${nextNo}`,
            amount: '',
            allocation_date: new Date().toISOString().split('T')[0],
            doc_ref: '',
            notes: ''
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch category allocations:', err);
    } finally {
      setLoadingCategoryAllocations(false);
    }
  };

  // Save Allocation (Strategic Planning Dept adds an installment)
  const handleSaveAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingCategory) return;

    const val = parseFloat(categoryAllocationForm.amount);
    if (isNaN(val) || val <= 0) {
      setAllocationError('กรุณากรอกจำนวนเงินงบประมาณที่ถูกต้อง (มากกว่า 0 บาท)');
      return;
    }

    setAllocationSubmitting(true);
    setAllocationError(null);

    try {
      const updater = currentUser?.name 
        ? `${currentUser.name} (${currentUser.position || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'})` 
        : 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ';

      const res = await fetch(`/api/expense-categories/${allocatingCategory.id}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installment_no: categoryAllocationForm.installment_no ? Number(categoryAllocationForm.installment_no) : undefined,
          title: categoryAllocationForm.title.trim() || `${allocatingCategory.name} จัดสรรครั้งที่ ${categoryAllocationForm.installment_no}`,
          amount: val,
          allocation_date: categoryAllocationForm.allocation_date,
          doc_ref: categoryAllocationForm.doc_ref.trim(),
          notes: categoryAllocationForm.notes.trim(),
          created_by: updater
        })
      });

      if (res.ok) {
        const data = await safeJson(res);
        showToast(data?.message || `บันทึกงวดจัดสรรหมวด "${allocatingCategory.name}" จำนวน ฿${val.toLocaleString()} เรียบร้อยแล้ว`);
        // Refresh category allocations
        const allocRes = await fetch(`/api/expense-categories/${allocatingCategory.id}/allocations`);
        if (allocRes.ok) {
          const allocs = await safeParseJson<BudgetAllocation[]>(allocRes);
          if (allocs) {
            setCategoryAllocations(allocs);
            const nextNo = (allocs.length > 0 ? Math.max(...allocs.map(d => d.installment_no || 0)) : 0) + 1;
            setCategoryAllocationForm({
              installment_no: String(nextNo),
              title: `${allocatingCategory.name} จัดสรรครั้งที่ ${nextNo}`,
              amount: '',
              allocation_date: new Date().toISOString().split('T')[0],
              doc_ref: '',
              notes: ''
            });
          }
        }
        fetchCategories();
        if (onRefreshAll) onRefreshAll();
      } else {
        const data = await safeJson(res);
        setAllocationError(data?.error || 'ไม่สามารถบันทึกงวดจัดสรรได้');
      }
    } catch (err) {
      console.error('Failed to save allocation:', err);
      setAllocationError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setAllocationSubmitting(false);
    }
  };

  const handleDeleteCategoryAllocation = (alloc: { id: number; title: string; amount: number; installment_no: number }) => {
    setCatAllocToDelete(alloc);
  };

  const confirmDeleteCategoryAllocation = async () => {
    if (!allocatingCategory || !catAllocToDelete) return;
    setIsDeletingCatAlloc(true);
    try {
      const res = await fetch(`/api/expense-categories/${allocatingCategory.id}/allocations/${catAllocToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`ลบงวดจัดสรร "${catAllocToDelete.title}" เรียบร้อยแล้ว`);
        setCatAllocToDelete(null);
        const allocRes = await fetch(`/api/expense-categories/${allocatingCategory.id}/allocations`);
        if (allocRes.ok) {
          const allocs = await safeParseJson<BudgetAllocation[]>(allocRes);
          if (allocs) setCategoryAllocations(allocs);
        }
        fetchCategories();
        if (onRefreshAll) onRefreshAll();
      } else {
        const data = await safeJson(res);
        showToast(data?.error || 'ไม่สามารถลบงวดจัดสรรได้');
      }
    } catch (err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setIsDeletingCatAlloc(false);
    }
  };

  // Open Details Modal
  const openCategoryDetail = async (category: ExpenseCategory) => {
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    setDetailTab('items');
    try {
      const res = await fetch(`/api/expense-categories/${category.id}/details`);
      if (res.ok) {
        const data = await safeParseJson<{ category: ExpenseCategory; projects: Project[]; items: CategoryPurchasedItem[] }>(res);
        if (data) setSelectedDetail(data);
      } else {
        showToast('ไม่สามารถโหลดรายละเอียดได้');
      }
    } catch (err) {
      console.error('Failed to fetch details:', err);
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Add Category Modal
  const openAddModal = () => {
    const curYear = fiscalYearsList.find(f => Boolean(f.is_current))?.year || '2568';
    const targetYear = currentYear !== 'all' ? currentYear : curYear;
    const yearShort = targetYear.slice(-2);
    setEditingCategory(null);
    setFormData({
      name: '',
      code: `${yearShort}-EXP-${String(categories.length + 1).padStart(2, '0')}`,
      fiscal_year: targetYear,
      allocated_budget: '',
      description: ''
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Category Modal
  const openEditModal = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      code: category.code || '',
      fiscal_year: category.fiscal_year || '2568',
      allocated_budget: category.allocated_budget ? String(category.allocated_budget) : '0',
      description: category.description || ''
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Save Category Form (Add / Edit)
  const handleSaveCategoryForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('กรุณากรอกชื่อหมวดค่าใช้จ่าย');
      return;
    }

    const budgetVal = parseFloat(formData.allocated_budget);
    if (isNaN(budgetVal) || budgetVal < 0) {
      setFormError('กรุณากรอกจำนวนวงเงินจัดสรรที่ถูกต้อง');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const url = editingCategory 
        ? `/api/expense-categories/${editingCategory.id}` 
        : '/api/expense-categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const updater = currentUser?.name 
        ? `${currentUser.name} (${currentUser.position || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'})` 
        : 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim(),
          fiscal_year: formData.fiscal_year,
          allocated_budget: budgetVal,
          description: formData.description.trim(),
          updated_by: updater
        })
      });

      if (res.ok) {
        setIsFormModalOpen(false);
        showToast(editingCategory ? 'แก้ไขหมวดค่าใช้จ่ายเรียบร้อยแล้ว' : 'เพิ่มหมวดค่าใช้จ่ายใหม่เรียบร้อยแล้ว');
        fetchCategories();
        if (onRefreshAll) onRefreshAll();
      } else {
        if (res.status === 404 || !res.status) {
          saveCategoryLocally(budgetVal);
          return;
        }
        const data = await safeJson(res);
        setFormError(data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } catch (err) {
      saveCategoryLocally(budgetVal);
    } finally {
      setFormSubmitting(false);
    }
  };

  const saveCategoryLocally = (budgetVal: number) => {
    let currentLocal: ExpenseCategory[] = [];
    try {
      const saved = localStorage.getItem('ttc_smartprocure_expense_categories');
      currentLocal = saved ? JSON.parse(saved) : DEFAULT_INITIAL_CATEGORIES;
    } catch (e) {
      currentLocal = DEFAULT_INITIAL_CATEGORIES;
    }

    if (editingCategory) {
      currentLocal = currentLocal.map(c => c.id === editingCategory.id ? {
        ...c,
        name: formData.name.trim(),
        code: formData.code.trim(),
        fiscal_year: formData.fiscal_year,
        allocated_budget: budgetVal,
        description: formData.description.trim()
      } : c);
    } else {
      const newCat: ExpenseCategory = {
        id: Date.now(),
        name: formData.name.trim(),
        code: formData.code.trim() || `${formData.fiscal_year.slice(-2)}-EXP-${String(currentLocal.length + 1).padStart(2, '0')}`,
        fiscal_year: formData.fiscal_year,
        allocated_budget: budgetVal,
        allocations_count: 1,
        total_spent: 0,
        remaining_budget: budgetVal,
        used_percentage: 0,
        description: formData.description.trim()
      };
      currentLocal = [newCat, ...currentLocal];
    }
    try {
      localStorage.setItem('ttc_smartprocure_expense_categories', JSON.stringify(currentLocal));
    } catch (e) {}
    setIsFormModalOpen(false);
    showToast(editingCategory ? 'แก้ไขหมวดค่าใช้จ่ายเรียบร้อยแล้ว' : 'เพิ่มหมวดค่าใช้จ่ายใหม่เรียบร้อยแล้ว');
    fetchCategories();
    if (onRefreshAll) onRefreshAll();
  };

  // Delete Category (opens in-app confirmation modal)
  const handleDeleteCategory = (cat: ExpenseCategory) => {
    setDeleteCategoryError(null);
    setForceDeleteCategory(false);
    setCategoryToDelete(cat);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    setDeleteCategoryError(null);

    try {
      const url = `/api/expense-categories/${categoryToDelete.id}${forceDeleteCategory ? '?force=true' : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = await safeJson(res);
      if (res.ok) {
        deleteCategoryLocally(categoryToDelete.id, categoryToDelete.name);
        setCategoryToDelete(null);
        showToast(data?.message || `ลบหมวดค่าใช้จ่าย "${categoryToDelete.name}" เรียบร้อยแล้ว`);
        fetchCategories();
        if (onRefreshAll) onRefreshAll();
      } else {
        if (res.status === 404 || !res.status) {
          deleteCategoryLocally(categoryToDelete.id, categoryToDelete.name);
          setCategoryToDelete(null);
          return;
        }
        setDeleteCategoryError(data?.error || 'ไม่สามารถลบหมวดค่าใช้จ่ายได้');
      }
    } catch (err: any) {
      deleteCategoryLocally(categoryToDelete.id, categoryToDelete.name);
      setCategoryToDelete(null);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const deleteCategoryLocally = (id: number, name: string) => {
    try {
      const saved = localStorage.getItem('ttc_smartprocure_expense_categories');
      const currentLocal: ExpenseCategory[] = saved ? JSON.parse(saved) : DEFAULT_INITIAL_CATEGORIES;
      const filtered = currentLocal.filter(c => c.id !== id);
      localStorage.setItem('ttc_smartprocure_expense_categories', JSON.stringify(filtered));
    } catch (e) {}
    showToast(`ลบหมวดค่าใช้จ่าย "${name}" เรียบร้อยแล้ว`);
    fetchCategories();
    if (onRefreshAll) onRefreshAll();
  };

  // Export Categories to CSV
  const exportCategoriesCSV = () => {
    if (categories.length === 0) return;
    const headers = [
      'รหัสหมวด',
      'ชื่อหมวดค่าใช้จ่าย',
      'ปีงบประมาณ',
      'งบประมาณที่ได้รับจัดสรร (บาท)',
      'เงินที่ใช้ซื้อสินค้าในโครงการ (บาท)',
      'ยอดคงเหลือสุทธิ (บาท)',
      'อัตราการใช้ (%)',
      'จำนวนโครงการ',
      'จำนวนรายการสินค้า',
      'ผู้บันทึก/ปรับปรุงล่าสุด'
    ];

    const rows = categories.map(c => [
      `"${c.code || ''}"`,
      `"${c.name}"`,
      `"${c.fiscal_year || '2568'}"`,
      c.allocated_budget || 0,
      c.total_spent || 0,
      c.remaining_budget || 0,
      `${c.used_percentage || 0}%`,
      c.project_count || 0,
      c.item_count || 0,
      `"${c.updated_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expense_categories_summary_${currentYear}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 text-xs font-bold"
          >
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Strategic Planning Responsibility Banner */}
      <div className="p-6 bg-gradient-to-r from-red-800 via-red-700 to-rose-700 rounded-3xl text-white shadow-xl shadow-red-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[11px] font-bold tracking-wide uppercase flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-300" />
              หน้าที่รับผิดชอบ: งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ
            </span>
            <span className="px-2.5 py-1 bg-white/10 rounded-lg text-[11px] font-medium text-red-100">
              ปีงบประมาณ {currentYear === 'all' ? 'ทั้งหมด' : currentYear}
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
            จัดการหมวดค่าใช้จ่าย และยอดเงินจัดสรร
          </h2>
          <p className="text-xs md:text-sm text-red-100/90 max-w-3xl leading-relaxed">
            งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ มีหน้าที่ลงข้อมูลจำนวนงบประมาณที่ได้รับจัดสรรในแต่ละหมวด 
            ระบบจะหักลบจำนวนเงินที่ใช้ซื้อสินค้าในโครงการที่ใช้เงินในหมวดนั้นๆ โดยอัตโนมัติ และแสดงยอดคงเหลือสุทธิแบบเรียลไทม์
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          {isPlanningDept ? (
            <button
              id="add-new-category-header-btn"
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-red-800 hover:bg-red-50 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95"
            >
              <Plus size={16} />
              เพิ่มหมวดค่าใช้จ่ายใหม่
            </button>
          ) : (
            <div className="px-3.5 py-2 bg-white/10 backdrop-blur-sm rounded-xl text-xs font-bold text-red-100 flex items-center gap-2 border border-white/10">
              <Info size={14} />
              โหมดอ่าน (สิทธิ์ลงข้อมูลเฉพาะงานแผนฯ)
            </div>
          )}

          <button
            onClick={exportCategoriesCSV}
            title="ดาวน์โหลดสรุปเป็น CSV"
            className="flex items-center gap-2 px-3.5 py-2.5 bg-red-900/60 hover:bg-red-900 text-white rounded-xl text-xs font-bold transition-all border border-red-500/30"
          >
            <Download size={15} />
            ส่งออก CSV
          </button>
        </div>
      </div>

      {/* KPI Overview Cards for Expense Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Allocated */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-slate-600">งบประมาณที่ได้รับจัดสรรรวม</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Coins size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            ฿{metrics.totalAllocated.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
            <Layers size={13} className="text-blue-500" />
            รวม {categories.length} หมวดค่าใช้จ่าย
          </div>
        </div>

        {/* 2. Total Deducted for Purchases */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-slate-600">เงินที่ใช้ซื้อสินค้าในโครงการ (หักลบ)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            ฿{metrics.totalSpent.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
            <Package size={13} className="text-amber-500" />
            หักลบจาก {metrics.totalProjects} โครงการ ({metrics.totalItems} รายการพัสดุ)
          </div>
        </div>

        {/* 3. Net Remaining Balance */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-slate-600">ยอดงบประมาณคงเหลือสุทธิ</span>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
              metrics.remaining >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              <Wallet size={18} />
            </div>
          </div>
          <div className={`text-2xl font-black tracking-tight ${
            metrics.remaining >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            ฿{metrics.remaining.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
            <CheckCircle2 size={13} className={metrics.remaining >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
            {metrics.remaining >= 0 ? 'พร้อมจัดสรรและเบิกจ่าย' : 'ยอดเงินเกินงบจัดสรร'}
          </div>
        </div>

        {/* 4. Usage Ratio */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-slate-600">สัดส่วนการใช้งบประมาณ</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 tracking-tight">
            {metrics.usedPercentage}%
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  metrics.usedPercentage > 90 ? 'bg-rose-500' : metrics.usedPercentage > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, metrics.usedPercentage)}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-slate-500">
              {metrics.totalSpent > 0 ? 'ใช้ไปแล้ว' : 'ยังไม่เบิกใช้'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              id="search-expense-category-input"
              type="text"
              placeholder="ค้นหาหมวดค่าใช้จ่าย, รหัสหมวด, รายละเอียด..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none transition-all"
            />
          </div>

          {/* Year selector */}
          <select
            id="filter-category-year"
            value={currentYear}
            onChange={(e) => setCurrentYear(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
          >
            <option value="all">ทุกปีงบประมาณ</option>
            {availableYears.map(y => (
              <option key={y} value={y}>ปีงบประมาณ {y}</option>
            ))}
          </select>

          {/* Status selector */}
          <select
            id="filter-category-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
          >
            <option value="all">สถานะงบทั้งหมด</option>
            <option value="normal">งบคงเหลือปกติ (&gt; 20%)</option>
            <option value="warning">งบใกล้หมด (≤ 20%)</option>
            <option value="danger">งบเกิน / ติดลบ</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 self-end md:self-auto">
          <span>แสดง {filteredCategories.length} จาก {categories.length} หมวด</span>
          <button
            onClick={fetchCategories}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Categories Cards Grid */}
      {loading ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200">
          <RefreshCw className="animate-spin text-red-700 mx-auto mb-3" size={32} />
          <p className="text-sm font-bold text-slate-600">กำลังโหลดฐานข้อมูลหมวดค่าใช้จ่าย...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8">
          <Layers className="text-slate-300 mx-auto mb-3" size={48} />
          <h4 className="text-base font-bold text-slate-700">ไม่พบหมวดค่าใช้จ่ายที่ตรงกับเงื่อนไข</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            ลองปรับเปลี่ยนคำค้นหาหรือตัวกรองปีงบประมาณ หรือเพิ่มหมวดค่าใช้จ่ายใหม่
          </p>
          {isPlanningDept && (
            <button
              onClick={openAddModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold"
            >
              <Plus size={16} />
              เพิ่มหมวดค่าใช้จ่ายใหม่
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredCategories.map((cat) => {
            const rem = cat.remaining_budget ?? (cat.allocated_budget - (cat.total_spent || 0));
            const ratio = cat.allocated_budget > 0 ? (cat.total_spent || 0) / cat.allocated_budget : 0;
            const pct = Math.min(100, Math.round(ratio * 100));

            return (
              <div
                key={cat.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-red-200"
              >
                {/* Card Header */}
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-mono font-bold text-[11px]">
                        {cat.code || `EXP-${String(cat.id).padStart(2, '0')}`}
                      </span>
                      <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-lg font-bold text-[11px]">
                        ปีงบฯ {cat.fiscal_year || '2568'}
                      </span>
                      {rem < 0 ? (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full font-bold text-[10px] flex items-center gap-1">
                          <AlertCircle size={11} /> เกินงบจัดสรร
                        </span>
                      ) : rem === 0 && cat.allocated_budget > 0 ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold text-[10px]">
                          ใช้งบหมดแล้ว
                        </span>
                      ) : ratio > 0.8 ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold text-[10px]">
                          งบใกล้หมด (&gt;80%)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 size={11} /> งบคงเหลือพร้อมใช้
                        </span>
                      )}
                    </div>

                    {isPlanningDept && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(cat)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="แก้ไขข้อมูลหมวดค่าใช้จ่าย"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="ลบหมวดค่าใช้จ่าย"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg font-black text-slate-900 group-hover:text-red-700 transition-colors">
                    {cat.name}
                  </h3>
                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                </div>

                {/* Card Body: 3-Metric Numbers (Allocated, Deducted Spent, Remaining) */}
                <div className="p-6 bg-slate-50/60 flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {/* 1. Allocated Budget */}
                    <div className="p-3 bg-white rounded-2xl border border-slate-200/70">
                      <div className="text-[10px] font-bold text-slate-500 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Coins size={12} className="text-blue-500" />
                          งบที่ได้รับจัดสรร
                        </span>
                        <span className="text-[9px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {cat.allocations_count || 1} งวด
                        </span>
                      </div>
                      <div className="text-sm sm:text-base font-black text-slate-800">
                        ฿{cat.allocated_budget.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-blue-600 mt-0.5 font-medium">
                        รวมก้อนเดียวกัน
                      </div>
                    </div>

                    {/* 2. Deducted Purchased Amount */}
                    <div className="p-3 bg-white rounded-2xl border border-slate-200/70">
                      <div className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                        <ShoppingCart size={12} className="text-amber-500" />
                        หักลบ ซื้อสินค้า
                      </div>
                      <div className="text-sm sm:text-base font-black text-amber-600">
                        ฿{(cat.total_spent || 0).toLocaleString()}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {cat.project_count || 0} โครงการ ({cat.item_count || 0} ชิ้น)
                      </div>
                    </div>

                    {/* 3. Net Remaining Balance */}
                    <div className="p-3 bg-white rounded-2xl border border-slate-200/70">
                      <div className="text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                        <Wallet size={12} className={rem >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
                        ยอดคงเหลือสุทธิ
                      </div>
                      <div className={`text-sm sm:text-base font-black ${rem >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ฿{rem.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {cat.allocated_budget > 0 ? `เหลือ ${100 - pct}%` : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-slate-500">สัดส่วนการใช้งบประมาณในหมวดนี้</span>
                      <span className={pct > 90 ? 'text-rose-600' : pct > 75 ? 'text-amber-600' : 'text-slate-700'}>
                        {pct}% ({((cat.total_spent || 0)).toLocaleString()} / {cat.allocated_budget.toLocaleString()} ฿)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer Meta & Action Buttons */}
                  <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-400">
                      ผู้ลงข้อมูล: <span className="font-semibold text-slate-600">{cat.updated_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Drill-down button */}
                      <button
                        onClick={() => openCategoryDetail(cat)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                      >
                        <Eye size={14} />
                        ดูโครงการและสินค้า ({cat.project_count || 0})
                      </button>

                      {/* Strategic Planning Allocation Button */}
                      {isPlanningDept && (
                        <button
                          onClick={() => openAllocateModal(cat)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold shadow-md shadow-red-200 transition-all active:scale-95"
                          title="งานพัฒนายุทธศาสตร์ฯ จัดการงวดจัดสรรงบประมาณ (เพิ่มวงเงินได้หลายครั้ง)"
                        >
                          <Coins size={14} />
                          เพิ่ม/จัดการงวดจัดสรร ({cat.allocations_count || 1} ครั้ง)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: จัดการและเพิ่มงวดงบประมาณที่ได้รับจัดสรร (Planning Multi-Installment Allocation Modal) */}
      <AnimatePresence>
        {isAllocationModalOpen && allocatingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-4xl w-full my-8 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50/70 via-rose-50/50 to-white">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-red-700 text-white flex items-center justify-center shadow-md shadow-red-200">
                    <Coins size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded-lg uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck size={12} className="text-red-700" />
                        งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg">
                        ปีงบฯ {allocatingCategory.fiscal_year || '2568'}
                      </span>
                      {allocatingCategory.code && (
                        <span className="font-mono text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                          {allocatingCategory.code}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg md:text-xl font-black text-slate-900 mt-1">
                      จัดการและเพิ่มวงเงินจัดสรร: {allocatingCategory.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      สามารถเพิ่มวงเงินที่ได้รับจัดสรรได้มากกว่า 1 ครั้ง โดยรัฐบาลจัดสรรมาเป็นงวดๆ วงเงินรวมทั้งหมดเป็นก้อนเดียวกัน (เช่น {allocatingCategory.name} ครั้งที่ 1, ครั้งที่ 2)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAllocationModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-4 bg-gradient-to-br from-blue-50/80 to-blue-50/30 rounded-2xl border border-blue-100">
                    <div className="text-[11px] font-bold text-blue-700 mb-1 flex items-center gap-1.5">
                      <Coins size={14} />
                      วงเงินรวมสะสม (ก้อนเดียว)
                    </div>
                    <div className="text-xl font-black text-slate-900">
                      ฿{(allocatingCategory.allocated_budget || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-blue-600 font-semibold mt-1">
                      รวมทุกงวดที่ได้รับจัดสรร
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                      <History size={14} />
                      จำนวนงวดที่จัดสรร
                    </div>
                    <div className="text-xl font-black text-slate-900">
                      {categoryAllocations.length} ครั้ง
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      บันทึกในระบบ {categoryAllocations.length} รายการ
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-amber-50/80 to-amber-50/30 rounded-2xl border border-amber-100">
                    <div className="text-[11px] font-bold text-amber-700 mb-1 flex items-center gap-1.5">
                      <ShoppingCart size={14} />
                      หักลบ ซื้อสินค้าโครงการ
                    </div>
                    <div className="text-xl font-black text-amber-600">
                      ฿{(allocatingCategory.total_spent || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-amber-600 font-semibold mt-1">
                      {allocatingCategory.project_count || 0} โครงการ ({allocatingCategory.item_count || 0} ชิ้น)
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-emerald-50/80 to-emerald-50/30 rounded-2xl border border-emerald-100">
                    <div className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                      <Wallet size={14} />
                      ยอดคงเหลือสุทธิ
                    </div>
                    <div className={`text-xl font-black ${(allocatingCategory.remaining_budget ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      ฿{(allocatingCategory.remaining_budget || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                      พร้อมใช้ซื้อสินค้าในโครงการ
                    </div>
                  </div>
                </div>

                {/* Section 1: Add New Installment Form */}
                {isPlanningDept && (
                  <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-red-700 text-white flex items-center justify-center font-bold text-xs">
                          <Plus size={14} />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-800">
                            บันทึกเพิ่มวงเงินที่ได้รับจัดสรร (งวดใหม่)
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            เช่น {allocatingCategory.name} ครั้งที่ 2, ครั้งที่ 3 หรือเงินจัดสรรเพิ่มเติมในรอบปี
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded-full">
                        เพิ่มงวดจัดสรร
                      </span>
                    </div>

                    {allocationError && (
                      <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                        <AlertCircle size={15} />
                        <span>{allocationError}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveAllocation} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-3 space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            งวดที่ / ครั้งที่ <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              required
                              value={categoryAllocationForm.installment_no}
                              onChange={(e) => {
                                const no = e.target.value;
                                setCategoryAllocationForm({
                                  ...categoryAllocationForm,
                                  installment_no: no,
                                  title: `${allocatingCategory.name} จัดสรรครั้งที่ ${no}`
                                });
                              }}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-red-500 outline-none"
                              placeholder="เช่น 2"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                              ครั้งที่
                            </span>
                          </div>
                        </div>

                        <div className="sm:col-span-5 space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            ชื่องวด / รายการจัดสรร <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={categoryAllocationForm.title}
                            onChange={(e) => setCategoryAllocationForm({ ...categoryAllocationForm, title: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-red-500 outline-none"
                            placeholder={`เช่น ${allocatingCategory.name} ครั้งที่ 2`}
                          />
                        </div>

                        <div className="sm:col-span-4 space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            จำนวนเงินจัดสรรงวดนี้ (บาท) <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              min="1"
                              required
                              value={categoryAllocationForm.amount}
                              onChange={(e) => setCategoryAllocationForm({ ...categoryAllocationForm, amount: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-red-500 outline-none pr-10"
                              placeholder="เช่น 500000"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                              บาท
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Amount presets */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-400 mr-1 font-semibold">ทางลัดระบุยอดเงิน:</span>
                        {[100000, 200000, 500000, 1000000, 1500000, 2000000].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCategoryAllocationForm({ ...categoryAllocationForm, amount: String(val) })}
                            className="px-2 py-0.5 bg-white hover:bg-red-50 hover:text-red-700 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 transition-colors"
                          >
                            +฿{val.toLocaleString()}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            วันที่ได้รับจัดสรร
                          </label>
                          <input
                            type="date"
                            value={categoryAllocationForm.allocation_date}
                            onChange={(e) => setCategoryAllocationForm({ ...categoryAllocationForm, allocation_date: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-red-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            เลขที่หนังสือ / เอกสารอ้างอิง
                          </label>
                          <input
                            type="text"
                            value={categoryAllocationForm.doc_ref}
                            onChange={(e) => setCategoryAllocationForm({ ...categoryAllocationForm, doc_ref: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-red-500 outline-none"
                            placeholder="เช่น หนังสือจัดสรรงวดที่ 2"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            หมายเหตุ / คำอธิบายงวดนี้
                          </label>
                          <input
                            type="text"
                            value={categoryAllocationForm.notes}
                            onChange={(e) => setCategoryAllocationForm({ ...categoryAllocationForm, notes: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-red-500 outline-none"
                            placeholder="เช่น เงินจัดสรรเพิ่มเติมรอบที่ 2"
                          />
                        </div>
                      </div>

                      {/* Live Calculation Preview Banner */}
                      {parseFloat(categoryAllocationForm.amount) > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 bg-gradient-to-r from-red-50 via-rose-50 to-amber-50 rounded-xl border border-red-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-600">คำนวณวงเงินสะสมใหม่:</span>
                            <span className="text-slate-500">฿{(allocatingCategory.allocated_budget || 0).toLocaleString()} (เดิม)</span>
                            <span className="font-bold text-red-600">+ ฿{parseFloat(categoryAllocationForm.amount).toLocaleString()} (งวดนี้)</span>
                            <span className="text-slate-400">=</span>
                            <span className="font-black text-red-800 text-sm">
                              ฿{((allocatingCategory.allocated_budget || 0) + parseFloat(categoryAllocationForm.amount)).toLocaleString()}
                            </span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-600">คงเหลือสุทธิใหม่:</span>
                            <span className="font-bold text-emerald-700">
                              ฿{(((allocatingCategory.allocated_budget || 0) + parseFloat(categoryAllocationForm.amount)) - (allocatingCategory.total_spent || 0)).toLocaleString()}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-red-700 bg-white/80 px-2 py-0.5 rounded border border-red-200 self-start sm:self-auto">
                            รวมเป็นก้อนเดียวกัน
                          </span>
                        </motion.div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="submit"
                          disabled={allocationSubmitting}
                          className="flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold shadow-md shadow-red-100 transition-all disabled:opacity-50"
                        >
                          <Plus size={14} />
                          {allocationSubmitting ? 'กำลังบันทึก...' : `บันทึกเพิ่มวงเงินงวดที่ ${categoryAllocationForm.installment_no || ''}`}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Section 2: History of Category Installments */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <History size={16} className="text-slate-500" />
                      <h4 className="font-bold text-sm text-slate-800">
                        ประวัติรายการจัดสรรงบประมาณหมวดนี้ ({categoryAllocations.length} งวด)
                      </h4>
                    </div>
                    <span className="text-xs text-slate-400">
                      รวมวงเงินสะสมเป็นก้อนเดียวกันในหมวดนี้
                    </span>
                  </div>

                  {loadingCategoryAllocations ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      กำลังโหลดประวัติงวดจัดสรร...
                    </div>
                  ) : categoryAllocations.length === 0 ? (
                    <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-200 text-xs text-slate-500">
                      ยังไม่มีรายการจัดสรร (วงเงินตั้งต้น ฿{(allocatingCategory.allocated_budget || 0).toLocaleString()} บาท)
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                            <th className="px-4 py-3 text-center w-16">งวดที่</th>
                            <th className="px-4 py-3">ชื่องวด / รายการจัดสรร</th>
                            <th className="px-4 py-3">วันที่จัดสรร</th>
                            <th className="px-4 py-3">เลขที่หนังสือ / อ้างอิง</th>
                            <th className="px-4 py-3">ผู้บันทึกข้อมูล</th>
                            <th className="px-4 py-3 text-right">จำนวนเงิน (บาท)</th>
                            {isPlanningDept && <th className="px-3 py-3 text-center w-14">จัดการ</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {categoryAllocations.map((alloc) => {
                            const totalAllocSum = categoryAllocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
                            const pct = totalAllocSum > 0 ? ((Number(alloc.amount) / totalAllocSum) * 100).toFixed(1) : '0';

                            return (
                              <tr key={alloc.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px]">
                                    ครั้งที่ {alloc.installment_no}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-800">
                                  {alloc.title}
                                  {alloc.notes && (
                                    <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                                      {alloc.notes}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  {alloc.allocation_date || '-'}
                                </td>
                                <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                                  {alloc.doc_ref || '-'}
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-[11px]">
                                  {alloc.created_by || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="font-black text-slate-900 text-sm">
                                    ฿{Number(alloc.amount).toLocaleString()}
                                  </div>
                                  <span className="text-[10px] text-slate-400">
                                    {pct}% ของวงเงินรวม
                                  </span>
                                </td>
                                {isPlanningDept && (
                                  <td className="px-3 py-3 text-center">
                                    {categoryAllocations.length > 1 && (
                                      <button
                                        onClick={() => handleDeleteCategoryAllocation({
                                          id: alloc.id,
                                          title: alloc.title,
                                          amount: Number(alloc.amount) || 0,
                                          installment_no: alloc.installment_no || 1
                                        })}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                        title="ลบงวดจัดสรรนี้"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-red-50/60 font-black text-slate-900 border-t border-slate-200">
                            <td colSpan={5} className="px-4 py-3.5 text-right font-bold text-slate-700">
                              รวมวงเงินที่ได้รับจัดสรรทุกงวด (ก้อนเดียวกัน):
                            </td>
                            <td className="px-4 py-3.5 text-right text-base text-red-700">
                              ฿{categoryAllocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0).toLocaleString()}
                            </td>
                            {isPlanningDept && <td></td>}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  หมวด: <span className="font-bold text-slate-700">{allocatingCategory.name}</span> | วงเงินรวมสะสม: <span className="font-bold text-slate-900">฿{(allocatingCategory.allocated_budget || 0).toLocaleString()} บาท</span>
                </div>
                <button
                  onClick={() => setIsAllocationModalOpen(false)}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: รายละเอียดโครงการและรายการสินค้าในหมวด (Drill-Down Modal) */}
      <AnimatePresence>
        {isDetailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                    <Layers size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600">
                        {selectedDetail?.category.code || 'EXP'}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        ปีงบประมาณ {selectedDetail?.category.fiscal_year || '2568'}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {selectedDetail?.category.name || 'รายละเอียดหมวดค่าใช้จ่าย'}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {loadingDetail || !selectedDetail ? (
                <div className="p-16 text-center">
                  <RefreshCw className="animate-spin text-red-700 mx-auto mb-3" size={28} />
                  <p className="text-xs font-bold text-slate-500">กำลังดึงข้อมูลโครงการและรายการสินค้า...</p>
                </div>
              ) : (
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <span className="text-xs font-bold text-slate-500">งบประมาณที่ได้รับจัดสรร</span>
                      <div className="text-xl font-black text-slate-900 mt-1">
                        ฿{selectedDetail.category.allocated_budget.toLocaleString()}
                      </div>
                    </div>

                    <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80">
                      <span className="text-xs font-bold text-amber-800">หักลบ: เงินที่ใช้ซื้อสินค้า</span>
                      <div className="text-xl font-black text-amber-600 mt-1">
                        ฿{(selectedDetail.category.total_spent || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-amber-700 mt-0.5">
                        {selectedDetail.projects.length} โครงการ ({selectedDetail.items.length} รายการพัสดุ)
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80">
                      <span className="text-xs font-bold text-emerald-800">ยอดคงเหลือสุทธิ</span>
                      <div className={`text-xl font-black mt-1 ${
                        (selectedDetail.category.remaining_budget || 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}>
                        ฿{(selectedDetail.category.remaining_budget || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-emerald-700 mt-0.5">
                        สัดส่วนการใช้ {selectedDetail.category.used_percentage || 0}%
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs: Items vs Projects */}
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <button
                      onClick={() => setDetailTab('items')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        detailTab === 'items'
                          ? 'bg-red-700 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <ShoppingCart size={15} />
                      รายการสินค้า/พัสดุที่ซื้อ ({selectedDetail.items.length})
                    </button>

                    <button
                      onClick={() => setDetailTab('projects')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        detailTab === 'projects'
                          ? 'bg-red-700 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <FolderKanban size={15} />
                      โครงการที่ใช้เงินในหมวดนี้ ({selectedDetail.projects.length})
                    </button>
                  </div>

                  {/* Tab Content 1: Items Purchased */}
                  {detailTab === 'items' && (
                    <div className="space-y-3">
                      {selectedDetail.items.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl">
                          <Package size={36} className="mx-auto mb-2 text-slate-300" />
                          <p className="text-xs font-bold">ยังไม่มีรายการสินค้า/พัสดุที่จัดซื้อในหมวดนี้</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                                <th className="px-4 py-3 text-center w-12">ลำดับ</th>
                                <th className="px-4 py-3">รายการสินค้า / พัสดุ</th>
                                <th className="px-4 py-3">โครงการที่จัดซื้อ</th>
                                <th className="px-4 py-3">แผนก / งาน</th>
                                <th className="px-4 py-3 text-right">จำนวน</th>
                                <th className="px-4 py-3 text-right">ราคา/หน่วย</th>
                                <th className="px-4 py-3 text-right">ราคารวม</th>
                                <th className="px-4 py-3">ร้านค้า</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {selectedDetail.items.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3 text-center text-slate-400 font-mono">
                                    {idx + 1}
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-800">
                                    {item.description}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={item.project_title}>
                                    <span className="font-mono text-[10px] text-slate-400 mr-1">
                                      {item.project_code || `#${item.project_id}`}
                                    </span>
                                    {item.project_title}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {item.department || '-'}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                                    {item.quantity} {item.unit || ''}
                                  </td>
                                  <td className="px-4 py-3 text-right text-slate-600">
                                    ฿{(item.unit_price || 0).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-right font-black text-amber-600">
                                    ฿{(item.total_price || 0).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500">
                                    {item.shop_name || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-slate-50 font-black text-xs border-t-2 border-slate-200">
                                <td colSpan={6} className="px-4 py-3 text-right text-slate-700">
                                  ยอดรวมเงินที่ใช้ซื้อสินค้าทั้งสิ้น:
                                </td>
                                <td className="px-4 py-3 text-right text-amber-600">
                                  ฿{(selectedDetail.category.total_spent || 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3"></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab Content 2: Projects */}
                  {detailTab === 'projects' && (
                    <div className="space-y-3">
                      {selectedDetail.projects.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl">
                          <FolderKanban size={36} className="mx-auto mb-2 text-slate-300" />
                          <p className="text-xs font-bold">ยังไม่มีโครงการที่ใช้เงินในหมวดนี้</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                                <th className="px-4 py-3">รหัสโครงการ</th>
                                <th className="px-4 py-3">ชื่อโครงการ</th>
                                <th className="px-4 py-3">แผนก / หน่วยงาน</th>
                                <th className="px-4 py-3 text-right">วงเงินงบประมาณ</th>
                                <th className="px-4 py-3 text-right">เงินที่ใช้ซื้อสินค้า</th>
                                <th className="px-4 py-3 text-center">ขั้นตอน</th>
                                <th className="px-4 py-3 text-center">การดำเนินการ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {selectedDetail.projects.map((proj) => (
                                <tr key={proj.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-4 py-3 font-mono font-bold text-slate-600">
                                    {proj.project_code || `#${proj.id}`}
                                  </td>
                                  <td className="px-4 py-3 font-bold text-slate-800">
                                    {proj.title}
                                  </td>
                                  <td className="px-4 py-3 text-slate-600">
                                    {proj.department || '-'}
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                                    ฿{(proj.budget_amount || 0).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-right font-black text-amber-600">
                                    ฿{(proj.spent_amount || 0).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-bold text-[10px]">
                                      {proj.current_process}{proj.current_step}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {onSelectProject && (
                                      <button
                                        onClick={() => {
                                          setIsDetailModalOpen(false);
                                          onSelectProject(proj);
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold text-[11px] transition-colors"
                                      >
                                        ดูรายละเอียด <ArrowRight size={12} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: เพิ่ม / แก้ไขหมวดค่าใช้จ่าย (Add / Edit Category Form) */}
      <AnimatePresence>
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      {editingCategory ? 'แก้ไขหมวดค่าใช้จ่าย' : 'เพิ่มหมวดค่าใช้จ่ายใหม่'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      กำหนดชื่อหมวดและกรอบวงเงินที่ได้รับจัดสรร
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsFormModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveCategoryForm} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    ชื่อหมวดค่าใช้จ่าย <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น งบ.ปวช., ค่าจัดการเรียนการสอน..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      รหัสหมวด
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 68-EXP-01"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-red-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      ปีงบประมาณ
                    </label>
                    <select
                      value={formData.fiscal_year}
                      onChange={(e) => setFormData({ ...formData, fiscal_year: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none cursor-pointer"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    งบประมาณที่ได้รับจัดสรร (บาท)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="เช่น 1500000"
                    value={formData.allocated_budget}
                    onChange={(e) => setFormData({ ...formData, allocated_budget: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    คำอธิบาย / รายละเอียดหมวด
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ระบุวัตถุประสงค์การใช้งานและประเภทวัสดุที่จัดซื้อในหมวดนี้..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold shadow-md shadow-red-100 transition-all disabled:opacity-50"
                  >
                    {formSubmitting ? 'กำลังบันทึก...' : editingCategory ? 'บันทึกการแก้ไข' : 'เพิ่มหมวดค่าใช้จ่าย'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal: ยืนยันการลบหมวดค่าใช้จ่าย (In-App Confirm Modal) */}
        {categoryToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
                ยืนยันการลบหมวดค่าใช้จ่าย?
              </h3>
              <p className="text-xs text-slate-500 text-center mb-4">
                คุณกำลังจะลบหมวดค่าใช้จ่ายออกจากระบบ การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-4 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">ชื่อหมวดค่าใช้จ่าย:</span>
                  <span className="font-black text-slate-800 text-sm">{categoryToDelete.name}</span>
                </div>
                {categoryToDelete.code && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">รหัสหมวด:</span>
                    <span className="font-bold text-slate-700 font-mono">{categoryToDelete.code}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">ปีงบประมาณ:</span>
                  <span className="font-bold text-slate-700">พ.ศ. {categoryToDelete.fiscal_year || '2568'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">วงเงินจัดสรร:</span>
                  <span className="font-black text-red-600">฿{Number(categoryToDelete.allocated_budget || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-400">ใช้ไปแล้ว:</span>
                  <span className="font-bold text-slate-700">
                    ฿{Number(categoryToDelete.used_amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {(categoryToDelete.used_amount || 0) > 0 || deleteCategoryError ? (
                <div className="space-y-3 mb-4">
                  {deleteCategoryError ? (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-2xl text-xs flex items-start gap-2.5">
                      <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                      <div>{deleteCategoryError}</div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-2xl text-xs flex items-start gap-2.5">
                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">หมวดนี้มียอดเบิกจ่ายแล้ว:</span> ฿{Number(categoryToDelete.used_amount || 0).toLocaleString()} หากมีโครงการกำลังผูกกับหมวดนี้ ระบบจะป้องกันไม่ให้เกิดข้อมูลค้าง
                      </div>
                    </div>
                  )}

                  <label className="flex items-start gap-2.5 p-3 bg-rose-50/80 border border-rose-200 rounded-2xl cursor-pointer text-xs text-slate-800 select-none hover:bg-rose-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={forceDeleteCategory}
                      onChange={(e) => setForceDeleteCategory(e.target.checked)}
                      className="mt-0.5 rounded text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="leading-relaxed">
                      <strong className="block text-rose-800 font-bold mb-0.5">ยืนยันปลดการเชื่อมโยงและลบ</strong>
                      ฉันต้องการปรับหมวดค่าใช้จ่ายของโครงการที่เกี่ยวข้องทั้งหมดเป็น 'ทั่วไป' และยืนยันลบหมวดนี้ออกจากระบบทันที
                    </span>
                  </label>
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeletingCategory}
                  onClick={() => {
                    setCategoryToDelete(null);
                    setDeleteCategoryError(null);
                    setForceDeleteCategory(false);
                  }}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeletingCategory || (Boolean(deleteCategoryError) && !forceDeleteCategory)}
                  onClick={confirmDeleteCategory}
                  className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeletingCategory ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังลบ...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      {forceDeleteCategory ? 'ปลดโครงการและยืนยันลบ' : 'ยืนยันลบหมวดนี้'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal: ยืนยันการลบงวดจัดสรรหมวด (In-App Confirm Modal) */}
        {catAllocToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
                ยืนยันการลบงวดจัดสรรหมวดค่าใช้จ่าย?
              </h3>
              <p className="text-xs text-slate-500 text-center mb-4">
                ระบบจะคำนวณหักลบยอดรวมจัดสรรของหมวดนี้ออกโดยอัตโนมัติ
              </p>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-5 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">งวดที่:</span>
                  <span className="font-bold text-slate-700">ครั้งที่ {catAllocToDelete.installment_no}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">รายการจัดสรร:</span>
                  <span className="font-bold text-slate-800">{catAllocToDelete.title}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">วงเงินที่หักออก:</span>
                  <span className="font-black text-rose-600 text-sm">฿{catAllocToDelete.amount.toLocaleString()} บาท</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeletingCatAlloc}
                  onClick={() => setCatAllocToDelete(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeletingCatAlloc}
                  onClick={confirmDeleteCategoryAllocation}
                  className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeletingCatAlloc ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังลบ...
                    </>
                  ) : (
                    'ยืนยันลบงวดนี้'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
