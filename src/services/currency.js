const { CURRENCY } = require('../config');

const cache = new Map();

const TWO_LETTER_MAP = {
  EU: { symbol: '€', decimals: 2 },
  US: { symbol: '$', decimals: 2 },
  UK: { symbol: '£', decimals: 2 },
  GB: { symbol: '£', decimals: 2 },
  RU: { symbol: '₽', decimals: 2 },
  JP: { symbol: '¥', decimals: 0 },
  CN: { symbol: '¥', decimals: 2 },
  KR: { symbol: '₩', decimals: 0 },
  IN: { symbol: '₹', decimals: 2 },
  TR: { symbol: '₺', decimals: 2 },
  BR: { symbol: 'R$', decimals: 2 },
  UA: { symbol: '₴', decimals: 2 },
  PL: { symbol: 'zł', decimals: 2 },
  KZ: { symbol: '₸', decimals: 2 },
  CA: { symbol: 'CA$', decimals: 2 },
  AU: { symbol: 'A$', decimals: 2 },
  CH: { symbol: 'CHF ', decimals: 2 },
  SE: { symbol: 'kr ', decimals: 2 },
  NO: { symbol: 'kr ', decimals: 2 },
  DK: { symbol: 'kr ', decimals: 2 },
  GC: { symbol: 'GC ', decimals: 0 },
  SC: { symbol: 'SC ', decimals: 2 },
  CR: { symbol: 'CR ', decimals: 0 },
  XP: { symbol: 'XP ', decimals: 0 },
  PT: { symbol: 'PTS ', decimals: 0 }
};

/** { code, symbol, decimals } for a currency code. Supports 2-character codes (e.g. EU, US, RU), standard ISO, and custom codes. */
function currencyInfo(code) {
  const c = String(code || CURRENCY.code).trim().toUpperCase();
  if (cache.has(c)) return cache.get(c);
  let info;
  if (c === CURRENCY.code && CURRENCY.symbol) {
    info = { ...CURRENCY };
  } else if (TWO_LETTER_MAP[c]) {
    info = { code: c, ...TWO_LETTER_MAP[c] };
  } else {
    try {
      const nf = new Intl.NumberFormat('en', { style: 'currency', currency: c });
      const symbol = nf.formatToParts(0).find((p) => p.type === 'currency').value;
      info = { code: c, symbol, decimals: nf.resolvedOptions().maximumFractionDigits };
    } catch {
      info = { code: c, symbol: c + ' ', decimals: 2 };
    }
  }
  cache.set(c, info);
  return info;
}

function format(minor, code) {
  const i = currencyInfo(code);
  return `${i.symbol}${(minor / Math.pow(10, i.decimals)).toLocaleString('en', { minimumFractionDigits: i.decimals, maximumFractionDigits: i.decimals })}`;
}

module.exports = { currencyInfo, format };
