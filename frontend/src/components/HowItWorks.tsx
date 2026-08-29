import type { ReactNode } from 'react'
import { CheckCircleIcon, LockIcon, ScaleIcon } from './icons'

interface Step {
  id: string
  icon: ReactNode
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    id: 'create-agreement',
    icon: '1',
    title: 'Create Agreement',
    description:
      'Define milestones, amounts, and the people involved. The payer authorizes and pays fees.',
  },
  {
    id: 'lock-funds',
    icon: <LockIcon size={16} color="#0A0E17" />,
    title: 'Lock Funds',
    description:
      'The payer deposits the agreed amount for each milestone into the contract.',
  },
  {
    id: 'submit-work',
    icon: '3',
    title: 'Submit Work',
    description:
      'The payee completes the work and submits proof (GitHub link, file, etc.).',
  },
  {
    id: 'approve-release',
    icon: <CheckCircleIcon size={16} color="#0A0E17" />,
    title: 'Approve & Release',
    description:
      'The payer reviews and approves. Funds are released to the payee on-chain.',
  },
  {
    id: 'dispute',
    icon: <ScaleIcon size={16} color="#0A0E17" />,
    title: 'Dispute (if needed)',
    description:
      'Either party can raise a dispute. A trusted resolver arbitrates and releases funds fairly.',
  },
]

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-heading" className="mt-20 max-w-2xl w-full">
      <h2
        id="how-it-works-heading"
        className="text-2xl font-bold text-white dark:text-white light:text-gray-900 mb-8 text-center"
      >
        How It Works
      </h2>

      <ol className="space-y-6 text-left list-none">
        {STEPS.map((step) => (
          <li key={step.id} className="flex gap-4">
            <div
              aria-hidden="true"
              className={`flex-shrink-0 w-8 h-8 bg-cyan-400 rounded-full flex items-center justify-center text-navy-900 ${
                typeof step.icon === 'string' ? 'font-bold text-sm' : ''
              }`.trimEnd()}
            >
              {step.icon}
            </div>
            <div>
              <h3 className="text-white dark:text-white light:text-gray-900 font-bold mb-1">{step.title}</h3>
              <p className="text-gray-400 dark:text-gray-400 light:text-gray-600 text-sm">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default HowItWorks
