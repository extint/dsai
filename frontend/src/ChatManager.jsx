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
  }
};

export default ChatManager;
