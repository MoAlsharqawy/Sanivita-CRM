import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { queryKeys } from './useQueries';

export const useRepMutations = (repId: string) => {
  const queryClient = useQueryClient();

  const addDoctorVisit = useMutation({
    mutationFn: api.addDoctorVisit,
    onSuccess: () => {
      // Invalidate visits to refresh list
      queryClient.invalidateQueries({ queryKey: queryKeys.visits(repId) });
      // Potentially invalidate alerts if a visit resolves an overdue alert
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts(repId) });
    },
  });

  const addPharmacyVisit = useMutation({
    mutationFn: api.addPharmacyVisit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visits(repId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts(repId) });
    },
  });

  const updatePlan = useMutation({
    mutationFn: (planData: any) => api.updateRepPlan(repId, planData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plan(repId) });
    },
  });

  return {
    addDoctorVisit,
    addPharmacyVisit,
    updatePlan,
  };
};