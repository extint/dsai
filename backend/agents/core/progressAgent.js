// agents/core/progressAgent.js
class ProgressAgent {
    constructor() {
        this.name = 'ProgressAgent';
        this.userSessions = new Map(); // Store user progress history
        this.terminationThreshold = 70; // Score needed to complete
    }

    async calculateTermination({ code, analysisResult, feedbackHistory, userId }) {
        console.log(`📊 ${this.name}: Calculating termination score for user ${userId}`);

        let terminationScore = 0;
        const weights = {
            correctness: 40,    // 40% - Most important
            criticalIssues: 25, // 25% - Blocking issues
            codeQuality: 20,    // 20% - Overall quality
            plateau: 15         // 15% - Learning progress
        };

        // 1. Code Correctness Assessment (40% weight)
        const correctnessScore = this.assessCorrectness(analysisResult);
        terminationScore += (correctnessScore / 100) * weights.correctness;

        // 2. Critical Issues Check (25% weight) 
        const criticalScore = this.assessCriticalIssues(analysisResult);
        terminationScore += criticalScore * (weights.criticalIssues / 100);

        // 3. Code Quality Assessment (20% weight)
        const qualityScore = this.assessQuality(analysisResult);
        terminationScore += (qualityScore / 100) * weights.codeQuality;

        // 4. Learning Plateau Detection (15% weight)
        const plateauScore = this.assessPlateau(userId, analysisResult, feedbackHistory);
        terminationScore += plateauScore * (weights.plateau / 100);

        // Update user session history
        this.updateUserSession(userId, {
            score: terminationScore,
            correctnessScore: analysisResult.correctnessScore,
            timestamp: Date.now()
        });

        console.log(`${this.name}: Final termination score = ${Math.round(terminationScore)}/100`);
        
        return {
            terminationScore: Math.round(terminationScore),
            shouldTerminate: terminationScore >= this.terminationThreshold,
            breakdown: {
                correctness: correctnessScore,
                criticalIssues: criticalScore,
                codeQuality: qualityScore,
                plateauDetected: plateauScore > 0
            }
        };
    }

    assessCorrectness(analysisResult) {
        const score = analysisResult.correctnessScore || 0;
        
        // Base correctness assessment
        let correctnessScore = 0;
        if (score >= 90) correctnessScore = 100;
        else if (score >= 80) correctnessScore = 85;
        else if (score >= 70) correctnessScore = 70;
        else if (score >= 60) correctnessScore = 50;
        else correctnessScore = Math.max(score, 20);
        
        // PENALTY for suboptimal algorithmic approach
        if (analysisResult.complexityAnalysis?.isOptimal === false) {
            correctnessScore = Math.min(correctnessScore, 60); // Cap at 60 for suboptimal solutions
            console.log(`${this.name}: Applied suboptimal algorithm penalty`);
        }
        
        return correctnessScore;
    }    

    assessCriticalIssues(analysisResult) {
        const criticalIssues = analysisResult.criticalIssues || [];
        
        if (criticalIssues.length === 0) return 100;
        if (criticalIssues.length === 1) return 60;
        if (criticalIssues.length === 2) return 30;
        return 0; // Too many critical issues
    }

    assessQuality(analysisResult) {
        const quality = analysisResult.codeQuality;
        if (!quality) return 50;

        const avgScore = (quality.readability + quality.maintainability) / 2;
        let qualityScore = avgScore * 10; // Convert to 0-100 scale

        // Bonus for best practices
        if (quality.bestPractices) {
            qualityScore += 10;
        }

        // Bonus for optimal complexity
        if (analysisResult.complexityAnalysis?.isOptimal) {
            qualityScore += 15;
        }

        return Math.min(qualityScore, 100);
    }

    assessPlateau(userId, analysisResult, feedbackHistory) {
        // If user has been stuck for multiple iterations, allow termination
        if (feedbackHistory.length >= 5) {
            return 100; // Prevent infinite feedback loops
        }

        // Check historical progress
        const userHistory = this.userSessions.get(userId) || [];
        if (userHistory.length < 3) return 0;

        // Get last 3 scores
        const recentScores = userHistory.slice(-3).map(session => session.correctnessScore);
        const improvements = recentScores.slice(1).map((score, i) => 
            score - recentScores[i]
        );

        // If no improvement in last 3 attempts (plateau detected)
        const isPlateaued = improvements.every(improvement => improvement <= 2);
        
        if (isPlateaued && analysisResult.correctnessScore >= 60) {
            console.log(`${this.name}: Learning plateau detected for user ${userId}`);
            return 100;
        }

        return 0;
    }

    updateUserSession(userId, sessionData) {
        if (!this.userSessions.has(userId)) {
            this.userSessions.set(userId, []);
        }

        const userHistory = this.userSessions.get(userId);
        userHistory.push(sessionData);

        // Keep only last 5 sessions per user
        if (userHistory.length > 5) {
            userHistory.shift();
        }
    }

    // Get user progress analytics
    getUserProgress(userId) {
        const history = this.userSessions.get(userId) || [];
        if (history.length === 0) return null;

        return {
            totalSessions: history.length,
            averageScore: history.reduce((sum, session) => sum + session.score, 0) / history.length,
            improvement: history.length > 1 ? 
                history[history.length - 1].score - history[0].score : 0,
            lastSession: history[history.length - 1]
        };
    }
}

module.exports = { ProgressAgent };
