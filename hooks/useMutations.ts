import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { queryKeys } from './useQueries';
import { User } from '../types';

export const useRepMutations = (repId: string) => {
  const queryClient = useQueryClient();

  const addDoctorVisit = useMutation({
    mutationFn: api.addDoctorVisit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visits(repId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts(repId) });
      // Also invalidate manager reports
      queryClient.invalidateQueries({ queryKey: queryKeys.allReports() });
      queryClient.invalidateQueries({ queryKey: queryKeys.allOverdue() });
    },
  });

  const addPharmacyVisit = useMutation({
    mutationFn: api.addPharmacyVisit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.visits(repId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts(repId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.allReports() });
      queryClient.invalidateQueries({ queryKey: queryKeys.allOverdue() });
    },
  });

  const updatePlan = useMutation({
    mutationFn: (planData: any) => api.updateRepPlan(repId, planData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plan(repId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.allPlans() });
    },
  });

  return {
    addDoctorVisit,
    addPharmacyVisit,
    updatePlan,
  };
};

export const useManagerMutations = () => {
  const queryClient = useQueryClient();

  const reviewRepPlan = useMutation({
    mutationFn: ({ repId, status }: { repId: string; status: 'approved' | 'rejected' }) => 
      api.reviewRepPlan(repId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allPlans() });
    },
  });

  const revokePlanApproval = useMutation({
    mutationFn: (repId: string) => api.revokePlanApproval(repId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allPlans() });
    },
  });

  const updateSystemSettings = useMutation({
    mutationFn: api.updateSystemSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });

  const addUser = useMutation({
    mutationFn: api.addUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });

  const updateUser = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<User> }) => api.updateUser(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });

  const deleteUser = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
    },
  });

  const resetRepData = useMutation({
    mutationFn: api.resetRepData,
    onSuccess: (_, repId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.allReports() });
      queryClient.invalidateQueries({ queryKey: queryKeys.allPlans() });
      queryClient.invalidateQueries({ queryKey: queryKeys.allOverdue() });
      queryClient.invalidateQueries({ queryKey: queryKeys.visits(repId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.plan(repId) });
    },
  });

  return {
    reviewRepPlan,
    revokePlanApproval,
    updateSystemSettings,
    addUser,
    updateUser,
    deleteUser,
    resetRepData,
  };
};