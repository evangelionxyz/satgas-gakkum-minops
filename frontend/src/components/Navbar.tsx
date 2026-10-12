import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useUpdater } from './UpdateChecker';
import {
  Sun,
  Moon,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { currentVersion, checkForUpdates, isChecking } = useUpdater();

  return (
    <header className="no-print sticky top-0 z-40 bg-white/80 dark:bg-[#070b12]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Brand & Badge */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                SATGAS GAKKUM MINOPS
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {currentVersion || 'v1.0.0'}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Operasi Damai Cartenz 2026 • Laporan Harian (LAPHAR)
            </p>
          </div>
        </div>

        {/* Right Actions: Auto-Updater Check & Theme Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Check for Updates Button */}
          <button
            type="button"
            onClick={() => checkForUpdates(false)}
            disabled={isChecking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#0c121e] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            title="Periksa rilis pembaruan terbaru di GitHub"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-500 ${isChecking ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Periksa Pembaruan</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#0c121e] text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 border border-slate-200 dark:border-slate-800 transition-colors shadow-xs"
            title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
