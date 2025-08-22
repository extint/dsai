// config/aiProviders.js

const axios = require('axios');

class AIProviderManager {
    constructor(userApiKeys = {}) {
        this.providers = {
            gemini: {
                name: 'Google Gemini',
                genuinelyFree: true,
                freeLimit: '15 requests/minute',
                requiresPayment: false
            },
            huggingface: {
                name: 'Hugging Face',
                genuinelyFree: true,
                freeLimit: '1000 requests/month',
                requiresPayment: false
            },
            openrouter: {
                name: 'OpenRouter (Mixed)',
                genuinelyFree: false,
                freeLimit: 'Small free allowance, then paid',
                requiresPayment: true,
                minimumCost: '$5'
            },
            claude: {
                name: 'Claude API',
                genuinelyFree: false,
                freeLimit: 'None – paid only',
                requiresPayment: true,
                minimumCost: '$5'
            }
        };

        // User-provided API keys
        this.userApiKeys = userApiKeys;
    }

    setUserApiKey(provider, apiKey) {
        this.userApiKeys[provider] = apiKey;
    }

    async callAI(provider, prompt, apiKey, options = {}) {
        const key = apiKey || this.userApiKeys[provider];
        if (!key) {
            throw new Error(`No API key provided for ${provider}. Please configure your API key.`);
        }

        try {
            switch (provider) {
                case 'gemini':
                    return await this.callGemini(prompt, key, options);
                case 'huggingface':
                    return await this.callHuggingFace(prompt, key, options);
                case 'openrouter':
                    return await this.callOpenRouter(prompt, key, options);
                case 'claude':
                    return await this.callClaude(prompt, key, options);
                default:
                    throw new Error(`Unsupported provider: ${provider}`);
            }
        } catch (error) {
            console.error(`Error calling ${provider}:`, error.message);
            throw error;
        }
    }

    // Google Gemini via @google/generative-ai
    async callGemini(prompt, apiKey, options = {}) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: options.model || 'gemini-2.0-flash-exp' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    async callHuggingFace(prompt, apiKey, options = {}) {
        const config = this.setupHuggingFace(apiKey);

        // Use a proper text generation model instead of CodeBERT
        const modelName = options.model || 'microsoft/DialoGPT-medium';

        try {
            const response = await axios.post(
                `${config.baseURL}/${modelName}`,
                {
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 512,
                        temperature: options.temperature || 0.1,
                        return_full_text: false
                    }
                },
                {
                    headers: config.headers,
                    timeout: 30000 // 30 second timeout
                }
            );

            // Handle different response formats
            if (response.data && typeof response.data === 'string') {
                return response.data;
            } else if (response.data && Array.isArray(response.data)) {
                return response.data[0]?.generated_text || 'No response generated';
            } else if (response.data && response.data.generated_text) {
                return response.data.generated_text;
            } else {
                throw new Error('Unexpected response format from Hugging Face');
            }
        } catch (error) {
            console.error('Hugging Face API Error:', error.response?.data || error.message);
            throw new Error(`Hugging Face API failed: ${error.message}`);
        }
    }

    setupHuggingFace(apiKey) {
        if (!apiKey) {
            throw new Error('Hugging Face API key is required');
        }

        return {
            baseURL: 'https://api-inference.huggingface.co/models',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'User-Agent': 'DSAi-CodeFeedback/1.0'
            }
        };
    }

    setupOpenRouter(apiKey) {
        return {
            baseURL: 'https://openrouter.ai/api/v1/chat/completions',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        };
    }

    async callOpenRouter(prompt, apiKey, options = {}) {
        const config = this.setupOpenRouter(apiKey);
        const response = await axios.post(
            config.baseURL,
            {
                model: options.model || 'deepseek/deepseek-chat',
                messages: [
                    { role: 'system', content: 'You are an expert code analysis assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: options.temperature || 0.1
            },
            { headers: config.headers }
        );
        return response.data.choices[0].message.content;
    }

    setupClaude(apiKey) {
        return {
            baseURL: 'https://api.anthropic.com/v1/messages',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            }
        };
    }

    async callClaude(prompt, apiKey, options = {}) {
        const config = this.setupClaude(apiKey);
        const response = await axios.post(
            config.baseURL,
            {
                model: options.model || 'claude-3-haiku-20240307',
                max_tokens: options.max_tokens || 1000,
                messages: [{ role: 'user', content: prompt }]
            },
            { headers: config.headers }
        );
        return response.data.content[0].text;
    }

    getAvailableProviders() {
        return Object.entries(this.providers)
            .map(([key, info]) => ({ key, ...info }))
            .filter(p => p.requiresPayment === false);
    }
}

module.exports = { AIProviderManager };
