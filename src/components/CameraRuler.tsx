import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Zap, Sliders, Info, Cpu, Check, AlertTriangle, EyeOff, Upload } from "lucide-react";
import { ReferenceObject, ScanResult, Unit } from "../types";

// Standard calibration objects
const REFERENCE_OBJECTS: ReferenceObject[] = [
  {
    id: "credit-card",
    name: "Credit / Membership Card",
    widthMm: 85.6,
    heightMm: 53.98,
    category: "card",
    description: "Align a standard plastic card flat next to the document."
  },
  {
    id: "quarter-coin",
    name: "Standard Coin (US Quarter)",
    widthMm: 24.26,
    heightMm: 24.26,
    category: "coin",
    description: "Place a standard quarter or comparative coin next to the target."
  },
  {
    id: "a4-sheet",
    name: "Standard A4 Sheet",
    widthMm: 297,
    heightMm: 210,
    category: "stationery",
    description: "Place standard flat A4 copy paper (297 x 210mm) nearby."
  },
  {
    id: "us-letter",
    name: "Standard US Letter Sheet",
    widthMm: 279.4,
    heightMm: 215.9,
    category: "stationery",
    description: "Place standard flat Letter print paper (279.4 x 215.9mm) nearby."
  },
  {
    id: "pen-pencil",
    name: "Standard Pen/Pencil",
    widthMm: 150,
    heightMm: 8,
    category: "stationery",
    description: "Place a typical 15cm pencil/ballpoint pen as a scale guide."
  },
  {
    id: "none",
    name: "No Reference (AI Spatial Cueing)",
    widthMm: 0,
    heightMm: 0,
    category: "none",
    description: "No calibration target. Gemini estimates sizes using desk items and pixel cues."
  }
];

const MATERIAL_HINTS = [
  "Standard Paper Sheet",
  "Manila Filing Folder",
  "Cardstock Folder / Envelope",
  "Thick Document Stack",
  "Standard Spiral Notebook",
  "Heavy 3-Ring Spine Binder"
];

interface CameraRulerProps {
  onScanCompleted: (result: ScanResult & { rawScan: boolean }) => void;
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
}

export default function CameraRuler({ onScanCompleted, unit, onUnitChange }: CameraRulerProps) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [streamActive, setStreamActive] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [enableHudEffects, setEnableHudEffects] = useState<boolean>(true);
  const [customLabel, setCustomLabel] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  
  // Real-time Auto-Sense continuous measuring parameter states
  const [isAutoActive, setIsAutoActive] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(4);

  const [selectedReference, setSelectedReference] = useState<string>("credit-card");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("Manila Filing Folder");
  const [calibrationGuidelines, setCalibrationGuidelines] = useState<string>(
    REFERENCE_OBJECTS[0].description
  );
  const [errorText, setErrorText] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);

  const processFileImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorText("Only image files are supported for physical document measurement dimensioning.");
      return;
    }
    setErrorText("");
    setIsMeasuring(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Image = e.target?.result as string;
      if (!base64Image) {
        setErrorText("Could not read image file data.");
        setIsMeasuring(false);
        return;
      }

      try {
        const response = await fetch("/api/measure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64Image,
            referenceId: selectedReference,
            materialHint: selectedMaterial
          })
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.error || "Measurement pipeline returned an operational error.");
        }

        const tagLabel = customLabel.trim() || `Scan ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

        const completedScan: ScanResult & { rawScan: boolean } = {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          label: tagLabel,
          lengthMm: responseData.lengthMm,
          widthMm: responseData.widthMm,
          thicknessMm: responseData.thicknessMm,
          confidenceScore: responseData.confidenceScore,
          detectedPaperColor: responseData.detectedPaperColor || "Standard White",
          detectedType: responseData.detectedType || selectedMaterial,
          explanation: responseData.explanation || "Measurement modeled correctly.",
          referenceUsed: REFERENCE_OBJECTS.find((o) => o.id === selectedReference)?.name || "None",
          snapshotUrl: base64Image,
          rawScan: true
        };

        setCustomLabel("");
        onScanCompleted(completedScan);
      } catch (err: any) {
        console.error(err);
        setErrorText(err.message || "Network exception talking to measurement backend.");
      } finally {
        setIsMeasuring(false);
      }
    };
    reader.onerror = () => {
      setErrorText("File reader error while decoding snapshot.");
      setIsMeasuring(false);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFileImage(e.target.files[0]);
    }
  };

  // Initialize and list cameras
  useEffect(() => {
    async function listCameras() {
      try {
        // Request visual permission first so we get fully populated device labels
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true });
        initialStream.getTracks().forEach((track) => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((device) => device.kind === "videoinput");
        setCameras(videoDevices);
        setCameraPermissionState('granted');

        if (videoDevices.length > 0) {
          // Prefer back camera ('environment') if present for desktop objects scanning
          const backCam = videoDevices.find(
            (cam) => cam.label.toLowerCase().includes("back") || cam.label.toLowerCase().includes("environment")
          );
          setSelectedCameraId(backCam ? backCam.deviceId : videoDevices[0].deviceId);
        }
      } catch (err: any) {
        console.warn("Camera stream listing is offline. Manual doc uploads or drag-and-drop are enabled.", err?.message || err);
        setCameraPermissionState('denied');
      }
    }

    listCameras();

    return () => {
      stopCameraStream();
    };
  }, []);

  // Sync camera source on selection update
  useEffect(() => {
    if (selectedCameraId) {
      startCameraStream(selectedCameraId);
    }
  }, [selectedCameraId]);

  // Sync selection instructions and reset countdown
  useEffect(() => {
    const selectedObj = REFERENCE_OBJECTS.find((o) => o.id === selectedReference);
    if (selectedObj) {
      setCalibrationGuidelines(selectedObj.description);
    }
    if (streamActive && isAutoActive) {
      setCountdown(4); // Reset to 4 seconds to allow the user to settle the item under the new guidelines
    }
  }, [selectedReference, selectedMaterial, streamActive, isAutoActive]);

  // Automated real-time measurement loop
  useEffect(() => {
    if (!streamActive || !isAutoActive || isMeasuring) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger automatic scan
          captureSnapshotAndMeasure();
          return 8; // Reset countdown to 8 seconds for the next loop
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [streamActive, isAutoActive, isMeasuring]);

  const startCameraStream = async (deviceId: string) => {
    setIsInitializing(true);
    setErrorText("");
    stopCameraStream();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: deviceId ? undefined : "environment"
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      currentStreamRef.current = stream;
      setCameraPermissionState('granted');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamActive(true);
      }

      // Start the animated scanline & edge detection render loop
      if (enableHudEffects) {
        startHudProcessor();
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || err.message?.toLowerCase().includes("denied") || err.message?.toLowerCase().includes("dismissed")) {
        console.warn("Camera stream startup declined by user/browser. File drop mode active.");
        setCameraPermissionState('denied');
      } else {
        console.warn("Camera stream initialization failed:", err?.message || err);
        setErrorText("Camera initialization error. Verify other apps are not lock-holding the video device.");
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCameraStream = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach((track) => track.stop());
      currentStreamRef.current = null;
    }

    setStreamActive(false);
  };

  // 60fps retro science mathematical overlay loop
  const startHudProcessor = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    let scanlineY = 0;
    let scanlineDir = 1;

    const renderLoop = () => {
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      const procCanvas = processingCanvasRef.current;

      if (!video || !overlay || video.paused || video.ended) {
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const pCtx = procCanvas?.getContext("2d");
      const ctx = overlay.getContext("2d");

      if (ctx) {
        // Sync dimensions matching video aspect
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
          overlay.width = video.videoWidth;
          overlay.height = video.videoHeight;
          if (procCanvas) {
            procCanvas.width = 160; // downsampled processing dimension for fast JS filter
            procCanvas.height = 90;
          }
        }

        ctx.clearRect(0, 0, overlay.width, overlay.height);

        // 1. Draw central scanning crosshair
        const cx = overlay.width / 2;
        const cy = overlay.height / 2;
        ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
        ctx.lineWidth = 1.5;

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy); ctx.lineTo(cx - 10, cy);
        ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 30, cy);
        ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy - 10);
        ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + 30);
        ctx.stroke();

        ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
        ctx.strokeRect(cx - 8, cy - 8, 16, 16);

        // 2. Draw Calibration Align Guidelines box depending on the selected reference
        if (selectedReference === "credit-card") {
          const cardW = overlay.width * 0.32;
          const cardH = cardW * (53.98 / 85.6);
          const rx = overlay.width * 0.12;
          const ry = overlay.height * 0.15;

          ctx.strokeStyle = "rgba(16, 185, 129, 0.75)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.strokeRect(rx, ry, cardW, cardH);
          ctx.setLineDash([]);

          ctx.fillStyle = "rgba(16, 185, 129, 0.05)";
          ctx.fillRect(rx, ry, cardW, cardH);

          ctx.fillStyle = "#18181b";
          ctx.font = "bold 12px JetBrains Mono, monospace";
          ctx.fillText("Place Card Inside", rx + 10, ry + 22);
        } else if (selectedReference === "quarter-coin") {
          const coinD = overlay.width * 0.08;
          const rx = overlay.width * 0.15;
          const ry = overlay.height * 0.18;

          ctx.strokeStyle = "rgba(16, 185, 129, 0.75)";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(rx, ry, coinD / 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "rgba(16, 185, 129, 0.05)";
          ctx.fill();

          ctx.fillStyle = "#18181b";
          ctx.font = "bold 11px JetBrains Mono, monospace";
          ctx.fillText("Coin Placement", rx - 45, ry - (coinD / 2) - 8);
        } else if (selectedReference.includes("sheet")) {
          // Sheet guide (A4 / US Letter) - draw relative page ratio box in bottom right
          const sheetRatio = selectedReference === "a4-sheet" ? (210 / 297) : (215.9 / 279.4);
          const boxW = overlay.width * 0.4;
          const boxH = boxW * sheetRatio;
          const rx = overlay.width - boxW - 50;
          const ry = overlay.height - boxH - 50;

          ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(rx, ry, boxW, boxH);
          ctx.fillStyle = "rgba(16, 185, 129, 0.04)";
          ctx.fillRect(rx, ry, boxW, boxH);

          ctx.fillStyle = "#27272a";
          ctx.font = "11px sans-serif";
          ctx.fillText("Reference Page Target Guide", rx + 8, ry + 18);
        }

        // 3. Computer Vision Fast Contour/Edge Simulation
        if (enableHudEffects && pCtx && procCanvas) {
          pCtx.drawImage(video, 0, 0, 160, 90);
          try {
            const frame = pCtx.getImageData(0, 0, 160, 90);
            const data = frame.data;
            const threshold = 28;

            ctx.strokeStyle = "rgba(5, 150, 105, 0.2)";
            ctx.lineWidth = 1;
            ctx.beginPath();

            const scaleX = overlay.width / 160;
            const scaleY = overlay.height / 90;

            // Simple pixel difference detector (high-pass filter)
            for (let y = 1; y < 89; y += 2) {
              for (let x = 1; x < 159; x += 2) {
                const idx = (y * 160 + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const brightness = (r + g + b) / 3;

                // Right neighbor
                const rIdx = idx + 4;
                const rBright = (data[rIdx] + data[rIdx+1] + data[rIdx+2]) / 3;

                // Bottom neighbor
                const bIdx = ((y + 1) * 160 + x) * 4;
                const bBright = (data[bIdx] + data[bIdx+1] + data[bIdx+2]) / 3;

                const dx = Math.abs(brightness - rBright);
                const dy = Math.abs(brightness - bBright);

                if (dx > threshold || dy > threshold) {
                  // Stroke the edge point map back to high-res overlay canvas
                  const screenX = x * scaleX;
                  const screenY = y * scaleY;
                  ctx.rect(screenX - 1, screenY - 1, 2, 2);
                }
              }
            }
            ctx.stroke();
          } catch (e) {
            // Silence sandbox pixel access error exceptions
          }
        }

        // 4. Moving scanning green laser line
        ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
        ctx.fillRect(0, scanlineY - 4, overlay.width, 8);
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, scanlineY);
        ctx.lineTo(overlay.width, scanlineY);
        ctx.stroke();

        // Increment scan line position
        scanlineY += 4 * scanlineDir;
        if (scanlineY >= overlay.height || scanlineY <= 0) {
          scanlineDir *= -1;
        }

        // 5. Draw overlay system text margin metrics
        ctx.fillStyle = "#059669";
        ctx.font = "9px JetBrains Mono, monospace";
        ctx.fillText("LASER TRACKING OVERLAY: STABLE", 20, 25);
        ctx.fillText(`RESOLUTION: ${overlay.width}X${overlay.height}`, 20, 40);
        ctx.fillText(`LATENCY: FILTERING_ACTIVE`, 20, 55);
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameRef.current = requestAnimationFrame(renderLoop);
  };

  async function captureSnapshotAndMeasure() {
    const video = videoRef.current;
    if (!video || !streamActive) {
      setErrorText("Camera stream is not active. Please launch camera first.");
      return;
    }

    setIsMeasuring(true);
    setErrorText("");

    try {
      // 1. Draw current video frame to clean high-res canvas standard snapshot
      const captureCanvas = document.createElement("canvas");
      captureCanvas.width = video.videoWidth || 1280;
      captureCanvas.height = video.videoHeight || 720;

      const cCtx = captureCanvas.getContext("2d");
      if (!cCtx) throw new Error("Could not initialize local snapshot canvas context.");

      cCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
      const base64Image = captureCanvas.toDataURL("image/jpeg", 0.9);

      // 2. Fetch measuring calculation from Express backend
      const response = await fetch("/api/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          referenceId: selectedReference,
          materialHint: selectedMaterial
        })
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Measurement pipeline returned an operational error.");
      }

      // Convert and bubble results
      const tagLabel = customLabel.trim() || `Scan ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

      const completedScan: ScanResult & { rawScan: boolean } = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        label: tagLabel,
        lengthMm: responseData.lengthMm,
        widthMm: responseData.widthMm,
        thicknessMm: responseData.thicknessMm,
        confidenceScore: responseData.confidenceScore,
        detectedPaperColor: responseData.detectedPaperColor || "Standard White",
        detectedType: responseData.detectedType || selectedMaterial,
        explanation: responseData.explanation || "Measurement modeled correctly.",
        referenceUsed: REFERENCE_OBJECTS.find((o) => o.id === selectedReference)?.name || "None",
        snapshotUrl: base64Image,
        rawScan: true
      };

      setCustomLabel(""); // Clear for subsequent scans
      setCountdown(8); // Reset countdown clock post successful auto-sense
      onScanCompleted(completedScan);

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "Network exception talking to measurement backend.");
      setIsAutoActive(false); // Gracefully pause auto-scan if there is an api error
    } finally {
      setIsMeasuring(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
      {/* 1. Video & Canvas Stage Screen (Cols: 7) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              processFileImage(e.dataTransfer.files[0]);
            }
          }}
          className={`relative rounded-2xl border overflow-hidden shadow-inner group flex items-center justify-center min-h-[320px] aspect-video transition-all duration-200 ${
            isDragOver 
              ? "bg-emerald-50 border-emerald-400 border-2 scale-[1.01]" 
              : "bg-zinc-150 border-zinc-200"
          }`}
        >
          {/* Main Video Element */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover rounded-2xl transform"
            style={{ display: streamActive ? "block" : "none" }}
          />

          {/* Real-time analytical SVG / Canvas overlay drawing edge metrics */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none rounded-2xl z-10"
            style={{ display: streamActive && enableHudEffects ? "block" : "none" }}
          />

          {/* Backdrop processor canvas (Hidden from client) */}
          <canvas ref={processingCanvasRef} className="hidden" />

          {/* Hidden Fallback Input Element */}
          <input
            type="file"
            id="fallback-file-upload"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Standby Loader or Inactive Placeholder */}
          {(!streamActive || isInitializing) && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center ${isDragOver ? "bg-emerald-50/90" : "bg-zinc-50"}`}>
              {isInitializing ? (
                <div className="space-y-4">
                  <Cpu className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-zinc-700">Initializing Optics Stream...</p>
                </div>
              ) : isDragOver ? (
                <div className="space-y-4 max-w-sm animate-pulse">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto text-emerald-700 shadow-sm border border-emerald-200">
                    <Upload className="w-8 h-8 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-800">Drop to Start Measurement!</h4>
                    <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
                      Release your image to transmit the snapshot to OptiMeasure AI pipeline.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5 max-w-md p-4">
                  <div className="w-16 h-16 bg-white border border-zinc-200 rounded-2xl flex items-center justify-center mx-auto text-zinc-650 shadow-sm">
                    {cameraPermissionState === "denied" ? (
                      <EyeOff className="w-7 h-7 text-rose-500" />
                    ) : (
                      <Camera className="w-7 h-7 text-zinc-700" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-zinc-800">
                      {cameraPermissionState === "denied" ? "Camera Access Dismissed / Blocked" : "Camera Interface Offline"}
                    </h4>
                    <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                      {cameraPermissionState === "denied"
                        ? "The browser camera permission was dismissed or blocked. Reset the site permissions in your address bar to scan live, or easily upload/drag documents below."
                        : "Grant camera permissions below, OR drag and drop a photocopy/snapshot anywhere in this box to get accurate metrics instantly."}
                    </p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                    {cameraPermissionState !== "denied" && (
                      <>
                        <button
                          id="initiate-cam-btn"
                          onClick={() => {
                            if (selectedCameraId) startCameraStream(selectedCameraId);
                            else startCameraStream("");
                          }}
                          className="text-xs px-5 py-2.5 bg-black hover:bg-zinc-800 text-white font-bold rounded-xl transition shadow-sm cursor-pointer whitespace-nowrap"
                        >
                          Authorize & Boot Lens
                        </button>
                        <span className="text-xs text-zinc-400 font-mono font-medium">or</span>
                      </>
                    )}
                    <label
                      htmlFor="fallback-file-upload"
                      className="text-xs px-5 py-2.5 bg-black hover:bg-zinc-800 text-white font-bold rounded-xl transition shadow-sm cursor-pointer border border-zinc-900 whitespace-nowrap flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Document Photo
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Active Overlay Hud Controls */}
          {streamActive && (
            <>
              <div className="absolute top-4 right-4 z-20 bg-black/85 border border-zinc-800 rounded-xl px-3 py-1.5 flex items-center gap-2 text-[10px] font-mono text-white backdrop-blur-sm shadow-md">
                <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                {isAutoActive ? (
                  <>
                    <span className="font-semibold text-emerald-400">AUTO-SENSE ACTIVE</span>
                    <span className="text-zinc-500">•</span>
                    <span>{isMeasuring ? "Measuring..." : `Next Scan in ${countdown}s`}</span>
                  </>
                ) : (
                  <span className="text-zinc-350">AUTO-SENSE PAUSED</span>
                )}
              </div>
              <div className="absolute bottom-4 left-4 z-20 bg-white/95 border border-zinc-200 rounded-xl px-3 py-1.5 flex items-center gap-2.5 text-[10px] font-mono text-zinc-700 backdrop-blur-sm shadow-sm">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>DEV STREAM ACTIVE</span>
                <span className="text-zinc-300">|</span>
                <button
                  onClick={() => setEnableHudEffects(!enableHudEffects)}
                  className="hover:text-black font-semibold transition"
                >
                  {enableHudEffects ? "Mute HUD Filters" : "Enable HUD Filters"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Camera Selector and System settings strip */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider hidden sm:inline">Source:</span>
            <select
              id="camera-select"
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              disabled={cameras.length === 0}
              className="w-full sm:w-[220px] text-xs bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-xl py-1.5 px-3 focus:outline-none focus:border-zinc-400 font-mono"
            >
              {cameras.length > 0 ? (
                cameras.map((cam, idx) => (
                  <option key={cam.deviceId} value={cam.deviceId}>
                    {cam.label || `Camera Device ${idx + 1}`}
                  </option>
                ))
              ) : (
                <option value="">Upload-Only Mode Activated</option>
              )}
            </select>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {/* Preferred Unit Dropdowns */}
            <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs font-mono font-bold">
              <button
                className={`px-3 py-1 rounded-lg transition ${unit === Unit.MM ? "bg-white text-zinc-950 shadow-sm border border-zinc-250" : "text-zinc-500 hover:text-zinc-800"}`}
                onClick={() => onUnitChange(Unit.MM)}
              >
                mm
              </button>
              <button
                className={`px-3 py-1 rounded-lg transition ${unit === Unit.CM ? "bg-white text-zinc-950 shadow-sm border border-zinc-250" : "text-zinc-500 hover:text-zinc-800"}`}
                onClick={() => onUnitChange(Unit.CM)}
              >
                cm
              </button>
              <button
                className={`px-3 py-1 rounded-lg transition ${unit === Unit.INCH ? "bg-white text-zinc-950 shadow-sm border border-zinc-250" : "text-zinc-500 hover:text-zinc-800"}`}
                onClick={() => onUnitChange(Unit.INCH)}
              >
                inch
              </button>
            </div>

            {streamActive && (
              <button
                id="reboot-stream-btn"
                onClick={() => startCameraStream(selectedCameraId)}
                className="p-2 bg-zinc-50 hover:bg-zinc-150 border border-zinc-200 rounded-xl text-zinc-500 hover:text-zinc-900 transition"
                title="Restart Lens stream"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Control Form Settings (Cols: 5) */}
      <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
        <div className="space-y-5">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Sliders className="w-4.5 h-4.5 text-zinc-800" />
              Calibration & Scan Parameters
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">Define camera references for millimeter precision</p>
          </div>

          {/* Reference Targets list */}
          <div className="space-y-2">
            <label id="reference-object-label" className="text-xs text-zinc-500 font-bold block mb-1">
              Select Calibration Reference
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-[170px] overflow-y-auto pr-1">
              {REFERENCE_OBJECTS.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => setSelectedReference(obj.id)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition ${
                    selectedReference === obj.id
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold"
                      : "bg-zinc-50/50 hover:bg-zinc-100/50 border-zinc-200 text-zinc-650"
                  }`}
                >
                  <div className="pr-3">
                    <span className="font-semibold block">{obj.name}</span>
                    {obj.widthMm > 0 && (
                      <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block">
                        Dimensions: {obj.widthMm} x {obj.heightMm} mm
                      </span>
                    )}
                  </div>
                  {selectedReference === obj.id && (
                    <div className="w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center text-white flex-shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Instruction Callout */}
            <div className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-xl flex items-start gap-2 text-[10px] text-zinc-600 leading-normal">
              <Info className="w-4 h-4 text-zinc-450 flex-shrink-0 mt-0.5" />
              <span>{calibrationGuidelines}</span>
            </div>
          </div>

          {/* Target Material Hints */}
          <div className="space-y-2">
            <label id="material-hint-label" className="text-xs text-zinc-500 font-bold block">
              Folder/Paper Material Type Hint
            </label>
            <select
              id="material-select"
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 text-zinc-800 focus:border-zinc-400 rounded-xl p-2.5 focus:outline-none"
            >
              {MATERIAL_HINTS.map((hint) => (
                <option key={hint} value={hint}>
                  {hint}
                </option>
              ))}
            </select>
          </div>

          {/* Record Label tags */}
          <div className="space-y-1.5">
            <label id="record-label" className="text-xs text-zinc-500 font-bold block">
              Scan Record Label (Optional)
            </label>
            <input
              id="record-label-input"
              type="text"
              placeholder="e.g. Blue Manila Portfolio, Folder A"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className="w-full text-xs bg-zinc-50 border border-zinc-200 focus:border-zinc-400 rounded-xl py-2.5 px-3 text-zinc-800 placeholder-zinc-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 border-t border-zinc-100 pt-4 space-y-3">
          {streamActive && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex items-center justify-between shadow-xs">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                  <span className="flex h-1.5 w-1.5 relative">
                    {isAutoActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isAutoActive ? "bg-emerald-500" : "bg-zinc-400"}`}></span>
                  </span>
                  Auto-Sense Camera Mode
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">Triggers geometric scans automatically every 8s</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newState = !isAutoActive;
                  setIsAutoActive(newState);
                  setCountdown(newState ? 4 : 99999);
                }}
                className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition uppercase tracking-wider ${
                  isAutoActive
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-500"
                }`}
              >
                {isAutoActive ? "Active" : "Paused"}
              </button>
            </div>
          )}

          {errorText && (
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl text-rose-700 text-xs flex items-start gap-2 shadow-sm">
              <AlertTriangle className="w-4.5 h-4.5 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorText}</span>
            </div>
          )}

          <button
            id="trigger-scan-btn"
            onClick={streamActive ? captureSnapshotAndMeasure : () => document.getElementById("fallback-file-upload")?.click()}
            disabled={isMeasuring}
            className={`w-full py-4 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer uppercase tracking-wider ${
              isMeasuring
                ? "bg-zinc-150 text-zinc-400 border border-zinc-200 cursor-not-allowed"
                : "bg-black text-white hover:bg-zinc-800 shadow-sm"
            }`}
          >
            {isMeasuring ? (
              <>
                <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                <span>AI Geometric Analyzing...</span>
              </>
            ) : !streamActive ? (
              <>
                <Upload className="w-4.5 h-4.5" />
                <span>Upload & Estimate Measure</span>
              </>
            ) : (
              <>
                <Camera className="w-4.5 h-4.5 stroke-[2]" />
                <span>Capture & Estimate Measure</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
