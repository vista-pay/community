import { redirect } from 'next/navigation';

/**
 * The wallet is the merchant account.
 *
 * They were two pages describing one balance, which is how Accounting and
 * Wallet came to read as if they disagreed. The merchant screen is now the
 * single surface — balance, collection account, flow charts, history and
 * payouts — and this path stays only so saved links and bookmarks still land
 * somewhere sensible rather than 404ing.
 */
export default function WalletPage() {
  redirect('/merchant');
}
