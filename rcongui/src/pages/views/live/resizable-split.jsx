import { useRef } from "react";
import { Box } from "@mui/material";

const HANDLE_WIDTH = 8; // px, matches the former Grid spacing between the panels
const KEYBOARD_STEP = 2; // percent

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Two panels side by side with a draggable divider between them.
 * When `enabled` is false (small screens or only one panel shown)
 * the panels are simply stacked.
 *
 * `size` is the width of the left panel in percent of the container.
 * While dragging, the width is updated through a CSS variable so the
 * (expensive) tables do not re-render on every pointer move; the final
 * value is committed through `onSizeChange` when the drag ends.
 */
export default function ResizableSplit({
  left,
  right,
  enabled,
  size,
  onSizeChange,
  defaultSize,
  min = 20,
  max = 80,
}) {
  const containerRef = useRef(null);
  const dragSizeRef = useRef(null);

  const sizeFromPointer = (clientX) => {
    const rect = containerRef.current.getBoundingClientRect();
    return clamp(((clientX - rect.left) / rect.width) * 100, min, max);
  };

  const applySize = (value) => {
    containerRef.current?.style.setProperty("--split-size", `${value}%`);
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault(); // prevent text selection while dragging
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSizeRef.current = size;
  };

  const handlePointerMove = (event) => {
    if (dragSizeRef.current === null) return;
    dragSizeRef.current = sizeFromPointer(event.clientX);
    applySize(dragSizeRef.current);
  };

  const handlePointerUp = (event) => {
    if (dragSizeRef.current === null) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const finalSize = dragSizeRef.current;
    dragSizeRef.current = null;
    onSizeChange(finalSize);
  };

  const handleKeyDown = (event) => {
    let next;
    if (event.key === "ArrowLeft") next = size - KEYBOARD_STEP;
    else if (event.key === "ArrowRight") next = size + KEYBOARD_STEP;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    else return;
    event.preventDefault();
    onSizeChange(clamp(next, min, max));
  };

  if (!enabled) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        {left && <Box sx={{ minWidth: 0, overflow: "hidden" }}>{left}</Box>}
        {right && <Box sx={{ minWidth: 0, overflow: "hidden" }}>{right}</Box>}
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      style={{ "--split-size": `${size}%` }}
      sx={{ display: "flex", flexDirection: "row", width: "100%", minWidth: 0 }}
    >
      <Box
        sx={{
          flex: `0 0 calc(var(--split-size) - ${HANDLE_WIDTH / 2}px)`,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {left}
      </Box>
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize players and logs panels"
        aria-valuenow={Math.round(size)}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        title="Drag to resize, double-click to reset"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={() => onSizeChange(defaultSize)}
        onKeyDown={handleKeyDown}
        sx={{
          flex: `0 0 ${HANDLE_WIDTH}px`,
          cursor: "col-resize",
          touchAction: "none",
          position: "relative",
          outline: "none",
          "&::after": {
            content: '""',
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: "2px",
            transform: "translateX(-50%)",
            bgcolor: "divider",
            opacity: 0,
            transition: "opacity 150ms",
          },
          "&:hover::after, &:focus-visible::after, &:active::after": {
            opacity: 1,
            bgcolor: "primary.main",
          },
        }}
      />
      <Box sx={{ flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
        {right}
      </Box>
    </Box>
  );
}
