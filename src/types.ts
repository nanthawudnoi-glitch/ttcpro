export interface ProjectItem {
  id?: number;
  project_id?: number;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  shop_name?: string;
}

export interface Project {
  id: number;
  project_code?: string;
  fiscal_year?: string;
  title: string;
  department: string;
  budget_amount: number;
  budget_source: string;
  current_process: 'A' | 'B' | 'C' | 'D' | 'E';
  current_step: number;
  status: string;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  creator_position?: string;
  creator_id?: string;
  project_nature?: string;
  necessity_reason?: string;
  material_usage_date?: string;
  allocated_budget?: number;
  procured_amount?: number;
  request_amount?: number;
  remaining_budget?: number;
  in_plan?: string;
  expense_category?: string;
  dept_head_name?: string;
  dept_head_position?: string;
  deputy_name?: string;
  deputy_position?: string;
  committee_chairman?: string;
  committee_member1?: string;
  committee_member2?: string;
  is_loan?: boolean;
  borrower_name?: string;
  loan_expense_category?: string;
  is_other_expense?: boolean;
  voucher_no?: string;
  vat_amount?: number;
  expense_amount?: number;
  expense_notes?: string;
  logs?: ProjectLog[];
  items?: ProjectItem[];
  item_shops?: string;
  delivery_dates?: string;
}

export interface ProjectLog {
  id: number;
  project_id: number;
  process: string;
  step: number;
  action: string;
  actor: string;
  notes: string;
  timestamp: string;
}

export const PROCESS_STEPS = {
  A: [
    "จัดทำบันทึกขอความขอซื้อขอจ้าง (A01, A02)",
    "เสนอหัวหน้างาน/หัวหน้าแผนกวิชา เห็นชอบ",
    "เสนอรองฝ่ายที่สังกัด",
    "ส่งแบบที่งานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ",
    "เจ้าหน้าที่งานวางแผน รับเอกสารลงทะเบียน (A1)",
    "ตรวจสอบยอดเงิน ลงข้อมูลการตัดยอดเงิน",
    "เสนอหัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ เห็นชอบ",
    "เสนอรองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน เห็นชอบ",
    "เสนอรองผู้อำนวยการฝ่ายบริหารทรัพยากรเห็นชอบ",
    "เสนอ ผู้อำนวยการอนุมัติ",
    "ส่งเอกสารไปงานพัสดุ"
  ],
  B: [
    "เจ้าหน้าที่งานพัสดุ รับเอกสารลงทะเบียน (B1)",
    "เสนอ หัวหน้างานพัสดุ เห็นชอบ",
    "เสนอ รองผู้อำนวยการฝ่ายบริหารทรัพยากรเห็นชอบ",
    "เสนอ ผู้อำนวยการอนุมัติ",
    "ส่งเอกสารใบสั่งซื้อ/สั่งจ้าง/สัญญา ไปร้านค้า",
    "ร้านค้ารับเอกสาร",
    "ร้านค้าส่งพัสดุและใบส่งของ",
    "เจ้าหน้าที่งานพัสดุรับพัสดุและใบส่งของ",
    "จัดพิมพ์เอกสารใบตรวจรับ (B08)",
    "แจ้งกรรมการตรวจรับ",
    "กรรมการตรวจรับ ทำการตรวจรับ (B08)",
    "จัดทำเอกสารประกอบการเบิกเงิน",
    "ลงทะเบียนเอกสารส่งเบิกเงิน (B2)",
    "เสนอ หัวหน้างานพัสดุ เห็นชอบ",
    "ส่งงานวางแผน",
    "งานวางแผนตรวจสอบ/ตัดยอดเงิน",
    "ส่งงานการเงิน"
  ],
  C: [
    "รับเอกสารชุดเบิก",
    "จัดทำบันทึกขออนุมัติเบิกเงิน (C01, C02)",
    "เสนอรองผู้อำนวยการฝ่ายบริหารทรัพยากร เห็นชอบ",
    "เสนอ ผู้อำนวยการ อนุมัติ",
    "เบิกจ่าย (GFMIS / KTB Corporate Online)",
    "เงินโอนเข้าบัญชีร้านค้า",
    "ร้านค้าออกใบเสร็จรับเงิน"
  ],
  D: [
    "D1 งานพัสดุ รับเอกสาร ขอซื้อขอจ้าง",
    "D2 งานพัสดุ จัดทำคำสั่งพัสดุชั่วคราว (D01)",
    "D3 เสนอหัวหน้างานพัสดุลงนาม",
    "D4 เสนอรองผู้อำนวยการฝ่ายบริหารทรัพยากร",
    "D5 เสนอผู้อำนวยการ อนุมัติ",
    "D6 ผู้เสนอโครงการ จัดทำเอกสารยืมเงิน (D02)",
    "D7 ส่งเอกสารยืมเงิน (D02)งานการเงิน",
    "D8 งานการเงินรับเอกสาร ตรวจความถูกต้อง",
    "D9 เสนอหัวหน้างานการเงิน",
    "D10 เสนอรองผู้อำนวยการฝ่ายบริหารทรัพยากร",
    "D11 เสนอผู้อำนวยการ อนุมัติ",
    "D12 งานการเงินจ่ายเงินยืมทดลองราชการ",
    "D13 ผู้เสนอโครงการ ส่งเอกสารล้างเงินยืม",
    "D14 งานการเงินตรวจสอบเอกสาร",
    "D15 งานการเงิน จัดทำรายการล้างใบสำคัญ",
    "D16 เสนอ หัวหน้างานการเงิน",
    "D17 เสนอรองผู้อำนวยการฝ่ายบริหารทรัพยากร",
    "D18 เสนอ ผู้อำนวยการ อนุมัติ",
    "D19 งานการเงินจัดทำใบเบิกทำใบเบิก (D02)",
    "D20 เสนอรองผู้อำนวยการฝ่ายบริหารทรัพยากร",
    "D21 วางแผน ตรวจสอบยอดเงิน",
    "D22 เสนอรองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน",
    "D23 เสนอ ผู้อำนวยการ อนุมัติ",
    "D24 งานการเงินวางเบิกเงิน",
    "D25 โอนเงินบัญชีเงินรายได้",
    "D26 จบกระบวน"
  ],
  E: [
    "E1 จัดทำใบเบิกเงิน",
    "E2 เสนอหัวหน้างานการเงิน",
    "E3 เสนอรองผู้อำนวยการฝ่ายบริหารทรัพยากร",
    "E4 ส่งเอกสารไปงานวางแผน",
    "E5 งานพัฒนายุทธศาสตร์ รับเอกสาร พร้อมลงทะเบียน",
    "E6 ตรวจสอบยอดเงิน ลงข้อมูลการตัดยอดเงิน",
    "E7 เสนอหัวหน้างานพัฒนายุทธศาสตร์ แผนงานและงบประมาณ เห็นชอบ",
    "E8 เสนอรองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน เห็นชอบ",
    "E9 เสนอ ผู้อำนวยการอนุมัติ",
    "E10 วางเบิก",
    "E11 จ่ายเงิน (เสร็จสิ้นกระบวนการ)"
  ]
};

export interface BudgetAllocation {
  id: number;
  budget_source_id?: number;
  category_id?: number;
  installment_no: number;
  title: string;
  amount: number;
  allocation_date?: string;
  doc_ref?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
}

export interface BudgetSource {
  id: number;
  name: string;
  code?: string;
  fiscal_year?: string;
  total_budget: number;
  category?: string;
  description?: string;
  updated_at?: string;
  committed_amount?: number;
  disbursed_amount?: number;
  total_used?: number;
  remaining_budget?: number;
  used_percentage?: number;
  project_count?: number;
  allocations_count?: number;
  allocations?: BudgetAllocation[];
}

export interface DepartmentBudgetSummary {
  department: string;
  project_count: number;
  total_requested: number;
  total_disbursed: number;
  total_committed: number;
  completed_count: number;
  pending_count: number;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  code?: string;
  fiscal_year?: string;
  allocated_budget: number;
  description?: string;
  updated_at?: string;
  updated_by?: string;
  total_spent?: number;       // ยอดเงินที่ใช้ซื้อสินค้าในโครงการ (หักลบ)
  remaining_budget?: number;  // ยอดคงเหลือ (allocated_budget - total_spent)
  project_count?: number;     // จำนวนโครงการที่ใช้เงินในหมวดนี้
  item_count?: number;        // จำนวนรายการสินค้าที่ซื้อในหมวดนี้
  used_percentage?: number;   // สัดส่วนการใช้เงิน (%)
  allocations_count?: number;
  allocations?: BudgetAllocation[];
}

export interface CategoryPurchasedItem {
  id: number;
  project_id: number;
  project_title: string;
  project_code?: string;
  department?: string;
  description: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
  total_price: number;
  shop_name?: string;
}

export interface FiscalYear {
  id: number;
  year: string;
  name: string;
  is_current: boolean | number;
  status: 'active' | 'closed' | 'upcoming';
  start_date?: string;
  end_date?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  project_count?: number;
  budget_sources_count?: number;
  total_budget?: number;
  expense_categories_count?: number;
  committed_amount?: number;
  disbursed_amount?: number;
  total_used?: number;
  remaining_budget?: number;
  used_percentage?: number;
}

