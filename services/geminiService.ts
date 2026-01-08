
import { GoogleGenAI } from "@google/genai";

export const analyzeOSINTResult = async (jsonData: any) => {
  // Ensure we are accessing the process.env safely
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.error("Gemini API key is missing from environment.");
    return "Intelligence summary unavailable: Security system key not configured.";
  }

  // Initialize per request to use current environment state
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this OSINT lookup JSON data and provide a professional summary of findings, security risks, and key insights: ${JSON.stringify(jsonData)}`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    // Property .text is the standard way to get result in @google/genai
    const analysisText = response.text;
    return analysisText || "Lookup complete. No significant intelligence patterns detected by AI.";
  } catch (error) {
    console.error("Gemini analysis failure:", error);
    return "Intelligence analysis interrupted. Raw data available below.";
  }
};
