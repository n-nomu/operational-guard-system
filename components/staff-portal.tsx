'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Palmtree,
  Trash2,
  MessageSquare,
  ArrowLeftRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  getShifts,
  setShifts,
  getHolidays,
  addHoliday,
  updateHoliday,
  getBudgetConfig,
  getStaff,
  getShiftSwaps,
} from '@/lib/storage';
import { formatCurrency } from '@/lib/currency';
import { ShiftSwapButton, MySwapRequests } from './shift-swap';
import {
  DAYS_OF_WEEK,
  parseLocalDate,
  formatLocalDate,
  type Session,
  type HolidayRequest,
  type Shift,
  type ManagerMessage,
} from '@/lib/types';
import { t, type Language } from '@/lib/i18n';

interface StaffPortalProps {
  session: Session;
  onRefresh?: () => void;
  lang?: Language;
  messages?: ManagerMessage[];
  openTime?: string;
  closeTime?: string;
}

export function StaffPortal({ 
  session, 
  onRefresh, 
  lang = 'ja', 
  messages = [],
  openTime = '09:00',
  closeTime = '22:00'
}: StaffPortalProps) {
  const [holidays, setLocalHolidays] = useState<HolidayRequest[]>([]);
  const [shifts, setLocalShifts] = useState<Shift[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');
  const budgetConfig = getBudgetConfig();

  // Bulk submission state
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(openTime);
  const [endTime, setEndTime] = useState(closeTime);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState('');

  useEffect(() => {
    setLocalHolidays(getHolidays());
    setLocalShifts(getShifts());
  }, []);

  // Update default times when operating hours change
  useEffect(() => {
    setStartTime(openTime);
    setEndTime(closeTime);
  }, [openTime, closeTime]);

  const staff = getStaff();
  const currentStaff = staff.find(s => s.id === session.staffId);

  const myShifts = shifts.filter(s => s.staffId === session.staffId);
  const myHolidays = holidays.filter(h => h.staffId === session.staffId);
  const pendingHolidays = holidays.filter(h => h.status === 'pending');

  // Get upcoming shifts (next 7 days) - only published ones for staff
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const upcomingShifts = myShifts
    .filter(s => {
      const shiftDate = parseLocalDate(s.date);
      return shiftDate >= today && shiftDate <= nextWeek && s.isPublished;
    })
    .sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

  // Validate time against operating hours
  const isValidTime = (time: string) => {
    return time >= openTime && time <= closeTime;
  };

  // Get next 14 days for date selection
  const getNextDays = () => {
    const days: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const nextDays = getNextDays();

  // Toggle date selection
  const toggleDateSelection = (dateStr: string) => {
    setError('');
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
    } else {
      // Check if already submitted for this date
      const existingShift = shifts.find(
        s => s.staffId === session.staffId && s.date === dateStr
      );
      const existingHoliday = holidays.find(
        h => h.staffId === session.staffId && h.date === dateStr
      );

      if (existingShift || existingHoliday) {
        setError(lang === 'ja' 
          ? `既に申請済みです: ${parseLocalDate(dateStr).toLocaleDateString('ja-JP')}`
          : `Already submitted for ${parseLocalDate(dateStr).toLocaleDateString()}`);
        return;
      }

      setSelectedDates([...selectedDates, dateStr]);
    }
  };

  // Bulk submit
  const handleBulkSubmit = () => {
    if (selectedDates.length === 0) {
      setError(lang === 'ja' ? '日付を選択してください' : 'Please select at least one date');
      return;
    }

    // Validate times against operating hours
    if (!isHoliday) {
      if (!isValidTime(startTime) || !isValidTime(endTime)) {
        setError(lang === 'ja' 
          ? `シフト時間は営業時間内(${openTime}〜${closeTime})でなければなりません`
          : `Shift times must be within operating hours (${openTime} - ${closeTime})`);
        return;
      }

      if (startTime >= endTime) {
        setError(lang === 'ja' ? '終了時間は開始時間より後でなければなりません' : 'End time must be after start time');
        return;
      }
    }

    if (isHoliday) {
      // Submit as holiday requests
      if (!holidayReason.trim()) {
        setError(lang === 'ja' ? '休暇理由を入力してください' : 'Please provide a reason for holiday');
        return;
      }

      for (const dateStr of selectedDates) {
        const request: HolidayRequest = {
          id: crypto.randomUUID(),
          staffId: session.staffId,
          staffName: session.staffName,
          date: dateStr,
          reason: holidayReason.trim(),
          status: 'pending',
          submittedAt: new Date().toISOString(),
        };
        addHoliday(request);
      }

      setLocalHolidays(getHolidays());
    } else {
      // Submit as shift requests
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const hours = (endH + endM / 60) - (startH + startM / 60);

      const newShifts: Shift[] = selectedDates.map(dateStr => ({
        id: crypto.randomUUID(),
        staffId: session.staffId,
        staffName: session.staffName,
        date: dateStr,
        startTime,
        endTime,
        hours: Math.max(0, hours),
        actualHours: Math.max(0, hours),
        cost: Math.max(0, hours) * (currentStaff?.baseWage || 0),
        status: 'pending' as const,
        isPublished: false,
      }));

      const updated = [...shifts, ...newShifts];
      setShifts(updated);
      setLocalShifts(updated);
    }

    setSelectedDates([]);
    setHolidayReason('');
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 3000);
    onRefresh?.();
  };

  // Cancel pending request (staff can delete their own)
  const handleCancelRequest = (shiftId: string) => {
    const shift = shifts.find(s => s.id === shiftId);
    if (shift && shift.staffId === session.staffId && shift.status === 'pending') {
      const updated = shifts.filter(s => s.id !== shiftId);
      setShifts(updated);
      setLocalShifts(updated);
      onRefresh?.();
    }
  };

  const handleApproveHoliday = (id: string) => {
    updateHoliday(id, 'approved');
    setLocalHolidays(holidays.map(h => h.id === id ? { ...h, status: 'approved' } : h));
  };

  const handleRejectHoliday = (id: string) => {
    updateHoliday(id, 'rejected');
    setLocalHolidays(holidays.map(h => h.id === id ? { ...h, status: 'rejected' } : h));
  };

  const getStatusBadge = (status: HolidayRequest['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="gap-1 text-amber-400 border-amber-400"><AlertCircle className="w-3 h-3" />{lang === 'ja' ? '保留中' : 'Pending'}</Badge>;
      case 'approved':
        return <Badge className="gap-1 bg-green-600 text-white"><CheckCircle className="w-3 h-3" />{lang === 'ja' ? '承認済み' : 'Approved'}</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{lang === 'ja' ? '却下' : 'Rejected'}</Badge>;
    }
  };

  const getShiftStatusBadge = (status: Shift['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="destructive" className="text-xs">REQ</Badge>;
      case 'confirmed':
        return <Badge className="text-xs bg-green-600 text-white">OK</Badge>;
      case 'modified':
        return <Badge variant="outline" className="text-xs border-amber-400 text-amber-400">MOD</Badge>;
    }
  };

  const handleSwapSuccess = () => {
    setLocalShifts(getShifts());
    onRefresh?.();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {session.isAdmin ? (lang === 'ja' ? 'スタッフポータル (管理者)' : 'Staff Portal (Admin View)') : `${t('welcome', lang)}, ${session.staffName}`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {session.isAdmin ? (lang === 'ja' ? 'リクエスト管理' : 'Manage requests') : t('submitAvailability', lang)}
          </p>
        </div>
      </div>

      {/* Manager Messages Display (Staff Dashboard) */}
      {!session.isAdmin && messages.length > 0 && (
        <Card className="bg-primary/10 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-primary">
              <MessageSquare className="w-4 h-4" />
              {t('managerMessage', lang)}
            </CardTitle>
            <CardDescription>{lang === 'ja' ? 'マネージャーからのメッセージ' : 'Messages from your manager'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {messages.map(m => (
                <div key={m.id} className="p-3 rounded-lg bg-card border border-border">
                  <p className="text-sm text-foreground">{m.text}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(m.createdAt).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Swap Requests */}
      {!session.isAdmin && <MySwapRequests session={session} lang={lang} />}

      {/* Staff Submission Form (Not shown to admin) */}
      {!session.isAdmin && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-foreground">
              <Send className="w-4 h-4 text-primary" />
              {lang === 'ja' ? '勤務可能日を申請' : 'Submit Availability'}
            </CardTitle>
            <CardDescription>{lang === 'ja' ? '日付を選択してシフトまたは休暇を申請' : 'Select dates and submit your work or holiday request'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Operating Hours Info */}
            <div className="p-3 bg-secondary rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-foreground font-medium">
                  {lang === 'ja' ? '営業時間' : 'Operating Hours'}: {openTime} - {closeTime}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === 'ja' ? 'シフト申請はこの時間内に限られます' : 'Shift requests must be within these hours'}
              </p>
            </div>

            {submitSuccess && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <AlertDescription className="text-green-500">
                  {lang === 'ja' ? '申請が送信されました！' : 'Request submitted successfully!'}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Holiday Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="holiday-mode"
                checked={isHoliday}
                onCheckedChange={setIsHoliday}
              />
              <Label htmlFor="holiday-mode" className="flex items-center gap-2 text-foreground">
                <Palmtree className="w-4 h-4" />
                {lang === 'ja' ? '休暇申請' : 'Request Holiday/Time Off'}
              </Label>
            </div>

            {/* Date Selection Grid */}
            <div className="space-y-2">
              <Label className="text-foreground">{lang === 'ja' ? '日付を選択（複数選択可）' : 'Select Date(s) - Bulk Submit Enabled'}</Label>
              <div className="grid grid-cols-7 gap-2">
                {nextDays.map((date) => {
                  const dateStr = formatLocalDate(date);
                  const isSelected = selectedDates.includes(dateStr);
                  const hasExisting = shifts.some(s => s.staffId === session.staffId && s.date === dateStr) ||
                                     holidays.some(h => h.staffId === session.staffId && h.date === dateStr);
                  const dayOfWeek = date.getDay();
                  const dayName = DAYS_OF_WEEK[dayOfWeek === 0 ? 6 : dayOfWeek - 1];

                  return (
                    <button
                      key={dateStr}
                      onClick={() => toggleDateSelection(dateStr)}
                      disabled={hasExisting}
                      className={`p-2 rounded-lg text-center text-sm border transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : hasExisting
                            ? 'bg-muted text-muted-foreground border-muted cursor-not-allowed'
                            : 'bg-secondary border-border hover:border-primary text-foreground'
                      }`}
                    >
                      <div className="text-[10px] opacity-70">{dayName}</div>
                      <div className="font-medium">{date.getDate()}</div>
                    </button>
                  );
                })}
              </div>
              {selectedDates.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedDates.length} {lang === 'ja' ? '日選択中' : 'date(s) selected'}
                </p>
              )}
            </div>

            {/* Time Selection (only if not holiday) - Using Input type="time" */}
            {!isHoliday && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">{lang === 'ja' ? '開始時間' : 'Start Time'}</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    min={openTime}
                    max={closeTime}
                    step="1800"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{lang === 'ja' ? '終了時間' : 'End Time'}</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    min={openTime}
                    max={closeTime}
                    step="1800"
                  />
                </div>
              </div>
            )}

            {/* Holiday Reason (only if holiday) */}
            {isHoliday && (
              <div className="space-y-2">
                <Label className="text-foreground">{lang === 'ja' ? '休暇理由' : 'Reason for Time Off'}</Label>
                <Textarea
                  value={holidayReason}
                  onChange={(e) => setHolidayReason(e.target.value)}
                  placeholder={lang === 'ja' ? '理由を入力してください...' : 'Please describe your reason...'}
                  rows={3}
                />
              </div>
            )}

            <Button
              onClick={handleBulkSubmit}
              disabled={selectedDates.length === 0 || (isHoliday && !holidayReason.trim())}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              {lang === 'ja' 
                ? `${selectedDates.length > 1 ? `${selectedDates.length}件` : ''}申請を送信` 
                : `Submit ${selectedDates.length > 1 ? `${selectedDates.length} Requests` : 'Request'}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Staff View - Their Upcoming Shifts with Swap Button */}
      {!session.isAdmin && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-foreground">
              <Clock className="w-4 h-4 text-primary" />
              {lang === 'ja' ? 'あなたの今後のシフト' : 'Your Upcoming Shifts'}
            </CardTitle>
            <CardDescription>{lang === 'ja' ? '今後7日間（公開済み）' : 'Next 7 days (published schedule)'}</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingShifts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{lang === 'ja' ? '今後7日間に公開済みシフトはありません' : 'No published shifts for the next 7 days'}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingShifts.map((shift) => {
                  const shiftDate = parseLocalDate(shift.date);
                  const dayName = DAYS_OF_WEEK[shiftDate.getDay() === 0 ? 6 : shiftDate.getDay() - 1];
                  const isToday = shiftDate.toDateString() === today.toDateString();

                  return (
                    <div
                      key={shift.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isToday ? 'bg-primary/20 border border-primary/30' : 'bg-secondary'
                      }`}
                    >
                      <div>
                        <div className="font-medium flex items-center gap-2 text-foreground">
                          {dayName}, {shiftDate.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US')}
                          {isToday && <Badge className="text-xs">{lang === 'ja' ? '今日' : 'Today'}</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {shift.startTime} - {shift.endTime} ({(shift.actualHours ?? shift.hours).toFixed(1)} {lang === 'ja' ? '時間' : 'hours'})
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getShiftStatusBadge(shift.status)}
                        <div className="font-mono text-sm text-foreground">
                          {formatCurrency(shift.cost, budgetConfig.currency)}
                        </div>
                        <ShiftSwapButton
                          session={session}
                          shift={shift}
                          onSuccess={handleSwapSuccess}
                          lang={lang}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Staff View - My Pending Requests (can delete) */}
      {!session.isAdmin && myShifts.filter(s => s.status === 'pending').length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">{lang === 'ja' ? '保留中の申請' : 'My Pending Requests'}</CardTitle>
            <CardDescription>{lang === 'ja' ? '管理者が確認する前にキャンセル可能' : 'You can cancel these before admin confirms'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">{lang === 'ja' ? '日付' : 'Date'}</TableHead>
                  <TableHead className="text-foreground">{lang === 'ja' ? '時間' : 'Time'}</TableHead>
                  <TableHead className="text-foreground">{lang === 'ja' ? 'ステータス' : 'Status'}</TableHead>
                  <TableHead className="text-right text-foreground">{lang === 'ja' ? '操作' : 'Action'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myShifts.filter(s => s.status === 'pending').map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="text-foreground">{parseLocalDate(shift.date).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US')}</TableCell>
                    <TableCell className="text-foreground">{shift.startTime} - {shift.endTime}</TableCell>
                    <TableCell>{getShiftStatusBadge(shift.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleCancelRequest(shift.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* My Holiday Requests (Staff View) */}
      {!session.isAdmin && myHolidays.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">{lang === 'ja' ? '休暇申請' : 'My Holiday Requests'}</CardTitle>
            <CardDescription>{myHolidays.length} {lang === 'ja' ? '件' : 'request(s)'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">{lang === 'ja' ? '日付' : 'Date'}</TableHead>
                  <TableHead className="text-foreground">{lang === 'ja' ? '理由' : 'Reason'}</TableHead>
                  <TableHead className="text-foreground">{lang === 'ja' ? 'ステータス' : 'Status'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myHolidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="text-foreground">{parseLocalDate(holiday.date).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US')}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-foreground">{holiday.reason}</TableCell>
                    <TableCell>{getStatusBadge(holiday.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Admin View - Pending Approvals */}
      {session.isAdmin && pendingHolidays.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground">{lang === 'ja' ? '休暇承認待ち' : 'Pending Holiday Approvals'}</CardTitle>
            <CardDescription>{pendingHolidays.length} {lang === 'ja' ? '件の申請' : 'request(s) pending'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">{lang === 'ja' ? 'スタッフ' : 'Staff'}</TableHead>
                  <TableHead className="text-foreground">{lang === 'ja' ? '日付' : 'Date'}</TableHead>
                  <TableHead className="text-foreground">{lang === 'ja' ? '理由' : 'Reason'}</TableHead>
                  <TableHead className="text-right text-foreground">{lang === 'ja' ? '操作' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingHolidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium text-foreground">{holiday.staffName}</TableCell>
                    <TableCell className="text-foreground">{parseLocalDate(holiday.date).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US')}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-foreground">{holiday.reason}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleApproveHoliday(holiday.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectHoliday(holiday.id)}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
