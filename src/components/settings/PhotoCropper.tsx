import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { Modal, SheetSaveButton } from '@/components/ui/Modal'
import { clampCrop, cropSource, initialCrop, MAX_ZOOM, scaleFor, zoomCrop, type CropState } from '@/lib/crop'

const OUTPUT = 512

/**
 * Crop a new profile photo to a square before it's uploaded: drag to move,
 * the slider (or a two-finger pinch) to zoom. "Use photo" hands back a
 * 512 x 512 JPEG (smaller to upload than most phone photos).
 */
export function PhotoCropper({ file, busy, onCancel, onDone }: { file: File | null; busy: boolean; onCancel: () => void; onDone: (cropped: File) => void }) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [view, setView] = useState(280)
  const [crop, setCrop] = useState<CropState | null>(null)
  // A photo this browser can't draw (e.g. HEIC on a computer) is used as it is.
  const [broken, setBroken] = useState(false)
  const drag = useRef<{ x: number; y: number; start: CropState } | null>(null)
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  useEffect(() => {
    if (!file) return
    const u = URL.createObjectURL(file)
    setUrl(u)
    const image = new Image()
    image.onload = () => setImg(image)
    image.onerror = () => setBroken(true)
    image.src = u
    return () => {
      URL.revokeObjectURL(u)
      setImg(null)
      setCrop(null)
      setBroken(false)
    }
  }, [file])

  // The frame is as wide as the sheet allows (up to 320px).
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    setView(Math.round(el.getBoundingClientRect().width))
  }, [img])

  useEffect(() => {
    if (img) setCrop(initialCrop(view, img.naturalWidth, img.naturalHeight))
  }, [img, view])

  const w = img?.naturalWidth ?? 1
  const h = img?.naturalHeight ?? 1

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!crop) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: crop.zoom }
      drag.current = null
    } else {
      drag.current = { x: e.clientX, y: e.clientY, start: crop }
    }
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size === 2 && crop) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      setCrop(zoomCrop(crop, pinch.current.zoom * (dist / pinch.current.dist), view, w, h))
      return
    }
    const d = drag.current
    if (!d) return
    setCrop(clampCrop({ ...d.start, x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y }, view, w, h))
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  const use = () => {
    if (broken && file) return onDone(file)
    if (!img || !crop) return
    const { sx, sy, size } = cropSource(crop, view, w, h)
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    canvas.getContext('2d')?.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT, OUTPUT)
    canvas.toBlob(
      (blob) => {
        if (blob) onDone(new File([blob], 'profile.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9
    )
  }

  const scale = crop ? scaleFor(view, w, h, crop.zoom) : 1
  return (
    <Modal open={!!file} onClose={onCancel} title="Crop your photo" headerActions={<SheetSaveButton onClick={use} busy={busy} label="Use photo" />}>
      <div className="flex flex-col items-center gap-4">
        <div
          ref={frameRef}
          className="relative aspect-square w-full max-w-[320px] cursor-grab touch-none select-none overflow-hidden rounded-2xl bg-slate-900 active:cursor-grabbing"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {url && crop && (
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
              style={{ width: w * scale, height: h * scale, transform: `translate(${crop.x}px, ${crop.y}px)` }}
            />
          )}
          {/* The round shape it will show as. */}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgba(15,23,42,0.55)]" />
        </div>
        <label className="flex w-full max-w-[320px] items-center gap-3">
          <ZoomOut size={18} className="shrink-0 text-slate-500" aria-hidden="true" />
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={crop?.zoom ?? 1}
            aria-label="Zoom"
            onChange={(e) => crop && setCrop(zoomCrop(crop, Number(e.target.value), view, w, h))}
            className="w-full accent-[rgb(var(--accent))]"
          />
          <ZoomIn size={18} className="shrink-0 text-slate-500" aria-hidden="true" />
        </label>
        <p className="text-helper text-slate-500">
          {broken ? 'This photo can’t be shown here. Tap ✓ to use it as it is.' : 'Drag to move. Pinch or use the slider to zoom.'}
        </p>
      </div>
    </Modal>
  )
}
