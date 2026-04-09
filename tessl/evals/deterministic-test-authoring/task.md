# Writing Reliable Themis Tests for a Scheduled Job Service

## Problem/Feature Description

Vantage Systems runs a scheduled job service that processes batch reports. Three modules need test coverage: a `ReportScheduler` that coordinates batch report runs using the current timestamp, a `ReportAggregator` that sums numeric values from a list of records, and a `fetchExternalRate` function that calls an external currency rate API to get the latest USD/EUR exchange rate.

The QA lead has raised concerns in the past about flaky tests — tests that pass sometimes and fail other times because they depend on the clock, produce random IDs, or make real network calls. The team wants Themis tests authored in a way that avoids this problem.

You've been asked to author Themis tests for all three modules and write a brief note explaining how you handled the nondeterminism risks for each.

## Output Specification

Produce the following files:

- `__themis__/tests/report-scheduler.test.ts` — Themis test for the `ReportScheduler` that handles its dependency on the current time.
- `__themis__/tests/report-aggregator.test.ts` — Themis test for the `ReportAggregator` pure aggregation logic.
- `__themis__/tests/fetch-external-rate.test.ts` — Themis test for the `fetchExternalRate` function that handles its network dependency.
- `TESTING_NOTES.md` — A markdown document explaining how you addressed nondeterminism for each module, and what general approach you took for time-dependent and network-dependent functions.

## Input Files

The following files represent the source code to be tested. Extract them before beginning.

=============== FILE: src/report-scheduler.ts ===============
export interface ScheduledRun {
  runId: string;
  scheduledAt: number;
  reportType: string;
}

export class ReportScheduler {
  schedule(reportType: string, clock: () => number = Date.now): ScheduledRun {
    return {
      runId: `run-${clock()}`,
      scheduledAt: clock(),
      reportType,
    };
  }
}

=============== FILE: src/report-aggregator.ts ===============
export interface Record {
  id: string;
  value: number;
}

export function aggregateRecords(records: Record[]): number {
  return records.reduce((sum, r) => sum + r.value, 0);
}

=============== FILE: src/fetch-external-rate.ts ===============
export interface RateResponse {
  base: string;
  target: string;
  rate: number;
}

export async function fetchExternalRate(
  base: string,
  target: string,
  fetcher: (url: string) => Promise<{ rate: number }> = async (url) => {
    const res = await fetch(url);
    return res.json() as Promise<{ rate: number }>;
  }
): Promise<RateResponse> {
  const data = await fetcher(`https://api.example.com/rates/${base}/${target}`);
  return { base, target, rate: data.rate };
}
