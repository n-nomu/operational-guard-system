'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Target,
  Calculator,
  Settings,
  Plus,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { getShifts, getBudgetConfig, setBudgetConfig, getStaff, getAppSettings } from '@/lib/storage';
import { formatCurrency } from '@/lib/currency';
import { parseLocalDate, type BudgetConfig, type CurrencyCode } from '@/lib/types';
import { t, type Language } from '@/lib/i18n';

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

export function BudgetControl({ isAdmin = false, lang = 'ja', onRefresh }: BudgetControlProps) {
  const [shifts, setLocalShifts] = useState(getShifts());
  const [config, setConfig] = useState(getBudgetConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRevenueOpen, setIsRevenueOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<BudgetConfig>(config);
  const [dailyRevenue, setDailyRevenue] = useState<Record<string, number>>({});
  const settings = getAppSettings();

  useEffect(() => {
    setLocalShifts(getShifts());
  }, []);

  // Calculate weekly metrics
  const calculateMetrics = () => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday

    const weekDates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      weekDates.push(date);
    }

    // 確定シフトのみで実績人件費を計算（修正）
    const confirmedShifts = shifts.filter(s => {
      const shiftDate = parseLocalDate(s.date);
      return weekDates.some(d => d.toDateString() === shiftDate.toDateString()) 
        && s.status === 'confirmed'; // 確定シフトのみ
    });

    const projectedShifts = shifts.filter(s => {
      const shiftDate = parseLocalDate(s.date);
      return weekDates.some(d => d.toDateString() === shiftDate.toDateString());
    });

    const confirmedLaborCost = confirmedShifts.reduce((sum, s) => sum + s.cost, 0);
    const projectedLaborCost = projectedShifts.reduce((sum, s) => sum + s.cost, 0);

    // 実績人件費率（確定シフト ÷ 週間目標）
    const actualLaborPercent = config.weeklyRevenue > 0 
      ? (confirmedLaborCost / config.weeklyRevenue) * 100 
      : 0;

    // 予定人件費率（全シフト ÷ 週間目標）
    const projectedLaborPercent = config.weeklyRevenue > 0
      ? (projectedLaborCost / config.weeklyRevenue) * 100
      : 0;

    const targetLaborCost = config.weeklyRevenue * (config.targetLaborPercent / 100);
    const variance = confirmedLaborCost - targetLaborCost;

    return {
      confirmedLaborCost,
      projectedLaborCost,
      actualLaborPercent,
      projectedLaborPercent,
      targetLaborCost,
      variance,
      weekDates,
    };
  };

  const metrics = useMemo(() => calculateMetrics(), [shifts, config]);

  // Daily revenue input
  const handleRevenueSubmit = (date: string, revenue: number) => {
    setDailyRevenue(prev => ({ ...prev, [date]: revenue }));
    setIsRevenueOpen(false);
  };

  // Save budget settings
  const handleSaveSettings = () => {
    setBudgetConfig(editConfig);
    setConfig(editConfig);
    setIsSettingsOpen(false);
    onRefresh?.();
  };

  // Get status color based on labor percentage
  const getLaborStatus = (percent: number) => {
    if (percent <= config.targetLaborPercent) return 'text-green-500';
    if (percent <= config.targetLaborPercent + 10) return 'text-amber-500';
    return 'text-red-500';
  };

  const getLaborBadge = (percent: number) => {
    if (percent <= config.targetLaborPercent) {
      return <Badge className="bg-green-600 text-white">{lang === 'ja' ? '良好' : 'Good'}</Badge>;
    }
    if (percent <= config.targetLaborPercent + 10) {
      return <Badge variant="outline" className="border-amber-400 text-amber-400">{lang === 'ja' ? '注意' : 'Warning'}</Badge>;
    }
    return <Badge variant="destructive">{lang === 'ja' ? '超過' : 'Over'}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <Button variant="outline" onClick={() => setIsRevenueOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {lang === 'ja' ? '売上入力' : 'Add Revenue'}
            </Button>
            <Button variant="outline" onClick={() => setIsSettingsOpen(true)} className="gap-2">
              <Settings className="w-4 h-4" />
              {lang === 'ja' ? '設定' : 'Settings'}
            </Button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {metrics.actualLaborPercent > config.targetLaborPercent && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <AlertDescription className="text-red-500">
            {lang === 'ja' 
              ? `人件費が売上の${config.targetLaborPercent}%を超えています。このスケジュールは赤字の可能性があります。`
              : `Labor costs exceed ${config.targetLaborPercent}% of revenue. This schedule may result in losses.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Main Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              {lang === 'ja' ? '週間売上目標' : 'Weekly Revenue Target'}
            </CardDescription>
            <CardTitle className="text-2xl text-foreground">
              {formatCurrency(config.weeklyRevenue, config.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {lang === 'ja' ? '日次' : 'Daily'}: {formatCurrency(config.weeklyRevenue / 7, config.currency)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              {lang === 'ja' ? '目標人件費' : 'Target Labor Cost'}
            </CardDescription>
            <CardTitle className="text-2xl text-foreground">
              {formatCurrency(metrics.targetLaborCost, config.currency)}
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
              {lang === 'ja' ? '実績人件費' : 'Actual Labor Cost'}
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
            {metrics.projectedLaborPercent > metrics.actualLaborPercent && (
              <div className="text-xs text-amber-400 mt-1">
                ({lang === 'ja' ? '予定' : 'proj'}: {metrics.projectedLaborPercent.toFixed(1)}%)
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="text-muted-foreground">
              {lang === 'ja' ? '差異' : 'Variance'}
            </CardDescription>
            <CardTitle className={`text-2xl ${metrics.variance > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {metrics.variance > 0 ? '+' : ''}{formatCurrency(metrics.variance, config.currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {metrics.variance > 0 
                ? (lang === 'ja' ? '予算超過' : 'Over budget')
                : (lang === 'ja' ? '予算内' : 'Under budget')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Labor Cost Progress */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base text-foreground">
            {lang === 'ja' ? '人件費進捗' : 'Labor Cost Progress'}
          </CardTitle>
          <CardDescription>
            {lang === 'ja' ? '目標に対する実績' : 'Actual vs Target'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{lang === 'ja' ? '実績' : 'Actual'}</span>
              <span className={`font-medium ${getLaborStatus(metrics.actualLaborPercent)}`}>
                {metrics.actualLaborPercent.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={Math.min(metrics.actualLaborPercent, 100)} 
              className="h-2"
            />
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{lang === 'ja' ? '目標' : 'Target'}: {config.targetLaborPercent}%</span>
            <span>{lang === 'ja' ? '現在' : 'Current'}: {metrics.actualLaborPercent.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
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
              const dayRevenue = dailyRevenue[dateStr] || config.weeklyRevenue / 7;
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
                    {lang === 'ja' ? '売上' : 'Revenue'}: {formatCurrency(dayRevenue, config.currency)}
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

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {lang === 'ja' ? '予算設定' : 'Budget Settings'}
            </DialogTitle>
            <DialogDescription>
              {lang === 'ja' ? '人件費目標と通貨を設定' : 'Set labor cost targets and currency'}
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
              <Label className="text-foreground">{lang === 'ja' ? '週間売上目標' : 'Weekly Revenue Target'}</Label>
              <Input
                type="number"
                value={editConfig.weeklyRevenue}
                onChange={(e) => setEditConfig({ ...editConfig, weeklyRevenue: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">{lang === 'ja' ? '目標人件費率 (%)' : 'Target Labor Cost %'}</Label>
              <Input
                type="number"
                value={editConfig.targetLaborPercent}
                onChange={(e) => setEditConfig({ ...editConfig, targetLaborPercent: parseInt(e.target.value) || 0 })}
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

      {/* Revenue Input Dialog */}
      <Dialog open={isRevenueOpen} onOpenChange={setIsRevenueOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {lang === 'ja' ? '売上入力' : 'Add Daily Revenue'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {metrics.weekDates.map((date) => {
              const dateStr = date.toISOString().split('T')[0];
              return (
                <div key={dateStr} className="flex items-center gap-4">
                  <Label className="w-24 text-foreground">
                    {date.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { weekday: 'short' })}
                  </Label>
                  <Input
                    type="number"
                    placeholder={formatCurrency(config.weeklyRevenue / 7, config.currency)}
                    value={dailyRevenue[dateStr] || ''}
                    onChange={(e) => handleRevenueSubmit(dateStr, parseInt(e.target.value) || 0)}
                  />
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}