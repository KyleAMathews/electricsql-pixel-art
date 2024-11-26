import { useEffect, useRef, useState } from "react";
import { useShape, getShapeStream } from "@electric-sql/react";
import { Pixel, User } from "../types/schema";
import { pixelShape, userShape } from "../shapes";
import { matchStream } from "../utils/match-stream";
import { formatDistanceToNow } from "date-fns";

const CANVAS_SIZE = 1000;
const PIXEL_SIZE = 10;
const VISIBLE_PIXELS = CANVAS_SIZE / PIXEL_SIZE;

interface CanvasProps {
  userId: string;
  selectedColor: string;
}

interface HoveredPixel {
  pixel: Pixel;
  screenX: number;
  screenY: number;
}

interface ViewState {
  offset: { x: number; y: number };
  zoom: number;
}

const STORAGE_KEY = "pixelCanvas_viewState";

function saveViewState(userId: string, state: ViewState) {
  const allStates = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  allStates[userId] = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allStates));
}

function loadViewState(userId: string): ViewState | null {
  const allStates = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  return allStates[userId] || null;
}

async function updatePixel(pixel: Partial<Pixel>) {
  const pixelsStream = getShapeStream<Pixel>(pixelShape());

  // Match the update
  const findUpdatePromise = matchStream({
    stream: pixelsStream,
    operations: ["insert", "update"],
    matchFn: ({ message }) =>
      message.value.x === pixel.x && message.value.y === pixel.y,
  });

  // Post to backend
  const fetchPromise = fetch(`${import.meta.env.VITE_API_URL}/api/pixels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pixel),
  });

  return await Promise.all([findUpdatePromise, fetchPromise]);
}

export function Canvas({ userId, selectedColor }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pendingPixels, setPendingPixels] = useState<Pixel[]>([]);
  const [hoveredPixel, setHoveredPixel] = useState<HoveredPixel | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Initialize shapes
  const { data: pixels = [], isLoading } = useShape<Pixel>(pixelShape());
  const { data: users = [] } = useShape<User>(userShape());

  // Combine database pixels with pending pixels
  const allPixels = [...pixels, ...pendingPixels];

  // Load saved view state on mount
  useEffect(() => {
    const savedState = loadViewState(userId);
    if (savedState) {
      setOffset(savedState.offset);
      setZoom(savedState.zoom);
    }
  }, [userId]);

  // Save view state when it changes
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      saveViewState(userId, { offset, zoom });
    }, 500); // Debounce to avoid too frequent saves

    return () => clearTimeout(debounceTimeout);
  }, [userId, offset, zoom]);

  // Handle canvas resize
  useEffect(() => {
    const updateCanvasSize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      // Get the container's dimensions
      const { width, height } = container.getBoundingClientRect();

      // Set both canvas dimensions and style
      canvas.width = width;
      canvas.height = height;

      // Trigger a redraw
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Clear canvas with a grid background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = "#EEEEEE";
        for (let x = 0; x < canvas.width; x += PIXEL_SIZE * zoom) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += PIXEL_SIZE * zoom) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        // Redraw pixels
        allPixels.forEach((pixel: Pixel) => {
          const startX = Math.floor(offset.x / (PIXEL_SIZE * zoom));
          const startY = Math.floor(offset.y / (PIXEL_SIZE * zoom));
          const endX = startX + Math.ceil(canvas.width / (PIXEL_SIZE * zoom));
          const endY = startY + Math.ceil(canvas.height / (PIXEL_SIZE * zoom));

          if (
            pixel.x >= startX &&
            pixel.x <= endX &&
            pixel.y >= startY &&
            pixel.y <= endY
          ) {
            const screenX = (pixel.x - startX) * PIXEL_SIZE * zoom;
            const screenY = (pixel.y - startY) * PIXEL_SIZE * zoom;

            ctx.fillStyle = pixel.color;
            ctx.fillRect(
              screenX,
              screenY,
              PIXEL_SIZE * zoom,
              PIXEL_SIZE * zoom,
            );
          }
        });
      }
    };

    // Update size initially
    updateCanvasSize();

    // Update size on window resize
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [allPixels, offset, zoom]);

  useEffect(() => {
    if (isLoading) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas with a grid background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid (optional - for better visibility)
    ctx.strokeStyle = "#EEEEEE";
    for (let x = 0; x < canvas.width; x += PIXEL_SIZE * zoom) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += PIXEL_SIZE * zoom) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Calculate visible range
    const startX = Math.floor(offset.x / (PIXEL_SIZE * zoom));
    const startY = Math.floor(offset.y / (PIXEL_SIZE * zoom));
    const endX = startX + Math.ceil(canvas.width / (PIXEL_SIZE * zoom));
    const endY = startY + Math.ceil(canvas.height / (PIXEL_SIZE * zoom));

    // Draw pixels
    allPixels.forEach((pixel: Pixel) => {
      // Only draw pixels in the visible range
      if (
        pixel.x >= startX &&
        pixel.x <= endX &&
        pixel.y >= startY &&
        pixel.y <= endY
      ) {
        const screenX = (pixel.x - startX) * PIXEL_SIZE * zoom;
        const screenY = (pixel.y - startY) * PIXEL_SIZE * zoom;

        ctx.fillStyle = pixel.color;
        ctx.fillRect(screenX, screenY, PIXEL_SIZE * zoom, PIXEL_SIZE * zoom);
      }
    });
  }, [allPixels, offset, zoom, isLoading]);

  const handleCanvasClick = async (
    event: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Adjust the coordinate calculation to account for the grid alignment
    const x =
      Math.floor((event.clientX - rect.left) / (PIXEL_SIZE * zoom)) +
      Math.floor(offset.x / (PIXEL_SIZE * zoom));
    const y =
      Math.floor((event.clientY - rect.top) / (PIXEL_SIZE * zoom)) +
      Math.floor(offset.y / (PIXEL_SIZE * zoom));

    const newPixel: Pixel = {
      x,
      y,
      color: selectedColor,
      user_id: userId,
      last_updated: new Date(),
    };

    try {
      // Add to pending pixels immediately
      setPendingPixels((prev) => [...prev, newPixel]);

      // Send to backend
      await updatePixel(newPixel);

      // Remove from pending once confirmed
      setPendingPixels((prev) => prev.filter((p) => !(p.x === x && p.y === y)));
    } catch (error) {
      console.error("Error updating pixel:", error);
      // Remove from pending on error
      setPendingPixels((prev) => prev.filter((p) => !(p.x === x && p.y === y)));
    }
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const newOffset = {
        x: offset.x - event.movementX,
        y: offset.y - event.movementY,
      };
      setOffset(newOffset);
      setHoveredPixel(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x =
      Math.floor((event.clientX - rect.left) / (PIXEL_SIZE * zoom)) +
      Math.floor(offset.x / (PIXEL_SIZE * zoom));
    const y =
      Math.floor((event.clientY - rect.top) / (PIXEL_SIZE * zoom)) +
      Math.floor(offset.y / (PIXEL_SIZE * zoom));

    // Find pixel at current position
    const pixel = allPixels.find((p) => p.x === x && p.y === y);

    if (pixel) {
      setHoveredPixel({
        pixel,
        screenX: event.clientX,
        screenY: event.clientY,
      });
    } else {
      setHoveredPixel(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPixel(null);
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const newZoom = Math.max(
      0.1,
      Math.min(10, zoom * (1 - event.deltaY * 0.001)),
    );
    setZoom(newZoom);
  };

  if (isLoading) {
    return ``;
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: "64px", // Leave space for toolbar
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        style={{
          cursor: "crosshair",
          border: "1px solid #ccc",
          background: "#FFFFFF",
          display: "block", // Prevent extra space at bottom
        }}
      />
      {hoveredPixel && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            left: hoveredPixel.screenX + 10,
            top: hoveredPixel.screenY + 10,
            background: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "8px",
            borderRadius: "4px",
            fontSize: "14px",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        >
          <div>
            User:{" "}
            {users.find((u) => u.id === hoveredPixel.pixel.user_id)?.username ||
              "Unknown"}
          </div>
          <div>
            Last updated:{" "}
            {formatDistanceToNow(new Date(hoveredPixel.pixel.last_updated))} ago
          </div>
        </div>
      )}
    </div>
  );
}
