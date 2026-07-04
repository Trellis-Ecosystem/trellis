import { ScrollReveal } from './ScrollReveal'

const steps = [
  {
    number: '01',
    icon: '🔒',
    title: 'Lock',
    description:
      'The payer locks USDC into the Soroban escrow contract for each milestone. Funds are held on-chain — not by any platform or middleman.',
    color: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-500/30',
    glow: 'shadow-cyan-500/10',
  },
  {
    number: '02',
    icon: '⚡',
    title: 'Build',
    description:
      'The payee completes the work and submits proof — an IPFS hash, GitHub PR, or any verifiable URI. The milestone moves to WorkSubmitted state on-chain.',
    color: 'from-blue-500/20 to-blue-500/5',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/10',
  },
  {
    number: '03',
    icon: '✅',
    title: 'Release',
    description:
      'The payer approves and funds release instantly to the payee. If there is a dispute, a neutral resolver steps in. Every action is recorded on-chain.',
    color: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/10',
  },
]

export function HowItWorks() {
  return (
    <section className="relative z-10 px-6 pb-32">
      {/* Section header */}
      <ScrollReveal>
        <div className="text-center mb-16">
          <p className="text-cyan-400 text-sm font-semibold uppercase tracking-widest mb-3">
            Simple by design
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            How It Works
          </h2>
          <p className="mt-4 text-gray-400 max-w-lg mx-auto">
            Three steps. No middleman. No trust required.
          </p>
        </div>
      </ScrollReveal>

      {/* Steps */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step, index) => (
          <ScrollReveal key={step.number} delay={index * 150} direction="up">
            <div
              className={`
                relative rounded-2xl border p-8 
                bg-gradient-to-b ${step.color} 
                ${step.border}
                shadow-xl ${step.glow}
                hover:scale-[1.02] transition-transform duration-300
                group
              `}
            >
              {/* Step number — top right */}
              <span className="absolute top-6 right-6 text-xs font-mono text-gray-600">
                {step.number}
              </span>

              {/* Icon */}
              <div className="text-4xl mb-6">{step.icon}</div>

              {/* Title */}
              <h3 className="text-xl font-bold text-white mb-3">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-gray-400 text-sm leading-relaxed">
                {step.description}
              </p>

              {/* Connector arrow (hidden on last card and on mobile) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                  <div className="text-gray-600 text-xl">→</div>
                </div>
              )}
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* Bottom separator */}
      <ScrollReveal delay={500}>
        <div className="mt-20 flex items-center gap-4 max-w-xs mx-auto">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-cyan-500/30" />
          <span className="text-xs text-gray-600 font-mono uppercase tracking-widest">
            powered by Soroban
          </span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-cyan-500/30" />
        </div>
      </ScrollReveal>
    </section>
  )
}
