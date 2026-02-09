'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Target,
  Settings,
  Plus,
  Save,
  X,
  Calendar,
  Edit3,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getShifts, getBudgetConfig, saveBudgetConfig, getStaff } from '@/lib/storage';
import { formatCurrency } from '@/lib/currency';
import { parseLocalDate, type BudgetConfig, type CurrencyCode } from '@/lib/types';
import { type Language } from '@/lib/i18n';

interface BudgetControlProps {
  isAdmin?: boolean;
  lang?: Language;
  onRefresh?: () => void;
}

const CURRENCIES: { code: CurrencyCode; symbol: string; name: string }[] = [
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
];

const WEEKLY_OVERRIDES_KEY = 'survival_manager_weekly_overrides';

const getWeekKey = (date: Date): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
};

const getWeekDates = (date: Date): Date[] => {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
  weekStart.setDate(diff);
  
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const StatusBadge = ({ children, color }: { children: React.ReactNode; color: 'green' | 'amber' | 'red' }) => {
  const colors = {
    green: 'bg-green-600 text-white',
    amber: 'border border-amber-400 text-amber-400',
    red: 'bg-red-600 text-white',
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

export function BudgetControl({ isAdmin = true, lang = 'ja', onRefresh }: BudgetControlProps) {
  const [shifts, setLocalShifts] = useState(getShifts());
  const [config, setConfig] = useState(getBudgetConfig());
  const [weeklyOverrides, setWeeklyOverrides] = useState<Record<string, number>>({});
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWeeklyAdjustOpen, setIsWeeklyAdjustOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<BudgetConfig>(config);
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(WEEKLY_OVERRIDES_KEY);
      if (saved) {
        try {
          setWeeklyOverrides(JSON.parse(saved));
        } catch {
          setWeeklyOverrides({});
        }
      }
    }
    setLocalShifts(getShifts());
  }, []);

  const saveWeeklyOverrides = useCallback((overrides: Record<string, number>) => {
    setWeeklyOverrides(overrides);
    if (typeof window !== 'undefined') {
      localStorage.setItem(WEEKLY_OVERRIDES_KEY, JSON.stringify(overrides));
    }
  }, []);

  const autoWeeklyRevenue = useMemo(() => {
    return config.monthlyRevenueTarget / 4.3;
  }, [config.monthlyRevenueTarget]);

  const getEffectiveWeeklyRevenue = useCallback((date: Date) => {
    const weekKey = getWeekKey(date);
    return weeklyOverrides[weekKey] ?? autoWeeklyRevenue;
  }, [weeklyOverrides, autoWeeklyRevenue]);

  const currentWeekKey = getWeekKey(currentWeekDate);
  const currentWeeklyRevenue = getEffectiveWeeklyRevenue(currentWeekDate);

  const metrics = useMemo(() => {
    const weekDates = getWeekDates(currentWeekDate);
    
    const confirmedShifts = shifts.filter(s => {
      const shiftDate = parseLocalDate(s.date);
      return weekDates.some(d => d.toDateString() === shiftDate.toDateString()) 
        && s.status === 'confirmed';
    });

    const allWeekShifts = shifts.filter(s => {
      const shiftDate = parseLocalDate(s.date);
      return weekDates.some(d => d.toDateString() === shiftDate.toDateString());
    });

    const confirmedLaborCost = confirmedShifts.reduce((sum, s) => sum + s.cost, 0);
    const projectedLaborCost = allWeekShifts.reduce((sum, s) => sum + s.cost, 0);
    
    const weeklyRev = currentWeeklyRevenue;
    const allowableLaborCost = weeklyRev * (config.targetLaborPercent / 100);
    const remainingBudget = allowableLaborCost - confirmedLaborCost;
    
    const actualLaborPercent = weeklyRev > 0 ? (confirmedLaborCost / weeklyRev) * 100 : 0;
    const projectedLaborPercent = weeklyRev > 0 ? (projectedLaborCost / weeklyRev) * 100 : 0;

    return {
      confirmedLaborCost,
      projectedLaborCost,
      allowableLaborCost,
      remainingBudget,
      actualLaborPercent,
      projectedLaborPercent,
      weekDates,
      isOverBudget: confirmedLaborCost > allowableLaborCost,
    };
  }, [shifts, currentWeekDate, currentWeeklyRevenue, config.targetLaborPercent]);

  const handleSaveSettings = () => {
    saveBudgetConfig(editConfig);
    setConfig(editConfig);
    setIsSettingsOpen(false);
    onRefresh?.();
  };

  const handleWeeklyOverride = (weekKey: string, value: number) => {
    const newOverrides = { ...weeklyOverrides };
    if (value <= 0 || Math.abs(value - autoWeeklyRevenue) < 100) {
      delete newOverrides[weekKey];
    } else {
      newOverrides[weekKey] = value;
    }
    saveWeeklyOverrides(newOverrides);
  };

  const resetWeeklyOverride = (weekKey: string) => {
    const newOverrides = { ...weeklyOverrides };
    delete newOverrides[weekKey];
    saveWeeklyOverrides(newOverrides);
  };

  const prevWeek = () => {
    const d = new Date(currentWeekDate);
    d.setDate(d.getDate() - 7);
    setCurrentWeekDate(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeekDate);
    d.setDate(d.getDate() + 7);
    setCurrentWeekDate(d);
  };

  const goToCurrentWeek = () => setCurrentWeekDate(new Date());

  const getLaborStatus = (percent: number) => {
    if (percent <= config.targetLaborPercent) return 'text-green-500';
    if (percent <= config.targetLaborPercent + 10) return 'text-amber-500';
    return 'text-red-500';
  };

  const getLaborBadge = (percent: number) => {
    if (percent <= config.targetLaborPercent) {
      return <StatusBadge color="green">{lang === 'ja' ? '良好' : 'Good'}</StatusBadge>;
    }
    if (percent <= config.targetLaborPercent + 10) {
      return <StatusBadge color="amber">{lang === 'ja' ? '注意' : 'Warning'}</StatusBadge>;
    }
    return <StatusBadge color="red">{lang === 'ja' ? '超過' : 'Over'}</StatusBadge>;
  };

  const upcomingWeeks = useMemo(() => {
    const weeks = [];
    for (let i = -2; i < 6; i++) {
      const d = new Date(currentWeekDate);
      d.setDate(d.getDate() + (i * 7));
      weeks.push({
        date: d,
        key: getWeekKey(d),
        label: d.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric' }),
      });
    }
    return weeks;
  }, [currentWeekDate, lang]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {lang === 'ja' ? '予算・利益管理' : 'Budget & Profit Control'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {lang === 'ja' ? '人件費と売上の管理' : 'Labor cost and revenue management'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsWeeklyAdjustOpen(true)} className="gap-2">
              <Calendar className="w-4 h-4" />
              {lang === 'ja' ? '週別調整' : 'Weekly Adjust'}
            </Button>
            <Button variant="outline" onClick={() => setIsSettingsOpen(true)} className="gap-2">
              <Settings className="w-4 h-4" />
              {lang === 'ja' ? '設定' : 'Settings'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between bg-secondary rounded-lg p-3">
        <Button variant="ghost" size="sm" onClick={prevWeek}>←</Button>
        <div className="text-center">
          <div className="font-medium text-foreground">
            {currentWeekDate.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { month: 'long', year: 'numeric' })}
          </div>
          <div className="text-xs text-muted-foreground">
            {lang === 'ja' ? '対象週' : 'Target Week'}: {currentWeekKey}
            {weeklyOverrides[currentWeekKey] && (
              <span className="ml-2 text-amber-400">({lang === 'ja' ? '手動設定' : 'Manual'})</span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
            {lang === 'ja' ? '今週' : 'Current'}
          </Button>
          <Button variant="ghost" size="sm" onClick={nextWeek}>→</Button>
        </div>
      </div>

      {metrics.isOverBudget && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <AlertDescription className="text-red-500">
            {lang === 'ja' 
              ? `人件費が週間許容額を${formatCurrency(Math.abs(metrics.remainingBudget), config.currency)}超過しています`
              : `Labor cost exceeds weekly allowance by ${formatCurrency(Math.abs(metrics.remainingBudget), config.currency)}`}
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <CardHeader className="pb-2">
          <CardDescription className="text-muted-foreground">
            {lang === 'ja' ? '月間売上目標' : 'Monthly Revenue Target'}
          </CardDescription>
          <div className="flex items-baseline gap-2">
            <CardTitle className="text-3xl text-foreground">
              {formatCurrency(config.monthlyRevenueTarget, config.currency)}
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              ({lang === 'ja' ? '週平均' : 'Weekly Avg'}: {formatCurrency(autoWeeklyRevenue, config.currency)})
            </span>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground flex items-center gap-1">
              {lang === 'ja' ? '週間売上予測' : 'Weekly Revenue Forecast'}
              {weeklyOverrides[currentWeekKey] ? (
                <Edit3 className="w-3 h-3 text-amber-400" />
              ) : (
                <span className="text-xs opacity-50">({lang === 'ja' ? '自動' : 'Auto'})</span>
              )}
            </CardDescription>
            <CardTitle className={`text-2xl ${weeklyOverrides[currentWeekKey] ? 'text-amber-400' : 'text-foreground'}`}>
              {formatCurrency(currentWeeklyRevenue, config.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {lang === 'ja' ? '日次平均' : 'Daily Avg'}: {formatCurrency(currentWeeklyRevenue / 7, config.currency)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              {lang === 'ja' ? '許容人件費' : 'Allowable Labor Cost'}
            </CardDescription>
            <CardTitle className="text-2xl text-foreground">
              {formatCurrency(metrics.allowableLaborCost, config.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {config.targetLaborPercent}% {lang === 'ja' ? '売上比' : 'of revenue'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              {lang === 'ja' ? '確定人件費' : 'Confirmed Labor Cost'}
            </CardDescription>
            <CardTitle className={`text-2xl ${getLaborStatus(metrics.actualLaborPercent)}`}>
              {formatCurrency(metrics.confirmedLaborCost, config.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {metrics.actualLaborPercent.toFixed(1)}% {lang === 'ja' ? '売上比' : 'of revenue'}
              </div>
              {getLaborBadge(metrics.actualLaborPercent)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              {lang === 'ja' ? '残予算' : 'Remaining Budget'}
            </CardDescription>
            <CardTitle className={`text-2xl ${metrics.remainingBudget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {metrics.remainingBudget >= 0 ? '+' : ''}{formatCurrency(metrics.remainingBudget, config.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {metrics.remainingBudget >= 0 
                ? (lang === 'ja' ? '追加可能額' : 'Available for extra shifts')
                : (lang === 'ja' ? '超過額' : 'Over budget')}
            </div>
            {metrics.projectedLaborPercent > metrics.actualLaborPercent && (
              <div className="text-xs text-amber-400 mt-1">
                ({lang === 'ja' ? '予定含む' : 'w/ pending'}: {metrics.projectedLaborPercent.toFixed(1)}%)
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {lang === 'ja' ? '人件費進捗' : 'Labor Cost Progress'}
          </CardTitle>
          <CardDescription>
            {lang === 'ja' ? '許容額に対する確定シフトの比率' : 'Confirmed shifts vs allowable amount'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{lang === 'ja' ? '確定シフト' : 'Confirmed'}</span>
              <span className={`font-medium ${getLaborStatus(metrics.actualLaborPercent)}`}>
                {metrics.actualLaborPercent.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={Math.min(metrics.actualLaborPercent, 100)} 
              className={`h-2 ${metrics.isOverBudget ? 'bg-red-200' : ''}`}
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{lang === 'ja' ? '目標率' : 'Target'}: {config.targetLaborPercent}%</span>
            <span>{lang === 'ja' ? '許容額' : 'Allowable'}: {formatCurrency(metrics.allowableLaborCost, config.currency)}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {lang === 'ja' ? '日別内訳' : 'Daily Breakdown'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.weekDates.map((date, index) => {
              const dateStr = date.toISOString().split('T')[0];
              const dayShifts = shifts.filter(s => {
                const shiftDate = parseLocalDate(s.date);
                return shiftDate.toDateString() === date.toDateString();
              });
              const dayCost = dayShifts.reduce((sum, s) => sum + s.cost, 0);
              const dayRevenue = currentWeeklyRevenue / 7;
              const dayLaborPercent = dayRevenue > 0 ? (dayCost / dayRevenue) * 100 : 0;

              return (
                <div key={dateStr} className="p-3 bg-secondary rounded-lg">
                  <div className="text-sm font-medium text-foreground">
                    {date.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {lang === 'ja' ? '人件費' : 'Labor'}: {formatCurrency(dayCost, config.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {lang === 'ja' ? '予測売上' : 'Est. Revenue'}: {formatCurrency(dayRevenue, config.currency)}
                  </div>
                  <div className={`text-xs font-medium mt-1 ${getLaborStatus(dayLaborPercent)}`}>
                    {dayLaborPercent.toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {lang === 'ja' ? '予算設定' : 'Budget Settings'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ja' ? '月次目標と人件費率を設定' : 'Set monthly target and labor rate'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-foreground">{lang === 'ja' ? '通貨' : 'Currency'}</Label>
              <Select 
                value={editConfig.currency} 
                onValueChange={(value: CurrencyCode) => setEditConfig({ ...editConfig, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">{lang === 'ja' ? '月間売上目標' : 'Monthly Revenue Target'}</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editConfig.monthlyRevenueTarget === 0 ? '' : editConfig.monthlyRevenueTarget}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setEditConfig({ ...editConfig, monthlyRevenueTarget: val === '' ? 0 : parseInt(val) });
                }}
              />
              <p className="text-xs text-muted-foreground">
                {lang === 'ja' ? '週間自動計算: ' : 'Weekly auto-calc: '}
                {formatCurrency((editConfig.monthlyRevenueTarget || 0) / 4.3, editConfig.currency)}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">{lang === 'ja' ? '目標人件費率 (%)' : 'Target Labor Cost %'}</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={editConfig.targetLaborPercent === 0 ? '' : editConfig.targetLaborPercent}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  const num = val === '' ? 0 : parseInt(val);
                  setEditConfig({ ...editConfig, targetLaborPercent: num > 100 ? 100 : num });
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
            <Button onClick={handleSaveSettings}>
              <Save className="w-4 h-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWeeklyAdjustOpen} onOpenChange={setIsWeeklyAdjustOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {lang === 'ja' ? '週別売上予測の調整' : 'Adjust Weekly Revenue Forecast'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ja' 
                ? 'イベント週（クリスマス等）は手動で調整。通常週は自動計算値を使用。' 
                : 'Adjust event weeks (Xmas, etc.). Normal weeks use auto-calc.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
            {upcomingWeeks.map((week) => {
              const isOverridden = weeklyOverrides[week.key] !== undefined;
              const autoValue = autoWeeklyRevenue;
              const currentValue = weeklyOverrides[week.key] || autoValue;
              const percentDiff = ((currentValue - autoValue) / autoValue) * 100;

              return (
                <div key={week.key} className={`p-3 rounded-lg border ${isOverridden ? 'border-amber-500/50 bg-amber-500/5' : 'border-border'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium text-foreground">{week.label} ({week.key})</div>
                      <div className="text-xs text-muted-foreground">
                        {lang === 'ja' ? '自動計算' : 'Auto'}: {formatCurrency(autoValue, config.currency)}
                      </div>
                    </div>
                    {isOverridden && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => resetWeeklyOverride(week.key)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={isOverridden ? (currentValue === 0 ? '' : Math.round(currentValue)) : ''}
placeholder={formatCurrency(autoValue, config.currency)}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        handleWeeklyOverride(week.key, val === '' ? 0 : parseInt(val));
                      }}
                      className={`${isOverridden ? 'border-amber-500/50' : ''}`}
                    />
                    {isOverridden && (
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${percentDiff > 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                        {percentDiff > 0 ? '+' : ''}{percentDiff.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  
                  {isOverridden && (
                    <div className="mt-2 text-xs text-amber-400">
                      {lang === 'ja' ? '手動設定中（自動計算を上書き）' : 'Manual override active'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsWeeklyAdjustOpen(false)}>
              {lang === 'ja' ? '完了' : 'Done'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}