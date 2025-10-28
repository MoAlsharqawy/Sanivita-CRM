import { VisitReport, Doctor, Pharmacy, Region, User } from "../types";

// These globals are defined by the scripts loaded in index.html
declare const XLSX: any;
declare const jspdf: any;

export const exportToExcel = (data: VisitReport[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
    'التاريخ': new Date(item.date).toLocaleString('ar-EG'),
    'نوع الزيارة': item.type,
    'اسم المندوب': item.repName,
    'المنطقة': item.regionName,
    'العميل': item.targetName,
    'المنتج': item.productName || '-',
    'الملاحظات': item.notes,
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'تقارير الزيارات');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportClientsToExcel = (doctors: Doctor[], pharmacies: Pharmacy[], regions: Region[], fileName: string) => {
  const regionMap = new Map(regions.map(r => [r.id, r.name]));

  const doctorsData = doctors.map(d => ({
    'الاسم': d.name,
    'المنطقة': regionMap.get(d.regionId) || 'غير معروف',
    'التخصص': d.specialization,
  }));
  const doctorsWorksheet = XLSX.utils.json_to_sheet(doctorsData);

  const pharmaciesData = pharmacies.map(p => ({
    'الاسم': p.name,
    'المنطقة': regionMap.get(p.regionId) || 'غير معروف',
  }));
  const pharmaciesWorksheet = XLSX.utils.json_to_sheet(pharmaciesData);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, doctorsWorksheet, 'الأطباء');
  XLSX.utils.book_append_sheet(workbook, pharmaciesWorksheet, 'الصيدليات');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportMultipleRepClientsToExcel = (doctors: Doctor[], pharmacies: Pharmacy[], regions: Region[], users: User[], fileName: string) => {
  const regionMap = new Map(regions.map(r => [r.id, r.name]));
  const userMap = new Map(users.map(u => [u.id, u.name]));

  const doctorsData = doctors.map(d => ({
    'الاسم': d.name,
    'المنطقة': regionMap.get(d.regionId) || 'غير معروف',
    'التخصص': d.specialization,
    'المندوب المسؤول': userMap.get(d.repId) || 'غير معروف',
  }));
  const doctorsWorksheet = XLSX.utils.json_to_sheet(doctorsData, { header: ['الاسم', 'التخصص', 'المنطقة', 'المندوب المسؤول'] });

  const pharmaciesData = pharmacies.map(p => ({
    'الاسم': p.name,
    'المنطقة': regionMap.get(p.regionId) || 'غير معروف',
    'المندوب المسؤول': userMap.get(p.repId) || 'غير معروف',
  }));
  const pharmaciesWorksheet = XLSX.utils.json_to_sheet(pharmaciesData, { header: ['الاسم', 'المنطقة', 'المندوب المسؤول'] });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, doctorsWorksheet, 'الأطباء');
  XLSX.utils.book_append_sheet(workbook, pharmaciesWorksheet, 'الصيدليات');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};


export const exportUsersToExcel = (users: User[], fileName: string) => {
  const usersData = users.map(u => ({
    'الاسم الكامل': u.name,
    'اسم المستخدم': u.username,
    'الدور': u.role,
  }));
  const worksheet = XLSX.utils.json_to_sheet(usersData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'المستخدمون');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToPdf = (data: VisitReport[], fileName:string) => {
  const { jsPDF } = jspdf;
  const doc = new jsPDF();
  
  // Add Arabic font
  // Note: jsPDF has limited Arabic support out-of-the-box. This is a basic setup.
  // For production, you would embed a proper Arabic font (like Amiri).
  doc.addFont('https://fonts.gstatic.com/s/amiri/v25/J7acnpd8CGxBHpU2hLVF.ttf', 'Amiri', 'normal');
  doc.setFont('Amiri');


  doc.autoTable({
    head: [['الملاحظات', 'المنتج', 'العميل', 'المنطقة', 'اسم المندوب', 'نوع الزيارة', 'التاريخ']],
    body: data.map(item => [
      item.notes,
      item.productName || '-',
      item.targetName,
      item.regionName,
      item.repName,
      item.type,
      new Date(item.date).toLocaleDateString('ar-EG'),
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
        doc.text('تقرير الزيارات', data.settings.margin.left, 15);
    }
  });

  doc.save(`${fileName}.pdf`);
};