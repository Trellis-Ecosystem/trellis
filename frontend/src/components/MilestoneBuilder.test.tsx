import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MilestoneBuilder, { type MilestoneInput } from './MilestoneBuilder'

function Harness({
  initial,
  onValidationChange,
}: {
  initial: MilestoneInput[]
  onValidationChange?: (isValid: boolean) => void
}) {
  const [milestones, setMilestones] = useState(initial)
  return (
    <MilestoneBuilder
      milestones={milestones}
      onChange={setMilestones}
      onValidationChange={onValidationChange}
    />
  )
}

const amountInputs = () => screen.getAllByPlaceholderText('100')
const amountErrorNodes = () => screen.queryAllByText(/invalid amount|must be greater than 0/i)

describe('<MilestoneBuilder />', () => {
  it('flags non-numeric input immediately', () => {
    render(<Harness initial={[{ amount: '', description: '' }]} />)

    fireEvent.change(amountInputs()[0], { target: { value: '100abc' } })
    expect(screen.getByText(/invalid amount format/i)).toBeInTheDocument()

    fireEvent.change(amountInputs()[0], { target: { value: '1e3' } })
    expect(screen.getByText(/invalid amount format/i)).toBeInTheDocument()
  })

  it('flags zero and negative amounts', () => {
    render(<Harness initial={[{ amount: '', description: '' }]} />)

    fireEvent.change(amountInputs()[0], { target: { value: '0' } })
    expect(screen.getByText(/must be greater than 0/i)).toBeInTheDocument()

    fireEvent.change(amountInputs()[0], { target: { value: '-5' } })
    expect(screen.getByText(/invalid amount format/i)).toBeInTheDocument()
  })

  it('keeps the error on the same row after removing an earlier row', () => {
    render(
      <Harness
        initial={[
          { amount: '10', description: 'first' },
          { amount: 'bad', description: 'second' },
          { amount: '30', description: 'third' },
        ]}
      />,
    )

    expect(amountErrorNodes()).toHaveLength(1)

    // Remove the first (valid) row — the error must stay attached to 'bad',
    // which shifts from index 1 to index 0.
    fireEvent.click(screen.getAllByLabelText('Remove milestone')[0])

    expect(amountInputs()).toHaveLength(2)
    expect(amountErrorNodes()).toHaveLength(1)
    expect(amountInputs()[0]).toHaveValue('bad')
    expect(amountInputs()[0].className).toContain('border-red-500')
    expect(amountInputs()[1].className).not.toContain('border-red-500')
  })

  it('keeps the error on the same row after moving it', () => {
    render(
      <Harness
        initial={[
          { amount: '10', description: 'first' },
          { amount: 'bad', description: 'second' },
          { amount: '30', description: 'third' },
        ]}
      />,
    )

    // Move the invalid row down one position.
    fireEvent.click(screen.getAllByLabelText('Move down')[1])

    expect(amountInputs()[0]).toHaveValue('10')
    expect(amountInputs()[1]).toHaveValue('30')
    expect(amountInputs()[2]).toHaveValue('bad')
    expect(amountInputs()[2].className).toContain('border-red-500')
    expect(amountInputs()[1].className).not.toContain('border-red-500')
  })

  it('flags duplicate amounts, treating 100 and 100.0 as equal', () => {
    render(
      <Harness
        initial={[
          { amount: '100', description: '' },
          { amount: '100.0', description: '' },
          { amount: '50', description: '' },
        ]}
      />,
    )

    expect(screen.getAllByText(/duplicated/i)).toHaveLength(2)
  })

  it('reports invalid via onValidationChange and valid once fixed', () => {
    const onValidationChange = vi.fn()
    render(
      <Harness
        initial={[{ amount: 'abc', description: '' }]}
        onValidationChange={onValidationChange}
      />,
    )

    expect(onValidationChange).toHaveBeenLastCalledWith(false)

    fireEvent.change(amountInputs()[0], { target: { value: '42' } })
    expect(onValidationChange).toHaveBeenLastCalledWith(true)
  })
})
