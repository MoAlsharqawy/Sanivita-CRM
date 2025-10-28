import React, { useState, useEffect, useMemo } from 'react';
import { Doctor, Pharmacy, VisitReport, User } from '../types';
import { api } from '../services/mockData';
import { SearchIcon, DoctorIcon, PharmacyIcon, ArrowRightIcon } from './icons';

interface ClientSearchProps {
  user: User;
  onBack: () => void;
}

type Client = (Doctor & { clientType: 'doctor' }) | (Pharmacy & { clientType: 'pharmacy' });

const ClientSearch: React.FC<ClientSearchProps> = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allVisits, setAllVisits] = useState<VisitReport[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [doctors, pharmacies, visits] = await Promise.all([
          api.getDoctorsForRep(user.id),
          api.getPharmaciesForRep(user.id),
          api.getVisitReportsForRep(user.id),
        ]);
        
        const combinedClients: Client[] = [
            ...doctors.map(d => ({...d, clientType: 'doctor' as const})), 
            ...pharmacies.map(p => ({...p, clientType: 'pharmacy' as const}))
        ];
        setAllClients(combinedClients);
        setAllVisits(visits);
      } catch (e) {
        console.error("Error fetching data for client search", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return allClients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, allClients]);

  const visitHistory = useMemo(() => {
    if (!selectedClient) return [];
    
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    return allVisits
      .filter(visit => visit.targetName === selectedClient.name)
      .filter(visit => new Date(visit.date) >= twoMonthsAgo)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedClient, allVisits]);

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setSearchTerm('');
  };

  const handleClearSelection = () => {
    setSelectedClient(null);
  };

  if (loading) {
    return <div className="text-center p-8">جاري تحميل بيانات العملاء...</div>;
  }

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-blue-800">
          {selectedClient ? `سجل زيارات: ${selectedClient.name}` : 'البحث عن عميل'}
        </h2>
        <button
          onClick={onBack}
          className="flex items-center text-slate-600 hover:text-orange-600 focus:outline-none transition-colors"
          aria-label="العودة إلى لوحة التحكم"
        >
          <span className="hidden md:block">العودة للرئيسية</span>
          <ArrowRightIcon className="h-6 w-6 ms-2" />
        </button>
      </div>

      {!selectedClient ? (
        // Search View
        <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="اكتب اسم الطبيب أو الصيدلية..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 ps-10 border border-slate-300/50 bg-white/50 rounded-lg focus:ring-orange-500 focus:border-orange-500"
            />
            <div className="absolute inset-y-0 left-0 ps-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          {searchTerm && (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map(client => (
                  <li
                    key={`${client.clientType}-${client.id}`}
                    onClick={() => handleSelectClient(client)}
                    className="p-3 bg-white/30 rounded-lg hover:bg-white/60 transition-colors cursor-pointer flex items-center"
                  >
                    {client.clientType === 'doctor' ? <DoctorIcon className="w-6 h-6 text-blue-500 me-3"/> : <PharmacyIcon className="w-6 h-6 text-orange-500 me-3"/>}
                    <div className="flex-grow">
                        <span className="font-semibold">{client.name}</span>
                        {client.specialization && <p className="text-xs text-slate-600">{client.specialization}</p>}
                    </div>
                  </li>
                ))
              ) : (
                <li className="p-4 text-center text-slate-600">لا توجد نتائج مطابقة.</li>
              )}
            </ul>
          )}
        </div>
      ) : (
        // Visit History View
        <div>
           <div className="mb-6">
                <button 
                    onClick={handleClearSelection}
                    className="bg-orange-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-orange-600 transition-all shadow-lg"
                >
                    بحث جديد
                </button>
            </div>
            <div className="bg-white/40 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-white/50">
                <h3 className="text-xl font-semibold mb-4 flex items-center text-blue-700">
                    سجل الزيارات (آخر شهرين)
                </h3>
                 <div className="max-h-[60vh] overflow-y-auto pr-2">
                    {visitHistory.length > 0 ? (
                    <ul className="space-y-3">
                        {visitHistory.map((visit) => (
                        <li key={visit.id} className="p-4 bg-white/30 rounded-lg">
                            <div className="flex justify-between items-start">
                            <div className="flex items-center">
                                {visit.type === 'زيارة طبيب' ? <DoctorIcon className="w-6 h-6 text-blue-500 me-3 flex-shrink-0" /> : <PharmacyIcon className="w-6 h-6 text-orange-500 me-3 flex-shrink-0" />}
                                <div>
                                <p className="font-bold text-slate-800 flex items-center">
                                    {visit.type}
                                    {visit.visitType && (
                                        <span className="text-xs bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full ms-2">{visit.visitType === 'Coaching' ? 'كوتشينج' : 'سينجل'}</span>
                                    )}
                                </p>
                                <p className="text-xs text-slate-600">{new Date(visit.date).toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' })}</p>
                                </div>
                            </div>
                            </div>
                            <p className="mt-2 text-sm text-slate-700 pr-9">{visit.notes}</p>
                            {visit.productName && (
                            <p className="mt-1 text-xs text-slate-600 pr-9">
                                <span className="font-semibold">المنتجات:</span> {visit.productName}
                            </p>
                            )}
                        </li>
                        ))}
                    </ul>
                    ) : (
                    <p className="text-center text-slate-600 py-8 text-lg">لا توجد زيارات مسجلة لهذا العميل في آخر شهرين.</p>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientSearch;