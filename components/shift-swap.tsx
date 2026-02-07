'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getStaff, addShiftSwap, getShiftSwaps } from '@/lib/storage';
import { ArrowLeftRight } from 'lucide-react';
import { parseLocalDate, type Session, type Shift, type ShiftSwapRequest } from '@/lib/types';
import { type Language } from '@/lib/i18n';

interface ShiftSwapButtonProps {
  session: Session;
  shift: Shift;
  onSuccess: () => void;
  lang?: Language;
}

export function ShiftSwapButton({ session, shift, onSuccess, lang = 'ja' }: ShiftSwapButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [reason, setReason] = useState('');
  
  const staff = getStaff().filter(s => s.id !== session.staffId);
  
  const handleSubmit = () => {
    const targetStaff = staff.find(s => s.id === targetStaffId);
    if (!targetStaff) return;
    
    const request: ShiftSwapRequest = {
      id: crypto.randomUUID(),
      fromStaffId: session.staffId,
      fromStaffName: session.staffName,
      toStaffId: targetStaffId,
      toStaffName: targetStaff.name,
      shiftId: shift.id,
      shiftDate: shift.date,
      shiftTime: `${shift.startTime}-${shift.endTime}`,
      reason: reason.trim() || undefined,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };
    
    addShiftSwap(request);
    setIsOpen(false);
    setTargetStaffId('');
    setReason('');
    onSuccess();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2 bg-transparent">
          <ArrowLeftRight className="w-3 h-3" />
          {lang === 'ja' ? '交代依頼' : 'Swap'}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {lang === 'ja' ? 'シフト交代依頼' : 'Request Shift Swap'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="p-3 bg-secondary rounded-lg">
            <div className="text-sm text-muted-foreground">
              {lang === 'ja' ? '対象シフト' : 'Target Shift'}
            </div>
            <div className="font-medium text-foreground">
              {parseLocalDate(shift.date).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US')} {shift.startTime}-{shift.endTime}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-foreground">
              {lang === 'ja' ? '交代相手を選択' : 'Select Staff to Swap With'}
            </Label>
            <Select value={targetStaffId} onValueChange={setTargetStaffId}>
              <SelectTrigger>
                <SelectValue placeholder={lang === 'ja' ? 'スタッフを選択' : 'Select staff'} />
              </SelectTrigger>
              <SelectContent>
                {staff.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-foreground">
              {lang === 'ja' ? '理由（任意）' : 'Reason (optional)'}
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={lang === 'ja' ? '交代理由を入力...' : 'Enter reason for swap...'}
              rows={3}
            />
          </div>
          
          <Button onClick={handleSubmit} disabled={!targetStaffId} className="w-full">
            {lang === 'ja' ? '交代依頼を送信' : 'Submit Swap Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Staff view of their swap requests
interface MySwapRequestsProps {
  session: Session;
  lang?: Language;
}

export function MySwapRequests({ session, lang = 'ja' }: MySwapRequestsProps) {
  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);

  useEffect(() => {
    setSwaps(getShiftSwaps().filter(s => 
      s.fromStaffId === session.staffId || s.toStaffId === session.staffId
    ));
  }, [session.staffId]);

  if (swaps.length === 0) return null;
  
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-foreground">
          <ArrowLeftRight className="w-4 h-4 text-primary" />
          {lang === 'ja' ? 'シフト交代リクエスト' : 'Shift Swap Requests'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {swaps.map(swap => (
            <div key={swap.id} className="p-3 rounded-lg bg-secondary flex items-center justify-between">
              <div>
                <div className="font-medium text-foreground">
                  {swap.fromStaffId === session.staffId 
                    ? `→ ${swap.toStaffName}` 
                    : `← ${swap.fromStaffName}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {parseLocalDate(swap.shiftDate).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US')} {swap.shiftTime}
                </div>
                {swap.reason && (
                  <div className="text-xs text-muted-foreground mt-1">{swap.reason}</div>
                )}
              </div>
              <Badge variant={
                swap.status === 'pending' ? 'outline' :
                swap.status === 'approved' ? 'default' : 'destructive'
              }>
                {swap.status === 'pending' 
                  ? (lang === 'ja' ? '保留中' : 'Pending') 
                  : swap.status === 'approved' 
                    ? (lang === 'ja' ? '承認済み' : 'Approved') 
                    : (lang === 'ja' ? '却下' : 'Rejected')}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
