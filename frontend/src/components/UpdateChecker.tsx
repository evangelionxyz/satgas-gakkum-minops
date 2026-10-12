import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { isTauriEnvironment } from "../services/api";
import { toast } from "sonner";
import {
  Download,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  X,
} from "lucide-react";

interface UpdateContextType {
  currentVersion: string;
  updateInfo: any;
  isChecking: boolean;
  isDownloading: boolean;
  progress: number | null;
  isDialogOpen: boolean;
  setIsDialogOpen: (open: boolean) => void;
  checkForUpdates: (silent?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextType | null>(null);

let cachedAppVersion = "";

/**
 * Mengambil versi aplikasi desktop secara dinamis dari binary Tauri.
 */
export async function getAppVersion(): Promise<string> {
  if (cachedAppVersion) return cachedAppVersion;
  if (!isTauriEnvironment()) return "v1.0.0 (Web)";
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    const v = await getVersion();
    if (v) {
      cachedAppVersion = v.startsWith("v") ? v : `v${v}`;
      return cachedAppVersion;
    }
  } catch (err) {
    console.warn("[Auto-Updater] Gagal membaca versi aplikasi:", err);
  }
  return "v1.0.0";
}

export function useUpdater() {
  const context = useContext(UpdateContext);
  if (!context) {
    return {
      currentVersion: "",
      updateInfo: null,
      isChecking: false,
      isDownloading: false,
      progress: null,
      isDialogOpen: false,
      setIsDialogOpen: () => {},
      checkForUpdates: async () => {},
      installUpdate: async () => {},
    };
  }
  return context;
}

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    getAppVersion().then((v) => {
      if (v) setCurrentVersion(v);
    });
  }, []);

  const checkForUpdates = useCallback(async (silent = false) => {
    if (!isTauriEnvironment()) {
      if (!silent) {
        toast.info("Pembaruan otomatis hanya tersedia pada aplikasi desktop Tauri.");
      }
      return;
    }

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);
    const ver = cachedAppVersion || (await getAppVersion());
    const verSuffix = ver ? ` (${ver})` : "";

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update?.available) {
        setUpdateInfo(update);
        setIsDialogOpen(true);
        if (!silent) {
          toast.info(`Versi baru v${update.version} tersedia!`, {
            icon: <Sparkles className="h-4 w-4 text-orange-500" />,
          });
        }
      } else {
        setUpdateInfo(null);
        if (!silent) {
          toast.success(`Aplikasi sudah menggunakan versi terbaru${verSuffix}.`, {
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          });
        }
      }
    } catch (err: any) {
      const errMsg = String(err?.message || err || "");
      const isNotFoundOrNoRelease =
        errMsg.includes("404") ||
        errMsg.toLowerCase().includes("not found") ||
        errMsg.includes("valid release JSON") ||
        errMsg.includes("release JSON");

      if (isNotFoundOrNoRelease) {
        setUpdateInfo(null);
        if (!silent) {
          toast.success(`Aplikasi sudah menggunakan versi terbaru${verSuffix}.`, {
            description: "Belum ada rilis baru yang dipublikasikan di GitHub.",
            icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
          });
        }
      } else {
        console.warn("[Auto-Updater] Gagal memeriksa pembaruan:", err);
        if (!silent) {
          toast.error("Gagal memeriksa pembaruan otomatis", {
            description: errMsg || "Silakan periksa koneksi internet Anda.",
          });
        }
      }
    } finally {
      setIsChecking(false);
      isCheckingRef.current = false;
    }
  }, []);

  // Periksa update otomatis saat pertama kali dibuka (silent mode)
  useEffect(() => {
    if (!isTauriEnvironment()) return;
    const timer = setTimeout(() => {
      checkForUpdates(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  const installUpdate = async () => {
    if (!updateInfo) return;
    setIsDownloading(true);
    setProgress(0);

    try {
      let downloaded = 0;
      let contentLength = 0;

      await updateInfo.downloadAndInstall((event: any) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength || 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              const pct = Math.round((downloaded / contentLength) * 100);
              setProgress(pct);
            }
            break;
          case "Finished":
            setProgress(100);
            break;
        }
      });

      toast.success("Pembaruan berhasil diunduh. Memulai ulang aplikasi...", {
        duration: 4000,
      });

      setTimeout(async () => {
        try {
          const { relaunch } = await import("@tauri-apps/plugin-process");
          await relaunch();
        } catch {
          window.location.reload();
        }
      }, 1500);
    } catch (err: any) {
      console.error("[Auto-Updater] Gagal mengunduh atau memasang update:", err);
      toast.error("Gagal memasang pembaruan", {
        description: String(err?.message || err),
      });
      setIsDownloading(false);
      setProgress(null);
    }
  };

  return (
    <UpdateContext.Provider
      value={{
        currentVersion,
        updateInfo,
        isChecking,
        isDownloading,
        progress,
        isDialogOpen,
        setIsDialogOpen,
        checkForUpdates,
        installUpdate,
      }}
    >
      {children}
      <UpdateDialogModal />
    </UpdateContext.Provider>
  );
}

function UpdateDialogModal() {
  const {
    isDialogOpen,
    setIsDialogOpen,
    updateInfo,
    isDownloading,
    progress,
    installUpdate,
    currentVersion,
  } = useUpdater();

  if (!isDialogOpen || !updateInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/30">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Pembaruan Aplikasi Tersedia
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Versi baru telah dirilis untuk Satgas Gakkum Minops.
              </p>
            </div>
          </div>
          {!isDownloading && (
            <button
              onClick={() => setIsDialogOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Versions Info */}
        <div className="mt-5 grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-[#080d16] border border-slate-200 dark:border-slate-800/80 rounded-xl text-center">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Versi Saat Ini
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5 inline-block">
              {currentVersion || "v1.0.0"}
            </span>
          </div>
          <div className="border-l border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-medium text-orange-500 dark:text-orange-400 uppercase tracking-wider block">
              Versi Terbaru
            </span>
            <span className="text-sm font-bold text-orange-600 dark:text-orange-400 mt-0.5 inline-block">
              v{updateInfo.version}
            </span>
          </div>
        </div>

        {/* Release Notes */}
        {updateInfo.body && (
          <div className="mt-4">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Catatan Pembaruan:
            </span>
            <div className="max-h-36 overflow-y-auto text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-[#070b12] p-3 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-wrap leading-relaxed font-mono">
              {updateInfo.body}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isDownloading && (
          <div className="mt-5 space-y-2">
            <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-500" />
                Mengunduh pembaruan...
              </span>
              <span>{progress !== null ? `${progress}%` : "Mempersiapkan..."}</span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300 rounded-full"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 text-center">
              Mohon tunggu, aplikasi akan otomatis dimulai ulang setelah instalasi selesai.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {!isDownloading ? (
            <>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Nanti Saja
              </button>
              <button
                type="button"
                onClick={installUpdate}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 rounded-xl shadow-lg shadow-orange-500/25 active:scale-95 transition-all"
              >
                <Download className="w-4 h-4" />
                Unduh & Pasang Sekarang
              </button>
            </>
          ) : (
            <button
              disabled
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4 animate-spin" />
              Memproses Instalasi...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
