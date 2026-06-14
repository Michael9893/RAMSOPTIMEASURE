import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up server-side JSON and Form body limits to handle image uploads safely
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Shared reference objects dictionary
const REFERENCES: Record<string, { name: string; dims: string; desc: string }> = {
  "credit-card": {
    name: "Standard Credit/ID Card",
    dims: "85.6 mm x 53.98 mm",
    desc: "The standard plastic card is placed as a size guideline. Use its dimensions as a calibration ratio."
  },
  "quarter-coin": {
    name: "US Quarter Coin",
    dims: "Diameter of 24.26 mm",
    desc: "A standard quarter coin is placed somewhere next to the folder/paper as a small scale calibration marker."
  },
  "a4-sheet": {
    name: "Standard A4 Paper Sheet",
    dims: "297 mm x 210 mm",
    desc: "An A4 paper sheet is present in the frame as a scale referential object."
  },
  "us-letter": {
    name: "Standard US Letter Sheet",
    dims: "279.4 mm x 215.9 mm",
    desc: "A US Letter paper sheet is present in the frame as a scale referential object."
  },
  "pen-pencil": {
    name: "Standard Pen/Pencil",
    dims: "Approx. 150 mm length",
    desc: "A standard office pen or pencil is visible in the frame next to the target, measuring roughly 150mm in length."
  },
  "none": {
    name: "No Calibration Reference",
    dims: "Visual extrapolation",
    desc: "No physical calibration aid is present. Extrapolate standard physical scales using surrounding office environment cues such as a laptop, desk texture, hand size, keyboard keys, or similar background context."
  }
};

// Lazy initialization of Gemini API to avoid crashes if API key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not configured or still has the default placeholder value. Please configure it in your AI Studio Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST Backend API endpoints
app.post("/api/measure", async (req, res) => {
  try {
    const { image, referenceId, materialHint } = req.body;

    if (!image) {
      return res.status(400).json({ error: "No image received for measurement analysis." });
    }

    // Clean base64 image data
    let base64Data = image;
    if (image.startsWith("data:")) {
      const parts = image.split(";base64,");
      if (parts.length > 1) {
        base64Data = parts[1];
      }
    }

    // Retrieve reference info
    const ref = REFERENCES[referenceId] || REFERENCES["none"];
    const calibrationReferenceDetail = `REFERENCE OBJECT NAME: ${ref.name}
DIMENSIONS: ${ref.dims}
INSTRUCTION TO VISION MODEL: ${ref.desc}`;

    // Get client
    const ai = getGeminiClient();

    const imagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Data,
      },
    };

    const materialText = materialHint ? `Target object material/type hint: "${materialHint}".` : "Target object is a standard paper sheet, catalog, stack, or folder.";

    const promptText = `You are an expert physical dimension measurement tool operating via vision-based computer science metric analysis.
Analyze the provided camera snapshot to measure the physical dimensions of the target paper, file, book, catalog, stack, or folder in MILLIMETERS.

DETAILS OF SCENE:
- ${calibrationReferenceDetail}
- ${materialText}

IDENTIFICATION PROTOCOL:
1. Locate the main target folder, paper file, or binder. It is the core subject of the photo.
2. Locate the Calibration Reference object if one is placed.
3. Compare pixels of the reference object against the target document/paper. If no reference is provided, calibrate using standard office ambient dimensions (e.g. standard desk texture patterns, pen sizes, keyboard keys [each is ~19mm], keyboard widths, laptop edges, human fingers, or standard desk accessories).
4. Measure:
   - "lengthMm" (the absolute longer edge dimension of the paper/folder's front face)
   - "widthMm" (the absolute shorter edge dimension of the paper/folder's front face)
   - "thicknessMm" (the physical edge thickness or height of the item. For a single piece of copy paper, it is ~0.1mm. For standard card folders, it is 0.4mm to 1.5mm. For thick piles, books, binders, or files, it is the actual stack depth in mm. Look at shadows and edges to deduce this accurate thickness measurement).

Return the exact structural measurements strictly following the JSON Schema format below. Do not approximate values into wild extremes. Manila directories and standard A4 folders are standard size scales (A4 is 297x210mm, US Letter is 279x216mm). Binders are slightly larger (e.g., 300x260mm) and vary in spine thickness (25mm to 75mm). Make direct, logical inferences!`;

    // Prompt content generation
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [imagePart, promptText],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lengthMm: { 
              type: Type.NUMBER, 
              description: "Estimated physical length of the paper/folder surface in millimeters (longest edge)." 
            },
            widthMm: { 
              type: Type.NUMBER, 
              description: "Estimated physical width of the paper/folder surface in millimeters (shorter edge)." 
            },
            thicknessMm: { 
              type: Type.NUMBER, 
              description: "Estimated physical thickness/height of the folder/paper/stack/binder in millimeters." 
            },
            confidenceScore: { 
              type: Type.NUMBER, 
              description: "Measurement quality confidence from 0.0 (no standard clues) to 1.0 (perfect reference alignment)." 
            },
            detectedPaperColor: { 
              type: Type.STRING, 
              description: "Visual hue description of the item detected (e.g., 'Manila Cream', 'Crimson Red', 'White Copy Paper')." 
            },
            detectedType: { 
              type: Type.STRING, 
              description: "Specific type of item detected (e.g., 'A4 Document Sheet', '3-Ring Spine Binder', 'Corrugated Folder Envelope', 'Cardstock Booklet')." 
            },
            explanation: { 
              type: Type.STRING, 
              description: "A quick 1-2 sentence human-readable breakdown of the measurement reasoning (e.g., 'Calibrated surface pixels relative to the standard ID card. Checked depth shadows to extrapolate thickness.')." 
            }
          },
          required: ["lengthMm", "widthMm", "thicknessMm", "confidenceScore", "detectedPaperColor", "detectedType", "explanation"]
        }
      }
    });

    const outputText = response.text;
    if (!outputText) {
      throw new Error("Empty measurement result received from Gemini Vision service.");
    }

    try {
      const parsed = JSON.parse(outputText.trim());
      return res.json(parsed);
    } catch {
      return res.status(502).json({
        error: "Failed to parse dimensional data returned from Gemini.",
        raw: outputText
      });
    }

  } catch (error: any) {
    console.error("Measurement Error in server.ts API:", error);
    return res.status(500).json({ 
      error: error.message || "An internal error occurred during measurement processing." 
    });
  }
});

// Serve frontend assets
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development server with Vite middleware hot reload support
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving of compiled SPA standard files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Paper Scan Ruler server running on http://localhost:${PORT}`);
  });
}

setupServer();
