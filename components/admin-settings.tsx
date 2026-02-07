'use client';

import React, { useState, useEffect } from 'react';
import { getBudgetConfig, saveBudgetConfig, getStaff, setStaff } from '@/lib/storage';

const AdminSettings = () => {
  // Ensure all fields have default values to prevent undefined
  const [budget, setBudget] = useState(() => {
    const saved = getBudgetConfig();
    return {
      weeklyRevenue: saved.weeklyRevenue ?? 0,
      monthlyRevenueTarget: saved.monthlyRevenueTarget ?? 0,
      targetLaborPercent: saved.targetLaborPercent ?? 30,
      nightShiftStart: saved.nightShiftStart ?? '22:00',
      nightShiftEnd: saved.nightShiftEnd ?? '05:00',
      nightShiftBonus: saved.nightShiftBonus ?? 0,
      currency: saved.currency ?? 'JPY',
      storeName: saved.storeName ?? '',
    };
  });
  const [staffList, setStaffList] = useState(getStaff());

  const update = (updates: Record<string, unknown>) => {
    const newConfig = { ...budget, ...updates };
    setBudget(newConfig);
    saveBudgetConfig(newConfig);
    // アプリ全体に更新を通知
    window.dispatchEvent(new Event('budgetConfigUpdated'));
  };

  const handleNumChange = (key: string, val: string) => {
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
    update({ [key]: num });
  };

  return (
    <div className="p-4 space-y-6 bg-background min-h-screen text-foreground">
      <h1 className="text-xl font-bold text-primary border-b-2 border-primary pb-2">店舗設定</h1>
      
      <div className="space-y-4">
        <label className="block font-bold">週次目標 (¥)</label>
        <input 
          type="text" 
          className="w-full p-4 border-2 border-border rounded text-right bg-input text-foreground"
          value={(budget.weeklyRevenue ?? 0) === 0 ? '' : (budget.weeklyRevenue ?? 0).toLocaleString()}
          onChange={(e) => handleNumChange('weeklyRevenue', e.target.value)} 
        />
          
        <label className="block font-bold">月間目標 (¥)</label>
        <input 
          type="text" 
          className="w-full p-4 border-2 border-border rounded text-right bg-input text-foreground"
          value={(budget.monthlyRevenueTarget ?? 0) === 0 ? '' : (budget.monthlyRevenueTarget ?? 0).toLocaleString()}
          onChange={(e) => handleNumChange('monthlyRevenueTarget', e.target.value)} 
        />
      </div>

      <div className="p-4 bg-secondary rounded-lg">
        <p className="font-bold text-foreground">深夜手当設定</p>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div>
            <label className="text-xs text-muted-foreground">開始</label>
            <input 
              type="time" 
              className="w-full p-2 border border-border rounded bg-input text-foreground" 
              value={budget.nightShiftStart || '22:00'} 
              onChange={(e) => update({ nightShiftStart: e.target.value })} 
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">終了</label>
            <input 
              type="time" 
              className="w-full p-2 border border-border rounded bg-input text-foreground" 
              value={budget.nightShiftEnd || '05:00'} 
              onChange={(e) => update({ nightShiftEnd: e.target.value })} 
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="text-xs text-muted-foreground">深夜加算額 (¥/時)</label>
          <input 
            type="text" 
            className="w-full p-2 border border-border rounded text-right bg-input text-foreground"
            value={(budget.nightShiftBonus ?? 0) === 0 ? '' : (budget.nightShiftBonus ?? 0).toLocaleString()}
            onChange={(e) => handleNumChange('nightShiftBonus', e.target.value)}
            placeholder="0"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {budget.nightShiftStart || '22:00'}〜{budget.nightShiftEnd || '05:00'}の勤務に +¥{(budget.nightShiftBonus ?? 0).toLocaleString()}/時
        </p>
      </div>

      <div className="space-y-2">
        <p className="font-bold text-primary">スタッフスキル管理</p>
        {staffList.map(s => (
          <div key={s.id} className="p-2 border-b border-border flex justify-between items-center">
            <span className="text-foreground">{s.name}</span>
            <div className="flex gap-1 flex-wrap">
              {['新人研修', 'ホール', 'キッチン', 'レジ', '店長代理'].map(skill => (
                <button 
                  key={skill} 
                  onClick={() => {
                    const newSkills = s.skills?.includes(skill) 
                      ? s.skills.filter(k => k !== skill) 
                      : [...(s.skills || []), skill];
                    const newList = staffList.map(st => st.id === s.id ? {...st, skills: newSkills} : st);
                    setStaffList(newList); 
                    setStaff(newList);
                  }} 
                  className={`px-2 py-1 text-xs rounded ${
                    s.skills?.includes(skill) 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminSettings;
