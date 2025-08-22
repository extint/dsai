const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
// const { AnalysisAgent } = require('../agents/core/analysisAgent');
// const { ProgressAgent } = require('../agents/core/progressAgent');
// const { HintAgent } = require('../agents/core/hintAgent');
const { AIProviderManager } = require('../config/aiProviders');
const { CodeFeedbackOrchestrator } = require('../agents/core/orchestrator');
const multer = require('multer');
const dotenv = require('dotenv');
dotenv.config();

// Initialize Google GenerativeAI client
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCEb-zfitA2XOFhuGP2wTqYcU52WvvHz20";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * Enhanced Problem Solving Endpoint
 * Generates optimized solutions for multiple programming languages
 */
const answerDSAQ = async (req, res) => {
  try {
    const { problemStatement } = req.body;
    const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

    // Validate input
    if (!sessionId) {
      return res.status(400).json({
        error: "Session ID is required.",
        code: "MISSING_SESSION_ID"
      });
    }
    if (!problemStatement || problemStatement.trim().length === 0) {
      return res.status(400).json({
        error: "Problem statement is required and cannot be empty.",
        code: "MISSING_PROBLEM_STATEMENT"
      });
    }

    const languages = ['python', 'javascript', 'cpp', 'java'];
    const structuredOutput = {};
    const errors = {};

    // Enhanced prompt for better code generation
    const generateLanguagePrompt = (language) => `
You are an expert competitive programming instructor with deep knowledge in ${language}. 
Generate a comprehensive solution for the following problem:

Problem Statement: ${problemStatement}

Requirements:
1. Write clean, optimized, and well-commented code
2. Provide detailed algorithmic explanation
3. Include comprehensive complexity analysis
4. Suggest practical optimizations
5. Ensure code follows ${language} best practices

Make your response technical, detailed, and educational.`;

    // Process each language with enhanced error handling
    await Promise.allSettled(
      languages.map(async (language) => {
        try {
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                  Code: {
                    type: SchemaType.STRING,
                    description: `Complete, executable ${language} code with proper syntax`,
                    nullable: false
                  },
                  Logic: {
                    type: SchemaType.STRING,
                    description: "Step-by-step algorithmic explanation with clear reasoning",
                    nullable: false
                  },
                  Time_Complexity: {
                    type: SchemaType.STRING,
                    description: "Detailed analysis of time complexity with mathematical breakdown",
                    nullable: false
                  },
                  Space_Complexity: {
                    type: SchemaType.STRING,
                    description: "Detailed analysis of space complexity with memory usage breakdown",
                    nullable: false
                  },
                  Improvements: {
                    type: SchemaType.STRING,
                    description: "Specific optimization suggestions and alternative approaches",
                    nullable: false
                  },
                  AnswerToFollowUp: {
                    type: SchemaType.STRING,
                    description: "Additional insights or edge cases to consider",
                    nullable: true
                  }
                },
                required: ['Code', 'Logic', 'Time_Complexity', 'Space_Complexity', 'Improvements']
              }
            }
          });

          const result = await model.generateContent(generateLanguagePrompt(language));
          const output = result.response.text();

          if (!output) {
            throw new Error(`Empty response for ${language}`);
          }

          structuredOutput[language] = JSON.parse(output);

        } catch (aiError) {
          console.error(`AI Error for ${language}:`, aiError);
          errors[language] = aiError.message;
        }
      })
    );

    // Check if we have at least one successful response
    if (Object.keys(structuredOutput).length === 0) {
      return res.status(500).json({
        error: "Failed to generate solutions for any language",
        details: errors
      });
    }

    return res.status(200).json({
      solutions: structuredOutput,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      problemStatement,
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
      code: "INTERNAL_ERROR"
    });
  }
};

/**
 * Enhanced Follow-up Query Endpoint
 * Handles contextual follow-up questions with improved chat history management
 */
const answerFollowUp = async (req, res) => {
  try {
    const { doubt, language, historyData } = req.body;
    const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

    // Enhanced validation
    if (!sessionId) {
      return res.status(400).json({
        error: "Invalid session. Please start a new session.",
        code: "INVALID_SESSION"
      });
    }
    if (!doubt || doubt.trim().length === 0) {
      return res.status(400).json({
        error: `Follow-up question cannot be empty.`,
        code: "EMPTY_DOUBT"
      });
    }
    if (!language) {
      return res.status(400).json({
        error: "Programming language must be specified.",
        code: "MISSING_LANGUAGE"
      });
    }
    if (!historyData) {
      return res.status(400).json({
        error: `History data is required for contextual responses.`,
        code: "MISSING_HISTORY"
      });
    }

    const chatHistory = historyData?.chatHistory || [];

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            Code: {
              type: SchemaType.STRING,
              description: `Updated or corrected ${language} code if needed`,
              nullable: false
            },
            Logic: {
              type: SchemaType.STRING,
              description: "Updated algorithmic explanation addressing the doubt",
              nullable: false
            },
            Time_Complexity: {
              type: SchemaType.STRING,
              description: "Updated complexity analysis if applicable",
              nullable: false
            },
            Space_Complexity: {
              type: SchemaType.STRING,
              description: "Updated space complexity analysis if applicable",
              nullable: false
            },
            Improvements: {
              type: SchemaType.STRING,
              description: "Additional improvements based on the follow-up question",
              nullable: false
            },
            AnswerToFollowUp: {
              type: SchemaType.STRING,
              description: "Direct answer to the follow-up question with code examples if needed",
              nullable: false
            }
          },
          required: ['Code', 'Logic', 'Time_Complexity', 'Space_Complexity', 'Improvements', 'AnswerToFollowUp']
        }
      }
    });

    // Enhanced chat history formatting with validation
    const formattedHistory = chatHistory
      .filter(entry => entry.role && entry.content)
      .map(entry => ({
        role: entry.role === 'user' ? 'user' : 'model',
        parts: [{ text: entry.content }]
      }));

    const chat = model.startChat({ history: formattedHistory });

    const enhancedDoubt = `
Context: You are helping with a ${language} programming solution.
Follow-up Question: ${doubt}

Please provide a comprehensive answer that:
1. Directly addresses the specific question asked
2. Updates any relevant code sections if needed
3. Maintains consistency with the previous solution
4. Provides concrete examples where applicable
5. Explains any changes or clarifications clearly
`;

    const result = await chat.sendMessage(enhancedDoubt);
    const answer = JSON.parse(result.response.text());

    return res.status(200).json({
      answer,
      newMessage: {
        role: 'model',
        content: result.response.text(),
        timestamp: new Date().toISOString()
      },
      sessionId
    });

  } catch (error) {
    console.error('Follow-up Query Error:', error);
    res.status(500).json({
      error: "Failed to process follow-up query",
      details: error.message,
      code: "FOLLOWUP_ERROR"
    });
  }
};

/**
 * Enhanced Content Refresh Endpoint
 * Provides improved explanations for specific sections
 */
const refreshContent = async (req, res) => {
  try {
    const { section, language, historyData, question } = req.body;
    const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

    if (!sessionId) {
      return res.status(400).json({
        error: "Invalid session. Please start a new session.",
        code: "INVALID_SESSION"
      });
    }

    const allowedSections = ['Code', 'Logic', 'Time_Complexity', 'Space_Complexity', 'Improvements', 'AnswerToFollowUp'];

    if (!section || !allowedSections.includes(section)) {
      return res.status(400).json({
        error: `Section must be one of: ${allowedSections.join(', ')}`,
        code: "INVALID_SECTION"
      });
    }

    const chatHistory = historyData?.chatHistory || [];

    const formattedHistory = chatHistory
      .filter(entry => entry.role && entry.content)
      .map(entry => ({
        role: entry.role === 'user' ? 'user' : 'model',
        parts: [{ text: entry.content }]
      }));

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            Code: {
              type: SchemaType.STRING,
              description: `Enhanced ${language} code with improved structure and comments`,
              nullable: false
            },
            Logic: {
              type: SchemaType.STRING,
              description: "Enhanced algorithmic explanation with more detail",
              nullable: false
            },
            Time_Complexity: {
              type: SchemaType.STRING,
              description: "More detailed time complexity analysis",
              nullable: false
            },
            Space_Complexity: {
              type: SchemaType.STRING,
              description: "More detailed space complexity analysis",
              nullable: false
            },
            Improvements: {
              type: SchemaType.STRING,
              description: "Additional optimization opportunities and alternatives",
              nullable: false
            },
            AnswerToFollowUp: {
              type: SchemaType.STRING,
              description: "Additional insights and considerations",
              nullable: true
            }
          },
          required: ['Code', 'Logic', 'Time_Complexity', 'Space_Complexity', 'Improvements']
        }
      }
    });

    const chat = model.startChat({ history: formattedHistory });

    const refreshPrompt = `
Question: ${question}

Please provide an enhanced and more detailed version of the solution, focusing particularly on improving the "${section}" section. 

Requirements:
1. Maintain technical accuracy and correctness
2. Provide deeper insights and explanations
3. Include more comprehensive examples where applicable
4. Ensure the solution is production-ready
5. Add advanced optimization techniques if relevant

Generate a complete refreshed solution with all sections enhanced.
`;

    const result = await chat.sendMessage(refreshPrompt);
    const answer = JSON.parse(result.response.text());

    return res.status(200).json({
      answer,
      refreshedSection: section,
      newMessage: {
        role: 'model',
        content: result.response.text(),
        timestamp: new Date().toISOString()
      },
      sessionId
    });

  } catch (error) {
    console.error('Refresh Content Error:', error);
    res.status(500).json({
      error: "Failed to refresh content",
      details: error.message,
      code: "REFRESH_ERROR"
    });
  }
};

/**
 * Enhanced Skeleton Code Generator
 * Creates structured comment-based code templates
 */
const generateSkeletonCode = async (req, res) => {
  console.log("here");
  try {
    const { language, historyData, question } = req.body;
    const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

    if (!sessionId) {
      return res.status(400).json({
        error: "Invalid session. Please start a new session.",
        code: "INVALID_SESSION"
      });
    }

    const code = historyData?.Code;
    if (!code) {
      return res.status(400).json({
        error: "Original code missing from history data",
        code: "MISSING_CODE"
      });
    }

    const skeletonPrompt = `
You are an expert coding instructor. Create a detailed comment-based skeleton for ${language} code.

Problem: ${question}
Reference Code: ${code}

Requirements:
1. **ONLY provide structured comments** - NO actual code implementation
2. Create a hierarchical comment structure outlining the solution approach
3. Include TODO markers for key implementation steps
4. Provide hints about data structures and algorithms to use
5. Maintain logical flow and proper ${language} comment syntax
6. Make comments technical, precise, and educational

Generate a comprehensive skeleton that guides implementation without giving away the solution.
`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            Code: {
              type: SchemaType.STRING,
              description: `Comment-only skeleton structure for ${language}`,
              nullable: false
            },
          },
          required: ['Code'],
        }
      }
    });
    console.log("heere too");
    const result = await model.generateContent(skeletonPrompt);
    const output = result.response.text();
    console.log("output");
    // console.log(output);

    if (!output || typeof output !== "string") {
      throw new Error("Invalid response from AI model");
    }

    const parsedOutput = JSON.parse(output);
    console.log(parsedOutput);
    res.status(200).json({
      skeletonCode: parsedOutput.Code,
      language,
      sessionId,
      timestamp: new Date().toISOString()
    });
    console.log(res);

  } catch (error) {
    console.error('Skeleton Code Generation Error:', error);
    res.status(500).json({
      error: "Failed to generate skeleton code",
      details: error.message,
      code: "SKELETON_ERROR"
    });
  }
};

const answerCodeTask = async (req, res) => {
  try {
    const { code, task, language = "python" } = req.body;
    const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

    // Validate required fields
    if (!code || !task) {
      return res.status(400).json({
        error: "Code and task are required.",
        code: "MISSING_REQUIRED_FIELDS"
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        error: "Session ID is required.",
        code: "MISSING_SESSION_ID"
      });
    }

    const codeQuery = `
  You are an expert coding instructor. Analyze the following ${language} code and solve the task requested in the comment.
  
  Task: ${task}
  
  Code:
  ${code}
  
  Requirements:
  1. Provide a clear solution to the requested task
  2. Include detailed explanation of your approach
  3. Ensure the code follows best practices for ${language}
  4. Include any necessary imports or dependencies
  5. Make the solution production-ready
  
  Please provide a comprehensive response that addresses the specific task.`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            code: {
              type: SchemaType.STRING,
              description: "Clean, executable code that solves the task",
              nullable: false
            }
          },
          required: ['code']
        }
      }
    });

    const result = await model.generateContent(codeQuery);
    const output = result.response.text();

    if (!output) {
      throw new Error("Empty response from AI model");
    }

    const parsedResponse = JSON.parse(output);

    console.log(`Code task completed for session ${sessionId}:`, {
      taskLength: task.length,
      codeLength: code.length,
      language
    });

    return res.status(200).json({
      answer: parsedResponse,
      sessionId,
      timestamp: new Date().toISOString(),
      language,
      success: true
    });

  } catch (error) {
    console.error('Code Task Error:', error);
    res.status(500).json({
      error: "Failed to process code task",
      details: error.message,
      code: "CODE_TASK_ERROR"
    });
  }
};

/**
 * Screenshot Analysis Endpoint
 * Analyzes LeetCode submission screenshots for verification
 */
const analyzeSubmission = async (req, res) => {
  console.log("we here atleast")
  try {
    console.log("hi");
    const { roomId, username } = req.body;
    const screenshot = req.file;

    // Validate inputs
    if (!roomId || !username) {
      return res.status(400).json({
        error: "Room ID and username are required",
        code: "MISSING_PARAMS"
      });
    }

    if (!screenshot) {
      return res.status(400).json({
        error: "Screenshot file is required",
        code: "MISSING_FILE"
      });
    }

    // Convert image to base64 for Gemini Vision API
    const imageBase64 = screenshot.buffer.toString('base64');
    const mimeType = screenshot.mimetype;

    const analysisPrompt = `
You are an expert at analyzing LeetCode submission screenshots. Analyze this screenshot and determine if it shows a valid, successful LeetCode submission.

Look for these key indicators:
1. **Accepted/Success status** - Check for "Accepted", "Success", or green checkmark indicators
2. **Runtime information** - Look for execution time (e.g., "Runtime: 50ms")
3. **Memory usage** - Look for memory consumption (e.g., "Memory: 14.2 MB")
4. **Percentile rankings** - Look for "beats X% of submissions" text
5. **LeetCode interface** - Verify this is actually from LeetCode website
6. **Problem completion** - Check if it shows a completed problem submission

Be strict in your analysis. Only return success:true if you can clearly identify multiple success indicators.

Return a detailed analysis of what you found in the image.
`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            success: {
              type: SchemaType.BOOLEAN,
              description: "Whether this appears to be a valid successful LeetCode submission",
              nullable: false
            },
            confidence: {
              type: SchemaType.NUMBER,
              description: "Confidence level from 0.0 to 1.0",
              nullable: false
            },
            indicators_found: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "List of success indicators found in the image",
              nullable: false
            },
            problems_detected: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "List of issues or concerns found",
              nullable: false
            },
            runtime_info: {
              type: SchemaType.STRING,
              description: "Extracted runtime information if visible",
              nullable: true
            },
            memory_info: {
              type: SchemaType.STRING,
              description: "Extracted memory usage information if visible",
              nullable: true
            },
            problem_title: {
              type: SchemaType.STRING,
              description: "Problem title if visible in the screenshot",
              nullable: true
            },
            analysis_notes: {
              type: SchemaType.STRING,
              description: "Additional observations about the screenshot",
              nullable: true
            }
          },
          required: ['success', 'confidence', 'indicators_found', 'problems_detected']
        }
      }
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: imageBase64
        }
      },
      { text: analysisPrompt }
    ]);
    // const text = await response.text();
    console.log("Submission API raw response:", result);
    // const result = JSON.parse(text);
    const analysis = JSON.parse(result.response.text());

    // Log the analysis for debugging
    console.log(`Screenshot Analysis for ${username} in room ${roomId}:`, {
      success: analysis.success,
      confidence: analysis.confidence,
      indicators: analysis.indicators_found?.length || 0
    });

    // Determine final success based on confidence and indicators
    const finalSuccess = analysis.success &&
      analysis.confidence >= 0.7 &&
      analysis.indicators_found?.length >= 2;

    return res.status(200).json({
      success: finalSuccess,
      analysis: analysis,
      timestamp: new Date().toISOString(),
      roomId,
      username
    });

  } catch (error) {
    console.error('Screenshot Analysis Error:', error);
    res.status(500).json({
      error: "Failed to analyze screenshot",
      details: error.message,
      code: "ANALYSIS_ERROR"
    });
  }
};

const analyzeCode = async (req, res) => {
  try {
    const { code, language = 'javascript', types = ['errors', 'suggestions', 'explanations'] } = req.body;
    const sessionId = req.body.sessionId || req.cookies?.session_id || req.headers["x-session-id"];

    // Validate required fields
    if (!code || code.trim().length === 0) {
      return res.status(400).json({
        error: "Code is required and cannot be empty.",
        code: "MISSING_CODE"
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        error: "Session ID is required.",
        code: "MISSING_SESSION_ID"
      });
    }

    // Initialize response structure
    const analysisResult = {
      errors: [],
      suggestions: [],
      explanations: ''
    };

    try {
      // Language-specific analysis
      if (language === 'python') {
        await analyzePythonCode(code, analysisResult);
      } else if (language === 'javascript') {
        await analyzeJavaScriptCode(code, analysisResult);
      } else if (language === 'cpp' || language === 'c++') {
        await analyzeCppCode(code, analysisResult);
      } else if (language === 'java') {
        await analyzeJavaCode(code, analysisResult);
      } else {
        // Generic analysis for unsupported languages
        await analyzeGenericCode(code, language, analysisResult);
      }

    } catch (analysisError) {
      console.error(`Analysis error for ${language}:`, analysisError);
      analysisResult.errors.push({
        line: 1,
        message: `Unexpected error during analysis: ${analysisError.message}`
      });
    }

    // Filter results based on requested analysis types
    const filteredResult = {};
    types.forEach(type => {
      if (analysisResult.hasOwnProperty(type)) {
        filteredResult[type] = analysisResult[type];
      }
    });

    return res.status(200).json({
      ...filteredResult,
      language,
      sessionId,
      timestamp: new Date().toISOString(),
      success: true
    });

  } catch (error) {
    console.error('Code Analysis Error:', error);
    res.status(500).json({
      error: "Failed to analyze code",
      details: error.message,
      code: "CODE_ANALYSIS_ERROR"
    });
  }
};

// Python code analysis helper
async function analyzePythonCode(code, analysisResult) {
  try {
    // Basic syntax checking (you could use a Python AST parser package if needed)
    const basicSyntaxChecks = performBasicPythonChecks(code);
    analysisResult.errors.push(...basicSyntaxChecks.errors);
    analysisResult.suggestions.push(...basicSyntaxChecks.suggestions);

    // AI-powered explanation
    const codeQuery = `Python code analysis:

${code}

**Python Assessment**:
• Structure: [brief insight]
• Pythonic: [specific improvement]

**Quick Improvements**:
• Performance: [actionable tip]
• Style: [PEP 8 note]
• Error handling: [safety tip]

**Next Steps**:
• [Specific optimization]
• [Testing suggestion]

Format: bullet points, max 15 words each, actionable and specific.
Do NOT provide converstaional responses like "Okay....", "here is the...." etc.
Just give me the analysis directly to the point.
`;

    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'text/plain'
      }
    });

    const result = await model.generateContent(codeQuery);
    analysisResult.explanations = result.response.text();

  } catch (error) {
    analysisResult.errors.push({
      line: 1,
      message: `Error analyzing Python code: ${error.message}`
    });
  }
}

// JavaScript code analysis helper
async function analyzeJavaScriptCode(code, analysisResult) {
  try {
    // Basic syntax and pattern checking
    const basicChecks = performBasicJavaScriptChecks(code);
    analysisResult.errors.push(...basicChecks.errors);
    analysisResult.suggestions.push(...basicChecks.suggestions);

    // AI-powered explanation
    const codeQuery = `Technical analysis of the following JavaScript code:

    ${code}
    
    **Format your response as crisp, scannable points:**
    
    **Code Structure**: Quick assessment (2-3 sentences max)
    **Key Improvements**: 
    • Point 1 (actionable)
    • Point 2 (specific)  
    • Point 3 (practical)
    
    **Performance Notes**: 
    • Time complexity insight
    • Memory optimization tip
    
    **Quick Wins**: 
    • Best practice tip
    • Code quality improvement
    
    Keep each point under 20 words. Be direct and actionable.
    Do NOT provide converstaional responses like "Okay....", "here is the...." etc.
    Just give me the analysis directly to the point`;
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'text/plain'
      }
    });

    const result = await model.generateContent(codeQuery);
    analysisResult.explanations = result.response.text();

  } catch (error) {
    analysisResult.errors.push({
      line: 1,
      message: `Error analyzing JavaScript code: ${error.message}`
    });
  }
}

// C++ code analysis helper
async function analyzeCppCode(code, analysisResult) {
  try {
    const basicChecks = performBasicCppChecks(code);
    analysisResult.errors.push(...basicChecks.errors);
    analysisResult.suggestions.push(...basicChecks.suggestions);

    const codeQuery = `C++ code analysis:

${code}

**C++ Review**:
• Memory: [safety check]
• Performance: [optimization tip]

**Improvements**:
• Modern C++: [specific feature]
• Safety: [potential issue]
• Efficiency: [performance gain]

**Quick Fixes**:
• [Actionable change]
• [Best practice tip]

Bullet format, under 15 words per point, technical and precise.
Do NOT provide converstaional responses like "Okay....", "here is the...." etc.
Just give me the analysis directly to the point`;


    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'text/plain'
      }
    });

    const result = await model.generateContent(codeQuery);
    analysisResult.explanations = result.response.text();

  } catch (error) {
    analysisResult.errors.push({
      line: 1,
      message: `Error analyzing C++ code: ${error.message}`
    });
  }
}

// Java code analysis helper
async function analyzeJavaCode(code, analysisResult) {
  try {
    const basicChecks = performBasicJavaChecks(code);
    analysisResult.errors.push(...basicChecks.errors);
    analysisResult.suggestions.push(...basicChecks.suggestions);

    const codeQuery = `Java code analysis:

${code}

**Java Assessment**:
• OOP Design: [principle check]
• Exception: [handling note]

**Optimizations**:
• Performance: [specific tip]
• Memory: [efficiency gain]
• Maintainability: [structure improvement]

**Action Items**:
• [Immediate fix]
• [Best practice]

Short bullets, max 15 words each, Java-specific and actionable.
Do NOT provide converstaional responses like "Okay....", "here is the...." etc.
Just give me the analysis directly to the point`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'text/plain'
      }
    });

    const result = await model.generateContent(codeQuery);
    analysisResult.explanations = result.response.text();

  } catch (error) {
    analysisResult.errors.push({
      line: 1,
      message: `Error analyzing Java code: ${error.message}`
    });
  }
}

// Generic code analysis for unsupported languages
async function analyzeGenericCode(code, language, analysisResult) {
  if(!code){
    analysisResult.explanations = "Cook something for me to analyze"
  }
  try {
    const codeQuery = `Analyze the following ${language} code:
  
  ${code}
  
  Provide a comprehensive analysis including:
  1. Code structure and organization
  2. Potential improvements
  3. Best practices for ${language}
  4. Possible optimizations
  5. Educational insights
  
  Be informative and structured.
  Do NOT provide converstaional responses like "Okay....", "here is the...." etc
  Just give me the analysis directly to the point`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        responseMimeType: 'text/plain'
      }
    });

    const result = await model.generateContent(codeQuery);
    analysisResult.explanations = result.response.text();

  } catch (error) {
    analysisResult.errors.push({
      line: 1,
      message: `Error analyzing ${language} code: ${error.message}`
    });
  }
}

// Basic Python syntax and pattern checking
function performBasicPythonChecks(code) {
  const errors = [];
  const suggestions = [];
  const lines = code.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // Check for common Python issues
    if (trimmedLine.includes('import ') && !trimmedLine.startsWith('#')) {
      // Basic unused import detection (simplified)
      const importMatch = trimmedLine.match(/import\s+(\w+)/);
      if (importMatch && !code.includes(importMatch[1] + '.') && !code.includes(importMatch[1] + '(')) {
        suggestions.push({
          line: lineNum,
          message: `Potentially unused import: ${importMatch[1]}`
        });
      }
    }

    // Check for missing colons
    if ((trimmedLine.startsWith('if ') || trimmedLine.startsWith('for ') ||
      trimmedLine.startsWith('while ') || trimmedLine.startsWith('def ')) &&
      !trimmedLine.endsWith(':')) {
      errors.push({
        line: lineNum,
        message: 'Missing colon at end of statement'
      });
    }
  });

  return { errors, suggestions };
}

// Basic JavaScript syntax and pattern checking
function performBasicJavaScriptChecks(code) {
  const errors = [];
  const suggestions = [];
  const lines = code.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // Check for console.log (development artifact)
    if (trimmedLine.includes('console.log(')) {
      suggestions.push({
        line: lineNum,
        message: 'Consider removing console.log statements in production code'
      });
    }

    // Check for var usage
    if (trimmedLine.startsWith('var ')) {
      suggestions.push({
        line: lineNum,
        message: 'Consider using let or const instead of var'
      });
    }

    // Check for missing semicolons (basic check)
    if (trimmedLine.length > 0 &&
      !trimmedLine.endsWith(';') &&
      !trimmedLine.endsWith('{') &&
      !trimmedLine.endsWith('}') &&
      !trimmedLine.startsWith('//') &&
      !trimmedLine.startsWith('/*') &&
      !trimmedLine.includes('function') &&
      !trimmedLine.includes('if ') &&
      !trimmedLine.includes('for ') &&
      !trimmedLine.includes('while ')) {
      suggestions.push({
        line: lineNum,
        message: 'Consider adding semicolon at end of statement'
      });
    }
  });

  return { errors, suggestions };
}

// Basic C++ checking
function performBasicCppChecks(code) {
  const errors = [];
  const suggestions = [];
  const lines = code.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // Check for memory allocation without deallocation
    if (trimmedLine.includes('new ') && !code.includes('delete')) {
      suggestions.push({
        line: lineNum,
        message: 'Memory allocated with new should be deallocated with delete'
      });
    }

    // Check for missing includes
    if (trimmedLine.includes('cout') && !code.includes('#include <iostream>')) {
      errors.push({
        line: lineNum,
        message: 'Missing #include <iostream> for cout'
      });
    }
  });

  return { errors, suggestions };
}

// Basic Java checking
function performBasicJavaChecks(code) {
  const errors = [];
  const suggestions = [];
  const lines = code.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmedLine = line.trim();

    // Check for System.out.println
    if (trimmedLine.includes('System.out.println(')) {
      suggestions.push({
        line: lineNum,
        message: 'Consider using a logging framework instead of System.out.println'
      });
    }

    // Check for raw types
    if (trimmedLine.includes('ArrayList ') && !trimmedLine.includes('ArrayList<')) {
      suggestions.push({
        line: lineNum,
        message: 'Consider using generic types (e.g., ArrayList<String>)'
      });
    }
  });

  return { errors, suggestions };
}
/**
 * Assistive Mode: Real-time comparison and feedback on in-progress code.
 * 
 * POST /answerq/assistive-assess
 * Request body:
 *   - problem: string (the problem statement)
 *   - referenceCode: string (the canonical full solution)
 *   - userCode: string (the user's current code)
 *   - language: string (e.g. 'python')
 */
// const assistiveAssess = async (req, res) => {
//   console.log("🔬 Enhanced assistive assessment starting...");
  
//   try {
//     const { problem, referenceCode, userCode, language = 'python' } = req.body;
    
//     if (!problem || !referenceCode || !userCode) {
//       return res.status(400).json({ error: "Missing required fields", code: "ASSISTIVE_MISSING_FIELDS" });
//     }

//     // Enhanced technical prompt for robust feedback
//     const assistPrompt = `
// You are an expert software engineer and coding mentor. Analyze the student's code with technical precision.

// === PROBLEM STATEMENT ===
// ${problem}

// === REFERENCE SOLUTION ===
// ${referenceCode}

// === STUDENT'S CURRENT CODE ===
// ${userCode}

// === LANGUAGE: ${language} ===

// PROVIDE TECHNICAL ANALYSIS IN THESE CATEGORIES:

// 1. **SYNTAX_ANALYSIS**: Check for syntax errors, missing imports, incorrect indentation
// 2. **LOGIC_ANALYSIS**: Compare algorithmic approach with reference solution
// 3. **PERFORMANCE_ANALYSIS**: Identify time/space complexity issues and optimizations
// 4. **CODE_QUALITY**: Check variable naming, code structure, best practices
// 5. **PROGRESS_TRACKING**: What percentage complete vs reference solution?
// 6. **ACTIONABLE_STEPS**: Specific next steps with code examples
// 7. **TECHNICAL_INSIGHTS**: Advanced insights about algorithms/data structures

// Return JSON with this structure:
// {
//   "progressSummary": "Technical summary of current state",
//   "completionPercentage": number,
//   "codeAnalysis": {
//     "syntaxErrors": [{"line": number, "message": "specific error", "fix": "how to fix"}],
//     "logicIssues": [{"description": "issue", "severity": "high|medium|low", "suggestion": "specific fix"}],
//     "performanceIssues": [{"issue": "bottleneck description", "improvement": "optimization suggestion"}],
//     "qualityIssues": [{"category": "naming|structure|style", "issue": "problem", "fix": "solution"}]
//   },
//   "algorithmicInsights": {
//     "currentApproach": "description of user's approach",
//     "referenceApproach": "description of reference approach", 
//     "convergence": "how similar/different they are",
//     "suggestions": ["specific algorithmic improvements"]
//   },
//   "nextSteps": [
//     {
//       "priority": number,
//       "description": "what to do next",
//       "codeHint": "specific code example or snippet",
//       "reasoning": "why this step is important"
//     }
//   ],
//   "technicalMetrics": {
//     "currentComplexity": "estimated time/space complexity",
//     "targetComplexity": "optimal complexity",
//     "codeCompleteness": "percentage complete"
//   }
// }

// BE SPECIFIC AND TECHNICAL. Avoid generic encouragement. Focus on actionable, code-specific feedback.
// `;

//     const model = genAI.getGenerativeModel({
//       model: 'gemini-2.0-flash-exp',
//       generationConfig: {
//         responseMimeType: 'application/json'
//       }
//     });

//     const result = await model.generateContent(assistPrompt);
//     let feedback;
    
//     try {
//       feedback = JSON.parse(result.response.text());
      
//       // Add additional client-side analysis
//       feedback.metadata = {
//         timestamp: Date.now(),
//         codeLength: userCode.length,
//         linesOfCode: userCode.split('\n').length,
//         language: language
//       };
      
//     } catch (e) {
//       return res.status(500).json({
//         error: "Failed to parse AI response",
//         raw: result.response.text()
//       });
//     }

//     res.status(200).json(feedback);
    
//   } catch (error) {
//     console.error('❌ Enhanced Assistive Assess Error:', error);
//     res.status(500).json({
//       error: "Failed to provide assistive feedback",
//       details: error.message,
//       code: "ASSISTIVE_ERROR"
//     });
//   }
// };
// controllers/answerDSAQuestion.js

// POST /answerq/assistive-assess
// Body: { problem, referenceCode, userCode, language, provider, apiKey, feedbackHistory }
// Headers: x-session-id
async function assistiveAssess(req, res) {
  console.log("🤖 Multi-Agent Code Feedback System Starting...");
  try {
    const {
      problem,
      referenceCode,
      userCode,
      language = 'python',
      provider = 'gemini',
      apiKey,
      feedbackHistory = []
    } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        error: "API key required",
        code: "MISSING_API_KEY",
        message: "Please configure your API key in settings",
        availableProviders: [
          { key: 'gemini', name: 'Google Gemini', free: true },
          { key: 'huggingface', name: 'Hugging Face', free: true }
        ]
      });
    }

    const sessionId = req.headers['x-session-id'] || 'anonymous';
    const userId = req.user?.id || req.ip || 'anonymous';
    const startTime = Date.now();

    // Initialize orchestrator
    const orchestrator = new CodeFeedbackOrchestrator();

    // Process code feedback
    const result = await orchestrator.processCodeFeedback({
      code: userCode,
      problem,
      referenceCode,
      language,
      userId,
      sessionId,
      provider,
      apiKey,
      feedbackHistory,
      startTime
    });

    return res.status(200).json({
      ...result,
      provider,
      sessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Multi-Agent System Error:', error);
    if (error.message.includes('API key')) {
      return res.status(401).json({
        error: "Invalid API key",
        code: "INVALID_API_KEY",
        message: "Please check your API key configuration"
      });
    }
    return res.status(500).json({
      error: "AI feedback system temporarily unavailable",
      code: "SYSTEM_ERROR",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      suggestions: [
        "Check your internet connection",
        "Try again in a few moments",
        "Switch to a different AI provider"
      ]
    });
  }
}

// GET /providers
// Returns list of free providers and recommendation
async function getAvailableProviders(req, res) {
  try {
    const manager = new AIProviderManager();
    const providers = manager.getAvailableProviders();
    return res.status(200).json({
      providers,
      recommendation: providers.length ? providers[0].key : null
    });
  } catch (error) {
    console.error('Provider Fetch Error:', error);
    return res.status(500).json({ error: "Unable to fetch providers" });
  }
}

// Export multer upload middleware along with functions
module.exports = {
  analyzeCode,
  answerFollowUp,
  answerDSAQ,
  refreshContent,
  generateSkeletonCode,
  analyzeSubmission,
  answerCodeTask,
  assistiveAssess,
  getAvailableProviders,
  upload: upload.single('screenshot') // Middleware for handling file uploads
};
