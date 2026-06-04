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
          error: "GEMINI_API_KEY is missing in .env file",
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
You are a Shopify jewellery product image analyzer.

Analyze uploaded jewellery image.

Product title: ${productTitle}
Variant title: ${variantTitle}

Extra user instruction:
${userPrompt}

Current fields:
${JSON.stringify(currentSpecs, null, 2)}

Fill the value for each field based on the image.
Do not change category names.
Do not change label names.

Rules:
- If exact value is not visible, write "Approx." before guessed values.
- SKU: generate short jewellery SKU.
- Certification: if not visible, write "Not visible from image".
- Clarity, carat, color: use approximate values only.
- Return only valid JSON array.
- No markdown.
- No explanation.

Return format:
[
  {
    "category": "ITEM DETAILS",
    "label": "SKU",
    "value": "RING-001"
  }
]
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

    const specs = JSON.parse(text);

    return Response.json({
      success: true,
      specs,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        error: error.message || "Image analysis failed",
      },
      { status: 500 }
    );
  }
}