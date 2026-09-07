// components/trading/offline-ai-manager-modal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  AVAILABLE_OFFLINE_MODELS,
  OfflineAIModel,
  BrowserOfflineAIManager,
} from '@/lib/ai/browser-offline-ai';
import {
  Bot,
  Download,
  CheckCircle2,
  Trash2,
  Play,
  Cpu,
  ShieldCheck,
  HardDrive,
  Sliders,
  ExternalLink,
  X,
  Sparkles,
  Zap,
} from 'lucide-react';

interface OfflineAIManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  currentPrice: number;
  symbol: string;
}

export const OfflineAIManagerModal: React.FC<OfflineAIManagerModalProps> = ({
  isOpen,
  onClose,
  selectedModelId,
  onSelectModel,
  currentPrice,
  symbol,
}) => {
  const [downloadedMap, setDownloadedMap] = useState<Record<string, boolean>>({});
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    downloadedMB: number;
    totalMB: number;
    speedMBs: number;
  }>({ percent: 0, downloadedMB: 0, totalMB: 0, speedMBs: 0 });

  const [testResult, setTestResult] = useState<{ modelId: string; text: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [localEndpointInput, setLocalEndpointInput] = useState('http://localhost:11434/v1');

  // بررسی وضعیت مدل‌های دانلود شده در حافظه مرورگر
  const refreshDownloadedStatus = async () => {
    const map: Record<string, boolean> = {};
    for (const model of AVAILABLE_OFFLINE_MODELS) {
      map[model.id] = await BrowserOfflineAIManager.isModelDownloaded(model.id);
    }
    setDownloadedMap(map);
  };

  useEffect(() => {
    if (isOpen) {
      refreshDownloadedStatus();
      setLocalEndpointInput(BrowserOfflineAIManager.getLocalEndpoint());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // مدیریت فرآیند دانلود با نوار پیشرفت
  const handleStartDownload = async (model: OfflineAIModel) => {
    try {
      setDownloadingModelId(model.id);
      setDownloadProgress({ percent: 0, downloadedMB: 0, totalMB: model.sizeMB, speedMBs: 0 });

      await BrowserOfflineAIManager.downloadModel(
        model.id,
        (percent, downloadedMB, totalMB, speedMBs) => {
          setDownloadProgress({ percent, downloadedMB, totalMB, speedMBs });
        }
      );

      await refreshDownloadedStatus();
      onSelectModel(model.id);
    } catch (err) {
      alert(`خطا در دانلود مدل: ${(err as Error).message}`);
    } finally {
      setDownloadingModelId(null);
    }
  };

  // حذف مدل از کش
  const handleDeleteModel = async (modelId: string) => {
    if (confirm('آیا از حذف فایل‌های این مدل از کش مرورگر مطمئن هستید؟')) {
      await BrowserOfflineAIManager.deleteDownloadedModel(modelId);
      await refreshDownloadedStatus();
      if (selectedModelId === modelId) {
        onSelectModel('s0-deterministic');
      }
    }
  };

  // تست استنتاج مدل
  const handleRunTest = async (modelId: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const output = await BrowserOfflineAIManager.runInferenceTest(modelId, symbol, currentPrice);
      setTestResult({ modelId, text: output });
    } catch (err) {
      setTestResult({ modelId, text: `خطا در استنتاج: ${(err as Error).message}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveEndpoint = () => {
    BrowserOfflineAIManager.setLocalEndpoint(localEndpointInput);
    alert('آدرس پورت هوش مصنوعی محلی با موفقیت ذخیره شد.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-750 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-right font-sans">
        {/* سربرگ پنجره */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-700/60 text-cyan-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>مرکز دانلود و مدیریت هوش‌های مصنوعی آفلاین</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                  ۱۰۰٪ مرورگری و محلی
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                انتخاب، دانلود مستقیم به کش مرورگر و اجرای مدل‌ها بدون خروج حتی ۱ بایت دیتا
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* بدنه اسکرول‌شونده */}
        <div className="p-4 md:p-6 space-y-4 overflow-y-auto text-xs">
          {/* بنر تضمین ایمنی و آفلاین بودن */}
          <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl flex items-start gap-3 text-zinc-300">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-zinc-100 text-xs">تضمین عدم نشت داده و استقلال کامل:</div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                تمام فرآیند دانلود و ذخیره‌سازی درون کش اختصاصی مرورگر شما (CacheStorage) انجام شده و پردازش استنتاج
                توسط پردازنده سیستم شما صورت می‌گیرد. هیچ داده بازاری یا مالی به سرورهای ابری فرستاده نمی‌شود.
              </p>
            </div>
          </div>

          {/* نوار وضعیت دانلود فعال (اگر دانلودی در جریان است) */}
          {downloadingModelId && (
            <div className="p-4 bg-cyan-950/40 border border-cyan-700 rounded-xl space-y-2.5 animate-pulse">
              <div className="flex items-center justify-between text-cyan-300 font-medium">
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4 animate-bounce" />
                  <span>در حال دانلود مدل به حافظه مرورگر...</span>
                </span>
                <span className="font-mono font-bold">{downloadProgress.percent}٪</span>
              </div>
              {/* پروگرس بار */}
              <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full transition-all duration-150 rounded-full"
                  style={{ width: `${downloadProgress.percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>
                  حجم دریافت‌شده: {downloadProgress.downloadedMB} / {downloadProgress.totalMB} مگابایت
                </span>
                <span>سرعت: {downloadProgress.speedMBs} MB/s</span>
              </div>
            </div>
          )}

          {/* لیست مدل‌های در دسترس */}
          <div className="space-y-3">
            <h3 className="font-bold text-zinc-200 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>مدل‌های هوش مصنوعی موجود:</span>
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {AVAILABLE_OFFLINE_MODELS.map(model => {
                const isSelected = selectedModelId === model.id;
                const isDownloaded = downloadedMap[model.id];
                const isDownloadingThis = downloadingModelId === model.id;

                return (
                  <div
                    key={model.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-zinc-850 border-cyan-500 shadow-md shadow-cyan-950/40'
                        : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* مشخصات مدل */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-zinc-100">{model.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
                            {model.version}
                          </span>
                          {model.isBuiltIn ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                              توکار و آماده
                            </span>
                          ) : isDownloaded ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-950/80 border border-cyan-800 text-cyan-300 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              دانلود شده ({model.sizeMB} MB)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/80 border border-amber-800 text-amber-300">
                              نیاز به دانلود ({model.sizeMB} MB)
                            </span>
                          )}
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-600 text-white">
                              مدل فعال فعلی
                            </span>
                          )}
                        </div>

                        <p className="text-zinc-400 text-xs leading-relaxed">{model.description}</p>
                        <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-3 pt-0.5">
                          <span>معماری: {model.architecture}</span>
                          {model.parameters && <span>پارامترها: {model.parameters}</span>}
                        </div>
                      </div>

                      {/* دکمه‌های عملیات */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* آزمون استنتاج */}
                        <button
                          onClick={() => handleRunTest(model.id)}
                          disabled={isTesting || (!model.isBuiltIn && !isDownloaded)}
                          className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 hover:text-white rounded-lg font-medium flex items-center gap-1 transition-colors"
                          title="آزمون پاسخ فوری مدل با قیمت جاری"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>تست زنده</span>
                        </button>

                        {/* دکمه دانلود یا حذف کش */}
                        {!model.isBuiltIn && (
                          <>
                            {!isDownloaded ? (
                              <button
                                onClick={() => handleStartDownload(model)}
                                disabled={!!downloadingModelId}
                                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition-all"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>دانلود به مرورگر</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleDeleteModel(model.id)}
                                className="p-1.5 bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-300 rounded-lg transition-colors"
                                title="حذف فایل‌های مدل از کش مرورگر"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}

                        {/* دکمه انتخاب به عنوان مدل فعال */}
                        <button
                          onClick={() => onSelectModel(model.id)}
                          disabled={!model.isBuiltIn && !isDownloaded}
                          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                            isSelected
                              ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-default'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                          }`}
                        >
                          {isSelected ? 'فعال است' : 'انتخاب مدل'}
                        </button>
                      </div>
                    </div>

                    {/* فیلد تنظیمات پورت در صورت انتخاب اندپوینت محلی */}
                    {model.id === 'custom-local-ollama' && (
                      <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-2">
                        <span className="text-zinc-400 text-[11px]">آدرس پورت لوکال (Ollama/LM Studio):</span>
                        <input
                          type="text"
                          value={localEndpointInput}
                          onChange={e => setLocalEndpointInput(e.target.value)}
                          className="px-2.5 py-1 bg-zinc-900 border border-zinc-750 rounded text-xs font-mono text-cyan-300 w-56 text-left"
                          dir="ltr"
                        />
                        <button
                          onClick={handleSaveEndpoint}
                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs"
                        >
                          ذخیره پورت
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* کادر نتیجه تست زنده استنتاج */}
          {testResult && (
            <div className="p-3.5 bg-zinc-950 border border-cyan-800/60 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-cyan-300 font-bold text-xs">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>نتیجه استنتاج زنده هوش مصنوعی:</span>
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  نماد: {symbol} | قیمت: {currentPrice}
                </span>
              </div>
              <p className="text-zinc-300 text-xs leading-relaxed font-sans">{testResult.text}</p>
            </div>
          )}
        </div>

        {/* پاورقی مودال */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
            <span>مدل فعال ذخیره‌شده در مرورگر:</span>
            <span className="font-bold text-cyan-400">
              {AVAILABLE_OFFLINE_MODELS.find(m => m.id === selectedModelId)?.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
