import React, { useState, useEffect } from 'react';
import configManager from '../config/ConfigManager';
import './ConfigPanel.css';

const ConfigPanel = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState(configManager.getConfig());
  const [activeTab, setActiveTab] = useState('models');
  const [showApiKeys, setShowApiKeys] = useState({});

  useEffect(() => {
    if (isOpen) {
      setConfig(configManager.getConfig());
    }
  }, [isOpen]);

  const handleApiKeyChange = (provider, value) => {
    const newConfig = { ...config };
    newConfig.apiKeys[provider] = value;
    setConfig(newConfig);
  };

  const handleModelSelect = (modelId) => {
    const newConfig = { ...config };
    newConfig.selectedModel = modelId;
    setConfig(newConfig);
  };

  const handlePreferenceChange = (key, value) => {
    const newConfig = { ...config };
    newConfig.preferences[key] = value;
    setConfig(newConfig);
  };

  const saveConfiguration = () => {
    configManager.saveConfig(config);
    onClose();
  };

  const toggleApiKeyVisibility = (provider) => {
    setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const getProviderStatus = (provider) => {
    return config.apiKeys[provider] ? 'configured' : 'not-configured';
  };

  if (!isOpen) return null;

  return (
    <div className="config-modal">
      <div className="config-content">
        <div className="config-header">
          <h2>AI Configuration</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="config-tabs">
          <button 
            className={`tab-btn ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            Models
          </button>
          <button 
            className={`tab-btn ${activeTab === 'api-keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-keys')}
          >
            API Keys
          </button>
          <button 
            className={`tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            Preferences
          </button>
        </div>

        <div className="config-body">
          {activeTab === 'models' && (
            <div className="models-section">
              <h3>Select AI Model</h3>
              <div className="models-grid">
                {config.availableModels.map(model => {
                  const hasApiKey = config.apiKeys[model.provider];
                  return (
                    <div 
                      key={model.id}
                      className={`model-card ${config.selectedModel === model.id ? 'selected' : ''} ${!hasApiKey ? 'disabled' : ''}`}
                      onClick={() => hasApiKey && handleModelSelect(model.id)}
                    >
                      <div className="model-header">
                        <h4>{model.name}</h4>
                        <span className={`model-category ${model.category}`}>
                          {model.category}
                        </span>
                      </div>
                      <div className="model-provider">
                        {model.provider.toUpperCase()}
                      </div>
                      {!hasApiKey && (
                        <div className="model-warning">
                          API Key Required
                        </div>
                      )}
                      {config.selectedModel === model.id && (
                        <div className="selected-indicator">✓</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'api-keys' && (
            <div className="api-keys-section">
              <h3>API Keys Configuration</h3>
              <div className="api-keys-list">
                {Object.entries(config.apiKeys).map(([provider, apiKey]) => (
                  <div key={provider} className="api-key-item">
                    <div className="api-key-header">
                      <label>{provider.toUpperCase()} API Key</label>
                      <div className={`status-indicator ${getProviderStatus(provider)}`}>
                        {getProviderStatus(provider) === 'configured' ? '✓' : '⚠'}
                      </div>
                    </div>
                    <div className="api-key-input-group">
                      <input
                        type={showApiKeys[provider] ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(provider, e.target.value)}
                        placeholder={`Enter ${provider} API key`}
                        className="api-key-input"
                      />
                      <button
                        type="button"
                        className="toggle-visibility"
                        onClick={() => toggleApiKeyVisibility(provider)}
                      >
                        {showApiKeys[provider] ? '🙈' : '👁️'}
                      </button>
                    </div>
                    <div className="api-key-help">
                      <a 
                        href={getApiKeyLink(provider)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Get {provider} API Key
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'preferences' && (
            <div className="preferences-section">
              <h3>Preferences</h3>
              <div className="preferences-list">
                <div className="preference-item">
                  <label>Default Language</label>
                  <select
                    value={config.preferences.defaultLanguage}
                    onChange={(e) => handlePreferenceChange('defaultLanguage', e.target.value)}
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                </div>

                <div className="preference-item">
                  <label>Max Tokens</label>
                  <input
                    type="number"
                    value={config.preferences.maxTokens}
                    onChange={(e) => handlePreferenceChange('maxTokens', parseInt(e.target.value))}
                    min="512"
                    max="8192"
                  />
                </div>

                <div className="preference-item">
                  <label>Temperature</label>
                  <input
                    type="range"
                    value={config.preferences.temperature}
                    onChange={(e) => handlePreferenceChange('temperature', parseFloat(e.target.value))}
                    min="0"
                    max="2"
                    step="0.1"
                  />
                  <span>{config.preferences.temperature}</span>
                </div>

                <div className="preference-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={config.preferences.autoSave}
                      onChange={(e) => handlePreferenceChange('autoSave', e.target.checked)}
                    />
                    Auto Save
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="config-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={saveConfiguration}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

const getApiKeyLink = (provider) => {
  const links = {
    openai: 'https://platform.openai.com/api-keys',
    anthropic: 'https://console.anthropic.com/',
    gemini: 'https://makersuite.google.com/app/apikey',
    groq: 'https://console.groq.com/keys',
  };
  return links[provider] || '#';
};

export default ConfigPanel;