import type { BudgetConfig, StaffMember, Shift, HolidayRequest, Announcement, AppSettings, ManagerMessage, SalesEntry, ShiftSwapRequest, Session, AppConfig, POSTransaction } from './types';

const STORAGE_KEYS = {
  STAFF: 'survival_manager_staff',
  SHIFTS: 'survival_manager_shifts',
  HOLIDAYS: 'survival_manager_holidays',
  BUDGET: 'survival_manager_budget',
  CONFIG: 'survival_manager_config',
  SESSION: 'survival_manager_session',
  ANNOUNCEMENTS: 'survival_manager_announcements',
  SETTINGS: 'survival_manager_settings',
  MESSAGES: 'survival_manager_messages',
  SALES: 'survival_manager_sales',
  SHIFT_SWAPS: 'survival_manager_shift_swaps',
  POS_LOGS: 'survival_manager_pos',
};

const getItem = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  const item = localStorage.getItem(key);
  try {
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setItem = <T,>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};

// Budget Config - merge with defaults to handle legacy data
const defaultBudgetConfig: BudgetConfig = {
  weeklyRevenue: 500000,
  monthlyRevenueTarget: 2000000,
  targetLaborPercent: 30,
  nightShiftStart: '22:00',
  nightShiftEnd: '05:00',
  nightShiftBonus: 100,
  currency: 'JPY',
  storeName: 'My Restaurant',
  timeSpecificAdjustments: [],
};
export const getBudgetConfig = (): BudgetConfig => {
  const saved = getItem<Partial<BudgetConfig>>(STORAGE_KEYS.BUDGET, {});
  return { ...defaultBudgetConfig, ...saved };
};
export const saveBudgetConfig = (config: BudgetConfig) => setItem(STORAGE_KEYS.BUDGET, config);
export const setBudgetConfig = saveBudgetConfig;

// Staff
export const getStaff = (): StaffMember[] => getItem(STORAGE_KEYS.STAFF, []);
export const setStaff = (staff: StaffMember[]) => setItem(STORAGE_KEYS.STAFF, staff);
export const deleteStaff = (id: string) => setStaff(getStaff().filter(s => s.id !== id));

// Shifts
export const getShifts = (): Shift[] => getItem(STORAGE_KEYS.SHIFTS, []);
export const setShifts = (shifts: Shift[]) => setItem(STORAGE_KEYS.SHIFTS, shifts);
export const addShift = (shift: Shift) => setShifts([...getShifts(), shift]);
export const updateShift = (id: string, updates: Partial<Shift>) => {
  setShifts(getShifts().map(s => s.id === id ? { ...s, ...updates } : s));
};
export const deleteShift = (id: string) => setShifts(getShifts().filter(s => s.id !== id));

// Holidays
export const getHolidays = (): HolidayRequest[] => getItem(STORAGE_KEYS.HOLIDAYS, []);
export const setHolidays = (holidays: HolidayRequest[]) => setItem(STORAGE_KEYS.HOLIDAYS, holidays);
export const addHoliday = (holiday: HolidayRequest) => setHolidays([...getHolidays(), holiday]);
export const updateHolidayStatus = (id: string, status: 'approved' | 'rejected') => {
  setHolidays(getHolidays().map(h => h.id === id ? { ...h, status } : h));
};
export const updateHoliday = updateHolidayStatus;

// App Settings
export const getAppSettings = (): AppSettings => getItem(STORAGE_KEYS.SETTINGS, {
  language: 'ja',
  openTime: '09:00',
  closeTime: '22:00',
});
export const setAppSettings = (settings: AppSettings) => setItem(STORAGE_KEYS.SETTINGS, settings);

// Session
export const getSession = (): Session | null => getItem(STORAGE_KEYS.SESSION, null);
export const setSession = (session: Session | null) => setItem(STORAGE_KEYS.SESSION, session);
export const clearSession = () => {
  if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEYS.SESSION);
};

// Announcements
export const getAnnouncements = (): Announcement[] => getItem(STORAGE_KEYS.ANNOUNCEMENTS, []);
export const setAnnouncements = (announcements: Announcement[]) => setItem(STORAGE_KEYS.ANNOUNCEMENTS, announcements);
export const addAnnouncement = (announcement: Announcement) => setAnnouncements([announcement, ...getAnnouncements()]);
export const deleteAnnouncement = (id: string) => setAnnouncements(getAnnouncements().filter(a => a.id !== id));

// Manager Messages
export const getManagerMessages = (): ManagerMessage[] => getItem(STORAGE_KEYS.MESSAGES, []);
export const setManagerMessages = (messages: ManagerMessage[]) => setItem(STORAGE_KEYS.MESSAGES, messages);
export const addManagerMessage = (message: ManagerMessage) => setManagerMessages([message, ...getManagerMessages()]);
export const deleteManagerMessage = (id: string) => setManagerMessages(getManagerMessages().filter(m => m.id !== id));

// Sales Entries
export const getSalesEntries = (): SalesEntry[] => getItem(STORAGE_KEYS.SALES, []);
export const setSalesEntries = (entries: SalesEntry[]) => setItem(STORAGE_KEYS.SALES, entries);
export const addSalesEntry = (entry: SalesEntry) => setSalesEntries([entry, ...getSalesEntries()]);
export const deleteSalesEntry = (id: string) => setSalesEntries(getSalesEntries().filter(e => e.id !== id));

// Shift Swaps
export const getShiftSwaps = (): ShiftSwapRequest[] => getItem(STORAGE_KEYS.SHIFT_SWAPS, []);
export const setShiftSwaps = (swaps: ShiftSwapRequest[]) => setItem(STORAGE_KEYS.SHIFT_SWAPS, swaps);
export const addShiftSwap = (swap: ShiftSwapRequest) => setShiftSwaps([swap, ...getShiftSwaps()]);
export const updateShiftSwapStatus = (id: string, status: 'approved' | 'rejected') => {
  setShiftSwaps(getShiftSwaps().map(s => s.id === id ? { ...s, status, respondedAt: new Date().toISOString() } : s));
};

// App Config
export const getAppConfig = (): AppConfig => getItem(STORAGE_KEYS.CONFIG, {
  qrCodeUrl: '',
  adminPrompts: [],
  aiSchedulingRules: [],
});
export const setAppConfig = (config: AppConfig) => setItem(STORAGE_KEYS.CONFIG, config);

// POS Logs
export const getPOSLogs = (): POSTransaction[] => getItem(STORAGE_KEYS.POS_LOGS, []);
export const setPOSLogs = (logs: POSTransaction[]) => setItem(STORAGE_KEYS.POS_LOGS, logs);
export const addPOSLog = (log: POSTransaction) => setPOSLogs([...getPOSLogs(), log]);
export const clearPOSLogs = () => setPOSLogs([]);
