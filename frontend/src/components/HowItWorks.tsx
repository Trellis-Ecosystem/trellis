import type { ReactNode } from 'react'
import { ScrollReveal } from './ScrollReveal'

function LockIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lockGradient" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00C2FF" />
          <stop offset="100%" stopColor="#0066FF" />
        </linearGradient>
        <linearGradient id="lockBodyGradient" x1="0" y1="20" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <filter id="lockGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="lockShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#00C2FF" floodOpacity="0.4" />
        </filter>
      </defs>
      <path
        d="M16 22V16C16 10.477 20.477 6 26 6C31.523 6 36 10.477 36 16V22"
        stroke="url(#lockGradient)"
        strokeWidth="3.5"
        strokeLinecap="round"
        filter="url(#lockShadow)"
      />
      <rect
        x="10"
        y="22"
        width="32"
        height="24"
        rx="5"
        fill="url(#lockBodyGradient)"
        filter="url(#lockShadow)"
      />
      <rect
        x="10"
        y="22"
        width="32"
        height="10"
        rx="5"
        fill="white"
        fillOpacity="0.08"
      />
      <circle cx="26" cy="33" r="4" fill="white" fillOpacity="0.15" />
      <circle cx="26" cy="32" r="2.5" fill="white" fillOpacity="0.9" />
      <rect x="24.5" y="33" width="3" height="4" rx="1" fill="white" fillOpacity="0.9" />
    </svg>
  )
}

function LightningIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="boltGradient" x1="28" y1="4" x2="20" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="50%" stopColor="#00C2FF" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <filter id="boltGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="boltShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#00C2FF" floodOpacity="0.6" />
        </filter>
      </defs>
      <path
        d="M30 4L14 28H24L22 48L38 24H28L30 4Z"
        fill="url(#boltGradient)"
        filter="url(#boltShadow)"
      />
      <path
        d="M30 4L22 22H29L30 4Z"
        fill="white"
        fillOpacity="0.25"
      />
      <path
        d="M28 10L18 28H25"
        stroke="white"
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="checkCircleGradient" x1="0" y1="0" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="checkMarkGradient" x1="14" y1="26" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ECFDF5" />
          <stop offset="100%" stopColor="#A7F3D0" />
        </linearGradient>
        <filter id="checkShadow">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#10B981" floodOpacity="0.5" />
        </filter>
      </defs>
      <circle
        cx="26"
        cy="26"
        r="22"
        fill="url(#checkCircleGradient)"
        filter="url(#checkShadow)"
      />
      <ellipse
        cx="26"
        cy="16"
        rx="14"
        ry="7"
        fill="white"
        fillOpacity="0.12"
      />
      <path
        d="M15 26L22 33L37 18"
        stroke="url(#checkMarkGradient)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface Step {
  number: string
  icon: ReactNode
  title: string
  description: string
  color: string
  border: string
  glow: string
}

const steps: Step[] = [
  {
    number: '01',
    icon: <LockIcon />,
    title: 'Lock',
    description:
      'The payer locks USDC into the Soroban escrow contract for each milestone. Funds are held on-chain — not by any platform or middleman.',
    color: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-500/30',
    glow: 'shadow-cyan-500/10',
  },
  {
    number: '02',
    icon: <LightningIcon />,
    title: 'Build',
    description:
      'The payee completes the work and submits proof — an IPFS hash, GitHub PR, or any verifiable URI. The milestone moves to WorkSubmitted state on-chain.',
    color: 'from-blue-500/20 to-blue-500/5',
    border: 'border-blue-500/30',
    glow: 'shadow-blue-500/10',
  },
  {
    number: '03',
    icon: <CheckIcon />,
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
              <div className="mb-6 drop-shadow-lg">
                {step.icon}
              </div>

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
