import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FullLapharData } from '../types';
import { formatIndonesianDate } from './docxExport';

export function exportLapharPdf(data: FullLapharData): void {
  const { fullDate, formatted } = formatIndonesianDate(data.report_date);

  // Landscape A4: 297mm x 210mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Kop Surat Kiri
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('KEPOLISIAN NEGARA REPUBLIK INDONESIA', 14, 12);
  doc.text('MARKAS BESAR', 14, 16);
  doc.text('OPERASI DAMAI CARTENZ - 2026', 14, 20);

  // Judul Tengah
  doc.setFontSize(10);
  doc.text('LAPORAN HASIL KEGIATAN HARIAN OPERASI DAMAI CARTENZ – 2026', 148, 15, { align: 'center' });
  doc.text('SATGAS GAKKUM', 148, 20, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`PERIODE HARI/TANGGAL : ${fullDate}`, 148, 25, { align: 'center' });

  // Prepare Rows for Table 1
  const bodyRows: any[] = [];

  function addSubsatgasRows(title: string, groupDict: Record<string, any[]>) {
    bodyRows.push([
      { content: title, colSpan: 8, styles: { fontStyle: 'bold', fillColor: [203, 213, 225], textColor: [15, 23, 42] } },
    ]);

    Object.entries(groupDict).forEach(([unitName, reports]) => {
      bodyRows.push([
        { content: unitName, colSpan: 8, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } },
      ]);

      if (!reports || reports.length === 0) {
        bodyRows.push(['-', 'Gakkum', '-', '-', '-', '-', '-', '-']);
      } else {
        reports.forEach((rep, idx) => {
          bodyRows.push([
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

  addSubsatgasRows('MINOPS', data.minops);
  addSubsatgasRows('SUBSATGAS LIDIK', data.lidik);
  addSubsatgasRows('SUBSATGAS INVESTIGASI', data.investigasi);
  addSubsatgasRows('SUBSATGAS ANALIS', data.analis);

  autoTable(doc, {
    startY: 29,
    head: [['NO', 'SATGAS', 'JAM', 'KUAT PERS', 'LOKASI KEGIATAN', 'KEGIATAN', 'HASIL YANG DICAPAI', 'KET']],
    body: bodyRows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: [20, 20, 20],
      lineColor: [100, 100, 100],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 32 },
      3: { cellWidth: 26 },
      4: { cellWidth: 32 },
      5: { cellWidth: 70 },
      6: { cellWidth: 70 },
      7: { cellWidth: 12 },
    },
  });

  // Table 2: Kejadian Menonjol
  const lastY = (doc as any).lastAutoTable?.finalY || 150;
  let nextY = lastY + 10;
  if (nextY > 175) {
    doc.addPage();
    nextY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('LAPORAN KEJADIAN MENONJOL', 148, nextY, { align: 'center' });

  const incidentRows: any[] = [];
  if (!data.incidents || data.incidents.length === 0) {
    incidentRows.push(['1', '-', '-', 'NIHIL', '-', '-', '-']);
  } else {
    data.incidents.forEach((inc, idx) => {
      incidentRows.push([
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

  autoTable(doc, {
    startY: nextY + 3,
    head: [['NO.', 'HARI/TGL /WAKTU', 'LOKASI', 'KEJADIAN', 'KERUGIAN / HASIL', 'LANGKAH-LANGKAH', 'KET']],
    body: incidentRows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: [20, 20, 20],
      lineColor: [100, 100, 100],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [226, 232, 240],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 40 },
      2: { cellWidth: 40 },
      3: { cellWidth: 70 },
      4: { cellWidth: 50 },
      5: { cellWidth: 50 },
      6: { cellWidth: 10 },
    },
  });

  // Signature Block
  const finalY = (doc as any).lastAutoTable?.finalY || 160;
  let sigY = finalY + 12;
  if (sigY > 175) {
    doc.addPage();
    sigY = 25;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${data.config.signatory_place || 'Jayapura'},  ${formatted}`, 280, sigY, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(data.config.signatory_title || 'KEPALA SATUAN TUGAS PENEGAKAN HUKUM OPERASI DAMAI CARTENZ - 2026', 280, sigY + 5, { align: 'right' });

  doc.text(data.config.signatory_name || 'I G.G. ERA ADHINATA, S.I.K.', 280, sigY + 22, { align: 'right' });
  doc.text(data.config.signatory_rank || 'KOMISARIS BESAR POLISI NRP 80020993', 280, sigY + 26, { align: 'right' });

  // Save PDF
  const fileName = `LAPHAR_WILAYAH_${fullDate.replace(/[, /]/g, '_')}.pdf`;
  doc.save(fileName);
}
