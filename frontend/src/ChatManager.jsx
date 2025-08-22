import { v4 as uuidv4 } from "uuid";

const ChatManager = {
  // Initialize or retrieve a session
  initSession: function () {
    let sessionId = localStorage.getItem("dsaChat_sessionId");
    if (!sessionId) {
      sessionId = uuidv4();
      localStorage.setItem("dsaChat_sessionId", sessionId);
    }
    return sessionId;
  },

  // Retrieve the current session ID
  getCurrentSessionId: function () {
    return localStorage.getItem("dsaChat_sessionId") || this.initSession();
  },

  // Store entire session data
  storeSessionData: function (sessionId, data) {
    localStorage.setItem(`dsaChat_${sessionId}`, JSON.stringify(data));
  },

  // Get all session data
  getSessionData: function (sessionId) {
    const data = localStorage.getItem(`dsaChat_${sessionId}`);
    return data ? JSON.parse(data) : { problemStatement: "", solutions: {} };
  },

  // Store language-specific chat data
  storeLanguageData: function (sessionId, language, data) {
    const sessionData = this.getSessionData(sessionId);
    if (!sessionData.solutions) {
      sessionData.solutions = {};
    }
    console.log("storing this:\n", data);
    sessionData.solutions[language] = data;
    this.storeSessionData(sessionId, sessionData);
  },

  // Retrieve language-specific chat data
  getLanguageData: function (sessionId, language) {
    const sessionData = this.getSessionData(sessionId);
    return sessionData?.solutions?.[language] || { chatHistory: [] };
  },

  // Store doubts history for a language
  storeDoubts: function (sessionId, language, doubts) {
    localStorage.setItem(`doubts_${sessionId}_${language}`, JSON.stringify(doubts));
  },

  // Retrieve doubts history for a language
  getDoubts: function (sessionId, language) {
    const storedDoubts = localStorage.getItem(`doubts_${sessionId}_${language}`);
    return storedDoubts ? JSON.parse(storedDoubts) : [];
  },

  // Clear session data
  clearSessionData: function (sessionId) {
    localStorage.removeItem(`dsaChat_${sessionId}`);
  },

  // Clear doubts for a specific language
  clearDoubts: function (sessionId, language) {
    localStorage.removeItem(`doubts_${sessionId}_${language}`);
  },

  // === NEW AI CONFIGURATION METHODS ===

  // Store AI configuration
  storeAIConfig: function (config) {
    localStorage.setItem('ai_assistant_config', JSON.stringify(config));
  },

  // Get AI configuration - now reads from ConfigManager's storage
  getAIConfig: function () {
    const config = localStorage.getItem('ai_assistant_config');
    return config ? JSON.parse(config) : {
      apiKeys: {
        gemini: '',
        huggingface: '',
        openrouter: '',
        claude: ''
      },
      selectedModel: 'gemini-2.0-flash-exp',
      selectedProvider: 'gemini',
      preferences: {
        temperature: 0.7,
        maxTokens: 4096,
        defaultLanguage: 'python',
        preferFreeModels: true
      }
    };
  },


  // Store API key for a specific provider
  storeAPIKey: function (provider, apiKey) {
    const config = this.getAIConfig();
    config.apiKeys[provider] = apiKey;
    this.storeAIConfig(config);
  },

  // Get API key for a specific provider
  getAPIKey: function (provider) {
    const config = this.getAIConfig();
    return config.apiKeys[provider] || '';
  },

  // Store selected model and provider
  storeModelSelection: function (provider, model) {
    const config = this.getAIConfig();
    config.selectedProvider = provider;
    config.selectedModel = model;
    this.storeAIConfig(config);
  },

  // Get current model selection
  getModelSelection: function () {
    const config = this.getAIConfig();
    let provider = config.selectedProvider;
    
    // If no selectedProvider, derive it from the selected model
    if (!provider && config.selectedModel) {
        // Find the model in availableModels to get its provider
        const modelObj = config.availableModels?.find(m => m.id === config.selectedModel);
        provider = modelObj?.provider;
    }
    
    // Fallback to gemini if still no provider found
    if (!provider) {
        provider = 'gemini';
    }
    
    return {
        provider: provider,
        model: config.selectedModel
    };
},

  // Store user preferences
  storePreferences: function (preferences) {
    const config = this.getAIConfig();
    config.preferences = { ...config.preferences, ...preferences };
    this.storeAIConfig(config);
  },

  // Get user preferences
  getPreferences: function () {
    const config = this.getAIConfig();
    return config.preferences;
  },

  // Check if API key exists for provider
  hasAPIKey: function (provider) {
    return !!this.getAPIKey(provider);
  },

  // Get all configured providers
  getConfiguredProviders: function () {
    const config = this.getAIConfig();
    return Object.keys(config.apiKeys).filter(provider => config.apiKeys[provider]);
  },

  // Clear AI configuration
  clearAIConfig: function () {
    localStorage.removeItem('ai_assistant_config');
  }
};

export default ChatManager;
