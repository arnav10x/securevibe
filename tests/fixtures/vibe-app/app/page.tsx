'use client';

const features = [
  { icon: '🚀', title: 'Blazing fast', description: 'Supercharge your workflow in seconds, not hours.' },
  { icon: '🔒', title: 'Secure', description: 'Enterprise-grade security for your data.' },
  { icon: '✨', title: 'AI powered', description: 'Lorem ipsum dolor sit amet, consectetur.' },
];

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'CTO at TechCorp',
    quote: 'TaskFlow AI is a game-changer for our team!',
    avatar: 'https://i.pravatar.cc/150?img=1',
  },
  {
    name: 'Michael Torres',
    role: 'Founder at DevLabs',
    quote: 'It supercharged our productivity overnight.',
    avatar: 'https://i.pravatar.cc/150?img=2',
  },
];

const plans = [
  { name: 'Free', price: '$0' },
  { name: 'Pro', price: '$29', popular: true },
  { name: 'Enterprise', price: 'Custom' },
];

const faqs = [
  { q: 'What is TaskFlow AI?', a: 'The best task manager.' },
  { q: 'Is it free?', a: 'There is a free tier.' },
];

export default function Home() {
  async function handleSubscribe() {
    await new Promise((r) => setTimeout(r, 1500));
    alert('Coming soon!');
  }

  return (
    <main className="bg-gray-950 text-white">
      {/* Hero Section */}
      <section className="relative text-center">
        <div className="absolute -z-10 h-96 w-96 rounded-full bg-purple-500/30 blur-3xl" />
        <span className="rounded-full border border-white/10 px-3 py-1 text-sm">
          ✨ Now in beta
        </span>
        <h1 className="bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-6xl text-transparent">
          Supercharge your workflow
        </h1>
        <p>It&apos;s not just a tool, it&apos;s a revolution. Trusted by 10,000+ developers.</p>
        <div className="flex gap-4">
          <button onClick={handleSubscribe}>Get Started</button>
          <a href="#">Learn More</a>
        </div>
      </section>

      {/* Stats Section */}
      <section>
        <div>99.9% uptime</div>
        <div>24/7 support</div>
        <div>4.9/5 rating</div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-3 gap-8">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl bg-white/10 backdrop-blur border-white/10 p-6 hover:scale-105 transition-all duration-300">
            <span className="text-4xl">{f.icon}</span>
            <h3>{f.title}</h3>
            <p className="text-gray-300 bg-white">{f.description}</p>
          </div>
        ))}
      </section>

      {/* Testimonials Section */}
      <section>
        {testimonials.map((t) => (
          <div key={t.name} onClick={() => alert('Not yet implemented')}>
            <img src={t.avatar} />
            <p>{t.quote}</p>
          </div>
        ))}
      </section>

      {/* Pricing Section */}
      <section>
        {plans.map((p) => (
          <div key={p.name}>
            {p.name} — {p.price}
            <a href="#">Choose plan</a>
          </div>
        ))}
      </section>

      {/* FAQ Section */}
      <section>
        <h2>Frequently Asked Questions</h2>
        {faqs.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      {/* CTA Section */}
      <section>
        <h2>Ready to transform your workflow?</h2>
        <button>Submit</button>
      </section>

      <footer>
        <a href="/blog">Blog</a>
        <a href="/careers">Careers</a>
        <a href="/privacy">Privacy</a>
        <a href="https://twitter.com">Twitter</a>
        <a href="https://github.com">GitHub</a>
      </footer>
    </main>
  );
}
