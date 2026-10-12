import { invoke } from '@tauri-apps/api/core';

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    window.location.protocol === 'tauri:' ||
    window.location.protocol === 'asset:' ||
    window.location.hostname === 'tauri.localhost'
  );
}

export interface CellDrawing {
  col_idx: number;
  drawing_xml: string;
  media_id: string;
  original_target: string;
  image_base64?: string;
}

export interface ActivityItem {
  subsatgas: string;
  unit_name: string;
  satgas: string;
  activity_time: string;
  personnel_count: string;
  location: string;
  activity_desc: string;
  results: string;
  notes: string;
  drawings?: CellDrawing[];
}

export interface IncidentItem {
  incident_time: string;
  location: string;
  incident_desc: string;
  casualties_losses: string;
  actions_taken: string;
  notes: string;
}

export interface FileSummary {
  filename: string;
  subsatgas: string;
  items_count: number;
  incidents_count: number;
  detected_date: string | null;
  error?: string | null;
}

export interface ParseResult {
  total_files: number;
  detected_date: string | null;
  files: FileSummary[];
  total_items: number;
  total_incidents: number;
  items: ActivityItem[];
  incidents: IncidentItem[];
}

export interface SignatureConfig {
  signature_city?: string;
  kasatgas_name?: string;
  kasatgas_rank_nrp?: string;
}

export interface MergePayload {
  date: string;
  items: ActivityItem[];
  incidents?: IncidentItem[];
  signature_config?: SignatureConfig;
}

export const api = {
  /**
   * Parse multiple DOCX files using native Rust engine
   */
  async parseDocxFiles(files: File[]): Promise<ParseResult> {
    if (isTauriEnvironment()) {
      const fileInputs = await Promise.all(
        files.map(async (file) => {
          const buffer = await file.arrayBuffer();
          return {
            filename: file.name,
            data: Array.from(new Uint8Array(buffer)),
          };
        })
      );

      return await invoke<ParseResult>('parse_docx_files', { files: fileInputs });
    }

    // Fallback if testing in pure web browser:
    throw new Error('Aplikasi ini berjalan sebagai aplikasi desktop Tauri. Silakan buka aplikasi melalui Tauri.');
  },

  /**
   * Merge parsed activities & incidents into official master LAPHAR Word template.
   * Returns binary Blob.
   */
  async mergeToDocx(payload: MergePayload): Promise<Blob> {
    if (isTauriEnvironment()) {
      const bytes = await invoke<number[]>('merge_docx', { payload });
      return new Blob([new Uint8Array(bytes)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    }

    throw new Error('Aplikasi ini berjalan sebagai aplikasi desktop Tauri.');
  },

  /**
   * Merge and prompt user to save directly to local disk using Tauri native Save Dialog.
   */
  async mergeAndSaveNative(payload: MergePayload, defaultFilename?: string): Promise<string | null> {
    if (isTauriEnvironment()) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filename = defaultFilename || `LAPHAR_${payload.date}_SATGAS_GAKKUM.docx`;

      const selectedPath = await save({
        defaultPath: filename,
        filters: [
          {
            name: 'Word Document (*.docx)',
            extensions: ['docx'],
          },
        ],
      });

      if (!selectedPath) {
        return null; // User cancelled
      }

      await invoke<string>('merge_and_save_docx', {
        payload,
        filePath: selectedPath,
      });

      return selectedPath;
    }

    // Web fallback
    const blob = await this.mergeToDocx(payload);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename || `LAPHAR_${payload.date}_SATGAS_GAKKUM.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return defaultFilename || 'downloaded';
  },

  /**
   * One-step Upload & Merge
   */
  async uploadAndMergeDirect(files: File[], targetDate: string, signatureConfig?: SignatureConfig): Promise<Blob> {
    const parseResult = await this.parseDocxFiles(files);
    const dateToUse = targetDate || parseResult.detected_date || new Date().toISOString().split('T')[0];

    return await this.mergeToDocx({
      date: dateToUse,
      items: parseResult.items,
      incidents: parseResult.incidents,
      signature_config: signatureConfig,
    });
  },
};
