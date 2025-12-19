
export enum UserRole {
  Manager = 'MANAGER',
  Supervisor = 'SUPERVISOR',
  Rep = 'REP',
}

export enum Specialization {
  Pediatrics = 'PEDIATRICS',
  Pulmonology = 'PULMONOLOGY',
  Pharmacy = 'PHARMACY'
}

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
}

export interface Region {
  id: number;
  name: string;
}

export interface Doctor {
  id: number;
  name: string;
  regionId: number;
  repId: string;
  specialization: string;
}

export interface Pharmacy {
  id: number;
  name: string;
  regionId: number;
  repId: string;
  specialization: Specialization.Pharmacy;
}

export interface Product {
  id: number;
  name: string;
}

export interface DoctorVisit {
  id: number;
  doctorId: number;
  repId: string;
  productIds: number[];
  regionId: number;
  visitType: 'Coaching' | 'Single';
  doctorComment: string;
  date: string;
  latitude?: number;
  longitude?: number;
}

export interface PharmacyVisit {
  id: number;
  pharmacyId: number;
  repId: string;
  regionId: number;
  visitNotes: string;
  date: string;
  latitude?: number;
  longitude?: number;
}

export type Visit = (DoctorVisit & { type: 'doctor' }) | (PharmacyVisit & { type: 'pharmacy' });

export type VisitReport = {
    id: string;
    type: 'DOCTOR_VISIT' | 'PHARMACY_VISIT';
    repName: string;
    regionName: string;
    targetName: string;
    targetSpecialization?: string;
    productName?: string;
    visitType?: 'Coaching' | 'Single';
    notes: string;
    date: string;
    latitude?: number;
    longitude?: number;
};

export interface ClientAlert {
  id: string;
  name: string;
  type: 'doctor' | 'pharmacy';
  repId: string;
  repName: string;
  regionName: string;
  daysSinceLastVisit: number | null;
}

export interface SystemSettings {
  weekends: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  holidays: string[]; // YYYY-MM-DD
}

export interface DayPlanDetails {
  regionId: number;
  doctorIds: number[];
}

export interface WeeklyPlan {
  plan: {
    [dayIndex: number]: DayPlanDetails | null;
  };
  status: 'draft' | 'pending' | 'approved' | 'rejected';
}

export interface RepTask {
  id: string;
  repId: string;
  repName?: string;
  createdBy: string;
  description: string;
  isCompleted: boolean;
  createdAt: string;
  completedAt?: string;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface RepAbsence {
  id: number;
  repId: string;
  date: string;
  reason?: string;
  status: LeaveStatus;
}

export interface Expense {
  id: string;
  repId: string;
  repName?: string;
  amount: number;
  category: 'Fuel' | 'Meals' | 'Samples' | 'Other';
  description: string;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}
