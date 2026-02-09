'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getStaff, setStaff, deleteStaff as removeStaff } from '@/lib/storage';
import { formatCurrency } from '@/lib/currency';
import { ADMIN_PIN, SKILL_TYPES, type StaffMember, type Currency, type SkillType, type Language } from '@/lib/types';
import { t } from '@/lib/i18n';

interface StaffManagementProps {
  lang?: Language;
}

export function StaffManagement({ lang = 'ja' }: StaffManagementProps) {
  const [staff, setLocalStaff] = useState<StaffMember[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    pin: '',
    baseWage: '',
    currency: 'JPY' as Currency,
    skills: [] as SkillType[],
    phoneNumber: '',
    emergencyContact: '',
    language: 'ja' as Language,
  });

  useEffect(() => {
    setLocalStaff(getStaff());
  }, []);

  // PIN validation - auto-lowercase and limit to 4 chars (alphanumeric)
  const handlePinChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4);
    setFormData({ ...formData, pin: sanitized });
  };

  const validatePin = (pin: string, excludeId?: string): string | null => {
    if (!/^[a-z0-9]{4}$/.test(pin)) {
      return 'PIN must be exactly 4 lowercase letters/numbers';
    }
    if (pin === ADMIN_PIN.toLowerCase()) {
      return 'This PIN is reserved for admin access';
    }
    const existingStaff = staff.find(s => s.pin.toLowerCase() === pin && s.id !== excludeId);
    if (existingStaff) {
      return `PIN already in use by ${existingStaff.name}`;
    }
    return null;
  };

  const toggleSkill = (skill: SkillType) => {
    const current = formData.skills;
    if (current.includes(skill)) {
      setFormData({ ...formData, skills: current.filter(s => s !== skill) });
    } else {
      setFormData({ ...formData, skills: [...current, skill] });
    }
  };

  const resetForm = () => {
    setFormData({ name: '', pin: '', baseWage: '', currency: 'JPY', skills: [], phoneNumber: '', emergencyContact: '', language: 'ja' });
    setError('');
    setEditingId(null);
  };

  const handleAdd = () => {
    const pinError = validatePin(formData.pin);
    if (pinError) {
      setError(pinError);
      return;
    }

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (formData.skills.length === 0) {
      setError(lang === 'ja' ? '少なくとも1つのスキルを選択してください' : 'Please select at least one skill');
      return;
    }

    const newStaff: StaffMember = {
      id: crypto.randomUUID(),
      name: formData.name.trim(),
      pin: formData.pin.toLowerCase(),
      baseWage: parseFloat(formData.baseWage) || 0,
      currency: formData.currency,
      skills: formData.skills,
      createdAt: new Date().toISOString(),
      phoneNumber: formData.phoneNumber || undefined,
      emergencyContact: formData.emergencyContact || undefined,
      language: formData.language || undefined,
    };

    const updated = [...staff, newStaff];
    setStaff(updated);
    setLocalStaff(updated);
    resetForm();
    setIsAddOpen(false);
  };

  const handleEdit = (member: StaffMember) => {
    setEditingId(member.id);
    setFormData({
      name: member.name,
      pin: member.pin,
      baseWage: (member.baseWage ?? 0).toString(),
      currency: member.currency || 'JPY',
      skills: member.skills || [],
      phoneNumber: member.phoneNumber || '',
      emergencyContact: member.emergencyContact || '',
      language: member.language || 'ja',
    });
    setError('');
  };

  const handleSaveEdit = (id: string) => {
    const pinError = validatePin(formData.pin, id);
    if (pinError) {
      setError(pinError);
      return;
    }

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    const updated = staff.map(s =>
      s.id === id
        ? {
            ...s,
            name: formData.name.trim(),
            pin: formData.pin.toLowerCase(),
            baseWage: parseFloat(formData.baseWage) || 0,
            currency: formData.currency,
            skills: formData.skills,
            phoneNumber: formData.phoneNumber || undefined,
            emergencyContact: formData.emergencyContact || undefined,
            language: formData.language || undefined,
          }
        : s
    );
    setStaff(updated);
    setLocalStaff(updated);
    resetForm();
  };

  const handleDelete = (id: string) => {
    removeStaff(id);
    setLocalStaff(staff.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Staff Management</h2>
            <p className="text-sm text-muted-foreground">{staff.length} team members</p>
          </div>
        </div>

        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter name"
                />
              </div>
              <div className="space-y-2">
                <Label>4-Character PIN (lowercase/numbers)</Label>
                <Input
                  value={formData.pin}
                  onChange={(e) => handlePinChange(e.target.value)}
                  placeholder="a1b2"
                  maxLength={4}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Auto-converts to lowercase</p>
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ja' ? 'スキル（複数選択可）' : 'Skills (select all that apply)'}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SKILL_TYPES.map((skill) => (
                    <div key={skill} className="flex items-center space-x-2">
                      <Checkbox
                        id={`skill-${skill}`}
                        checked={formData.skills.includes(skill)}
                        onCheckedChange={() => toggleSkill(skill)}
                      />
                      <label
                        htmlFor={`skill-${skill}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {skill}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{lang === 'ja' ? '基本時給' : 'Base Wage'}</Label>
                  <Input
                    type="number"
                    value={formData.baseWage}
                    onChange={(e) => setFormData({ ...formData, baseWage: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(val) => setFormData({ ...formData, currency: val as Currency })}
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
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ja' ? '電話番号' : 'Phone Number'}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="09012345678"
                />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ja' ? '緊急連絡先' : 'Emergency Contact'}</Label>
                <Input
                  value={formData.emergencyContact}
                  onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                  placeholder={lang === 'ja' ? '家族の名前と電話番号' : 'Family name and phone'}
                />
              </div>
              <div className="space-y-2">
                <Label>{lang === 'ja' ? '言語' : 'Language'}</Label>
                <Select
                  value={formData.language}
                  onValueChange={(val) => setFormData({ ...formData, language: val as Language })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ja">日本語</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleAdd}>
                  Add Staff Member
                </Button>
                <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && !isAddOpen && !editingId && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No staff members yet</p>
              <p className="text-sm">Add your first team member to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{lang === 'ja' ? '名前' : 'Name'}</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>{lang === 'ja' ? 'スキル' : 'Skills'}</TableHead>
                  <TableHead>{lang === 'ja' ? '基本時給' : 'Base Wage'}</TableHead>
                  <TableHead>{lang === 'ja' ? '電話番号' : 'Phone'}</TableHead>
                  <TableHead>{lang === 'ja' ? '緊急連絡先' : 'Emergency'}</TableHead>
                  <TableHead>{lang === 'ja' ? '言語' : 'Lang'}</TableHead>
                  <TableHead className="text-right">{lang === 'ja' ? '操作' : 'Actions'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      {editingId === member.id ? (
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="h-8"
                        />
                      ) : (
                        <span className="font-medium">{member.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === member.id ? (
                        <Input
                          value={formData.pin}
                          onChange={(e) => handlePinChange(e.target.value)}
                          className="h-8 w-20 font-mono"
                          maxLength={4}
                        />
                      ) : (
                        <code className="bg-muted px-2 py-1 rounded text-sm">****</code>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === member.id ? (
                        <div className="flex flex-wrap gap-1">
                          {SKILL_TYPES.map((skill) => (
                            <Badge
                              key={skill}
                              variant={formData.skills.includes(skill) ? 'default' : 'outline'}
                              className="cursor-pointer text-xs"
                              onClick={() => toggleSkill(skill)}
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(member.skills || []).map((skill) => (
                            <Badge key={skill} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === member.id ? (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={formData.baseWage}
                            onChange={(e) => setFormData({ ...formData, baseWage: e.target.value })}
                            className="h-8 w-24"
                          />
                          <Select
                            value={formData.currency}
                            onValueChange={(val) => setFormData({ ...formData, currency: val as Currency })}
                          >
                            <SelectTrigger className="h-8 w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="JPY">JPY</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="GBP">GBP</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        formatCurrency(member.baseWage, member.currency) + '/hr'
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === member.id ? (
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/[^0-9]/g, '') })}
                          className="h-8 w-32"
                          placeholder="090..."
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{member.phoneNumber || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === member.id ? (
                        <Input
                          value={formData.emergencyContact}
                          onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                          className="h-8 w-32"
                          placeholder={lang === 'ja' ? '家族' : 'Family'}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground truncate max-w-[100px]">{member.emergencyContact || '-'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === member.id ? (
                        <Select
                          value={formData.language}
                          onValueChange={(val) => setFormData({ ...formData, language: val as Language })}
                        >
                          <SelectTrigger className="h-8 w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ja">JA</SelectItem>
                            <SelectItem value="en">EN</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="text-xs">{member.language || 'ja'}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === member.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveEdit(member.id)}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={resetForm}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(member)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(member.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}