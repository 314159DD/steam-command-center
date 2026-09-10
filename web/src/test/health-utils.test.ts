import { describe, it, expect } from 'vitest'
import { redactApiKey, summarizeHealth } from '../lib/health-utils'

describe('redactApiKey', () => {
  it('redacts key= mid-query', () => {
    expect(redactApiKey('?key=abc123&country=DE')).toBe('?key=REDACTED&country=DE');
  });
  it('redacts key= at end of query', () => {
    expect(redactApiKey('https://api.example.com?country=DE&key=secret-xyz')).toBe(
      'https://api.example.com?country=DE&key=REDACTED'
    );
  });
  it('redacts key= as first param followed by end', () => {
    expect(redactApiKey('https://api.example.com?key=secretABC')).toBe(
      'https://api.example.com?key=REDACTED'
    );
  });
  it('passes through plain strings unchanged', () => {
    expect(redactApiKey('plain error message')).toBe('plain error message');
  });
  it('preserves #fragment after key value', () => {
    expect(redactApiKey('https://x?key=abc#frag')).toBe('https://x?key=REDACTED#frag');
  });
});

describe('summarizeHealth', () => {
  it('counts totals and errors', () => {
    const rows = [
      { last_status: 'ok' },
      { last_status: 'error' },
      { last_status: 'ok' },
    ];
    expect(summarizeHealth(rows)).toEqual({ total: 3, errors: 1 });
  });
  it('handles empty array', () => {
    expect(summarizeHealth([])).toEqual({ total: 0, errors: 0 });
  });
});
