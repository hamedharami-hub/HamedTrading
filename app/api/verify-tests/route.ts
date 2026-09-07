import { NextResponse } from 'next/server';
import { runAllCoreTests } from '@/lib/core/__tests__/core.test';
import { runAllCTraderSecurityTests } from '@/lib/server/__tests__/ctrader-security.test';
import { runStage4ShadowTests } from '@/lib/core/__tests__/shadow-stage4.test';
import { runStage5ExecutionTests } from '@/lib/server/__tests__/stage5-execution.test';
import { runStage6JournalTests } from '@/lib/server/__tests__/stage6-journal.test';
import { runStage7PwaTests } from '@/lib/server/__tests__/stage7-pwa.test';
import { runStage8SecurityDRTests } from '@/lib/server/__tests__/stage8-security-dr.test';
import { runStage9Tests } from '@/lib/server/__tests__/stage9-health-smoke.test';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const coreResults = runAllCoreTests();
    const ctraderResults = runAllCTraderSecurityTests();
    const stage4Results = runStage4ShadowTests();
    const stage5Results = await runStage5ExecutionTests();
    const stage6Results = await runStage6JournalTests();
    const stage7Results = await runStage7PwaTests();
    const stage8Results = await runStage8SecurityDRTests();
    const stage9Results = await runStage9Tests();

    const combined = [
      ...coreResults,
      ...ctraderResults,
      ...stage4Results,
      ...stage5Results,
      ...stage6Results,
      ...stage7Results,
      ...stage8Results,
      ...stage9Results,
    ];
    const allPassed = combined.every(t => t.passed);

    return NextResponse.json(
      {
        status: allPassed ? 'SUCCESS' : 'FAILURE',
        timestamp: Date.now(),
        totalTests: combined.length,
        passedTests: combined.filter(t => t.passed).length,
        suite: 'Hamed Trading Lab Comprehensive Verification Suite (Stages 1-9 Release Candidate)',
        results: combined,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'FAILURE',
        timestamp: Date.now(),
        totalTests: 0,
        passedTests: 0,
        suite: 'Hamed Trading Lab Comprehensive Verification Suite',
        results: [],
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
