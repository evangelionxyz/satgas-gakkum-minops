import * as XLSX from 'xlsx';
import type { FullLapharData } from '../types';
import { formatIndonesianDate } from './docxExport';

export function exportLapharExcel(data: FullLapharData): void {
  const { fullDate } = formatIndonesianDate(data.report_date);
  const wb = XLSX.utils.book_new();

  // SHEET 1: LAPORAN KEGIATAN HARIAN
  const sheet1Data: (string | number)[][] = [
    ['KEPOLISIAN NEGARA REPUBLIK INDONESIA'],
    ['MARKAS BESAR'],
    ['OPERASI DAMAI CARTENZ - 2026'],
    [''],
    ['LAPORAN HASIL KEGIATAN HARIAN OPERASI DAMAI CARTENZ – 2026'],
    ['SATGAS GAKKUM'],
    [`PERIODE HARI/TANGGAL : ${fullDate}`],
    [''],
    ['NO', 'SATGAS', 'JAM', 'KUAT PERSONEL', 'LOKASI KEGIATAN', 'KEGIATAN', 'HASIL YANG DICAPAI', 'KET'],
  ];

  function addSubsatgasToExcel(groupTitle: string, groupDict: Record<string, any[]>) {
    sheet1Data.push([`>>> ${groupTitle} <<<`, '', '', '', '', '', '', '']);
    Object.entries(groupDict).forEach(([unitName, reports]) => {
      sheet1Data.push([`[ ${unitName} ]`, '', '', '', '', '', '', '']);
      if (!reports || reports.length === 0) {
        sheet1Data.push(['-', 'Gakkum', '-', '-', '-', '-', '-', '-']);
      } else {
        reports.forEach((rep, idx) => {
          sheet1Data.push([
            idx + 1,
            rep.satgas_name || 'Gakkum',
            rep.activity_time || '-',
            rep.personnel_count || '-',
            rep.location || '-',
            rep.activity || '-',
            rep.results || '-',
            rep.description || '-',
          ]);
        });
      }
    });
  }

  addSubsatgasToExcel('MINOPS', data.minops);
  addSubsatgasToExcel('SUBSATGAS LIDIK', data.lidik);
  addSubsatgasToExcel('SUBSATGAS INVESTIGASI', data.investigasi);
  addSubsatgasToExcel('SUBSATGAS ANALIS', data.analis);

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

  // Set column widths
  ws1['!cols'] = [
    { wch: 8 },  // NO
    { wch: 12 }, // SATGAS
    { wch: 25 }, // JAM
    { wch: 20 }, // KUAT PERSONEL
    { wch: 25 }, // LOKASI
    { wch: 45 }, // KEGIATAN
    { wch: 45 }, // HASIL
    { wch: 15 }, // KET
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'LAPHAR KEGIATAN');

  // SHEET 2: KEJADIAN MENONJOL
  const sheet2Data: (string | number)[][] = [
    ['LAPORAN KEJADIAN MENONJOL'],
    [`PERIODE HARI/TANGGAL : ${fullDate}`],
    [''],
    ['NO.', 'HARI/TGL /WAKTU', 'LOKASI', 'KEJADIAN', 'KERUGIAN / HASIL', 'LANGKAH-LANGKAH', 'KET'],
  ];

  if (!data.incidents || data.incidents.length === 0) {
    sheet2Data.push([1, '-', '-', 'NIHIL', '-', '-', '-']);
  } else {
    data.incidents.forEach((inc, idx) => {
      sheet2Data.push([
        idx + 1,
        inc.incident_time || '-',
        inc.location || '-',
        inc.incident_description || '-',
        inc.losses_or_results || '-',
        inc.actions_taken || '-',
        inc.notes || '-',
      ]);
    });
  }

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2['!cols'] = [
    { wch: 8 },
    { wch: 25 },
    { wch: 25 },
    { wch: 40 },
    { wch: 30 },
    { wch: 35 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, ws2, 'KEJADIAN MENONJOL');

  // Download
  const fileName = `LAPHAR_WILAYAH_${fullDate.replace(/[, /]/g, '_')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
