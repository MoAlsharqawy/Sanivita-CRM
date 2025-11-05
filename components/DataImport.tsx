import React, { useState, useCallback, useMemo } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { api } from '../services/api';
import { UploadIcon, DownloadIcon, CheckIcon, XIcon, DoctorIcon, PharmacyIcon } from './icons';

// XLSX is global from index.html
declare const XLSX: any;

const DataImport: React.FC = () => {
    const { t } = useLanguage();
    const [importType, setImportType] = useState<'doctors' | 'pharmacies'>('doctors');
    const [file, setFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleDownloadTemplate = () => {
        let data: any[], sheetName: string, fileName: string;
        
        if (importType === 'doctors') {
            data = [{ Name: 'Dr. John Doe', Region: 'المنطقة الشمالية', Specialization: 'PEDIATRICS', 'Rep Username': 'rep1' }];
            sheetName = t('doctors');
            fileName = 'doctors_template.xlsx';
        } else {
            data = [{ Name: 'Wellness Pharmacy', Region: 'المنطقة الجنوبية', 'Rep Username': 'rep2' }];
            sheetName = t('pharmacies');
            fileName = 'pharmacies_template.xlsx';
        }

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
        XLSX.writeFile(workbook, fileName);
    };

    const handleFileSelect = (selectedFile: File | null) => {
        if (selectedFile && (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || selectedFile.type === 'application/vnd.ms-excel')) {
            setFile(selectedFile);
            setImportResult(null);
            setProgress(0);
        } else {
            setFile(null);
        }
    };
    
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
        if (event.dataTransfer.files && event.dataTransfer.files[0]) {
            handleFileSelect(event.dataTransfer.files[0]);
        }
    }, []);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
    }, []);

    const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setDragOver(false);
    }, []);


    const handleImport = () => {
        if (!file) return;

        setIsProcessing(true);
        setImportResult(null);
        setProgress(0);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                const rows = sheetData.slice(1);

                let result;
                const onProgressUpdate = (p: number) => setProgress(p);

                if (importType === 'doctors') {
                    result = await api.addDoctorsBatch(rows, onProgressUpdate);
                } else {
                    result = await api.addPharmaciesBatch(rows, onProgressUpdate);
                }
                setImportResult(result);
            } catch (error) {
                console.error("Error processing file", error);
                setImportResult({ success: 0, failed: 0, errors: [t('file_processing_error')] });
            } finally {
                setIsProcessing(false);
            }
        };
        reader.onerror = () => {
            console.error("Error reading file");
            setImportResult({ success: 0, failed: 0, errors: [t('file_reading_error')] });
            setIsProcessing(false);
        }
        reader.readAsBinaryString(file);
    };
    
    const instructions = useMemo(() => {
        if (importType === 'doctors') {
            return t('doctors_import_instructions', 'Name, Region, Specialization, Rep Username', 'PEDIATRICS, PULMONOLOGY');
        }
        return t('pharmacies_import_instructions', 'Name, Region, Rep Username');
    }, [importType, t]);

    return (
        <div className="bg-white/40 backdrop-blur-lg rounded-2xl shadow-lg border border-white/50 p-6 space-y-6">
            <h3 className="text-xl font-semibold text-blue-800">{t('data_import')}</h3>
            
            {/* Step 1: Instructions & Template */}
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200/50">
                <h4 className="font-bold text-slate-800">{t('step_1_prepare_file')}</h4>
                <p className="text-sm text-slate-600 mt-1">{instructions}</p>
                <button 
                    onClick={handleDownloadTemplate}
                    className="mt-3 flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-orange-600 transition-colors"
                >
                    <DownloadIcon className="w-4 h-4" />
                    {t('download_template_for', t(importType))}
                </button>
            </div>
            
            {/* Step 2: Select Type & Upload */}
            <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-200/50">
                <h4 className="font-bold text-slate-800">{t('step_2_upload_file')}</h4>
                
                {/* Type Selector */}
                <div className="my-4">
                    <label className="block mb-2 text-sm font-medium text-slate-800">{t('select_import_type')}</label>
                     <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg p-1 bg-slate-200/60 max-w-sm">
                        <button
                            type="button" role="tab" aria-selected={importType === 'doctors'}
                            onClick={() => { setImportType('doctors'); setFile(null); setImportResult(null); }}
                            className={`flex items-center justify-center gap-2 w-full p-2 rounded-md text-sm font-semibold transition-colors duration-200 ${importType === 'doctors' ? 'bg-blue-600 text-white shadow' : 'text-slate-700 hover:bg-white/50'}`}
                        >
                            <DoctorIcon className="w-5 h-5"/> {t('doctors')}
                        </button>
                         <button
                            type="button" role="tab" aria-selected={importType === 'pharmacies'}
                            onClick={() => { setImportType('pharmacies'); setFile(null); setImportResult(null); }}
                            className={`flex items-center justify-center gap-2 w-full p-2 rounded-md text-sm font-semibold transition-colors duration-200 ${importType === 'pharmacies' ? 'bg-orange-500 text-white shadow' : 'text-slate-700 hover:bg-white/50'}`}
                        >
                             <PharmacyIcon className="w-5 h-5"/> {t('pharmacies')}
                         </button>
                     </div>
                </div>

                {/* Uploader */}
                <div 
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${dragOver ? 'border-orange-500 bg-orange-50/50' : 'border-slate-300/50'}`}
                >
                    <div className="space-y-1 text-center">
                        <UploadIcon className="mx-auto h-12 w-12 text-slate-400" />
                        <div className="flex text-sm text-slate-600">
                            <label htmlFor="file-upload" className="relative cursor-pointer bg-white/50 rounded-md font-medium text-blue-600 hover:text-orange-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-orange-500">
                                <span>{t('upload_a_file')}</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx, .xls" onChange={(e) => handleFileSelect(e.target.files ? e.target.files[0] : null)} />
                            </label>
                            <p className="ps-1">{t('or_drag_and_drop')}</p>
                        </div>
                        <p className="text-xs text-slate-500">{t('excel_files_only')}</p>
                        {file && <p className="text-sm font-semibold text-green-700 pt-2">{file.name}</p>}
                    </div>
                </div>
            </div>
            
            {/* Step 3: Import Action */}
            <div className="flex justify-end pt-4 border-t border-slate-300/50">
                <button
                    onClick={handleImport}
                    disabled={!file || isProcessing}
                    className="bg-orange-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-orange-600 transition-all shadow-lg flex items-center gap-2 disabled:bg-orange-300 disabled:cursor-not-allowed"
                >
                    {isProcessing ? t('importing') : t('import_data')}
                </button>
            </div>
            
            {/* Progress and Result Display */}
            {isProcessing && (
                <div className="mt-4">
                    <div className="w-full bg-slate-200/70 rounded-full h-2.5">
                        <div className="bg-gradient-to-r from-blue-500 to-orange-500 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.3s ease-in-out' }}></div>
                    </div>
                    <p className="text-sm text-center text-slate-600 mt-2">{t('importing')}... {progress}%</p>
                </div>
            )}
            
            {importResult && !isProcessing && (
                <div className="p-4 rounded-lg bg-white/50 animate-fade-in mt-4">
                    <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <CheckIcon className="w-6 h-6 text-green-600"/>
                        {t('import_completed')}
                    </h4>
                    <div className="ps-8 space-y-1">
                        <div className="flex items-center gap-2 text-green-700">
                            <CheckIcon className="w-5 h-5"/>
                            <p>{t('records_imported_successfully', importResult.success)}</p>
                        </div>
                         <div className="flex items-center gap-2 text-red-700">
                            <XIcon className="w-5 h-5"/>
                            <p>{t('records_failed_to_import', importResult.failed)}</p>
                        </div>
                        {importResult.errors.length > 0 && (
                            <div className="pt-2">
                                <h5 className="font-semibold text-sm text-slate-700 mb-1">{t('error_details')}</h5>
                                <ul className="list-disc list-inside space-y-1 text-sm text-red-800 bg-red-50/50 p-3 rounded-md max-h-40 overflow-y-auto">
                                    {importResult.errors.map((error, index) => <li key={index}>{error}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
export default DataImport;