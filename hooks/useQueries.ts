import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { User } from '../types';

// Query Keys Factory for type safety and consistency
export const queryKeys = {
  all: ['data'] as const,
  doctors: (repId: string) => [...queryKeys.all, 'doctors', repId] as const,
  pharmacies: (repId: string) => [...queryKeys.all, 'pharmacies', repId] as const,
  products: () => [...queryKeys.all, 'products'] as const,
  regions: () => [...queryKeys.all, 'regions'] as const,
  visits: (repId: string) => [...queryKeys.all, 'visits', repId] as const,
  alerts: (repId: string) => [...queryKeys.all, 'alerts', repId] as const,
  settings: () => [...queryKeys.all, 'settings'] as const,
  plan: (repId: string) => [...queryKeys.all, 'plan', repId] as const,
};

export const useRepData = (user: User | null) => {
  const enabled = !!user;
  const repId = user?.id || '';

  const doctorsQuery = useQuery({
    queryKey: queryKeys.doctors(repId),
    queryFn: () => api.getDoctorsForRep(repId),
    enabled,
  });

  const pharmaciesQuery = useQuery({
    queryKey: queryKeys.pharmacies(repId),
    queryFn: () => api.getPharmaciesForRep(repId),
    enabled,
  });

  const productsQuery = useQuery({
    queryKey: queryKeys.products(),
    queryFn: api.getProducts,
    enabled,
    staleTime: Infinity, // Products rarely change
  });

  const regionsQuery = useQuery({
    queryKey: queryKeys.regions(),
    queryFn: api.getRegions,
    enabled,
    staleTime: Infinity,
  });

  const visitsQuery = useQuery({
    queryKey: queryKeys.visits(repId),
    queryFn: () => api.getVisitReportsForRep(repId),
    enabled,
  });

  const alertsQuery = useQuery({
    queryKey: queryKeys.alerts(repId),
    queryFn: () => api.getOverdueVisits(),
    enabled,
    select: (data) => data.filter(a => a.repId === repId),
  });

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings(),
    queryFn: api.getSystemSettings,
    enabled,
    staleTime: 1000 * 60 * 60, // Settings unlikely to change often in session
  });

  const planQuery = useQuery({
    queryKey: queryKeys.plan(repId),
    queryFn: () => api.getRepPlan(repId),
    enabled,
  });

  // Aggregate loading state
  const isLoading = 
    doctorsQuery.isLoading || 
    pharmaciesQuery.isLoading || 
    productsQuery.isLoading || 
    visitsQuery.isLoading || 
    regionsQuery.isLoading || 
    alertsQuery.isLoading ||
    settingsQuery.isLoading ||
    planQuery.isLoading;

  return {
    doctors: doctorsQuery.data || [],
    pharmacies: pharmaciesQuery.data || [],
    products: productsQuery.data || [],
    regions: regionsQuery.data || [],
    recentVisits: visitsQuery.data || [],
    alerts: alertsQuery.data || [],
    systemSettings: settingsQuery.data || null,
    plan: planQuery.data || null,
    isLoading,
    // Expose raw queries if needed for refetching
    visitsQuery,
    planQuery
  };
};