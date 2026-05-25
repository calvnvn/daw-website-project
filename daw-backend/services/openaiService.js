const { OpenAI } = require("openai");
const openai = new OpenAI();

const autoTranslate = async (text, targetLang = "Indonesian") => {
  // Guard Clause: Prevent API calls for empty strings or pure whitespace
  if (!text || text.trim() === "") return "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Optimized for ultra-fast response times and extremely low latency/cost
      messages: [
        {
          role: "system",
          content: `You are an elite corporate translator for PT Dharma Agung Wijaya (DAW Group), a leading renewable energy and diversified investment conglomerate.
          Your task is to translate the user's text into professional, formal, and highly natural ${targetLang}.

          CRITICAL LOCALIZATION & NOMENCLATURE RULES:
          1. CORPORATE & BRAND NAMES: Do NOT translate proper nouns, corporate entities, brand names, or people's names.
             - Keep exactly as-is: "PT Dharma Agung Wijaya", "DAW Group", "DAW", "PT Dharma Agung Wijaya (DAW)", names of board directors/founders.
          2. INDUSTRY TERMINOLOGY: Do NOT over-translate widely-accepted industrial or financial terms into literal, awkward translations.
             - Keep in their natural corporate format: "Crude Palm Oil", "CPO", "Biomass", "Biogas", "Renewable Energy", "Geothermal", "Carbon Credit", "Holding Company", "CSR (Corporate Social Responsibility)", "ESG (Environmental, Social, and Governance)".
          3. METRICS & UNITS: Do NOT translate technical metric symbols and standard units.
             - Keep exactly as-is: "MW", "kW", "MWp", "tons", "tonnes", "Ha", "hectares", "%", "Rp", "USD".
          4. CONTACT DETAILS: Do NOT alter or translate URLs, hyperlinks, email addresses, phone numbers, or physical addresses.
          5. HTML INTEGRITY: You MUST preserve all HTML tags (e.g., <p>, <strong>, <em>, <a>, <ul>, <li>, <h1>, <h2>, <br>) exactly in their original structure and position. 
             - Only translate the readable text content nested inside the tags.
             - Do NOT wrap the output in markdown code fences (like \`\`\`html). Output the raw HTML structure directly.
             - CRITICAL: If the input text has NO HTML tags, do NOT add or wrap the output in any HTML tags (e.g., do not wrap plain text titles/excerpts in <h1> or <p> tags).`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.1, // Near-zero temperature ensures strict consistency, factuality, and eliminates creative hallucinations
      max_tokens: 2048, // Prevents truncation of lengthy articles and comprehensive rich text HTML content
    });

    let resultText = response.choices[0].message.content.trim();

    // Guardrail: If original input was plain text but AI added outer HTML wrapping tags, strip them
    const hasHtmlTags = (str) => /<\/?[a-z][\s\S]*>/i.test(str);
    if (!hasHtmlTags(text) && hasHtmlTags(resultText)) {
      resultText = resultText.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, "");
    }

    return resultText;
  } catch (error) {
    // Graceful Fail-soft: Log standard error output to prevent application server crashing
    console.error(
      `[OpenAI Service Error] Translation process failed: ${error.message}`,
    );
    return null;
  }
};

module.exports = { autoTranslate };
