import type { Quote } from './domain.ts';

// USD only. Bitstamp replaces the previous USDT ticker; policy is pinned per rules version.
export async function fetchQuotes(): Promise<Quote[]> {
  const sources: [string, string, (data: any) => number][] = [
    ['Coinbase', 'https://api.coinbase.com/v2/prices/BTC-USD/spot', d => Number(d.data.amount)],
    ['Kraken', 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD', d => Number((d.result.XXBTZUSD || d.result.XBTUSD).c[0])],
    ['Bitstamp', 'https://www.bitstamp.net/api/v2/ticker/btcusd/', d => Number(d.last)],
  ];
  const result = await Promise.allSettled(sources.map(async ([exchange, url, parse]) => {
    const start = Date.now();
    const response = await fetch(url, { signal: AbortSignal.timeout(2500), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`${exchange} unavailable`);
    const price = parse(await response.json());
    if (!Number.isFinite(price) || price <= 0) throw new Error(`${exchange} invalid price`);
    return { exchange, pair: 'BTC/USD' as const, priceCents: Math.round(price * 100), observedAt: Date.now(), latencyMs: Date.now() - start };
  }));
  return result.flatMap(r => r.status === 'fulfilled' ? [r.value] : []);
}
