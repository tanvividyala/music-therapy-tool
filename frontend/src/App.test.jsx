// @vitest-environment jsdom
// Smoke test of the demo-mode flow: NFR-3 disclaimer gate, FR-2 crisis screen,
// FR-3 playlist with explanations, FR-4 stage label updates, FR-6 skipped debrief.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import App from './App.jsx'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function clickGrid(x, y) {
  const svg = screen.getByRole('button', { name: /Mood grid/ })
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 260, height: 260 })
  fireEvent.click(svg, { clientX: x, clientY: y })
}

async function toQuestionnaire() {
  render(<App />)
  fireEvent.click(await screen.findByText(/demo mode/))
  expect(screen.getByRole('button', { name: 'Continue' }).disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

function answerWellbeing(value) {
  for (const name of ['hopeless', 'cope', 'sleep']) {
    const radios = document.querySelectorAll(`input[name="${name}"]`)
    fireEvent.click(radios[value ? 1 : 0])
  }
}

it('FT-2: distress answers show crisis resources, no playlist', async () => {
  await toQuestionnaire()
  clickGrid(50, 30)
  answerWellbeing(true)
  fireEvent.click(screen.getByLabelText(/Calm/))
  fireEvent.click(screen.getByText('Build my playlist'))
  expect((await screen.findByRole('alert')).textContent).toMatch(/988/)
  expect(screen.queryByText(/Your Calm playlist/)).toBeNull()
})

it('FT-1: questionnaire to playlist, session stage changes, skip debrief', async () => {
  await toQuestionnaire()
  clickGrid(78, 52) // about (-0.4, +0.6)
  answerWellbeing(false)
  expect(await screen.findByText(/Suggestion:/)).toBeTruthy()
  fireEvent.click(screen.getByLabelText(/Calm/))
  fireEvent.click(screen.getByText('Build my playlist'))
  expect(await screen.findByText(/Your Calm playlist/)).toBeTruthy()
  const items = document.querySelectorAll('ol li')
  expect(items.length).toBeGreaterThan(3)
  fireEvent.click(screen.getByText('Start guided session'))
  const first = screen.getByTestId('stage-label').textContent
  const firstComment = screen.getByTestId('commentary').textContent
  expect(first).toMatch(/MATCH/)
  for (let i = 0; i < items.length - 1; i++) fireEvent.click(screen.getByText('Next'))
  expect(screen.getByTestId('stage-label').textContent).toMatch(/SETTLE/)
  expect(screen.getByTestId('commentary').textContent).not.toBe(firstComment)
  fireEvent.click(screen.getByText('End session'))
  fireEvent.click(screen.getByText('Skip'))
  expect(await screen.findByText(/Mood pilot/)).toBeTruthy()
})
