const { AIProviderManager } = require('../../config/aiProviders');

class AnalysisAgent {
    constructor() {
        this.aiProvider = new AIProviderManager();
        this.name = 'AnalysisAgent';
    }

    async analyze({ code, problem, language, provider = 'gemini', apiKey }) {
        console.log(`🔍 ${this.name}: Analyzing ${language} code using ${provider}`);

        const prompt = this.buildAnalysisPrompt(code, problem, language);
        
        try {
            const response = await this.aiProvider.callAI(provider, prompt, apiKey, {
                temperature: 0.1,
                model: this.getModelForProvider(provider)
            });

            return this.parseAnalysisResponse(response);
        } catch (error) {
            console.error(`${this.name} Error:`, error.message);
            return this.getDefaultAnalysis();
        }
    }

    buildAnalysisPrompt(code, problem, language) {
        return `
You are an expert ${language} code analyst. Analyze this code for the given problem and return ONLY a valid JSON object.

PROBLEM: ${problem}

CODE TO ANALYZE:
\`\`\`${language}
${code}
\`\`\`

Return analysis in this EXACT JSON format (no extra text):
{
    "syntaxErrors": [
        {"line": 1, "message": "description"}
    ],
    "logicIssues": [
        {"description": "issue description", "severity": "high|medium|low", "suggestion": "how to fix"}
    ],
    "complexityAnalysis": {
        "timeComplexity": "O(...)",
        "spaceComplexity": "O(...)",
        "isOptimal": true|false,
        "explanation": "brief explanation"
    },
    "codeQuality": {
        "readability": 8,
        "maintainability": 7,
        "bestPractices": true,
        "improvements": ["suggestion1", "suggestion2"]
    },
    "correctnessScore": 85,
    "criticalIssues": ["list of blocking issues"],
    "positiveAspects": ["what the code does well"]
}`;
    }

    parseAnalysisResponse(response) {
        try {
            // Clean up the response to extract JSON
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);
            
            // Validate required fields
            return {
                syntaxErrors: parsed.syntaxErrors || [],
                logicIssues: parsed.logicIssues || [],
                complexityAnalysis: parsed.complexityAnalysis || {
                    timeComplexity: "Unknown",
                    spaceComplexity: "Unknown",
                    isOptimal: false
                },
                codeQuality: parsed.codeQuality || {
                    readability: 5,
                    maintainability: 5,
                    bestPractices: false
                },
                correctnessScore: parsed.correctnessScore || 50,
                criticalIssues: parsed.criticalIssues || [],
                positiveAspects: parsed.positiveAspects || []
            };
        } catch (error) {
            console.warn(`Failed to parse AI response: ${error.message}`);
            return this.getDefaultAnalysis();
        }
    }

    getModelForProvider(provider) {
        const models = {
            gemini: 'gemini-2.0-flash-exp',
            huggingface: 'microsoft/CodeBERT-base',
            deepseek: 'deepseek/deepseek-chat',
            claude: 'claude-3-haiku-20240307'
        };
        return models[provider];
    }

    getDefaultAnalysis() {
        return {
            syntaxErrors: [],
            logicIssues: [],
            complexityAnalysis: {
                timeComplexity: "Analysis unavailable",
                spaceComplexity: "Analysis unavailable",
                isOptimal: false
            },
            codeQuality: {
                readability: 5,
                maintainability: 5,
                bestPractices: false
            },
            correctnessScore: 50,
            criticalIssues: ["Unable to analyze - AI service unavailable"],
            positiveAspects: []
        };
    }
}

module.exports = { AnalysisAgent };
