import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  PageOrientation,
  Packer,
  ShadingType,
} from 'docx';
import type { FullLapharData } from '../types';

export function formatIndonesianDate(dateStr: string): { fullDate: string; dayName: string; formatted: string } {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));

  const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  const months = [
    'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
  ];

  const dayName = days[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  const formatted = `${dayNum} ${monthName} ${year}`;
  const fullDate = `${dayName}, ${formatted}`;

  return { fullDate, dayName, formatted };
}

export async function exportLapharDocx(data: FullLapharData): Promise<void> {
  const { fullDate, formatted } = formatIndonesianDate(data.report_date);

  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  };

  const headerShading = {
    fill: 'E2E8F0',
    type: ShadingType.CLEAR,
  };

  const groupShading = {
    fill: 'CBD5E1',
    type: ShadingType.CLEAR,
  };

  const unitShading = {
    fill: 'F1F5F9',
    type: ShadingType.CLEAR,
  };

  // Helper for uniform 12pt (size 24) Arial table cell paragraphs
  function tableCellPara(text: string, bold = false, align: any = AlignmentType.LEFT): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: text ?? '-',
          bold,
          size: 24, // 12pt (24 half-points)
          font: 'Arial',
        }),
      ],
      alignment: align,
      spacing: { before: 40, after: 40 },
    });
  }

  // Header Table 1: 8 Columns
  // NO | SATGAS | JAM | KUAT PERSONEL | LOKASI KEGIATAN | KEGIATAN | HASIL YANG DICAPAI | KET
  const table1Rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 5, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('NO', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 9, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('SATGAS', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 14, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('JAM', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('KUAT PERSONEL', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 14, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('LOKASI KEGIATAN', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 21, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('KEGIATAN', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('HASIL YANG DICAPAI', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 5, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('KET', true, AlignmentType.CENTER)],
        }),
      ],
    }),
  ];

  // Helper to append a Section Heading (e.g. MINOPS, SUBSATGAS LIDIK)
  function appendMajorHeading(title: string) {
    table1Rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            columnSpan: 8,
            borders: cellBorder,
            shading: groupShading,
            children: [tableCellPara(title, true, AlignmentType.LEFT)],
          }),
        ],
      })
    );
  }

  // Helper to append a Unit and its report rows
  function appendUnitGroup(unitTitle: string, reports: any[]) {
    // Unit Subheader
    table1Rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            columnSpan: 8,
            borders: cellBorder,
            shading: unitShading,
            children: [tableCellPara(unitTitle, true, AlignmentType.LEFT)],
          }),
        ],
      })
    );

    if (!reports || reports.length === 0) {
      // 1 Blank Row if no activity recorded
      table1Rows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({ borders: cellBorder, children: [tableCellPara('-', false, AlignmentType.CENTER)] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara('Gakkum', false, AlignmentType.CENTER)] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
          ],
        })
      );
    } else {
      reports.forEach((rep, idx) => {
        table1Rows.push(
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                borders: cellBorder,
                children: [tableCellPara(String(idx + 1), false, AlignmentType.CENTER)],
              }),
              new TableCell({
                borders: cellBorder,
                children: [tableCellPara(rep.satgas_name || 'Gakkum', false, AlignmentType.CENTER)],
              }),
              new TableCell({
                borders: cellBorder,
                children: [tableCellPara(rep.activity_time || '-')],
              }),
              new TableCell({
                borders: cellBorder,
                children: [tableCellPara(rep.personnel_count || '-')],
              }),
              new TableCell({
                borders: cellBorder,
                children: [tableCellPara(rep.location || '-')],
              }),
              new TableCell({
                borders: cellBorder,
                children: [tableCellPara(rep.activity || '-')],
              }),
              new TableCell({
                borders: cellBorder,
                children: [tableCellPara(rep.results || '-')],
              }),
              new TableCell({
                borders: cellBorder,
                children: [tableCellPara(rep.description || '-')],
              }),
            ],
          })
        );
      });
    }
  }

  // 1. MINOPS
  appendMajorHeading('MINOPS');
  Object.entries(data.minops).forEach(([unit, list]) => {
    appendUnitGroup(unit, list);
  });

  // 2. SUBSATGAS LIDIK
  appendMajorHeading('SUBSATGAS LIDIK');
  Object.entries(data.lidik).forEach(([unit, list]) => {
    appendUnitGroup(unit, list);
  });

  // 3. SUBSATGAS INVESTIGASI
  appendMajorHeading('SUBSATGAS INVESTIGASI');
  Object.entries(data.investigasi).forEach(([unit, list]) => {
    appendUnitGroup(unit, list);
  });

  // 4. SUBSATGAS ANALIS
  appendMajorHeading('SUBSATGAS ANALIS');
  Object.entries(data.analis).forEach(([unit, list]) => {
    appendUnitGroup(unit, list);
  });

  const mainActivitiesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: table1Rows,
  });

  // Header Table 2: 7 Columns (Kejadian Menonjol)
  // NO | HARI/TGL /WAKTU | LOKASI | KEJADIAN | KERUGIAN / HASIL | LANGKAH-LANGKAH | KET
  const incidentRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 5, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('NO', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 16, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('HARI/TGL /WAKTU', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 16, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('LOKASI', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 23, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('KEJADIAN', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 18, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('KERUGIAN / HASIL', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 17, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('LANGKAH-LANGKAH', true, AlignmentType.CENTER)],
        }),
        new TableCell({
          width: { size: 5, type: WidthType.PERCENTAGE },
          borders: cellBorder,
          shading: headerShading,
          children: [tableCellPara('KET', true, AlignmentType.CENTER)],
        }),
      ],
    }),
  ];

  if (!data.incidents || data.incidents.length === 0) {
    incidentRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({ borders: cellBorder, children: [tableCellPara('1', false, AlignmentType.CENTER)] }),
          new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
          new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
          new TableCell({ borders: cellBorder, children: [tableCellPara('NIHIL')] }),
          new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
          new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
          new TableCell({ borders: cellBorder, children: [tableCellPara('-')] }),
        ],
      })
    );
  } else {
    data.incidents.forEach((inc, idx) => {
      incidentRows.push(
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              borders: cellBorder,
              children: [tableCellPara(String(idx + 1), false, AlignmentType.CENTER)],
            }),
            new TableCell({ borders: cellBorder, children: [tableCellPara(inc.incident_time || '-')] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara(inc.location || '-')] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara(inc.incident_description || '-')] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara(inc.losses_or_results || '-')] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara(inc.actions_taken || '-')] }),
            new TableCell({ borders: cellBorder, children: [tableCellPara(inc.notes || '-')] }),
          ],
        })
      );
    });
  }

  const incidentsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: incidentRows,
  });

  // Construct Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: [
          // Kop Surat Kiri Atas
          new Paragraph({
            children: [
              new TextRun({ text: 'KEPOLISIAN NEGARA REPUBLIK INDONESIA\n', bold: true, size: 24, font: 'Arial' }),
              new TextRun({ text: 'MARKAS BESAR\n', bold: true, size: 24, font: 'Arial' }),
              new TextRun({ text: 'OPERASI DAMAI CARTENZ - 2026', bold: true, size: 24, font: 'Arial' }),
            ],
            spacing: { after: 200 },
          }),

          // Judul Laporan Tengah
          new Paragraph({
            children: [
              new TextRun({ text: 'LAPORAN HASIL KEGIATAN HARIAN OPERASI DAMAI CARTENZ – 2026\n', bold: true, size: 24, font: 'Arial' }),
              new TextRun({ text: 'SATGAS GAKKUM\n', bold: true, size: 24, font: 'Arial' }),
              new TextRun({ text: `PERIODE HARI/TANGGAL : ${fullDate}`, bold: true, size: 24, font: 'Arial' }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),

          // Tabel 1: Kegiatan Harian
          mainActivitiesTable,

          new Paragraph({ text: '', spacing: { after: 200 } }),

          // Judul Laporan Kejadian Menonjol
          new Paragraph({
            children: [
              new TextRun({ text: 'LAPORAN KEJADIAN MENONJOL', bold: true, size: 24, font: 'Arial' }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),

          // Tabel 2: Kejadian Menonjol
          incidentsTable,

          new Paragraph({ text: '', spacing: { after: 200 } }),

          // Tanda Tangan Kasatgas Gakkum (Kanan Bawah) - Bound together with keepNext & keepLines
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            keepNext: true,
            keepLines: true,
            children: [
              new TextRun({ text: `${data.config.signatory_place || 'Jayapura'},  ${formatted}\n`, size: 24, font: 'Arial' }),
              new TextRun({ text: `${data.config.signatory_title || 'KEPALA SATUAN TUGAS PENEGAKAN HUKUM OPERASI DAMAI CARTENZ - 2026'}\n\n`, bold: true, size: 24, font: 'Arial' }),
              new TextRun({ text: `${data.config.signatory_name || 'I G.G. ERA ADHINATA, S.I.K.'}\n`, bold: true, underline: {}, size: 24, font: 'Arial' }),
              new TextRun({ text: `${data.config.signatory_rank || 'KOMISARIS BESAR POLISI NRP 80020993'}`, bold: true, size: 24, font: 'Arial' }),
            ],
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });

  // Pack into Blob and download
  const blob = await Packer.toBlob(doc);
  const fileName = `LAPHAR_WILAYAH_${fullDate.replace(/[, /]/g, '_')}.docx`;

  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}
