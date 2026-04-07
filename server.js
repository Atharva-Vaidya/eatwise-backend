require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.use(express.static('.'));  // Serve index.html, style.css, app.js

// ─── Rate Limiting (Gemini Free Tier Protection) ────────────
// Gemini free tier allows ~15 RPM globally. Limit each IP to 5 requests per minute.
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 requests per windowMs
    message: { error: 'Rate limited. You are requesting too fast, please wait a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', apiLimiter);

// ─── Gemini Setup ──────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

const SYSTEM_PROMPT = `You are EatWise, an expert AI nutritionist and food coach. 
The user will describe a meal they ate, along with the quantity (number of servings) and the time of day. Analyze it and return ONLY a valid JSON object (no markdown, no code fences) with these exact keys:

{
  "meal": "<short name for the meal>",
  "health_score": <integer 0-100>,
  "calories": <estimated total calories as integer>,
  "protein_g": <grams of protein as integer>,
  "carbs_g": <grams of carbs as integer>,
  "fat_g": <grams of fat as integer>,
  "tip": "<one short, actionable improvement tip focusing on the meal choice or timing>"
}

Scoring guide:
- 90-100: Exceptionally healthy, nutrient-dense
- 70-89: Good, balanced meal
- 50-69: Average, some improvements needed
- 30-49: Below average, significant improvements needed
- 0-29: Unhealthy, major changes recommended

CRITICAL NUMERIC RULES:
Multiply your base calorie and macronutrient estimates by the provided "Quantity". Keep the tip under 30 words.
Return ONLY the JSON object, nothing else.`;

// ─── POST /api/log-meal ────────────────────────────────────
app.post('/api/log-meal', async (req, res) => {
    const { text, quantity = 1, timing = 'Lunch', user_id } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Please enter a meal' });
    }

    if (!user_id) {
        return res.status(400).json({ error: 'Missing user_id' });
    }

    console.log(`[${new Date().toISOString()}] User ${user_id}: "${text}"`);

    try {
        const result = await model.generateContent([
            { role: 'user', parts: [{ text: SYSTEM_PROMPT + `\n\nMeal: ${text}\nQuantity: ${quantity} serving(s)\nTiming: ${timing}` }] }
        ]);

        const raw = result.response.text().trim();

        // Strip markdown code fences if Gemini wraps them
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error('[Parse Error] Raw response:', raw);
            return res.status(500).json({ error: 'AI returned invalid data. Please try again.' });
        }

        // Validate required fields exist
        const required = ['meal', 'health_score', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'tip'];
        for (const key of required) {
            if (parsed[key] === undefined) {
                console.error(`[Validation] Missing field: ${key}`);
                return res.status(500).json({ error: 'Incomplete AI response. Please try again.' });
            }
        }

        // Clamp health_score to 0-100
        parsed.health_score = Math.max(0, Math.min(100, parseInt(parsed.health_score) || 0));

        console.log(`[Result] ${parsed.meal} → Score: ${parsed.health_score}, Cals: ${parsed.calories}`);
        
        // Pass quantity and timing to saveMeal
        parsed.quantity = quantity;
        parsed.timing = timing;
        saveMeal(user_id, parsed);
        
        return res.json(parsed);

    } catch (err) {
        console.error('[API Error]', err.message);

        if (err.status === 429 || err.message?.includes('429')) {
            return res.status(429).json({ error: 'Rate limited. Please wait a few seconds.' });
        }

        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ─── In-Memory Meal History (per user) ─────────────────────
const mealHistory = {};  // { user_id: [{ meal, health_score, calories, timestamp }] }

const saveMeal = (user_id, mealData) => {
    if (!mealHistory[user_id]) mealHistory[user_id] = [];
    mealHistory[user_id].push({
        meal: mealData.meal,
        health_score: mealData.health_score,
        calories: mealData.calories,
        protein_g: mealData.protein_g,
        carbs_g: mealData.carbs_g,
        fat_g: mealData.fat_g,
        quantity: mealData.quantity,
        timing: mealData.timing,
        timestamp: new Date().toISOString(),
    });
    // Keep last 50 entries max
    if (mealHistory[user_id].length > 50) {
        mealHistory[user_id] = mealHistory[user_id].slice(-50);
    }
};

const INSIGHTS_PROMPT = `You are EatWise, an expert AI nutritionist. 
The user's recent meal log is provided below as JSON containing meal items, quantities, and timings (Breakfast, Lunch, Dinner, Snack). 
Analyze their eating patterns for the past week, specifically looking for scheduling habits (e.g. eating too heavy at Late Night, skipping Breakfast, etc) and return ONLY a valid JSON object (no markdown, no code fences) with these exact keys:

{
  "summary": "<2-3 sentence summary of their week's eating patterns>",
  "suggestions": [
    { "title": "<short title>", "body": "<actionable suggestion under 20 words>" },
    { "title": "<short title>", "body": "<actionable suggestion under 20 words>" },
    { "title": "<short title>", "body": "<actionable suggestion under 20 words>" }
  ],
  "streak_days": <integer, number of consecutive days with avg score > 60>
}

Be specific, encouraging, actionable, and reference their meal timings. Return ONLY the JSON object.`;

// ─── GET /api/insights ─────────────────────────────────────
app.get('/api/insights', async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ error: 'Missing user_id' });
    }

    const history = mealHistory[user_id];
    if (!history || history.length === 0) {
        return res.json({
            message: "You haven't logged any meals yet this session. Start by analyzing a meal, then come back here for weekly insights!",
            streak_days: 0,
        });
    }

    console.log(`[Insights] User ${user_id}: ${history.length} meals in history`);

    try {
        const result = await model.generateContent([
            { role: 'user', parts: [{ text: INSIGHTS_PROMPT + '\n\nMeal log:\n' + JSON.stringify(history, null, 2) }] }
        ]);

        const raw = result.response.text().trim();
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            console.error('[Insights Parse Error] Raw:', raw);
            return res.status(500).json({ error: 'AI returned invalid data. Please try again.' });
        }

        console.log(`[Insights] Streak: ${parsed.streak_days}, Suggestions: ${parsed.suggestions?.length}`);
        return res.json(parsed);

    } catch (err) {
        console.error('[Insights API Error]', err.message);

        if (err.status === 429 || err.message?.includes('429')) {
            return res.status(429).json({ error: 'Rate limited. Please wait a few seconds.' });
        }

        return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
});

// ─── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🥗 EatWise server running at http://localhost:${PORT}\n`);
});
