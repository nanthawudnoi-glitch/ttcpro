import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckSquare,
  Square,
  Search,
  Filter,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  RefreshCw,
  FolderKanban,
  FileText,
  User,
  ShieldCheck,
  Building,
  Coins,
  Send,
  X,
  ChevronRight,
  Calendar,
  Check,
  Tag,
  Zap,
  ListFilter,
  Plus
} from 'lucide-react';
import { Project, PROCESS_STEPS, FiscalYear } from '../types';
import { safeParseJson } from '../utils';

interface BatchProcessOperationsProps {
  currentUser: any;
  userRole: string;
  projects: Project[];
  onRefreshProjects: () => void;
  onSelectProject?: (project: Project) => void;
  initialSelectedIds?: number[];
  onCloseModal?: () => void;
}

interface StepPreset {
  id: string;
  roleGroup: string;
  title: string;
  description: string;
  targetProcess: 'A' | 'B' | 'C' | 'D' | 'E';
  targetStep: number;
  iconColor: string;
  recommendedFor: string[];
}

export const BatchProcessOperations: React.FC<BatchProcessOperationsProps> = ({
  currentUser,
  userRole,
  projects,
  onRefreshProjects,
  onSelectProject,
  initialSelectedIds = [],
  onCloseModal
}) => {
  // Selection State
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>(initialSelectedIds);
  const [codeInputValue, setCodeInputValue] = useState<string>('');
  const [codeError, setCodeError] = useState<string | null>(null);

  // Target Process & Step State
  const [targetProcess, setTargetProcess] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('B');
  const [targetStep, setTargetStep] = useState<number>(1);
  const [customActor, setCustomActor] = useState<string>(currentUser?.name || 'เจ้าหน้าที่ผู้ปฏิบัติงาน');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');

  // UI Filters State
  const [activeTab, setActiveTab] = useState<'list' | 'codes'>('list');
  const [searchFilter, setSearchFilter] = useState('');
  const [filterProcess, setFilterProcess] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterFiscalYear, setFilterFiscalYear] = useState<string>('all');
  const [onlyMyDepartmentProjects, setOnlyMyDepartmentProjects] = useState<boolean>(false);

  // Submission & Feedback State
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Sync initial ids if passed
  useEffect(() => {
    if (initialSelectedIds.length > 0) {
      setSelectedProjectIds(initialSelectedIds);
    }
  }, [initialSelectedIds]);

  // Determine user's primary process according to role
  useEffect(() => {
    if (userRole === 'PROCUREMENT_STAFF' || userRole === 'PROCUREMENT_HEAD') {
      setTargetProcess('B');
      setTargetStep(1);
    } else if (userRole === 'FINANCE_STAFF' || userRole === 'FINANCE_HEAD') {
      setTargetProcess('C');
      setTargetStep(1);
    } else if (userRole === 'PLANNING_STAFF' || userRole === 'PLANNING_HEAD') {
      setTargetProcess('A');
      setTargetStep(5);
    }
  }, [userRole]);

  // Role presets
  const presets: StepPreset[] = useMemo(() => [
    // งานพัสดุ
    {
      id: 'p-b1',
      roleGroup: 'งานพัสดุ',
      title: 'รับเอกสารลงทะเบียนพัสดุ (B1)',
      description: 'เจ้าหน้าที่งานพัสดุ รับเอกสารลงทะเบียนเข้าสู่กระบวนการจัดซื้อจัดจ้าง',
      targetProcess: 'B',
      targetStep: 1,
      iconColor: 'bg-blue-500',
      recommendedFor: ['ADMIN', 'PROCUREMENT_STAFF', 'PROCUREMENT_HEAD']
    },
    {
      id: 'p-b5',
      roleGroup: 'งานพัสดุ',
      title: 'ส่งใบสั่งซื้อ/สัญญาไปร้านค้า',
      description: 'ผ่านการอนุมัติแล้ว และส่งเอกสารใบสั่งซื้อ/สั่งจ้าง/สัญญาให้ร้านค้า',
      targetProcess: 'B',
      targetStep: 5,
      iconColor: 'bg-indigo-500',
      recommendedFor: ['ADMIN', 'PROCUREMENT_STAFF', 'PROCUREMENT_HEAD']
    },
    {
      id: 'p-b8',
      roleGroup: 'งานพัสดุ',
      title: 'จัดพิมพ์ใบตรวจรับพัสดุ (B08)',
      description: 'ร้านค้าส่งของเรียบร้อย พัสดุจัดพิมพ์เอกสารใบตรวจรับและแจ้งกรรมการ',
      targetProcess: 'B',
      targetStep: 9,
      iconColor: 'bg-cyan-500',
      recommendedFor: ['ADMIN', 'PROCUREMENT_STAFF', 'PROCUREMENT_HEAD']
    },
    {
      id: 'p-b13',
      roleGroup: 'งานพัสดุ',
      title: 'ตรวจรับเรียบร้อย & ส่งเอกสารเบิก (B2)',
      description: 'กรรมการตรวจรับพัสดุเรียบร้อย จัดทำเอกสารชุดเบิกเงินและส่งต่องานวางแผน',
      targetProcess: 'B',
      targetStep: 13,
      iconColor: 'bg-emerald-500',
      recommendedFor: ['ADMIN', 'PROCUREMENT_STAFF', 'PROCUREMENT_HEAD']
    },
    {
      id: 'p-d2',
      roleGroup: 'งานพัสดุ',
      title: 'จัดทำคำสั่งพัสดุชั่วคราว (เงินยืม D01)',
      description: 'งานพัสดุรับเรื่องโครงการเงินยืม และจัดทำคำสั่งแต่งตั้งเจ้าหน้าที่พัสดุชั่วคราว',
      targetProcess: 'D',
      targetStep: 2,
      iconColor: 'bg-amber-500',
      recommendedFor: ['ADMIN', 'PROCUREMENT_STAFF', 'PROCUREMENT_HEAD']
    },

    // งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ
    {
      id: 'pl-a5',
      roleGroup: 'งานวางแผนและงบประมาณ',
      title: 'รับเอกสารลงทะเบียนวางแผน (A1)',
      description: 'เจ้าหน้าที่งานวางแผน รับเอกสารขอความขอซื้อขอจ้างและลงทะเบียน A1',
      targetProcess: 'A',
      targetStep: 5,
      iconColor: 'bg-rose-500',
      recommendedFor: ['ADMIN', 'PLANNING_STAFF', 'PLANNING_HEAD', 'DEPUTY_DIRECTOR_PLANNING']
    },
    {
      id: 'pl-a6',
      roleGroup: 'งานวางแผนและงบประมาณ',
      title: 'ตรวจสอบยอดเงิน & ตัดยอดงบประมาณ',
      description: 'งานวางแผนตรวจสอบความถูกต้องของยอดเงิน และบันทึกตัดยอดงบประมาณ',
      targetProcess: 'A',
      targetStep: 6,
      iconColor: 'bg-red-500',
      recommendedFor: ['ADMIN', 'PLANNING_STAFF', 'PLANNING_HEAD']
    },
    {
      id: 'pl-a11',
      roleGroup: 'งานวางแผนและงบประมาณ',
      title: 'ส่งเอกสารไปงานพัสดุ (พร้อมเริ่ม B)',
      description: 'โครงการผ่านความเห็นชอบครบถ้วน ส่งมอบเอกสารให้งานพัสดุดำเนินการจัดซื้อ',
      targetProcess: 'A',
      targetStep: 11,
      iconColor: 'bg-orange-500',
      recommendedFor: ['ADMIN', 'PLANNING_STAFF', 'PLANNING_HEAD']
    },
    {
      id: 'pl-b16',
      roleGroup: 'งานวางแผนและงบประมาณ',
      title: 'งานวางแผนตรวจสอบตัดยอด & ส่งการเงิน',
      description: 'ตรวจสอบชุดเบิกจากพัสดุ ตัดยอดเงินขั้นสุดท้าย และส่งต่อไปยังงานการเงิน',
      targetProcess: 'B',
      targetStep: 16,
      iconColor: 'bg-purple-500',
      recommendedFor: ['ADMIN', 'PLANNING_STAFF', 'PLANNING_HEAD']
    },
    {
      id: 'pl-e5',
      roleGroup: 'งานวางแผนและงบประมาณ',
      title: 'รับเอกสารค่าใช้จ่ายอื่น & ตรวจตัดยอด (E5-E6)',
      description: 'งานวางแผนรับเอกสารค่าใช้จ่ายอื่น ตรวจสอบยอดเงินและตัดยอด',
      targetProcess: 'E',
      targetStep: 6,
      iconColor: 'bg-pink-500',
      recommendedFor: ['ADMIN', 'PLANNING_STAFF', 'PLANNING_HEAD']
    },

    // งานการเงิน
    {
      id: 'fn-c1',
      roleGroup: 'งานการเงิน',
      title: 'รับเอกสารชุดเบิก & จัดทำบันทึกเบิก (C01/C02)',
      description: 'งานการเงินรับเอกสารชุดเบิกจากงานวางแผน และจัดทำบันทึกข้อความขออนุมัติเบิกจ่าย',
      targetProcess: 'C',
      targetStep: 2,
      iconColor: 'bg-emerald-600',
      recommendedFor: ['ADMIN', 'FINANCE_STAFF', 'FINANCE_HEAD']
    },
    {
      id: 'fn-c5',
      roleGroup: 'งานการเงิน',
      title: 'วางเบิกจ่าย (GFMIS / KTB)',
      description: 'ผ่านการอนุมัติแล้ว งานการเงินดำเนินการวางเบิกจ่ายผ่านระบบการเงินภาครัฐ',
      targetProcess: 'C',
      targetStep: 5,
      iconColor: 'bg-teal-600',
      recommendedFor: ['ADMIN', 'FINANCE_STAFF', 'FINANCE_HEAD']
    },
    {
      id: 'fn-c7',
      roleGroup: 'งานการเงิน',
      title: 'โอนเงินสำเร็จ & ปิดกระบวนการเบิกจ่าย',
      description: 'เงินโอนเข้าบัญชีร้านค้าเรียบร้อย ร้านค้าออกใบเสร็จรับเงิน สิ้นสุดโครงการ',
      targetProcess: 'C',
      targetStep: 7,
      iconColor: 'bg-green-600',
      recommendedFor: ['ADMIN', 'FINANCE_STAFF', 'FINANCE_HEAD']
    },
    {
      id: 'fn-d12',
      roleGroup: 'งานการเงิน',
      title: 'จ่ายเงินยืมทดลองราชการ (D12)',
      description: 'งานการเงินจ่ายเงินยืมให้ผู้เสนอโครงการเรียบร้อย',
      targetProcess: 'D',
      targetStep: 12,
      iconColor: 'bg-amber-600',
      recommendedFor: ['ADMIN', 'FINANCE_STAFF', 'FINANCE_HEAD']
    },
    {
      id: 'fn-d26',
      roleGroup: 'งานการเงิน',
      title: 'ล้างเงินยืม & วางเบิกเสร็จสิ้น (D26)',
      description: 'โอนเงินบัญชีเงินรายได้และจบกระบวนการยืมเงินทดลองราชการ',
      targetProcess: 'D',
      targetStep: 26,
      iconColor: 'bg-emerald-700',
      recommendedFor: ['ADMIN', 'FINANCE_STAFF', 'FINANCE_HEAD']
    },
    {
      id: 'fn-e11',
      roleGroup: 'งานการเงิน',
      title: 'จ่ายเงินค่าใช้จ่ายอื่นเสร็จสิ้น (E11)',
      description: 'งานการเงินจ่ายเงินค่าใช้จ่ายอื่นเรียบร้อย เสร็จสิ้นกระบวนการ E',
      targetProcess: 'E',
      targetStep: 11,
      iconColor: 'bg-slate-700',
      recommendedFor: ['ADMIN', 'FINANCE_STAFF', 'FINANCE_HEAD']
    }
  ], []);

  // Filtered Presets based on user role
  const recommendedPresets = useMemo(() => {
    return presets.filter(p => p.recommendedFor.includes(userRole));
  }, [presets, userRole]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.department) set.add(p.department);
    });
    return Array.from(set).sort();
  }, [projects]);

  // Unique fiscal years for filter
  const fiscalYears = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.fiscal_year) set.add(p.fiscal_year);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [projects]);

  // Filtered projects list
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const q = searchFilter.toLowerCase().trim();
      const matchSearch = !q || 
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.project_code && p.project_code.toLowerCase().includes(q)) ||
        p.id.toString() === q ||
        (p.department && p.department.toLowerCase().includes(q));

      const matchProcess = filterProcess === 'all' || p.current_process === filterProcess;
      const matchDept = filterDepartment === 'all' || p.department === filterDepartment;
      const matchFY = filterFiscalYear === 'all' || (p.fiscal_year || '2568') === filterFiscalYear;

      return matchSearch && matchProcess && matchDept && matchFY;
    });
  }, [projects, searchFilter, filterProcess, filterDepartment, filterFiscalYear]);

  // Selected projects objects
  const selectedProjects = useMemo(() => {
    return projects.filter(p => selectedProjectIds.includes(p.id));
  }, [projects, selectedProjectIds]);

  // Handle Code Input parsing (supports multiple codes: commas, spaces, newlines)
  const handleParseAndAddCodes = () => {
    if (!codeInputValue.trim()) return;
    const rawTokens = codeInputValue
      .split(/[\n,;\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const matchedIds: number[] = [];
    const notFoundCodes: string[] = [];

    rawTokens.forEach(token => {
      const cleanToken = token.toUpperCase();
      const found = projects.find(p => 
        (p.project_code && p.project_code.toUpperCase() === cleanToken) ||
        p.id.toString() === cleanToken
      );
      if (found) {
        matchedIds.push(found.id);
      } else {
        notFoundCodes.push(token);
      }
    });

    if (matchedIds.length > 0) {
      setSelectedProjectIds(prev => Array.from(new Set([...prev, ...matchedIds])));
    }

    if (notFoundCodes.length > 0) {
      setCodeError(`ไม่พบรหัสโครงการ: ${notFoundCodes.join(', ')}`);
    } else {
      setCodeError(null);
      setCodeInputValue('');
    }
  };

  // Toggle selection
  const toggleSelectProject = (id: number) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Select all filtered
  const selectAllFiltered = () => {
    const ids = filteredProjects.map(p => p.id);
    setSelectedProjectIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedProjectIds([]);
  };

  // Quick select projects by current process (e.g., all projects in Process B for procurement)
  const selectAllInProcess = (proc: 'A' | 'B' | 'C' | 'D' | 'E') => {
    const ids = projects.filter(p => p.current_process === proc && p.status !== 'completed').map(p => p.id);
    setSelectedProjectIds(prev => Array.from(new Set([...prev, ...ids])));
  };

  // Apply a preset
  const applyPreset = (preset: StepPreset) => {
    setTargetProcess(preset.targetProcess);
    setTargetStep(preset.targetStep);
    setCustomNotes(`ดำเนินการตามขั้นตอน: ${preset.title} (${preset.targetProcess} ขั้นที่ ${preset.targetStep})`);
  };

  // Execute Batch Update
  const handleExecuteBatch = async () => {
    if (selectedProjectIds.length === 0) {
      setErrorMessage('กรุณาเลือกอย่างน้อย 1 โครงการ');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/projects/batch-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_ids: selectedProjectIds,
          process: targetProcess,
          step: targetStep,
          actor: customActor,
          notes: customNotes || `กำหนดกระบวนการแบบกลุ่มไปยัง ${targetProcess} ขั้นตอนที่ ${targetStep}`,
          shop_name: shopName || null
        })
      });

      const data = await safeParseJson(res);
      if (!res.ok) {
        throw new Error(data?.error || 'เกิดข้อผิดพลาดในการอัปเดตกระบวนการ');
      }

      setSuccessMessage(data.message || `อัปเดต ${selectedProjectIds.length} โครงการเรียบร้อยแล้ว`);
      setConfirmModalOpen(false);
      onRefreshProjects();
      setSelectedProjectIds([]);
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSubmitting(false);
    }
  };

  const getProcessName = (p: string) => {
    switch (p) {
      case 'A': return 'A: ขอซื้อขอจ้าง/ขออนุมัติโครงการ';
      case 'B': return 'B: จัดซื้อจัดจ้าง';
      case 'C': return 'C: เบิกจ่ายเงิน';
      case 'D': return 'D: เงินยืมทดลองราชการ';
      case 'E': return 'E: รายการค่าใช้จ่ายอื่น';
      default: return p;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-emerald-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-700"
          >
            <CheckCircle2 size={20} className="text-emerald-300" />
            <span className="text-sm font-semibold">{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="ml-2 text-white/70 hover:text-white">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-800 via-rose-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-rose-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Zap size={16} className="text-amber-400" />
              <span>ศูนย์ดำเนินการด่วนตามหน้าที่รับผิดชอบ (Role Operations)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <span>กำหนดกระบวนการพร้อมกันหลายโครงการ</span>
              <span className="px-3 py-1 text-xs font-mono font-bold bg-white/20 rounded-full border border-white/20">
                Batch Mode
              </span>
            </h1>
            <p className="text-rose-100/80 text-sm mt-1 max-w-2xl leading-relaxed">
              เพิ่มความสะดวกและรวดเร็วสำหรับผู้ปฏิบัติงาน (พัสดุ / วางแผน / การเงิน / ผู้บริหาร) 
              สามารถเลือกระบุรหัสโครงการ และกำหนดเปลี่ยนกระบวนการครั้งละหลายโครงการในขั้นตอนเดียวกันได้ในคลิกเดียว
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            <div className="bg-white/10 border border-white/15 px-4 py-2.5 rounded-2xl text-xs font-medium backdrop-blur-sm">
              <span className="text-rose-200">ผู้ปฏิบัติงาน: </span>
              <span className="font-bold text-white">{currentUser?.name || 'ผู้ปฏิบัติงาน'}</span>
              <span className="text-rose-200 block text-[11px] mt-0.5">{currentUser?.position || userRole}</span>
            </div>
            {onCloseModal && (
              <button
                onClick={onCloseModal}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-colors border border-white/15"
                title="ปิดหน้านี้"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Selection (Left 60%) & Target Step Config (Right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Project Selection */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Quick Selection Toolbar */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <CheckSquare size={18} className="text-rose-600" />
                  ขั้นตอนที่ 1: เลือกโครงการที่ต้องการดำเนินการ
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 font-mono">
                  {selectedProjectIds.length} โครงการ
                </span>
              </div>

              {/* Mode switch */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    activeTab === 'list' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  เลือกจากตาราง
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('codes')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                    activeTab === 'codes' 
                      ? 'bg-white text-slate-900 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Tag size={12} />
                  กรอกรหัสโครงการ
                </button>
              </div>
            </div>

            {/* TAB 1: Search & Filter in Table */}
            {activeTab === 'list' && (
              <div className="space-y-3">
                {/* Search Bar & Quick Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2 relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อโครงการ, รหัส, หรือแผนก..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>
                  <div>
                    <select
                      value={filterProcess}
                      onChange={(e) => setFilterProcess(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                    >
                      <option value="all">ทุกกระบวนการ (A-E)</option>
                      <option value="A">กระบวนการ A (ขอซื้อขอจ้าง)</option>
                      <option value="B">กระบวนการ B (จัดซื้อจัดจ้าง)</option>
                      <option value="C">กระบวนการ C (เบิกจ่ายเงิน)</option>
                      <option value="D">กระบวนการ D (เงินยืม)</option>
                      <option value="E">กระบวนการ E (ค่าใช้จ่ายอื่น)</option>
                    </select>
                  </div>
                </div>

                {/* Quick Selection Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-400 font-medium text-[11px]">เลือกด่วน:</span>
                    <button
                      type="button"
                      onClick={() => selectAllInProcess('B')}
                      className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-bold transition-colors"
                    >
                      พัสดุทั้งหมด (B)
                    </button>
                    <button
                      type="button"
                      onClick={() => selectAllInProcess('A')}
                      className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[11px] font-bold transition-colors"
                    >
                      วางแผนทั้งหมด (A)
                    </button>
                    <button
                      type="button"
                      onClick={() => selectAllInProcess('C')}
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[11px] font-bold transition-colors"
                    >
                      การเงินทั้งหมด (C)
                    </button>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={selectAllFiltered}
                      className="text-rose-700 hover:underline font-bold text-[11px]"
                    >
                      เลือกที่แสดงทั้งหมด ({filteredProjects.length})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-slate-400 hover:text-slate-600 font-medium text-[11px]"
                    >
                      ล้างที่เลือก
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Multiple Project Code Input */}
            {activeTab === 'codes' && (
              <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    วางหรือพิมพ์รหัสโครงการ (Project Codes)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    แยกด้วยเครื่องหมายจุลภาค (,), เคาะวรรค หรือขึ้นบรรทัดใหม่
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={codeInputValue}
                  onChange={(e) => setCodeInputValue(e.target.value)}
                  placeholder="เช่น PRJ-68-001, PRJ-68-002, PRJ-68-003 หรือใส่ ID เช่น 1 2 4"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-rose-500 outline-none"
                />
                {codeError && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle size={13} />
                    {codeError}
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleParseAndAddCodes}
                    className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    เพิ่มโครงการจากรหัส
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Project List View (Table with Checkboxes) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="max-h-[460px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200/70 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (filteredProjects.length === 0) return;
                          const allSelected = filteredProjects.every(p => selectedProjectIds.includes(p.id));
                          if (allSelected) {
                            setSelectedProjectIds(prev => prev.filter(id => !filteredProjects.some(fp => fp.id === id)));
                          } else {
                            selectAllFiltered();
                          }
                        }}
                        className="text-slate-500 hover:text-rose-700"
                        title="เลือกทั้งหมด"
                      >
                        {filteredProjects.length > 0 && filteredProjects.every(p => selectedProjectIds.includes(p.id)) ? (
                          <CheckSquare size={17} className="text-rose-600" />
                        ) : (
                          <Square size={17} />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3">รหัสโครงการ / ชื่อโครงการ</th>
                    <th className="px-3 py-3">แผนก/งาน</th>
                    <th className="px-3 py-3 text-center">กระบวนการปัจจุบัน</th>
                    <th className="px-4 py-3 text-right">งบประมาณ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        <FolderKanban className="mx-auto mb-2 opacity-40" size={28} />
                        <p className="font-semibold">ไม่พบโครงการตามเงื่อนไขที่ค้นหา</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => {
                      const isSelected = selectedProjectIds.includes(project.id);
                      return (
                        <tr
                          key={project.id}
                          onClick={() => toggleSelectProject(project.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => toggleSelectProject(project.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare size={18} className="text-rose-600" />
                              ) : (
                                <Square size={18} />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-slate-800">
                                {project.project_code || `#${project.id}`}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                                ปี {project.fiscal_year || '2568'}
                              </span>
                            </div>
                            <div className="font-medium text-slate-900 mt-0.5 line-clamp-1">
                              {project.title}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-500 truncate max-w-[130px]">
                            {project.department || '-'}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-slate-100 text-slate-700">
                              <span>{project.current_process}</span>
                              <span className="text-slate-400">ขั้น {project.current_step}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-800">
                            ฿{(project.budget_amount || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Selected Projects Chips */}
          {selectedProjects.length > 0 && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">
                  โครงการที่เลือก ({selectedProjects.length} รายการ):
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-slate-400 hover:text-rose-600"
                >
                  ล้างทั้งหมด
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedProjects.map(p => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200"
                  >
                    <span className="font-mono font-bold">{p.project_code || `#${p.id}`}</span>
                    <span className="text-[11px] truncate max-w-[140px] text-slate-600">{p.title}</span>
                    <button
                      type="button"
                      onClick={() => toggleSelectProject(p.id)}
                      className="text-rose-400 hover:text-rose-700"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Target Process & Step Configuration */}
        <div className="lg:col-span-5 space-y-6">

          {/* Role Presets Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                ทางลัดตามหน้าที่รับผิดชอบ (Role Presets)
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">คลิกเพื่อเลือกทันที</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {recommendedPresets.length > 0 ? (
                recommendedPresets.map(preset => {
                  const isSelected = targetProcess === preset.targetProcess && targetStep === preset.targetStep;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50/70 shadow-xs ring-1 ring-rose-500'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-xl ${preset.iconColor} text-white shrink-0 flex items-center justify-center font-bold text-xs shadow-xs mt-0.5`}>
                        {preset.targetProcess}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {preset.title}
                          </p>
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            ขั้น {preset.targetStep}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 leading-snug">
                          {preset.description}
                        </p>
                      </div>
                      {isSelected && (
                        <Check size={16} className="text-rose-600 shrink-0 mt-1" />
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">
                  เลือกกระบวนการและขั้นตอนตามต้องการในแบบฟอร์มด้านล่าง
                </p>
              )}
            </div>
          </div>

          {/* Target Process & Step Form Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <Layers size={16} className="text-rose-600" />
              ขั้นตอนที่ 2: ระบุกระบวนการและขั้นตอนเป้าหมาย
            </h3>

            {/* Process Picker (A-E) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                กระบวนการ (Process) <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(['A', 'B', 'C', 'D', 'E'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setTargetProcess(p);
                      setTargetStep(1);
                    }}
                    className={`py-2.5 rounded-xl font-bold text-xs transition-all text-center border ${
                      targetProcess === p
                        ? 'bg-rose-700 text-white border-rose-700 shadow-md shadow-rose-100'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    กระบวนการ {p}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                {getProcessName(targetProcess)}
              </p>
            </div>

            {/* Step Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ขั้นตอนเป้าหมาย (Step) <span className="text-rose-500">*</span>
              </label>
              <select
                value={targetStep}
                onChange={(e) => setTargetStep(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500 outline-none"
              >
                {PROCESS_STEPS[targetProcess].map((desc, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    ขั้น {idx + 1}: {desc}
                  </option>
                ))}
              </select>
            </div>

            {/* Detail Preview */}
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">ขั้นตอนที่จะกำหนด: </span>
              <span className="font-semibold text-rose-800">
                กระบวนการ {targetProcess} ขั้นที่ {targetStep}: {PROCESS_STEPS[targetProcess][targetStep - 1] || ''}
              </span>
            </div>

            {/* Optional Shop Name (Visible if in Process B or C) */}
            {['B', 'C'].includes(targetProcess) && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อร้านค้า/คู่สัญญา (ถ้ามี)
                </label>
                <input
                  type="text"
                  placeholder="เช่น บริษัท สยามเทคโนโลยี จำกัด"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            )}

            {/* Actor & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ผู้ดำเนินการบันทึก
                </label>
                <input
                  type="text"
                  value={customActor}
                  onChange={(e) => setCustomActor(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  หมายเหตุการดำเนินงาน
                </label>
                <input
                  type="text"
                  placeholder="เช่น รับเรื่องลงทะเบียนพร้อมกัน"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Final Action Button */}
            <div className="pt-2">
              <button
                type="button"
                disabled={selectedProjectIds.length === 0 || submitting}
                onClick={() => setConfirmModalOpen(true)}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                  selectedProjectIds.length > 0 && !submitting
                    ? 'bg-rose-700 hover:bg-rose-800 text-white shadow-rose-200 hover:scale-[1.01]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Send size={16} />
                <span>ยืนยันดำเนินการ {selectedProjectIds.length} โครงการพร้อมกัน</span>
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2">
                ระบบจะอัปเดตกระบวนการและบันทึกประวัติการดำเนินงาน (Log) ให้กับทุกโครงการโดยอัตโนมัติ
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-left relative"
            >
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center font-bold">
                  <Layers size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    ยืนยันกำหนดกระบวนการพร้อมกัน
                  </h3>
                  <p className="text-xs text-slate-500">
                    ตรวจสอบรายละเอียดก่อนดำเนินการ
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">จำนวนโครงการ:</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {selectedProjectIds.length} โครงการ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">กระบวนการเป้าหมาย:</span>
                  <span className="font-bold text-rose-700">
                    กระบวนการ {targetProcess} (ขั้นที่ {targetStep})
                  </span>
                </div>
                <div className="border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500 block mb-1">ขั้นตอน:</span>
                  <span className="font-semibold text-slate-800 block">
                    {PROCESS_STEPS[targetProcess][targetStep - 1]}
                  </span>
                </div>
                {shopName && (
                  <div className="flex justify-between border-t border-slate-200/60 pt-2">
                    <span className="text-slate-500">ร้านค้า/คู่สัญญา:</span>
                    <span className="font-bold text-slate-900">{shopName}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500">ผู้ปฏิบัติงาน:</span>
                  <span className="font-medium text-slate-700">{customActor}</span>
                </div>
              </div>

              <div className="mt-4 max-h-36 overflow-y-auto space-y-1">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  รายชื่อโครงการ:
                </p>
                {selectedProjects.map((p, i) => (
                  <div key={p.id} className="text-xs flex items-center justify-between text-slate-600 bg-white p-1.5 rounded-lg border border-slate-100">
                    <span className="font-mono font-bold text-slate-800">
                      {p.project_code || `#${p.id}`}
                    </span>
                    <span className="truncate max-w-[240px] text-slate-600">
                      {p.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      (จาก {p.current_process}-{p.current_step})
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 justify-end mt-6 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleExecuteBatch}
                  className="px-6 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs transition-colors shadow-lg shadow-rose-100 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>กำลังประมวลผล...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>ยืนยันบันทึกข้อมูล</span>
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
