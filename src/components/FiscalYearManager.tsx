import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  Lock,
  Edit2,
  Trash2,
  Star,
  AlertCircle,
  RefreshCw,
  Landmark,
  Coins,
  FolderKanban,
  X,
  ShieldCheck,
  ChevronRight,
  Info
} from 'lucide-react';
import { FiscalYear } from '../types';
import { safeParseJson } from '../utils';

interface FiscalYearManagerProps {
  currentUser: any;
  userRole: string;
  onFiscalYearChanged?: (currentYear: string) => void;
}

export const FiscalYearManager: React.FC<FiscalYearManagerProps> = ({
  currentUser,
  userRole,
  onFiscalYearChanged
}) => {
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FiscalYear | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [confirmSetCurrent, setConfirmSetCurrent] = useState<FiscalYear | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FiscalYear | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    year: '',
    name: '',
    is_current: false,
    status: 'active' as 'active' | 'closed' | 'upcoming',
    start_date: '',
    end_date: '',
    description: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = ['ADMIN', 'PLANNING_HEAD', 'PLANNING_STAFF', 'DEPUTY_DIRECTOR_PLANNING'].includes(userRole);

  const DEFAULT_FALLBACK_FISCAL_YEARS: FiscalYear[] = [
    { id: 1, year: '2568', name: 'ปีงบประมาณ พ.ศ. 2568', is_current: 1, status: 'active', start_date: '2024-10-01', end_date: '2025-09-30', description: 'ปีงบประมาณปัจจุบัน' },
    { id: 2, year: '2569', name: 'ปีงบประมาณ พ.ศ. 2569', is_current: 0, status: 'upcoming', start_date: '2025-10-01', end_date: '2026-09-30', description: 'ปีงบประมาณเตรียมการล่วงหน้า' }
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchFiscalYears = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fiscal-years');
      if (res.ok) {
        const data = await safeParseJson<FiscalYear[]>(res);
        if (data && Array.isArray(data) && data.length > 0) {
          setFiscalYears(data);
          try {
            localStorage.setItem('ttc_smartprocure_fiscal_years', JSON.stringify(data));
          } catch (e) {}
          const current = data.find(f => Boolean(f.is_current));
          if (current && onFiscalYearChanged) {
            onFiscalYearChanged(current.year);
          }
          return;
        }
      }
      // Fallback from localStorage
      const saved = localStorage.getItem('ttc_smartprocure_fiscal_years');
      const fallbackData = saved ? JSON.parse(saved) : DEFAULT_FALLBACK_FISCAL_YEARS;
      setFiscalYears(fallbackData);
      const current = fallbackData.find((f: any) => Boolean(f.is_current));
      if (current && onFiscalYearChanged) {
        onFiscalYearChanged(current.year);
      }
    } catch (err) {
      console.warn('fetchFiscalYears using fallback:', err);
      const saved = localStorage.getItem('ttc_smartprocure_fiscal_years');
      const fallbackData = saved ? JSON.parse(saved) : DEFAULT_FALLBACK_FISCAL_YEARS;
      setFiscalYears(fallbackData);
      const current = fallbackData.find((f: any) => Boolean(f.is_current));
      if (current && onFiscalYearChanged) {
        onFiscalYearChanged(current.year);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiscalYears();
  }, []);

  const openAddModal = () => {
    const nextYear = fiscalYears.length > 0 
      ? (Math.max(...fiscalYears.map(f => parseInt(f.year) || 2568)) + 1).toString()
      : (new Date().getFullYear() + 543).toString();

    setEditingItem(null);
    setFormData({
      year: nextYear,
      name: `ปีงบประมาณ พ.ศ. ${nextYear}`,
      is_current: false,
      status: 'active',
      start_date: `${parseInt(nextYear) - 544}-10-01`,
      end_date: `${parseInt(nextYear) - 543}-09-30`,
      description: ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: FiscalYear) => {
    setEditingItem(item);
    setFormData({
      year: item.year,
      name: item.name,
      is_current: Boolean(item.is_current),
      status: item.status || 'active',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      description: item.description || ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Helper to save locally when backend is unavailable or on static host
  const saveToLocalStorageFallback = () => {
    try {
      const targetId = editingItem ? editingItem.id : Date.now();
      const cleanYear = formData.year.trim();
      const updatedItem: FiscalYear = {
        id: targetId,
        year: cleanYear,
        name: formData.name.trim(),
        is_current: formData.is_current ? 1 : 0,
        status: formData.status,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
        description: formData.description || undefined
      };

      const updatedList = editingItem
        ? fiscalYears.map(f => f.id === editingItem.id ? updatedItem : (formData.is_current ? { ...f, is_current: 0 } : f))
        : [
            ...fiscalYears.map(f => formData.is_current ? { ...f, is_current: 0 } : f),
            updatedItem
          ];

      setFiscalYears(updatedList);
      try {
        localStorage.setItem('ttc_smartprocure_fiscal_years', JSON.stringify(updatedList));
      } catch (e) {}

      if (formData.is_current && onFiscalYearChanged) {
        onFiscalYearChanged(cleanYear);
      }

      setIsModalOpen(false);
      showToast(editingItem ? 'อัปเดตข้อมูลปีงบประมาณเรียบร้อยแล้ว' : 'เพิ่มปีงบประมาณใหม่เรียบร้อยแล้ว');
    } catch (e: any) {
      setFormError(e?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.year.trim()) {
      setFormError('กรุณาระบุปีงบประมาณ (พ.ศ.)');
      return;
    }
    if (!formData.name.trim()) {
      setFormError('กรุณาระบุชื่อปีงบประมาณ');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const url = editingItem ? `/api/fiscal-years/${editingItem.id}` : '/api/fiscal-years';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setIsModalOpen(false);
        showToast(editingItem ? 'อัปเดตข้อมูลปีงบประมาณเรียบร้อยแล้ว' : 'เพิ่มปีงบประมาณใหม่เรียบร้อยแล้ว');
        fetchFiscalYears();
        return;
      }

      // If backend returns 404 (e.g. Vercel static hosting) or network failure:
      if (res.status === 404 || !res.status) {
        saveToLocalStorageFallback();
        return;
      }

      const result = await safeParseJson(res);
      throw new Error(result?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } catch (err: any) {
      // If error is network or parser error, fallback to local storage
      saveToLocalStorageFallback();
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleSetCurrent = async (item: FiscalYear) => {
    try {
      const res = await fetch(`/api/fiscal-years/${item.id}/set-current`, {
        method: 'PATCH'
      });
      if (res.ok) {
        showToast(`กำหนด "ปีงบประมาณ ${item.year}" เป็นปีงบประมาณปัจจุบันเรียบร้อยแล้ว`);
        setConfirmSetCurrent(null);
        fetchFiscalYears();
        return;
      }
      updateCurrentLocally(item);
    } catch (err) {
      updateCurrentLocally(item);
    }
  };

  const updateCurrentLocally = (item: FiscalYear) => {
    const updatedList = fiscalYears.map(f => ({
      ...f,
      is_current: f.id === item.id ? 1 : 0
    }));
    setFiscalYears(updatedList);
    try {
      localStorage.setItem('ttc_smartprocure_fiscal_years', JSON.stringify(updatedList));
    } catch (e) {}
    if (onFiscalYearChanged) {
      onFiscalYearChanged(item.year);
    }
    showToast(`กำหนด "ปีงบประมาณ ${item.year}" เป็นปีงบประมาณปัจจุบันเรียบร้อยแล้ว`);
    setConfirmSetCurrent(null);
  };

  const handleDelete = async (item: FiscalYear) => {
    try {
      const res = await fetch(`/api/fiscal-years/${item.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`ลบปีงบประมาณ ${item.year} เรียบร้อยแล้ว`);
        setConfirmDelete(null);
        fetchFiscalYears();
        return;
      }
      deleteLocally(item);
    } catch (err) {
      deleteLocally(item);
    }
  };

  const deleteLocally = (item: FiscalYear) => {
    const updatedList = fiscalYears.filter(f => f.id !== item.id);
    setFiscalYears(updatedList);
    try {
      localStorage.setItem('ttc_smartprocure_fiscal_years', JSON.stringify(updatedList));
    } catch (e) {}
    showToast(`ลบปีงบประมาณ ${item.year} เรียบร้อยแล้ว`);
    setConfirmDelete(null);
  };

  const currentYearItem = fiscalYears.find(f => Boolean(f.is_current));

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700"
          >
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-sm font-semibold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-red-800 via-rose-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-rose-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Calendar size={15} />
              <span>การกำหนดและจัดการระบบงบประมาณ</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              กำหนดปีงบประมาณ
            </h1>
            <p className="text-rose-100/80 text-sm mt-1 max-w-2xl leading-relaxed">
              สิทธิ์สำหรับผู้ดูแลระบบ (ADMIN) และงานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ 
              ในการกำหนดปีงบประมาณปัจจุบัน กำหนดสถานะรอบงบประมาณ และเตรียมการจัดทำคำขอปีงบประมาณล่วงหน้า
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={fetchFiscalYears}
              disabled={loading}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl transition-all border border-white/15"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-5 py-3 bg-white text-rose-900 font-bold text-sm rounded-2xl shadow-lg hover:bg-rose-50 transition-all hover:scale-105"
              >
                <Plus size={18} />
                <span>เพิ่มปีงบประมาณใหม่</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Year */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">ปีงบประมาณปัจจุบัน</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-rose-700">
                พ.ศ. {currentYearItem?.year || '2568'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                <CheckCircle2 size={10} />
                ใช้งานหลัก
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">
              {currentYearItem?.name || 'ปีงบประมาณ พ.ศ. 2568'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center">
            <Calendar size={22} />
          </div>
        </div>

        {/* Card 2: Current Year Total Budget */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">งบประมาณรวมปี {currentYearItem?.year || '2568'}</p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              ฿{((currentYearItem?.total_budget || 0) / 1000000).toFixed(2)}M
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {Number(currentYearItem?.total_budget || 0).toLocaleString()} บาท
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center">
            <Coins size={22} />
          </div>
        </div>

        {/* Card 3: Sources & Categories Count */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">แหล่งงบ / หมวดรายจ่าย</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-blue-700">
                {currentYearItem?.budget_sources_count || 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">แหล่งงบ</span>
              <span className="text-sm font-bold text-slate-300">/</span>
              <span className="text-2xl font-black text-indigo-700">
                {currentYearItem?.expense_categories_count || 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">หมวด</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">ในรอบปีงบประมาณปัจจุบัน</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
            <Landmark size={22} />
          </div>
        </div>

        {/* Card 4: Total Fiscal Years in System */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">รอบปีงบประมาณทั้งหมด</p>
            <p className="text-2xl font-black text-slate-800 mt-1">
              {fiscalYears.length} ปี
            </p>
            <p className="text-xs text-slate-500 mt-1">
              เปิดให้สิทธิ์งานยุทธศาสตร์และ Admin จัดการ
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center">
            <FolderKanban size={22} />
          </div>
        </div>
      </div>

      {/* Permission Info Callout */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3">
        <ShieldCheck className="text-amber-600 shrink-0 mt-0.5" size={20} />
        <div className="text-xs text-amber-900 leading-relaxed">
          <p className="font-bold text-sm text-amber-950 mb-0.5">
            สิทธิ์การกำหนดปีงบประมาณ (Role Permission)
          </p>
          ผู้ใช้งานที่มีบทบาท <span className="font-semibold text-rose-700">ADMIN (ผู้ดูแลระบบ)</span> และ{' '}
          <span className="font-semibold text-rose-700">งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ (PLANNING_STAFF, PLANNING_HEAD)</span>{' '}
          สามารถเพิ่มปีงบประมาณใหม่, กำหนดปีงบประมาณปัจจุบันที่ใช้เป็นค่าเริ่มต้นในระบบ, เปลี่ยนสถานะรอบงบประมาณ (เปิด/ปิด), 
          และควบคุมการตัดยอดโครงการในแต่ละปีได้อย่างสมบูรณ์
        </div>
      </div>

      {/* Fiscal Years Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar size={20} className="text-rose-600" />
              รายการปีงบประมาณในระบบ
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              คลิกปุ่ม &quot;ตั้งเป็นปีปัจจุบัน&quot; เพื่อสลับปีงบประมาณที่ระบบใช้สร้างโครงการและสรุปรายงาน
            </p>
          </div>
          {canManage && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-rose-700 text-white text-xs font-bold rounded-xl hover:bg-rose-800 transition-colors shadow-sm"
            >
              <Plus size={15} />
              เพิ่มปีงบประมาณ
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
            <p className="text-sm">กำลังโหลดข้อมูลปีงบประมาณ...</p>
          </div>
        ) : fiscalYears.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Calendar className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm font-semibold">ยังไม่มีข้อมูลปีงบประมาณ</p>
            {canManage && (
              <button
                onClick={openAddModal}
                className="mt-3 px-4 py-2 bg-rose-700 text-white text-xs font-bold rounded-xl hover:bg-rose-800"
              >
                เพิ่มปีงบประมาณแรก
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200/70 text-slate-600 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">ปีงบประมาณ</th>
                  <th className="px-6 py-4">ชื่อทางการ</th>
                  <th className="px-6 py-4 text-center">สถานะ</th>
                  <th className="px-6 py-4">ช่วงเวลา</th>
                  <th className="px-6 py-4 text-right">งบประมาณรวม</th>
                  <th className="px-6 py-4 text-center">โครงการ</th>
                  <th className="px-6 py-4 text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fiscalYears.map((item) => {
                  const isCurrent = Boolean(item.is_current);
                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCurrent ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      {/* Year */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-black text-slate-900">
                            {item.year}
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-sm shadow-emerald-200">
                              <Star size={10} className="fill-white" />
                              ปีปัจจุบัน
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-800">
                          {item.name}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        {item.status === 'active' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                            <Clock size={12} />
                            เปิดใช้งาน
                          </span>
                        )}
                        {item.status === 'closed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                            <Lock size={12} />
                            ปิดรอบงบประมาณ
                          </span>
                        )}
                        {item.status === 'upcoming' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                            <Calendar size={12} />
                            เตรียมการล่วงหน้า
                          </span>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="px-6 py-4 text-xs text-slate-600 font-mono">
                        {item.start_date && item.end_date ? (
                          <div>
                            <span>{item.start_date}</span>
                            <span className="text-slate-400 mx-1">ถึง</span>
                            <span>{item.end_date}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Budget */}
                      <td className="px-6 py-4 text-right font-mono text-sm font-bold text-slate-800">
                        {item.total_budget && item.total_budget > 0 
                          ? `฿${Number(item.total_budget).toLocaleString()}`
                          : <span className="text-slate-400 font-normal">฿0</span>}
                      </td>

                      {/* Projects */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 font-mono">
                          {item.project_count || 0}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        {canManage ? (
                          <div className="flex items-center justify-center gap-2">
                            {!isCurrent ? (
                              <button
                                onClick={() => setConfirmSetCurrent(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200"
                                title="กำหนดเป็นปีงบประมาณปัจจุบัน"
                              >
                                <Star size={13} />
                                <span>ตั้งเป็นปีปัจจุบัน</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-emerald-700">
                                <CheckCircle2 size={14} />
                                <span>ใช้งานอยู่</span>
                              </span>
                            )}

                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="แก้ไขข้อมูลปีงบประมาณ"
                            >
                              <Edit2 size={15} />
                            </button>

                            {!isCurrent && (
                              <button
                                onClick={() => setConfirmDelete(item)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="ลบปีงบประมาณนี้"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Set Current */}
      <AnimatePresence>
        {confirmSetCurrent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center"
            >
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Star size={28} className="fill-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                ยืนยันตั้งเป็นปีงบประมาณปัจจุบัน
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                คุณต้องการตั้ง <span className="font-bold text-emerald-700">&quot;{confirmSetCurrent.name}&quot;</span> (พ.ศ. {confirmSetCurrent.year}) 
                เป็นปีงบประมาณเริ่มต้นของระบบหรือไม่?
              </p>
              <div className="flex gap-3 justify-center mt-6">
                <button
                  type="button"
                  onClick={() => setConfirmSetCurrent(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => handleSetCurrent(confirmSetCurrent)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                >
                  ยืนยันตั้งเป็นปีปัจจุบัน
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal: Delete */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center"
            >
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                ยืนยันการลบปีงบประมาณ
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                คุณแน่ใจหรือไม่ว่าต้องการลบ <span className="font-bold text-rose-700">&quot;{confirmDelete.name}&quot;</span>? 
                การดำเนินการนี้ไม่สามารถยกเลิกได้
              </p>
              <div className="flex gap-3 justify-center mt-6">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(confirmDelete)}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200"
                >
                  ยืนยันลบรายการ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative my-8"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                  <Calendar size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingItem ? 'แก้ไขปีงบประมาณ' : 'เพิ่มปีงบประมาณใหม่'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    กำหนดรายละเอียดปีงบประมาณและสถานะรอบการดำเนินงาน
                  </p>
                </div>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Fiscal Year (e.g. 2569) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ปีงบประมาณ (พ.ศ.) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น 2569"
                      value={formData.year}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setFormData({
                          ...formData,
                          year: val,
                          name: formData.name === '' || formData.name.startsWith('ปีงบประมาณ พ.ศ.') 
                            ? `ปีงบประมาณ พ.ศ. ${val}` 
                            : formData.name
                        });
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-mono font-bold"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      สถานะรอบงบประมาณ <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-semibold bg-white"
                    >
                      <option value="active">เปิดใช้งาน / กำลังดำเนินการ</option>
                      <option value="upcoming">เตรียมการล่วงหน้า</option>
                      <option value="closed">ปิดรอบงบประมาณแล้ว</option>
                    </select>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ชื่อปีงบประมาณทางการ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ปีงบประมาณ พ.ศ. 2569"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm"
                  />
                </div>

                {/* Is Current Checkbox */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <label htmlFor="is_current_toggle" className="text-xs font-bold text-slate-800 cursor-pointer">
                      กำหนดเป็นปีงบประมาณปัจจุบันของระบบ
                    </label>
                    <p className="text-[11px] text-slate-500">
                      ระบบจะใช้ปีนี้เป็นค่าเริ่มต้นในการสร้างโครงการและแสดงสรุปงบประมาณ
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="is_current_toggle"
                    checked={formData.is_current}
                    onChange={(e) => setFormData({ ...formData, is_current: e.target.checked })}
                    className="w-5 h-5 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      วันเริ่มต้นงบประมาณ
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">ปกติ 1 ต.ค.</span>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      วันสิ้นสุดงบประมาณ
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs font-mono"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">ปกติ 30 ก.ย.</span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    คำอธิบาย / หมายเหตุ
                  </label>
                  <textarea
                    rows={2}
                    placeholder="เช่น แผนงานและงบประมาณประจำปี พ.ศ. 2569"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-rose-700 text-white font-bold text-xs hover:bg-rose-800 transition-colors shadow-lg shadow-rose-100 flex items-center gap-2"
                  >
                    {formSubmitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <span>{editingItem ? 'บันทึกการแก้ไข' : 'บันทึกปีงบประมาณ'}</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
