/**
 * Platform configuration.
 *
 * All money values in the database and API are INTEGER MINOR UNITS
 * (e.g. cents for USD). 10,000,000 minor units = 100,000.00 in display.
 * The client formats amounts using the currency block below, the same way
 * Pragmatic Play style clients show "CREDIT $100,000.00  BET $2.00".
 */
try { if (typeof process.loadEnvFile === 'function') process.loadEnvFile(); } catch {}

const CURRENCY = {
  code: process.env.SPINKIT_CURRENCY || 'USD', // ISO code used for Intl formatting ('FUN' => coins)
  symbol: process.env.SPINKIT_CURRENCY_SYMBOL || '$',
  decimals: Number(process.env.SPINKIT_CURRENCY_DECIMALS || 2)
};

module.exports = {
  CURRENCY,
  STARTING_BALANCE: 10000000, // 100,000.00
  REFILL_AMOUNT: 10000000, // +100,000.00 per refill (social casino infinite credits)
  // Coin values (minor units). Total bet = coin value x game.bet_multiplier.
  COIN_VALUES: [1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500],
  DEFAULT_COIN_VALUE: 10
};
