export enum UserRole {
  Manager = 'مدير',
  Supervisor = 'مشرف',
  Rep = 'مندوب',
}

export enum Specialization {
  Pediatrics = 'أطفال',
  Pulmonology = 'صدر',
  Pharmacy = 'صيدلية'
}

export interface User {
  id: number;
  name: string;
  username: string;
  password?: string; // Should not be passed to frontend in a real app
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
  repId: number;
  specialization: Specialization.Pediatrics | Specialization.Pulmonology;
}

export interface Pharmacy {
  id: number;
  name: string;
  regionId: number;
  repId: number;
  specialization: Specialization.Pharmacy;
}

export interface Product {
  id: number;
  name: string;
}

export interface DoctorVisit {
  id: number;
  doctorId: number;
  repId: number;
  productIds: number[];
  regionId: number;
  visitType: 'Coaching' | 'Single';
  doctorComment: string;
  date: string;
}

export interface PharmacyVisit {
  id: number;
  pharmacyId: number;
  repId: number;
  regionId: number;
  visitNotes: string;
  date: string;
}

export type Visit = (DoctorVisit & { type: 'doctor' }) | (PharmacyVisit & { type: 'pharmacy' });

export type VisitReport = {
    id: string;
    type: 'زيارة طبيب' | 'زيارة صيدلية';
    repName: string;
    regionName: string;
    targetName: string;
    targetSpecialization?: string;
    productName?: string;
    visitType?: 'Coaching' | 'Single';
    notes: string;
    date: string;
};

export interface ClientAlert {
  id: string; // e.g., 'doctor-1'
  name: string;
  type: 'doctor' | 'pharmacy';
  repId: number;
  repName: string;
  regionName: string;
  daysSinceLastVisit: number | null; // null if never visited
}

export interface SystemSettings {
  weekends: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  holidays: string[]; // YYYY-MM-DD
}

export interface WeeklyPlan {
  plan: {
    [dayIndex: number]: number | null; // dayIndex (0-6) -> regionId or null
  };
  status: 'draft' | 'pending' | 'approved' | 'rejected';
}