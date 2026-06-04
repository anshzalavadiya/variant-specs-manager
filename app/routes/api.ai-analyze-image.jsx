import { GoogleGenAI } from "@google/genai";

export async function action({ request }) {
  try {
    const {
      imageBase64,
      mimeType,
      productTitle,
      variantTitle,
      userPrompt,
      currentSpecs,
    } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        {
          success: false,
          error: "GEMINI_API_KEY missing in .env",
        },
        { status: 500 }
      );
    }

    if (!imageBase64) {
      return Response.json(
        {
          success: false,
          error: "No image uploaded",
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `
You are a Shopify jewellery image analyzer.

Analyze the jewellery image and fill all fields.

Product title: ${productTitle}
Variant title: ${variantTitle}

Extra user instruction:
${userPrompt}

Current fields:
${JSON.stringify(currentSpecs, null, 2)}

Rules:
- Do not change category names.
- Do not change label names.
- Fill every value.
- If exact value is not visible, write "Approx.".
- For SKU, create short SKU.
- For certification, if not visible write "Not visible from image".
- Return only valid JSON array.
- No markdown.
- No explanation.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: prompt,
        },
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: imageBase64,
          },
        },
      ],
    });

    let text = response.text || "";

    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return Response.json({
      success: true,
      specs: JSON.parse(text),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error.message || "Image AI failed",
      },
      { status: 500 }
    );
  }
}