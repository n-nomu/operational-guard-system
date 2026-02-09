'use client';

import React from "react"

import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  DollarSign,
  LogOut,
  UserCircle,
  TrendingUp,
  Clock,
  Bell,
  Globe,
  Settings,
  Send,
  MessageSquare,
  Download,
  Upload,
  Plus,
  Trash2,
  Check,
  X,
  ArrowLeftRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StaffManagement } from './staff-management';
import { WeeklyCalendar } from './weekly-calendar';
import { BudgetControl } from './budget-control';
import { StaffPortal } from './staff-portal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  clearSession,
  getShifts,
  setShifts,
  getStaff,
  setStaff,
  getBudgetConfig,
  setBudgetConfig,
  getHolidays,
  setHolidays,
  getAnnouncements,
  setAnnouncements,
  getAppSettings,
  setAppSettings,
  getManagerMessages,
  setManagerMessages,
  addManagerMessage,
  deleteManagerMessage,
  getSalesEntries,
  setSalesEntries,
  getShiftSwaps,
  updateShiftSwapStatus,
} from '@/lib/storage';
import { formatCurrency } from '@/lib/currency';
import { t, type Language } from '@/lib/i18n';
import {
  parseLocalDate,
  formatLocalDate,
  type Session,
  type TabType,
  type AppSettings,
  type ManagerMessage,
  type ShiftSwapRequest,
  type BudgetConfig,
  type TimeSpecificWageAdjustment,
} from '@/lib/types';

interface DashboardProps {
  session: Session;
  onLogout: () => void;
}

export function Dashboard({ session, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [settings, setSettingsState] = useState<AppSettings>({
    language: 'ja',
    openTime: '09:00',
    closeTime: '22:00',
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [localBudgetConfig, setLocalBudgetConfig] = useState<BudgetConfig>(() => getBudgetConfig());
  const [messages, setMessages] = useState<ManagerMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [pendingSwaps, setPendingSwaps] = useState<ShiftSwapRequest[]>([]);
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const lang = settings.language;

  useEffect(() => {
    document.documentElement.classList.add('dark');
    const savedSettings = getAppSettings();
    setSettingsState({
      language: savedSettings.language || 'ja',
      openTime: savedSettings.openTime || '09:00',
      closeTime: savedSettings.closeTime || '22:00',
    });
    setMessages(getManagerMessages());
    setPendingSwaps(getShiftSwaps().filter(s => s.status === 'pending'));

    // Listen for budget config updates from AdminSettings
    const handleBudgetUpdate = () => {
      setRefreshTrigger(r => r + 1);
      setLocalBudgetConfig(getBudgetConfig());
    };
    window.addEventListener('budgetConfigUpdated', handleBudgetUpdate);
    return () => window.removeEventListener('budgetConfigUpdated', handleBudgetUpdate);
  }, [refreshTrigger]);

  // Reset local budget config when modal opens
  useEffect(() => {
    if (isSettingsOpen) {
      setLocalBudgetConfig(getBudgetConfig());
    }
  }, [isSettingsOpen]);

  const updateSettings = (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettingsState(newSettings);
    setAppSettings(newSettings);
  };

  const handleLogout = () => {
    clearSession();
    onLogout();
  };

  const handleRefresh = () => {
    setRefreshTrigger(r => r + 1);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    let deadline: string | undefined;
    if (deadlineDate) {
      const dt = new Date(`${deadlineDate}T${deadlineTime || '23:59'}`);
      if (!isNaN(dt.getTime())) {
        deadline = dt.toISOString();
      }
    }

    const msg: ManagerMessage = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      type: 'broadcast',
      to: 'all',
      createdAt: new Date().toISOString(),
      deadline,
    };
    addManagerMessage(msg);
    setMessages(prev => [msg, ...prev]);
    setNewMessage('');
    setDeadlineDate('');
    setDeadlineTime('23:59');
  };

  const handleDeleteMessage = (id: string) => {
    deleteManagerMessage(id);
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  // Backup/Restore
  const handleExportData = () => {
    const allData = {
      staff: getStaff(),
      shifts: getShifts(),
      holidays: getHolidays(),
      budget: getBudgetConfig(),
      sales: getSalesEntries(),
      messages: getManagerMessages(),
      announcements: getAnnouncements(),
      settings: getAppSettings(),
      shiftSwaps: getShiftSwaps(),
      exportDate: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Restore all data
        if (data.staff) setStaff(data.staff);
        if (data.shifts) setShifts(data.shifts);
        if (data.holidays) setHolidays(data.holidays);
        if (data.budget) setBudgetConfig(data.budget);
        if (data.sales) setSalesEntries(data.sales);
        if (data.messages) setManagerMessages(data.messages);
        if (data.announcements) setAnnouncements(data.announcements);
        if (data.settings) setAppSettings(data.settings);
        
        alert(lang === 'ja' ? 'データを復元しました！' : 'Data restored successfully!');
        window.location.reload();
      } catch (err) {
        alert(lang === 'ja' ? 'インポートに失敗しました。ファイル形式を確認してください。' : 'Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  // Shift Swap Approval
  const handleApproveSwap = (swapId: string) => {
    const swap = pendingSwaps.find(s => s.id === swapId);
    if (!swap) return;
    
    // Update the shift's staffId
    const shifts = getShifts();
    const staff = getStaff();
    const toStaff = staff.find(s => s.id === swap.toStaffId);
    
    const updatedShifts = shifts.map(s => 
      s.id === swap.shiftId 
        ? { ...s, staffId: swap.toStaffId, staffName: toStaff?.name || swap.toStaffName, status: 'modified' as const }
        : s
    );
    setShifts(updatedShifts);
    
    // Update swap status
    updateShiftSwapStatus(swapId, 'approved');
    setPendingSwaps(prev => prev.filter(s => s.id !== swapId));
  };

  const handleRejectSwap = (swapId: string) => {
    updateShiftSwapStatus(swapId, 'rejected');
    setPendingSwaps(prev => prev.filter(s => s.id !== swapId));
  };

  // Handle save and close settings modal
  const handleSaveAndCloseSettings = () => {
    // Save budget config
    setBudgetConfig(localBudgetConfig);
    window.dispatchEvent(new Event('budgetConfigUpdated'));
    // Settings are already saved via updateSettings
    setIsSettingsOpen(false);
    setRefreshTrigger(r => r + 1);
  };

  // Handle time-specific wage adjustments
  const addTimeSpecificAdjustment = () => {
    const newAdjustment: TimeSpecificWageAdjustment = {
      id: crypto.randomUUID(),
      startTime: '00:00',
      endTime: '23:59',
      adjustment: 0,
      enabled: true,
    };
    setLocalBudgetConfig({
      ...localBudgetConfig,
      timeSpecificAdjustments: [...(localBudgetConfig.timeSpecificAdjustments || []), newAdjustment],
    });
  };

  const updateTimeSpecificAdjustment = (id: string, updates: Partial<TimeSpecificWageAdjustment>) => {
    setLocalBudgetConfig({
      ...localBudgetConfig,
      timeSpecificAdjustments: (localBudgetConfig.timeSpecificAdjustments || []).map(adj =>
        adj.id === id ? { ...adj, ...updates } : adj
      ),
    });
  };

  const deleteTimeSpecificAdjustment = (id: string) => {
    setLocalBudgetConfig({
      ...localBudgetConfig,
      timeSpecificAdjustments: (localBudgetConfig.timeSpecificAdjustments || []).filter(adj => adj.id !== id),
    });
  };

  // Wage Rule Management
  const handleAddWageRule = () => {
    // Implementation for adding a wage rule
  };

  const toggleWageRule = (ruleId: string) => {
    const newRules = (settings.wageRules || []).map(rule => 
      rule.id === ruleId 
        ? { ...rule, isActive: !rule.isActive } 
        : rule
    );
    updateSettings({ wageRules: newRules });
  };

  const deleteWageRule = (ruleId: string) => {
    const newRules = (settings.wageRules || []).filter(rule => rule.id !== ruleId);
    updateSettings({ wageRules: newRules });
  };

  // Dashboard stats
  const staff = getStaff();
  const shifts = getShifts();
  const holidays = getHolidays();
  const budgetConfig = getBudgetConfig();

  const getWeekDates = () => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const weekShifts = shifts.filter(s => {
    const shiftDate = parseLocalDate(s.date);
    return shiftDate >= weekDates[0] && shiftDate <= weekDates[6];
  });

  const totalHours = weekShifts.reduce((sum, s) => sum + (s.actualHours ?? s.hours), 0);
  const totalCost = weekShifts.reduce((sum, s) => sum + s.cost, 0);

  // Finance calculation with formula
  const laborCalc = useMemo(() => {
    const avgWage = staff.length > 0
      ? staff.reduce((sum, s) => sum + s.baseWage, 0) / staff.length
      : 1200;
    const laborCost = totalHours * avgWage;
    const laborPercent = budgetConfig.weeklyRevenue > 0
      ? (laborCost / budgetConfig.weeklyRevenue) * 100
      : 0;
    return { avgWage, laborCost, laborPercent };
  }, [staff, totalHours, budgetConfig.weeklyRevenue]);

  const pendingHolidays = holidays.filter(h => h.status === 'pending').length;
  const pendingShifts = shifts.filter(s => s.status === 'pending' && !s.isPublished).length;

  // Current manager message & upcoming deadline (for staff dashboard)
  const latestManagerMessage = messages[0] ?? null;
  const now = new Date();
  const upcomingDeadlineMessage =
    messages.find(m => m.deadline && new Date(m.deadline) > now) ?? null;

  // Admin nav items
  const adminNavItems = [
    { id: 'dashboard' as TabType, label: t('dashboard', lang), icon: LayoutDashboard },
    { id: 'schedule' as TabType, label: t('schedule', lang), icon: Calendar },
    { id: 'staff' as TabType, label: t('staff', lang), icon: Users },
    { id: 'finance' as TabType, label: t('finance', lang), icon: DollarSign },
  ];

  // Staff nav items
  const staffNavItems = [
    {
      id: 'dashboard' as TabType,
      label: lang === 'ja' ? 'スタッフダッシュボード' : 'Staff Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'schedule' as TabType,
      label: t('mySchedule', lang),
      icon: Calendar,
    },
  ];

  const navItems = session.isAdmin ? adminNavItems : staffNavItems;

  // Format number with locale
  const formatNum = (num: number) =>
    new Intl.NumberFormat(lang === 'ja' ? 'ja-JP' : 'en-US').format(num);

  const renderContent = () => {
    // Staff view
    if (!session.isAdmin) {
      // Staff Dashboard (messages + deadline)
      if (activeTab === 'dashboard') {
        const deadline = upcomingDeadlineMessage?.deadline
          ? new Date(upcomingDeadlineMessage.deadline)
          : null;

        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {lang === 'ja' ? 'スタッフダッシュボード' : 'Staff Dashboard'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lang === 'ja'
                    ? `${session.staffName}さんへの最新のお知らせ`
                    : `Latest updates for ${session.staffName}`}
                </p>
              </div>
            </div>

            {/* Urgent deadline alert */}
            {deadline && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <Bell className="w-4 h-4 text-amber-400" />
                <AlertDescription className="text-amber-400 font-medium">
                  {lang === 'ja'
                    ? `至急: シフト提出締切 ${deadline.toLocaleString('ja-JP')}`
                    : `Urgent: Shift due by ${deadline.toLocaleString('en-US')}`}
                </AlertDescription>
              </Alert>
            )}

            {/* Current manager message */}
            {latestManagerMessage ? (
              <Card className="bg-card border-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-primary">
                    <MessageSquare className="w-4 h-4" />
                    {t('managerMessage', lang)}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {new Date(latestManagerMessage.createdAt).toLocaleString(
                      lang === 'ja' ? 'ja-JP' : 'en-US',
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {latestManagerMessage.text}
                  </p>
                  {latestManagerMessage.deadline && (
                    <p className="text-xs text-muted-foreground">
                      {lang === 'ja'
                        ? `このメッセージのシフト提出締切: ${new Date(
                            latestManagerMessage.deadline,
                          ).toLocaleString('ja-JP')}`
                        : `Shift deadline for this message: ${new Date(
                            latestManagerMessage.deadline,
                          ).toLocaleString('en-US')}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-6 text-center text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {lang === 'ja'
                      ? '現在、マネージャーからのメッセージはありません'
                      : 'No manager messages yet.'}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Link to schedule view */}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setActiveTab('schedule')}
            >
              <Calendar className="w-4 h-4" />
              {lang === 'ja' ? '自分のシフト・申請画面へ' : 'Go to My Schedule & Requests'}
            </Button>
          </div>
        );
      }

      // Staff schedule / requests view
      return (
        <StaffPortal
          session={session}
          onRefresh={handleRefresh}
          lang={lang}
          messages={messages}
          openTime={settings.openTime}
          closeTime={settings.closeTime}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Today's Overview */}
            <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  {lang === 'ja' ? '今日の概要' : "Today's Overview"}
                </CardTitle>
                <CardDescription>
                  {new Date().toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { 
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const today = new Date();
                  const todayStr = formatLocalDate(today);
                  const todayShifts = shifts.filter(s => s.date === todayStr && s.status === 'confirmed');
                  const todayHours = todayShifts.reduce((sum, s) => sum + (s.actualHours ?? s.hours), 0);
                  const todayCost = todayShifts.reduce((sum, s) => sum + s.cost, 0);
                  
                  return (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-foreground">{todayShifts.length}</div>
                        <div className="text-sm text-muted-foreground">{lang === 'ja' ? 'シフト数' : 'Shifts'}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-foreground">{todayHours.toFixed(1)}h</div>
                        <div className="text-sm text-muted-foreground">{lang === 'ja' ? '勤務時間' : 'Hours'}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-foreground">
                          {formatCurrency(todayCost, budgetConfig.currency)}
                        </div>
                        <div className="text-sm text-muted-foreground">{lang === 'ja' ? '人件費' : 'Cost'}</div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-foreground">{staff.length}</div>
                      <div className="text-sm text-muted-foreground">{t('teamMembers', lang)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-foreground">{totalHours.toFixed(0)}</div>
                      <div className="text-sm text-muted-foreground">{t('hoursThisWeek', lang)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-foreground">
                        {formatCurrency(laborCalc.laborCost, budgetConfig.currency)}
                      </div>
                      <div className="text-sm text-muted-foreground">{t('laborCost', lang)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      laborCalc.laborPercent > budgetConfig.targetLaborPercent
                        ? 'bg-destructive/20'
                        : 'bg-green-500/20'
                    }`}>
                      <TrendingUp className={`w-5 h-5 ${
                        laborCalc.laborPercent > budgetConfig.targetLaborPercent
                          ? 'text-destructive'
                          : 'text-green-500'
                      }`} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-foreground">{laborCalc.laborPercent.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">
                        {t('laborPercent', lang)} ({t('target', lang)}: {budgetConfig.targetLaborPercent}%)
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Pending Items */}
            {(pendingHolidays > 0 || pendingShifts > 0 || pendingSwaps.length > 0) && (
              <div className="flex flex-wrap gap-4">
                {pendingHolidays > 0 && (
                  <Badge variant="outline" className="text-amber-400 border-amber-400/50 bg-amber-400/10 px-3 py-1">
                    {pendingHolidays} {t('pendingHolidays', lang)}
                  </Badge>
                )}
                {pendingShifts > 0 && (
                  <Badge variant="outline" className="text-destructive border-destructive/50 bg-destructive/10 px-3 py-1">
                    {pendingShifts} {t('unpublishedShifts', lang)}
                  </Badge>
                )}
                {pendingSwaps.length > 0 && (
                  <Badge variant="outline" className="text-primary border-primary/50 bg-primary/10 px-3 py-1">
                    {pendingSwaps.length} {lang === 'ja' ? '交代承認待ち' : 'Swap Requests'}
                  </Badge>
                )}
              </div>
            )}

            {/* Manager Message Section */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-foreground">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  {t('managerMessage', lang)}
                </CardTitle>
                <CardDescription>
                  {lang === 'ja'
                    ? 'スタッフ全員へのメッセージとシフト提出締切を設定'
                    : 'Send messages and set shift submission deadline for all staff'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    placeholder={t('enterMessage', lang)}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-foreground">
                      {lang === 'ja' ? 'シフト提出締切日 (任意)' : 'Shift Deadline Date (optional)'}
                    </Label>
                    <Input
                      type="date"
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-foreground">
                      {lang === 'ja' ? '締切時間' : 'Deadline Time'}
                    </Label>
                    <Input
                      type="time"
                      value={deadlineTime}
                      onChange={(e) => setDeadlineTime(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={handleSendMessage} className="gap-2" disabled={!newMessage.trim()}>
                  <Send className="w-4 h-4" />
                  {lang === 'ja' ? '送信' : 'Send Message'}
                </Button>
                {messages.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-border">
                    <Label className="text-sm text-muted-foreground">Message History</Label>
                    {messages.slice(0, 5).map(m => (
                      <div key={m.id} className="flex items-start justify-between p-2 rounded bg-secondary">
                        <div className="flex-1">
                          <p className="text-sm text-foreground">{m.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(m.createdAt).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US')}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive h-6 px-2"
                          onClick={() => handleDeleteMessage(m.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Link to Schedule */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setActiveTab('schedule')}
            >
              <Calendar className="w-4 h-4" />
              {lang === 'ja' ? 'スケジュール管理へ' : 'Go to Schedule Management'}
            </Button>
          </div>
        );
      case 'schedule':
        return (
          <WeeklyCalendar
          onRefresh={handleRefresh}
            isAdmin={true}
            lang={lang}
          
          />
        );

      case 'staff':
        return <StaffManagement lang={lang} />;

      case 'finance':
        return<BudgetControl isAdmin={true} lang={lang} onRefresh={handleRefresh} />

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border no-print">
        <div className="w-[95%] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">SM</span>
              </div>
              <div>
                <h1 className="font-semibold text-foreground">{t('title', lang)}</h1>
                <p className="text-xs text-muted-foreground">{budgetConfig.storeName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Language Switcher */}
              <div className="hidden sm:flex items-center gap-1">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <Select
                  value={settings.language}
                  onValueChange={(v: Language) => updateSettings({ language: v })}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ja">日本語</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="hidden sm:flex items-center gap-2 mx-2 px-2 border-l border-border">
                <UserCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{session.staffName}</span>
                {session.isAdmin && (
                  <Badge variant="secondary" className="text-xs">{t('admin', lang)}</Badge>
                )}
              </div>

              {/* Settings Dialog - Admin Only */}
              {session.isAdmin && (
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">{t('settings', lang)}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {/* Operating Hours */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-foreground">{t('openTime', lang)}</Label>
                        <Input
                          type="time"
                          value={settings.openTime || '09:00'}
                          onChange={(e) => updateSettings({ openTime: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-foreground">{t('closeTime', lang)}</Label>
                        <Input
                          type="time"
                          value={settings.closeTime || '22:00'}
                          onChange={(e) => updateSettings({ closeTime: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-secondary rounded-lg">
                      <p className="text-sm text-foreground">
                        {lang === 'ja' ? '営業時間' : 'Operating Hours'}: {settings.openTime} - {settings.closeTime}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lang === 'ja' 
                          ? 'シフト申請はこの時間内に制限されます' 
                          : 'Staff shift requests will be validated against these hours'}
                      </p>
                    </div>

                    {/* Language */}
                    <div className="space-y-2">
                      <Label className="text-foreground">{t('language', lang)}</Label>
                      <Select
                        value={settings.language}
                        onValueChange={(v: Language) => updateSettings({ language: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ja">{t('japanese', lang)}</SelectItem>
                          <SelectItem value="en">{t('english', lang)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Night Shift Settings (from BudgetConfig) */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <Label className="text-foreground">
                        {lang === 'ja' ? '深夜手当設定' : 'Night Shift Bonus'}
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{lang === 'ja' ? '開始時刻' : 'Start'}</Label>
                          <Input
                            type="time"
                            value={localBudgetConfig.nightShiftStart || '22:00'}
                            onChange={(e) => setLocalBudgetConfig({ ...localBudgetConfig, nightShiftStart: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{lang === 'ja' ? '終了時刻' : 'End'}</Label>
                          <Input
                            type="time"
                            value={localBudgetConfig.nightShiftEnd || '05:00'}
                            onChange={(e) => setLocalBudgetConfig({ ...localBudgetConfig, nightShiftEnd: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{lang === 'ja' ? '増額/時' : 'Bonus/hr'}</Label>
                          <Input
                            type="number"
                            value={localBudgetConfig.nightShiftBonus ?? 0}
                            onChange={(e) => setLocalBudgetConfig({ ...localBudgetConfig, nightShiftBonus: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'ja' 
                          ? `深夜時間帯（${localBudgetConfig.nightShiftStart || '22:00'}〜${localBudgetConfig.nightShiftEnd || '05:00'}）に+${formatCurrency(localBudgetConfig.nightShiftBonus ?? 0, localBudgetConfig.currency)}/時`
                          : `Night hours (${localBudgetConfig.nightShiftStart || '22:00'}-${localBudgetConfig.nightShiftEnd || '05:00'}): +${formatCurrency(localBudgetConfig.nightShiftBonus ?? 0, localBudgetConfig.currency)}/hr`}
                      </p>
                    </div>

                    {/* Time-Specific Wage Adjustments */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <Label className="text-foreground">
                          {lang === 'ja' ? '時間帯別時給調整' : 'Time-Specific Wage Adjustments'}
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addTimeSpecificAdjustment}
                          className="gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          {lang === 'ja' ? '追加' : 'Add'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'ja'
                          ? '特定の時間帯に時給を増減できます（例: ランチタイム +200円/時）'
                          : 'Add or subtract from base hourly wage for specific time windows (e.g., Lunch +200/hr)'}
                      </p>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto">
                        {(localBudgetConfig.timeSpecificAdjustments || []).map((adj) => (
                          <div key={adj.id} className="p-3 border border-border rounded-lg bg-secondary space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={adj.enabled}
                                  onCheckedChange={(checked) =>
                                    updateTimeSpecificAdjustment(adj.id, { enabled: checked })
                                  }
                                />
                                <Label className="text-sm text-foreground">
                                  {lang === 'ja' ? '有効' : 'Enabled'}
                                </Label>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteTimeSpecificAdjustment(adj.id)}
                                className="text-destructive hover:text-destructive h-6 w-6 p-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  {lang === 'ja' ? '開始' : 'Start'}
                                </Label>
                                <Input
                                  type="time"
                                  value={adj.startTime}
                                  onChange={(e) =>
                                    updateTimeSpecificAdjustment(adj.id, { startTime: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  {lang === 'ja' ? '終了' : 'End'}
                                </Label>
                                <Input
                                  type="time"
                                  value={adj.endTime}
                                  onChange={(e) =>
                                    updateTimeSpecificAdjustment(adj.id, { endTime: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  {lang === 'ja' ? '調整額/時' : 'Adjustment/hr'}
                                </Label>
                                <Input
                                  type="number"
                                  value={adj.adjustment}
                                  onChange={(e) =>
                                    updateTimeSpecificAdjustment(adj.id, {
                                      adjustment: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  placeholder="+200 or -100"
                                />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {adj.startTime} - {adj.endTime}:{' '}
                              {adj.adjustment >= 0 ? '+' : ''}
                              {formatCurrency(adj.adjustment, localBudgetConfig.currency)}/
                              {lang === 'ja' ? '時' : 'hr'}
                            </p>
                          </div>
                        ))}
                        {(localBudgetConfig.timeSpecificAdjustments || []).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {lang === 'ja'
                              ? '時間帯別調整が設定されていません'
                              : 'No time-specific adjustments configured'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Backup/Restore */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <Label className="text-foreground">
                        {lang === 'ja' ? 'データバックアップ' : 'Data Backup'}
                      </Label>
                      <div className="flex gap-2">
                        <Button onClick={handleExportData} variant="outline" className="flex-1 gap-2 bg-transparent">
                          <Download className="w-4 h-4" />
                          {lang === 'ja' ? 'エクスポート' : 'Export'}
                        </Button>
                        <label className="flex-1">
                          <Button variant="outline" className="w-full gap-2 bg-transparent" asChild>
                            <span>
                              <Upload className="w-4 h-4" />
                              {lang === 'ja' ? 'インポート' : 'Import'}
                            </span>
                          </Button>
                          <input 
                            type="file" 
                            accept=".json" 
                            onChange={handleImportData}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lang === 'ja' 
                          ? '全データをJSON形式でバックアップ・復元できます'
                          : 'Backup and restore all data in JSON format'}
                      </p>
                    </div>
                  </div>
                  {/* Permanent Save & Close Button */}
                  <div className="sticky bottom-0 pt-4 border-t border-border bg-card -mx-6 -mb-6 px-6 pb-6">
                    <Button onClick={handleSaveAndCloseSettings} className="w-full" size="lg">
                      {lang === 'ja' ? '保存して閉じる' : 'Save & Close'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
)}
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-card/50 border-b border-border no-print">
        <div className="w-[95%] mx-auto px-4">
          <div className="flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="w-[95%] mx-auto px-4 py-6">
        {renderContent()}
      </main>
    </div>
  );
}

// (DeadlineBanner removed – staff dashboard now uses ManagerMessage-based deadline alert)
