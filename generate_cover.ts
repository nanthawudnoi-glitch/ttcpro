import { GoogleGenAI } from "@google/genai";
import fs from "fs";

async function generateCover() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const prompt = "A professional and modern book cover for a 'User Manual' of a digital procurement and project tracking system. The design features minimalist icons of document folders, checkmarks, and a digital dashboard on a tablet screen. Clean white background with elegant blue and slate grey accents. High-quality corporate style, minimalist, organized, and trustworthy.";
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "1K"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64Data = part.inlineData.data;
        fs.writeFileSync('cover_base64.txt', base64Data);
        console.log("Cover image generated and saved to cover_base64.txt");
      }
    }
  } catch (error) {
    console.error("Error generating image:", error);
  }
}

generateCover();
