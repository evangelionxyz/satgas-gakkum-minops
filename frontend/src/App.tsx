import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { UpdateProvider } from './components/UpdateChecker';
import { Navbar } from './components/Navbar';
import { WordMergerView } from './components/WordMergerView';
import { Toaster } from 'sonner';

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MainApp: React.FC = () => {
  const [selectedDate] = useState<string>(getTodayString());

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#070b12] text-slate-900 dark:text-slate-100 transition-colors duration-200 font-sans selection:bg-orange-500/20 selection:text-orange-600 dark:selection:text-orange-400">
      {/* Top Header Navigation */}
      <Navbar />

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <WordMergerView selectedDate={selectedDate} />
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#090e17]/80 backdrop-blur-md py-4 px-4 sm:px-6 lg:px-8 mt-auto">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              OPERASI DAMAI CARTENZ 2026
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>Satgas Gakkum Minops</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-orange-600 dark:text-orange-400 font-medium">Standalone Desktop Edition (100% Offline)</span>
          </div>
          <div>
            <span>Sistem Kompilasi Dokumen Word Resmi</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <UpdateProvider>
        <MainApp />
        <Toaster position="top-right" richColors closeButton />
      </UpdateProvider>
    </ThemeProvider>
  );
}
