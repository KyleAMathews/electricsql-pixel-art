import { useEffect, useRef, useState } from "react";
import { useShape, getShapeStream } from "@electric-sql/react";
import { Pixel, User } from "../types/schema";
import { pixelShape, userShape } from "../shapes";
import { matchStream } from "../utils/match-stream";
import { formatDistanceToNow } from "date-fns";
import { loadAuth } from "../App";

const PIXEL_SIZE = 10;

interface CanvasProps {
  userId: string;
  selectedColor: string;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isTouchRef = useRef(false);
  const initialTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);
  const lastPixelTimeRef = useRef<number>(Date.now());
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pendingPixels, setPendingPixels] = useState<Pixel[]>([]);
  const [hoveredPixel, setHoveredPixel] = useState<{
    x: number;
    y: number;
    user: User | undefined;
    lastUpdated: string;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

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

    let initialScale = 1;

    const handleGestureStart = (e: any) => {
      e.preventDefault();
      initialScale = zoom;
    };

    const handleGestureChange = (e: any) => {
      e.preventDefault();
      const newZoom = Math.max(0.1, Math.min(10, initialScale * e.scale));

      // Get center of gesture
      const rect = canvas.getBoundingClientRect();
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;

      if (Math.abs(newZoom - zoom) > 0.001) {
        setZoom(newZoom);

        // Adjust offset to keep the gesture center point in place
        const zoomDiff = newZoom - zoom;
        const newOffset = {
          x: offset.x + (centerX * zoomDiff) / newZoom,
          y: offset.y + (centerY * zoomDiff) / newZoom,
        };
        setOffset(newOffset);
      }
    };

    const handleGestureEnd = (e: any) => {
      e.preventDefault();
    };

    canvas.addEventListener("gesturestart", handleGestureStart, {
      passive: false,
    });
    canvas.addEventListener("gesturechange", handleGestureChange, {
      passive: false,
    });
    canvas.addEventListener("gestureend", handleGestureEnd, { passive: false });

    return () => {
      canvas.removeEventListener("gesturestart", handleGestureStart);
      canvas.removeEventListener("gesturechange", handleGestureChange);
      canvas.removeEventListener("gestureend", handleGestureEnd);
    };
  }, [zoom, offset]);

  const handleCanvasClick = async (
    event: React.MouseEvent<HTMLCanvasElement>,
  ) => {
    // Prevent click events from firing during touch interactions
    if (isTouchRef.current) {
      isTouchRef.current = false;
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

    const newPixel: Partial<Pixel> = {
      x,
      y,
      color: selectedColor,
      user_id: userId,
      last_updated: new Date().toISOString(),
    };

    try {
      // Add to pending pixels immediately
      setPendingPixels((prev) => [...prev, newPixel as Pixel]);

      // Send to backend
      await updatePixel(newPixel);
      lastPixelTimeRef.current = Date.now();

      // Remove from pending once confirmed
      setPendingPixels((prev) => prev.filter((p) => !(p.x === x && p.y === y)));
    } catch (error) {
      console.error("Error updating pixel:", error);
      // Remove from pending if there was an error
      setPendingPixels((prev) => prev.filter((p) => !(p.x === x && p.y === y)));
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setIsDragging(true);
    setHasMoved(false);
    setDragStartPos({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Only trigger click if there was absolutely no movement
    if (dragStartPos && !hasMoved) {
      handleCanvasClick(event);
    }
    setIsDragging(false);
    setDragStartPos(null);
    setHasMoved(false);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setHasMoved(true);
      const deltaX = event.clientX - dragStartPos!.x;
      const deltaY = event.clientY - dragStartPos!.y;

      setOffset((prev) => ({
        x: prev.x - deltaX,
        y: prev.y - deltaY,
      }));

      setDragStartPos({
        x: event.clientX,
        y: event.clientY,
      });
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
      const user = users.find((u) => u.id === pixel.user_id);
      setHoveredPixel({
        x,
        y,
        user,
        lastUpdated: pixel.last_updated,
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

  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    isTouchRef.current = true;

    const touch = event.touches[0];
    if (!touch) return;

    // Initialize touch position without any movement
    lastTouchPos.current = {
      x: touch.clientX,
      y: touch.clientY,
    };

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x =
      Math.floor((touch.clientX - rect.left) / (PIXEL_SIZE * zoom)) +
      Math.floor(offset.x / (PIXEL_SIZE * zoom));
    const y =
      Math.floor((touch.clientY - rect.top) / (PIXEL_SIZE * zoom)) +
      Math.floor(offset.y / (PIXEL_SIZE * zoom));

    initialTouchRef.current = { x, y };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    isTouchRef.current = true;
    const touch = event.touches[0];
    if (!touch) return;

    // Only handle panning with single touch
    if (event.touches.length === 1 && lastTouchPos.current) {
      const movementX = lastTouchPos.current.x - touch.clientX;
      const movementY = lastTouchPos.current.y - touch.clientY;

      // Apply smoothing factor
      const smoothingFactor = 0.6;
      const smoothedX = movementX * smoothingFactor;
      const smoothedY = movementY * smoothingFactor;

      // Only update if movement is significant
      if (Math.abs(smoothedX) > 0.5 || Math.abs(smoothedY) > 0.5) {
        setOffset((prev) => ({
          x: prev.x + smoothedX,
          y: prev.y + smoothedY,
        }));
      }
    }

    // Update last touch position
    lastTouchPos.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleTouchEnd = async (event: React.TouchEvent<HTMLCanvasElement>) => {
    const touch = event.changedTouches[0];
    if (!touch || !initialTouchRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const currentX =
      Math.floor((touch.clientX - rect.left) / (PIXEL_SIZE * zoom)) +
      Math.floor(offset.x / (PIXEL_SIZE * zoom));
    const currentY =
      Math.floor((touch.clientY - rect.top) / (PIXEL_SIZE * zoom)) +
      Math.floor(offset.y / (PIXEL_SIZE * zoom));

    // Calculate the Manhattan distance between start and end positions
    const xDiff = Math.abs(currentX - initialTouchRef.current.x);
    const yDiff = Math.abs(currentY - initialTouchRef.current.y);
    const manhattanDistance = xDiff + yDiff;

    // Allow movement of up to 4 pixels total (using Manhattan distance)
    if (manhattanDistance <= 0) {
      const x =
        Math.floor((touch.clientX - rect.left) / (PIXEL_SIZE * zoom)) +
        Math.floor(offset.x / (PIXEL_SIZE * zoom));
      const y =
        Math.floor((touch.clientY - rect.top) / (PIXEL_SIZE * zoom)) +
        Math.floor(offset.y / (PIXEL_SIZE * zoom));

      const auth = loadAuth();
      if (!auth) return;

      const existingPixel = pixels.find((p) => p.x === x && p.y === y);
      if (!existingPixel) {
        const newPixel: Partial<Pixel> = {
          x,
          y,
          color: selectedColor,
          user_id: auth.userId,
          last_updated: new Date().toISOString(),
        };

        // Add to pending pixels immediately
        setPendingPixels((prev) => [...prev, newPixel as Pixel]);

        try {
          // Send to backend
          await updatePixel(newPixel);
          lastPixelTimeRef.current = Date.now();
          // Remove from pending once confirmed
          setPendingPixels((prev) =>
            prev.filter((p) => !(p.x === x && p.y === y)),
          );
        } catch (error) {
          console.error("Error updating pixel:", error);
          // Remove from pending if there was an error
          setPendingPixels((prev) =>
            prev.filter((p) => !(p.x === x && p.y === y)),
          );
        }
      }
    }

    initialTouchRef.current = null;
    isTouchRef.current = false;
  };

  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newZoom = Math.min(10, zoom * 1.2);
    const zoomDiff = newZoom - zoom;

    // Zoom towards center of canvas
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setZoom(newZoom);
    setOffset((prev) => ({
      x: prev.x + (centerX * zoomDiff) / newZoom,
      y: prev.y + (centerY * zoomDiff) / newZoom,
    }));
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newZoom = Math.max(0.1, zoom / 1.2);
    const zoomDiff = newZoom - zoom;

    // Zoom towards center of canvas
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setZoom(newZoom);
    setOffset((prev) => ({
      x: prev.x + (centerX * zoomDiff) / newZoom,
      y: prev.y + (centerY * zoomDiff) / newZoom,
    }));
  };

  if (isLoading) {
    return ``;
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: "crosshair",
          touchAction: "none",
        }}
      />
      {/* Zoom controls */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: "white",
          padding: 8,
          borderRadius: 4,
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        <button
          onClick={handleZoomIn}
          style={{
            width: 32,
            height: 32,
            fontSize: 18,
            fontWeight: "bold",
            borderRadius: 4,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            color: "#333",
            lineHeight: 1,
          }}
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            width: 32,
            height: 32,
            fontSize: 18,
            fontWeight: "bold",
            borderRadius: 4,
            border: "1px solid #ccc",
            background: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            color: "#333",
            lineHeight: 1,
          }}
        >
          −
        </button>
      </div>
      {(() => {
        const now = Date.now();
        const timeSinceLastPixel = now - lastPixelTimeRef.current;
        // console.log({
        //   hoveredPixel: !!hoveredPixel,
        //   isTouch: isTouchRef.current,
        //   timeSinceLastPixel,
        //   shouldShow: hoveredPixel && !isTouchRef.current && timeSinceLastPixel > 4000
        // });
        return hoveredPixel && !isTouchRef.current && timeSinceLastPixel > 4000 && (
          <div
            ref={tooltipRef}
            style={{
              position: "fixed",
              left: hoveredPixel.screenX + 10,
              top: hoveredPixel.screenY + 10,
              background: "rgba(0,0,0,0.8)",
              color: "white",
              padding: "8px",
              borderRadius: "4px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              zIndex: 1000,
              fontSize: "14px",
              maxWidth: "200px",
              wordWrap: "break-word",
            }}
          >
            <div>
              Created by: {hoveredPixel.user?.username || "Unknown user"}
            </div>
            <div>
              Last updated:{" "}
              {formatDistanceToNow(new Date(hoveredPixel.lastUpdated), {
                addSuffix: true,
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
