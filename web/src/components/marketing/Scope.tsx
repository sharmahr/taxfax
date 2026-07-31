const NOT_INCLUDED = [
  'Time tracking',
  'Billing and invoicing',
  'E-signature and 8879 routing',
  'Workflow templates',
  'Job scheduling',
  'CRM and pipelines',
  'Client scoring',
  'A general document vault',
  'Built-in chat',
  'An app to install',
];

export function Scope() {
  return (
    <section id="scope" className="border-t border-line bg-ink text-paper">
      <div className="mx-auto w-full max-w-[76rem] px-5 sm:px-8">
        <div className="grid gap-y-6 py-16 md:grid-cols-[7.5rem_minmax(0,1fr)] md:gap-x-10 md:py-24 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-16">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="mk-eyebrow text-paper/65">Scope</p>
          </div>

          <div className="min-w-0">
            <h2 className="display mk-hang max-w-[20ch] text-pretty text-[clamp(1.75rem,4.2vw,2.6rem)]">
              We are not your practice management system.
            </h2>
            <p className="mt-5 max-w-[60ch] text-pretty text-[0.9375rem] leading-[1.68] text-paper/80">
              You already have one, it does a dozen things, and it is probably fine at most of them.
              It is not the reason your February is on fire. Your February is on fire because four
              hundred people have not sent you a 1099, and no amount of workflow template will make
              them.
            </p>

            <div className="mt-10 grid gap-x-14 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
              <div>
                <p className="mk-eyebrow text-paper/65">Not in TaxFax, and not planned</p>
                <ul className="mt-3 grid gap-y-0 border-t border-paper/15 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5 sm:gap-x-10">
                  {NOT_INCLUDED.map((item) => (
                    <li
                      key={item}
                      className="border-b border-paper/15 py-2 text-[0.8125rem] leading-[1.5] text-paper/75"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="mk-eyebrow text-paper/65">In TaxFax</p>
                <p className="mt-3 max-w-[42ch] text-pretty border-t border-paper/15 pt-3 text-[0.9375rem] leading-[1.68] text-paper/85">
                  One job. Get every document out of four hundred people and onto the
                  preparer&rsquo;s desk before the preparer reaches for it. Nothing here asks you
                  to move off the system you already pay for.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
