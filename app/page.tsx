'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { SymbolId } from '@/lib/contracts/market';
import { StrategyCandidate } from '@/lib/contracts/strategy';
import { RiskPreviewResult } from '@/lib/contracts/risk';
import { TransactionalOutboxRecord } from '@/lib/contracts/execution';
import { SimulatedBroker } from '@/lib/core/simulated-broker';
import { ReplayEngine, ReplayState } from '@/lib/replay/replay-engine';
import { calculateDeterministicRisk } from '@/lib/core/risk-calculator';
import { Header } from '@/components/trading/header';
import { ChartCanvas } from '@/components/trading/chart-canvas';
import { OrderIntentModal } from '@/components/trading/order-intent-modal';
import { OutboxExecutionCard } from '@/components/trading/outbox-execution-card';
import { TestRunnerPanel } from '@/components/trading/test-runner-panel';
import { JournalView } from '@/components/trading/journal-view';
import { OfflineIndicator } from '@/components/trading/offline-indicator';
import { SecurityDRPanel } from '@/components/trading/security-dr-panel';
import { ExportImportModal } from '@/components/trading/export-import-modal';
import { OfflineAISelectorModal } from '@/components/trading/offline-ai-selector-modal';
import { PersistenceStorage, AppExportPayloadV1 } from '@/lib/persistence/storage';
import {
  AnalystCriticPipeline,
  OfflineAIProfileId,
  OFFLINE_AI_PROFILES,
} from '@/lib/core/analyst-critic';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Sliders,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Coins,
  DollarSign,
  Send,
  Database,
  Power,
  Clock,
  Cpu,
  Bot,
} from 'lucide-react';

const broker = new SimulatedBroker(10000);
const replayEngine = new ReplayEngine('XAUUSD', broker);

export default function TradingLabPage() {
  const [symbol, setSymbol] = useState<SymbolId>('XAUUSD');
  const [replayState, setReplayState] = useState<ReplayState>(replayEngine.getSnapshot());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [outboxRecords, setOutboxRecords] = useState<TransactionalOutboxRecord[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockingReason, setBlockingReason] = useState<string | undefined>();
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  // وضعیت‌های جلسه تحلیلی و بازپخش خودکار
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(1000); // ۱ ثانیه پیش‌فرض (1x)
  const [isSessionActive, setIsSessionActive] = useState(true);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // وضعیت مدل هوش مصنوعی آفلاین انتخابی با مقداردهی اولیه از حافظه محلی
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiProfileId, setAiProfileId] = useState<OfflineAIProfileId>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hamed_trading_offline_ai_profile');
        if (saved) return saved as OfflineAIProfileId;
      } catch {}
    }
    return 'local-offline-s0-v1';
  });
  const [customEndpoint, setCustomEndpoint] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hamed_trading_local_ai_endpoint');
        if (saved) return saved;
      } catch {}
    }
    return 'http://localhost:11434/v1';
  });

  const handleSelectAIProfile = (profileId: OfflineAIProfileId, endpointUrl: string) => {
    setAiProfileId(profileId);
    setCustomEndpoint(endpointUrl);
    try {
      localStorage.setItem('hamed_trading_offline_ai_profile', profileId);
      localStorage.setItem('hamed_trading_local_ai_endpoint', endpointUrl);
    } catch {}
  };

  // محاسبه مستقیم کنترل ریسک به صورت وضعیت مشتق‌شده (Derived State)
  const riskPreview: RiskPreviewResult | null = useMemo(() => {
    if (!replayState.activeCandidate) return null;
    return calculateDeterministicRisk({
      symbol: replayState.activeCandidate.symbol,
      direction: replayState.activeCandidate.direction,
      entryPrice: replayState.activeCandidate.entryPrice,
      stopLossPrice: replayState.activeCandidate.stopLossPrice,
      takeProfitPrice: replayState.activeCandidate.takeProfitPrice,
      accountEquity: broker.getState().accountEquity,
      riskPercentage: 0.25,
    });
  }, [replayState.activeCandidate]);

  // ارزیابی هوش مصنوعی ساختاریافته آفلاین در سایه (Local Offline Shadow Pipeline)
  const shadowAnalysis = useMemo(() => {
    if (!replayState.activeCandidate) return null;
    return AnalystCriticPipeline.runShadowPipeline(
      replayState.activeCandidate,
      aiProfileId,
      customEndpoint
    );
  }, [replayState.activeCandidate, aiProfileId, customEndpoint]);

  // واکشی رکوردهای صندوق تراکنشی
  const fetchOutbox = async () => {
    try {
      const res = await fetch('/api/orders/outbox');
      if (res.ok) {
        const data = await res.json();
        setOutboxRecords(data.records || []);
        setIsBlocked(data.isBlocked || false);
        setBlockingReason(data.blockingReason);
      }
    } catch {
      // نادیده گرفتن خطای شبکه لحظه‌ای
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadOutbox = async () => {
      try {
        const res = await fetch('/api/orders/outbox');
        if (res.ok && isMounted) {
          const data = await res.json();
          setOutboxRecords(data.records || []);
          setIsBlocked(data.isBlocked || false);
          setBlockingReason(data.blockingReason);
        }
      } catch {
        // نادیده گرفتن
      }
    };

    loadOutbox();
    const interval = setInterval(loadOutbox, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // زمان‌سنج جلسه کاری
  useEffect(() => {
    if (!isSessionActive) return;
    const timer = setInterval(() => {
      setSessionSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isSessionActive]);

  // حلقه پخش خودکار کندل‌ها (Play / Pause Replay Loop)
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setReplayState(prev => {
        if (prev.currentStepIndex >= prev.totalSteps - 1) {
          setIsPlaying(false);
          return prev;
        }
        const next = replayEngine.stepForward();
        return { ...next };
      });
    }, speedMs);
    return () => clearInterval(timer);
  }, [isPlaying, speedMs]);

  // بارگذاری اولیه وضعیت از حافظه محلی در زمان شروع
  useEffect(() => {
    const timer = setTimeout(() => {
      const saved = PersistenceStorage.loadFromLocal();
      if (saved) {
        if (saved.symbol === 'XAUUSD' || saved.symbol === 'EURUSD') {
          setSymbol(saved.symbol);
          replayEngine.setSymbol(saved.symbol);
        }
        for (let i = 14; i < saved.currentStepIndex; i++) {
          replayEngine.stepForward();
        }
        setReplayState(replayEngine.getSnapshot());
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // کنترل تغییر نماد
  const handleSymbolChange = (newSymbol: SymbolId) => {
    setSymbol(newSymbol);
    replayEngine.setSymbol(newSymbol);
    const snap = replayEngine.getSnapshot();
    setReplayState(snap);
    PersistenceStorage.saveToLocal({
      symbol: newSymbol,
      currentStepIndex: snap.currentStepIndex,
      accountBalance: broker.getState().accountBalance,
      accountEquity: broker.getState().accountEquity,
    });
  };

  // کنترل گام ریپلی
  const handleStepForward = () => {
    const next = replayEngine.stepForward();
    setReplayState({ ...next });
    PersistenceStorage.saveToLocal({
      symbol,
      currentStepIndex: next.currentStepIndex,
      accountBalance: broker.getState().accountBalance,
      accountEquity: broker.getState().accountEquity,
    });
  };

  const handleResetReplay = () => {
    setIsPlaying(false);
    const next = replayEngine.reset();
    setReplayState({ ...next });
    PersistenceStorage.saveToLocal({
      symbol,
      currentStepIndex: next.currentStepIndex,
      accountBalance: broker.getState().accountBalance,
      accountEquity: broker.getState().accountEquity,
    });
  };

  // بازیابی وضعیت از فایل JSON
  const handleStateRestored = (imported: AppExportPayloadV1['state']) => {
    setSymbol(imported.symbol);
    replayEngine.setSymbol(imported.symbol);
    replayEngine.reset();
    for (let i = 14; i < imported.currentStepIndex; i++) {
      replayEngine.stepForward();
    }
    const snap = replayEngine.getSnapshot();
    setReplayState(snap);
    setExecutionMessage(`وضعیت با موفقیت از فایل نسخه v1.0 بازیابی شد (نماد ${imported.symbol}).`);
  };

  // ارسال سفارش در مرحله ۵
  const handleConfirmSubmit = async (options?: { simulateTimeout?: boolean; simulateRejection?: boolean }) => {
    if (!replayState.activeCandidate || !riskPreview) return;
    setIsSubmitting(true);
    setExecutionMessage(null);

    const intentId = `INTENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const idempotencyKey = `IDEMP-${intentId}`;

    try {
      const res = await fetch('/api/orders/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId,
          idempotencyKey,
          symbol: replayState.activeCandidate.symbol,
          direction: replayState.activeCandidate.direction,
          volumeLots: riskPreview.adjustedVolumeLots,
          limitPrice: replayState.activeCandidate.entryPrice,
          stopLossPrice: replayState.activeCandidate.stopLossPrice,
          takeProfitPrice: replayState.activeCandidate.takeProfitPrice,
          userConfirmationTimestamp: Date.now(),
          simulateTimeout: options?.simulateTimeout,
          simulateRejection: options?.simulateRejection,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setExecutionMessage(`سفارش لیمیت با موفقیت در بروکر تایید شد. شناسه بروکر: ${data.record.brokerOrderId}`);
      } else if (data.state === 'UNKNOWN_RECONCILE_REQUIRED') {
        setExecutionMessage(
          `هشدار ایمنی: پاسخ مبهم یا تایم‌اوت شبکه دریافت شد. سفارش به حالت UNKNOWN_RECONCILE_REQUIRED رفت و ارسال‌های جدید مسدود شد.`
        );
      } else {
        setExecutionMessage(`خطای ارسال سفارش: ${data.error || 'عملیات با شکست مواجه شد.'}`);
      }

      await fetchOutbox();
      setIsModalOpen(false);
    } catch (err) {
      setExecutionMessage(`خطای غیرمنتظره در ارسال: ${(err as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // بازتطبیق سفارش با سرور بروکر
  const handleReconcileOrder = async (intentId: string) => {
    try {
      const res = await fetch('/api/orders/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId }),
      });
      const data = await res.json();
      if (data.reconciled) {
        setExecutionMessage(data.message);
      } else {
        setExecutionMessage(`خطا در بازتطبیق: ${data.error}`);
      }
      await fetchOutbox();
    } catch (err) {
      setExecutionMessage(`خطا در بازتطبیق: ${(err as Error).message}`);
    }
  };

  const brokerState = broker.getState();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* سربرگ ثابت با نشان دائمی DEMO */}
      <Header
        dataMode="REPLAYED"
        accountMaskedId="DEMO-****5678"
        equity={brokerState.accountEquity}
        balance={brokerState.accountBalance}
        isBlocked={isBlocked}
      />

      <div className="max-w-7xl w-full mx-auto p-4 space-y-4">
        {/* پیام‌های سیستمی و اعلانات امنیتی */}
        {executionMessage && (
          <div className="p-3 bg-zinc-900 border border-cyan-800/80 rounded-xl text-xs flex items-center justify-between gap-2 text-cyan-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{executionMessage}</span>
            </div>
            <button
              onClick={() => setExecutionMessage(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs px-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* نوار کنترل نماد و ریپلی کندل‌ها */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* انتخاب نماد */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium">نماد معاملاتی:</span>
            <button
              onClick={() => handleSymbolChange('XAUUSD')}
              className={`px-3 py-1.5 rounded-lg font-mono font-bold flex items-center gap-1.5 border transition-colors ${
                symbol === 'XAUUSD'
                  ? 'bg-amber-950/80 border-amber-600 text-amber-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>XAUUSD (Gold)</span>
            </button>
            <button
              onClick={() => handleSymbolChange('EURUSD')}
              className={`px-3 py-1.5 rounded-lg font-mono font-bold flex items-center gap-1.5 border transition-colors ${
                symbol === 'EURUSD'
                  ? 'bg-cyan-950/80 border-cyan-600 text-cyan-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>EURUSD (Euro)</span>
            </button>
          </div>

          {/* کنترل‌های ریپلی، نشست تحلیلی و پشتیبان‌گیری */}
          <div className="flex flex-wrap items-center gap-2">
            {/* وضعیت و دکمه کنترل جلسه تحلیلی */}
            <button
              onClick={() => setIsSessionActive(!isSessionActive)}
              className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 font-medium transition-colors ${
                isSessionActive
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
              }`}
              title={isSessionActive ? 'جلسه تحلیلی فعال است' : 'جلسه متوقف است'}
            >
              <Power className={`w-3.5 h-3.5 ${isSessionActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
              <span>{isSessionActive ? 'جلسه فعال' : 'جلسه متوقف'}</span>
              <span className="font-mono text-[10px] text-zinc-400">
                {Math.floor(sessionSeconds / 60)}:{(sessionSeconds % 60).toString().padStart(2, '0')}
              </span>
            </button>

            {/* گام ریپلی */}
            <div className="flex items-center gap-1 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded-lg">
              <span className="text-zinc-500">گام:</span>
              <span className="font-mono text-zinc-200 font-bold">
                {replayState.currentStepIndex + 1}/{replayState.totalSteps}
              </span>
            </div>

            {/* دکمه پخش / مکث خودکار */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 font-bold transition-all border ${
                isPlaying
                  ? 'bg-amber-950 border-amber-700 text-amber-300 animate-pulse'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
              }`}
              title={isPlaying ? 'توقف پخش خودکار' : 'پخش خودکار ریپلی'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'توقف' : 'پخش'}</span>
            </button>

            {/* انتخاب سرعت بازپخش */}
            <div className="flex items-center gap-0.5 bg-zinc-950 border border-zinc-800 p-0.5 rounded-lg">
              {[
                { label: '1x', ms: 1000 },
                { label: '2x', ms: 500 },
                { label: '5x', ms: 200 },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => setSpeedMs(s.ms)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    speedMs === s.ms
                      ? 'bg-zinc-800 text-cyan-300 font-bold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* کندل بعدی */}
            <button
              onClick={handleStepForward}
              disabled={replayState.currentStepIndex >= replayState.totalSteps - 1}
              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-200 rounded-lg flex items-center gap-1 font-medium transition-colors"
              title="پیشروی یک کندل ۵ دقیقه‌ای"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>بعدی</span>
            </button>

            {/* بازنشانی */}
            <button
              onClick={handleResetReplay}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors"
              title="بازنشانی به ابتدا"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* دکمه باز کردن پنجره پشتیبان‌گیری و بازیابی */}
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-zinc-300 hover:text-white rounded-lg flex items-center gap-1.5 font-medium transition-colors"
              title="پشتیبان‌گیری و بازیابی داده‌ها (JSON v1.0)"
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">پشتیبان / بازیابی</span>
            </button>

            {/* دکمه انتخاب و تنظیم هوش مصنوعی آفلاین */}
            <button
              onClick={() => setIsAIModalOpen(true)}
              className="px-2.5 py-1.5 bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 hover:text-white rounded-lg flex items-center gap-1.5 font-medium transition-colors"
              title="انتخاب و تغییر مدل هوش مصنوعی آفلاین"
            >
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">مدل هوش مصنوعی</span>
            </button>
          </div>
        </div>

        {/* چیدمان ستونی دسکتاپ و فولد: نمودار و کارت کنترل ستاپ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ستون چپ: نمودار کندل‌استیک ۵ دقیقه‌ای */}
          <div className="lg:col-span-2">
            <ChartCanvas
              symbol={symbol}
              candles={replayState.visibleCandles}
              activeCandidate={replayState.activeCandidate}
            />
          </div>

          {/* ستون راست: کارت ستاپ کشف‌شده و محاسبه ریسک */}
          <div className="flex flex-col gap-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>ستاپ کشف‌شده استراتژی S0</span>
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-800 text-zinc-400">
                  {replayState.activeCandidate ? 'فعال' : 'در انتظار'}
                </span>
              </div>

              {replayState.activeCandidate ? (
                <div className="space-y-3 text-xs">
                  <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between">
                    <span className="text-zinc-400">جهت معامله:</span>
                    <span
                      className={`font-mono font-bold flex items-center gap-1 ${
                        replayState.activeCandidate.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {replayState.activeCandidate.direction === 'BUY' ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {replayState.activeCandidate.direction}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-zinc-300 font-mono text-[11px]">
                    <div className="p-2 bg-zinc-950 rounded border border-zinc-850">
                      <span className="text-zinc-500 block">ورود لیمیت:</span>
                      <span className="font-bold text-cyan-400">{replayState.activeCandidate.entryPrice}</span>
                    </div>
                    <div className="p-2 bg-zinc-950 rounded border border-zinc-850">
                      <span className="text-zinc-500 block">حد ضرر (SL):</span>
                      <span className="font-bold text-rose-400">{replayState.activeCandidate.stopLossPrice}</span>
                    </div>
                    <div className="p-2 bg-zinc-950 rounded border border-zinc-850">
                      <span className="text-zinc-500 block">حد سود (TP):</span>
                      <span className="font-bold text-emerald-400">{replayState.activeCandidate.takeProfitPrice}</span>
                    </div>
                    <div className="p-2 bg-zinc-950 rounded border border-zinc-850">
                      <span className="text-zinc-500 block">ریسک به ریوارد:</span>
                      <span className="font-bold text-zinc-200">1 به {replayState.activeCandidate.riskRewardRatio}</span>
                    </div>
                  </div>

                  {riskPreview && (
                    <div className="p-2.5 bg-emerald-950/20 border border-emerald-800/40 rounded-lg space-y-1 text-[11px]">
                      <div className="flex justify-between text-zinc-300">
                        <span>حجم مجاز (Capped):</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {riskPreview.adjustedVolumeLots} لات
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-300">
                        <span>ریسک مصوب (حداکثر ۰٫۲۵٪):</span>
                        <span className="font-mono text-zinc-200">
                          ${riskPreview.plannedRiskAmount} ({riskPreview.plannedRiskPercent}٪)
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-400 text-[10px]">
                        <span>کارمزد دوطرفه: ${riskPreview.commissionEstimated}</span>
                        <span>Net R:R: 1 به {riskPreview.netRiskRewardRatio}</span>
                      </div>
                    </div>
                  )}

                  {/* پنل هوش مصنوعی ساختاریافته آفلاین در سایه (Local Offline Shadow AI) */}
                  {shadowAnalysis && (
                    <div className="p-3 bg-zinc-950/90 border border-zinc-800 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                        <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                          <Bot className="w-4 h-4 text-cyan-400" />
                          <span>هوش مصنوعی آفلاین (Shadow AI)</span>
                        </div>
                        <button
                          onClick={() => setIsAIModalOpen(true)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700 text-cyan-300 hover:bg-cyan-900/80 font-mono flex items-center gap-1 transition-colors"
                          title="کلیک کنید تا مدل یا پورت هوش مصنوعی آفلاین را تغییر دهید"
                        >
                          <Sliders className="w-2.5 h-2.5" />
                          <span>{shadowAnalysis.activeProfile.nameFa}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        {/* رای تحلیل‌گر */}
                        <div className="p-2 rounded bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
                          <span className="text-zinc-400 text-[10px]">رأی تحلیل‌گر (Analyst):</span>
                          <span
                            className={`font-bold flex items-center gap-1 mt-1 ${
                              shadowAnalysis.analystReview.decision === 'TRADE'
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            <Cpu className="w-3 h-3" />
                            {shadowAnalysis.analystReview.decision === 'TRADE' ? 'تایید معامله' : 'عدم معامله'}
                            <span className="text-[10px] text-zinc-500">
                              ({(shadowAnalysis.analystReview.confidence * 100).toFixed(0)}٪)
                            </span>
                          </span>
                        </div>

                        {/* رای منتقد */}
                        <div className="p-2 rounded bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
                          <span className="text-zinc-400 text-[10px]">رأی منتقد (Critic):</span>
                          <span
                            className={`font-bold flex items-center gap-1 mt-1 ${
                              shadowAnalysis.criticReview.verdict === 'CONFIRMED'
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            <ShieldCheck className="w-3 h-3" />
                            {shadowAnalysis.criticReview.verdict === 'CONFIRMED' ? 'صحت‌سنجی تایید' : 'مردود'}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                        {shadowAnalysis.explanation}
                      </p>
                    </div>
                  )}

                  {/* دکمه باز کردن مودال ارسال مرحله ۵ */}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={isBlocked || !riskPreview?.isValid}
                    className={`w-full py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-all ${
                      isBlocked
                        ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>بررسی قصد و ارسال به cTrader Demo (مرحله ۵)</span>
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                  هنوز سوییپ نقدینگی معتبر شناسایی نشده است. با زدن «کندل بعدی» ریپلی را به جلو ببرید.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* بخش ژورنال معاملات و ارزیابی استراتژی (مرحله ۶) */}
        <JournalView />

        {/* بخش سفت‌کاری امنیتی سرور، ریت‌لیمیتر و بازیابی اضطراری (مرحله ۸) */}
        <SecurityDRPanel />

        {/* بخش پایین: صندوق تراکنشی مرحله ۵ و پنل آزمون‌های خودکار */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OutboxExecutionCard
            records={outboxRecords}
            isBlocked={isBlocked}
            blockingReason={blockingReason}
            onReconcile={handleReconcileOrder}
            onRefreshOutbox={fetchOutbox}
          />

          <TestRunnerPanel />
        </div>
      </div>

      {/* مودال تأیید نهایی ارسال به cTrader Demo (مرحله ۵) */}
      {replayState.activeCandidate && riskPreview && (
        <OrderIntentModal
          candidate={replayState.activeCandidate}
          riskPreview={riskPreview}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirmSubmit={handleConfirmSubmit}
          isSubmitting={isSubmitting}
          isBlockedByReconciliation={isBlocked}
          blockingReason={blockingReason}
        />
      )}

      {/* نشانگر هوشمند وضعیت آفلاین و مرزهای پردازش در وب (مرحله ۷) */}
      <OfflineIndicator />

      {/* مودال پشتیبان‌گیری و بازیابی داده‌ها (بسته B1 و ذخیره محلی) */}
      <ExportImportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentState={{
          symbol,
          currentStepIndex: replayState.currentStepIndex,
          accountBalance: broker.getState().accountBalance,
          accountEquity: broker.getState().accountEquity,
        }}
        onStateRestored={handleStateRestored}
      />

      {/* مودال انتخاب و تنظیم مدل هوش مصنوعی آفلاین */}
      <OfflineAISelectorModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        activeProfileId={aiProfileId}
        customEndpoint={customEndpoint}
        onSelectProfile={handleSelectAIProfile}
      />
    </main>
  );
}
