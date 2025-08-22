// agents/core/orchestrator.js - FIXED VERSION
const { AnalysisAgent } = require('./analysisAgent');
const { ProgressAgent } = require('./progressAgent');
const { HintAgent } = require('./hintAgent');
const { ValidationAgent } = require('./validationAgent');

class CodeFeedbackOrchestrator {
    constructor() {
        this.analysisAgent = new AnalysisAgent();
        this.progressAgent = new ProgressAgent();
        this.hintAgent = new HintAgent();
        this.validationAgent = new ValidationAgent();
    }

    async processCodeFeedback(input) {
        console.log("🤖 Starting Multi-Agent Code Feedback Process...");
        
        const state = {
            ...input,
            iterationCount: 0,
            feedbackHistory: input.feedbackHistory || [],
            terminationScore: 0,
            shouldTerminate: false
        };

        try {
            // Step 1: Analysis
            console.log("🔍 Step 1: Code Analysis");
            state.analysisResult = await this.analysisAgent.analyze({
                code: state.code,
                problem: state.problem,
                language: state.language,
                provider: state.provider || 'gemini',
                apiKey: state.apiKey
            });
            state.iterationCount++;

            // Step 2: Progress Assessment
            console.log("📊 Step 2: Progress Assessment");
            const progressResult = await this.progressAgent.calculateTermination({
                code: state.code,
                analysisResult: state.analysisResult,
                feedbackHistory: state.feedbackHistory,
                userId: state.userId
            });
            
            state.terminationScore = progressResult.terminationScore;
            state.shouldTerminate = progressResult.shouldTerminate;

            // Step 3: Check Termination
            if (state.shouldTerminate) {
                return this.formatCompletionResponse(state);
            }

            // Step 4: Generate Hints
            console.log("💡 Step 4: Hint Generation");
            state.hints = await this.hintAgent.generateHints({
                code: state.code,
                analysisResult: state.analysisResult,
                feedbackHistory: state.feedbackHistory,
                language: state.language,
                provider: state.provider || 'gemini',
                apiKey: state.apiKey
            });

            // Step 5: Validation
            console.log("✅ Step 5: Response Validation");
            state.validatedFeedback = await this.validationAgent.validate({
                hints: state.hints,
                analysisResult: state.analysisResult,
                shouldTerminate: state.shouldTerminate
            });
            console.log(state)
            return this.formatContinueResponse(state);

        } catch (error) {
            console.error("❌ Orchestrator Error:", error);
            throw error;
        }
    }

    formatCompletionResponse(state) {
        return {
            status: "complete",
            progressSummary: "🎉 Excellent work! Your solution meets the requirements.",
            completionPercentage: 100,
            terminationScore: state.terminationScore,
            codeAnalysis: state.analysisResult,
            message: "No further feedback needed - your solution is solid!",
            processingTime: Date.now() - (state.startTime || Date.now())
        };
    }

    formatContinueResponse(state) {
        console.log(state)
        const codeAnalysis = state.analysisResult;
        const qualityIssues = codeAnalysis.codeQuality?.improvements?.map(imp => ({ issue: imp })) || [];
        return {
            status: "continue",
            progressSummary: state.hints?.progressSummary || "Keep coding! You're making progress.",
            completionPercentage: Math.min(Math.round((state.terminationScore / 70) * 100), 95),
            terminationScore: state.terminationScore,
            codeAnalysis: state.analysisResult,
            algorithmicInsights: {
                currentApproach: state.analysisResult?.complexityAnalysis?.explanation || "Analyzing your approach...",
                suggestions: state.analysisResult?.logicIssues?.map(issue => issue.suggestion).filter(Boolean) || []
            },
            nextSteps: state.hints?.hints || [],
            technicalMetrics: {
                currentComplexity: state.analysisResult?.complexityAnalysis?.timeComplexity || "Calculating...",
                targetComplexity: state.analysisResult?.complexityAnalysis?.isOptimal ? "Optimal" : "Can be improved",
                codeCompleteness: Math.round((state.terminationScore / 70) * 100)
            },
            encouragement: state.hints?.encouragement || "You're doing great!",
            processingTime: Date.now() - (state.startTime || Date.now())
        };
    }
}

module.exports = { CodeFeedbackOrchestrator };
