import { useState } from "react";
import { Unit } from "../types";
import { Scale, Layers, Weight, RefreshCw, Layers3, Activity } from "lucide-react";

interface MetricCardsProps {
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  unit: Unit;
}

export default function MetricCards({ lengthMm, widthMm, thicknessMm, unit }: MetricCardsProps) {
  const [paperGsm, setPaperGsm] = useState<number>(80); // Default standard office paper GSM

  // Convert mm values to chosen display unit
  const formatValue = (valInMm: number, targetUnit: Unit): string => {
    switch (targetUnit) {
      case Unit.CM:
        return (valInMm / 10).toFixed(2) + " cm";
      case Unit.INCH:
        return (valInMm / 25.4).toFixed(2) + " in";
      case Unit.MM:
      default:
        return valInMm.toFixed(1) + " mm";
    }
  };

  // 1. Calculate Standard Format Matches
  const findFormatMatch = (l: number, w: number): { formatName: string; desc: string } => {
    const longer = Math.max(l, w);
    const shorter = Math.min(l, w);

    // Tolerance of 10mm for flexible real-world lens warp / perspective errors
    const approxEqual = (v1: number, v2: number, tol = 12) => Math.abs(v1 - v2) <= tol;

    if (approxEqual(longer, 297, 10) && approxEqual(shorter, 210, 10)) {
      return { formatName: "ISO A4 Document", desc: "Standard European & International print size (297 x 210 mm)" };
    }
    if (approxEqual(longer, 279.4, 10) && approxEqual(shorter, 215.9, 10)) {
      return { formatName: "US Letter Document", desc: "Standard North American print size (279.4 x 215.9 mm)" };
    }
    if (approxEqual(longer, 355.6, 12) && approxEqual(shorter, 215.9, 10)) {
      return { formatName: "US Legal Paper", desc: "Long official legal document size (355.6 x 215.9 mm)" };
    }
    if (approxEqual(longer, 210, 8) && approxEqual(shorter, 148, 8)) {
      return { formatName: "ISO A5 Booklet", desc: "Perfect notebook / half-A4 booklet size (210 x 148 mm)" };
    }
    if (approxEqual(longer, 420, 15) && approxEqual(shorter, 297, 12)) {
      return { formatName: "ISO A3 Ledger", desc: "Double A4 presentation poster or ledger size (420 x 297 mm)" };
    }
    if (approxEqual(longer, 88.9, 6) && approxEqual(shorter, 50.8, 6)) {
      return { formatName: "Standard Business Card", desc: "North American standard business scale (88.9 x 50.8 mm)" };
    }
    if (approxEqual(longer, 85.6, 6) && approxEqual(shorter, 53.98, 6)) {
      return { formatName: "ID/Credit Card Scale", desc: "Common ISO CR80 plastic card size (85.6 x 54 mm)" };
    }

    const aspect = longer / (shorter || 1);
    return {
      formatName: `Custom Document Form`,
      desc: `Aspect ratio ${aspect.toFixed(2)}:1 (Non-standard office outline dimensions)`
    };
  };

  const formatMatch = findFormatMatch(lengthMm, widthMm);

  // 2. Extrapolate page count based on average thickness of 80gsm standard paper (approx 0.1mm per sheet)
  const calculatePageCount = (tMm: number): number => {
    // 1 sheet = 0.1mm. If thickness is less than standard single sheet, round up to 1
    if (tMm <= 0.12) return 1;
    return Math.max(1, Math.round(tMm / 0.1));
  };
  const estPageCount = calculatePageCount(thicknessMm);

  // 3. Weight Extrapolator: L(m) * W(m) * GSM * SheetCount(or 1) / 1000 to get grams
  const calculateWeightGrams = (lMm: number, wMm: number, tMm: number, gsm: number): number => {
    const areaM2 = (lMm / 1000) * (wMm / 1000);
    // If it is a folder, its cardboard itself has high cardstock weight (around 250 - 300 gsm).
    // Let's assume folder density is at least 250 gsm if sheet count is 1 but thickness is folder-like (e.g. >0.3mm)
    const activeGsm = (tMm > 0.25 && estPageCount === 1) ? 260 : gsm;
    const sheets = Math.max(1, estPageCount);
    return areaM2 * activeGsm * sheets;
  };
  const estWeightGrams = calculateWeightGrams(lengthMm, widthMm, thicknessMm, paperGsm);

  // Calculations
  const surfaceAreaSqCm = (lengthMm / 10) * (widthMm / 10);
  const perimeterCm = ((lengthMm + widthMm) * 2) / 10;
  const aspectRatio = lengthMm / (widthMm || 1);

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Quick Measurements Banner */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Length</div>
          <div className="text-base font-bold text-zinc-900 mt-1 font-mono">
            {formatValue(lengthMm, unit)}
          </div>
        </div>
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Width</div>
          <div className="text-base font-bold text-zinc-900 mt-1 font-mono">
            {formatValue(widthMm, unit)}
          </div>
        </div>
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 shadow-sm">
          <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Thickness</div>
          <div className="text-base font-bold text-emerald-600 mt-1 font-mono">
            {formatValue(thicknessMm, unit)}
          </div>
        </div>
      </div>

      {/* Format Detection Details */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="bg-zinc-100 rounded-lg p-2 border border-zinc-200 text-zinc-700">
            <Scale id="scale-icon" className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-zinc-400 font-medium font-mono">STANDARD CLASS SIZE</div>
            <div className="text-sm font-bold text-zinc-800 mt-0.5">{formatMatch.formatName}</div>
            <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2">{formatMatch.desc}</p>
          </div>
        </div>
      </div>

      {/* Geometry and Page Density Estimates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Thickness Conversion */}
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Layers id="layers-icon" className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-zinc-700 font-mono uppercase tracking-wider">Thickness Estimation</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-zinc-500">Measured depth:</span>
              <span className="text-xs font-semibold text-zinc-700 font-mono">{thicknessMm.toFixed(2)} mm</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-zinc-500">Equivalent capacity:</span>
              <span className="text-sm font-bold text-emerald-600 font-mono">
                ~{estPageCount} {estPageCount === 1 ? "sheet" : "sheets"}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-zinc-400 mt-2 italic leading-relaxed border-t border-zinc-100 pt-1.5">
            *Based on standard office card stock folders (~0.4mm) or standard individual printer sheets (~0.1mm/sheet).
          </p>
        </div>

        {/* Dynamic Weight Extrapolation */}
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Weight id="weight-icon" className="w-4 h-4 text-zinc-700" />
              <span className="text-xs font-bold text-zinc-700 font-mono uppercase tracking-wider">Postage Weight Extrapolator</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mb-3 bg-white p-1.5 rounded-lg border border-zinc-200/80">
            <span className="text-[10px] text-zinc-400 font-medium pl-1">Paper Grade:</span>
            <select
              id="gsm-select"
              value={paperGsm}
              onChange={(e) => setPaperGsm(Number(e.target.value))}
              className="text-[11px] bg-zinc-50 border border-zinc-200 text-zinc-800 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-zinc-450"
            >
              <option value="70">70 GSM (Thin print)</option>
              <option value="80">80 GSM (Standard Copy)</option>
              <option value="100">100 GSM (Premium Letter)</option>
              <option value="120">120 GSM (Light card)</option>
              <option value="250">250 GSM (Index Card/Folder)</option>
            </select>
          </div>

          <div className="space-y-1 bg-zinc-100 p-2.5 rounded-lg border border-zinc-200/60">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-zinc-500">Estimated Weight:</span>
              <span className="text-sm font-bold text-zinc-800 font-mono">
                {estWeightGrams.toFixed(2)} g
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-zinc-500">US Postage ounces:</span>
              <span className="text-xs font-semibold text-zinc-650 font-mono">
                {(estWeightGrams * 0.035274).toFixed(3)} oz
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Surface Geometry Details */}
      <div className="bg-zinc-100/60 border border-zinc-200 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs font-mono">
        <div>
          <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-sans font-medium">Surface Area</div>
          <div className="text-zinc-700 font-semibold mt-0.5">{surfaceAreaSqCm.toFixed(1)} cm²</div>
        </div>
        <div>
          <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-sans font-medium">Perimeter</div>
          <div className="text-zinc-700 font-semibold mt-0.5">{perimeterCm.toFixed(1)} cm</div>
        </div>
        <div>
          <div className="text-[9px] text-zinc-400 uppercase tracking-wider font-sans font-medium">Aspect Ratio</div>
          <div className="text-zinc-700 font-semibold mt-0.5">{aspectRatio.toFixed(2)} : 1</div>
        </div>
      </div>
    </div>
  );
}
