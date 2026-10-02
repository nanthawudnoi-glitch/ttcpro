import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Landmark,
  Wallet,
  TrendingUp,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Download,
  Printer,
  RefreshCw,
  AlertCircle,
  Building,
  ArrowUpRight,
  PieChart,
  Layers,
  X,
  CheckCircle2,
  Building2,
  FileSpreadsheet,
  Coins,
  Calendar,
  ShieldCheck,
  History,
  PlusCircle,
  ArrowRight
} from 'lucide-react';
import { BudgetSource, DepartmentBudgetSummary, Project, FiscalYear, BudgetAllocation } from '../types';
import { ExpenseCategoriesManager } from './ExpenseCategoriesManager';
import { FiscalYearManager } from './FiscalYearManager';
import { safeParseJson } from '../utils';

interface BudgetDatabaseViewProps {
  currentUser: any;
  userRole: string;
  onSelectProject?: (project: Project) => void;
  expenseCategories: { id: number; name: string }[];
  onRefreshExpenseCategories?: () => void;
}

const DEFAULT_INITIAL_SOURCES: BudgetSource[] = [
  { id: 1, name: 'งบประมาณแผ่นดิน', code: '68-GOV-01', fiscal_year: '2568', total_budget: 5000000, allocations_count: 1, description: 'งบประมาณแผ่นดินประจำปีงบประมาณ พ.ศ. 2568' },
  { id: 2, name: 'เงินรายได้สถานศึกษา', code: '68-REV-01', fiscal_year: '2568', total_budget: 3500000, allocations_count: 1, description: 'เงินรายได้สถานศึกษา ประจำปีงบประมาณ พ.ศ. 2568' },
  { id: 3, name: 'งบอุดหนุน', code: '68-SUB-01', fiscal_year: '2568', total_budget: 1500000, allocations_count: 1, description: 'เงินอุดหนุนค่าใช้จ่ายในการจัดการศึกษา' }
];

export const BudgetDatabaseView: React.FC<BudgetDatabaseViewProps> = ({
  currentUser,
  userRole,
  onSelectProject,
  expenseCategories,
  onRefreshExpenseCategories
}) => {
  const [sources, setSources] = useState<BudgetSource[]>([]);
  const [departments, setDepartments] = useState<DepartmentBudgetSummary[]>([]);
  const [fiscalYearList, setFiscalYearList] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sources' | 'departments' | 'categories' | 'fiscal_years'>('sources');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal State for Add/Edit Budget Source
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<BudgetSource | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    fiscal_year: '2568',
    total_budget: '',
    category: '',
    description: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Projects Modal
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [selectedSourceForProjects, setSelectedSourceForProjects] = useState<BudgetSource | null>(null);
  const [sourceProjects, setSourceProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Department Projects Modal
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [selectedDeptName, setSelectedDeptName] = useState<string | null>(null);
  const [deptProjects, setDeptProjects] = useState<Project[]>([]);
  const [loadingDeptProjects, setLoadingDeptProjects] = useState(false);

  // Budget Source Multi-Installment Allocations Modal (งานยุทธศาสตร์เพิ่มวงเงินได้หลายครั้ง)
  const [showAllocationsModal, setShowAllocationsModal] = useState(false);
  const [allocatingSource, setAllocatingSource] = useState<BudgetSource | null>(null);
  const [sourceAllocations, setSourceAllocations] = useState<BudgetAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [allocationForm, setAllocationForm] = useState({
    installment_no: '1',
    title: '',
    amount: '',
    allocation_date: new Date().toISOString().split('T')[0],
    doc_ref: '',
    notes: ''
  });
  const [allocationSubmitting, setAllocationSubmitting] = useState(false);
  const [allocationFormError, setAllocationFormError] = useState<string | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Source In-App Modal
  const [sourceToDelete, setSourceToDelete] = useState<BudgetSource | null>(null);
  const [isDeletingSource, setIsDeletingSource] = useState(false);
  const [deleteSourceError, setDeleteSourceError] = useState<string | null>(null);

  // Delete Allocation In-App Modal
  const [allocationToDelete, setAllocationToDelete] = useState<{ id: number; title: string; amount: number; installment_no: number } | null>(null);
  const [isDeletingAllocation, setIsDeletingAllocation] = useState(false);

  const canManage = ['ADMIN', 'PLANNING_HEAD', 'PLANNING_STAFF', 'DEPUTY_DIRECTOR_PLANNING'].includes(userRole);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const openAllocationsModal = async (source: BudgetSource) => {
    setAllocatingSource(source);
    setShowAllocationsModal(true);
    setLoadingAllocations(true);
    setAllocationFormError(null);
    try {
      const res = await fetch(`/api/budget-sources/${source.id}/allocations`);
      if (res.ok) {
        const data = await safeParseJson<BudgetAllocation[]>(res);
        if (data) {
          setSourceAllocations(data);
          const nextNo = (data.length > 0 ? Math.max(...data.map(d => d.installment_no || 0)) : 0) + 1;
          setAllocationForm({
            installment_no: String(nextNo),
            title: `${source.name} จัดสรรครั้งที่ ${nextNo}`,
            amount: '',
            allocation_date: new Date().toISOString().split('T')[0],
            doc_ref: '',
            notes: ''
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch budget allocations:', err);
    } finally {
      setLoadingAllocations(false);
    }
  };

  const handleSaveSourceAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingSource) return;
    const amountVal = parseFloat(allocationForm.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setAllocationFormError('กรุณากรอกจำนวนเงินที่ได้รับจัดสรรมากกว่า 0 บาท');
      return;
    }

    setAllocationSubmitting(true);
    setAllocationFormError(null);
    try {
      const creator = currentUser?.name 
        ? `${currentUser.name} (${currentUser.position || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ'})` 
        : 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ';

      const res = await fetch(`/api/budget-sources/${allocatingSource.id}/allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installment_no: allocationForm.installment_no ? Number(allocationForm.installment_no) : undefined,
          title: allocationForm.title.trim() || `${allocatingSource.name} จัดสรรครั้งที่ ${allocationForm.installment_no}`,
          amount: amountVal,
          allocation_date: allocationForm.allocation_date,
          doc_ref: allocationForm.doc_ref.trim(),
          notes: allocationForm.notes.trim(),
          created_by: creator
        })
      });

      if (res.ok) {
        const result = await safeParseJson<any>(res);
        showToast(result?.message || 'บันทึกงวดจัดสรรงบประมาณเรียบร้อยแล้ว');
        // Refresh allocations
        const allocRes = await fetch(`/api/budget-sources/${allocatingSource.id}/allocations`);
        if (allocRes.ok) {
          const data = await safeParseJson<BudgetAllocation[]>(allocRes);
          if (data) {
            setSourceAllocations(data);
            const nextNo = (data.length > 0 ? Math.max(...data.map(d => d.installment_no || 0)) : 0) + 1;
            setAllocationForm({
              installment_no: String(nextNo),
              title: `${allocatingSource.name} จัดสรรครั้งที่ ${nextNo}`,
              amount: '',
              allocation_date: new Date().toISOString().split('T')[0],
              doc_ref: '',
              notes: ''
            });
          }
        }
        fetchBudgetSources();
      } else {
        const errData = await safeParseJson<any>(res);
        setAllocationFormError(errData?.error || 'ไม่สามารถบันทึกงวดจัดสรรได้');
      }
    } catch (err) {
      console.error('Error saving allocation:', err);
      setAllocationFormError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setAllocationSubmitting(false);
    }
  };

  const handleDeleteSourceAllocation = (alloc: { id: number; title: string; amount: number; installment_no: number }) => {
    setAllocationToDelete(alloc);
  };

  const confirmDeleteSourceAllocation = async () => {
    if (!allocatingSource || !allocationToDelete) return;
    setIsDeletingAllocation(true);
    try {
      const res = await fetch(`/api/budget-sources/${allocatingSource.id}/allocations/${allocationToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`ลบงวดจัดสรร "${allocationToDelete.title}" เรียบร้อยแล้ว`);
        setAllocationToDelete(null);
        const allocRes = await fetch(`/api/budget-sources/${allocatingSource.id}/allocations`);
        if (allocRes.ok) {
          const data = await safeParseJson<BudgetAllocation[]>(allocRes);
          if (data) setSourceAllocations(data);
        }
        fetchBudgetSources();
        if (onRefresh) onRefresh();
      } else {
        const errData = await safeParseJson<any>(res);
        showToast(errData?.error || 'ไม่สามารถลบงวดจัดสรรได้');
      }
    } catch (err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการลบงวดจัดสรร');
    } finally {
      setIsDeletingAllocation(false);
    }
  };

  const fetchBudgetSources = async () => {
    setLoading(true);
    try {
      const url = selectedYear === 'all' 
        ? '/api/budget-sources' 
        : `/api/budget-sources?fiscal_year=${selectedYear}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await safeParseJson<BudgetSource[]>(res);
        if (data && Array.isArray(data) && data.length > 0) {
          setSources(data);
          try {
            localStorage.setItem('ttc_smartprocure_budget_sources', JSON.stringify(data));
          } catch (e) {}
          return;
        }
      }
    } catch (err) {
      console.warn('fetchBudgetSources API unavailable, falling back to local storage:', err);
    } finally {
      setLoading(false);
    }

    // Fallback for Vercel static deployment or offline
    try {
      const saved = localStorage.getItem('ttc_smartprocure_budget_sources');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = selectedYear === 'all' 
            ? parsed 
            : parsed.filter((s: any) => !s.fiscal_year || s.fiscal_year === selectedYear);
          setSources(filtered);
          return;
        }
      }
    } catch (e) {}
    setSources(selectedYear === 'all' ? DEFAULT_INITIAL_SOURCES : DEFAULT_INITIAL_SOURCES.filter(s => s.fiscal_year === selectedYear));
  };

  const fetchDepartmentsSummary = async () => {
    try {
      const res = await fetch('/api/budget-departments-summary');
      if (res.ok) {
        const data = await safeParseJson<DepartmentBudgetSummary[]>(res);
        if (data) setDepartments(data);
      }
    } catch (err) {
      console.error('Failed to fetch departments summary:', err);
    }
  };

  const fetchFiscalYearsList = async () => {
    try {
      const res = await fetch('/api/fiscal-years');
      if (res.ok) {
        const data = await safeParseJson<FiscalYear[]>(res);
        if (data) setFiscalYearList(data);
      }
    } catch (err) {
      console.error('Failed to fetch fiscal years list:', err);
    }
  };

  useEffect(() => {
    fetchBudgetSources();
    fetchDepartmentsSummary();
    fetchFiscalYearsList();
  }, [selectedYear]);

  // Available Fiscal Years derived from fiscalYearList and sources
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    fiscalYearList.forEach(fy => years.add(fy.year));
    sources.forEach(s => {
      if (s.fiscal_year) years.add(s.fiscal_year);
    });
    if (years.size === 0) {
      years.add('2568');
      years.add('2567');
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [fiscalYearList, sources]);

  // Available Categories derived from sources
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    sources.forEach(s => {
      if (s.category) cats.add(s.category);
    });
    return Array.from(cats);
  }, [sources]);

  // Overall Financial Calculations
  const metrics = useMemo(() => {
    const totalAllocated = sources.reduce((acc, s) => acc + (s.total_budget || 0), 0);
    const totalCommitted = sources.reduce((acc, s) => acc + (s.committed_amount || 0), 0);
    const totalDisbursed = sources.reduce((acc, s) => acc + (s.disbursed_amount || 0), 0);
    const totalUsed = totalCommitted + totalDisbursed;
    const remaining = totalAllocated - totalUsed;
    const usedPercentage = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;
    const totalProjects = sources.reduce((acc, s) => acc + (s.project_count || 0), 0);

    return {
      totalAllocated,
      totalCommitted,
      totalDisbursed,
      totalUsed,
      remaining,
      usedPercentage: Math.min(100, Math.round(usedPercentage * 10) / 10),
      totalProjects
    };
  }, [sources]);

  // Filtered Sources
  const filteredSources = useMemo(() => {
    return sources.filter(s => {
      const matchesSearch = 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    });
  }, [sources, searchQuery]);

  const openAddModal = () => {
    const curYear = fiscalYearList.find(f => Boolean(f.is_current))?.year || '2568';
    const targetYear = selectedYear !== 'all' ? selectedYear : curYear;
    const yearShort = targetYear.slice(-2);
    setEditingSource(null);
    setFormData({
      name: '',
      code: `${yearShort}-BG-${String(sources.length + 1).padStart(2, '0')}`,
      fiscal_year: targetYear,
      total_budget: '',
      category: '',
      description: ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (source: BudgetSource) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      code: source.code || '',
      fiscal_year: source.fiscal_year || '2568',
      total_budget: source.total_budget ? String(source.total_budget) : '0',
      category: '',
      description: source.description || ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const safeJson = async (r: Response) => {
    return await safeParseJson(r);
  };

  const handleSaveBudgetSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('กรุณากรอกชื่อแหล่งงบประมาณ');
      return;
    }

    const budgetVal = parseFloat(formData.total_budget);
    if (isNaN(budgetVal) || budgetVal < 0) {
      setFormError('กรุณากรอกจำนวนวงเงินงบประมาณที่ถูกต้อง');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const url = editingSource 
        ? `/api/budget-sources/${editingSource.id}` 
        : '/api/budget-sources';
      const method = editingSource ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim(),
          fiscal_year: formData.fiscal_year,
          total_budget: budgetVal,
          description: formData.description.trim()
        })
      });

      const result = await safeJson(res);
      if (!res.ok) {
        if (res.status === 404 || !res.status) {
          saveBudgetSourceLocally(budgetVal);
          return;
        }
        setFormError(result?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      } else {
        setIsModalOpen(false);
        showToast(result?.message || (editingSource ? 'แก้ไขแหล่งงบประมาณเรียบร้อยแล้ว' : 'เพิ่มแหล่งงบประมาณใหม่เรียบร้อยแล้ว'));
        fetchBudgetSources();
      }
    } catch (err: any) {
      saveBudgetSourceLocally(budgetVal);
    } finally {
      setFormSubmitting(false);
    }
  };

  const saveBudgetSourceLocally = (budgetVal: number) => {
    let currentLocal: BudgetSource[] = [];
    try {
      const saved = localStorage.getItem('ttc_smartprocure_budget_sources');
      currentLocal = saved ? JSON.parse(saved) : DEFAULT_INITIAL_SOURCES;
    } catch (e) {
      currentLocal = DEFAULT_INITIAL_SOURCES;
    }

    if (editingSource) {
      currentLocal = currentLocal.map(s => s.id === editingSource.id ? {
        ...s,
        name: formData.name.trim(),
        code: formData.code.trim(),
        fiscal_year: formData.fiscal_year,
        total_budget: budgetVal,
        description: formData.description.trim()
      } : s);
    } else {
      const newSource: BudgetSource = {
        id: Date.now(),
        name: formData.name.trim(),
        code: formData.code.trim() || `${formData.fiscal_year.slice(-2)}-BG-${String(currentLocal.length + 1).padStart(2, '0')}`,
        fiscal_year: formData.fiscal_year,
        total_budget: budgetVal,
        allocations_count: 1,
        description: formData.description.trim()
      };
      currentLocal = [newSource, ...currentLocal];
    }
    try {
      localStorage.setItem('ttc_smartprocure_budget_sources', JSON.stringify(currentLocal));
    } catch (e) {}
    setIsModalOpen(false);
    showToast(editingSource ? 'แก้ไขแหล่งงบประมาณเรียบร้อยแล้ว' : 'เพิ่มแหล่งงบประมาณใหม่เรียบร้อยแล้ว');
    fetchBudgetSources();
  };

  const handleDeleteBudgetSource = (source: BudgetSource) => {
    setDeleteSourceError(null);
    setSourceToDelete(source);
  };

  const confirmDeleteBudgetSource = async () => {
    if (!sourceToDelete) return;
    setIsDeletingSource(true);
    setDeleteSourceError(null);

    try {
      const res = await fetch(`/api/budget-sources/${sourceToDelete.id}`, {
        method: 'DELETE'
      });
      const data = await safeJson(res);

      if (!res.ok) {
        if (res.status === 404 || !res.status) {
          deleteBudgetSourceLocally(sourceToDelete.id, sourceToDelete.name);
          setSourceToDelete(null);
          return;
        }
        setDeleteSourceError(data?.error || 'ไม่สามารถลบแหล่งงบประมาณได้');
      } else {
        deleteBudgetSourceLocally(sourceToDelete.id, sourceToDelete.name);
        setSourceToDelete(null);
        showToast(`ลบแหล่งงบประมาณ "${sourceToDelete.name}" สำเร็จ`);
        fetchBudgetSources();
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      deleteBudgetSourceLocally(sourceToDelete.id, sourceToDelete.name);
      setSourceToDelete(null);
    } finally {
      setIsDeletingSource(false);
    }
  };

  const deleteBudgetSourceLocally = (id: number, name: string) => {
    try {
      const saved = localStorage.getItem('ttc_smartprocure_budget_sources');
      const currentLocal: BudgetSource[] = saved ? JSON.parse(saved) : DEFAULT_INITIAL_SOURCES;
      const filtered = currentLocal.filter(s => s.id !== id);
      localStorage.setItem('ttc_smartprocure_budget_sources', JSON.stringify(filtered));
    } catch (e) {}
    showToast(`ลบแหล่งงบประมาณ "${name}" สำเร็จ`);
    fetchBudgetSources();
  };

  const handleViewProjects = async (source: BudgetSource) => {
    setSelectedSourceForProjects(source);
    setShowProjectsModal(true);
    setLoadingProjects(true);
    try {
      const res = await fetch(`/api/budget-sources/${source.id}/projects`);
      if (res.ok) {
        const data = await safeParseJson<{ projects?: Project[] }>(res);
        setSourceProjects(data?.projects || []);
      }
    } catch (err) {
      console.error('Failed to load projects for budget source:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleViewDeptProjects = async (deptName: string) => {
    setSelectedDeptName(deptName);
    setShowDeptModal(true);
    setLoadingDeptProjects(true);
    try {
      const res = await fetch(`/api/stats/department/${encodeURIComponent(deptName)}`);
      if (res.ok) {
        const data = await safeParseJson<Project[]>(res);
        setDeptProjects(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch dept projects:', err);
    } finally {
      setLoadingDeptProjects(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'รหัสงบ',
      'ชื่อแหล่งงบประมาณ',
      'ปีงบประมาณ',
      'หมวด/ประเภท',
      'วงเงินจัดสรร (บาท)',
      'ผูกพัน/ขอใช้ (บาท)',
      'เบิกจ่ายแล้ว (บาท)',
      'รวมใช้จ่าย (บาท)',
      'คงเหลือ (บาท)',
      'อัตราการใช้จ่าย (%)',
      'จำนวนโครงการ'
    ];

    const rows = filteredSources.map(s => [
      `"${s.code || ''}"`,
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.fiscal_year || '2568'}"`,
      `"${s.category || ''}"`,
      s.total_budget || 0,
      s.committed_amount || 0,
      s.disbursed_amount || 0,
      s.total_used || 0,
      s.remaining_budget || 0,
      `${s.used_percentage || 0}%`,
      s.project_count || 0
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `รายงานฐานข้อมูลงบประมาณ_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700"
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-red-50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none opacity-60" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-700 text-white rounded-2xl flex items-center justify-center shadow-md shadow-red-100">
                <Landmark size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-800 tracking-tight">ฐานข้อมูลงบประมาณ</h1>
                  <span className="px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                    งานวางแผนและงบประมาณ
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  บริหารจัดการแหล่งเงิน กรอบวงเงินที่ได้รับจัดสรร และติดตามสถานะการผูกพันเบิกจ่ายแบบเรียลไทม์
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              id="refresh-budget-btn"
              onClick={() => {
                fetchBudgetSources();
                fetchDepartmentsSummary();
                showToast('รีเฟรชข้อมูลเรียบร้อย');
              }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              id="export-budget-csv-btn"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors border border-slate-200"
            >
              <FileSpreadsheet size={16} className="text-emerald-600" />
              ส่งออก Excel / CSV
            </button>

            <button
              id="print-budget-btn"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors border border-slate-200"
            >
              <Printer size={16} />
              พิมพ์รายงานสรุป
            </button>

            {canManage && (
              <button
                id="add-budget-source-btn"
                onClick={openAddModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-100 transition-all hover:shadow-none"
              >
                <Plus size={16} />
                เพิ่มแหล่งงบประมาณใหม่
              </button>
            )}
          </div>
        </div>

        {/* Global Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">วงเงินจัดสรรทั้งหมด</span>
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Coins size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">
              ฿{metrics.totalAllocated.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              จาก {sources.length} แหล่งงบประมาณ
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">ยอดผูกพัน / กำลังดำเนินการ</span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-600 tracking-tight">
              ฿{metrics.totalCommitted.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              โครงการอยู่ระหว่างกระบวนการ A-D
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">ยอดเบิกจ่ายแล้วเสร็จ</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight">
              ฿{metrics.totalDisbursed.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              โครงการที่สิ้นสุดและเบิกจ่ายเรียบร้อย
            </div>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/70">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold">คงเหลือที่จัดสรรได้</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Wallet size={16} />
              </div>
            </div>
            <div className={`text-2xl font-black tracking-tight ${metrics.remaining >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
              ฿{metrics.remaining.toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    metrics.usedPercentage > 90 ? 'bg-rose-500' : metrics.usedPercentage > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, metrics.usedPercentage)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-slate-500">{metrics.usedPercentage}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto max-w-full">
          <button
            id="tab-sources-btn"
            onClick={() => setActiveTab('sources')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'sources'
                ? 'bg-red-700 text-white shadow-md shadow-red-100'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Landmark size={16} />
            แหล่งงบประมาณ ({sources.length})
          </button>

          <button
            id="tab-departments-btn"
            onClick={() => setActiveTab('departments')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'departments'
                ? 'bg-red-700 text-white shadow-md shadow-red-100'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building2 size={16} />
            การใช้งบแยกตามแผนก/งาน ({departments.length})
          </button>

          <button
            id="tab-categories-btn"
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
              activeTab === 'categories'
                ? 'bg-red-700 text-white shadow-md shadow-red-100'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers size={16} />
            หมวดค่าใช้จ่าย ({expenseCategories.length})
          </button>

          {canManage && (
            <button
              id="tab-fiscal-years-btn"
              onClick={() => setActiveTab('fiscal_years')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
                activeTab === 'fiscal_years'
                  ? 'bg-red-700 text-white shadow-md shadow-red-100'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Calendar size={16} />
              กำหนดปีงบประมาณ ({fiscalYearList.length})
            </button>
          )}
        </div>

        {/* Filter Controls for Tab Sources */}
        {activeTab === 'sources' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                id="search-budget-input"
                type="text"
                placeholder="ค้นหาชื่อ, รหัสงบ, รายละเอียด..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none w-56 shadow-sm"
              />
            </div>

            {/* Fiscal Year Selector */}
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs">
              <span className="text-slate-400 font-semibold">ปีงบ:</span>
              <select
                id="select-fiscal-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">ทั้งหมด</option>
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>พ.ศ. {yr}</option>
                ))}
              </select>
            </div>

          </div>
        )}
      </div>

      {/* Tab 1: แหล่งงบประมาณและกรอบวงเงิน (Budget Sources) */}
      {activeTab === 'sources' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-slate-800">รายการแหล่งงบประมาณและกรอบวงเงิน</h3>
              <p className="text-xs text-slate-400">
                แสดงยอดจัดสรร ยอดผูกพัน ยอดเบิกจ่ายจริง และยอดคงเหลือสุทธิ
              </p>
            </div>
            <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              พบ {filteredSources.length} แหล่งงบประมาณ
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4">รหัส / แหล่งงบประมาณ</th>
                  <th className="px-4 py-4 text-center">ปีงบประมาณ</th>
                  <th className="px-4 py-4 text-center">งวดจัดสรร (รัฐบาล)</th>
                  <th className="px-4 py-4 text-right">วงเงินจัดสรร</th>
                  <th className="px-4 py-4 text-right">ยอดผูกพัน</th>
                  <th className="px-4 py-4 text-right">เบิกจ่ายแล้ว</th>
                  <th className="px-4 py-4 text-right">คงเหลือสุทธิ</th>
                  <th className="px-6 py-4 text-center">การใช้จ่าย (%)</th>
                  <th className="px-4 py-4 text-center">โครงการ</th>
                  <th className="px-6 py-4 text-center print:hidden">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSources.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 text-sm">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Landmark size={32} className="text-slate-300 stroke-[1.5]" />
                        <span>ไม่พบข้อมูลแหล่งงบประมาณตามเงื่อนไขที่เลือก</span>
                        {canManage && (
                          <button
                            onClick={openAddModal}
                            className="mt-2 text-xs font-bold text-red-700 hover:underline"
                          >
                            + เพิ่มแหล่งงบประมาณใหม่
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSources.map((source) => {
                    const remaining = source.remaining_budget ?? 0;
                    const usedPct = source.used_percentage ?? 0;

                    return (
                      <tr key={source.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Name & Code */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {source.code && (
                              <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                                {source.code}
                              </span>
                            )}
                            <span className="font-bold text-slate-800 text-sm">{source.name}</span>
                          </div>
                          {source.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {source.description}
                            </p>
                          )}
                        </td>

                        {/* Fiscal Year */}
                        <td className="px-4 py-4 text-center">
                          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-lg">
                            {source.fiscal_year || '2568'}
                          </span>
                        </td>

                        {/* Allocation Installments Button */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => openAllocationsModal(source)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition-colors border border-amber-200 shadow-sm"
                            title="คลิกเพื่อดูและเพิ่มงวดจัดสรรงบประมาณ (เพิ่มได้หลายครั้งตามที่รัฐบาลจัดสรรมา)"
                          >
                            <Coins size={13} className="text-amber-600" />
                            จัดสรร {source.allocations_count || 1} ครั้ง
                            {canManage && <Plus size={11} className="text-amber-700 ml-0.5" />}
                          </button>
                        </td>

                        {/* Allocated Budget */}
                        <td className="px-4 py-4 text-right">
                          <div className="font-bold text-slate-800 text-sm">
                            ฿{(source.total_budget || 0).toLocaleString()}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-1">
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              จัดสรร {source.allocations_count || 1} ครั้ง
                            </span>
                            {canManage && (
                              <button
                                onClick={() => openAllocationsModal(source)}
                                className="text-[10px] font-bold text-red-700 hover:text-red-900 hover:underline flex items-center gap-0.5"
                                title="เพิ่ม/ดูงวดจัดสรรงบประมาณ"
                              >
                                <Plus size={10} />
                                เพิ่มงวด
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Committed */}
                        <td className="px-4 py-4 text-right font-medium text-amber-600 text-sm">
                          ฿{(source.committed_amount || 0).toLocaleString()}
                        </td>

                        {/* Disbursed */}
                        <td className="px-4 py-4 text-right font-medium text-emerald-600 text-sm">
                          ฿{(source.disbursed_amount || 0).toLocaleString()}
                        </td>

                        {/* Remaining */}
                        <td className={`px-4 py-4 text-right font-bold text-sm ${remaining >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                          ฿{remaining.toLocaleString()}
                        </td>

                        {/* Usage Progress Bar */}
                        <td className="px-6 py-4 text-center">
                          <div className="w-28 mx-auto space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                              <span>{usedPct}%</span>
                              <span>{usedPct >= 100 ? 'เต็มวงเงิน' : 'ปกติ'}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  usedPct > 90 ? 'bg-rose-500' : usedPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, usedPct)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Project Count */}
                        <td className="px-4 py-4 text-center">
                          <button
                            onClick={() => handleViewProjects(source)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                          >
                            <span>{source.project_count || 0}</span>
                            <Eye size={12} />
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-center print:hidden">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleViewProjects(source)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="ดูโครงการที่ใช้งบนี้"
                            >
                              <Eye size={15} />
                            </button>

                            {canManage && (
                              <>
                                <button
                                  onClick={() => openAllocationsModal(source)}
                                  className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                  title="จัดการงวดจัดสรรงบประมาณ (เพิ่มวงเงินได้หลายครั้ง)"
                                >
                                  <Coins size={15} />
                                </button>
                                <button
                                  onClick={() => openEditModal(source)}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="แก้ไขกรอบวงเงิน/รายละเอียด"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteBudgetSource(source)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="ลบแหล่งงบประมาณ"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {filteredSources.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 font-bold text-slate-800 text-xs border-t-2 border-slate-200">
                    <td colSpan={3} className="px-6 py-4 text-slate-700">
                      รวมทั้งสิ้น ({filteredSources.length} แหล่งงบประมาณ)
                    </td>
                    <td className="px-4 py-4 text-right">
                      ฿{filteredSources.reduce((a, b) => a + (b.total_budget || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right text-amber-600">
                      ฿{filteredSources.reduce((a, b) => a + (b.committed_amount || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right text-emerald-600">
                      ฿{filteredSources.reduce((a, b) => a + (b.disbursed_amount || 0), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right text-indigo-700">
                      ฿{filteredSources.reduce((a, b) => a + (b.remaining_budget || 0), 0).toLocaleString()}
                    </td>
                    <td colSpan={3} className="px-6 py-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: การใช้จ่ายแยกตามแผนก/งาน (Departmental Breakdown) */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base text-slate-800">สรุปการใช้งบประมาณรายแผนกวิชา / งาน</h3>
                <p className="text-xs text-slate-400">
                  ติดตามความต้องการใช้งบประมาณและการเบิกจ่ายจริงของแต่ละหน่วยงานในวิทยาลัยเทคนิคตรัง
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-4">แผนกวิชา / งาน</th>
                    <th className="px-4 py-4 text-center">จำนวนโครงการ</th>
                    <th className="px-4 py-4 text-right">ยอดของบประมาณรวม</th>
                    <th className="px-4 py-4 text-right">กำลังดำเนินการ</th>
                    <th className="px-4 py-4 text-right">เบิกจ่ายแล้วเสร็จ</th>
                    <th className="px-4 py-4 text-center">สถานะโครงการ</th>
                    <th className="px-6 py-4 text-center">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">
                        ยังไม่มีข้อมูลโครงการที่ระบุแผนก/งานในระบบ
                      </td>
                    </tr>
                  ) : (
                    departments.map((dept, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm flex items-center gap-2">
                          <Building size={16} className="text-slate-400" />
                          {dept.department}
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-slate-700 text-xs">
                          {dept.project_count}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-slate-800 text-sm">
                          ฿{(dept.total_requested || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-amber-600 text-sm">
                          ฿{(dept.total_committed || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-emerald-600 text-sm">
                          ฿{(dept.total_disbursed || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="inline-flex items-center gap-2 text-xs">
                            <span className="text-emerald-600 font-bold">{dept.completed_count} เสร็จ</span>
                            <span className="text-slate-300">/</span>
                            <span className="text-amber-600 font-bold">{dept.pending_count} รอ</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleViewDeptProjects(dept.department)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 rounded-xl text-xs font-bold transition-all text-slate-700"
                          >
                            <Eye size={14} />
                            ดูโครงการ
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: หมวดค่าใช้จ่าย (Expense Categories Management & Budget Allocation) */}
      {activeTab === 'categories' && (
        <ExpenseCategoriesManager
          currentUser={currentUser}
          userRole={userRole}
          selectedYear={selectedYear}
          onSelectProject={onSelectProject}
          onRefreshAll={() => {
            fetchBudgetSources();
            if (onRefreshExpenseCategories) onRefreshExpenseCategories();
          }}
        />
      )}

      {/* Tab 4: กำหนดปีงบประมาณ (Fiscal Year Management) */}
      {activeTab === 'fiscal_years' && (
        <FiscalYearManager
          currentUser={currentUser}
          userRole={userRole}
          onFiscalYearChanged={() => {
            fetchBudgetSources();
            fetchFiscalYearsList();
            if (onRefreshExpenseCategories) onRefreshExpenseCategories();
          }}
        />
      )}

      {/* Modal: Add/Edit Budget Source */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                    <Landmark size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      {editingSource ? 'แก้ไขแหล่งงบประมาณ' : 'เพิ่มแหล่งงบประมาณใหม่'}
                    </h3>
                    <p className="text-xs text-slate-400">กรอกข้อมูลแหล่งเงินและกรอบวงเงินที่ได้รับจัดสรร (อิสระจากหมวดค่าใช้จ่าย และสามารถเพิ่มงวดจัดสรรได้หลายครั้ง)</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveBudgetSource} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    ชื่อแหล่งงบประมาณ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น งบประมาณแผ่นดิน, เงินรายได้สถานศึกษา, งบอุดหนุน..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none font-semibold text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      รหัสงบประมาณ (Code)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 68-REV-01"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      ปีงบประมาณ (พ.ศ.) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      list="budget-source-fy-list"
                      required
                      placeholder="เช่น 2568"
                      value={formData.fiscal_year}
                      onChange={(e) => setFormData({ ...formData, fiscal_year: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none font-mono"
                    />
                    <datalist id="budget-source-fy-list">
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700">
                      วงเงินที่ได้รับจัดสรร (บาท) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200/60">
                      เพิ่มงวดจัดสรรได้หลายครั้ง
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="0.00"
                    value={formData.total_budget}
                    onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none font-bold text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400">
                    💡 ท่านสามารถระบุวงเงินเริ่มต้นนี้ได้ และเมื่อรัฐบาลจัดสรรงบประมาณเพิ่ม สามารถกดปุ่ม <span className="font-bold text-amber-700">"เพิ่มงวด"</span> ในตารางเพื่อบันทึกงวดที่ 2, 3... ได้ตลอดเวลา
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    รายละเอียด / คำอธิบายเพิ่มเติม
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ระบุวัตถุประสงค์ คำอธิบาย หรือข้อกำหนดในการเบิกจ่าย..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-red-500 outline-none"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold shadow-md shadow-red-100 transition-all disabled:opacity-50"
                  >
                    {formSubmitting ? 'กำลังบันทึก...' : editingSource ? 'บันทึกการแก้ไข' : 'เพิ่มแหล่งงบประมาณ'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Project List for Selected Budget Source */}
      <AnimatePresence>
        {showProjectsModal && selectedSourceForProjects && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full">
                      {selectedSourceForProjects.fiscal_year || '2568'}
                    </span>
                    <h3 className="font-bold text-slate-800 text-base">
                      โครงการที่ใช้ {selectedSourceForProjects.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    วงเงินจัดสรร: ฿{(selectedSourceForProjects.total_budget || 0).toLocaleString()} | 
                    คงเหลือ: ฿{(selectedSourceForProjects.remaining_budget || 0).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setShowProjectsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {loadingProjects ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    กำลังโหลดรายชื่อโครงการ...
                  </div>
                ) : sourceProjects.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    ยังไม่มีโครงการใดที่ผูกกับแหล่งงบประมาณนี้
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                          <th className="px-4 py-3">รหัสโครงการ</th>
                          <th className="px-4 py-3">ชื่อโครงการ</th>
                          <th className="px-4 py-3">แผนก/งาน</th>
                          <th className="px-4 py-3 text-right">วงเงินที่ขอ</th>
                          <th className="px-4 py-3 text-center">ขั้นตอน</th>
                          <th className="px-4 py-3 text-center">สถานะ</th>
                          <th className="px-4 py-3 text-center">รายละเอียด</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sourceProjects.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 text-xs">
                            <td className="px-4 py-3 font-mono font-bold text-slate-600">
                              {p.project_code || `#${p.id}`}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800">
                              {p.title}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {p.department || '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                              ฿{(p.budget_amount || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-bold">
                                {p.current_process}{p.current_step}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === 'completed' 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {p.status === 'completed' ? 'เสร็จสิ้น' : 'กำลังดำเนินการ'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {onSelectProject && (
                                <button
                                  onClick={() => {
                                    setShowProjectsModal(false);
                                    onSelectProject(p);
                                  }}
                                  className="text-red-700 hover:underline font-bold"
                                >
                                  เปิดดู
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Department Projects */}
      <AnimatePresence>
        {showDeptModal && selectedDeptName && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                    <Building size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      โครงการของ {selectedDeptName}
                    </h3>
                    <p className="text-xs text-slate-400">รายการโครงการทั้งหมดของแผนกวิชา / งานนี้</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeptModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {loadingDeptProjects ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    กำลังโหลดโครงการ...
                  </div>
                ) : deptProjects.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    ไม่พบโครงการของแผนกนี้
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                          <th className="px-4 py-3">รหัสโครงการ</th>
                          <th className="px-4 py-3">ชื่อโครงการ</th>
                          <th className="px-4 py-3">แหล่งงบประมาณ</th>
                          <th className="px-4 py-3 text-right">งบประมาณ</th>
                          <th className="px-4 py-3 text-center">ขั้นตอน</th>
                          <th className="px-4 py-3 text-center">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {deptProjects.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono font-bold text-slate-600">
                              {p.project_code || `#${p.id}`}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800">
                              {p.title}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {p.budget_source || '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">
                              ฿{(p.budget_amount || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-bold">
                                {p.current_process}{p.current_step}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === 'completed' 
                                  ? 'bg-emerald-100 text-emerald-700' 
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {p.status === 'completed' ? 'เสร็จสิ้น' : 'กำลังดำเนินการ'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Budget Source Multi-Installment Allocations (งานยุทธศาสตร์เพิ่มวงเงินได้หลายครั้ง) */}
      <AnimatePresence>
        {showAllocationsModal && allocatingSource && (
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
                        ปีงบฯ {allocatingSource.fiscal_year || '2568'}
                      </span>
                      {allocatingSource.code && (
                        <span className="font-mono text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                          {allocatingSource.code}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg md:text-xl font-black text-slate-900 mt-1">
                      จัดการและเพิ่มวงเงินจัดสรร: {allocatingSource.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      สามารถเพิ่มวงเงินที่ได้รับจัดสรรได้มากกว่า 1 ครั้ง โดยรัฐบาลจัดสรรมาเป็นงวดๆ วงเงินรวมทั้งหมดเป็นก้อนเดียวกัน
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAllocationsModal(false)}
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
                      ฿{(allocatingSource.total_budget || 0).toLocaleString()}
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
                      {sourceAllocations.length} ครั้ง
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      บันทึกในระบบ {sourceAllocations.length} รายการ
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-amber-50/80 to-amber-50/30 rounded-2xl border border-amber-100">
                    <div className="text-[11px] font-bold text-amber-700 mb-1 flex items-center gap-1.5">
                      <TrendingUp size={14} />
                      ยอดใช้ไปแล้ว
                    </div>
                    <div className="text-xl font-black text-amber-600">
                      ฿{(allocatingSource.total_used || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-amber-600 font-semibold mt-1">
                      {allocatingSource.project_count || 0} โครงการที่ผูกกับแหล่งนี้
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-emerald-50/80 to-emerald-50/30 rounded-2xl border border-emerald-100">
                    <div className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                      <Wallet size={14} />
                      ยอดคงเหลือสุทธิ
                    </div>
                    <div className={`text-xl font-black ${(allocatingSource.remaining_budget ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      ฿{(allocatingSource.remaining_budget || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                      พร้อมใช้จัดสรรโครงการ
                    </div>
                  </div>
                </div>

                {/* Section 1: Add New Allocation Installment Form */}
                {canManage && (
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
                            เช่น งบประมาณแผ่นดินจัดสรรครั้งที่ 2, 3 หรือเงินโอนจัดสรรเพิ่มเติมในรอบปี
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded-full">
                        เพิ่มงวดจัดสรร
                      </span>
                    </div>

                    {allocationFormError && (
                      <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                        <AlertCircle size={15} />
                        <span>{allocationFormError}</span>
                      </div>
                    )}

                    <form onSubmit={handleSaveSourceAllocation} className="space-y-4">
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
                              value={allocationForm.installment_no}
                              onChange={(e) => {
                                const no = e.target.value;
                                setAllocationForm({
                                  ...allocationForm,
                                  installment_no: no,
                                  title: `${allocatingSource.name} จัดสรรครั้งที่ ${no}`
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
                            value={allocationForm.title}
                            onChange={(e) => setAllocationForm({ ...allocationForm, title: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-red-500 outline-none"
                            placeholder="เช่น งบประมาณแผ่นดิน จัดสรรครั้งที่ 2"
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
                              value={allocationForm.amount}
                              onChange={(e) => setAllocationForm({ ...allocationForm, amount: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-red-500 outline-none pr-10"
                              placeholder="เช่น 1500000"
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
                        {[500000, 1000000, 1500000, 2000000, 3000000, 5000000].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setAllocationForm({ ...allocationForm, amount: String(val) })}
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
                            value={allocationForm.allocation_date}
                            onChange={(e) => setAllocationForm({ ...allocationForm, allocation_date: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-red-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            เลขที่หนังสือ / เอกสารอ้างอิง
                          </label>
                          <input
                            type="text"
                            value={allocationForm.doc_ref}
                            onChange={(e) => setAllocationForm({ ...allocationForm, doc_ref: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-red-500 outline-none"
                            placeholder="เช่น หนังสือ ศธ 0601/ว 123"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-700">
                            หมายเหตุ / คำอธิบายงวดนี้
                          </label>
                          <input
                            type="text"
                            value={allocationForm.notes}
                            onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-red-500 outline-none"
                            placeholder="เช่น โอนจัดสรรไตรมาสที่ 2"
                          />
                        </div>
                      </div>

                      {/* Live Calculation Preview Banner */}
                      {parseFloat(allocationForm.amount) > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 bg-gradient-to-r from-red-50 via-rose-50 to-amber-50 rounded-xl border border-red-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-600">คำนวณวงเงินสะสมใหม่:</span>
                            <span className="text-slate-500">฿{(allocatingSource.total_budget || 0).toLocaleString()} (เดิม)</span>
                            <span className="font-bold text-red-600">+ ฿{parseFloat(allocationForm.amount).toLocaleString()} (งวดนี้)</span>
                            <span className="text-slate-400">=</span>
                            <span className="font-black text-red-800 text-sm">
                              ฿{((allocatingSource.total_budget || 0) + parseFloat(allocationForm.amount)).toLocaleString()}
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
                          {allocationSubmitting ? 'กำลังบันทึก...' : `บันทึกเพิ่มวงเงินงวดที่ ${allocationForm.installment_no || ''}`}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Section 2: History of Installments */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <History size={16} className="text-slate-500" />
                      <h4 className="font-bold text-sm text-slate-800">
                        ประวัติรายการจัดสรรงบประมาณ ({sourceAllocations.length} งวด)
                      </h4>
                    </div>
                    <span className="text-xs text-slate-400">
                      รวมวงเงินสะสมเป็นก้อนเดียวกันในแหล่งนี้
                    </span>
                  </div>

                  {loadingAllocations ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      กำลังโหลดประวัติงวดจัดสรร...
                    </div>
                  ) : sourceAllocations.length === 0 ? (
                    <div className="p-6 bg-slate-50 rounded-2xl text-center border border-slate-200 text-xs text-slate-500">
                      ยังไม่มีรายการจัดสรร (วงเงินตั้งต้น ฿{(allocatingSource.total_budget || 0).toLocaleString()} บาท)
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
                            {canManage && <th className="px-3 py-3 text-center w-14">จัดการ</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sourceAllocations.map((alloc) => {
                            const totalAllocSum = sourceAllocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
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
                                {canManage && (
                                  <td className="px-3 py-3 text-center">
                                    {sourceAllocations.length > 1 && (
                                      <button
                                        onClick={() => handleDeleteSourceAllocation({
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
                              ฿{sourceAllocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0).toLocaleString()}
                            </td>
                            {canManage && <td></td>}
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
                  แหล่งเงิน: <span className="font-bold text-slate-700">{allocatingSource.name}</span> | วงเงินรวมสะสม: <span className="font-bold text-slate-900">฿{(allocatingSource.total_budget || 0).toLocaleString()} บาท</span>
                </div>
                <button
                  onClick={() => setShowAllocationsModal(false)}
                  className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal: ยืนยันการลบแหล่งงบประมาณ (In-App Confirm Modal) */}
        {sourceToDelete && (
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
                ยืนยันการลบแหล่งงบประมาณ?
              </h3>
              <p className="text-xs text-slate-500 text-center mb-4">
                คุณกำลังจะลบข้อมูลแหล่งงบประมาณออกจากระบบ การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-4 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">ชื่อแหล่งงบประมาณ:</span>
                  <span className="font-black text-slate-800 text-sm">{sourceToDelete.name}</span>
                </div>
                {sourceToDelete.code && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">รหัสแหล่งเงิน:</span>
                    <span className="font-bold text-slate-700 font-mono">{sourceToDelete.code}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">ปีงบประมาณ:</span>
                  <span className="font-bold text-slate-700">พ.ศ. {sourceToDelete.fiscal_year || '2568'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">วงเงินจัดสรรรวม:</span>
                  <span className="font-black text-red-600">฿{Number(sourceToDelete.total_budget || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-slate-400">โครงการที่ผูกอยู่:</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${
                    (sourceToDelete.project_count || 0) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {sourceToDelete.project_count || 0} โครงการ
                  </span>
                </div>
              </div>

              {(sourceToDelete.project_count || 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs mb-4 flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">ไม่สามารถลบได้ในขณะนี้:</span> มี {sourceToDelete.project_count} โครงการที่กำลังผูกกับแหล่งเงินนี้อยู่ กรุณาแก้ไขโครงการหรือเปลี่ยนแหล่งงบประมาณของโครงการเหล่านั้นก่อนทำการลบ
                  </div>
                </div>
              )}

              {deleteSourceError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs mb-4 flex items-start gap-2">
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>{deleteSourceError}</div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeletingSource}
                  onClick={() => {
                    setSourceToDelete(null);
                    setDeleteSourceError(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeletingSource || (sourceToDelete.project_count || 0) > 0}
                  onClick={confirmDeleteBudgetSource}
                  className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isDeletingSource ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังลบ...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      ยืนยันลบแหล่งงบ
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal: ยืนยันการลบงวดจัดสรร (In-App Confirm Modal) */}
        {allocationToDelete && (
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
                ยืนยันการลบงวดจัดสรรงบประมาณ?
              </h3>
              <p className="text-xs text-slate-500 text-center mb-4">
                ระบบจะคำนวณหักลบยอดรวมสะสมของแหล่งงบประมาณออกโดยอัตโนมัติ
              </p>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 mb-5 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">งวดที่:</span>
                  <span className="font-bold text-slate-700">ครั้งที่ {allocationToDelete.installment_no}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">รายการจัดสรร:</span>
                  <span className="font-bold text-slate-800">{allocationToDelete.title}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">วงเงินที่หักออก:</span>
                  <span className="font-black text-rose-600 text-sm">฿{allocationToDelete.amount.toLocaleString()} บาท</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeletingAllocation}
                  onClick={() => setAllocationToDelete(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeletingAllocation}
                  onClick={confirmDeleteSourceAllocation}
                  className="flex-1 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeletingAllocation ? (
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
