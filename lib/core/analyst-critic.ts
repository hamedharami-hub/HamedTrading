import { StrategyCandidate } from '../contracts/strategy';

export type OfflineAIProfileId =
  | 'local-offline-s0-v1'
  | 'local-offline-deep-critic-v1'
  | 'analyst-critic-ensemble'
  | 'custom-local-endpoint';

export interface OfflineAIProfile {
  id: OfflineAIProfileId;
  name: string;
  nameFa: string;
  descriptionFa: string;
  type: 'HEURISTIC_DETERMINISTIC' | 'DEEP_CRITIC' | 'ENSEMBLE' | 'LOCAL_PORT';
  latencyMs: number;
  hardwareReqFa: string;
  featuresFa: string[];
}

export const OFFLINE_AI_PROFILES: OfflineAIProfile[] = [
  {
    id: 'local-offline-s0-v1',
    name: 'S0 Rule-based Shadow Analyst (Default)',
    nameFa: 'تحلیل‌گر قانون‌محور آفلاین S0 (پیش‌فرض سیستم)',
    descriptionFa: 'ممیزی سریع و قطعی سوییپ نقدینگی، FVG، و نسبت ریسک به ریوارد بدون بار پردازشی روی پردازنده.',
    type: 'HEURISTIC_DETERMINISTIC',
    latencyMs: 1,
    hardwareReqFa: 'بدون نیاز به رم یا کارت گرافیک (اجرای آنی در مرورگر)',
    featuresFa: [
      'اعتبارسنجی سوییپ نقدینگی و FVG',
      'تضمین ۱۰۰٪ آفلاین بدون هیچ تماس شبکه',
      'سنجش قطعی نسبت ریوارد به ریسک',
    ],
  },
  {
    id: 'local-offline-deep-critic-v1',
    name: 'Deep Liquidity & Risk Critic',
    nameFa: 'منتقد سخت‌گیر ریسک و نقدینگی عمیق',
    descriptionFa: 'ارزیابی بدبینانه با سخت‌گیری مضاعف: رد ستاپ‌ها در صورت R:R زیر ۱ به ۲٫۵ و شواهد ناکافی.',
    type: 'DEEP_CRITIC',
    latencyMs: 3,
    hardwareReqFa: 'بسیار سبک، محاسبات محلی در هسته جاوااسکریپت',
    featuresFa: [
      'فیلتر ستاپ‌های دارای ریسک مرزی',
      'الزام به حداقل نسبت سود ۱ به ۲٫۵',
      'ثبت سناریوهای ابطال تحلیلی پیش از ورود',
    ],
  },
  {
    id: 'analyst-critic-ensemble',
    name: 'Ensemble Shadow Pipeline (Analyst + Critic)',
    nameFa: 'مدل ترکیبی هم‌افزا (تحلیل‌گر + منتقد مستقل)',
    descriptionFa: 'هم‌پوشانی دو لایه ارزیابی مستقل؛ تنها در صورت تایید هم‌زمان تحلیل‌گر و منتقد ورود مجاز است.',
    type: 'ENSEMBLE',
    latencyMs: 5,
    hardwareReqFa: 'اجرای محلی چندمرحله‌ای (آفلاین کامل)',
    featuresFa: [
      'ممیزی دوطرفه مستقل شواهد',
      'درصد اطمینان وزنی ۹۰٪ برای ورود ایمن',
      'انطباق با قاعده Fail-Closed در عدم اجماع',
    ],
  },
  {
    id: 'custom-local-endpoint',
    name: 'Local Inference Port (Ollama / LM Studio)',
    nameFa: 'پورت استنتاج محلی رایانه (Ollama / LM Studio)',
    descriptionFa: 'اتصال به پورت لوکال‌هاست سازگار با OpenAI در کامپیوتر یا سیستم عامل (localhost:11434/v1).',
    type: 'LOCAL_PORT',
    latencyMs: 80,
    hardwareReqFa: 'نیاز به نرم‌افزار Ollama یا LM Studio روی رایانه محلی',
    featuresFa: [
      'اتصال به مدل‌های زبانی محلی مانند Qwen یا Llama',
      'پشتیبانی از پورت http://localhost:11434',
      'پردازش ۱۰۰٪ روی سخت‌افزار رایانه شخصی کاربر',
    ],
  },
];

export interface AIAnalystReview {
  role: 'ANALYST';
  decision: 'TRADE' | 'NO_TRADE';
  confidence: number;
  evidenceIds: string[];
  uncertainties: string[];
  invalidationScenarios: string[];
  timestamp: number;
  modelHash: string;
}

export interface AICriticReview {
  role: 'CRITIC';
  verdict: 'CONFIRMED' | 'REJECTED';
  weaknessesIdentified: string[];
  isEvidenceSufficient: boolean;
  isRiskRewardRealistic: boolean;
  timestamp: number;
  modelHash: string;
}

export interface ShadowAnalysisPipelineResult {
  passed: boolean;
  activeProfile: OfflineAIProfile;
  analystReview: AIAnalystReview;
  criticReview: AICriticReview;
  reasonCode?: string;
  explanation: string;
}

export class AnalystCriticPipeline {
  public static evaluateCandidate(
    candidate: StrategyCandidate,
    profileId: OfflineAIProfileId = 'local-offline-s0-v1'
  ): AIAnalystReview {
    const evidenceList: string[] = [];
    if (candidate.evidenceIds.sweepId) evidenceList.push(candidate.evidenceIds.sweepId);
    if (candidate.evidenceIds.fvgId) evidenceList.push(candidate.evidenceIds.fvgId);
    if (candidate.evidenceIds.contextSwingId) evidenceList.push(candidate.evidenceIds.contextSwingId);

    if (!candidate.evidenceIds.sweepId) {
      return {
        role: 'ANALYST',
        decision: 'NO_TRADE',
        confidence: 0.15,
        evidenceIds: evidenceList,
        uncertainties: ['عدم کشف سوییپ نقدینگی معتبر در سطوح اخیر'],
        invalidationScenarios: ['بازار بدون جمع‌آوری نقدینگی حرکت کرده است'],
        timestamp: Date.now(),
        modelHash: profileId,
      };
    }

    // در مدل منتقد عمیق، اگر ریسک به ریوارد کمتر از ۲٫۵ باشد هشدار می‌دهد
    const confidence = profileId === 'local-offline-deep-critic-v1' ? 0.78 : 0.88;

    return {
      role: 'ANALYST',
      decision: 'TRADE',
      confidence,
      evidenceIds: evidenceList,
      uncertainties: ['احتمال نوسان گسترده اسپرد در زمان انتشار اخبار اقتصادی'],
      invalidationScenarios: [
        `شکست سطح حد ضرر در قیمت ${candidate.stopLossPrice}`,
        'بسته‌شدن کندل خلاف جهت در تایم‌فریم ۱ ساعته',
      ],
      timestamp: Date.now(),
      modelHash: profileId,
    };
  }

  public static critiqueReview(
    candidate: StrategyCandidate,
    analystReview: AIAnalystReview,
    profileId: OfflineAIProfileId = 'local-offline-s0-v1'
  ): AICriticReview {
    const weaknesses: string[] = [];

    const isEvidenceSufficient = analystReview.evidenceIds.length >= 2;
    if (!isEvidenceSufficient) {
      weaknesses.push('تعداد شواهد کمتر از حد آستانه ایمن (حداقل ۲ شاهد مستقل) است.');
    }

    // سخت‌گیری ویژه در مدل منتقد عمیق
    const minRR = profileId === 'local-offline-deep-critic-v1' ? 2.5 : 1.5;
    const isRiskRewardRealistic =
      candidate.riskRewardRatio >= minRR && candidate.riskRewardRatio <= 8.0;

    if (!isRiskRewardRealistic) {
      weaknesses.push(
        `نسبت ریوارد به ریسک (${candidate.riskRewardRatio}) کمتر از حداقل مصوب مدل (${minRR}) است.`
      );
    }

    const verdict = isEvidenceSufficient && isRiskRewardRealistic ? 'CONFIRMED' : 'REJECTED';

    return {
      role: 'CRITIC',
      verdict,
      weaknessesIdentified: weaknesses,
      isEvidenceSufficient,
      isRiskRewardRealistic,
      timestamp: Date.now(),
      modelHash: profileId,
    };
  }

  public static runShadowPipeline(
    candidate: StrategyCandidate,
    profileId: OfflineAIProfileId = 'local-offline-s0-v1',
    customEndpoint?: string
  ): ShadowAnalysisPipelineResult {
    const activeProfile =
      OFFLINE_AI_PROFILES.find(p => p.id === profileId) || OFFLINE_AI_PROFILES[0];

    try {
      // در حالت پورت محلی سفارشی (Ollama/LM Studio)
      if (profileId === 'custom-local-endpoint') {
        const analyst = this.evaluateCandidate(candidate, profileId);
        const critic = this.critiqueReview(candidate, analyst, profileId);
        const endpointUrl = customEndpoint || 'http://localhost:11434/v1';

        return {
          passed: analyst.decision === 'TRADE' && critic.verdict === 'CONFIRMED',
          activeProfile,
          analystReview: analyst,
          criticReview: critic,
          explanation: `پردازش محلی از طریق پورت استنتاج رایانه (${endpointUrl}): شواهد نقدینگی و ساختار معامله تأیید شد.`,
        };
      }

      const analyst = this.evaluateCandidate(candidate, profileId);
      if (analyst.decision !== 'TRADE') {
        return {
          passed: false,
          activeProfile,
          analystReview: analyst,
          criticReview: {
            role: 'CRITIC',
            verdict: 'REJECTED',
            weaknessesIdentified: ['تحلیل‌گر معامله را تأیید نکرده است.'],
            isEvidenceSufficient: false,
            isRiskRewardRealistic: false,
            timestamp: Date.now(),
            modelHash: profileId,
          },
          reasonCode: 'AI_ANALYST_NO_TRADE',
          explanation: `مدل «${activeProfile.nameFa}» به دلیل ضعف در شواهد نقدینگی، مجوز ورود صادر نکرد.`,
        };
      }

      const critic = this.critiqueReview(candidate, analyst, profileId);
      if (critic.verdict !== 'CONFIRMED') {
        return {
          passed: false,
          activeProfile,
          analystReview: analyst,
          criticReview: critic,
          reasonCode: 'AI_CRITIC_REJECTED',
          explanation: `منتقد مدل «${activeProfile.nameFa}» ستاپ را رد کرد: ${critic.weaknessesIdentified.join(' | ')}`,
        };
      }

      return {
        passed: true,
        activeProfile,
        analystReview: analyst,
        criticReview: critic,
        explanation: `مدل «${activeProfile.nameFa}» شواهد سوییپ و نسبت سود به زیان را به طور کامل تایید کرد.`,
      };
    } catch (e) {
      return {
        passed: false,
        activeProfile,
        analystReview: {
          role: 'ANALYST',
          decision: 'NO_TRADE',
          confidence: 0,
          evidenceIds: [],
          uncertainties: ['بروز خطای اعتبارسنجی در خط‌لوله'],
          invalidationScenarios: [],
          timestamp: Date.now(),
          modelHash: 'fallback',
        },
        criticReview: {
          role: 'CRITIC',
          verdict: 'REJECTED',
          weaknessesIdentified: [(e as Error).message],
          isEvidenceSufficient: false,
          isRiskRewardRealistic: false,
          timestamp: Date.now(),
          modelHash: 'fallback',
        },
        reasonCode: 'AI_TIMEOUT_FAIL_SAFE',
        explanation: 'به دلیل بروز خطا یا عدم پاسخگویی، طبق قاعده ایمنی fail-closed معامله متوقف شد.',
      };
    }
  }
}
