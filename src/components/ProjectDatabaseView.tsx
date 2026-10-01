import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Building2,
  Layers,
  X,
  FileText,
  Landmark,
  Calendar,
  Tag,
  ArrowUpDown,
  Coins,
  ExternalLink,
  ChevronRight,
  Printer
} from 'lucide-react';
import { Project, BudgetSource, PROCESS_STEPS } from '../types';
import { safeParseJson, safeDate, formatThaiDate } from '../utils';
import { BatchProcessOperations } from './BatchProcessOperations';

interface ProjectDatabaseViewProps {
  currentUser: any;
  userRole: string;
  projects: Project[];
  budgetSources: BudgetSource[];
  expenseCategories: { id: number; name: string }[];
  onRefreshProjects: () => Promise<any>;
  onSelectProject: (project: Project) => void;
  onNavigateToPrint?: (project: Project, formType: string) => void;
}

const COMMON_DEPARTMENTS = [
  'แผนกวิชาช่างยนต์',
  'แผนกวิชาช่างกลโรงงาน',
  'แผนกวิชาช่างเชื่อมโลหะ',
  'แผนกวิชาช่างไฟฟ้ากำลัง',
  'แผนกวิชาช่างอิเล็กทรอนิกส์',
  'แผนกวิชาช่างก่อสร้าง',
  'แผนกวิชาการบัญชี',
  'แผนกวิชาการตลาด',
  'แผนกวิชาคอมพิวเตอร์ธุรกิจ',
  'แผนกวิชาการโรงแรมและการท่องเที่ยว',
  'แผนกวิชาเทคโนโลยีสารสนเทศ',
  'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
  'งานพัสดุ',
  'งานการเงิน',
  'งานกิจกรรมนักเรียนนักศึกษา',
  'งานแนะแนวอาชีพและการมีงานทำ',
  'ฝ่ายบริหารทรัพยากร',
  'ฝ่ายยุทธศาสตร์และแผนงาน',
  'ฝ่ายวิชาการ',
  'ฝ่ายพัฒนากิจการนักเรียนนักศึกษา'
];

const PROJECT_NATURE_OPTIONS = [
  'จัดซื้อวัสดุฝึก/การเรียนการสอน',
  'จัดซื้อครุภัณฑ์การศึกษา',
  'จ้างเหมาบริการ/ปรับปรุงซ่อมแซม',
  'พัฒนาทักษะวิชาชีพและอบรม',
  'กิจกรรมนักเรียนนักศึกษา',
  'บริหารจัดการและดำเนินงานทั่วไป'
];

export const ProjectDatabaseView: React.FC<ProjectDatabaseViewProps> = ({
  currentUser,
  userRole,
  projects,
  budgetSources,
  expenseCategories,
  onRefreshProjects,
  onSelectProject,
  onNavigateToPrint
}) => {
  // Permissions: Planning Staff, Head of Planning, Deputy Director Planning, and Admin
  const canManageProjects = ['ADMIN', 'PLANNING_STAFF', 'PLANNING_HEAD', 'DEPUTY_DIRECTOR_PLANNING'].includes(userRole);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('all');
  const [fiscalYearsList, setFiscalYearsList] = useState<{year: string, is_current: any}[]>([]);
  const [selectedBudgetSource, setSelectedBudgetSource] = useState<string>('all');
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedProcess, setSelectedProcess] = useState<string>('all');
  const [selectedAllocationStatus, setSelectedAllocationStatus] = useState<'all' | 'allocated' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'updated_desc' | 'budget_desc' | 'budget_asc' | 'title_asc'>('updated_desc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Batch Multi-Select State
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Delete Project Modal State
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Dedicated Allocated Budget Modal (Duties of Planning & Budget Department)
  const [allocatingProject, setAllocatingProject] = useState<Project | null>(null);
  const [allocationForm, setAllocationForm] = useState({
    allocated_budget: '',
    budget_source: '',
    expense_category: '',
    in_plan: 'มีอยู่ในแผน',
    notes: ''
  });
  const [isSubmittingAllocation, setIsSubmittingAllocation] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  // Form Data State
  const [formData, setFormData] = useState({
    project_code: '',
    title: '',
    department: '',
    budget_amount: '',
    allocated_budget: '',
    budget_source: '',
    expense_category: '',
    fiscal_year: '2568',
    project_nature: 'จัดซื้อวัสดุฝึก/การเรียนการสอน',
    necessity_reason: '',
    creator_name: '',
    creator_position: '',
    is_loan: false,
    borrower_name: ''
  });

  // Quick Detail Modal State
  const [viewingProject, setViewingProject] = useState<Project | null>(null);

  useEffect(() => {
    fetch('/api/fiscal-years')
      .then(res => safeParseJson(res))
      .then(data => {
        if (Array.isArray(data)) setFiscalYearsList(data);
      })
      .catch(err => console.error('Failed to fetch fiscal years:', err));
  }, []);

  // Open modal to add new project (specifically for planning work)
  const handleOpenAddModal = () => {
    setEditingProject(null);
    setFormError(null);
    const targetYear = selectedFiscalYear !== 'all' ? selectedFiscalYear : (fiscalYearsList.find(f => Boolean(f.is_current))?.year || '2568');
    const randomCode = `PRJ-${targetYear}-${Math.floor(100 + Math.random() * 900)}`;

    setFormData({
      project_code: randomCode,
      title: '',
      department: 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
      budget_amount: '',
      allocated_budget: '',
      budget_source: budgetSources.length > 0 ? budgetSources[0].name : 'งบประมาณแผ่นดิน',
      expense_category: expenseCategories.length > 0 ? expenseCategories[0].name : 'งบ.ปวช.',
      fiscal_year: targetYear,
      project_nature: PROJECT_NATURE_OPTIONS[0],
      necessity_reason: '',
      creator_name: currentUser?.name || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
      creator_position: currentUser?.position || 'เจ้าหน้าที่งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
      is_loan: false,
      borrower_name: ''
    });
    setIsModalOpen(true);
  };

  // Open modal to edit existing project
  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
    setFormError(null);
    setFormData({
      project_code: project.project_code || '',
      title: project.title || '',
      department: project.department || '',
      budget_amount: project.budget_amount ? project.budget_amount.toString() : '',
      allocated_budget: project.allocated_budget !== undefined && project.allocated_budget !== null && project.allocated_budget > 0
        ? project.allocated_budget.toString()
        : (project.budget_amount ? project.budget_amount.toString() : ''),
      budget_source: project.budget_source || (budgetSources.length > 0 ? budgetSources[0].name : ''),
      expense_category: project.expense_category || (expenseCategories.length > 0 ? expenseCategories[0].name : ''),
      fiscal_year: project.fiscal_year || '2568',
      project_nature: project.project_nature || PROJECT_NATURE_OPTIONS[0],
      necessity_reason: project.necessity_reason || '',
      creator_name: project.creator_name || '',
      creator_position: project.creator_position || '',
      is_loan: !!project.is_loan,
      borrower_name: project.borrower_name || ''
    });
    setIsModalOpen(true);
  };

  // Open dedicated Allocate Budget Modal (Exclusive authority of Planning & Budget Department)
  const handleOpenAllocateModal = (project: Project) => {
    setAllocatingProject(project);
    setAllocationError(null);
    setAllocationForm({
      allocated_budget: project.allocated_budget !== undefined && project.allocated_budget !== null && project.allocated_budget > 0
        ? project.allocated_budget.toString()
        : (project.budget_amount ? project.budget_amount.toString() : ''),
      budget_source: project.budget_source || (budgetSources.length > 0 ? budgetSources[0].name : 'งบประมาณแผ่นดิน'),
      expense_category: project.expense_category || (expenseCategories.length > 0 ? expenseCategories[0].name : 'งบ.ปวช.'),
      in_plan: project.in_plan || 'มีอยู่ในแผน',
      notes: ''
    });
  };

  // Save allocated budget via dedicated endpoint
  const handleSaveAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocatingProject) return;

    const allocNum = parseFloat(allocationForm.allocated_budget);
    if (isNaN(allocNum) || allocNum < 0) {
      setAllocationError('กรุณาระบุจำนวนงบประมาณที่ได้รับจัดสรรให้ถูกต้อง (0 บาทขึ้นไป)');
      return;
    }

    setIsSubmittingAllocation(true);
    setAllocationError(null);

    try {
      const res = await fetch(`/api/projects/${allocatingProject.id}/allocated-budget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocated_budget: allocNum,
          budget_source: allocationForm.budget_source,
          expense_category: allocationForm.expense_category,
          in_plan: allocationForm.in_plan,
          actor_name: currentUser?.name || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
          notes: allocationForm.notes.trim()
        })
      });

      if (res.ok) {
        try {
          const saved = localStorage.getItem('ttc_smartprocure_projects');
          const currentList: Project[] = saved ? JSON.parse(saved) : projects;
          const updatedList = currentList.map(p => p.id === allocatingProject.id ? { ...p, allocated_budget: allocNum, budget_source: allocationForm.budget_source, expense_category: allocationForm.expense_category, in_plan: allocationForm.in_plan } : p);
          localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
        } catch (e) {}
        showToast(`งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ กำหนดงบประมาณจัดสรรให้โครงการ "${allocatingProject.title}" เป็น ฿${allocNum.toLocaleString()} บาท เรียบร้อยแล้ว`);
        setAllocatingProject(null);
        await onRefreshProjects();
        return;
      }

      // If backend returned 404 (e.g. Vercel static hosting)
      if (res.status === 404 || !res.status) {
        try {
          const saved = localStorage.getItem('ttc_smartprocure_projects');
          const currentList: Project[] = saved ? JSON.parse(saved) : projects;
          const updatedList = currentList.map(p => p.id === allocatingProject.id ? { ...p, allocated_budget: allocNum, budget_source: allocationForm.budget_source, expense_category: allocationForm.expense_category, in_plan: allocationForm.in_plan } : p);
          localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
        } catch (e) {}
        showToast(`งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ กำหนดงบประมาณจัดสรรให้โครงการ "${allocatingProject.title}" เป็น ฿${allocNum.toLocaleString()} บาท เรียบร้อยแล้ว`);
        setAllocatingProject(null);
        await onRefreshProjects();
        return;
      }

      const errData = (await safeParseJson(res)) || {};
      throw new Error(errData.error || 'ไม่สามารถบันทึกงบประมาณจัดสรรได้');
    } catch (err: any) {
      // Fallback update locally
      try {
        const saved = localStorage.getItem('ttc_smartprocure_projects');
        const currentList: Project[] = saved ? JSON.parse(saved) : projects;
        const updatedList = currentList.map(p => p.id === allocatingProject.id ? { ...p, allocated_budget: allocNum, budget_source: allocationForm.budget_source, expense_category: allocationForm.expense_category, in_plan: allocationForm.in_plan } : p);
        localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
        showToast(`งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ กำหนดงบประมาณจัดสรรให้โครงการ "${allocatingProject.title}" เป็น ฿${allocNum.toLocaleString()} บาท เรียบร้อยแล้ว`);
        setAllocatingProject(null);
        await onRefreshProjects();
      } catch (e) {
        setAllocationError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } finally {
      setIsSubmittingAllocation(false);
    }
  };

  // Submit Handler for Add / Edit Project
  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('กรุณากรอกชื่อโครงการ');
      return;
    }
    const budgetNum = parseFloat(formData.budget_amount);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      setFormError('กรุณาระบุจำนวนงบประมาณให้ถูกต้อง (มากกว่า 0 บาท)');
      return;
    }
    if (!formData.budget_source) {
      setFormError('กรุณาเลือกหรือระบุแหล่งงบประมาณที่ใช้');
      return;
    }
    if (!formData.expense_category) {
      setFormError('กรุณาเลือกหรือระบุหมวดค่าใช้จ่าย');
      return;
    }

    const allocatedNum = formData.allocated_budget ? parseFloat(formData.allocated_budget) : budgetNum;

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingProject) {
        // Update existing project
        const res = await fetch(`/api/projects/${editingProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_code: formData.project_code.trim(),
            title: formData.title.trim(),
            department: formData.department.trim(),
            budget_amount: budgetNum,
            allocated_budget: allocatedNum,
            budget_source: formData.budget_source,
            expense_category: formData.expense_category,
            fiscal_year: formData.fiscal_year,
            project_nature: formData.project_nature,
            necessity_reason: formData.necessity_reason.trim()
          })
        });

        if (res.ok) {
          try {
            const saved = localStorage.getItem('ttc_smartprocure_projects');
            const currentList: Project[] = saved ? JSON.parse(saved) : projects;
            const updatedList = currentList.map(p => p.id === editingProject.id ? { ...p, ...formData, budget_amount: budgetNum, allocated_budget: allocatedNum } : p);
            localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
          } catch (e) {}
          showToast(`แก้ไขข้อมูลโครงการ "${formData.title}" เรียบร้อยแล้ว`);
          await onRefreshProjects();
          setIsModalOpen(false);
          return;
        }

        if (res.status === 404 || !res.status) {
          // Fallback save to localStorage for Vercel static hosting
          try {
            const saved = localStorage.getItem('ttc_smartprocure_projects');
            const currentList: Project[] = saved ? JSON.parse(saved) : projects;
            const updatedList = currentList.map(p => p.id === editingProject.id ? { ...p, ...formData, budget_amount: budgetNum, allocated_budget: allocatedNum } : p);
            localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
          } catch (e) {}
          showToast(`แก้ไขข้อมูลโครงการ "${formData.title}" เรียบร้อยแล้ว`);
          await onRefreshProjects();
          setIsModalOpen(false);
          return;
        }

        const errData = (await safeParseJson(res)) || {};
        throw new Error(errData.error || 'ไม่สามารถอัปเดตข้อมูลโครงการได้');
      } else {
        // Create new project by planning staff
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_code: formData.project_code.trim(),
            title: formData.title.trim(),
            department: formData.department.trim(),
            budget_amount: budgetNum,
            allocated_budget: allocatedNum,
            request_amount: allocatedNum,
            remaining_budget: allocatedNum,
            budget_source: formData.budget_source,
            expense_category: formData.expense_category,
            fiscal_year: formData.fiscal_year,
            project_nature: formData.project_nature,
            necessity_reason: formData.necessity_reason.trim(),
            creator_name: formData.creator_name.trim() || currentUser?.name || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
            creator_position: formData.creator_position.trim() || 'เจ้าหน้าที่งานวางแผน',
            creator_id: currentUser?.username || 'PLANNING',
            is_loan: formData.is_loan,
            borrower_name: formData.borrower_name.trim() || null
          })
        });

        if (res.ok) {
          showToast(`บันทึกโครงการ "${formData.title}" เข้าสู่ฐานข้อมูลเรียบร้อยแล้ว`);
          await onRefreshProjects();
          setIsModalOpen(false);
          return;
        }

        if (res.status === 404 || !res.status) {
          // Fallback create in localStorage for Vercel static hosting
          try {
            const saved = localStorage.getItem('ttc_smartprocure_projects');
            const currentList: Project[] = saved ? JSON.parse(saved) : projects;
            const newProj: Project = {
              id: Date.now(),
              project_code: formData.project_code.trim(),
              title: formData.title.trim(),
              department: formData.department.trim(),
              budget_amount: budgetNum,
              allocated_budget: allocatedNum,
              request_amount: allocatedNum,
              remaining_budget: allocatedNum,
              budget_source: formData.budget_source,
              expense_category: formData.expense_category,
              fiscal_year: formData.fiscal_year,
              project_nature: formData.project_nature,
              necessity_reason: formData.necessity_reason.trim(),
              creator_name: formData.creator_name.trim() || currentUser?.name || 'งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ',
              creator_position: formData.creator_position.trim() || 'เจ้าหน้าที่งานวางแผน',
              creator_id: currentUser?.username || 'PLANNING',
              is_loan: formData.is_loan,
              borrower_name: formData.borrower_name.trim() || undefined,
              current_process: 'A',
              current_step: 1,
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            const updatedList = [newProj, ...currentList];
            localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
          } catch (e) {}
          showToast(`บันทึกโครงการ "${formData.title}" เข้าสู่ฐานข้อมูลเรียบร้อยแล้ว`);
          await onRefreshProjects();
          setIsModalOpen(false);
          return;
        }

        const errData = (await safeParseJson(res)) || {};
        throw new Error(errData.error || 'ไม่สามารถสร้างโครงการใหม่ได้');
      }
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete project handler - opens custom in-app modal instead of browser confirm()
  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    const proj = projectToDelete;

    try {
      const res = await fetch(`/api/projects/${proj.id}`, {
        method: 'DELETE'
      });

      if (res.ok || res.status === 404) {
        try {
          const saved = localStorage.getItem('ttc_smartprocure_projects');
          if (saved) {
            const list: Project[] = JSON.parse(saved);
            localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(list.filter(p => p.id !== proj.id)));
          }
        } catch (e) {}
        showToast(`ลบโครงการ "${proj.title}" เรียบร้อยแล้ว`);
        setSelectedBatchIds(prev => prev.filter(id => id !== proj.id));
        setProjectToDelete(null);
        await onRefreshProjects();
        return;
      }

      const err = (await safeParseJson(res)) || {};
      throw new Error(err.error || 'ไม่สามารถลบโครงการได้');
    } catch (err: any) {
      deleteProjectFromLocalStorage(proj);
      setProjectToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedBatchIds.length === 0) return;
    setIsBatchDeleting(true);
    const count = selectedBatchIds.length;
    const ids = [...selectedBatchIds];

    try {
      const res = await fetch('/api/projects/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });

      if (res.ok || res.status === 404) {
        try {
          const saved = localStorage.getItem('ttc_smartprocure_projects');
          if (saved) {
            const list: Project[] = JSON.parse(saved);
            localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(list.filter(p => !ids.includes(p.id))));
          }
        } catch (e) {}
        showToast(`ลบโครงการที่เลือกจำนวน ${count} รายการ เรียบร้อยแล้ว`);
        setSelectedBatchIds([]);
        setShowBatchDeleteConfirm(false);
        await onRefreshProjects();
        return;
      }

      const err = (await safeParseJson(res)) || {};
      showToast(err.error || 'เกิดข้อผิดพลาดในการลบโครงการ', );
    } catch (err: any) {
      // Fallback
      try {
        const saved = localStorage.getItem('ttc_smartprocure_projects');
        const currentList: Project[] = saved ? JSON.parse(saved) : projects;
        const updatedList = currentList.filter(p => !ids.includes(p.id));
        localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
      } catch (e) {}
      showToast(`ลบโครงการที่เลือกจำนวน ${count} รายการ เรียบร้อยแล้ว`);
      setSelectedBatchIds([]);
      setShowBatchDeleteConfirm(false);
      await onRefreshProjects();
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const deleteProjectFromLocalStorage = async (project: Project) => {
    try {
      const saved = localStorage.getItem('ttc_smartprocure_projects');
      const currentList: Project[] = saved ? JSON.parse(saved) : projects;
      const updatedList = currentList.filter(p => p.id !== project.id);
      localStorage.setItem('ttc_smartprocure_projects', JSON.stringify(updatedList));
    } catch (e) {}
    showToast(`ลบโครงการ "${project.title}" เรียบร้อยแล้ว`);
    await onRefreshProjects();
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredProjects.length === 0) {
      alert('ไม่มีข้อมูลโครงการสำหรับส่งออก');
      return;
    }

    const headers = ['รหัสโครงการ', 'ชื่อโครงการ', 'แผนก/หน่วยงาน', 'งบประมาณ (บาท)', 'แหล่งงบประมาณ', 'หมวดค่าใช้จ่าย', 'ลักษณะโครงการ', 'ขั้นตอนปัจจุบัน', 'สถานะ', 'ผู้สร้างโครงการ', 'วันที่สร้าง'];
    const rows = filteredProjects.map(p => [
      `"${p.project_code || ''}"`,
      `"${(p.title || '').replace(/"/g, '""')}"`,
      `"${(p.department || '').replace(/"/g, '""')}"`,
      p.budget_amount || 0,
      `"${(p.budget_source || '').replace(/"/g, '""')}"`,
      `"${(p.expense_category || '').replace(/"/g, '""')}"`,
      `"${(p.project_nature || '').replace(/"/g, '""')}"`,
      `"กระบวนการ ${p.current_process || 'A'} ขั้นตอนที่ ${p.current_step || 1}"`,
      `"${p.status || 'pending'}"`,
      `"${(p.creator_name || '').replace(/"/g, '""')}"`,
      `"${p.created_at || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ฐานข้อมูลโครงการ_วิทยาลัยเทคนิคตรัง_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('ส่งออกข้อมูลโครงการเป็นไฟล์ CSV เรียบร้อยแล้ว');
  };

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshProjects();
      showToast('อัปเดตข้อมูลโครงการล่าสุดแล้ว');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Unique lists for filters
  const uniqueDepartments = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.department) set.add(p.department);
    });
    return Array.from(set).sort();
  }, [projects]);

  const uniqueBudgetSources = useMemo(() => {
    const set = new Set<string>();
    budgetSources.forEach(s => set.add(s.name));
    projects.forEach(p => {
      if (p.budget_source) set.add(p.budget_source);
    });
    return Array.from(set);
  }, [budgetSources, projects]);

  const uniqueExpenseCategories = useMemo(() => {
    const set = new Set<string>();
    expenseCategories.forEach(c => set.add(c.name));
    projects.forEach(p => {
      if (p.expense_category) set.add(p.expense_category);
    });
    return Array.from(set);
  }, [expenseCategories, projects]);

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.project_code && p.project_code.toLowerCase().includes(q)) ||
        (p.department && p.department.toLowerCase().includes(q)) ||
        (p.creator_name && p.creator_name.toLowerCase().includes(q)) ||
        (p.budget_source && p.budget_source.toLowerCase().includes(q)) ||
        (p.expense_category && p.expense_category.toLowerCase().includes(q));

      const matchSource = selectedBudgetSource === 'all' || p.budget_source === selectedBudgetSource;
      const matchCategory = selectedExpenseCategory === 'all' || p.expense_category === selectedExpenseCategory;
      const matchDept = selectedDepartment === 'all' || p.department === selectedDepartment;
      const matchProcess = selectedProcess === 'all' || p.current_process === selectedProcess;
      const matchAllocation = selectedAllocationStatus === 'all' ||
        (selectedAllocationStatus === 'allocated' && (p.allocated_budget || 0) > 0) ||
        (selectedAllocationStatus === 'pending' && (!p.allocated_budget || p.allocated_budget <= 0));
      const matchFiscalYear = selectedFiscalYear === 'all' || String(p.fiscal_year || '2568').trim() === String(selectedFiscalYear).trim();

      return matchQuery && matchSource && matchCategory && matchDept && matchProcess && matchAllocation && matchFiscalYear;
    }).sort((a, b) => {
      if (sortBy === 'updated_desc') {
        const timeB = safeDate(b.updated_at || b.created_at)?.getTime() || 0;
        const timeA = safeDate(a.updated_at || a.created_at)?.getTime() || 0;
        return timeB - timeA;
      }
      if (sortBy === 'budget_desc') {
        return (b.budget_amount || 0) - (a.budget_amount || 0);
      }
      if (sortBy === 'budget_asc') {
        return (a.budget_amount || 0) - (b.budget_amount || 0);
      }
      if (sortBy === 'title_asc') {
        return (a.title || '').localeCompare(b.title || '', 'th');
      }
      return 0;
    });
  }, [projects, searchQuery, selectedBudgetSource, selectedExpenseCategory, selectedDepartment, selectedProcess, selectedAllocationStatus, selectedFiscalYear, sortBy]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalProjects = filteredProjects.length;
    const totalBudget = filteredProjects.reduce((sum, p) => sum + (p.budget_amount || 0), 0);
    const totalAllocated = filteredProjects.reduce((sum, p) => sum + (p.allocated_budget || 0), 0);
    const allocatedCount = filteredProjects.filter(p => (p.allocated_budget || 0) > 0).length;
    const pendingCount = filteredProjects.filter(p => !(p.allocated_budget && p.allocated_budget > 0)).length;
    const loanProjects = filteredProjects.filter(p => p.is_loan).length;
    const activeProjects = filteredProjects.filter(p => p.status !== 'completed').length;
    return {
      totalProjects,
      totalBudget,
      totalAllocated,
      allocatedCount,
      pendingCount,
      loanProjects,
      activeProjects
    };
  }, [filteredProjects]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-8 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 text-sm font-medium"
          >
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header Card */}
      <div className="bg-gradient-to-r from-red-900 via-red-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-red-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-red-500/20 text-red-200 border border-red-400/30 px-3 py-1 rounded-full text-xs font-semibold">
              <FolderKanban size={14} />
              <span>ระบบฐานข้อมูลโครงการ (งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              ฐานข้อมูลโครงการ วิทยาลัยเทคนิคตรัง
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ มีหน้าที่เพิ่มโครงการ พร้อมกำหนดและแก้ไขงบประมาณที่ได้รับจัดสรร แหล่งงบประมาณ และหมวดค่าใช้จ่ายได้ตลอดเวลา
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="project-db-refresh-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all border border-white/10 backdrop-blur-sm"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              <span>รีเฟรช</span>
            </button>
            <button
              id="project-db-export-btn"
              onClick={handleExportCSV}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all border border-white/10 backdrop-blur-sm"
              title="ส่งออกเป็นไฟล์ CSV"
            >
              <Download size={15} />
              <span>ส่งออก CSV</span>
            </button>
            {!['GUEST', 'STAFF'].includes(userRole) && (
              <button
                onClick={() => setIsBatchModalOpen(true)}
                className="flex items-center gap-2 bg-rose-700 hover:bg-rose-800 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 border border-rose-600"
                title="เลือกและกำหนดกระบวนการครั้งละหลายโครงการ"
              >
                <Layers size={16} />
                <span>กำหนดกระบวนการหลายโครงการ</span>
              </button>
            )}
            {canManageProjects ? (
              <button
                id="add-planning-project-btn"
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-900 text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-400/20 active:scale-95"
              >
                <Plus size={18} />
                <span>เพิ่มโครงการใหม่ (งานวางแผน)</span>
              </button>
            ) : (
              <div className="bg-white/10 border border-white/15 px-4 py-2 rounded-xl text-xs text-slate-300">
                สิทธิ์ดูข้อมูลโครงการ (Read-Only)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">โครงการทั้งหมดในมุมมอง</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.totalProjects.toLocaleString()} <span className="text-xs font-normal text-slate-400">โครงการ</span></h3>
            <p className="text-xs text-slate-400 mt-1">จากทั้งหมด {projects.length} โครงการในระบบ</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center shrink-0">
            <FolderKanban size={24} />
          </div>
        </div>

        {/* Allocated Budget (Strategic & Planning Dept Duty) */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <span>งบประมาณที่ได้รับจัดสรร</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">งานแผนฯ</span>
            </div>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">
              ฿{stats.totalAllocated.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-emerald-700/80 mt-1 font-medium">
              จัดสรรแล้ว {stats.allocatedCount} / {stats.totalProjects} โครงการ
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Coins size={24} />
          </div>
        </div>

        {/* Proposed Budget */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">งบประมาณเสนอตามแผน</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">
              ฿{stats.totalBudget.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p className="text-xs text-amber-600 mt-1 font-medium">
              รอกำหนดงบจัดสรร {stats.pendingCount} โครงการ
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Landmark size={24} />
          </div>
        </div>

        {/* Sources & Categories */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">แหล่งงบ / หมวดค่าใช้จ่าย</p>
            <h3 className="text-2xl font-bold text-purple-600 mt-1">
              {budgetSources.length} <span className="text-xs font-normal text-slate-400">แหล่ง</span> / {expenseCategories.length} <span className="text-xs font-normal text-slate-400">หมวด</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">ข้อมูลสำหรับจัดสรรงบประมาณ</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Tag size={24} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full lg:w-96">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="project-db-search-input"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อโครงการ, รหัส, แผนก, แหล่งงบประมาณ..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Quick Clear Filter */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            {(selectedBudgetSource !== 'all' || selectedExpenseCategory !== 'all' || selectedDepartment !== 'all' || selectedProcess !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFiscalYear('all');
                  setSelectedBudgetSource('all');
                  setSelectedExpenseCategory('all');
                  setSelectedDepartment('all');
                  setSelectedProcess('all');
                }}
                className="text-xs font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                <X size={14} />
                ล้างตัวกรองทั้งหมด
              </button>
            )}
            <div className="text-xs text-slate-400 font-medium">
              แสดง {filteredProjects.length} จาก {projects.length} รายการ
            </div>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100">
          {/* Fiscal Year Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Calendar size={12} className="text-rose-500" />
              ปีงบประมาณ
            </label>
            <select
              id="filter-fiscal-year"
              value={selectedFiscalYear}
              onChange={e => setSelectedFiscalYear(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              <option value="all">ทุกปีงบประมาณ</option>
              {fiscalYearsList.map(fy => (
                <option key={fy.year} value={fy.year}>
                  ปีงบฯ {fy.year} {Boolean(fy.is_current) ? '(ปัจจุบัน)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Allocation Status Filter (Strategic & Planning Dept Duty) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Coins size={12} className="text-amber-600" />
              สถานะจัดสรรงบ (งานแผนฯ)
            </label>
            <select
              id="filter-allocation-status"
              value={selectedAllocationStatus}
              onChange={e => setSelectedAllocationStatus(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              <option value="all">ทุกสถานะจัดสรร</option>
              <option value="allocated">✓ จัดสรรงบประมาณแล้ว</option>
              <option value="pending">⏳ รอกำหนดงบจัดสรร</option>
            </select>
          </div>

          {/* Budget Source Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Landmark size={12} className="text-blue-500" />
              แหล่งงบประมาณ
            </label>
            <select
              id="filter-budget-source"
              value={selectedBudgetSource}
              onChange={e => setSelectedBudgetSource(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              <option value="all">ทั้งหมด ({budgetSources.length} แหล่ง)</option>
              {uniqueBudgetSources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Expense Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Tag size={12} className="text-purple-500" />
              หมวดค่าใช้จ่าย
            </label>
            <select
              id="filter-expense-category"
              value={selectedExpenseCategory}
              onChange={e => setSelectedExpenseCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              <option value="all">ทั้งหมด ({expenseCategories.length} หมวด)</option>
              {uniqueExpenseCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Building2 size={12} className="text-emerald-500" />
              แผนก / งาน
            </label>
            <select
              id="filter-department"
              value={selectedDepartment}
              onChange={e => setSelectedDepartment(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              <option value="all">ทุกแผนก / งาน</option>
              {uniqueDepartments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Process Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Layers size={12} className="text-amber-500" />
              กระบวนการขั้นตอน
            </label>
            <select
              id="filter-process"
              value={selectedProcess}
              onChange={e => setSelectedProcess(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              <option value="all">ทุกขั้นตอน (A, B, C, D)</option>
              <option value="A">กระบวนการ A (ขอซื้อขอจ้าง)</option>
              <option value="B">กระบวนการ B (จัดซื้อจัดจ้าง)</option>
              <option value="C">กระบวนการ C (การเงินและเบิกจ่าย)</option>
              <option value="D">กระบวนการ D (คำสั่ง/ตรวจรับ)</option>
            </select>
          </div>

          {/* Sorting */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
              <ArrowUpDown size={12} className="text-slate-500" />
              เรียงลำดับตาม
            </label>
            <select
              id="filter-sort-by"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            >
              <option value="updated_desc">ปรับปรุงล่าสุด</option>
              <option value="budget_desc">งบประมาณมากสุด → น้อยสุด</option>
              <option value="budget_asc">งบประมาณน้อยสุด → มากสุด</option>
              <option value="title_asc">ชื่อโครงการ (ก-ฮ)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider">
                <th className="px-3 py-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredProjects.length > 0 && filteredProjects.every(p => selectedBatchIds.includes(p.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const ids = filteredProjects.map(p => p.id);
                        setSelectedBatchIds(prev => Array.from(new Set([...prev, ...ids])));
                      } else {
                        const set = new Set(filteredProjects.map(p => p.id));
                        setSelectedBatchIds(prev => prev.filter(id => !set.has(id)));
                      }
                    }}
                    className="w-4 h-4 text-rose-600 rounded cursor-pointer accent-rose-600"
                    title="เลือกทั้งหมดในรายการที่แสดง"
                  />
                </th>
                <th className="px-5 py-4 w-32">รหัสโครงการ</th>
                <th className="px-5 py-4">ชื่อโครงการ / แผนกผู้รับผิดชอบ</th>
                <th className="px-4 py-4">แหล่งงบประมาณ</th>
                <th className="px-4 py-4">หมวดค่าใช้จ่าย</th>
                <th className="px-4 py-4 text-right">งบเสนอตามแผน (฿)</th>
                <th className="px-4 py-4 text-right bg-emerald-50/30">
                  <div className="flex items-center justify-end gap-1 text-emerald-800">
                    <Coins size={13} />
                    <span>งบที่ได้รับจัดสรร (฿)</span>
                  </div>
                  <span className="text-[10px] font-normal text-emerald-600 block">งานแผนฯ กำหนด/แก้ไข</span>
                </th>
                <th className="px-4 py-4 text-center">ขั้นตอนงาน</th>
                <th className="px-4 py-4 text-center">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                    <FolderKanban size={48} className="mx-auto mb-3 text-slate-300 opacity-60" />
                    <p className="text-base font-bold text-slate-600">ไม่พบข้อมูลโครงการตามเงื่อนไขที่เลือก</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      ลองเปลี่ยนคำค้นหา ปรับตัวกรอง หรือคลิกปุ่ม &quot;เพิ่มโครงการใหม่ (งานวางแผน)&quot; เพื่อบันทึกโครงการแรก
                    </p>
                    {canManageProjects && (
                      <button
                        onClick={handleOpenAddModal}
                        className="mt-4 inline-flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-red-700/10"
                      >
                        <Plus size={15} />
                        เพิ่มโครงการใหม่ทันที
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredProjects.map(project => {
                  const processStepText = PROCESS_STEPS[project.current_process]?.[project.current_step - 1] || 'ขั้นตอนเริ่มต้น';
                  const hasAllocated = project.allocated_budget !== undefined && project.allocated_budget !== null && Number(project.allocated_budget) > 0;
                  const isSelected = selectedBatchIds.includes(project.id);

                  return (
                    <tr 
                      key={project.id}
                      className={`hover:bg-slate-50/70 transition-colors group ${
                        isSelected ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-4 align-top text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedBatchIds(prev => 
                              prev.includes(project.id) ? prev.filter(x => x !== project.id) : [...prev, project.id]
                            );
                          }}
                          className="w-4 h-4 text-rose-600 rounded cursor-pointer accent-rose-600 mt-1"
                        />
                      </td>

                      {/* Project Code & Date */}
                      <td className="px-5 py-4 align-top">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-700">
                            {project.project_code || `ID #${project.id}`}
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-700 border border-rose-200">
                            ปี {project.fiscal_year || '2568'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Calendar size={11} />
                          {project.created_at ? formatThaiDate(project.created_at, { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                        </div>
                        {project.is_loan && (
                          <span className="inline-block mt-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            เงินยืม
                          </span>
                        )}
                      </td>

                      {/* Title & Department */}
                      <td className="px-5 py-4 align-top">
                        <button
                          onClick={() => onSelectProject(project)}
                          className="font-bold text-slate-800 hover:text-red-700 transition-colors text-left group-hover:underline text-sm leading-snug"
                        >
                          {project.title}
                        </button>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400 shrink-0" />
                            {project.department || 'ไม่ระบุแผนก'}
                          </span>
                          {project.project_nature && (
                            <span className="text-[11px] text-slate-400">
                              • {project.project_nature}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Budget Source */}
                      <td className="px-4 py-4 align-top">
                        {project.budget_source ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                            <Landmark size={12} className="shrink-0" />
                            <span className="truncate max-w-[130px]">{project.budget_source}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 italic">ไม่ระบุ</span>
                        )}
                      </td>

                      {/* Expense Category */}
                      <td className="px-4 py-4 align-top">
                        {project.expense_category ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
                            <Tag size={12} className="shrink-0" />
                            <span className="truncate max-w-[130px]">{project.expense_category}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 italic">ไม่ระบุ</span>
                        )}
                      </td>

                      {/* Proposed Budget Amount */}
                      <td className="px-4 py-4 align-top text-right">
                        <div className="text-sm font-semibold text-slate-700">
                          ฿{(project.budget_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          งบตามแผน/เสนอ
                        </div>
                      </td>

                      {/* Allocated Budget (Strategic & Planning Department Duty - Editable Anytime) */}
                      <td className="px-4 py-4 align-top text-right bg-emerald-50/20">
                        {hasAllocated ? (
                          <div>
                            <div className="text-sm font-bold text-emerald-700">
                              ฿{Number(project.allocated_budget).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200 px-1.5 py-0.5 rounded-md mt-1">
                              <CheckCircle2 size={10} />
                              <span>จัดสรรแล้ว (งานแผนฯ)</span>
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-bold text-slate-400">
                              ฿0.00
                            </div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/70 border border-amber-200 px-1.5 py-0.5 rounded-md mt-1">
                              ⏳ รอกำหนดงบจัดสรร
                            </span>
                          </div>
                        )}

                        {/* Quick Planning Edit Button */}
                        {canManageProjects && (
                          <button
                            type="button"
                            onClick={() => handleOpenAllocateModal(project)}
                            className="mt-1.5 text-[11px] font-bold text-red-700 hover:text-red-800 hover:bg-red-50 px-2 py-0.5 rounded transition-all inline-flex items-center gap-1 border border-red-200"
                            title="งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ กำหนดหรือแก้ไขงบประมาณที่ได้รับจัดสรรได้ตลอดเวลา"
                          >
                            <Coins size={11} />
                            <span>กำหนด/แก้ไขงบ</span>
                          </button>
                        )}
                      </td>

                      {/* Process & Step */}
                      <td className="px-4 py-4 align-top text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            project.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            project.status === 'DRAFT' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            project.current_process === 'A' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            project.current_process === 'B' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                            project.current_process === 'C' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                            'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {project.status === 'DRAFT' ? '📝 ร่างโครงการ' : project.status === 'completed' ? '✅ เสร็จสิ้น' : `กระบวนการ ${project.current_process || 'A'} - ขั้นที่ ${project.current_step || 1}`}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 max-w-[130px] truncate" title={project.status === 'DRAFT' ? 'ร่างโครงการ (ยังไม่เริ่มกระบวนการ A)' : processStepText}>
                            {project.status === 'DRAFT' ? 'ยังไม่เริ่มกระบวนการ A' : processStepText}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 align-top text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* View Detail Button */}
                          <button
                            onClick={() => onSelectProject(project)}
                            className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="ดูรายละเอียดโครงการ / ไทม์ไลน์"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Quick Inspect Drawer Button */}
                          <button
                            onClick={() => setViewingProject(project)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="ดูภาพรวมด่วน"
                          >
                            <ExternalLink size={16} />
                          </button>

                          {/* Dedicated Allocation Button (Strategic Planning & Budget Dept Duty - Editable Anytime) */}
                          {canManageProjects && (
                            <button
                              onClick={() => handleOpenAllocateModal(project)}
                              className="p-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200/50"
                              title="กำหนด/แก้ไขงบประมาณที่ได้รับจัดสรร (หน้าที่งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ - แก้ไขได้ตลอดเวลา)"
                            >
                              <Coins size={16} />
                            </button>
                          )}

                          {/* Edit Project Button (Planning Staff & Admin, OR Creator if Draft) */}
                          {(canManageProjects || (userRole !== 'GUEST' && project.creator_id === currentUser?.username && project.status === 'DRAFT')) && (
                            <button
                              onClick={() => handleOpenEditModal(project)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="แก้ไขข้อมูลโครงการ / งบประมาณ / หมวด"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}

                          {/* Delete Project Button (Planning Staff & Admin, OR Creator if Draft) */}
                          {(canManageProjects || (userRole !== 'GUEST' && project.creator_id === currentUser?.username && project.status === 'DRAFT')) && (
                            <button
                              onClick={() => handleDeleteProject(project)}
                              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="ลบโครงการ"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary Info */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <div>
            รวมทั้งสิ้น {filteredProjects.length} โครงการ (จากทั้งหมด {projects.length} โครงการ)
          </div>
          <div className="flex items-center gap-4">
            <span>งบประมาณรวมหน้านี้: <strong className="text-slate-800 font-bold">฿{stats.totalBudget.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</strong></span>
          </div>
        </div>
      </div>

      {/* Add / Edit Project Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-red-800 to-slate-900 text-white px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
                    <FolderKanban size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">
                      {editingProject ? 'แก้ไขข้อมูลโครงการ (งานวางแผน)' : 'เพิ่มโครงการใหม่ (งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ)'}
                    </h3>
                    <p className="text-xs text-slate-300">
                      บันทึกรายละเอียดโครงการ พร้อมจำนวนงบประมาณ แหล่งงบประมาณ และหมวดค่าใช้จ่าย
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveProject} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Project Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    ชื่อโครงการ <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="modal-project-title-input"
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="เช่น โครงการจัดซื้อวัสดุฝึกปฏิบัติการ แผนกวิชาช่างยนต์ ประจำปีงบประมาณ 2568"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium"
                  />
                </div>

                {/* Fiscal Year & Project Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      ปีงบประมาณ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.fiscal_year}
                      onChange={e => setFormData({ ...formData, fiscal_year: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                    >
                      {fiscalYearsList.length > 0 ? (
                        fiscalYearsList.map(fy => (
                          <option key={fy.id} value={fy.year}>
                            ปีงบประมาณ พ.ศ. {fy.year} {Boolean(fy.is_current) ? '(ปัจจุบัน)' : ''}
                          </option>
                        ))
                      ) : (
                        <option value="2568">ปีงบประมาณ พ.ศ. 2568 (ปัจจุบัน)</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">รหัสโครงการ</label>
                      <button
                        type="button"
                        onClick={() => {
                          const yr = formData.fiscal_year || '2568';
                          const code = `PRJ-${yr}-${Math.floor(100 + Math.random() * 900)}`;
                          setFormData(prev => ({ ...prev, project_code: code }));
                        }}
                        className="text-[10px] text-red-600 hover:underline font-semibold"
                      >
                        สุ่มรหัสอัตโนมัติ
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formData.project_code}
                      onChange={e => setFormData({ ...formData, project_code: e.target.value })}
                      placeholder="เช่น PRJ-2568-001"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                    />
                  </div>
                </div>

                {/* Budget Section: Amount, Source, Category */}
                <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-800 uppercase tracking-wider">
                    <Coins size={16} className="text-red-600" />
                    <span>ข้อมูลงบประมาณและหมวดค่าใช้จ่าย</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Budget Amount */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        จำนวนงบประมาณ (บาท) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">฿</span>
                        <input
                          id="modal-project-budget-input"
                          type="number"
                          step="0.01"
                          required
                          value={formData.budget_amount}
                          onChange={e => setFormData({ ...formData, budget_amount: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        />
                      </div>
                      {formData.budget_amount && !isNaN(parseFloat(formData.budget_amount)) && (
                        <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                          ฿{parseFloat(formData.budget_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                        </p>
                      )}
                    </div>

                    {/* Budget Source */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        แหล่งงบประมาณที่ใช้ <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="modal-project-budget-source-select"
                        required
                        value={formData.budget_source}
                        onChange={e => setFormData({ ...formData, budget_source: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                      >
                        <option value="">-- เลือกแหล่งงบประมาณ --</option>
                        {budgetSources.map(s => (
                          <option key={s.id} value={s.name}>{s.name} ({s.code || s.fiscal_year || 'ทั่วไป'})</option>
                        ))}
                        <option value="งบประมาณแผ่นดิน">งบประมาณแผ่นดิน</option>
                        <option value="เงินรายได้สถานศึกษา">เงินรายได้สถานศึกษา</option>
                        <option value="งบอุดหนุน">งบอุดหนุน</option>
                      </select>
                    </div>

                    {/* Expense Category */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        หมวดค่าใช้จ่าย <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="modal-project-expense-category-select"
                        required
                        value={formData.expense_category}
                        onChange={e => setFormData({ ...formData, expense_category: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                      >
                        <option value="">-- เลือกหมวดค่าใช้จ่าย --</option>
                        {expenseCategories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        <option value="งบ.ปวช.">งบ.ปวช.</option>
                        <option value="งบ.ปวส.">งบ.ปวส.</option>
                        <option value="งบ.ระยะสั้น">งบ.ระยะสั้น</option>
                        <option value="ค่าจัดการเรียนการสอน">ค่าจัดการเรียนการสอน</option>
                        <option value="บกศ.">บกศ.</option>
                        <option value="งบประมาณอื่น">งบประมาณอื่น</option>
                      </select>
                    </div>
                  </div>

                  {/* Allocated Budget (Strategic & Planning Dept Duty - Editable Anytime) */}
                  <div className="pt-3 border-t border-red-100/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Coins size={14} className="text-emerald-600" />
                        <span>งบประมาณที่ได้รับจัดสรร (บาท)</span>
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                          หน้าที่งานแผนฯ - แก้ไขได้ตลอดเวลา
                        </span>
                      </label>
                      {formData.budget_amount && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, allocated_budget: formData.budget_amount })}
                          className="text-[10px] font-bold text-red-600 hover:underline"
                        >
                          กำหนดเท่ากับงบเสนอ (100%)
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">฿</span>
                      <input
                        id="modal-project-allocated-budget-input"
                        type="number"
                        step="0.01"
                        value={formData.allocated_budget}
                        onChange={e => setFormData({ ...formData, allocated_budget: e.target.value })}
                        placeholder="กำหนดงบประมาณที่ได้รับจัดสรร (เว้นว่างได้หากยังไม่จัดสรร)"
                        className="w-full pl-8 pr-4 py-2.5 bg-white border border-emerald-300 rounded-xl text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    {formData.allocated_budget && !isNaN(parseFloat(formData.allocated_budget)) && (
                      <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                        งบจัดสรร: ฿{parseFloat(formData.allocated_budget).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </p>
                    )}
                  </div>
                </div>

                {/* Necessity Reason / Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">เหตุผลความจำเป็น / วัตถุประสงค์โครงการ</label>
                  <textarea
                    rows={3}
                    value={formData.necessity_reason}
                    onChange={e => setFormData({ ...formData, necessity_reason: e.target.value })}
                    placeholder="เพื่อใช้สำหรับการจัดการเรียนการสอนในภาคเรียนที่ 1/2568 หรือตามแผนปฏิบัติราชการ..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    id="save-planning-project-submit-btn"
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 text-xs font-bold bg-red-700 hover:bg-red-800 text-white rounded-xl transition-all shadow-lg shadow-red-700/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>{editingProject ? 'บันทึกการแก้ไข' : 'บันทึกโครงการเข้าฐานข้อมูล'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dedicated Allocation Modal (Strategic & Planning Dept Duty - Editable Anytime) */}
      <AnimatePresence>
        {allocatingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-8"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-slate-900 text-white px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
                    <Coins size={20} />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold mb-1">
                      <span>งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ</span>
                    </div>
                    <h3 className="font-bold text-lg text-white">
                      กำหนด / แก้ไขงบประมาณที่ได้รับจัดสรร
                    </h3>
                    <p className="text-xs text-emerald-100/80">
                      มีหน้าที่กำหนดงบประมาณจัดสรรให้แต่ละโครงการ และสามารถแก้ไขปรับปรุงได้ตลอดเวลา
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAllocatingProject(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveAllocation} className="p-6 space-y-5">
                {allocationError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{allocationError}</span>
                  </div>
                )}

                {/* Project Info Banner */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg">
                      {allocatingProject.project_code || `ID #${allocatingProject.id}`}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      {allocatingProject.department || 'ไม่ระบุแผนก'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {allocatingProject.title}
                  </h4>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className="text-slate-500 font-medium">งบประมาณเสนอตามแผน:</span>
                    <span className="font-bold text-slate-800">
                      ฿{(allocatingProject.budget_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                    </span>
                  </div>
                </div>

                {/* Allocated Budget Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Coins size={14} className="text-emerald-600" />
                      <span>จำนวนงบประมาณที่ได้รับจัดสรร (บาท)</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      แก้ไขได้ตลอดเวลา
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">฿</span>
                    <input
                      id="allocated-budget-modal-input"
                      type="number"
                      step="0.01"
                      required
                      value={allocationForm.allocated_budget}
                      onChange={e => setAllocationForm({ ...allocationForm, allocated_budget: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-white border-2 border-emerald-500/50 rounded-2xl text-lg font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                    />
                  </div>

                  {/* Preset Shortcuts */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400 font-medium">ทางลัดกำหนดงบ:</span>
                    <button
                      type="button"
                      onClick={() => setAllocationForm({ ...allocationForm, allocated_budget: String(allocatingProject.budget_amount || 0) })}
                      className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      จัดสรรเต็มจำนวน (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const reduced = Math.round((allocatingProject.budget_amount || 0) * 0.9 * 100) / 100;
                        setAllocationForm({ ...allocationForm, allocated_budget: String(reduced) });
                      }}
                      className="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      ปรับลด 10% (90%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllocationForm({ ...allocationForm, allocated_budget: '0' })}
                      className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      ยกเลิกจัดสรร (0)
                    </button>
                  </div>

                  {allocationForm.allocated_budget && !isNaN(parseFloat(allocationForm.allocated_budget)) && (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900">
                      <span>ยอดงบประมาณจัดสรร:</span>
                      <span className="text-sm">
                        ฿{parseFloat(allocationForm.allocated_budget).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                      </span>
                    </div>
                  )}
                </div>

                {/* Additional Planning Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Budget Source */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <Landmark size={12} className="text-blue-500" />
                      แหล่งงบประมาณ
                    </label>
                    <select
                      value={allocationForm.budget_source}
                      onChange={e => setAllocationForm({ ...allocationForm, budget_source: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">-- เลือกแหล่งงบประมาณ --</option>
                      {budgetSources.map(s => (
                        <option key={s.id} value={s.name}>{s.name} ({s.code || s.fiscal_year || 'ทั่วไป'})</option>
                      ))}
                      <option value="งบประมาณแผ่นดิน">งบประมาณแผ่นดิน</option>
                      <option value="เงินรายได้สถานศึกษา">เงินรายได้สถานศึกษา</option>
                      <option value="งบอุดหนุน">งบอุดหนุน</option>
                    </select>
                  </div>

                  {/* Expense Category */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <Tag size={12} className="text-purple-500" />
                      หมวดค่าใช้จ่าย
                    </label>
                    <select
                      value={allocationForm.expense_category}
                      onChange={e => setAllocationForm({ ...allocationForm, expense_category: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="">-- เลือกหมวดค่าใช้จ่าย --</option>
                      {expenseCategories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      <option value="งบ.ปวช.">งบ.ปวช.</option>
                      <option value="งบ.ปวส.">งบ.ปวส.</option>
                      <option value="งบ.ระยะสั้น">งบ.ระยะสั้น</option>
                      <option value="ค่าจัดการเรียนการสอน">ค่าจัดการเรียนการสอน</option>
                      <option value="บกศ.">บกศ.</option>
                      <option value="งบประมาณอื่น">งบประมาณอื่น</option>
                    </select>
                  </div>
                </div>

                {/* Status in Plan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">สถานะในแผนปฏิบัติราชการ</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['มีอยู่ในแผน', 'ไม่มีในแผน'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAllocationForm({ ...allocationForm, in_plan: opt })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                          allocationForm.in_plan === opt 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${allocationForm.in_plan === opt ? 'bg-emerald-600' : 'bg-slate-300'}`}></span>
                        <span>{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes / Order Reference */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">บันทึกหมายเหตุ / คำสั่งจัดสรรงบประมาณ</label>
                  <textarea
                    rows={2}
                    value={allocationForm.notes}
                    onChange={e => setAllocationForm({ ...allocationForm, notes: e.target.value })}
                    placeholder="เช่น ตามมติที่ประชุมจัดสรรงบประมาณ พ.ศ. 2568 หรือ อนุมัติจัดสรรงบเต็มจำนวน..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setAllocatingProject(null)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    id="save-allocation-submit-btn"
                    type="submit"
                    disabled={isSubmittingAllocation}
                    className="px-6 py-2.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl transition-all shadow-lg shadow-emerald-700/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingAllocation ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>กำลังบันทึกยอดจัดสรร...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>บันทึกงบประมาณที่ได้รับจัดสรร</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick View Drawer / Modal */}
      <AnimatePresence>
        {viewingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
            >
              <div className="bg-slate-900 text-white p-6 flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-mono text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full">
                    {viewingProject.project_code || `ID: ${viewingProject.id}`}
                  </span>
                  <h3 className="font-bold text-lg text-white mt-2 leading-snug">{viewingProject.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{viewingProject.department || 'ไม่ระบุแผนก'}</p>
                </div>
                <button
                  onClick={() => setViewingProject(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                {/* Financial Summary Box */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 block mb-0.5">งบประมาณเสนอตามแผน</span>
                    <span className="font-bold text-base text-slate-800">
                      ฿{(viewingProject.budget_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-emerald-700 mb-0.5 font-bold">
                      <Coins size={12} />
                      <span>งบที่ได้รับจัดสรร (งานแผนฯ)</span>
                    </div>
                    <span className="font-bold text-base text-emerald-700">
                      ฿{(viewingProject.allocated_budget || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">แหล่งงบประมาณ</span>
                    <span className="font-bold text-blue-700">{viewingProject.budget_source || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">หมวดค่าใช้จ่าย</span>
                    <span className="font-bold text-purple-700">{viewingProject.expense_category || '-'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-900">
                  <span className="font-semibold">สถานะขั้นตอนปัจจุบัน:</span>
                  <span className="font-bold">
                    กระบวนการ {viewingProject.current_process || 'A'} - ขั้นที่ {viewingProject.current_step || 1}
                  </span>
                </div>

                {viewingProject.necessity_reason && (
                  <div>
                    <span className="text-slate-400 font-bold block mb-1">เหตุผลความจำเป็น:</span>
                    <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                      {viewingProject.necessity_reason}
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2">
                  {canManageProjects && (
                    <button
                      onClick={() => {
                        const target = viewingProject;
                        setViewingProject(null);
                        handleOpenAllocateModal(target);
                      }}
                      className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-2 rounded-xl transition-colors text-xs"
                      title="งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ กำหนด/แก้ไขงบประมาณที่ได้รับจัดสรร"
                    >
                      <Coins size={14} />
                      <span>กำหนด/แก้ไขงบจัดสรร</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setViewingProject(null);
                      onSelectProject(viewingProject);
                    }}
                    className="flex items-center gap-1.5 bg-red-700 text-white font-bold px-4 py-2 rounded-xl hover:bg-red-800 transition-colors shadow-md shadow-red-700/10 ml-auto"
                  >
                    <span>เปิดหน้ารายละเอียดเต็ม</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Batch Action Bar */}
      <AnimatePresence>
        {selectedBatchIds.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 max-w-xl w-[90%] sm:w-auto"
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs sm:text-sm font-bold">
                เลือกแล้ว <span className="font-mono text-rose-300 text-sm">{selectedBatchIds.length}</span> โครงการ
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(true)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-900/50 flex items-center gap-1.5 active:scale-95"
              >
                <Layers size={15} />
                <span>กำหนดกระบวนการพร้อมกัน</span>
              </button>
              {canManageProjects && (
                <button
                  type="button"
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-900/50 flex items-center gap-1.5 active:scale-95"
                >
                  <Trash2 size={15} />
                  <span>ลบที่เลือก ({selectedBatchIds.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedBatchIds([])}
                className="px-3 py-2 bg-white/10 hover:bg-white/20 text-slate-300 text-xs rounded-xl transition-colors"
                title="ยกเลิกการเลือก"
              >
                ล้าง
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Operations Full Modal */}
      <AnimatePresence>
        {isBatchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-50 rounded-3xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto relative my-4"
            >
              <BatchProcessOperations
                currentUser={currentUser}
                userRole={userRole}
                projects={projects}
                initialSelectedIds={selectedBatchIds}
                onRefreshProjects={async () => {
                  await onRefreshProjects();
                  setSelectedBatchIds([]);
                  setIsBatchModalOpen(false);
                }}
                onSelectProject={onSelectProject}
                onCloseModal={() => setIsBatchModalOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Single Project Delete In-App Confirmation Modal */}
      <AnimatePresence>
        {projectToDelete && (
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
                คุณกำลังจะลบโครงการ <strong className="text-slate-800">&quot;{projectToDelete.title}&quot;</strong> ออกจากฐานข้อมูล การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-5 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">รหัสโครงการ:</span>
                  <span className="font-bold text-slate-700">{projectToDelete.project_code || `ID: ${projectToDelete.id}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">แผนก/ฝ่าย:</span>
                  <span className="font-bold text-slate-700">{projectToDelete.department || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">วงเงินงบประมาณ:</span>
                  <span className="font-bold text-red-600">฿{Number(projectToDelete.budget_amount || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setProjectToDelete(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDeleteProject}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>กำลังลบ...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>ยืนยันลบโครงการ</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Delete In-App Confirmation Modal */}
      <AnimatePresence>
        {showBatchDeleteConfirm && (
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
                คุณได้เลือกโครงการจำนวน <strong className="text-red-600 font-bold">{selectedBatchIds.length}</strong> โครงการเพื่อลบออกจากระบบ การดำเนินการนี้จะลบรายการสินค้าและประวัติทั้งหมดที่เกี่ยวข้อง และไม่สามารถย้อนกลับได้
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isBatchDeleting}
                  onClick={() => setShowBatchDeleteConfirm(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={isBatchDeleting}
                  onClick={handleBatchDelete}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isBatchDeleting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>กำลังลบ {selectedBatchIds.length} รายการ...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      <span>ยืนยันลบ {selectedBatchIds.length} โครงการ</span>
                    </>
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
