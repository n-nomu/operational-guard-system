'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Settings,
  Plus,
  Trash2,
  Calendar,
  Coffee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getBudgetConfig, setBudgetConfig, getShifts, getStaff, getSalesEntries, addSalesEntry, deleteSalesEntry } from '@/lib/storage';
import { formatCurrency } from '@/lib/currency';
import {
  parseLocalDate,
  formatLocalDate,
  type BudgetConfig,
  type Currency,
  type SalesEntry,
} from '@/lib/types';
import { t, type Language } from '@/lib/i18n';

interface BudgetControlProps {
  weekStart: Date;
  refreshTrigger: number;
  lang?: Language;
}

export function BudgetControl({ weekStart, refreshTrigger, lang = 'ja' }: BudgetControlProps) {
  const [config, setConfig] = useState<BudgetConfig>(() => getBudgetConfig());
  const [monthlyTargetInput, setMonthlyTargetInput] = useState('');
  const [weeklyTargetInput, setWeeklyTargetInput] = useState('');
  const [targetLaborPercentInput, setTargetLaborPercentInput] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isSalesOpen, setIsSalesOpen] = useState(false);
  const [salesEntries, setSalesEntriesState] = useState<SalesEntry[]>([]);

  // Sales entry form
  const [salesDate, setSalesDate] = useState(formatLocalDate(new Date()));
  const [salesType, setSalesType] = useState<SalesEntry['type']>('daily');
  const [salesAmount, setSalesAmount] = useState('');
  const [salesNote, setSalesNote] = useState('');

  useEffect(() => {
    const savedConfig = getBudgetConfig();
    setConfig(savedConfig);
    setMonthlyTargetInput(
      savedConfig.monthlyRevenueTarget && savedConfig.monthlyRevenueTarget > 0
        ? String(savedConfig.monthlyRevenueTarget)
        : ''
    );
    setWeeklyTargetInput(
      savedConfig.weeklyRevenue && savedConfig.weeklyRevenue > 0
        ? String(savedConfig.weeklyRevenue)
        : ''
    );
    setTargetLaborPercentInput(
      typeof savedConfig.targetLaborPercent === 'number'
        ? String(savedConfig.targetLaborPercent)
        : ''
    );
    setSalesEntriesState(getSalesEntries());
  }, [refreshTrigger]);

  const handleNumericInputChange = (
    rawValue: string,
    field: 'monthlyRevenueTarget' | 'weeklyRevenue',
    setInput: (val: string) => void
  ) => {
    const sanitized = rawValue.replace(/[^0-9]/g, '');
    setInput(sanitized);
    const numeric = sanitized === '' ? 0 : parseInt(sanitized, 10) || 0;
    setConfig((prev) => ({
      ...prev,
      [field]: numeric,
    }));
  };

  const getWeekDates = () => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const calculateMetrics = () => {
    const weekDates = getWeekDates();
    const shifts = getShifts();
    const staff = getStaff();
    
    const weekShifts = shifts.filter(s => {
      const shiftDate = parseLocalDate(s.date);
      return shiftDate >= weekDates[0] && shiftDate <= weekDates[6];
    });

    const totalLaborCost = weekShifts.reduce((sum, s) => sum + s.cost, 0);
    const totalHours = weekShifts.reduce((sum, s) => sum + s.hours, 0);
    const totalActualHours = weekShifts.reduce((sum, s) => sum + (s.actualHours ?? s.hours), 0);
    const totalBreakMinutes = weekShifts.reduce((sum, s) => sum + (s.breakMinutes ?? 0), 0);
    const targetLaborCost = (config.weeklyRevenue * config.targetLaborPercent) / 100;
    const actualLaborPercent = config.weeklyRevenue > 0 
      ? (totalLaborCost / config.weeklyRevenue) * 100 
      : 0;
    const variance = totalLaborCost - targetLaborCost;
    const uniqueStaff = new Set(weekShifts.map(s => s.staffId)).size;

    // Daily and weekly targets
    const dailyRevenueTarget = config.weeklyRevenue / 7;
    const dailyLaborTarget = targetLaborCost / 7;

    return {
      totalLaborCost,
      totalHours,
      totalActualHours,
      totalBreakMinutes,
      targetLaborCost,
      actualLaborPercent,
      variance,
      uniqueStaff,
      shiftCount: weekShifts.length,
      dailyRevenueTarget,
      dailyLaborTarget,
      weekShifts,
    };
  };

  const metrics = calculateMetrics();

  const getStaffingAlert = () => {
    const { actualLaborPercent } = metrics;
    
    if (actualLaborPercent < 10) {
      return {
        type: 'warning' as const,
        title: lang === 'ja' ? '人員不足リスク' : 'Understaffing Risk',
        message: lang === 'ja' 
          ? '人件費が売上の10%未満です。人員不足でサービス品質が低下する可能性があります。'
          : 'Labor cost is below 10% of revenue. You may be understaffed.',
        icon: AlertTriangle,
      };
    } else if (actualLaborPercent > 60) {
      return {
        type: 'destructive' as const,
        title: lang === 'ja' ? '利益なし警告' : 'No Profit Warning',
        message: lang === 'ja'
          ? '人件費が売上の60%を超えています。このスケジュールは赤字の可能性があります。'
          : 'Labor cost exceeds 60% of revenue. This schedule is likely unprofitable.',
        icon: TrendingDown,
      };
    } else if (actualLaborPercent > config.targetLaborPercent + 10) {
      return {
        type: 'warning' as const,
        title: lang === 'ja' ? '予算超過' : 'Over Budget',
        message: lang === 'ja'
          ? `人件費が目標を${(actualLaborPercent - config.targetLaborPercent).toFixed(1)}%超過しています。`
          : `Labor cost is ${(actualLaborPercent - config.targetLaborPercent).toFixed(1)}% above target.`,
        icon: TrendingUp,
      };
    } else if (actualLaborPercent <= config.targetLaborPercent) {
      return {
        type: 'success' as const,
        title: lang === 'ja' ? '目標達成' : 'On Target',
        message: lang === 'ja' ? '人件費は目標予算内です。' : 'Labor costs are within your target budget.',
        icon: CheckCircle,
      };
    }
    return null;
  };

  const alert = getStaffingAlert();

  const handleSaveConfig = () => {
    setBudgetConfig(config);
    setIsConfigOpen(false);
  };

  const handleAddSales = () => {
    if (!salesAmount || parseFloat(salesAmount) <= 0) return;

    const entry: SalesEntry = {
      id: crypto.randomUUID(),
      date: salesDate,
      type: salesType,
      amount: parseFloat(salesAmount),
      note: salesNote || undefined,
      createdAt: new Date().toISOString(),
    };

    addSalesEntry(entry);
    setSalesEntriesState(getSalesEntries());
    setSalesAmount('');
    setSalesNote('');
    setIsSalesOpen(false);
  };

  const handleDeleteSales = (id: string) => {
    deleteSalesEntry(id);
    setSalesEntriesState(getSalesEntries());
  };

  // Calculate actual sales from entries
  const calculateActualSales = () => {
    const weekDates = getWeekDates();
    const startDate = formatLocalDate(weekDates[0]);
    const endDate = formatLocalDate(weekDates[6]);

    const weekSales = salesEntries.filter(e => {
      return e.date >= startDate && e.date <= endDate && e.type === 'daily';
    });

    return weekSales.reduce((sum, e) => sum + e.amount, 0);
  };

  const actualWeeklySales = calculateActualSales();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {lang === 'ja' ? '予算・利益管理' : 'Budget & Profit Control'}
            </h2>
            <p className="text-sm text-muted-foreground">{config.storeName}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Add Sales Dialog */}
          <Dialog open={isSalesOpen} onOpenChange={setIsSalesOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Plus className="w-4 h-4" />
                {lang === 'ja' ? '売上入力' : 'Add Sales'}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {lang === 'ja' ? '売上データ入力' : 'Enter Sales Data'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-foreground">{lang === 'ja' ? '日付' : 'Date'}</Label>
                  <Input
                    type="date"
                    value={salesDate}
                    onChange={(e) => setSalesDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{lang === 'ja' ? '種類' : 'Type'}</Label>
                  <Select value={salesType} onValueChange={(v) => setSalesType(v as SalesEntry['type'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{lang === 'ja' ? '日次' : 'Daily'}</SelectItem>
                      <SelectItem value="weekly">{lang === 'ja' ? '週次' : 'Weekly'}</SelectItem>
                      <SelectItem value="monthly">{lang === 'ja' ? '月次' : 'Monthly'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{lang === 'ja' ? '金額' : 'Amount'}</Label>
                  <Input
                    type="number"
                    value={salesAmount}
                    onChange={(e) => setSalesAmount(e.target.value)}
                    placeholder={config.currency === 'JPY' ? '50000' : '500'}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{lang === 'ja' ? 'メモ (任意)' : 'Note (optional)'}</Label>
                  <Input
                    value={salesNote}
                    onChange={(e) => setSalesNote(e.target.value)}
                    placeholder={lang === 'ja' ? 'ランチタイム売上など' : 'e.g., Lunch sales'}
                  />
                </div>
                <Button onClick={handleAddSales} className="w-full" disabled={!salesAmount}>
                  {lang === 'ja' ? '売上を追加' : 'Add Sales Entry'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Config Dialog */}
          <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Settings className="w-4 h-4" />
                {lang === 'ja' ? '設定' : 'Configure'}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {lang === 'ja' ? '予算設定' : 'Budget Configuration'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-foreground">{lang === 'ja' ? '店舗名' : 'Store Name'}</Label>
                  <Input
                    value={config.storeName}
                    onChange={(e) => setConfig({ ...config, storeName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{lang === 'ja' ? '通貨' : 'Currency'}</Label>
                  <Select
                    value={config.currency}
                    onValueChange={(v) => setConfig({ ...config, currency: v as Currency })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JPY">JPY (¥)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{lang === 'ja' ? '月間売上目標' : 'Monthly Revenue Target'}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={monthlyTargetInput}
                    onChange={(e) =>
                      handleNumericInputChange(e.target.value, 'monthlyRevenueTarget', setMonthlyTargetInput)
                    }
                    placeholder={config.currency === 'JPY' ? '2000000' : '20000'}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{lang === 'ja' ? '週間売上目標' : 'Weekly Revenue Target'}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={weeklyTargetInput}
                    onChange={(e) =>
                      handleNumericInputChange(e.target.value, 'weeklyRevenue', setWeeklyTargetInput)
                    }
                    placeholder={config.currency === 'JPY' ? '500000' : '5000'}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">
                    {lang === 'ja' ? '目標人件費率' : 'Target Labor Cost'}: {config.targetLaborPercent}%
                  </Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={targetLaborPercentInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setTargetLaborPercentInput(raw);
                      const numeric = raw === '' ? 0 : Math.min(100, Math.max(0, parseInt(raw, 10) || 0));
                      setConfig((prev) => ({
                        ...prev,
                        targetLaborPercent: numeric,
                      }));
                    }}
                    placeholder="30"
                  />
                  <p className="text-xs text-muted-foreground">
                    {lang === 'ja'
                      ? 'フルサービスレストランの一般的な範囲: 25-35%'
                      : 'Typical range: 25-35% for full-service restaurants'}
                  </p>
                </div>
                <Button onClick={handleSaveConfig} className="w-full">
                  {lang === 'ja' ? '設定を保存' : 'Save Configuration'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alert Banner */}
      {alert && (
        <Alert 
          variant={alert.type === 'destructive' ? 'destructive' : 'default'}
          className={alert.type === 'success' ? 'border-green-500/50 bg-green-500/10' : alert.type === 'warning' ? 'border-amber-500/50 bg-amber-500/10' : ''}
        >
          <alert.icon className={`w-4 h-4 ${alert.type === 'success' ? 'text-green-500' : alert.type === 'warning' ? 'text-amber-400' : ''}`} />
          <AlertTitle className={`${alert.type === 'success' ? 'text-green-500' : alert.type === 'warning' ? 'text-amber-400' : ''}`}>
            {alert.title}
          </AlertTitle>
          <AlertDescription className={`${alert.type === 'success' ? 'text-green-500/80' : alert.type === 'warning' ? 'text-amber-400/80' : ''}`}>
            {alert.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{lang === 'ja' ? '週間売上目標' : 'Weekly Revenue'}</div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(config.weeklyRevenue, config.currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {lang === 'ja' ? '日次' : 'Daily'}: {formatCurrency(metrics.dailyRevenueTarget, config.currency)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{lang === 'ja' ? '目標人件費' : 'Target Labor Cost'}</div>
            <div className="text-2xl font-bold text-foreground">
              {formatCurrency(metrics.targetLaborCost, config.currency)}
            </div>
            <div className="text-xs text-muted-foreground">{config.targetLaborPercent}% {lang === 'ja' ? '売上比' : 'of revenue'}</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{lang === 'ja' ? '実績人件費' : 'Actual Labor Cost'}</div>
            <div className={`text-2xl font-bold ${
              metrics.variance > 0 ? 'text-destructive' : 'text-green-500'
            }`}>
              {formatCurrency(metrics.totalLaborCost, config.currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.actualLaborPercent.toFixed(1)}% {lang === 'ja' ? '売上比' : 'of revenue'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{lang === 'ja' ? '差異' : 'Variance'}</div>
            <div className={`text-2xl font-bold flex items-center gap-1 ${
              metrics.variance > 0 ? 'text-destructive' : 'text-green-500'
            }`}>
              {metrics.variance > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {metrics.variance >= 0 ? '+' : ''}{formatCurrency(metrics.variance, config.currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              {metrics.variance > 0 ? (lang === 'ja' ? '予算超過' : 'Over budget') : (lang === 'ja' ? '予算内' : 'Under budget')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hours Summary with Break Time */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            {lang === 'ja' ? '労働時間サマリー' : 'Hours Summary'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-sm text-muted-foreground">{lang === 'ja' ? '合計時間' : 'Total Hours'}</div>
              <div className="text-xl font-bold text-foreground">{metrics.totalHours.toFixed(1)}</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-sm text-muted-foreground">{lang === 'ja' ? '実働時間' : 'Actual Hours'}</div>
              <div className="text-xl font-bold text-foreground">{metrics.totalActualHours.toFixed(1)}</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Coffee className="w-3 h-3" />
                {lang === 'ja' ? '休憩合計' : 'Total Breaks'}
              </div>
              <div className="text-xl font-bold text-amber-400">{metrics.totalBreakMinutes}{lang === 'ja' ? '分' : 'm'}</div>
            </div>
            <div className="p-3 rounded-lg bg-secondary">
              <div className="text-sm text-muted-foreground">{lang === 'ja' ? 'スタッフ数' : 'Staff Count'}</div>
              <div className="text-xl font-bold text-foreground">{metrics.uniqueStaff}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Bar */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            {lang === 'ja' ? '人件費 vs 目標' : 'Labor Cost vs Target'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
            <div
              className={`absolute h-full transition-all ${
                metrics.actualLaborPercent > config.targetLaborPercent
                  ? 'bg-destructive'
                  : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(metrics.actualLaborPercent, 100)}%` }}
            />
            <div
              className="absolute h-full w-1 bg-foreground/50"
              style={{ left: `${config.targetLaborPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>0%</span>
            <span>{lang === 'ja' ? '目標' : 'Target'}: {config.targetLaborPercent}%</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      {/* Formula Visualization */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">
            {lang === 'ja' ? '計算式' : 'Formula'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-sm p-3 bg-secondary rounded-lg text-foreground">
            <div className="text-muted-foreground mb-1">
              {lang === 'ja' ? '人件費率 = (実働時間 × 平均時給) / 売上目標' : 'Labor % = (Actual Hours × Avg Wage) / Revenue Target'}
            </div>
            <div>
            ({metrics.totalActualHours.toFixed(1)} × {formatCurrency(
              getStaff().length > 0 
                ? getStaff().reduce((sum, s) => sum + s.baseWage, 0) / getStaff().length 
                : 0, 
              config.currency
            )}) / {formatCurrency(config.weeklyRevenue, config.currency)} =
              <span className={`font-bold ml-2 ${
                metrics.actualLaborPercent > config.targetLaborPercent ? 'text-destructive' : 'text-green-500'
              }`}>
                {metrics.actualLaborPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales History */}
      {salesEntries.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              {lang === 'ja' ? '売上履歴' : 'Sales History'}
            </CardTitle>
            <CardDescription>{salesEntries.length} {lang === 'ja' ? '件のエントリ' : 'entries'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-foreground">{lang === 'ja' ? '日付' : 'Date'}</TableHead>
                  <TableHead className="text-foreground">{lang === 'ja' ? '種類' : 'Type'}</TableHead>
                  <TableHead className="text-foreground">{lang === 'ja' ? '金額' : 'Amount'}</TableHead>
                  <TableHead className="text-foreground">{lang === 'ja' ? 'メモ' : 'Note'}</TableHead>
                  <TableHead className="text-right text-foreground">{lang === 'ja' ? '操作' : 'Action'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesEntries.slice(0, 10).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-foreground">{parseLocalDate(entry.date).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {entry.type === 'daily' ? (lang === 'ja' ? '日次' : 'Daily') :
                         entry.type === 'weekly' ? (lang === 'ja' ? '週次' : 'Weekly') :
                         (lang === 'ja' ? '月次' : 'Monthly')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-foreground">{formatCurrency(entry.amount, config.currency)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[150px] truncate">{entry.note || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteSales(entry.id)}
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
    </div>
  );
}
