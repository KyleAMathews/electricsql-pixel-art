import { useEffect, useRef, useState } from 'react'
import { useShape, getShapeStream } from '@electric-sql/react'
import { useOptimistic } from 'react'
import { Pixel } from '../types/schema'
import { pixelShape } from '../shapes'
import { matchStream } from '../utils/match-stream'

const CANVAS_SIZE = 1000
const PIXEL_SIZE = 10
const VISIBLE_PIXELS = CANVAS_SIZE / PIXEL_SIZE

interface CanvasProps {
  userId: string
  selectedColor: string
}

async function updatePixel(pixel: Partial<Pixel>) {
  const pixelsStream = getShapeStream<Pixel>(pixelShape())

  // Match the update
  const findUpdatePromise = matchStream({
    stream: pixelsStream,
    operations: ['insert', 'update'],
    matchFn: ({ message }) => 
      message.value.x === pixel.x && 
      message.value.y === pixel.y
  })

  // Post to backend
  const fetchPromise = fetch('/api/pixels', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pixel),
  })

  return await Promise.all([findUpdatePromise, fetchPromise])
}

export function Canvas({ userId, selectedColor }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  // Initialize shapes
  const { data: pixels = [], isLoading } = useShape<Pixel>(pixelShape())
  const [optimisticPixels, addOptimisticPixel] = useOptimistic(
    pixels,
    (currentPixels: Pixel[], newPixel: Pixel) => {
      // Replace existing pixel at same coordinates or add new one
      const filteredPixels = currentPixels.filter(
        p => !(p.x === newPixel.x && p.y === newPixel.y)
      )
      return [...filteredPixels, newPixel]
    }
  )

  useEffect(() => {
    if (isLoading) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Get visible range based on offset and zoom
    const startX = Math.floor(offset.x / PIXEL_SIZE)
    const startY = Math.floor(offset.y / PIXEL_SIZE)
    const endX = startX + Math.ceil(VISIBLE_PIXELS / zoom)
    const endY = startY + Math.ceil(VISIBLE_PIXELS / zoom)

    // Filter visible pixels
    const visiblePixels = optimisticPixels.filter(
      pixel => pixel.x >= startX && pixel.x <= endX && 
               pixel.y >= startY && pixel.y <= endY
    )

    // Draw pixels
    visiblePixels.forEach((pixel: Pixel) => {
      ctx.fillStyle = pixel.color
      ctx.fillRect(
        (pixel.x - startX) * PIXEL_SIZE * zoom,
        (pixel.y - startY) * PIXEL_SIZE * zoom,
        PIXEL_SIZE * zoom,
        PIXEL_SIZE * zoom
      )
    })
  }, [optimisticPixels, offset, zoom, isLoading])

  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.floor((event.clientX - rect.left + offset.x) / (PIXEL_SIZE * zoom))
    const y = Math.floor((event.clientY - rect.top + offset.y) / (PIXEL_SIZE * zoom))

    const newPixel = {
      x,
      y,
      color: selectedColor,
      user_id: userId,
      last_updated: new Date()
    }

    // Update optimistically
    addOptimisticPixel(newPixel)

    // Send to backend
    await updatePixel(newPixel)
  }

  const handleMouseDown = () => setIsDragging(true)
  const handleMouseUp = () => setIsDragging(false)
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    setOffset(prev => ({
      x: prev.x - event.movementX,
      y: prev.y - event.movementY
    }))
  }
  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    const newZoom = Math.max(0.1, Math.min(10, zoom * (1 - event.deltaY * 0.001)))
    setZoom(newZoom)
  }

  if (isLoading) {
    return <div>Loading canvas...</div>
  }

  return (
    <canvas
      ref={canvasRef}
      width={VISIBLE_PIXELS}
      height={VISIBLE_PIXELS}
      onClick={handleCanvasClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      style={{
        cursor: 'crosshair',
        border: '1px solid #ccc'
      }}
    />
  )
}
