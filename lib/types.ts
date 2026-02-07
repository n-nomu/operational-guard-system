// Core Types for THE SURVIVAL MANAGER

export type Currency = 'JPY' | 'USD' | 'GBP' | 'EUR';

export type SkillType = '新人研修' | 'ホール' | 'キッチン' | 'レジ' | '店長代理';

export interface StaffMember {
  id: string;
  name: string;
  pin: string;
  baseWage: number;
  currency: Currency;
  skills: SkillType[];
  createdAt: string;
}

export type ShiftStatus = 'pending' | 'confirmed' | 'modified';

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  hours: number;
  breakMinutes?: number; // Break time in minutes (admin only)
  actualHours?: number; // Actual working hours (total - break)
  cost: number;
  status: ShiftStatus;
  isPublished: boolean;
}

export interface HolidayRequest {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface Announcement {
  id: string;
  message: string;
  createdAt: string;
  deadline?: string; // ISO datetime for submission deadlines
}

export interface TimeSpecificWageAdjustment {
  id: string;
  startTime: string; // e.g., "18:00"
  endTime: string;   // e.g., "22:00"
  adjustment: number; // e.g., +200 or -100 (per hour adjustment)
  enabled: boolean;
}

export interface BudgetConfig {
  weeklyRevenue: number;
  monthlyRevenueTarget: number;
  targetLaborPercent: number;
  nightShiftStart: string; // e.g., "22:00"
  nightShiftEnd: string;   // e.g., "05:00"
  nightShiftBonus: number; // e.g., 100 (per hour bonus)
  currency: Currency;
  storeName: string;
  timeSpecificAdjustments?: TimeSpecificWageAdjustment[]; // Flexible hourly rate adjustments
}

export interface POSTransaction {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  reason: string;
  timestamp: string;
  synced: boolean;
}

export type StaffRole = 'Kitchen' | 'Floor' | 'Cash' | 'Acting Manager';

export interface AISchedulingRule {
  skill: SkillType;
  minCount: number;
  timeSlot: 'lunch' | 'dinner' | 'all';
}

export interface AppConfig {
  qrCodeUrl: string;
  adminPrompts: string[];
  aiSchedulingRules: AISchedulingRule[];
}

export type Language = 'ja' | 'en';

export interface AppSettings {
  language: Language;
  openTime: string;
  closeTime: string;
}

export interface ShiftSwapRequest {
  id: string;
  fromStaffId: string;
  fromStaffName: string;
  toStaffId: string;
  toStaffName: string;
  shiftId: string;
  shiftDate: string;
  shiftTime: string; // e.g., "09:00-17:00"
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  respondedAt?: string;
}

export interface SalesEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'daily' | 'weekly' | 'monthly';
  amount: number;
  note?: string;
  createdAt: string;
}

export interface ManagerMessage {
  id: string;
  text: string;
  type: 'broadcast' | 'individual';
  to: string; // 'all' or staffId
  createdAt: string;
  // Optional shift submission deadline for staff
  // Stored as ISO datetime string
  deadline?: string;
}

export interface Session {
  staffId: string;
  staffName: string;
  isAdmin: boolean;
  rememberMe: boolean;
  loginTime: string;
}

export type ViewMode = 'day' | 'week' | 'month';

export type TabType = 'dashboard' | 'schedule' | 'staff' | 'finance';

export const ADMIN_PIN = '8888';

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const SKILL_TYPES: SkillType[] = ['新人研修', 'ホール', 'キッチン', 'レジ', '店長代理'];

export const TIME_SLOTS_30MIN = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const mins = i % 2 === 0 ? '00' : '30';
  return `${hours.toString().padStart(2, '0')}:${mins}`;
});

export const CURRENCY_CONFIG: Record<Currency, { symbol: string; decimals: number }> = {
  JPY: { symbol: '¥', decimals: 0 },
  USD: { symbol: '$', decimals: 2 },
  GBP: { symbol: '£', decimals: 2 },
  EUR: { symbol: '€', decimals: 2 },
};

// Helper to parse date strings without timezone offset issues
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper to format date to YYYY-MM-DD without timezone issues
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}
