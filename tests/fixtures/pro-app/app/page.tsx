// The professional counter-fixture: a landing page with the properties
// from SECUREVIBE-GRADING.md section 7. Sections are hand-laid and sized
// by importance, every claim links somewhere real, the product appears
// as actual captures, and no section announces its own kind. The grader
// must leave this page close to 100.

export default function Home() {
  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-8 py-4">
        <span className="text-xl font-semibold">Palletbase</span>
        <div className="flex gap-6">
          <a href="/pricing">Pricing</a>
          <a href="/changelog">Changelog</a>
          <a href="/about">About</a>
        </div>
        <a href="/pricing" className="rounded border px-4 py-2">Start a pilot</a>
      </nav>

      <header className="px-8 py-16">
        <h1 className="max-w-2xl text-5xl font-semibold">
          Inventory counts your warehouse can sign off on
        </h1>
        <p className="mt-5 max-w-xl text-lg">
          Palletbase reconciles what your pickers scan against what your ledger
          expects, every fifteen minutes, and files the difference as a task.
        </p>
        <a href="/pricing" className="mt-8 inline-block rounded bg-black px-6 py-3 text-white">
          Start a pilot
        </a>
        <img
          src="/images/dashboard-orders-view.png"
          alt="The orders view, showing a reconciliation run from March 4"
          className="mt-12 w-full rounded border"
        />
      </header>

      <section className="px-8 py-16">
        <h2 className="max-w-xl text-3xl font-semibold">
          Reconciliation runs in the background, not at year end
        </h2>
        <div className="mt-8 flex gap-10">
          <div className="w-2/3">
            <p>
              Every fifteen minutes Palletbase pulls scan events from your
              handhelds and compares them against expected stock. When a count
              drifts, the shelf shows up in the morning queue with the last
              three scans attached, so the picker who walks over already knows
              what to look for.
            </p>
            <img
              src="/images/picking-station.webp"
              alt="A picking station running the morning queue"
              className="mt-6 rounded border"
            />
          </div>
          <div className="w-1/3 border-l pl-6">
            <p className="text-sm">
              Cycle count accuracy at Ferro Logistics moved from 91.4% to 99.2%
              over eleven weeks.{' '}
              <a href="/customers/ferro-logistics" className="underline">
                Read how their team runs it
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 px-8 py-16">
        <div className="flex items-start gap-8">
          <img
            src="/images/maria-alvarez-headshot.jpg"
            alt="Maria Alvarez"
            className="h-20 w-20 rounded-full object-cover"
          />
          <blockquote className="max-w-2xl">
            <p className="text-2xl">
              We stopped arguing about whose count was right. The queue says
              which shelf, the scans say why, and the argument is over before
              the coffee is.
            </p>
            <footer className="mt-4 text-sm">
              Maria Alvarez, operations lead at Ferro Logistics —{' '}
              <a href="https://ferrologistics.example.com/blog/counting" className="underline">
                from their write-up
              </a>
            </footer>
          </blockquote>
        </div>
      </section>

      <section className="px-8 py-16">
        <h2 className="text-3xl font-semibold">What it costs</h2>
        <p className="mt-4 max-w-lg">
          One price: $4 per active picker per month, metered monthly. The pilot
          is free for the first site while you compare counts against your
          current process. <a href="/pricing" className="underline">The details are on the pricing page</a>.
        </p>
        <a href="/pricing" className="mt-6 inline-block rounded border px-5 py-2.5">
          See the rate card
        </a>
      </section>

      <footer className="border-t px-8 py-10">
        <div className="flex gap-10 text-sm">
          <a href="/pricing">Pricing</a>
          <a href="/changelog">Changelog</a>
          <a href="/about">About</a>
        </div>
        <p className="mt-6 text-sm">© 2026 Palletbase</p>
      </footer>
    </div>
  );
}
