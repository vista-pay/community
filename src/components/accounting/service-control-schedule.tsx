import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge, Card, CardHeader } from '@/components/ui';
import { ACCOUNT_TYPE_LABELS } from '@/data/catalog';
import { money } from '@/lib/format';
import { isZeroMoney } from '@/lib/money';
import type { Statements } from '@/types';

export function ServiceControlSchedule({ data }: { data: Statements }) {
  return (
    <section className="mt-6">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-navy-900">Service control account schedule</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Ledger accounts and closing balances supporting each community service.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {data.modules.map((module) => {
          const accounts = data.rows.filter((row) => module.accountCodes.includes(row.code));
          const hasMovement = accounts.some(
            (row) => !isZeroMoney(row.debit) || !isZeroMoney(row.credit),
          );

          return (
            <Card key={module.key} className="overflow-hidden">
              <CardHeader
                title={module.label}
                subtitle={
                  accounts.length
                    ? `${accounts.length} mapped control account${accounts.length === 1 ? '' : 's'}`
                    : 'No control account is mapped yet'
                }
                action={
                  <Badge tone={hasMovement ? 'green' : 'slate'}>
                    {hasMovement ? (
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <AlertCircle className="mr-1 h-3.5 w-3.5" />
                    )}
                    {hasMovement ? 'Posted' : 'No postings'}
                  </Badge>
                }
              />

              {accounts.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                    <thead className="border-y border-slate-100 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Account</th>
                        <th className="px-3 py-2.5 font-medium">Type</th>
                        <th className="px-3 py-2.5 text-right font-medium">Debit</th>
                        <th className="px-3 py-2.5 text-right font-medium">Credit</th>
                        <th className="px-4 py-2.5 text-right font-medium">Closing balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {accounts.map((account) => (
                        <tr key={account.id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-navy-900">{account.code}</p>
                            <p className="mt-0.5 text-slate-500">{account.name}</p>
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {ACCOUNT_TYPE_LABELS[account.type]}
                          </td>
                          <td className="tnum px-3 py-3 text-right text-slate-700">
                            {money(account.debit)}
                          </td>
                          <td className="tnum px-3 py-3 text-right text-slate-700">
                            {money(account.credit)}
                          </td>
                          <td className="tnum px-4 py-3 text-right font-semibold text-navy-900">
                            {money(account.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-navy-900">
                      <tr>
                        <td className="px-4 py-3" colSpan={2}>
                          Service totals
                        </td>
                        <td className="tnum px-3 py-3 text-right">{money(module.debit)}</td>
                        <td className="tnum px-3 py-3 text-right">{money(module.credit)}</td>
                        <td className="tnum px-4 py-3 text-right">{money(module.balance)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="px-5 py-6 text-sm text-slate-500">
                  This service currently has operational records only. Create or map its ledger
                  accounts before it can appear in the trial-balance schedule.
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
