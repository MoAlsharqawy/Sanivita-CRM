
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { api } from '../services/api';
import { Doctor, Pharmacy, Product, VisitReport, Region, ClientAlert, SystemSettings, WeeklyPlan, RepTask, RepAbsence, Expense } from '../types';
import { 
    DoctorIcon, PharmacyIcon, CalendarIcon, SearchIcon, WarningIcon, 
    UserGroupIcon, DownloadIcon, ChartBarIcon, GraphIcon, CalendarPlusIcon, 
    ClipboardCheckIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, MapPinIcon, SunIcon 
} from './icons';
import Modal from './Modal';
import VisitForm from './VisitForm';
import ClientSearch from './ClientSearch';
import Spinner from './Spinner';

const RepDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [recentVisits, setRecentVisits] = useState<VisitReport[]>([]);
  const [alerts, setAlerts] = useState<ClientAlert[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [pendingTasks, setPendingTasks] = useState<RepTask[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [view, setView] = useState<'dashboard' | 'search' | 'weekly' | 'plan' | 'expenses'>('dashboard');

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<'Fuel' | 'Meals' | 'Samples' | 'Other'>('Fuel');
  const [expenseDesc, setExpenseDesc] = useState('');

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [d, ph, pr, v, reg, al, s, pl, t, ex] = await Promise.all([
        api.getDoctorsForRep(user.id), api.getPharmaciesForRep(user.id),
        api.getProducts(), api.getVisitReportsForRep(user.id),
        api.getRegionsForRep(user.id), api.getOverdueVisits(),
        api.getSystemSettings(), api.getRepPlan(user.id),
        api.getPendingTasksForRep(user.id), api.getExpenses(user.id)
      ]);
      setDoctors(d); setPharmacies(ph); setProducts(pr); setRecentVisits(v);
      setRegions(reg); setAlerts(al.filter(a => a.repId === user.id));
      setSystemSettings(s); setPlan(pl); setPendingTasks(t); setExpenses(ex);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !expenseAmount) return;
    await api.addExpense({
      repId: user.id,
      amount: parseFloat(expenseAmount),
      category: expenseCategory,
      description: expenseDesc,
      date: new Date().toISOString().split('T')[0]
    });
    setExpenseAmount(''); setExpenseDesc(''); setIsExpenseModalOpen(false);
    fetchData();
  };

  if (loading) return <Spinner />;
  if (!user) return null;

  if (view === 'search') return <ClientSearch user={user} onBack={() => setView('dashboard')} />;

  return (
    <div className="container mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h2 className="text-3xl font-bold text-blue-800">{t('good_morning', user.name)}</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setView('search')} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2"><SearchIcon className="w-5 h-5"/>{t('search_client')}</button>
          <button onClick={() => setIsExpenseModalOpen(true)} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center gap-2"><DownloadIcon className="w-5 h-5"/>{t('add_expense')}</button>
          <button onClick={() => setIsModalOpen(true)} className="bg-orange-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg">{t('new_visit_registration')}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
           <p className="text-slate-600 font-medium mb-2">{t('visits_this_month')}</p>
           <p className="text-4xl font-bold text-blue-800">{recentVisits.length}</p>
        </div>
        <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
           <p className="text-slate-600 font-medium mb-2">{t('my_expenses')}</p>
           <p className="text-4xl font-bold text-purple-800">{expenses.length}</p>
        </div>
      </div>

      <div className="mt-8 bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
        <h3 className="text-xl font-semibold mb-4 text-blue-700">{t('my_expenses')}</h3>
        <ul className="space-y-3">
          {expenses.map(e => (
            <li key={e.id} className="p-3 bg-white/30 rounded-lg flex justify-between items-center">
              <div>
                <p className="font-bold">{t(e.category)}: {e.amount}</p>
                <p className="text-xs text-slate-500">{e.date} - {e.description}</p>
              </div>
              <span className={`px-2 py-1 text-xs font-bold rounded-full status-${e.status}`}>{t(`status_${e.status}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      {isModalOpen && <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('new_visit_registration')}><VisitForm user={user} products={products} doctors={doctors} pharmacies={pharmacies} regions={regions} onSuccess={() => { setIsModalOpen(false); fetchData(); }} onCancel={() => setIsModalOpen(false)} /></Modal>}
      {isExpenseModalOpen && (
        <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title={t('add_expense')}>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <div><label className="block text-sm font-medium">{t('amount')}</label><input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} className="w-full p-2 border rounded-lg" required /></div>
            <div><label className="block text-sm font-medium">{t('category')}</label><select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value as any)} className="w-full p-2 border rounded-lg"><option value="Fuel">{t('Fuel')}</option><option value="Meals">{t('Meals')}</option><option value="Samples">{t('Samples')}</option><option value="Other">{t('Other')}</option></select></div>
            <div><label className="block text-sm font-medium">{t('description')}</label><input type="text" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} className="w-full p-2 border rounded-lg" required /></div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg">{t('save')}</button>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default RepDashboard;
