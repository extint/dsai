const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const dotenv = require('dotenv');
dotenv.config();


// Initialize Google GenerativeAI client
GEMINI_API_KEY = "AIzaSyCEb-zfitA2XOFhuGP2wTqYcU52WvvHz20";
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Problem Solving Endpoint
 * Generates a solution for a given problem statement
 */
const answerDSAQ = async (req, res) => {
    try {
        const { problemStatement } = req.body;
        const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

        // Validate input
        if (!sessionId) {
            return res.status(400).json({ error: "Session ID is required." });
        }
        if (!problemStatement) {
            return res.status(400).json({ error: "Problem statement is required." });
        }

        // Supported languages
        const languages = ['python', 'javascript', 'cpp', 'java'];
        const structuredOutput = {};
        // console.log("we've reached here");
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
                                    Code: { type: SchemaType.STRING, nullable: false },
                                    Logic: { type: SchemaType.STRING, nullable: false },
                                    Time_Complexity: { type: SchemaType.STRING,description:"in-depth explaination of each component that contributes to the time complexity", nullable: false },
                                    Space_Complexity: { type: SchemaType.STRING,description:"in-depth explaination of each component that contributes to the space complexity", nullable: false },
                                    Improvements: { type: SchemaType.STRING, nullable: false },
                                    AnswerToFollowUp: { type: SchemaType.STRING, nullable: true }
                                },
                            required: ['Code', 'Logic', 'Time_Complexity','Space_Complexity', 'Improvements', 'AnswerToFollowUp'],
                        }
                    }
                });
                
                // Generate content
                const result = await model.generateContent(basePrompt);
                // console.log("oh here too");
                const output = result.response.text();
                // Store output
                structuredOutput[language] = JSON.parse(output);
                
                } catch (aiError) {
                console.error('AI Response Error:', aiError);
                return res.status(500).json({ error: "Failed to generate solution", details: aiError.message });
            }
        }

        return res.status(200).json({ 
            solutions: structuredOutput,
            problemStatement,
            sessionId
        });

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
        const { doubt, language, historyData } = req.body;
        const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

        if (!sessionId) {
            return res.status(400).json({ error: "Invalid session. Please start a new session." });
        }
        if (!doubt) {
            return res.status(400).json({ error: `Follow-up question for ${language} code is required.` });
        }

        if(!historyData) {
            return res.status(400).json({ error: `History data for ${language} code is missing.` });
        }
        // Extract chat history from request
        const chatHistory = historyData?.chatHistory || [];

        // Create a chat model with the history from client
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.0-flash-lite',
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                            Code: { type: SchemaType.STRING, nullable: false },
                            Logic: { type: SchemaType.STRING, nullable: false },
                            Time_Complexity: { type: SchemaType.STRING, nullable: false },
                            Space_Complexity: { type: SchemaType.STRING, nullable: false },
                            Improvements: { type: SchemaType.STRING, nullable: false },
                            AnswerToFollowUp: { type: SchemaType.STRING,description:"Provide me the actual code to solve the doubt as well, whenever required.", nullable: false }
                        },
                    required: ['Code', 'Logic', 'Time_Complexity','Space_Complexity', 'Improvements', 'AnswerToFollowUp'],
                }
            }
        });
        
        // Format chat history for Gemini
        const formattedHistory = chatHistory.map(entry => ({
            role: entry.role,
            parts: [{ text: entry.content }]
        }));
        
        const chat = model.startChat({ history: formattedHistory });

        // Send follow-up message
        const finalDoubt = `Answer concisely strictly with respect to the follow-up question asked for the ${language} code:\n${doubt}`;
        const result = await chat.sendMessage(finalDoubt);
        const answer = JSON.parse(result.response.text());

        // console.log(result.response.text())

        return res.status(200).json({ 
            answer,
            newMessage: {
                role: 'model',
                content: result.response.text()
            }
        });

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
        const { section, language, historyData, question } = req.body;
        const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

        if (!sessionId) {
            return res.status(400).json({ error: "Invalid session. Please start a new session." });
        }
        if (!section) {
            return res.status(400).json({ error: `Section for ${language} code is required.` });
        }

        const allowedSections = ['Code', 'Logic', 'Time_Complexity', 'Space_Complexity', 'Improvements', 'AnswerToFollowUp'];

        if (!allowedSections.includes(section)) {
            return res.status(400).json({ error: `Section must be a valid value. Allowed values: ${allowedSections.join(', ')}` });
        }

        // console.log("namaste:\n",historyData)
        // Extract chat history from request
        const chatHistory = historyData?.chatHistory || [];
        
        // Format chat history for Gemini
        const formattedHistory = chatHistory.map(entry => ({
            role: entry.role,
            parts: [{ text: entry.content }]
        }));

        // Create a chat model with the history
        const model = genAI.getGenerativeModel({ 
            model: 'gemini-2.0-flash-lite',
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                            Code: { type: SchemaType.STRING, description:`STRICTLY GENERATE CODE in ${language} `, nullable: false },
                            Logic: { type: SchemaType.STRING, nullable: false },
                            Time_Complexity: { type: SchemaType.STRING, nullable: false },
                            Space_Complexity: { type: SchemaType.STRING, nullable: false },
                            Improvements: { type: SchemaType.STRING, nullable: false },
                            AnswerToFollowUp: { type: SchemaType.STRING, nullable: true }
                        },
                    required: ['Code', 'Logic', 'Time_Complexity','Space_Complexity', 'Improvements', 'AnswerToFollowUp'],
                }
            }
        });
        
        const chat = model.startChat({ history: formattedHistory });

        // Request a deeper explanation
        const finalQuery = `Question:${question}.\n Provide a newer version of the solution,for the question ensuring technical correctness and clarity.`;
        const result = await chat.sendMessage(finalQuery);
        const answer = JSON.parse(result.response.text());

        return res.status(200).json({ 
            answer,
            newMessage: {
                role: 'model',
                content: result.response.text()
            }
        });

    } catch (error) {
        console.error('Query Error:', error);
        res.status(500).json({ error: "Failed to process refresh query", details: error.message });
    }
};

// Modified to work with client-side storage
// const generateSkeletonCode = async (req, res) => {
//     try {
//         const { language, historyData, question } = req.body;
//         const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

//         if (!sessionId) {
//             return res.status(400).json({ error: "Invalid session. Please start a new session." });
//         }

//         // Extract code from historyData safely
//         const code = historyData?.Code;
//         if (!code) {
//             return res.status(400).json({ error: "Original code missing" });
//         }

//         // Ensure problemStatement exists
//         const problemStatement = question || "No problem statement provided";

//         // Construct base prompt
//         const basePrompt = `
//         You are an expert coding instructor. Generate a structured skeleton for the given code in ${language}.  
//             - Write out the atomic steps required to implement the entire code, leaving them empty for me to fill in.  
//             - Use clear, well-structured comments to define sections of the code.  
//             - Do NOT provide any actual implementation—only the skeleton with comments.  
//             - The response MUST be in strict JSON format matching the specified schema.  
//         Problem Statement: ${problemStatement}  
//         Code Context: ${code}  
//         Keep the comments technical, precise, and well-organized.
//         `;

//         if (typeof genAI === "undefined") {
//             return res.status(500).json({ error: "AI model not initialized" });
//         }

//         const model = genAI.getGenerativeModel({
//             model: "gemini-2.0-flash-lite",
//             generationConfig: {
//                 responseMimeType: "application/json",
//                 responseSchema: {
//                     type: SchemaType.OBJECT,
//                     properties: {
//                         skeletonCode: { type: SchemaType.STRING, nullable: false },
//                     },
//                     required: ["skeletonCode"],
//                 },
//             },
//         });

//         const result = await model.generateContent(basePrompt);
//         const output = JSON.parse(result.response.text());        

//         return res.status(200).json({ skeletonCode: output });
//     } catch (error) {
//         console.error("Error generating skeleton code:", error);
//         return res.status(500).json({ error: "Internal server error", details: error.message });
//     }
// };

const generateSkeletonCode = async (req, res) => {
    const { language, historyData, question } = req.body;
    const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

    if (!sessionId) {
        return res.status(400).json({ error: "Invalid session. Please start a new session." });
    }

    try {
        const code = historyData?.Code;
        if (!code) {
            return res.status(500).json({error:"Original code missing"});
        }

        const basePrompt = `
            You are an expert coding instructor. Generate a structured COMMENT skeleton for the given code in ${language}.  

            - **ONLY provide comments**—do NOT include any actual code.  
            - The comments should outline the structure and purpose of each section in the given code.  
            - Ensure the comments are technical, precise, and well-organized and concise.  
            - Format the response in **strict JSON format**, matching the required schema. 

            Problem Statement: ${question}  
            Code Context: ${code}  
            `;


        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-lite',
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        Code: { type: SchemaType.STRING, nullable: false },
                    },
                    required: ['Code'],
                }
            }
        });

        const result = await model.generateContent(basePrompt);
        const output = result?.response?.text();

        if (!output || typeof output !== "string") {
            throw new Error("Invalid response from AI model");
        }

        res.status(200).json({ skeletonCode: output });

    } catch (error) {
        console.error('Error generating skeleton code:', error);
        res.status(500).json({ error: "Failed to generate skeleton code", details: error.message });
    }
};

module.exports = {
    answerFollowUp,
    answerDSAQ,
    refreshContent,
    generateSkeletonCode
};