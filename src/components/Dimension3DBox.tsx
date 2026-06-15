import React, { useState, useRef } from "react";

interface Dimension3DBoxProps {
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  detectedColor: string;
  detectedType: string;
}

export default function Dimension3DBox({
  lengthMm,
  widthMm,
  thicknessMm,
  detectedColor,
  detectedType,
}: Dimension3DBoxProps) {
  const [rotation, setRotation] = useState({ x: -25, y: -45 });
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });

  // Dynamically translate detected colors into Tailwind or standard inline CSS hex/RGB colors
  const parseDetectedColor = (colorStr: string): string => {
    const c = colorStr.toLowerCase();
    if (c.includes("manila") || c.includes("cream") || c.includes("beige") || c.includes("yellow")) {
      return "rgba(240, 220, 175, 0.95)";
    }
    if (c.includes("blue") || c.includes("azure")) {
      return "rgba(147, 197, 253, 0.95)";
    }
    if (c.includes("red") || c.includes("crimson")) {
      return "rgba(252, 165, 165, 0.95)";
    }
    if (c.includes("green") || c.includes("emerald")) {
      return "rgba(110, 231, 183, 0.95)";
    }
    if (c.includes("black") || c.includes("dark") || c.includes("charcoal")) {
      return "rgba(63, 63, 70, 0.95)";
    }
    if (c.includes("white") || c.includes("light") || c.includes("gray")) {
      return "rgba(244, 244, 245, 0.95)";
    }
    return "rgba(228, 228, 231, 0.95)"; // Slate/Zinc fallback
  };

  const folderColor = parseDetectedColor(detectedColor);

  // Normalize scale factor so that max size of Length or Width is roughly 180px
  const maxAxis = Math.max(lengthMm, widthMm);
  const scale = 180 / (maxAxis || 1);
  const w = Math.max(widthMm * scale, 15);  // Width of the face
  const l = Math.max(lengthMm * scale, 30); // Depth/Length of the face
  const t = Math.max(thicknessMm * scale, 4);   // Height/Thickness of edge (minimum 4px for sheets)

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    setRotation((prev) => ({
      x: Math.min(Math.max(prev.x - deltaY * 1.0, -90), 90),
      y: prev.y + deltaX * 1.0,
    }));

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      isDragging.current = true;
      previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || !e.touches || !e.touches[0]) return;
    const deltaX = e.touches[0].clientX - previousMousePosition.current.x;
    const deltaY = e.touches[0].clientY - previousMousePosition.current.y;

    setRotation((prev) => ({
      x: Math.min(Math.max(prev.x - deltaY * 1.0, -90), 90),
      y: prev.y + deltaX * 1.0,
    }));

    previousMousePosition.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  return (
    <div className="w-full flex flex-col items-center justify-center py-6 bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
      <div className="text-center mb-4">
        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-800 font-mono">Tactile 3D Projection</h4>
        <p className="text-[11px] text-zinc-400 mt-0.5">Drag blueprint to inspect paper thickness profiles</p>
      </div>

      <div
        id="3d-canvas-container"
        className="relative w-full h-[260px] bg-zinc-50 border border-zinc-100 rounded-xl flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ perspective: "1000px" }}
      >
        <div
          className="relative transition-transform duration-100 ease-out"
          style={{
            width: `${w}px`,
            height: `${t}px`, // This is the vertical thickness
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          }}
        >
          {/* TOP FACE */}
          <div
            className="absolute rounded-sm border border-black/10 flex flex-col justify-between p-2 shadow-inner"
            style={{
              width: `${w}px`,
              height: `${l}px`,
              background: folderColor,
              transform: `rotateX(90deg) translateZ(${l / 2}px)`,
              transformOrigin: "top center",
              top: "0px",
              left: "0px",
              boxShadow: "inset 0 0 15px rgba(255,255,255,0.4)",
            }}
          >
            <div className="flex justify-between w-full">
              <span className="text-[9px] font-mono font-bold text-zinc-800/80">L: {lengthMm.toFixed(1)} mm</span>
              <span className="text-[9px] font-mono font-bold text-zinc-800/80">W: {widthMm.toFixed(1)} mm</span>
            </div>
            <div className="self-center">
              <span className="text-[10px] font-bold font-sans tracking-wide text-center text-zinc-800/90 line-clamp-1">
                {detectedType}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[8px] font-mono text-zinc-400">OptiMeasure</span>
            </div>
          </div>

          {/* FRONT FACE (Thickness height aspect) */}
          <div
            className="absolute border border-black/10"
            style={{
              width: `${w}px`,
              height: `${t}px`,
              background: folderColor,
              filter: "brightness(0.85)",
              transform: `translateZ(${l / 2}px)`,
              top: "0px",
              left: "0px",
            }}
          >
            {/* Display thickness measure on front edge if visible enough */}
            {t > 15 && (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[8px] font-mono font-bold text-zinc-800/90">T: {thicknessMm.toFixed(1)} mm</span>
              </div>
            )}
          </div>

          {/* BACK FACE */}
          <div
            className="absolute border border-black/5"
            style={{
              width: `${w}px`,
              height: `${t}px`,
              background: folderColor,
              filter: "brightness(0.6)",
              transform: `rotateY(180deg) translateZ(${l / 2}px)`,
              top: "0px",
              left: "0px",
            }}
          />

          {/* LEFT FACE (Width depth thickness panel) */}
          <div
            className="absolute border border-black/5"
            style={{
              width: `${l}px`,
              height: `${t}px`,
              background: folderColor,
              filter: "brightness(0.7)",
              transform: `rotateY(-90deg) translateZ(${w / 2}px)`,
              transformOrigin: "top left",
              top: "0px",
              left: "0px",
            }}
          />

          {/* RIGHT FACE */}
          <div
            className="absolute border border-black/5"
            style={{
              width: `${l}px`,
              height: `${t}px`,
              background: folderColor,
              filter: "brightness(0.8)",
              transform: `rotateY(90deg) translateZ(${w - w / 2}px)`,
              transformOrigin: "top left",
              top: "0px",
              left: "0px",
            }}
          />

          {/* BOTTOM FACE */}
          <div
            className="absolute border border-black/5"
            style={{
              width: `${w}px`,
              height: `${l}px`,
              background: folderColor,
              filter: "brightness(0.5)",
              transform: `rotateX(-90deg) translateZ(${t - l / 2}px)`,
              transformOrigin: "top center",
              top: "0px",
              left: "0px",
            }}
          />
        </div>
      </div>

      <div className="w-full flex justify-between px-2 text-[10px] font-mono text-zinc-500 border-t border-zinc-200 pt-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-zinc-300 shadow-sm" style={{ backgroundColor: folderColor }} />
          <span>Color: {detectedColor}</span>
        </div>
        <div>
          <span>Scale: {scale.toFixed(2)}x</span>
        </div>
      </div>
    </div>
  );
}
