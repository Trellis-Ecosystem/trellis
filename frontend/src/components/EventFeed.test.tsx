import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventFeed } from './EventFeed';
import { EVENT_TYPE_MAP } from '../hooks/useAgreementEvents';
import type { AgreementEvent, AgreementEventType } from '../hooks/useAgreementEvents';

const SYMBOLS = [
  'trls_crte',
  'trls_lckd',
  'trls_sbmt',
  'trls_rlsd',
  'trls_dspt',
  'trls_rslv',
  'trls_cncl',
  'trls_prtl',
  'trls_cmpl',
  'trls_ttle',
  'trls_ddln',
  'trls_expd',
];

function makeEvent(symbol: string, index: number): AgreementEvent {
  const type = EVENT_TYPE_MAP[symbol] as AgreementEventType;
  return {
    id: `event-${index}`,
    type,
    agreementId: '1',
    ledger: index + 1,
    timestamp: '2024-01-01T00:00:00Z',
    txHash: `tx-${index}`,
    raw: null,
  };
}

describe('EVENT_TYPE_MAP', () => {
  it('maps every trls_* symbol to a known event type', () => {
    for (const symbol of SYMBOLS) {
      expect(EVENT_TYPE_MAP[symbol]).toBeDefined();
      expect(EVENT_TYPE_MAP[symbol]).not.toBe('unknown');
    }
  });
});

describe('EventFeed', () => {
  it('renders a real description for every trls_* event', () => {
    const events = SYMBOLS.map(makeEvent);
    render(<EventFeed events={events} />);

    expect(screen.queryByText('Event: unknown')).toBeNull();
    for (const event of events) {
      expect(screen.queryByText('Event: unknown')).toBeNull();
      expect(event.type).not.toBe('unknown');
    }
  });
});
