import { GoogleGenAI, Type } from "@google/genai";
import { GeminiAnalysisResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const analyzeImageVibe = async (base64Image: string): Promise<GeminiAnalysisResult> => {
  if (!apiKey) {
    console.warn("No API Key provided for Gemini");
    return {
      caption: "Vibing in Conakry! 🇬🇳",
      tags: ["#Conakry", "#SpotLive"],
      vibeDescription: "Looks like a great time."
    };
  }

  try {
    const model = 'gemini-2.5-flash';
    const prompt = "Analyze this image for a social discovery app called SpotLive. Provide a short, energetic caption (max 10 words), a list of 3 relevant hashtags (e.g. #NightLife, #Chill), and a one-sentence description of the 'vibe' or atmosphere. Return JSON.";

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caption: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            vibeDescription: { type: Type.STRING }
          },
          required: ["caption", "tags", "vibeDescription"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as GeminiAnalysisResult;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return {
      caption: "Check this out!",
      tags: ["#SpotLive", "#Moments"],
      vibeDescription: "Unable to analyze vibe right now."
    };
  }
};