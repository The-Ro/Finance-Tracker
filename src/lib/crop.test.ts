import { describe, expect, it } from 'vitest'
import { clampCrop, cropSource, initialCrop, zoomCrop } from './crop'

// A 1000 x 500 landscape photo in a 250px frame: at zoom 1 it's drawn 500 x 250.
describe('crop', () => {
  it('starts centred and covering the frame', () => {
    const s = initialCrop(250, 1000, 500)
    expect(s).toEqual({ zoom: 1, x: -125, y: 0 })
    expect(cropSource(s, 250, 1000, 500)).toEqual({ sx: 250, sy: 0, size: 500 })
  })
  it('never leaves an empty edge when dragged', () => {
    expect(clampCrop({ zoom: 1, x: 40, y: 30 }, 250, 1000, 500)).toEqual({ zoom: 1, x: 0, y: 0 })
    expect(clampCrop({ zoom: 1, x: -900, y: -10 }, 250, 1000, 500)).toEqual({ zoom: 1, x: -250, y: 0 })
  })
  it('zooms around the centre of the frame', () => {
    const s = zoomCrop(initialCrop(250, 1000, 500), 2, 250, 1000, 500)
    expect(s.zoom).toBe(2)
    // Still centred on the photo's middle: a 250px square of the photo, from (375, 125).
    expect(cropSource(s, 250, 1000, 500)).toEqual({ sx: 375, sy: 125, size: 250 })
  })
  it('keeps zoom between 1 and the maximum', () => {
    expect(zoomCrop(initialCrop(250, 500, 500), 0.5, 250, 500, 500).zoom).toBe(1)
    expect(zoomCrop(initialCrop(250, 500, 500), 9, 250, 500, 500).zoom).toBe(4)
  })
})
