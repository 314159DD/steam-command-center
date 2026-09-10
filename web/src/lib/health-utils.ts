export function redactApiKey(detail: string): string {
  return detail.replace(/([?&]key=)[^&#\s]*/g, '$1REDACTED');
}

export interface HealthSummary {
  total: number;
  errors: number;
}

export function summarizeHealth(rows: Array<{ last_status: string }>): HealthSummary {
  return {
    total: rows.length,
    errors: rows.filter(r => r.last_status === 'error').length,
  };
}
