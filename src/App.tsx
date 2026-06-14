import { useState, useEffect } from "react";
import { Ruler, Activity, Sparkles, Clock, HelpCircle, Layers, CheckCircle } from "lucide-react";
import CameraRuler from "./components/CameraRuler";
import Dimension3DBox from "./components/Dimension3DBox";
import MetricCards from "./components/MetricCards";
import HistoryLogs from "./components/HistoryLogs";
import { ScanResult, Unit } from "./types";

export default function App() {
  const [logs, setLogs] = useState<ScanResult[]>([]);
  const [activeScan, setActiveScan] = useState<ScanResult | null>(null);
  const [unit, setUnit] = useState<Unit>(Unit.MM);

  // Load logs index from LocalStorage on mount
  useEffect(() => {
    const cachedScans = localStorage.getItem("paper_ruler_scans");
    if (cachedScans) {
      try {
        const parsed = JSON.parse(cachedScans);
        setLogs(parsed);
        if (parsed.length > 0) {
          setActiveScan(parsed[0]); // Load latest document scan into visualizer
        }
      } catch (err) {
        console.error("Failed to parse cached local scans:", err);
      }
    }
  }, []);

  // Update localStorage when logs mutate
  const saveLogs = (updatedLogs: ScanResult[]) => {
    setLogs(updatedLogs);
    localStorage.setItem("paper_ruler_scans", JSON.stringify(updatedLogs));
  };

  const handleScanCompleted = (newScan: ScanResult) => {
    const updated = [newScan, ...logs];
    saveLogs(updated);
    setActiveScan(newScan); // Auto-focus active result
  };

  const handleDeleteLog = (id: string) => {
    const updated = logs.filter((log) => log.id !== id);
    saveLogs(updated);
    if (activeScan?.id === id) {
      setActiveScan(updated.length > 0 ? updated[0] : null);
    }
  };

  const handleClearAllLogs = () => {
    saveLogs([]);
    setActiveScan(null);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans selection:bg-emerald-500/10 selection:text-emerald-800">
      
      {/* 1. Header Navigation Rail */}
      <header className="border-b border-zinc-100 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Logo / Brand block */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black hover:bg-zinc-800 text-white rounded-lg flex items-center justify-center shadow-sm transition-colors">
              <Ruler className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-zinc-900 tracking-tight">RAMSOptiMeasure</h1>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full border border-zinc-200">
                  v2.4
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Tactile folder & document metric micro-ruler</p>
            </div>
          </div>

          {/* Time & Client metadata HUD indicators */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
            <div className="hidden md:flex items-center gap-2 bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200/60 text-zinc-600">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>UTC: 2026-06-14</span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200/60 text-zinc-600">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="font-semibold uppercase tracking-widest text-[9px]">SENSOR ACTIVE</span>
            </div>
          </div>

        </div>
      </header>

      {/* 2. Main Dashboard Layout Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        
        {/* Help Info Quick Banner */}
        <div className="bg-zinc-100 border border-zinc-200/80 rounded-2xl p-4 sm:p-5 flex gap-3 text-xs leading-relaxed text-zinc-600 shadow-sm">
          <HelpCircle className="w-5 h-5 text-zinc-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-zinc-800 block">How does camera tracking work without physical markers?</span>
            <p className="text-[11px] text-zinc-500 leading-normal">
              For metric accuracy, place a <strong className="text-zinc-800">Standard Credit Card</strong> or <strong className="text-zinc-800">Quarter Coin</strong> flat next to your target sheet or folder. This calibration is mapped dynamically against pixels to factor out camera lens warping and distance, resolving exact width, length, and depth thickness!
            </p>
          </div>
        </div>

        {/* Primary Row: Camera Scanning Frame & Config parameters */}
        <section id="scanning-frame-section">
          <CameraRuler
            onScanCompleted={handleScanCompleted}
            unit={unit}
            onUnitChange={setUnit}
          />
        </section>

        {/* Secondary Row: Active Scan Projection details and bento metric analytics card */}
        <section id="active-metrics-section" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Active Result Analytics (Cols: 7) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {activeScan ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-6 shadow-sm h-full flex flex-col justify-between">
                <div className="space-y-5">
                  
                  {/* Result Title Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b border-zinc-100 pb-3.5 gap-3">
                    <div className="min-w-0 pr-0 sm:pr-4">
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider font-mono">Real-time Analysis</span>
                      <h2 className="text-lg font-bold text-zinc-900 truncate mt-0.5">{activeScan.label}</h2>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500 mt-1">
                        <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-250">
                          {activeScan.detectedType}
                        </span>
                        <span>•</span>
                        <span>Scanned {new Date(activeScan.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start flex-shrink-0 text-left sm:text-right border-t sm:border-t-0 border-zinc-100 sm:pt-0 pt-2.5 w-full sm:w-auto">
                      <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold leading-none bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Conf: {(activeScan.confidenceScore * 100).toFixed(0)}%</span>
                      </div>
                      <span className="text-[9px] text-zinc-400 mt-1 font-mono">Calib: {activeScan.referenceUsed}</span>
                    </div>
                  </div>

                  {/* Calculated metrics table specs */}
                  <MetricCards
                    lengthMm={activeScan.lengthMm}
                    widthMm={activeScan.widthMm}
                    thicknessMm={activeScan.thicknessMm}
                    unit={unit}
                  />

                  {/* Gemini Vision reasoning explanation commentary banner */}
                  <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200/60 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-bold uppercase font-mono tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Object Inference Analysis</span>
                    </div>
                    <p className="text-xs text-zinc-600 leading-relaxed italic">
                      "{activeScan.explanation}"
                    </p>
                  </div>

                </div>
              </div>
            ) : (
              <div className="bg-white border border-dashed border-zinc-300 rounded-2xl p-10 h-full flex flex-col items-center justify-center text-center text-zinc-400 min-h-[360px] shadow-sm">
                <Ruler className="w-12 h-12 text-zinc-300 animate-pulse mb-3" />
                <h4 className="text-sm font-semibold text-zinc-700">Measurement Workspace Standby</h4>
                <p className="text-xs text-zinc-500 mt-1.5 max-w-sm leading-relaxed">
                  Place a calibration scaling item, align your document in grid crosshairs, and capture to display real-time 3D blueprint metrics.
                </p>
              </div>
            )}
          </div>

          {/* Draggable 3D interactive Box space projection (Cols: 5) */}
          <div className="lg:col-span-5">
            {activeScan ? (
              <Dimension3DBox
                lengthMm={activeScan.lengthMm}
                widthMm={activeScan.widthMm}
                thicknessMm={activeScan.thicknessMm}
                detectedColor={activeScan.detectedPaperColor}
                detectedType={activeScan.detectedType}
              />
            ) : (
              <div className="bg-white border border-dashed border-zinc-300 rounded-2xl h-full flex flex-col items-center justify-center text-center p-8 text-zinc-400 min-h-[300px] shadow-sm">
                <Layers className="w-10 h-10 text-zinc-200 mb-2 opacity-60" />
                <span className="text-xs text-zinc-400">3D Orthogonal Hologram Previewer</span>
              </div>
            )}
          </div>

        </section>

        {/* Historic logs scanning index section */}
        <section id="historical-database-section">
          <HistoryLogs
            logs={logs}
            onSelect={setActiveScan}
            onDelete={handleDeleteLog}
            onClearAll={handleClearAllLogs}
            unit={unit}
          />
        </section>

      </main>

      {/* 3. Footer Branding */}
      <footer className="border-t border-zinc-200 bg-white py-8 px-6 mt-12 text-center text-xs text-zinc-500 shadow-inner">
        <p>Paper Scan Ruler • Powered by Google AI Studio Server-Side Advanced Vision Modeling.</p>
        <p className="text-[10px] text-zinc-400 mt-1">Compiled securely via standard sandbox container protocols.</p>
      </footer>

    </div>
  );
}
