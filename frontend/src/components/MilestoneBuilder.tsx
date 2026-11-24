import { useEffect, useId, useMemo } from 'react'

export interface MilestoneInput {
  amount: string
  description: string
}

interface MilestoneBuilderProps {
  milestones: MilestoneInput[]
  onChange: (milestones: MilestoneInput[]) => void
  onValidationChange?: (isValid: boolean) => void
}

// Same strict amount format as amountToStroops / CreateAgreementPage submit check.
const AMOUNT_PATTERN = /^\d+(\.\d{1,7})?$/

export interface MilestoneValidation {
  errors: (string | undefined)[]
  duplicates: Set<number>
  isValid: boolean
}

export function validateMilestones(milestones: MilestoneInput[]): MilestoneValidation {
  const errors: (string | undefined)[] = new Array(milestones.length)
  const duplicates = new Set<number>()
  const amountMap = new Map<string, number[]>()
  let hasErrors = false

  milestones.forEach((milestone, index) => {
    const raw = milestone.amount.trim()

    if (raw === '') {
      hasErrors = true
      return
    }

    if (!AMOUNT_PATTERN.test(raw) || Number(raw) <= 0) {
      errors[index] = 'Amount must be a positive number with up to 7 decimals'
      hasErrors = true
      return
    }

    // Track valid amounts for duplicate detection
    const key = Number(raw).toString()
    if (!amountMap.has(key)) {
      amountMap.set(key, [])
    }
    amountMap.get(key)!.push(index)
  })

  amountMap.forEach((indices) => {
    if (indices.length > 1) {
      indices.forEach((index) => duplicates.add(index))
      hasErrors = true
    }
  })

  const isValid = !hasErrors && milestones.length > 0

  return { errors, duplicates, isValid }
}

export default function MilestoneBuilder({ milestones, onChange, onValidationChange }: MilestoneBuilderProps) {
  // Stable base id so each row's label/input/error can be linked uniquely.
  const baseId = useId()

  // Errors and duplicates are derived from the current array on every render,
  // so they stay attached to the correct row after a remove or reorder.
  const { errors, duplicates, isValid } = useMemo(
    () => validateMilestones(milestones),
    [milestones],
  )

  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(isValid)
    }
  }, [isValid, onValidationChange])

  const addMilestone = () => {
    onChange([...milestones, { amount: '', description: '' }])
  }

  const removeMilestone = (index: number) => {
    onChange(milestones.filter((_, i) => i !== index))
  }

  const updateMilestone = (index: number, field: keyof MilestoneInput, value: string) => {
    const updated = [...milestones]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const moveMilestone = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= milestones.length) return

    const updated = [...milestones]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white dark:text-white light:text-gray-900">Milestones</h3>
        <button
          type="button"
          onClick={addMilestone}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-navy-900 text-sm font-semibold rounded-lg transition-colors"
        >
          + Add Milestone
        </button>
      </div>

      {milestones.length === 0 && (
        <div className="rounded-lg border border-navy-700 dark:border-navy-700 light:border-gray-200 bg-navy-800/60 dark:bg-navy-800/60 light:bg-gray-50 p-6 text-center">
          <p className="text-gray-400 dark:text-gray-400 light:text-gray-600">No milestones yet. Add at least one to continue.</p>
        </div>
      )}

      <div className="space-y-3">
        {milestones.map((milestone, index) => {
          const amountId = `${baseId}-amount-${index}`
          const amountErrorId = `${baseId}-amount-error-${index}`
          const descriptionId = `${baseId}-description-${index}`
          const amountError = errors[index]
          const isDuplicate = duplicates.has(index) && !amountError
          const amountDescribedBy = amountError
            ? amountErrorId
            : isDuplicate
              ? `${baseId}-amount-duplicate-${index}`
              : undefined

          return (
          <div
            key={index}
            className="rounded-lg border border-navy-700 dark:border-navy-700 light:border-gray-200 bg-navy-800/60 dark:bg-navy-800/60 light:bg-gray-50 p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-gray-400 dark:text-gray-400 light:text-gray-600">#{index + 1}</span>
              
              <div className="flex gap-1">
                {/* Move up */}
                <button
                  type="button"
                  onClick={() => moveMilestone(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 dark:text-gray-400 light:text-gray-600 hover:text-white dark:hover:text-white light:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Move up"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Move down */}
                <button
                  type="button"
                  onClick={() => moveMilestone(index, 'down')}
                  disabled={index === milestones.length - 1}
                  className="p-1 text-gray-400 dark:text-gray-400 light:text-gray-600 hover:text-white dark:hover:text-white light:hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Move down"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeMilestone(index)}
                  className="p-1 text-gray-400 dark:text-gray-400 light:text-gray-600 hover:text-red-400"
                  aria-label="Remove milestone"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor={amountId} className="block text-sm text-gray-400 dark:text-gray-400 light:text-gray-600 mb-1">Amount</label>
              <input
                id={amountId}
                type="text"
                placeholder="100"
                value={milestone.amount}
                onChange={(e) => updateMilestone(index, 'amount', e.target.value)}
                aria-invalid={amountError ? true : undefined}
                aria-describedby={amountDescribedBy}
                className={`w-full px-3 py-2 bg-navy-700 dark:bg-navy-700 light:bg-gray-100 border ${
                  errors[index] ? 'border-red-500' : 'border-navy-600'
                } text-white dark:text-white light:text-gray-900 rounded-lg focus:outline-none focus:border-cyan-400`}
              />
              {errors[index] && (
                <p id={amountErrorId} role="alert" className="mt-1 text-xs text-red-400">{errors[index]}</p>
              )}
              {duplicates.has(index) && !errors[index] && (
                <p id={`${baseId}-amount-duplicate-${index}`} role="alert" className="mt-1 text-xs text-amber-400">⚠️ This amount is duplicated in another milestone</p>
              )}
            </div>

            <div>
              <label htmlFor={descriptionId} className="block text-sm text-gray-400 dark:text-gray-400 light:text-gray-600 mb-1">Description</label>
              <input
                id={descriptionId}
                type="text"
                placeholder="Describe this milestone"
                value={milestone.description}
                onChange={(e) => updateMilestone(index, 'description', e.target.value)}
                className="w-full