import { Card, CardHeader } from '@/components/ui';
import { money } from '@/lib/format';
import type { Statements } from '@/types';

export function ModuleAccounting({
  modules,
  title = 'Service performance and accounting',
}: {
  modules: Statements['modules'];
  title?: string;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Operational exposure and financial movement for each service the community provides.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {modules.map((module) => (
          <Card key={module.key} className="overflow-hidden">
            <CardHeader
              title={module.label}
              subtitle={
                module.accountCodes.length
                  ? `Accounts ${module.accountCodes.join(', ')}`
                  : 'Operational activity'
              }
            />
            <dl className="divide-y divide-slate-100 px-4 pb-4">
              {module.operational.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="text-xs text-slate-500">{metric.label}</dt>
                  <dd className="tnum text-sm font-semibold text-navy-900">
                    {metric.kind === 'money' ? money(metric.value) : metric.value}
                  </dd>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 py-2.5 text-xs">
                <div>
                  <dt className="text-slate-400">Debit movement</dt>
                  <dd className="tnum mt-1 font-medium text-slate-700">{money(module.debit)}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-slate-400">Credit movement</dt>
                  <dd className="tnum mt-1 font-medium text-slate-700">{money(module.credit)}</dd>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2.5">
                <dt className="text-xs font-medium text-slate-600">Control balance</dt>
                <dd className="tnum text-sm font-bold text-navy-900">{money(module.balance)}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
    </section>
  );
}
