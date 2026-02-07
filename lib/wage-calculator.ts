import type { StaffMember, Shift, BudgetConfig, TimeSpecificWageAdjustment } from './types';
import { getBudgetConfig } from './storage';

/**
 * Calculate overlap hours between a shift time range and an adjustment time range
 */
function calculateTimeOverlap(
  shiftStart: Date,
  shiftEnd: Date,
  adjStart: Date,
  adjEnd: Date
): number {
  // Handle overnight adjustments (e.g., 22:00 to 05:00)
  let adjustedEnd = adjEnd;
  if (adjEnd <= adjStart) {
    adjustedEnd = new Date(adjEnd);
    adjustedEnd.setDate(adjustedEnd.getDate() + 1);
  }

  // Handle overnight shifts
  let shiftEndAdjusted = shiftEnd;
  if (shiftEnd <= shiftStart) {
    shiftEndAdjusted = new Date(shiftEnd);
    shiftEndAdjusted.setDate(shiftEndAdjusted.getDate() + 1);
  }

  // Calculate overlap
  const overlapStart = new Date(Math.max(shiftStart.getTime(), adjStart.getTime()));
  const overlapEnd = new Date(Math.min(shiftEndAdjusted.getTime(), adjustedEnd.getTime()));

  if (overlapStart < overlapEnd) {
    return (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
  }

  return 0;
}

/**
 * Calculate the wage for a shift considering night shift bonus and time-specific adjustments
 */
export function calculateShiftWage(
  startTime: string,
  endTime: string,
  baseWage: number,
  breakMinutes: number = 0
): number {
  const config = getBudgetConfig();
  
  const start = new Date(`2000/01/01 ${startTime}`);
  let end = new Date(`2000/01/01 ${endTime}`);
  if (end <= start) end.setDate(end.getDate() + 1);

  const diffMs = end.getTime() - start.getTime();
  const totalMinutes = diffMs / (1000 * 60);
  const workingMinutes = totalMinutes - breakMinutes;
  const totalHours = workingMinutes / 60;
  
  // Base wage calculation
  let totalWage = totalHours * baseWage;

  // Night shift bonus calculation
  const nightStart = new Date(`2000/01/01 ${config.nightShiftStart}`);
  let nightEnd = new Date(`2000/01/01 ${config.nightShiftEnd}`);
  if (nightEnd <= nightStart) nightEnd.setDate(nightEnd.getDate() + 1);

  // Calculate overlap between shift and night hours
  const overlapStart = new Date(Math.max(start.getTime(), nightStart.getTime()));
  const overlapEnd = new Date(Math.min(end.getTime(), nightEnd.getTime()));

  if (overlapStart < overlapEnd) {
    const nightMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60);
    const nightHours = nightMinutes / 60;
    totalWage += nightHours * config.nightShiftBonus;
  }

  // Apply time-specific wage adjustments
  const adjustments = config.timeSpecificAdjustments || [];
  for (const adjustment of adjustments) {
    if (!adjustment.enabled) continue;

    const adjStart = new Date(`2000/01/01 ${adjustment.startTime}`);
    const adjEnd = new Date(`2000/01/01 ${adjustment.endTime}`);
    
    const overlapHours = calculateTimeOverlap(start, end, adjStart, adjEnd);
    if (overlapHours > 0) {
      totalWage += overlapHours * adjustment.adjustment;
    }
  }

  return Math.round(totalWage);
}

/**
 * Calculate wage using Shift and StaffMember objects
 */
export function calculateShiftWageFromObjects(
  shift: Shift,
  staffMember: StaffMember
): number {
  return calculateShiftWage(
    shift.startTime,
    shift.endTime,
    staffMember.baseWage,
    shift.breakMinutes || 0
  );
}

/**
 * Calculate actual hours after subtracting break time
 */
export function calculateActualHours(startTime: string, endTime: string, breakMinutes: number = 0): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let totalHours = (endH + endM / 60) - (startH + startM / 60);
  if (totalHours < 0) totalHours += 24; // Handle overnight shifts
  
  const breakHours = breakMinutes / 60;
  return Math.max(0, totalHours - breakHours);
}

/**
 * Get night shift hours for display
 */
export function getNightShiftHours(startTime: string, endTime: string): number {
  const config = getBudgetConfig();
  
  const start = new Date(`2000/01/01 ${startTime}`);
  let end = new Date(`2000/01/01 ${endTime}`);
  if (end <= start) end.setDate(end.getDate() + 1);

  const nightStart = new Date(`2000/01/01 ${config.nightShiftStart}`);
  let nightEnd = new Date(`2000/01/01 ${config.nightShiftEnd}`);
  if (nightEnd <= nightStart) nightEnd.setDate(nightEnd.getDate() + 1);

  const overlapStart = new Date(Math.max(start.getTime(), nightStart.getTime()));
  const overlapEnd = new Date(Math.min(end.getTime(), nightEnd.getTime()));

  if (overlapStart < overlapEnd) {
    return (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
  }
  
  return 0;
}
