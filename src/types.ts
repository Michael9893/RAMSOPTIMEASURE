export enum Unit {
  MM = "mm",
  CM = "cm",
  INCH = "inch"
}

export interface ReferenceObject {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  description: string;
  category: "card" | "coin" | "stationery" | "none";
}

export interface ScanResult {
  id: string;
  timestamp: string;
  label: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  confidenceScore: number;
  detectedPaperColor: string;
  detectedType: string;
  explanation: string;
  referenceUsed: string;
  snapshotUrl?: string;
}

export interface MeasureRequestBody {
  image: string; // base64 JPEG format
  referenceId: string;
  materialHint?: string;
}
