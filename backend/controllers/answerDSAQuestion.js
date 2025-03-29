const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

// Persistent chat sessions storage (per session ID)
const chatSessions = {};

// Initialize Google GenerativeAI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Problem Solving Endpoint
 * Generates a solution for a given problem statement
 */
const answerDSAQ = async (req, res) => {
    try {
        const { problemStatement } = req.body;
        const sessionId = req.cookies?.session_id || req.headers["x-session-id"]; // Get session ID from cookies or headers

        // Validate input
        if (!sessionId) {
            return res.status(400).json({ error: "Session ID is required." });
        }
        if (!problemStatement) {
            return res.status(400).json({ error: "Problem statement is required." });
        }

        // Ensure session storage exists
        if (!chatSessions[sessionId]) {
            chatSessions[sessionId] = {};
        }

        // Supported languages
        const languages = ['python', 'javascript', 'cpp', 'java'];
        const structuredOutput = {};

        // Process for each language
        for (const language of languages) {
            const basePrompt = ` You are an expert coding instructor. Generate a solution for the following problem in ${language}. The response MUST be in strict JSON format matching the specified schema.
                                    Problem Statement: ${problemStatement}
                                    Keep the answer extensive and well explained.
                                    Keep it technical` ;

            try {
                const model = genAI.getGenerativeModel({ 
                    model: 'gemini-2.0-flash-lite',
                    generationConfig: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: SchemaType.OBJECT,
                            properties: {
                                    Code: { type: SchemaType.STRING, nullable: true },
                                    Logic: { type: SchemaType.STRING, nullable: true },
                                    Time_Complexity: { type: SchemaType.STRING, nullable: true },
                                    Space_Complexity: { type: SchemaType.STRING, nullable: true },
                                    Improvements: { type: SchemaType.STRING, nullable: true },
                                    AnswerToFollowUp: { type: SchemaType.STRING, nullable: true }
                                },
                            required: ['Code', 'Logic', 'Time_Complexity','Space_Complexity', 'Improvements', 'AnswerToFollowUp'],
                        }
                    }
                });

                // Generate content
                const result = await model.generateContent(basePrompt);
                const output = result.response.text();

                // Store output
                structuredOutput[language] = JSON.parse(output);

                // Initialize chat session
                chatSessions[sessionId][language] = model.startChat({
                    history: [
                        { role: 'user', parts: [{ text: basePrompt }] },
                        { role: 'model', parts: [{ text: output }] }
                    ]
                });

            } catch (aiError) {
                console.error('AI Response Error:', aiError);
                return res.status(500).json({ error: "Failed to generate solution", details: aiError.message });
            }
        }

        return res.status(200).json({ solutions: structuredOutput });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

/**
 * Follow-up Query Endpoint
 * Handles follow-up questions for a specific language's solution
 */
const answerFollowUp = async (req, res) => {
    try {
        const { doubt, language } = req.body;
        const sessionId = req.cookies?.session_id || req.headers["x-session-id"];

        if (!sessionId || !chatSessions[sessionId]) {
            return res.status(400).json({ error: "Invalid session. Please start a new session." });
        }
        if (!doubt) {
            return res.status(400).json({ error: `Follow-up question for ${language} code is required.` });
        }
        if (!chatSessions[sessionId][language]) {
            return res.status(404).json({ error: `No active chat session for ${language}.` });
        }

        // Send follow-up message
        const finalDoubt = `Answer concisely strictly with respect to the follow-up question asked for the ${language} code:\n${doubt}`;
        const result = await chatSessions[sessionId][language].sendMessage(finalDoubt);
        const answer = JSON.parse(result.response.text());

        return res.status(200).json({ answer });

    } catch (error) {
        console.error('Query Error:', error);
        res.status(500).json({ error: "Failed to process follow-up query", details: error.message });
    }
};

/**
 * Refresh Content Endpoint
 * Refreshes and improves the explanation of a specific section
 */
const refreshContent = async (req, res) => {
    try {
        const { section, language } = req.body;
        const sessionId = req.cookies?.session_id || req.headers["x-session-id"];

        if (!sessionId || !chatSessions[sessionId]) {
            return res.status(400).json({ error: "Invalid session. Please start a new session." });
        }
        if (!section) {
            return res.status(400).json({ error: `Section for ${language} code is required.` });
        }
        if (!chatSessions[sessionId][language]) {
            return res.status(404).json({ error: `No active chat session for ${language}.` });
        }

        // Request a deeper explanation
        const finalQuery = `Provide a newer and more in-depth explanation for the ${section} section, ensuring technical correctness and clarity.`;
        const result = await chatSessions[sessionId][language].sendMessage(finalQuery);
        const answer = JSON.parse(result.response.text());

        return res.status(200).json({ answer });

    } catch (error) {
        console.error('Query Error:', error);
        res.status(500).json({ error: "Failed to process refresh query", details: error.message });
    }
};

module.exports = {
    answerFollowUp,
    answerDSAQ,
    refreshContent
};
