class ConfigManager {
    constructor() {
        this.storageKey = 'ai_assistant_config';
        this.defaultConfig = {
            apiKeys: {
                gemini: '',
                huggingface: '',
                openrouter: '',
                claude: ''
            },
            selectedModel: 'gemini-2.0-flash-exp',
            availableModels: [
                // Google Gemini Models (Free)
                { 
                    id: 'gemini-2.0-flash-exp', 
                    name: 'Gemini 2.0 Flash Experimental', 
                    provider: 'gemini', 
                    category: 'free',
                    genuinelyFree: true,
                    freeLimit: '15 requests/minute'
                },
                { 
                    id: 'gemini-1.5-pro', 
                    name: 'Gemini 1.5 Pro', 
                    provider: 'gemini', 
                    category: 'free',
                    genuinelyFree: true,
                    freeLimit: '15 requests/minute'
                },
                { 
                    id: 'gemini-1.5-flash', 
                    name: 'Gemini 1.5 Flash', 
                    provider: 'gemini', 
                    category: 'free',
                    genuinelyFree: true,
                    freeLimit: '15 requests/minute'
                },

                // Hugging Face Models (Free)
                { 
                    id: 'microsoft/DialoGPT-medium', 
                    name: 'DialoGPT Medium', 
                    provider: 'huggingface', 
                    category: 'free',
                    genuinelyFree: true,
                    freeLimit: '1000 requests/month'
                },
                { 
                    id: 'microsoft/DialoGPT-large', 
                    name: 'DialoGPT Large', 
                    provider: 'huggingface', 
                    category: 'free',
                    genuinelyFree: true,
                    freeLimit: '1000 requests/month'
                },
                { 
                    id: 'facebook/blenderbot-400M-distill', 
                    name: 'BlenderBot 400M', 
                    provider: 'huggingface', 
                    category: 'free',
                    genuinelyFree: true,
                    freeLimit: '1000 requests/month'
                },

                // OpenRouter Models (Paid)
                { 
                    id: 'deepseek/deepseek-chat', 
                    name: 'DeepSeek Chat', 
                    provider: 'openrouter', 
                    category: 'paid',
                    genuinelyFree: false,
                    minimumCost: '$5'
                },
                { 
                    id: 'meta-llama/llama-3.1-8b-instruct:free', 
                    name: 'Llama 3.1 8B (Free)', 
                    provider: 'openrouter', 
                    category: 'free',
                    genuinelyFree: true,
                    freeLimit: 'Rate limited'
                },
                { 
                    id: 'openai/gpt-3.5-turbo', 
                    name: 'GPT-3.5 Turbo', 
                    provider: 'openrouter', 
                    category: 'paid',
                    genuinelyFree: false,
                    minimumCost: '$5'
                },

                // Claude Models (Paid)
                { 
                    id: 'claude-3-haiku-20240307', 
                    name: 'Claude 3 Haiku', 
                    provider: 'claude', 
                    category: 'paid',
                    genuinelyFree: false,
                    minimumCost: '$5'
                },
                { 
                    id: 'claude-3-sonnet-20240229', 
                    name: 'Claude 3 Sonnet', 
                    provider: 'claude', 
                    category: 'paid',
                    genuinelyFree: false,
                    minimumCost: '$5'
                },
                { 
                    id: 'claude-3-opus-20240229', 
                    name: 'Claude 3 Opus', 
                    provider: 'claude', 
                    category: 'paid',
                    genuinelyFree: false,
                    minimumCost: '$5'
                }
            ],
            preferences: {
                defaultLanguage: 'python',
                autoSave: true,
                theme: 'dark',
                maxTokens: 4096,
                temperature: 0.7,
                preferFreeModels: true
            }
        };
    }

    // Load configuration from localStorage
    loadConfig() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const config = JSON.parse(stored);
                return { ...this.defaultConfig, ...config };
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
        return this.defaultConfig;
    }

    // Save configuration to localStorage
    saveConfig(config) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(config));
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    // Get current configuration
    getConfig() {
        return this.loadConfig();
    }

    // Update API key for a provider
    setApiKey(provider, apiKey) {
        const config = this.getConfig();
        config.apiKeys[provider] = apiKey;
        return this.saveConfig(config);
    }

    // Get API key for a provider
    getApiKey(provider) {
        const config = this.getConfig();
        return config.apiKeys[provider] || '';
    }

    // Set selected model
    setSelectedModel(modelId) {
        const config = this.getConfig();
        config.selectedModel = modelId;
        return this.saveConfig(config);
    }

    // Get selected model
    getSelectedModel() {
        const config = this.getConfig();
        return config.selectedModel;
    }

    // Get available models
    getAvailableModels() {
        const config = this.getConfig();
        return config.availableModels;
    }

    // Get models by provider
    getModelsByProvider(provider) {
        const config = this.getConfig();
        return config.availableModels.filter(model => model.provider === provider);
    }

    // Get free models only
    getFreeModels() {
        const config = this.getConfig();
        return config.availableModels.filter(model => model.genuinelyFree === true);
    }

    // Get paid models only
    getPaidModels() {
        const config = this.getConfig();
        return config.availableModels.filter(model => model.genuinelyFree === false);
    }

    // Get supported providers
    getSupportedProviders() {
        return ['gemini', 'huggingface', 'openrouter', 'claude'];
    }

    // Get provider info
    getProviderInfo(provider) {
        const providerInfoMap = {
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
        return providerInfoMap[provider] || null;
    }

    // Check if API key exists for provider
    hasApiKey(provider) {
        return !!this.getApiKey(provider);
    }

    // Get model details
    getModelDetails(modelId) {
        const config = this.getConfig();
        return config.availableModels.find(model => model.id === modelId);
    }

    // Update preferences
    updatePreferences(newPreferences) {
        const config = this.getConfig();
        config.preferences = { ...config.preferences, ...newPreferences };
        return this.saveConfig(config);
    }

    // Get preferences
    getPreferences() {
        const config = this.getConfig();
        return config.preferences;
    }

    // Get recommended model based on preferences
    getRecommendedModel() {
        const config = this.getConfig();
        const preferences = config.preferences;
        
        if (preferences.preferFreeModels) {
            // Prefer free models, prioritize Gemini
            const freeModels = this.getFreeModels();
            const geminiModels = freeModels.filter(m => m.provider === 'gemini');
            if (geminiModels.length > 0) {
                return geminiModels[0].id;
            }
            if (freeModels.length > 0) {
                return freeModels[0].id;
            }
        }
        
        return config.selectedModel;
    }

    // Clear all configuration
    clearConfig() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('Error clearing config:', error);
            return false;
        }
    }

    // Export configuration
    exportConfig() {
        const config = this.getConfig();
        // Remove sensitive data for export
        const exportConfig = {
            ...config,
            apiKeys: Object.keys(config.apiKeys).reduce((acc, key) => {
                acc[key] = config.apiKeys[key] ? '[CONFIGURED]' : '';
                return acc;
            }, {})
        };
        return JSON.stringify(exportConfig, null, 2);
    }

    // Import configuration (without API keys for security)
    importConfig(configString) {
        try {
            const importedConfig = JSON.parse(configString);
            const currentConfig = this.getConfig();
            // Merge without overriding API keys
            const mergedConfig = {
                ...importedConfig,
                apiKeys: currentConfig.apiKeys // Keep existing API keys
            };
            return this.saveConfig(mergedConfig);
        } catch (error) {
            console.error('Error importing config:', error);
            return false;
        }
    }

    // Validate if a provider is supported
    isProviderSupported(provider) {
        return this.getSupportedProviders().includes(provider);
    }

    // Get default model for a provider
    getDefaultModelForProvider(provider) {
        const models = this.getModelsByProvider(provider);
        if (models.length === 0) return null;
        
        // Return the first model as default
        return models[0].id;
    }
}

// Create singleton instance
const configManager = new ConfigManager();
export default configManager;
