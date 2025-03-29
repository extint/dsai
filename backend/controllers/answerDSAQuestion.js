const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();

// Persistent chat sessions storage
const chatSessions = {};

// Initialize Google GenerativeAI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Problem Solving Endpoint
 * Generates solution for a given problem statement
 */
const answerDSAQ =  async (req, res) => {
    try {
        const { problemStatement } = req.body;

        // Validate input
        if (!problemStatement) {
            return res.status(400).json({ 
                error: "Problem statement is required." 
            });
        }

        // JSON Schema for response
        const jsonSchema = {
            Code: "string", 
            Logic: "string",
            Time_Complexity: "string",
            Space_Complexity: "string",
            Improvements: "string"
        };

        // Supported languages
        const languages = ['python', 'javascript', 'cpp', 'java'];

        // Store solutions for different languages
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
                                    Code: {
                                        type: SchemaType.STRING,
                                        description: 'Code to solve the question accurately. Return null if answering a follow up question.',
                                        nullable: true,
                                    },
                                    Logic: {
                                        type: SchemaType.STRING,
                                        description: 'Logic explaination of the code generated to solve the question. Return null if answering a follow up question.',
                                        nullable: true,
                                    },
                                    Time_Complexity: {
                                        type: SchemaType.STRING,
                                        description: 'Time Complexity explaination of the code generated to solve the question. Return null if answering a follow up question.',
                                        nullable: true,
                                    },
                                    Space_Complexity: {
                                        type: SchemaType.STRING,
                                        description: 'Space Complexity explaination of the code generated to solve the question. Return null if answering a follow up question.',
                                        nullable: true,
                                    },
                                    Improvements: {
                                        type: SchemaType.STRING,
                                        description: 'Improvements of the code generated/ approach to solve the question. Return null if answering a follow up question.',
                                        nullable: true,
                                    },
                                    AnswerToFollowUp: {
                                        type: SchemaType.STRING,
                                        description: 'Answer to the follow up question of the code generated/approach to solve the question. Answer only in case of a follow up question',
                                        nullable: true,
                                    },
                                },
                            required: ['Code', 'Logic', 'Time_Complexity','Space_Complexity', 'Improvements', 'AnswerToFollowUp'],
                            }
                    }
                });

                // Generate content
                const result = await model.generateContent(basePrompt);
                const output = result.response.text();

                // Validate and store output
                structuredOutput[language] = JSON.parse(output);

                // Initialize chat session for follow-ups
                chatSessions[language] = model.startChat({
                    history: [
                        { role: 'user', parts: [{ text: basePrompt }] },
                        { role: 'model', parts: [{ text: output }] }
                    ]
                });
            } catch (aiError) {
                console.error('AI Response Error:', aiError);
                return res.status(500).json({ 
                    error: "Failed to generate solution", 
                    details: aiError.message 
                });
            }
        }

        // Return solutions
        return res.status(200).json({ 
            solutions: structuredOutput 
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ 
            error: "Internal server error", 
            details: error.message 
        });
    }
}

/**
 * Follow-up Query Endpoint
 * Handles follow-up questions for a specific language's solution
 */
const answerFollowUp = async (req, res) => {
    try {
        const { doubt, language } = req.body;

        // Validate inputs
        if (!doubt) {
            return res.status(400).json({ 
                error: `Follow Up Question for ${language} code is required.` 
            });
        }

        // Check if chat session exists
        if (!chatSessions[language]) {
            return res.status(404).json({ 
                error: `No active chat session for ${language}` 
            });
        }

        // Send follow-up message
        finalDoubt = `Answer concisely strictly wrt to the follow up question asked for the ${language} code\n Follow Up Question:\n` + doubt
        const result = await chatSessions[language].sendMessage(finalDoubt);
        const answer = JSON.parse((result.response.text()));

        return res.status(200).json({ answer });

    } catch (error) {
        console.error('Query Error:', error);
        res.status(500).json({ 
            error: "Failed to process follow-up query", 
            details: error.message 
        });
    }
}

const refreshContent = async (req, res) => {
    try {
        const { section, language } = req.body;

        // Validate inputs
        if (!section) {
            return res.status(400).json({ 
                error: `Follow Up Question for ${language} code is required.` 
            });
        }

        // Check if chat session exists
        if (!chatSessions[language]) {
            return res.status(404).json({ 
                error: `No active chat session for ${language}` 
            });
        }

        // Send follow-up message
        finalQuery = `Provide a newer and more deeper version of the explaination for the ${section} section, which is more technically correct and easier to understand.`
        const result = await chatSessions[language].sendMessage(finalQuery);
        const answer = JSON.parse((result.response.text()));

        return res.status(200).json({ answer });

    } catch (error) {
        console.error('Query Error:', error);
        res.status(500).json({ 
            error: "Failed to process refresh query", 
            details: error.message 
        });
    }
}

module.exports = {
    answerFollowUp,
    answerDSAQ,
    refreshContent
}