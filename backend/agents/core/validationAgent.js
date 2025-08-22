// agents/core/validationAgent.js - NEW FILE
class ValidationAgent {
    constructor() {
        this.name = 'ValidationAgent';
    }

    async validate({ hints, analysisResult, shouldTerminate }) {
        console.log(`✅ ${this.name}: Validating feedback quality...`);

        if (shouldTerminate) {
            return {
                status: "complete",
                progressSummary: "Excellent work! Your solution meets all requirements.",
                validated: true,
                completionMessage: "No further hints needed - you've successfully solved the problem!"
            };
        }

        // Validate hints don't contain full solutions
        const validatedHints = this.filterHints(hints?.hints || []);

        return {
            status: "continue",
            progressSummary: hints?.progressSummary || "Continue refining your solution...",
            nextSteps: validatedHints,
            insights: this.generateInsights(analysisResult),
            validated: true
        };
    }

    filterHints(hints) {
        return hints.filter(hint => {
            // Filter out hints that might contain complete solutions
            const codeHint = hint.codeHint || "";
            const hasFullFunction = codeHint.includes("def ") || 
                                  codeHint.includes("function ") ||
                                  codeHint.includes("public static") ||
                                  codeHint.length > 100;
            
            return !hasFullFunction;
        }).map(hint => ({
            ...hint,
            codeHint: hint.codeHint && hint.codeHint.length > 80 
                ? hint.codeHint.substring(0, 80) + "..." 
                : hint.codeHint
        }));
    }

    generateInsights(analysisResult) {
        return {
            currentApproach: `Your current approach has a time complexity of ${analysisResult?.complexityAnalysis?.timeComplexity || "unknown"}`,
            suggestions: analysisResult?.logicIssues?.map(issue => issue.description) || []
        };
    }
}

module.exports = { ValidationAgent };
