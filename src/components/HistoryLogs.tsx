import { useState } from "react";
import { ScanResult, Unit } from "../types";
import { Trash2, Download, Search, Tag, Eye, Layers } from "lucide-react";

interface HistoryLogsProps {
  logs: ScanResult[];
  onSelect: (scan: ScanResult) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  unit: Unit;
}

export default function HistoryLogs({ logs, onSelect, onDelete, onClearAll, unit }: HistoryLogsProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const formatValue = (valInMm: number, targetUnit: Unit): string => {
    switch (targetUnit) {
      case Unit.CM:
        return (valInMm / 10).toFixed(1) + " cm";
      case Unit.INCH:
        return (valInMm / 25.4).toFixed(2) + " in";
      case Unit.MM:
      default:
        return valInMm.toFixed(0) + " mm";
    }
  };

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.label.toLowerCase().includes(term) ||
      log.detectedType.toLowerCase().includes(term) ||
      log.detectedPaperColor.toLowerCase().includes(term)
    );
  });

  // Export logs to a standard format CSV file
  const exportToCSV = () => {
    if (logs.length === 0) return;

    const headers = ["Label", "Type", "Color", "Length (mm)", "Width (mm)", "Thickness (mm)", "Confidence Score", "Calibration Reference Used", "Date Scanned", "Explanation"];
    const rows = logs.map((log) => [
      `"${log.label.replace(/"/g, '""')}"`,
      `"${log.detectedType.replace(/"/g, '""')}"`,
      `"${log.detectedPaperColor.replace(/"/g, '""')}"`,
      log.lengthMm,
      log.widthMm,
      log.thicknessMm,
      log.confidenceScore,
      `"${log.referenceUsed.replace(/"/g, '""')}"`,
      new Date(log.timestamp).toLocaleString(),
      `"${log.explanation.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Paper_Scan_Ruler_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
            <Layers className="w-4.5 h-4.5 text-zinc-800" />
            Scan Log Repository ({logs.length})
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Archive list of physical document measures</p>
        </div>

        {logs.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              id="export-csv-btn"
              onClick={exportToCSV}
              className="text-xs flex items-center gap-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-200 transition font-medium"
              title="Export scanning table to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              id="clear-all-btn"
              onClick={() => {
                if (confirm("Are you sure you want to purge all scanned records?")) {
                  onClearAll();
                }
              }}
              className="text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-3 py-1.5 rounded-lg transition font-medium"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {logs.length > 0 ? (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              id="history-search-input"
              type="text"
              placeholder="Search by label, paper color, folder type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 focus:border-zinc-400 rounded-xl text-zinc-800 placeholder-zinc-400 focus:outline-none transition"
            />
          </div>

          {/* List display */}
          <div className="max-h-[340px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="group relative bg-zinc-50/50 hover:bg-zinc-100/60 border border-zinc-200/80 hover:border-zinc-350 rounded-xl p-3 flex gap-3.5 transition cursor-pointer shadow-sm"
                  onClick={() => onSelect(log)}
                >
                  {/* Photo thumbnail */}
                  <div className="w-14 h-14 bg-zinc-50 rounded-lg border border-zinc-200 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner">
                    {log.snapshotUrl ? (
                      <img
                        src={log.snapshotUrl}
                        alt={log.label}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Layers className="w-5 h-5 text-zinc-300" />
                    )}
                  </div>

                  {/* Metadata and readings */}
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-zinc-800 truncate group-hover:text-zinc-950 transition animate-fade-in">
                        {log.label}
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded">
                        {log.detectedType}
                      </span>
                    </div>

                    <p className="text-[10px] text-zinc-500 truncate mb-1">
                      Color Hue: <span className="text-zinc-700 font-medium">{log.detectedPaperColor}</span> • Calib: {log.referenceUsed}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-600 font-mono font-bold">
                      <span title="Length">L: {formatValue(log.lengthMm, unit)}</span>
                      <span className="text-zinc-300">•</span>
                      <span title="Width">W: {formatValue(log.widthMm, unit)}</span>
                      <span className="text-zinc-300">•</span>
                      <span className="text-emerald-600" title="Thickness">T: {formatValue(log.thicknessMm, unit)}</span>
                    </div>
                  </div>

                  {/* Quick overlay buttons */}
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-80 sm:opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(log);
                      }}
                      className="p-1.5 bg-zinc-50 hover:bg-zinc-200 text-zinc-700 rounded-lg border border-zinc-200"
                      title="Load metric visualizer details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(log.id);
                      }}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200"
                      title="Delete scan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-zinc-400 font-mono">
                No logs match your search tags.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-zinc-200 rounded-xl p-10 text-center text-zinc-400 text-xs bg-zinc-50/20">
          <Layers className="w-8 h-8 text-zinc-300 mx-auto mb-2 opacity-65 animate-pulse" />
          <p className="font-semibold text-zinc-700">No processed scans currently logged.</p>
          <p className="text-[10px] text-zinc-400 mt-1">Calibrate and capture paper measures above to establish logs.</p>
        </div>
      )}
    </div>
  );
}
