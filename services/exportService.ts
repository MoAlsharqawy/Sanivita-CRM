
import { VisitReport, Doctor, Pharmacy, Region, User, Specialization } from "../types";
import { TranslationFunction } from "../hooks/useLanguage";

// These globals are defined by the scripts loaded in index.html
declare const XLSX: any;
declare const jspdf: any;

export const exportToExcel = (data: VisitReport[], fileName: string, t: TranslationFunction) => {
  const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
    [t('date')]: new Date(item.date).toLocaleString(t('locale')),
    [t('visit_type')]: t(item.type),
    [t('rep_name')]: item.repName,
    [t('region')]: item.regionName,
    [t('client')]: item.targetName,
    [t('product')]: item.productName || '-',
    [t('notes')]: item.notes,
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('visit_reports'));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportClientsToExcel = (doctors: Doctor[], pharmacies: Pharmacy[], regions: Region[], fileName: string, t: TranslationFunction) => {
  const regionMap = new Map(regions.map(r => [r.id, r.name]));

  const doctorsData = doctors.map(d => ({
    [t('name')]: d.name,
    [t('region')]: regionMap.get(d.regionId) || t('unknown'),
    [t('specialization')]: t(d.specialization),
  }));
  const doctorsWorksheet = XLSX.utils.json_to_sheet(doctorsData);

  const pharmaciesData = pharmacies.map(p => ({
    [t('name')]: p.name,
    [t('region')]: regionMap.get(p.regionId) || t('unknown'),
  }));
  const pharmaciesWorksheet = XLSX.utils.json_to_sheet(pharmaciesData);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, doctorsWorksheet, t('doctors'));
  XLSX.utils.book_append_sheet(workbook, pharmaciesWorksheet, t('pharmacies'));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportMultipleRepClientsToExcel = (doctors: Doctor[], pharmacies: Pharmacy[], regions: Region[], users: User[], fileName: string, t: TranslationFunction) => {
  const regionMap = new Map(regions.map(r => [r.id, r.name]));
  const userMap = new Map(users.map(u => [u.id, u.name]));

  const doctorsData = doctors.map(d => ({
    [t('name')]: d.name,
    [t('region')]: regionMap.get(d.regionId) || t('unknown'),
    [t('specialization')]: t(d.specialization),
    [t('responsible_rep')]: userMap.get(d.repId) || t('unknown'),
  }));
  const doctorsWorksheet = XLSX.utils.json_to_sheet(doctorsData, { header: [t('name'), t('specialization'), t('region'), t('responsible_rep')] });

  const pharmaciesData = pharmacies.map(p => ({
    [t('name')]: p.name,
    [t('region')]: regionMap.get(p.regionId) || t('unknown'),
    [t('responsible_rep')]: userMap.get(p.repId) || t('unknown'),
  }));
  const pharmaciesWorksheet = XLSX.utils.json_to_sheet(pharmaciesData, { header: [t('name'), t('region'), t('responsible_rep')] });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, doctorsWorksheet, t('doctors'));
  XLSX.utils.book_append_sheet(workbook, pharmaciesWorksheet, t('pharmacies'));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};


export const exportUsersToExcel = (users: User[], fileName: string, t: TranslationFunction) => {
  const usersData = users.map(u => ({
    [t('full_name')]: u.name,
    [t('username')]: u.username,
    [t('role')]: t(u.role),
  }));
  const worksheet = XLSX.utils.json_to_sheet(usersData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('users'));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportDoctorsListToExcel = (doctors: { name: string; region: string; specialization: string; visits: number, lastVisitDate?: string | null }[], fileName: string, t: TranslationFunction) => {
  const data = doctors.map(d => ({
    [t('name')]: d.name,
    [t('specialization')]: t(d.specialization),
    [t('region')]: d.region,
    [t('last_visit_date')]: d.lastVisitDate ? new Date(d.lastVisitDate).toLocaleDateString(t('locale')) : '-',
    [t('visit_count')]: d.visits,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('doctors'));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportVacationStatsToExcel = (stats: any[], fileName: string, t: TranslationFunction) => {
  // Summary Data
  const summaryData = stats.map(stat => ({
    [t('rep_name')]: stat.repName,
    [t('rep_code')]: stat.repUsername,
    [t('total_working_days_passed')]: stat.totalWorkingDaysPassed,
    [t('days_worked')]: stat.daysWorked,
    [t('absent_days')]: stat.absentDays,
  }));

  // Details Data
  const detailsData: any[] = [];
  stats.forEach(stat => {
    if (stat.absentDetailsList && Array.isArray(stat.absentDetailsList)) {
        stat.absentDetailsList.forEach((detail: any) => {
             detailsData.push({
                 [t('rep_name')]: stat.repName,
                 [t('rep_code')]: stat.repUsername,
                 [t('date')]: detail.date,
                 [t('leave_type')]: detail.reason 
             });
        });
    }
  });

  const workbook = XLSX.utils.book_new();
  
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, t('summary'));

  if(detailsData.length > 0) {
      const detailsSheet = XLSX.utils.json_to_sheet(detailsData);
      XLSX.utils.book_append_sheet(workbook, detailsSheet, t('details'));
  }

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToPdf = (data: VisitReport[], fileName:string, t: TranslationFunction) => {
  const { jsPDF } = jspdf;
  const doc = new jsPDF();
  
  // Add Arabic font for PDF export
  doc.addFont('https://fonts.gstatic.com/s/amiri/v25/J7acnpd8CGxBHpU2hLVF.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');


  doc.autoTable({
    head: [[t('notes'), t('product'), t('client'), t('region'), t('rep_name'), t('visit_type'), t('date')]],
    body: data.map(item => [
      item.notes,
      item.productName || '-',
      item.targetName,
      item.regionName,
      item.repName,
      t(item.type),
      new Date(item.date).toLocaleDateString(t('locale')),
    ]).reverse(), // Reverse to display correctly in RTL table
    styles: {
        font: 'Amiri',
        halign: 'right'
    },
    headStyles: {
        halign: 'right',
        fillColor: [41, 128, 185]
    },
    didDrawPage: (data: any) => {
        doc.setFontSize(20);
        doc.text(t('visit_reports'), data.settings.margin.left, 15);
    }
  });

  doc.save(`${fileName}.pdf`);
};
