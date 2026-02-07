// Internationalization for THE SURVIVAL MANAGER

export type Language = 'ja' | 'en';

export const LANGUAGES: Record<Language, Record<string, string>> = {
  ja: {
    // App
    title: "THE SURVIVAL MANAGER",
    subtitle: "店舗運営・財務管理システム",
    
    // Navigation
    dashboard: "ダッシュボード",
    schedule: "スケジュール",
    staff: "スタッフ",
    finance: "財務・AI",
    settings: "設定",
    
    // Auth
    admin: "管理者",
    staffLabel: "スタッフ",
    login: "ログイン",
    logout: "ログアウト",
    enterPin: "PINを入力",
    rememberMe: "ログイン状態を保持",
    invalidPin: "PINが無効です",
    welcome: "ようこそ",
    
    // Dashboard
    teamMembers: "チームメンバー",
    hoursThisWeek: "今週の勤務時間",
    laborCost: "人件費",
    laborPercent: "人件費率",
    target: "目標",
    pendingHolidays: "保留中の休暇申請",
    unpublishedShifts: "未公開シフト",
    
    // Schedule
    weekView: "週表示",
    dayView: "日表示",
    monthView: "月表示",
    today: "今日",
    prev: "前へ",
    next: "次へ",
    addShift: "シフト追加",
    deleteShift: "シフト削除",
    publish: "公開",
    publishAll: "すべて公開",
    draft: "下書き",
    confirmed: "確定",
    pending: "保留",
    modified: "変更済",
    holiday: "休日",
    
    // Staff
    addStaff: "スタッフ追加",
    editStaff: "スタッフ編集",
    deleteStaff: "スタッフ削除",
    name: "名前",
    pin: "PIN",
    baseWage: "基本時給",
    currency: "通貨",
    roles: "役割",
    kitchen: "キッチン",
    floor: "フロア",
    cash: "レジ",
    actingManager: "副店長",
    
    // Finance
    weeklyRevenue: "週間売上",
    monthlyRevenue: "月間売上目標",
    targetLaborPercent: "目標人件費率",
    storeName: "店舗名",
    formula: "計算式",
    totalHours: "合計時間",
    avgWage: "平均時給",
    revenue: "売上",
    
    // Staff Portal
    mySchedule: "マイシフト",
    submitAvailability: "勤務可能日を提出",
    requestHoliday: "休暇申請",
    selectDates: "日付を選択",
    startTime: "開始時間",
    endTime: "終了時間",
    submit: "送信",
    cancel: "キャンセル",
    save: "保存",
    
    // Announcements
    announcements: "お知らせ",
    newAnnouncement: "新規お知らせ",
    deadline: "提出期限",
    noDeadline: "期限なし",
    remaining: "残り",
    hours: "時間",
    minutes: "分",
    deadlinePassed: "期限切れ",
    
    // Settings
    openTime: "営業開始時間",
    closeTime: "営業終了時間",
    backgroundColor: "背景色",
    textColor: "文字色",
    language: "言語",
    japanese: "日本語",
    english: "English",
    
    // Messages
    managerMessage: "店長からのメッセージ",
    sendMessage: "メッセージを送信",
    enterMessage: "メッセージを入力",
    broadcast: "全員に送信",
    
    // Actions
    print: "印刷",
    export: "エクスポート",
    share: "共有",
    edit: "編集",
    delete: "削除",
    confirm: "確認",
    close: "閉じる",
  },
  en: {
    // App
    title: "THE SURVIVAL MANAGER",
    subtitle: "Restaurant Operations & Financial Guard System",
    
    // Navigation
    dashboard: "Dashboard",
    schedule: "Schedule",
    staff: "Staff",
    finance: "Finance/AI",
    settings: "Settings",
    
    // Auth
    admin: "Admin",
    staffLabel: "Staff",
    login: "Login",
    logout: "Logout",
    enterPin: "Enter PIN",
    rememberMe: "Remember me",
    invalidPin: "Invalid PIN",
    welcome: "Welcome",
    
    // Dashboard
    teamMembers: "Team Members",
    hoursThisWeek: "Hours This Week",
    laborCost: "Labor Cost",
    laborPercent: "Labor %",
    target: "Target",
    pendingHolidays: "Pending Holiday Request(s)",
    unpublishedShifts: "Unpublished Shift Request(s)",
    
    // Schedule
    weekView: "Week",
    dayView: "Day",
    monthView: "Month",
    today: "Today",
    prev: "Prev",
    next: "Next",
    addShift: "Add Shift",
    deleteShift: "Delete Shift",
    publish: "Publish",
    publishAll: "Publish All",
    draft: "Draft",
    confirmed: "Confirmed",
    pending: "Pending",
    modified: "Modified",
    holiday: "Holiday",
    
    // Staff
    addStaff: "Add Staff",
    editStaff: "Edit Staff",
    deleteStaff: "Delete Staff",
    name: "Name",
    pin: "PIN",
    baseWage: "Base Wage",
    currency: "Currency",
    roles: "Roles",
    kitchen: "Kitchen",
    floor: "Floor",
    cash: "Cash",
    actingManager: "Acting Manager",
    
    // Finance
    weeklyRevenue: "Weekly Revenue",
    monthlyRevenue: "Monthly Revenue Target",
    targetLaborPercent: "Target Labor %",
    storeName: "Store Name",
    formula: "Formula",
    totalHours: "Total Hours",
    avgWage: "Avg Wage",
    revenue: "Revenue",
    
    // Staff Portal
    mySchedule: "My Schedule",
    submitAvailability: "Submit Availability",
    requestHoliday: "Request Holiday",
    selectDates: "Select Dates",
    startTime: "Start Time",
    endTime: "End Time",
    submit: "Submit",
    cancel: "Cancel",
    save: "Save",
    
    // Announcements
    announcements: "Announcements",
    newAnnouncement: "New Announcement",
    deadline: "Deadline",
    noDeadline: "No Deadline",
    remaining: "remaining",
    hours: "h",
    minutes: "m",
    deadlinePassed: "Deadline passed",
    
    // Settings
    openTime: "Open Time",
    closeTime: "Close Time",
    backgroundColor: "Background Color",
    textColor: "Text Color",
    language: "Language",
    japanese: "Japanese",
    english: "English",
    
    // Messages
    managerMessage: "Manager Message",
    sendMessage: "Send Message",
    enterMessage: "Enter message",
    broadcast: "Broadcast to all",
    
    // Actions
    print: "Print",
    export: "Export",
    share: "Share",
    edit: "Edit",
    delete: "Delete",
    confirm: "Confirm",
    close: "Close",
  },
};

export function t(key: string, lang: Language): string {
  return LANGUAGES[lang][key] || key;
}
