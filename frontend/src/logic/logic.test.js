// Frontend mirrors of UT-1, UT-2, UT-3, plus FR-3 / NFR-5 checks on the
// mock catalog for every goal and session length.
import { describe, expect, it } from 'vitest'
import { ROUTES, SESSION_LENGTHS } from '../config.js'
import { generatePlaylist } from './api.js'
import { distance, orderPlaylist } from './planner.js'
import { isDistress } from './questionnaire.js'
import { calmScore } from './scoring.js'

describe('UT-1 distress detection (FR-2)', () => {
  it('returns True, False, True for the three test inputs', () => {
    expect(isDistress({ stress: 10, wellbeingFlags: [false, false] })).toBe(true)
    expect(isDistress({ stress: 4, wellbeingFlags: [false, false] })).toBe(false)
    expect(isDistress({ stress: 3, wellbeingFlags: [false, true] })).toBe(true)
  })
})

describe('UT-2 calm score (FR-3)', () => {
  const slow = { bpm: 60, muse_arousal: -0.6, lyric_valence: 0.2 }
  const fast = { bpm: 160, muse_arousal: 0.7, lyric_valence: 0.2 }
  const instr = { bpm: 70, muse_arousal: -0.3, lyric_valence: null }
  it('scores in range, slow > fast, instrumental works, input unchanged', () => {
    const before = JSON.stringify([slow, fast, instr])
    for (const s of [slow, fast, instr]) {
      const v = calmScore(s)
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(calmScore(slow)).toBeGreaterThan(calmScore(fast))
    expect(JSON.stringify([slow, fast, instr])).toBe(before)
  })
})

describe('UT-3 iso ordering (FR-3, NFR-5)', () => {
  const start = [-0.4, 0.6]
  const goal = [0.4, -0.4]
  const candidates = Array.from({ length: 20 }, (_, i) => {
    const t = i / 19
    return { song_id: i, valence: start[0] + t * (goal[0] - start[0]), arousal: start[1] + t * (goal[1] - start[1]), duration_min: 3.5 }
  })
  it('orders from start to goal within 27-33 min', () => {
    const before = JSON.stringify(candidates)
    const pl = orderPlaylist(candidates, start, goal, 30)
    const closest = (p) => Math.min(...candidates.map((c) => distance(c, p)))
    expect(distance(pl[0], start)).toBeCloseTo(closest(start))
    expect(distance(pl.at(-1), goal)).toBeCloseTo(closest(goal))
    for (let i = 1; i < pl.length; i++) expect(distance(pl[i], goal)).toBeLessThanOrEqual(distance(pl[i - 1], goal))
    const total = pl.reduce((s, t) => s + t.duration_min, 0)
    expect(total).toBeGreaterThanOrEqual(27)
    expect(total).toBeLessThanOrEqual(33)
    pl.forEach((t) => expect(t.explanation.length).toBeGreaterThan(0))
    expect(JSON.stringify(candidates)).toBe(before)
  })
})

describe('generatePlaylist on the mock catalog (FR-3, NFR-1, NFR-5)', () => {
  for (const goalName of Object.keys(ROUTES)) {
    for (const length of SESSION_LENGTHS) {
      it(`${goalName}, ${length} min`, async () => {
        const res = await generatePlaylist({ mood: ROUTES[goalName].start, goal: goalName, length })
        const pl = res.playlist
        const total = pl.reduce((s, t) => s + t.duration_min, 0)
        expect(total).toBeGreaterThanOrEqual(length - 3)
        expect(total).toBeLessThanOrEqual(length + 3)
        for (let i = 1; i < pl.length; i++) expect(distance(pl[i], res.goal)).toBeLessThanOrEqual(distance(pl[i - 1], res.goal))
        pl.forEach((t) => expect(t.explanation).toBeTruthy())
        expect(res.elapsedMs).toBeLessThan(60000)
      })
    }
  }
})
