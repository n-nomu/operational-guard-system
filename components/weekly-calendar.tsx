'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles,
  Trash2,
  Edit2,
  Save,
  X,
  Filter,
  Brain,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getShifts, setShifts, getStaff, getBudgetConfig } from '@/lib/storage';
import { DAYS_OF_WEEK, parseLocalDate, formatLocalDate, type Shift, type StaffMember, type SkillType } from '@/lib/types';
import { calculateShiftWage, calculateActualHours } from '@/lib/wage-calculator';
import { formatCurrency } from '@/lib/currency';
import { type Language } from '@/lib/i18n';

interface WeeklyCalendarProps {
  isAdmin?: boolean;
  lang?: Language;
  onRefresh?: () => void;
}

type ViewMode = 'day' | 'week' | 'month';

interface AIScheduleSuggestion {
  date: string;
  staffId: string;
  startTime: string;
  endTime: string;
  confidence: number;
  reason: string;
}

export function WeeklyCalendar({ isAdmin = false, lang = 'ja', onRefresh }: WeeklyCalendarProps) {
  const [shifts, setLocalShifts] = useState<Shift[]>([]);
  const [staff, setLocalStaff] = useState<StaffMember[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AIScheduleSuggestion[]>([]);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editBreakMinutes, setEditBreakMinutes] = useState(0);
  const budgetConfig = getBudgetConfig();

  useEffect(() => {
    setLocalShifts(getShifts());
    setLocalStaff(getStaff());
  }, []);

  // Get dates based on view mode
  const getDisplayDates = useMemo(() => {
    const dates: Date[] = [];
    
    if (viewMode === 'day') {
      dates.push(new Date(currentDate));
    } else if (viewMode === 'week') {
      const startOfWeek = new Date(currentDate);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        dates.push(date);
      }
    } else if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      
      const startDate = new Date(firstDay);
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate.setDate(diff);
      
      for (let i = 0; i < 42; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        dates.push(date);
      }
    }
    
    return dates;
  }, [currentDate, viewMode]);

  // Filter shifts for display dates
  const displayShifts = useMemo(() => {
    let filtered = shifts.filter(s => {
      const shiftDate = parseLocalDate(s.date);
      return getDisplayDates.some(d => d.toDateString() === shiftDate.toDateString());
    });

    const roleToSkillMap: Record<string, string> = {
      'Kitchen': 'キッチン',
      'Floor': 'ホール',
      'Cash': 'レジ',
      'Acting Manager': '店長代理'
    };

    if (filterRole !== 'all') {
      filtered = filtered.filter(s => {
        const staffMember = staff.find(st => st.id === s.staffId);
        const targetSkill = roleToSkillMap[filterRole];
        return staffMember?.skills?.includes(targetSkill as SkillType);
      });
    }

    return filtered;
  }, [shifts, getDisplayDates, filterRole, staff]);

  // Navigation
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get shifts for a specific date
  const getShiftsForDate = (date: Date) => {
    const dateStr = formatLocalDate(date);
    return displayShifts.filter(s => s.date === dateStr);
  };

  // Get staff by ID
  const getStaffById = (id: string) => staff.find(s => s.id === id);

  // Calculate totals
  const totalHours = displayShifts.reduce((sum, s) => sum + (s.actualHours ?? s.hours), 0);
  const totalCost = displayShifts.reduce((sum, s) => sum + s.cost, 0);

  // AI Schedule Generation
  const generateAISchedule = async () => {
    setIsGeneratingAI(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const suggestions: AIScheduleSuggestion[] = [];
    const targetDates = viewMode === 'day' ? [currentDate] : getDisplayDates.slice(0, 7);
    
    targetDates.forEach((date) => {
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const availableStaff = staff.filter(s => s.isActive !== false);
      
      if (availableStaff.length > 0) {
        const morningStaff = availableStaff[0];
        suggestions.push({
          date: formatLocalDate(date),
          staffId: morningStaff.id,
          startTime: isWeekend ? '08:00' : '09:00',
          endTime: isWeekend ? '14:00' : '15:00',
          confidence: 0.85,
          reason: lang === 'ja' 
            ? '過去のパフォーマンスと曜日パターンに基づく'
            : 'Based on past performance and day-of-week patterns',
        });

        if (availableStaff.length > 1) {
          const eveningStaff = availableStaff[1];
          suggestions.push({
            date: formatLocalDate(date),
            staffId: eveningStaff.id,
            startTime: isWeekend ? '14:00' : '15:00',
            endTime: isWeekend ? '22:00' : '21:00',
            confidence: 0.78,
            reason: lang === 'ja'
              ? 'ピーク時間帯のカバレッジ最適化'
              : 'Optimizing coverage for peak hours',
          });
        }
      }
    });

    setAiSuggestions(suggestions);
    setIsGeneratingAI(false);
    setShowAIInsights(true);
  };

  const applyAISuggestion = (suggestion: AIScheduleSuggestion) => {
    const staffMember = getStaffById(suggestion.staffId);
    if (!staffMember) return;

    // calculateShiftWage は内部で BudgetConfig から深夜手当などを取得
    const cost = calculateShiftWage(
      suggestion.startTime,
      suggestion.endTime,
      staffMember.baseWage,
      0 // 新規作成時は休憩時間0
    );

    const newShift: Shift = {
      id: crypto.randomUUID(),
      staffId: suggestion.staffId,
      staffName: staffMember.name,
      date: suggestion.date,
      startTime: suggestion.startTime,
      endTime: suggestion.endTime,
      hours: calculateActualHours(suggestion.startTime, suggestion.endTime, 0),
      actualHours: calculateActualHours(suggestion.startTime, suggestion.endTime, 0),
      breakMinutes: 0,
      cost: cost,
      status: 'pending',
      isPublished: false,
    };

    const updated = [...shifts, newShift];
    setShifts(updated);
    setLocalShifts(updated);
    onRefresh?.();
  };

  const handleApproveShift = (shiftId: string) => {
    const updated = shifts.map(s => 
      s.id === shiftId ? { ...s, status: 'confirmed' as const } : s
    );
    setShifts(updated);
    setLocalShifts(updated);
    setIsDialogOpen(false);
    setSelectedShift(null);
    onRefresh?.();
  };

  const handleRejectShift = (shiftId: string) => {
    const updated = shifts.filter(s => s.id !== shiftId);
    setShifts(updated);
    setLocalShifts(updated);
    setIsDialogOpen(false);
    setSelectedShift(null);
    onRefresh?.();
  };

  const handleDeleteShift = (shiftId: string) => {
    const updated = shifts.filter(s => s.id !== shiftId);
    setShifts(updated);
    setLocalShifts(updated);
    setIsDialogOpen(false);
    setSelectedShift(null);
    onRefresh?.();
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setEditStartTime(shift.startTime);
    setEditEndTime(shift.endTime);
    setEditBreakMinutes(shift.breakMinutes || 0);
  };

  const handleSaveEdit = () => {
    if (!editingShift) return;

    const staffMember = getStaffById(editingShift.staffId);
    if (!staffMember) return;

    // calculateShiftWage は内部で BudgetConfig から深夜手当などを取得
    const cost = calculateShiftWage(
      editStartTime,
      editEndTime,
      staffMember.baseWage,
      editBreakMinutes
    );

    const actualHours = calculateActualHours(editStartTime, editEndTime, editBreakMinutes);

    const updated = shifts.map(s => 
      s.id === editingShift.id 
        ? { 
            ...s, 
            startTime: editStartTime,
            endTime: editEndTime,
            hours: calculateActualHours(editStartTime, editEndTime, 0),
            actualHours: actualHours,
            cost: cost,
            breakMinutes: editBreakMinutes,
            status: 'modified' as const
          } 
        : s
    );
    setShifts(updated);
    setLocalShifts(updated);
    setEditingShift(null);
    setIsDialogOpen(false);
    setSelectedShift(null);
    onRefresh?.();
  };

  const handlePublishWeek = () => {
    const updated = shifts.map(s => {
      const shiftDate = parseLocalDate(s.date);
      if (getDisplayDates.some(d => d.toDateString() === shiftDate.toDateString())) {
        return { ...s, isPublished: true };
      }
      return s;
    });
    setShifts(updated);
    setLocalShifts(updated);
    onRefresh?.();
  };

  const getStatusBadge = (status: Shift['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="destructive" className="text-xs">REQ</Badge>;
      case 'confirmed':
        return <Badge className="text-xs bg-green-600 text-white">OK</Badge>;
      case 'modified':
        return <Badge variant="outline" className="text-xs border-amber-400 text-amber-400">MOD</Badge>;
    }
  };

  // Calculate hours change preview
  const getHoursChangePreview = () => {
    if (!editingShift) return null;
    
    const newActualHours = calculateActualHours(editStartTime, editEndTime, editBreakMinutes);
    const oldActualHours = editingShift.actualHours ?? editingShift.hours;
    const diff = newActualHours - oldActualHours;

    return {
      newActualHours,
      diff,
    };
  };

  // Format date for display
  const formatDateDisplay = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
      });
    } else if (viewMode === 'week') {
      const start = getDisplayDates[0];
      const end = getDisplayDates[6];
      return `${start.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { 
        year: 'numeric', month: 'long' 
      });
    }
  };

  const preview = getHoursChangePreview();

  return (
    <div className="space-y-6">
      {/* Header with View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {viewMode === 'day' ? (lang === 'ja' ? '日別スケジュール' : 'Daily Schedule') :
               viewMode === 'week' ? (lang === 'ja' ? '週間スケジュール' : 'Weekly Schedule') :
               (lang === 'ja' ? '月間スケジュール' : 'Monthly Schedule')}
            </h2>
            <p className="text-sm text-muted-foreground">{formatDateDisplay()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Selector */}
          <Select value={viewMode} onValueChange={(v: ViewMode) => setViewMode(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{lang === 'ja' ? '日' : 'Day'}</SelectItem>
              <SelectItem value="week">{lang === 'ja' ? '週' : 'Week'}</SelectItem>
              <SelectItem value="month">{lang === 'ja' ? '月' : 'Month'}</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={goToPrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            {lang === 'ja' ? '今日' : 'Today'}
          </Button>
          <Button variant="outline" size="sm" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* AI Schedule Generator */}
      {isAdmin && viewMode !== 'month' && (
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                <CardTitle className="text-base text-foreground">
                  {lang === 'ja' ? 'AIスケジュール支援' : 'AI Schedule Assistant'}
                </CardTitle>
              </div>
              <Button
                onClick={generateAISchedule}
                disabled={isGeneratingAI}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isGeneratingAI 
                  ? (lang === 'ja' ? '生成中...' : 'Generating...') 
                  : (lang === 'ja' ? 'AI提案を生成' : 'Generate AI Suggestions')}
              </Button>
            </div>
          </CardHeader>
          
          {showAIInsights && aiSuggestions.length > 0 && (
            <CardContent>
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-foreground">
                  {lang === 'ja' ? 'AI提案' : 'AI Suggestions'}
                </h4>
                <div className="grid gap-2">
                  {aiSuggestions.slice(0, 5).map((suggestion, index) => {
                    const staffMember = getStaffById(suggestion.staffId);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm text-foreground">{staffMember?.name || suggestion.staffId}</p>
                            <p className="text-xs text-muted-foreground">
                              {parseLocalDate(suggestion.date).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US')} • {suggestion.startTime} - {suggestion.endTime}
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => applyAISuggestion(suggestion)}>
                          {lang === 'ja' ? '適用' : 'Apply'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">{totalHours.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">{lang === 'ja' ? '合計時間' : 'Total Hours'}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(totalCost, budgetConfig.currency)}
            </div>
            <div className="text-xs text-muted-foreground">{lang === 'ja' ? '人件費' : 'Labor Cost'}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">
              {displayShifts.filter(s => s.status === 'pending').length}
            </div>
            <div className="text-xs text-muted-foreground">{lang === 'ja' ? '承認待ち' : 'Pending'}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-foreground">
              {displayShifts.filter(s => s.status === 'confirmed').length}
            </div>
            <div className="text-xs text-muted-foreground">{lang === 'ja' ? '確定済み' : 'Confirmed'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={lang === 'ja' ? '役割でフィルター' : 'Filter by role'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{lang === 'ja' ? '全役割' : 'All Roles'}</SelectItem>
              <SelectItem value="Kitchen">{lang === 'ja' ? 'キッチン' : 'Kitchen'}</SelectItem>
              <SelectItem value="Floor">{lang === 'ja' ? 'ホール' : 'Floor'}</SelectItem>
              <SelectItem value="Cash">{lang === 'ja' ? 'レジ' : 'Cash'}</SelectItem>
              <SelectItem value="Acting Manager">{lang === 'ja' ? '店長代理' : 'Acting Manager'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">
              {currentDate.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getShiftsForDate(currentDate).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {lang === 'ja' ? 'シフトなし' : 'No shifts scheduled'}
              </div>
            ) : (
              <div className="space-y-2">
                {getShiftsForDate(currentDate).map((shift) => (
                  <div
                    key={shift.id}
                    onClick={() => {
                      setSelectedShift(shift);
                      setIsDialogOpen(true);
                    }}
                    className="flex items-center justify-between p-4 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{shift.staffName}</p>
                        <p className="text-sm text-muted-foreground">
                          {shift.startTime} - {shift.endTime} ({(shift.actualHours ?? shift.hours).toFixed(1)}h)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(shift.status)}
                      <div className="font-mono text-lg text-foreground">
                        {formatCurrency(shift.cost, budgetConfig.currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="grid gap-4">
          {getDisplayDates.map((date, index) => {
            const dayShifts = getShiftsForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();
            const dayName = DAYS_OF_WEEK[index];

            return (
              <Card 
                key={date.toISOString()} 
                className={`bg-card border-border ${isToday ? 'ring-2 ring-primary' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base text-foreground">
                        {dayName}, {date.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US')}
                      </CardTitle>
                      <CardDescription>
                        {dayShifts.length} {lang === 'ja' ? 'シフト' : 'shifts'} • {dayShifts.reduce((sum, s) => sum + (s.actualHours ?? s.hours), 0).toFixed(1)} {lang === 'ja' ? '時間' : 'hours'}
                      </CardDescription>
                    </div>
                    {isToday && (
                      <Badge className="bg-primary text-primary-foreground">
                        {lang === 'ja' ? '今日' : 'Today'}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {dayShifts.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      {lang === 'ja' ? 'シフトなし' : 'No shifts scheduled'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dayShifts.map((shift) => (
                        <div
                          key={shift.id}
                          onClick={() => {
                            setSelectedShift(shift);
                            setIsDialogOpen(true);
                          }}
                          className="flex items-center justify-between p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-foreground">{shift.staffName}</p>
                              <p className="text-xs text-muted-foreground">
                                {shift.startTime} - {shift.endTime} ({(shift.actualHours ?? shift.hours).toFixed(1)}h)
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(shift.status)}
                            <div className="font-mono text-sm text-foreground">
                              {formatCurrency(shift.cost, budgetConfig.currency)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {getDisplayDates.map((date) => {
                const dayShifts = getShiftsForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                
                return (
                  <div
                    key={date.toISOString()}
                    onClick={() => {
                      setCurrentDate(date);
                      setViewMode('day');
                    }}
                    className={`min-h-[80px] p-2 border rounded-lg cursor-pointer transition-colors ${
                      isToday ? 'bg-primary/20 border-primary' : 
                      !isCurrentMonth ? 'bg-muted/50 text-muted-foreground' : 'bg-secondary hover:bg-secondary/80'
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">{date.getDate()}</div>
                    <div className="space-y-1">
                      {dayShifts.slice(0, 3).map((shift) => (
                        <div key={shift.id} className="text-[10px] truncate bg-background/50 rounded px-1">
                          {shift.startTime} {shift.staffName}
                        </div>
                      ))}
                      {dayShifts.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">+{dayShifts.length - 3}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Publish Button */}
      {isAdmin && (
        <div className="flex justify-end">
          <Button onClick={handlePublishWeek} className="gap-2">
            <CheckCircle className="w-4 h-4" />
            {viewMode === 'day' ? (lang === 'ja' ? 'この日を公開' : 'Publish Day') :
             viewMode === 'week' ? (lang === 'ja' ? '今週を公開' : 'Publish Week') :
             (lang === 'ja' ? '今月を公開' : 'Publish Month')}
          </Button>
        </div>
      )}

      {/* Enhanced Shift Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {lang === 'ja' ? 'シフト詳細' : 'Shift Details'}
            </DialogTitle>
            <DialogDescription>
              {selectedShift && parseLocalDate(selectedShift.date).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US')}
            </DialogDescription>
          </DialogHeader>

          {selectedShift && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-lg text-foreground">{selectedShift.staffName}</p>
                  <p className="text-sm text-muted-foreground">
                    {getStaffById(selectedShift.staffId)?.skills.join(', ')}
                  </p>
                </div>
              </div>

              {editingShift?.id === selectedShift.id ? (
                <Card className="bg-secondary border-primary/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-foreground">
                      {lang === 'ja' ? 'シフトを編集' : 'Edit Shift'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-foreground font-medium">{lang === 'ja' ? '開始時間' : 'Start Time'}</Label>
                        <Input
                          type="time"
                          value={editStartTime}
                          onChange={(e) => setEditStartTime(e.target.value)}
                          className="text-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-foreground font-medium">{lang === 'ja' ? '終了時間' : 'End Time'}</Label>
                        <Input
                          type="time"
                          value={editEndTime}
                          onChange={(e) => setEditEndTime(e.target.value)}
                          className="text-lg"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-foreground font-medium">{lang === 'ja' ? '休憩時間（分）' : 'Break Minutes'}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editBreakMinutes}
                          onChange={(e) => setEditBreakMinutes(parseInt(e.target.value) || 0)}
                          className="text-lg"
                          min={0}
                          step={15}
                        />
                        <span className="text-muted-foreground whitespace-nowrap">
                          = {((editBreakMinutes || 0) / 60).toFixed(1)}h
                        </span>
                      </div>
                    </div>

                    {/* Change Preview */}
                    {preview && (
                      <div className="p-3 bg-background rounded-lg border border-border space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          {lang === 'ja' ? '変更プレビュー' : 'Change Preview'}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">{lang === 'ja' ? '新しい勤務時間' : 'New Hours'}:</span>
                            <span className="ml-2 font-medium text-foreground">{preview.newActualHours.toFixed(1)}h</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">{lang === 'ja' ? '変化' : 'Change'}:</span>
                            <span className={`ml-2 font-medium ${preview.diff > 0 ? 'text-green-500' : preview.diff < 0 ? 'text-red-500' : 'text-foreground'}`}>
                              {preview.diff > 0 ? '+' : ''}{preview.diff.toFixed(1)}h
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-4 p-4 bg-secondary rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{lang === 'ja' ? '時間' : 'Time'}</p>
                    <p className="font-medium text-foreground text-lg">{selectedShift.startTime} - {selectedShift.endTime}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{lang === 'ja' ? '勤務時間' : 'Hours'}</p>
                    <p className="font-medium text-foreground text-lg">{(selectedShift.actualHours ?? selectedShift.hours).toFixed(1)}h</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{lang === 'ja' ? '休憩' : 'Break'}</p>
                    <p className="font-medium text-foreground text-lg">{selectedShift.breakMinutes || 0}min</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{lang === 'ja' ? '人件費' : 'Cost'}</p>
                    <p className="font-medium text-foreground text-lg">{formatCurrency(selectedShift.cost, budgetConfig.currency)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">{lang === 'ja' ? 'ステータス' : 'Status'}</p>
                    <div>{getStatusBadge(selectedShift.status)}</div>
                  </div>
                </div>
              )}

              {isAdmin && (
                <DialogFooter className="gap-2">
                  {editingShift?.id === selectedShift.id ? (
                    <>
                      <Button variant="outline" onClick={() => setEditingShift(null)} className="gap-2">
                        <X className="w-4 h-4" />
                        {lang === 'ja' ? 'キャンセル' : 'Cancel'}
                      </Button>
                      <Button onClick={handleSaveEdit} className="gap-2">
                        <Save className="w-4 h-4" />
                        {lang === 'ja' ? '変更を保存' : 'Save Changes'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => handleEditShift(selectedShift)} className="gap-2">
                        <Edit2 className="w-4 h-4" />
                        {lang === 'ja' ? '編集' : 'Edit'}
                      </Button>
                      <Button variant="destructive" onClick={() => handleDeleteShift(selectedShift.id)} className="gap-2">
                        <Trash2 className="w-4 h-4" />
                        {lang === 'ja' ? '削除' : 'Delete'}
                      </Button>
                      {selectedShift.status === 'pending' && (
                        <>
                          <Button variant="outline" onClick={() => handleRejectShift(selectedShift.id)} className="gap-2">
                            <XCircle className="w-4 h-4" />
                            {lang === 'ja' ? '却下' : 'Reject'}
                          </Button>
                          <Button onClick={() => handleApproveShift(selectedShift.id)} className="bg-green-600 hover:bg-green-700 gap-2">
                            <CheckCircle className="w-4 h-4" />
                            {lang === 'ja' ? '承認' : 'Approve'}
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}