'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Printer,
  Share2,
  Trash2,
  Plus,
  Check,
  Send,
  Sparkles,
  Filter,
  Users,
  Coffee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getShifts, setShifts, getHolidays, getStaff, getBudgetConfig, getAppSettings } from '@/lib/storage';
import { formatCurrency } from '@/lib/currency';
import { calculateShiftWage, calculateActualHours } from '@/lib/wage-calculator';
import {
  DAYS_OF_WEEK,
  parseLocalDate,
  formatLocalDate,
  SKILL_TYPES,
  type ViewMode,
  type Shift,
  type SkillType,
  type StaffRole, // Declare StaffRole here
} from '@/lib/types';
import { t, type Language } from '@/lib/i18n';

interface WeeklyCalendarProps {
  weekStart: Date;
  onWeekChange: (date: Date) => void;
  refreshTrigger: number;
  isAdmin: boolean;
  lang?: Language;
  openTime?: string;
  closeTime?: string;
  showAIScheduling?: boolean;
}

export function WeeklyCalendar({ 
  weekStart, 
  onWeekChange, 
  refreshTrigger, 
  isAdmin, 
  lang = 'ja', 
  openTime = '09:00', 
  closeTime = '22:00',
  showAIScheduling = false
}: WeeklyCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [shifts, setLocalShifts] = useState<Shift[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [filterSkill, setFilterSkill] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const printRef = useRef<HTMLDivElement>(null);

  // AI Scheduling state
  const [aiInstructions, setAiInstructions] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [shortageAlerts, setShortageAlerts] = useState<string[]>([]);

  // Form state for adding shifts
  const [formData, setFormData] = useState({
    staffId: '',
    startTime: openTime,
    endTime: closeTime,
  });

  useEffect(() => {
    setLocalShifts(getShifts());
  }, [refreshTrigger]);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      startTime: openTime,
      endTime: closeTime,
    }));
  }, [openTime, closeTime]);

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
  const holidays = getHolidays().filter(h => h.status === 'approved');
  const staff = getStaff();
  const budgetConfig = getBudgetConfig();

  const navigateWeek = (direction: number) => {
    const newDate = new Date(weekStart);
    newDate.setDate(newDate.getDate() + direction * 7);
    onWeekChange(newDate);
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(weekStart);
    newDate.setMonth(newDate.getMonth() + direction);
    onWeekChange(newDate);
  };

  const navigateDay = (direction: number) => {
    const newDate = new Date(selectedDay);
    newDate.setDate(newDate.getDate() + direction);
    setSelectedDay(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    onWeekChange(monday);
    setSelectedDay(today);
  };

  const getShiftsForDate = (date: Date) => {
    const dateStr = formatLocalDate(date);
    let filtered = shifts.filter(s => s.date === dateStr);
    
    if (filterStaff !== 'all') {
      filtered = filtered.filter(s => s.staffId === filterStaff);
    }
    
    if (filterSkill !== 'all') {
      filtered = filtered.filter(s => {
        const staffMember = staff.find(st => st.id === s.staffId);
        return staffMember?.skills?.includes(filterSkill as SkillType);
      });
    }
    
    if (filterRole !== 'all') {
      filtered = filtered.filter(s => {
        const staffMember = staff.find(st => st.id === s.staffId);
        return staffMember?.roles?.includes(filterRole as StaffRole);
      });
    }
    
    return filtered;
  };

  const getHolidaysForDate = (date: Date) => {
    const dateStr = formatLocalDate(date);
    return holidays.filter(h => h.date === dateStr);
  };

  // DELETE SHIFT - Fixed to immediately update state AND localStorage
  const handleDeleteShift = (shiftId: string) => {
    const updated = shifts.filter(s => s.id !== shiftId);
    setShifts(updated);
    setLocalShifts(updated);
  };

  // CONFIRM SHIFT (Admin only)
  const handleConfirmShift = (shiftId: string) => {
    const updated = shifts.map(s => 
      s.id === shiftId ? { ...s, status: 'confirmed' as const } : s
    );
    setShifts(updated);
    setLocalShifts(updated);
  };

  // EDIT SHIFT (Admin override) with break time support
  const handleEditShift = (shiftId: string, startTime: string, endTime: string, breakMinutes: number = 0) => {
    const shift = shifts.find(s => s.id === shiftId);
    const staffMember = staff.find(s => s.id === shift?.staffId);
    if (!staffMember || !shift) return;

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const hours = (endH + endM / 60) - (startH + startM / 60);
    const actualHours = calculateActualHours(startTime, endTime, breakMinutes);

    const updatedShift: Shift = {
      ...shift,
      startTime,
      endTime,
      hours: Math.max(0, hours),
      breakMinutes,
      actualHours,
      status: 'modified' as const,
      cost: 0, // Will be recalculated
    };

    // Calculate cost using night shift settings from BudgetConfig
    updatedShift.cost = calculateShiftWage(
      updatedShift.startTime,
      updatedShift.endTime,
      staffMember.baseWage,
      updatedShift.breakMinutes || 0
    );

    const updated = shifts.map(s => s.id === shiftId ? updatedShift : s);
    setShifts(updated);
    setLocalShifts(updated);
    setEditingShiftId(null);
  };

  // PUBLISH ALL - Make all changes visible to staff
  const handlePublishAll = () => {
    const updated = shifts.map(s => ({ ...s, isPublished: true }));
    setShifts(updated);
    setLocalShifts(updated);
  };

  const handleAddShift = () => {
    const staffMember = staff.find(s => s.id === formData.staffId);
    if (!staffMember || !selectedDate) return;

    // Check for existing shift on same date
    const existingShift = shifts.find(
      s => s.staffId === staffMember.id && s.date === selectedDate
    );
    if (existingShift) {
      alert(lang === 'ja' ? `この日付は既に登録済みです: ${staffMember.name}` : `Already submitted for this date: ${staffMember.name}`);
      return;
    }

    const [startH, startM] = formData.startTime.split(':').map(Number);
    const [endH, endM] = formData.endTime.split(':').map(Number);
    const hours = (endH + endM / 60) - (startH + startM / 60);

    const newShift: Shift = {
      id: crypto.randomUUID(),
      staffId: staffMember.id,
      staffName: staffMember.name,
      date: selectedDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      hours: Math.max(0, hours),
      actualHours: Math.max(0, hours),
      breakMinutes: 0,
      cost: 0,
      status: 'pending',
      isPublished: false,
    };

    // Calculate cost using night shift settings from BudgetConfig
    newShift.cost = calculateShiftWage(
      newShift.startTime,
      newShift.endTime,
      staffMember.baseWage,
      0
    );

    const updated = [...shifts, newShift];
    setShifts(updated);
    setLocalShifts(updated);
    setIsAddOpen(false);
    setFormData({ staffId: '', startTime: openTime, endTime: closeTime });
  };

  const openAddDialog = (date: Date) => {
    setSelectedDate(formatLocalDate(date));
    setIsAddOpen(true);
  };

  const calculateWeekStats = () => {
    const weekShifts = weekDates.flatMap(d => getShiftsForDate(d));
    const totalHours = weekShifts.reduce((sum, s) => sum + s.hours, 0);
    const totalActualHours = weekShifts.reduce((sum, s) => sum + (s.actualHours ?? s.hours), 0);
    const totalCost = weekShifts.reduce((sum, s) => sum + s.cost, 0);
    const confirmedCount = weekShifts.filter(s => s.status === 'confirmed').length;
    const pendingCount = weekShifts.filter(s => s.status === 'pending').length;
    return { totalHours, totalActualHours, totalCost, shiftCount: weekShifts.length, confirmedCount, pendingCount };
  };

  const stats = calculateWeekStats();

  const formatDateRange = () => {
    const start = weekDates[0];
    const end = weekDates[6];
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    let text = `${budgetConfig.storeName} Schedule\n${formatDateRange()}\n\n`;
    
    for (const date of weekDates) {
      const dayIndex = weekDates.indexOf(date);
      const dayShifts = getShiftsForDate(date).filter(s => s.isPublished || isAdmin);
      const dayHolidays = getHolidaysForDate(date);
      
      if (dayShifts.length > 0 || dayHolidays.length > 0) {
        text += `${DAYS_OF_WEEK[dayIndex]} (${date.getDate()}):\n`;
        for (const h of dayHolidays) {
          text += `  - ${h.staffName} (OFF)\n`;
        }
        for (const s of dayShifts) {
          text += `  - ${s.staffName}: ${s.startTime}-${s.endTime}`;
          if (s.breakMinutes && s.breakMinutes > 0) {
            text += ` (${lang === 'ja' ? '休憩' : 'break'}: ${s.breakMinutes}${lang === 'ja' ? '分' : 'm'})`;
          }
          text += '\n';
        }
        text += '\n';
      }
    }

    text += `Total: ${stats.shiftCount} shifts, ${stats.totalActualHours.toFixed(1)} hours`;

    if (navigator.share) {
      navigator.share({ title: 'Weekly Schedule', text });
    } else {
      navigator.clipboard.writeText(text);
      alert(lang === 'ja' ? 'クリップボードにコピーしました' : 'Schedule copied to clipboard!');
    }
  };

  // Status label badge
  const getStatusBadge = (shift: Shift) => {
    switch (shift.status) {
      case 'pending':
        return <Badge variant="destructive" className="text-[10px] px-1">REQ</Badge>;
      case 'confirmed':
        return <Badge className="text-[10px] px-1 bg-green-600 text-white">OK</Badge>;
      case 'modified':
        return <Badge variant="outline" className="text-[10px] px-1 border-amber-400 text-amber-400">MOD</Badge>;
    }
  };

  const unpublishedCount = shifts.filter(s => !s.isPublished).length;

  // AI Scheduling Suggestions
  const generateAISuggestions = () => {
    const suggestions: string[] = [];
    const shortages: string[] = [];

    // Parse AI instructions
    const rules: { role: StaffRole; count: number; timeSlot: string }[] = [];
    
    if (aiInstructions.trim()) {
      const lines = aiInstructions.split('\n');
      for (const line of lines) {
        const match = line.match(/(\d+)\s*(Kitchen|Floor|Cash|Acting Manager)\s*(?:at\s*)?(lunch|dinner|all)?/i);
        if (match) {
          rules.push({
            count: parseInt(match[1]),
            role: match[2] as StaffRole,
            timeSlot: match[3]?.toLowerCase() || 'all',
          });
        }
      }
    }

    // Analyze each day
    for (const date of weekDates) {
      const dateStr = formatLocalDate(date);
      const dayShifts = shifts.filter(s => s.date === dateStr);
      const dayStaffIds = new Set(dayShifts.map(s => s.staffId));
      const dayLabel = DAYS_OF_WEEK[weekDates.indexOf(date)];
      
      // Check each skill requirement
      for (const rule of rules) {
        const skillStaff = staff.filter(s =>
          s.skills?.includes(rule.role) && dayStaffIds.has(s.id)
        );
        
        if (skillStaff.length < rule.count) {
          shortages.push(
            lang === 'ja'
              ? `${dayLabel}: ${rule.role}が${rule.count - skillStaff.length}人不足`
              : `${dayLabel}: Need ${rule.count - skillStaff.length} more ${rule.role}`
          );
          
          // Suggest available staff
          const availableStaff = staff.filter(s =>
            s.skills?.includes(rule.role) && !dayStaffIds.has(s.id)
          );
          
          if (availableStaff.length > 0) {
            suggestions.push(
              lang === 'ja'
                ? `提案: ${dayLabel}に${availableStaff.map(s => s.name).join('、')}を追加`
                : `Suggestion: Add ${availableStaff.map(s => s.name).join(', ')} on ${dayLabel}`
            );
          }
        }
      }

      // Check if any day has no shifts
      if (dayShifts.length === 0) {
        suggestions.push(lang === 'ja' 
          ? `${date.toLocaleDateString('ja-JP')}にシフトがありません`
          : `No shifts on ${date.toLocaleDateString()}`);
      }
    }

    setAiSuggestions(suggestions);
    setShortageAlerts(shortages);
  };

  // Month view calendar
  const getMonthDates = () => {
    const year = weekStart.getFullYear();
    const month = weekStart.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const dates: (Date | null)[] = [];
    
    // Pad start with nulls
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < startDayOfWeek; i++) {
      dates.push(null);
    }
    
    // Add all days of month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      dates.push(new Date(year, month, d));
    }
    
    return dates;
  };

  // Render views
  const renderDayView = () => {
    const dayShifts = getShiftsForDate(selectedDay);
    const dayHolidays = getHolidaysForDate(selectedDay);

    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-foreground">
              {selectedDay.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
              })}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => navigateDay(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigateDay(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dayShifts.length === 0 && dayHolidays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {lang === 'ja' ? 'この日のシフトはありません' : 'No shifts scheduled for this day'}
            </div>
          ) : (
            <div className="space-y-2">
              {dayHolidays.map(h => (
                <div key={h.id} className="p-3 rounded-lg bg-muted flex items-center justify-between">
                  <div>
                    <span className="font-medium text-foreground">{h.staffName}</span>
                    <Badge variant="outline" className="ml-2">OFF</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{h.reason}</span>
                </div>
              ))}
              {dayShifts.filter(s => isAdmin || s.isPublished).map(shift => {
                const staffMember = staff.find(st => st.id === shift.staffId);
                return (
                  <div key={shift.id} className={`p-3 rounded-lg flex items-center justify-between ${
                    shift.status === 'pending' ? 'bg-destructive/20 border border-destructive/50' :
                    shift.status === 'confirmed' ? 'bg-green-500/20 border border-green-500/50' :
                    'bg-amber-500/20 border border-amber-500/50'
                  }`}>
                    <div>
                      <span className="font-medium text-foreground">{shift.staffName}</span>
{staffMember?.skills && (
  <span className="ml-2 text-xs text-muted-foreground">
  ({staffMember.skills.join(', ')})
  </span>
  )}
                      <div className="text-sm text-muted-foreground">
                        {shift.startTime} - {shift.endTime} ({(shift.actualHours ?? shift.hours).toFixed(1)}h)
                        {shift.breakMinutes && shift.breakMinutes > 0 && (
                          <Badge variant="outline" className="ml-2 text-amber-400 border-amber-400 text-[10px]">
                            <Coffee className="w-2 h-2 mr-1" />
                            {shift.breakMinutes}{lang === 'ja' ? '分' : 'm'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(shift)}
                      <span className="font-mono text-sm text-foreground">
                        {formatCurrency(shift.cost, budgetConfig.currency)}
                      </span>
                      {isAdmin && (
                        <div className="flex gap-1">
                          {shift.status === 'pending' && (
                            <Button size="sm" variant="ghost" onClick={() => handleConfirmShift(shift.id)}>
                              <Check className="w-4 h-4 text-green-500" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteShift(shift.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {isAdmin && (
            <Button className="mt-4 gap-2" onClick={() => openAddDialog(selectedDay)}>
              <Plus className="w-4 h-4" />
              {lang === 'ja' ? 'シフトを追加' : 'Add Shift'}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderMonthView = () => {
    const monthDates = getMonthDates();
    const monthName = weekStart.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { month: 'long', year: 'numeric' });

    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-foreground">{monthName}</CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>
          {/* Date grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthDates.map((date, i) => {
              if (!date) {
                return <div key={`empty-${i}`} className="aspect-square" />;
              }
              
              const dayShifts = getShiftsForDate(date);
              const dayHolidays = getHolidaysForDate(date);
              const isToday = date.toDateString() === new Date().toDateString();
              const hasShifts = dayShifts.length > 0 || dayHolidays.length > 0;

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => {
                    setSelectedDay(date);
                    setViewMode('day');
                  }}
                  className={`aspect-square p-1 rounded text-sm transition-colors ${
                    isToday ? 'bg-primary text-primary-foreground' :
                    hasShifts ? 'bg-secondary hover:bg-secondary/80' :
                    'hover:bg-muted'
                  }`}
                >
                  <div className="font-medium text-foreground">{date.getDate()}</div>
                  {hasShifts && (
                    <div className="text-[10px] text-muted-foreground">
                      {dayShifts.length + dayHolidays.length}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderWeekView = () => (
    <Card className="bg-card border-border overflow-hidden print-container" ref={printRef}>
      <CardContent className="p-0">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDates.map((date, i) => {
            const isToday = date.toDateString() === new Date().toDateString();
            return (
              <div
                key={i}
                className={`p-3 text-center border-r border-border last:border-r-0 ${
                  isToday ? 'bg-primary/20' : ''
                }`}
              >
                <div className="text-xs text-muted-foreground">{DAYS_OF_WEEK[i]}</div>
                <div className={`text-lg font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Shifts Grid */}
        <div className="grid grid-cols-7 min-h-[400px]">
          {weekDates.map((date, i) => {
            const dayShifts = getShiftsForDate(date).filter(s => isAdmin || s.isPublished);
            const dayHolidays = getHolidaysForDate(date);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={i}
                className={`border-r border-border last:border-r-0 p-2 space-y-1 ${
                  isToday ? 'bg-primary/5' : ''
                }`}
              >
                {/* Holidays - Gray */}
                {dayHolidays.map((holiday) => (
                  <div
                    key={holiday.id}
                    className="text-xs p-2 rounded bg-muted text-muted-foreground border border-muted shift-holiday whitespace-nowrap overflow-hidden"
                  >
                    <div className="font-medium truncate text-foreground">{holiday.staffName}</div>
                    <Badge variant="outline" className="text-[10px]">OFF</Badge>
                  </div>
                ))}

                {/* Shifts with status colors */}
                {dayShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className={`text-xs p-2 rounded group relative whitespace-nowrap overflow-hidden ${
                      shift.status === 'pending' 
                        ? 'bg-destructive/20 border-2 border-destructive/50 shift-pending' 
                        : shift.status === 'confirmed'
                          ? 'bg-green-500/20 border-2 border-green-500/50 shift-confirmed'
                          : 'bg-amber-500/20 border-2 border-amber-500/50'
                    }`}
                  >
                    {editingShiftId === shift.id ? (
                      <ShiftEditor
                        shift={shift}
                        onSave={(start, end, breakMins) => handleEditShift(shift.id, start, end, breakMins)}
                        onCancel={() => setEditingShiftId(null)}
                        openTime={openTime}
                        closeTime={closeTime}
                        lang={lang}
                      />
                    ) : (
                      <>
                        <div className="font-medium text-foreground truncate">{shift.staffName}</div>
                        <div className="text-muted-foreground">
                          {shift.startTime} - {shift.endTime}
                        </div>
                        {shift.breakMinutes && shift.breakMinutes > 0 && (
                          <Badge variant="outline" className="text-[8px] px-1 text-amber-400 border-amber-400">
                            {lang === 'ja' ? '休' : 'B'}{shift.breakMinutes}{lang === 'ja' ? '分' : 'm'}
                          </Badge>
                        )}
                        <div className="flex items-center gap-1 mt-1">
                          {getStatusBadge(shift)}
                          {!shift.isPublished && isAdmin && (
                            <Badge variant="outline" className="text-[10px] px-1 opacity-60">Draft</Badge>
                          )}
                        </div>

                        {/* Admin Actions */}
                        {isAdmin && (
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            {shift.status === 'pending' && (
                              <button
                                onClick={() => handleConfirmShift(shift.id)}
                                className="p-1 hover:bg-green-500/20 rounded"
                                title="Confirm"
                              >
                                <Check className="w-3 h-3 text-green-500" />
                              </button>
                            )}
                            <button
                              onClick={() => setEditingShiftId(shift.id)}
                              className="p-1 hover:bg-primary/20 rounded"
                              title="Edit"
                            >
                              <Calendar className="w-3 h-3 text-primary" />
                            </button>
                            <button
                              onClick={() => handleDeleteShift(shift.id)}
                              className="p-1 hover:bg-destructive/20 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {lang === 'ja' ? '週間カレンダー' : 'Weekly Calendar'}
            </h2>
            <p className="text-sm text-muted-foreground">{formatDateRange()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && unpublishedCount > 0 && (
            <Button onClick={handlePublishAll} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
              <Send className="w-4 h-4" />
              {lang === 'ja' ? `公開 (${unpublishedCount})` : `Publish (${unpublishedCount})`}
            </Button>
          )}

          {/* Filters */}
          {isAdmin && (
            <>
              <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger className="w-32">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue placeholder={lang === 'ja' ? 'スタッフ' : 'Staff'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === 'ja' ? '全員' : 'All Staff'}</SelectItem>
                  {staff.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSkill} onValueChange={setFilterSkill}>
                <SelectTrigger className="w-32">
                  <Users className="w-3 h-3 mr-1" />
                  <SelectValue placeholder={lang === 'ja' ? 'スキル' : 'Skill'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === 'ja' ? '全スキル' : 'All Skills'}</SelectItem>
                  {SKILL_TYPES.map(skill => (
                    <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-32">
                  <Filter className="w-3 h-3 mr-1" />
                  <SelectValue placeholder={lang === 'ja' ? '役割' : 'Role'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{lang === 'ja' ? '全役割' : 'All Roles'}</SelectItem>
                  {['Kitchen', 'Floor', 'Cash', 'Acting Manager'].map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{lang === 'ja' ? '日' : 'Day'}</SelectItem>
              <SelectItem value="week">{lang === 'ja' ? '週' : 'Week'}</SelectItem>
              <SelectItem value="month">{lang === 'ja' ? '月' : 'Month'}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => viewMode === 'month' ? navigateMonth(-1) : navigateWeek(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              {lang === 'ja' ? '今日' : 'Today'}
            </Button>
            <Button variant="outline" size="icon" onClick={() => viewMode === 'month' ? navigateMonth(1) : navigateWeek(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="outline" size="icon" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">{budgetConfig.storeName}</h1>
        <p className="text-lg">Schedule: {formatDateRange()}</p>
      </div>

      {/* AI Scheduling (only on Schedule page) */}
      {showAIScheduling && isAdmin && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base text-foreground">
                  {lang === 'ja' ? 'AIスケジューリング' : 'AI Scheduling Assistant'}
                </CardTitle>
                <CardDescription>
                  {lang === 'ja' ? 'スタッフルールを定義して提案を取得' : 'Define staffing rules and get suggestions'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">{lang === 'ja' ? 'スケジュール指示' : 'Scheduling Instructions'}</Label>
              <Textarea
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
                placeholder={lang === 'ja' 
                  ? "スタッフルールを1行ずつ入力:\n3 Kitchen at lunch\n2 Floor at dinner\n1 Acting Manager all"
                  : "Enter staffing rules, one per line:\n3 Kitchen at lunch\n2 Floor at dinner\n1 Acting Manager all"}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {lang === 'ja' ? '形式: [数] [役割] at [lunch/dinner/all]' : 'Format: [count] [role] at [lunch/dinner/all]'}
              </p>
            </div>

            <Button onClick={generateAISuggestions} className="gap-2">
              <Sparkles className="w-4 h-4" />
              {lang === 'ja' ? 'AI提案を生成' : 'Generate AI Suggestions'}
            </Button>

            {shortageAlerts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-amber-400">{lang === 'ja' ? '不足アラート' : 'Shortage Alerts'}</Label>
                {shortageAlerts.map((alert, i) => (
                  <Alert key={i} className="border-amber-500/50 bg-amber-500/10">
                    <AlertDescription className="text-amber-400 font-medium">{alert}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {aiSuggestions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-foreground">{lang === 'ja' ? '推奨' : 'Recommendations'}</Label>
                <div className="space-y-1">
                  {aiSuggestions.map((suggestion, i) => (
                    <div key={i} className="p-2 rounded bg-secondary text-sm text-foreground">
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calendar View */}
      {viewMode === 'day' && renderDayView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'month' && renderMonthView()}

      {/* Week Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm no-print">
        <div className="p-3 rounded-lg bg-secondary">
          <div className="text-muted-foreground">{lang === 'ja' ? '合計シフト' : 'Total Shifts'}</div>
          <div className="text-xl font-bold text-foreground">{stats.shiftCount}</div>
        </div>
        <div className="p-3 rounded-lg bg-secondary">
          <div className="text-muted-foreground">{lang === 'ja' ? '合計時間' : 'Total Hours'}</div>
          <div className="text-xl font-bold text-foreground">{stats.totalHours.toFixed(1)}</div>
        </div>
        <div className="p-3 rounded-lg bg-secondary">
          <div className="text-muted-foreground">{lang === 'ja' ? '実働時間' : 'Actual Hours'}</div>
          <div className="text-xl font-bold text-foreground">{stats.totalActualHours.toFixed(1)}</div>
        </div>
        <div className="p-3 rounded-lg bg-secondary">
          <div className="text-muted-foreground">{lang === 'ja' ? '確定' : 'Confirmed'}</div>
          <div className="text-xl font-bold text-green-500">{stats.confirmedCount}</div>
        </div>
        <div className="p-3 rounded-lg bg-secondary">
          <div className="text-muted-foreground">{lang === 'ja' ? '保留中' : 'Pending'}</div>
          <div className="text-xl font-bold text-amber-400">{stats.pendingCount}</div>
        </div>
      </div>

      {/* Add Shift Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {lang === 'ja' ? 'シフト追加' : 'Add Shift'} - {selectedDate && parseLocalDate(selectedDate).toLocaleDateString()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-3 bg-secondary rounded-lg text-sm">
              <span className="text-muted-foreground">{lang === 'ja' ? '営業時間' : 'Operating Hours'}: </span>
              <span className="text-foreground font-medium">{openTime} - {closeTime}</span>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{lang === 'ja' ? 'スタッフ' : 'Staff Member'}</Label>
              <Select
                value={formData.staffId}
                onValueChange={(v) => setFormData({ ...formData, staffId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={lang === 'ja' ? 'スタッフを選択' : 'Select staff'} />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({(s.skills || []).join(', ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">{lang === 'ja' ? '開始時間' : 'Start Time'}</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  step="1800"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">{lang === 'ja' ? '終了時間' : 'End Time'}</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  step="1800"
                />
              </div>
            </div>
            <Button onClick={handleAddShift} disabled={!formData.staffId} className="w-full">
              {lang === 'ja' ? 'シフトを追加' : 'Add Shift'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Shift Editor Component with break time support
function ShiftEditor({ 
  shift, 
  onSave, 
  onCancel,
  openTime,
  closeTime,
  lang = 'ja'
}: { 
  shift: Shift; 
  onSave: (start: string, end: string, breakMinutes: number) => void; 
  onCancel: () => void;
  openTime: string;
  closeTime: string;
  lang?: Language;
}) {
  const [start, setStart] = useState(shift.startTime);
  const [end, setEnd] = useState(shift.endTime);
  const [breakMins, setBreakMins] = useState(shift.breakMinutes || 0);

  const actualHrs = calculateActualHours(start, end, breakMins);

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <Input
        type="time"
        value={start}
        onChange={(e) => setStart(e.target.value)}
        className="h-7 text-xs"
        step="1800"
      />
      <Input
        type="time"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
        className="h-7 text-xs"
        step="1800"
      />
      <div className="flex items-center gap-1">
        <Coffee className="w-3 h-3 text-amber-400" />
        <Input
          type="number"
          value={breakMins}
          onChange={(e) => setBreakMins(parseInt(e.target.value) || 0)}
          className="h-7 text-xs w-16"
          placeholder="0"
          min={0}
          step={15}
        />
        <span className="text-[10px] text-muted-foreground">{lang === 'ja' ? '分' : 'min'}</span>
      </div>
      <div className="text-[10px] text-muted-foreground">
        {lang === 'ja' ? '実働' : 'Work'}: {actualHrs.toFixed(1)}h
      </div>
      <div className="flex gap-1">
        <Button size="sm" className="h-6 text-xs flex-1" onClick={() => onSave(start, end, breakMins)}>
          <Check className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-xs flex-1 bg-transparent" onClick={onCancel}>
          x
        </Button>
      </div>
    </div>
  );
}
