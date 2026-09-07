'use client';

import React from 'react';
import { ShieldCheck, Activity, RefreshCw, Smartphone, Laptop, AlertTriangle, Bot } from 'lucide-react';
import { PWAInstallButton } from './pwa-install-button';
import { SystemHealthBadge } from './system-health-badge';

interface HeaderProps {
  dataMode: 'LIVE' | 'DELAYED' | 'REPLAYED' | 'SIMULATED' | 'STALE' | 'UNKNOWN';
  accountMaskedId: string;
  equity: number;
  balance: number;
  onRefresh?: () => void;
  isBlocked?: boolean;
  currentViewMode?: 'auto' | 'mobile' | 'windows';
  onChangeViewMode?: (mode: 'auto' | 'mobile' | 'windows') => void;
  activeModelName?: string;
  onOpenAIModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  dataMode,
  accountMaskedId,
  equity,
  balance,
  onRefresh,
  isBlocked,
  currentViewMode = 'auto',
  onChangeViewMode,
  activeModelName,
  onOpenAIModal,
}) => {
  const getBadgeColor = () => {
    switch (dataMode) {
      case 'LIVE':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'REPLAYED':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'SIMULATED':
        return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'STALE':
      case 'UNKNOWN':
        return 'bg-rose-950 text-rose-300 border-rose-800';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <header className="w-full bg-zinc-900 border-b border-zinc-800 px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* نشان برند و وضعیت سیستم */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-zinc-100">آزمایشگاه معاملاتی حامد</h1>
                {/* نشان دائمی دمو - الزامی در تمامی صفحات */}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  DEMO ONLY
                </span>
              </div>
              <p className="text-xs text-zinc-400">نسخه ۱ — تحلیل و ارسال محدود cTrader Demo</p>
            </div>
          </div>

          {/* دکمه انتخاب حالت طراحی: ویندوز دسکتاپ یا موبایل */}
          {onChangeViewMode && (
            <div className="flex items-center gap-0.5 bg-zinc-800/90 p-0.5 rounded-lg border border-zinc-700/60 text-[11px]">
              <button
                onClick={() => onChangeViewMode('windows')}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                  currentViewMode === 'windows'
                    ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="نمایش حالت اختصاصی ویندوز دسکتاپ"
              >
                <Laptop className="w-3 h-3" />
                <span className="hidden sm:inline">ویندوز</span>
              </button>
              <button
                onClick={() => onChangeViewMode('mobile')}
                className={`px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                  currentViewMode === 'mobile'
                    ? 'bg-amber-950 text-amber-300 font-bold border border-amber-800'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="نمایش حالت اختصاصی موبایل و فولد"
              >
                <Smartphone className="w-3 h-3" />
                <span className="hidden sm:inline">موبایل</span>
              </button>
            </div>
          )}

          {/* دکمه باز کردن پنجره دانلود و مدیریت هوش مصنوعی */}
          {onOpenAIModal && (
            <button
              onClick={onOpenAIModal}
              className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900/90 border border-cyan-700/70 text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="انتخاب و دانلود مدل‌های هوش مصنوعی آفلاین"
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">مدل هوش مصنوعی:</span>
              <span className="max-w-[110px] truncate font-mono text-[11px] text-zinc-200">
                {activeModelName || 'S0 آفلاین'}
              </span>
            </button>
          )}

          {/* دکمه نصب PWA */}
          <PWAInstallButton />

          {/* نشان پایش سلامت سرور (مرحله ۹) */}
          <SystemHealthBadge />
        </div>

        {/* اطلاعات حساب و وضعیت داده */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end text-xs">
          {/* وضعیت داده */}
          <div className={`px-2.5 py-1 rounded-full border text-xs font-medium flex items-center gap-1.5 ${getBadgeColor()}`}>
            <Activity className="w-3 h-3 animate-pulse" />
            <span>وضعیت: {dataMode}</span>
          </div>

          {/* هشدار قفل سراسری در صورت وجود وضعیت UNKNOWN */}
          {isBlocked && (
            <div className="px-2.5 py-1 rounded-full border border-rose-800 bg-rose-950 text-rose-300 flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              <span>قفل ایمنی بازتطبیق</span>
            </div>
          )}

          {/* موجودی و اکوئیتی حساب دمو */}
          <div className="flex items-center gap-3 bg-zinc-800/90 px-3 py-1.5 rounded-lg border border-zinc-700">
            <div className="text-right">
              <div className="text-[10px] text-zinc-400">حساب دمو: {accountMaskedId}</div>
              <div className="text-xs font-mono font-semibold text-zinc-200">
                ${equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="به‌روزرسانی داده‌ها"
                className="p-1 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
