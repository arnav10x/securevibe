// The canonical vibe-coded landing page: every structural signal from
// SECUREVIBE-GRADING.md present at once, in the template script's exact
// order. The grader must tear this apart; the tests pin that it does.

const stats = [
  { value: '10,000+', label: 'Happy users' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9', label: 'Average rating' },
  { value: '24/7', label: 'Support' },
];

const logos = ['Vercafe', 'Loomly', 'Cash Ape', 'Zapster', 'Notionly', 'Slacker'];

const features = [
  { icon: '⚡', title: 'Lightning fast', description: 'Blazing speed for your whole team every day.' },
  { icon: '💰', title: 'Save money', description: 'Cut costs with our smart automation engine now.' },
  { icon: '🎨', title: 'Beautiful design', description: 'Pixel perfect components out of the box today.' },
  { icon: '📱', title: 'Mobile ready', description: 'Looks great on any device you can imagine here.' },
  { icon: '🔒', title: 'Bank-grade security', description: 'Your data is encrypted at rest and transit.' },
  { icon: '🚀', title: 'Scale infinitely', description: 'Grows with you from one to one million users.' },
];

const steps = [
  { number: '01', title: 'Sign up', description: 'Create your account in seconds.' },
  { number: '02', title: 'Connect', description: 'Link your tools with one click.' },
  { number: '03', title: 'Grow', description: 'Watch your metrics climb.' },
];

const plans = [
  { name: 'Starter', price: '$0', popular: false, cta: 'Get Started' },
  { name: 'Pro', price: '$29', popular: true, cta: 'Get Started' },
  { name: 'Enterprise', price: '$99', popular: false, cta: 'Get Started' },
];

const testimonials = [
  { quote: 'This tool changed our workflow completely. We ship twice as fast now.', name: 'Sarah Chen', role: 'CEO, Acmely', initials: 'SC', rating: 5 },
  { quote: 'The best investment we made this year. Support is incredibly responsive.', name: 'Mike Torres', role: 'CTO, Buildify', initials: 'MT', rating: 5 },
  { quote: 'I recommend it to every founder I meet. Setup took five minutes.', name: 'Ana Novak', role: 'Founder, Shiply', initials: 'AN', rating: 5 },
];

const faqs = [
  { q: 'How does the free trial work?', a: 'You get 14 days free. No credit card required.' },
  { q: 'Can I cancel anytime?', a: 'Yes, cancel with one click from your dashboard.' },
  { q: 'Is my data secure?', a: 'We use bank-grade encryption everywhere.' },
  { q: 'Do you offer discounts?', a: 'Yes, annual plans save 20 percent.' },
  { q: 'How do I get support?', a: 'Email us any time. We reply within a day.' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-8 py-4">
        <span className="text-xl font-bold">GrowthKit</span>
        <div className="flex gap-6">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <a href="#pricing" className="rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-white">
          Get Started
        </a>
      </nav>

      <header className="px-8 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-purple-600">
          The all-in-one growth platform
        </p>
        <h1 className="mt-4 text-6xl font-bold">Grow your business on autopilot</h1>
        <p className="mx-auto mt-6 max-w-xl text-gray-600">
          GrowthKit helps small teams grow their business on autopilot with smart
          automation and beautiful analytics.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <button className="rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-3 text-white">
            Get Started
          </button>
          <button className="rounded-2xl border px-6 py-3">Learn More</button>
        </div>
        <div className="mx-auto mt-14 max-w-3xl rounded-2xl border shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b p-4">
            <span className="font-semibold">Dashboard</span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">Active</span>
          </div>
          <div className="grid grid-cols-3 gap-4 p-6">
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-2xl font-bold">+$2,400.00</p>
              <p className="text-sm text-green-600">Invoice Paid</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Visitors</p>
              <p className="text-2xl font-bold">12,847</p>
              <p className="text-sm text-gray-400">Just now</p>
            </div>
            <div className="rounded-xl border p-4">
              <p className="text-sm text-gray-500">Conversion</p>
              <p className="text-2xl font-bold">+18.2%</p>
              <p className="text-sm text-green-600">Live</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-8 px-8 py-12 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-4xl font-bold">{s.value}</p>
            <p className="text-gray-500">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="px-8 py-12 text-center">
        <p className="text-sm uppercase tracking-wide text-gray-400">Trusted by</p>
        <div className="mt-6 flex justify-center gap-10">
          {logos.map((logo) => (
            <span key={logo} className="text-xl font-semibold text-gray-400">
              {logo}
            </span>
          ))}
        </div>
      </section>

      <section id="features" className="px-8 py-20">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-purple-600">
          Features
        </p>
        <h2 className="mt-3 text-center text-4xl font-bold">
          Everything you need. Nothing you don&apos;t.
        </h2>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border p-6">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-gray-600">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 px-8 py-20">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-purple-600">
          Process
        </p>
        <h2 className="mt-3 text-center text-4xl font-bold">How it works</h2>
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.number} className="text-center">
              <p className="text-5xl font-bold text-purple-200">{s.number}</p>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-gray-600">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="px-8 py-20">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-purple-600">
          Pricing
        </p>
        <h2 className="mt-3 text-center text-4xl font-bold">Simple, transparent pricing</h2>
        <p className="mt-3 text-center text-gray-500">No credit card required. 14-day free trial.</p>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {plans.map((p) => (
            <div key={p.name} className={`rounded-2xl border p-8 ${p.popular ? 'border-purple-500' : ''}`}>
              {p.popular && (
                <span className="rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-1 text-xs text-white">
                  Most Popular
                </span>
              )}
              <h3 className="mt-3 text-xl font-semibold">{p.name}</h3>
              <p className="mt-2 text-4xl font-bold">{p.price}<span className="text-base">/mo</span></p>
              <button className="mt-6 w-full rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 py-3 text-white">
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 px-8 py-20">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-purple-600">
          Testimonials
        </p>
        <h2 className="mt-3 text-center text-4xl font-bold">Loved by teams everywhere</h2>
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="rounded-2xl border bg-white p-6">
              <p className="text-yellow-400">★★★★★</p>
              <p className="mt-3 text-gray-700">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 font-semibold text-purple-700">
                  {t.initials}
                </span>
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-2xl px-8 py-20">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-purple-600">
          FAQ
        </p>
        <h2 className="mt-3 text-center text-4xl font-bold">Frequently Asked Questions</h2>
        <div className="mt-10">
          {faqs.map((f) => (
            <details key={f.q} className="border-b py-4">
              <summary className="font-semibold">{f.q}</summary>
              <p className="mt-2 text-gray-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="px-8 py-20 text-center">
        <h2 className="text-4xl font-bold">Ready to grow your business?</h2>
        <p className="mx-auto mt-4 max-w-xl text-gray-600">
          Join thousands of teams who grow their business on autopilot with smart
          automation and beautiful analytics.
        </p>
        <button className="mt-8 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-8 py-4 text-white">
          Get Started
        </button>
      </section>

      <footer className="border-t px-8 py-12">
        <div className="grid grid-cols-4 gap-8">
          <div>
            <p className="font-bold">GrowthKit</p>
            <p className="mt-2 text-sm text-gray-500">
              Grow your business on autopilot with smart automation and beautiful analytics.
            </p>
          </div>
          <div>
            <p className="font-semibold">Product</p>
            <a className="mt-2 block text-sm text-gray-500" href="/changelog">Changelog</a>
            <a className="block text-sm text-gray-500" href="/integrations">Integrations</a>
            <a className="block text-sm text-gray-500" href="/docs">Documentation</a>
          </div>
          <div>
            <p className="font-semibold">Company</p>
            <a className="mt-2 block text-sm text-gray-500" href="/about">About</a>
            <a className="block text-sm text-gray-500" href="/blog">Blog</a>
            <a className="block text-sm text-gray-500" href="/careers">Careers</a>
          </div>
          <div>
            <p className="font-semibold">Social</p>
            <a className="mt-2 block text-sm text-gray-500" href="#">Twitter</a>
            <a className="block text-sm text-gray-500" href="#">LinkedIn</a>
            <a className="block text-sm text-gray-500" href="#">GitHub</a>
          </div>
        </div>
        <p className="mt-10 text-sm text-gray-400">© 2024 GrowthKit. All rights reserved.</p>
      </footer>
    </div>
  );
}
