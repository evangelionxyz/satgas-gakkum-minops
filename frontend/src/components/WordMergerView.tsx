import React, { useState } from 'react';
import { api, isTauriEnvironment, type ActivityItem, type IncidentItem, type FileSummary, type SignatureConfig } from '../services/api';
import { exportLapharExcel } from '../utils/excelExport';
import { toast } from 'sonner';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Search,
  Trash2,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  Settings2,
  FolderOpen,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface WordMergerViewProps {
  selectedDate: string;
}

export const WordMergerView: React.FC<WordMergerViewProps> = ({ selectedDate }) => {
  const [activeMode, setActiveMode] = useState<'slots' | 'batch'>('slots');
  const [targetDate, setTargetDate] = useState<string>(selectedDate);

  // 6 Slot State
  const [slotFiles, setSlotFiles] = useState<{ [key: string]: File | null }>({
    minops_jayapura: null,
    minops_timika: null,
    minops_lanny: null,
    lidik: null,
    investigasi: null,
    analis: null,
  });

  // Batch Files State
  const [batchFiles, setBatchFiles] = useState<File[]>([]);

  // Action States
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isMerging, setIsMerging] = useState<boolean>(false);

  // Extracted Data State
  const [parsedFiles, setParsedFiles] = useState<FileSummary[]>([]);
  const [extractedItems, setExtractedItems] = useState<ActivityItem[]>([]);
  const [extractedIncidents, setExtractedIncidents] = useState<IncidentItem[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [subsatgasFilter, setSubsatgasFilter] = useState<string>('ALL');
  const [lastSavedPath, setLastSavedPath] = useState<string | null>(null);

  // Kasatgas Signature Configuration State
  const [showSigConfig, setShowSigConfig] = useState<boolean>(false);
  const [sigConfig, setSigConfig] = useState<SignatureConfig>({
    signature_city: 'Jayapura',
    kasatgas_name: 'I G.G. ERA ADHINATA, S.I.K.',
    kasatgas_rank_nrp: 'KOMISARIS BESAR POLISI NRP 80020993',
  });

  const handleOpenSavedFile = async (path: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_file', { filePath: path });
    } catch (err: any) {
      try {
        const { openPath } = await import('@tauri-apps/plugin-opener');
        await openPath(path);
      } catch (err2: any) {
        toast.error('Gagal membuka berkas: ' + (err?.message || err2?.message || String(err)));
      }
    }
  };

  const slotCards = [
    {
      id: 'minops_jayapura',
      slotNum: '01',
      title: 'MINOPS — UNIT JAYAPURA',
      desc: 'File Word laporan harian Minops Posko Jayapura.',
      badge: 'MINOPS',
    },
    {
      id: 'minops_timika',
      slotNum: '02',
      title: 'MINOPS — UNIT TIMIKA',
      desc: 'File Word laporan harian Minops Posko Timika.',
      badge: 'MINOPS',
    },
    {
      id: 'minops_lanny',
      slotNum: '03',
      title: 'MINOPS — LANNY JAYA / WAMENA',
      desc: 'File Word Minops Kring Jayawijaya / Lanny Jaya.',
      badge: 'MINOPS',
    },
    {
      id: 'lidik',
      slotNum: '04',
      title: 'SUBSATGAS LIDIK',
      desc: 'File Word kompilasi penyelidikan 11 unit wilayah.',
      badge: 'LIDIK',
    },
    {
      id: 'investigasi',
      slotNum: '05',
      title: 'SUBSATGAS INVESTIGASI',
      desc: 'File Word kompilasi investigasi / sidik 10 unit wilayah.',
      badge: 'INVESTIGASI',
    },
    {
      id: 'analis',
      slotNum: '06',
      title: 'SUBSATGAS ANALIS',
      desc: 'File Word analisa harian intelijen 10 wilayah.',
      badge: 'ANALIS',
    },
  ];

  const handleSlotFileChange = (slotId: string, file: File | null) => {
    setSlotFiles((prev) => ({ ...prev, [slotId]: file }));
  };

  const handleBatchFilesAdded = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith('.docx'));
    setBatchFiles((prev) => {
      const existingNames = new Set(prev.map((p) => p.name));
      const filtered = newFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...filtered];
    });
  };

  const removeBatchFile = (index: number) => {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getSelectedFiles = (): File[] => {
    if (activeMode === 'slots') {
      return Object.values(slotFiles).filter((f): f is File => f !== null);
    }
    return batchFiles;
  };

  // Native File Picker for Desktop
  const handlePickNativeFiles = async () => {
    if (!isTauriEnvironment()) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Word Documents (*.docx)', extensions: ['docx'] }],
      });
      if (selected && Array.isArray(selected)) {
        // Read selected paths via tauri fs plugin
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const loadedFiles: File[] = [];
        for (const filePath of selected) {
          const fileName = filePath.split(/[\\/]/).pop() || 'document.docx';
          const fileData = await readFile(filePath);
          const file = new File([fileData], fileName, {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
          loadedFiles.push(file);
        }

        setBatchFiles((prev) => {
          const existingNames = new Set(prev.map((p) => p.name));
          const filtered = loadedFiles.filter((f) => !existingNames.has(f.name));
          return [...prev, ...filtered];
        });
        setActiveMode('batch');
        toast.success(`Berhasil menambahkan ${loadedFiles.length} file Word.`);
      }
    } catch (err: any) {
      console.warn('Native file open error:', err);
    }
  };

  // Execute Parsing via Rust Native Engine
  const handleParseFiles = async () => {
    const filesToParse = getSelectedFiles();
    if (filesToParse.length === 0) {
      toast.error('Pilih minimal 1 file Word (.docx) untuk diproses.');
      return;
    }

    setIsParsing(true);
    try {
      const result = await api.parseDocxFiles(filesToParse);
      setParsedFiles(result.files);
      setExtractedItems(result.items);
      setExtractedIncidents(result.incidents || []);

      if (result.detected_date) {
        setTargetDate(result.detected_date);
      }

      toast.success(
        `Berhasil mengekstrak ${result.total_items} kegiatan & ${result.total_incidents} kejadian menonjol dari ${result.total_files} file Word.`
      );
    } catch (err: any) {
      toast.error(err.message || 'Gagal memproses file Word.');
    } finally {
      setIsParsing(false);
    }
  };

  // Merge and Save via Tauri Native Save Dialog
  const handleMergeAndSave = async () => {
    if (extractedItems.length === 0) {
      const files = getSelectedFiles();
      if (files.length === 0) {
        toast.error('Pilih file Word terlebih dahulu sebelum melakukan penggabungan.');
        return;
      }
      setIsMerging(true);
      try {
        const parseRes = await api.parseDocxFiles(files);
        setParsedFiles(parseRes.files);
        setExtractedItems(parseRes.items);
        setExtractedIncidents(parseRes.incidents);
        const dateToUse = targetDate || parseRes.detected_date || selectedDate;

        const savedPath = await api.mergeAndSaveNative({
          date: dateToUse,
          items: parseRes.items,
          incidents: parseRes.incidents,
          signature_config: sigConfig,
        });

        if (savedPath) {
          setLastSavedPath(savedPath);
          toast.success(`Dokumen LAPHAR berhasil digabungkan dan disimpan!`, {
            description: savedPath,
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
            action: {
              label: 'Buka Dokumen',
              onClick: () => handleOpenSavedFile(savedPath),
            },
          });
        }
      } catch (err: any) {
        toast.error(err.message || 'Gagal menggabungkan dokumen Word.');
      } finally {
        setIsMerging(false);
      }
      return;
    }

    setIsMerging(true);
    try {
      const savedPath = await api.mergeAndSaveNative({
        date: targetDate,
        items: extractedItems,
        incidents: extractedIncidents,
        signature_config: sigConfig,
      });

      if (savedPath) {
        setLastSavedPath(savedPath);
        toast.success(`Dokumen LAPHAR berhasil digabungkan dan disimpan!`, {
          description: savedPath,
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
          action: {
            label: 'Buka Dokumen',
            onClick: () => handleOpenSavedFile(savedPath),
          },
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal menggabungkan dokumen Word.');
    } finally {
      setIsMerging(false);
    }
  };

  // Download Excel
  const handleDownloadExcel = () => {
    if (extractedItems.length === 0) {
      toast.error('Belum ada data kegiatan untuk diekspor ke Excel.');
      return;
    }

    const fullLaphar: any = {
      report_date: targetDate,
      minops: {},
      lidik: {},
      investigasi: {},
      analis: {},
      incidents: extractedIncidents.map((inc) => ({
        incident_time: inc.incident_time,
        location: inc.location,
        incident_desc: inc.incident_desc,
        casualties_losses: inc.casualties_losses,
        actions_taken: inc.actions_taken,
        notes: inc.notes,
      })),
      config: sigConfig,
    };

    extractedItems.forEach((it) => {
      const subKey = it.subsatgas.toLowerCase() as 'minops' | 'lidik' | 'investigasi' | 'analis';
      if (!fullLaphar[subKey]) {
        fullLaphar[subKey] = {};
      }
      if (!fullLaphar[subKey][it.unit_name]) {
        fullLaphar[subKey][it.unit_name] = [];
      }
      fullLaphar[subKey][it.unit_name].push({
        satgas_name: it.satgas || 'Gakkum',
        activity_time: it.activity_time,
        personnel_count: it.personnel_count,
        location: it.location,
        activity: it.activity_desc,
        results: it.results,
        description: it.notes,
      });
    });

    exportLapharExcel(fullLaphar);
    toast.success('Data kegiatan berhasil diekspor ke Excel (.xlsx).');
  };

  const handleResetData = () => {
    setExtractedItems([]);
    setExtractedIncidents([]);
    setParsedFiles([]);
    setBatchFiles([]);
    setSlotFiles({
      minops_jayapura: null,
      minops_timika: null,
      minops_lanny: null,
      lidik: null,
      investigasi: null,
      analis: null,
    });
    toast.info('Seluruh input dan hasil ekstraksi telah direset.');
  };

  // Filtered Items for Preview Table
  const filteredItems = extractedItems.filter((item) => {
    if (subsatgasFilter !== 'ALL' && item.subsatgas !== subsatgasFilter) {
      return false;
    }
    if (searchFilter) {
      const q = searchFilter.toLowerCase();
      return (
        item.unit_name.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.activity_desc.toLowerCase().includes(q) ||
        item.results.toLowerCase().includes(q) ||
        item.personnel_count.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedCount = getSelectedFiles().length;

  return (
    <div className="space-y-6">
      {/* Shelf Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0c121e]/90 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>NATIVE RUST WORD MERGER • 100% OFFLINE</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Penggabungan Dokumen Word LAPHAR Resmi
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
              Kompilasi laporan harian Satgas Gakkum Minops (Operasi Damai Cartenz 2026). Seluruh berkas Word per-unit dan subsatgas digabungkan secara lokal dan instan di laptop Anda tanpa membutuhkan server atau internet.
            </p>
          </div>

          {/* Date Picker & Kasatgas Config Button */}
          <div className="flex items-center gap-3 self-start lg:self-center flex-wrap">
            <div className="bg-slate-50 dark:bg-[#080d16] border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl">
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Tanggal Laporan:
              </span>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer mt-0.5"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowSigConfig(!showSigConfig)}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                showSigConfig
                  ? 'bg-orange-500/10 border-orange-500/40 text-orange-600 dark:text-orange-400'
                  : 'bg-slate-50 dark:bg-[#080d16] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>Tanda Tangan</span>
              {showSigConfig ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Kasatgas Signature Configuration Panel */}
        {showSigConfig && (
          <div className="mt-5 p-4 rounded-xl bg-slate-50 dark:bg-[#080d16] border border-slate-200 dark:border-slate-800/80 animate-in fade-in duration-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-orange-500" />
                Konfigurasi Pejabat Penandatangan LAPHAR
              </span>
              <span className="text-[11px] text-slate-400">Otomatis diterapkan ke blok tanda tangan Word</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Kota Penandatanganan
                </label>
                <input
                  type="text"
                  value={sigConfig.signature_city || ''}
                  onChange={(e) => setSigConfig({ ...sigConfig, signature_city: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Nama Kasatgas
                </label>
                <input
                  type="text"
                  value={sigConfig.kasatgas_name || ''}
                  onChange={(e) => setSigConfig({ ...sigConfig, kasatgas_name: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Pangkat & NRP
                </label>
                <input
                  type="text"
                  value={sigConfig.kasatgas_rank_nrp || ''}
                  onChange={(e) => setSigConfig({ ...sigConfig, kasatgas_rank_nrp: e.target.value })}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveMode('slots')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeMode === 'slots'
                  ? 'bg-white dark:bg-[#0f172a] text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Mode 6 Slot Terarah (Resmi)
            </button>
            <button
              onClick={() => setActiveMode('batch')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeMode === 'batch'
                  ? 'bg-white dark:bg-[#0f172a] text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Mode Multi-File Bebas
            </button>
          </div>

          <div className="flex items-center gap-3">
            {isTauriEnvironment() && (
              <button
                type="button"
                onClick={handlePickNativeFiles}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-orange-500" />
                Pilih dari Folder PC...
              </button>
            )}
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <span>Berkas Terpilih: </span>
              <span className="font-bold text-orange-600 dark:text-orange-400">{selectedCount} file</span>
            </div>
          </div>
        </div>
      </div>

      {/* Input Mode A: 6 Slot */}
      {activeMode === 'slots' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slotCards.map((card) => {
            const currentFile = slotFiles[card.id];
            return (
              <div
                key={card.id}
                className={`relative rounded-2xl border p-5 transition-all shadow-xs ${
                  currentFile
                    ? 'border-orange-500/50 bg-orange-50/20 dark:bg-orange-950/10'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c121e] hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    SLOT {card.slotNum}
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                      card.badge === 'MINOPS'
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : card.badge === 'LIDIK'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : card.badge === 'INVESTIGASI'
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                    }`}
                  >
                    {card.badge}
                  </span>
                </div>

                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
                  {card.title}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 min-h-[30px] line-clamp-2">
                  {card.desc}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  {currentFile ? (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-[#070b12] border border-orange-300 dark:border-orange-800/60">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-orange-600 dark:text-orange-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {currentFile.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSlotFileChange(card.id, null)}
                        className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                        title="Hapus file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-orange-500 text-slate-600 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 bg-slate-50/50 dark:bg-[#080d16] text-xs font-semibold cursor-pointer transition-colors">
                      <UploadCloud className="w-4 h-4" />
                      <span>Pilih File .docx</span>
                      <input
                        type="file"
                        accept=".docx"
                        onChange={(e) => handleSlotFileChange(card.id, e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Input Mode B: Multi-File Drag & Drop */}
      {activeMode === 'batch' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c121e] p-6 shadow-sm space-y-4">
          <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-orange-500 rounded-2xl bg-slate-50/60 dark:bg-[#080d16] cursor-pointer transition-colors text-center group">
            <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-orange-600 dark:group-hover:text-orange-500 mb-3 transition-colors" />
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Tarik & Lepas File Dokumen Word di Sini
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Atau klik untuk memilih satu atau banyak file .docx sekaligus
            </span>
            <input
              type="file"
              accept=".docx"
              multiple
              onChange={(e) => handleBatchFilesAdded(e.target.files)}
              className="hidden"
            />
          </label>

          {batchFiles.length > 0 && (
            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                <span>Daftar Berkas Terpilih ({batchFiles.length}):</span>
                <button
                  onClick={() => setBatchFiles([])}
                  className="text-red-500 hover:underline text-[11px]"
                >
                  Hapus Semua
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {batchFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#070b12] border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-orange-600 dark:text-orange-500 shrink-0" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {file.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeBatchFile(idx)}
                      className="text-slate-400 hover:text-red-500 p-0.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Trigger Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c121e] p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              1. Ekstraksi Data Dokumen Word
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedCount > 0
                ? `${selectedCount} berkas siap diproses. Klik tombol untuk membaca seluruh tabel dan memetakan unit.`
                : 'Pilih file Word di atas terlebih dahulu.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleParseFiles}
            disabled={isParsing || selectedCount === 0}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-white font-semibold text-xs rounded-xl shadow-lg shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isParsing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengekstrak Data Lokal...</span>
              </>
            ) : (
              <>
                <span>Mulai Ekstraksi Berkas Word</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Extraction Results & Actions */}
      {parsedFiles.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c121e] p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Hasil Ekstraksi ({extractedItems.length} Kegiatan)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Target Tanggal: <strong className="text-slate-800 dark:text-slate-200">{targetDate}</strong> • Kejadian Menonjol: <strong className="text-slate-800 dark:text-slate-200">{extractedIncidents.length}</strong>
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handleMergeAndSave}
                disabled={isMerging}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title="Gabungkan seluruh data dan simpan ke komputer (.docx)"
              >
                {isMerging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>Gabungkan & Simpan Dokumen (.docx)</span>
              </button>

              {lastSavedPath && (
                <button
                  type="button"
                  onClick={() => handleOpenSavedFile(lastSavedPath)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                  title={`Buka ${lastSavedPath} di Microsoft Word`}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Buka di Microsoft Word</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadExcel}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                title="Ekspor data hasil ekstraksi ke spreadsheet Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Ekspor Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handleResetData}
                className="p-2.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                title="Reset seluruh data"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Files Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {parsedFiles.map((pf, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 dark:bg-[#070b12] border border-slate-200 dark:border-slate-800 text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span>{pf.subsatgas}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {pf.items_count} baris
                  </span>
                </div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate text-[11px]" title={pf.filename}>
                  {pf.filename}
                </div>
              </div>
            ))}
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari unit, lokasi, kegiatan..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-[#070b12] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto scrollbar-none">
              {['ALL', 'MINOPS', 'LIDIK', 'INVESTIGASI', 'ANALIS'].map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSubsatgasFilter(sub)}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                    subsatgasFilter === sub
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {/* Table Preview */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2.5 px-3 w-12 text-center">NO</th>
                  <th className="py-2.5 px-3 w-28">SUBSATGAS</th>
                  <th className="py-2.5 px-3 w-36">UNIT / WILAYAH</th>
                  <th className="py-2.5 px-3 w-32">WAKTU / PERS</th>
                  <th className="py-2.5 px-3 w-36">LOKASI</th>
                  <th className="py-2.5 px-3 min-w-[200px]">KEGIATAN</th>
                  <th className="py-2.5 px-3 min-w-[200px]">HASIL YANG DICAPAI</th>
                  <th className="py-2.5 px-3 w-24">KET</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Tidak ada kegiatan yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            item.subsatgas === 'MINOPS'
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              : item.subsatgas === 'LIDIK'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : item.subsatgas === 'INVESTIGASI'
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                              : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          }`}
                        >
                          {item.subsatgas}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                        {item.unit_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 text-[11px]">
                        <div className="font-semibold">{item.activity_time || '-'}</div>
                        <div className="text-slate-400 text-[10px]">{item.personnel_count || '-'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                        {item.location || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                        {item.activity_desc || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                        {item.results || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {item.drawings && item.drawings.length > 0 && (
                          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 mb-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20">
                            📷 {item.drawings.length} Foto
                          </div>
                        )}
                        <div>{item.notes || '-'}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Kejadian Menonjol Table */}
          {extractedIncidents.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span>Kejadian Menonjol ({extractedIncidents.length} Kejadian)</span>
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 px-3 w-12 text-center">NO</th>
                      <th className="py-2.5 px-3 w-28">WAKTU</th>
                      <th className="py-2.5 px-3 w-36">LOKASI</th>
                      <th className="py-2.5 px-3 min-w-[200px]">KEJADIAN</th>
                      <th className="py-2.5 px-3 min-w-[150px]">KORBAN / KERUGIAN</th>
                      <th className="py-2.5 px-3 min-w-[150px]">TINDAKAN</th>
                      <th className="py-2.5 px-3 w-24">KET</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {extractedIncidents.map((inc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold">{inc.incident_time || '-'}</td>
                        <td className="py-2.5 px-3">{inc.location || '-'}</td>
                        <td className="py-2.5 px-3 font-medium">{inc.incident_desc || '-'}</td>
                        <td className="py-2.5 px-3">{inc.casualties_losses || '-'}</td>
                        <td className="py-2.5 px-3">{inc.actions_taken || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-400">{inc.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
