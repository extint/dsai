// agents/core/hintAgent.js

const { AIProviderManager } = require('../../config/aiProviders');

class HintAgent {
  constructor() {
    this.aiProvider = new AIProviderManager();
    this.name = 'HintAgent';
    this.hintLevels = {
      1: { name: 'conceptual', description: 'High-level guidance' },
      2: { name: 'structural', description: 'Algorithm structure hints' },
      3: { name: 'specific', description: 'Targeted suggestions' },
      4: { name: 'detailed', description: 'Implementation patterns' }
    };
  }

  determineHintLevel(iterationCount) {
    if (iterationCount <= 1) return this.hintLevels[1];
    if (iterationCount <= 2) return this.hintLevels[2];
    if (iterationCount <= 3) return this.hintLevels[3];
    return this.hintLevels[4];
  }

  buildHintPrompt(code, analysisResult, language, hintLevel) {
    return `
You are an expert programming tutor providing ${hintLevel.name} level guidance.

STRICT RULES:
- NEVER provide complete function implementations
- Focus on guiding student thinking, not giving answers
- Provide hints that help students learn, not solutions
- Maximum 50 characters per code hint
- Be encouraging and educational

ANALYSIS RESULTS:
${JSON.stringify(analysisResult, null, 2)}

CURRENT CODE:
\`\`\`${language}
${code}
\`\`\`

Generate ${hintLevel.description} in this EXACT JSON format:
{
  "hintLevel": "${hintLevel.name}",
  "progressSummary": "1-sentence encouraging summary",
  "hints": [
    {
      "priority": 1,
      "description": "what student should focus on next",
      "reasoning": "why this is important for learning",
      "codeHint": "small pattern/concept (max 50 chars, NO full solutions)"
    }
  ],
  "encouragement": "motivational message"
}`;
  }

  sanitizeCodeHint(codeHint) {
    if (!codeHint) return 'Think about the algorithm approach';
    let sanitized = codeHint
      .replace(/def \w+\([^)]*\):/g, 'function structure')
      .replace(/class \w+:/g, 'class structure')
      .replace(/for.*in.*:/g, 'loop pattern')
      .replace(/if.*:/g, 'condition check')
      .substring(0, 50);
    const forbidden = [/return.*\+/, /return.*\*/, /print\(.*\)/, /\w+\[\w+\]\s*=/];
    if (forbidden.some(r => r.test(sanitized))) {
      return 'Consider the core algorithm approach';
    }
    return sanitized || 'Think step by step';
  }

  parseHintResponse(response, hintLevel) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');

      const parsed = JSON.parse(jsonMatch[0]);
      const sanitizedHints = (parsed.hints || []).map(hint => ({
        priority: hint.priority || 1,
        description: hint.description || 'Continue working on your solution',
        reasoning: hint.reasoning || 'This will help improve your code',
        codeHint: this.sanitizeCodeHint(hint.codeHint)
      }));

      return {
        hintLevel: hintLevel.name,
        progressSummary: parsed.progressSummary || 'Keep making progress!',
        hints: sanitizedHints,
        encouragement: parsed.encouragement || "You're doing great!",
        timestamp: Date.now()
      };
    } catch (err) {
      console.warn(`${this.name} parse error:`, err.message);
      return this.getDefaultHints(hintLevel);
    }
  }

  getDefaultHints(hintLevel) {
    const defaults = {
      conceptual: [
        {
          priority: 1,
          description: 'Consider the problem requirements carefully',
          reasoning: 'Understanding the problem is key',
          codeHint: 'What data structure fits best?'
        }
      ],
      structural: [
        {
          priority: 1,
          description: 'Think about algorithm structure',
          reasoning: 'A clear structure guides implementation',
          codeHint: 'Consider loops or recursion'
        }
      ],
      specific: [
        {
          priority: 1,
          description: 'Focus on specific logic issue',
          reasoning: 'Fixing small issues yields big improvements',
          codeHint: 'Check your conditional statements'
        }
      ],
      detailed: [
        {
          priority: 1,
          description: 'Review implementation details',
          reasoning: 'Small details affect correctness',
          codeHint: 'Verify array bounds and edge cases'
        }
      ]
    };
    const level = hintLevel.name;
    return {
      hintLevel: level,
      progressSummary: "Continue working on your solution - you're making progress!",
      hints: defaults[level] || defaults.conceptual,
      encouragement: "Keep coding - every iteration makes you better!",
      timestamp: Date.now()
    };
  }

  getModelForProvider(provider) {
    const models = {
      gemini: 'gemini-2.0-flash-exp',
      huggingface: 'microsoft/CodeBERT-base',
      openrouter: 'deepseek/deepseek-chat',
      claude: 'claude-3-haiku-20240307'
    };
    return models[provider];
  }

  async generateHints({ code, analysisResult, feedbackHistory, language, provider, apiKey }) {
    const hintLevel = this.determineHintLevel(feedbackHistory?.length || 0);
    console.log(`💡 ${this.name}: Generating ${hintLevel.name} hints (provider=${provider})`);
    const prompt = this.buildHintPrompt(code, analysisResult, language, hintLevel);
    try {
      return await this.parseHintResponse(
        await this.aiProvider.callAI(provider, prompt, apiKey, {
          temperature: 0.3,
          model: this.getModelForProvider(provider)
        }),
        hintLevel
      );
    } catch (err) {
      console.error(`${this.name} Error:`, err.message);
      return this.getDefaultHints(hintLevel);
    }
  }
}

module.exports = { HintAgent };