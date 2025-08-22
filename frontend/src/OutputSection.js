import React, { useState, useEffect, useRef } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import { CopyToClipboard } from "react-copy-to-clipboard";
import DoubtDialogue from "./doubtDialogue";
import "./OutputSection.css";
import axios from "axios";
import Cookies from "js-cookie";
import ChatManager from "./ChatManager";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import Editor from "@monaco-editor/react";
import GlassPanel from "./glass-panel/GlassPanel";
import FeedbackPanel from "./feedback-panel/FeedbackPanel";
import FloatingFeedbackManager from "./feedback-panel/FloatingFeedbackManager";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("cpp", cpp);

const PORT = process.env.REACT_APP_PORT;

// Enhanced debounce with cleanup
const debounce = (func, wait) => {
  let timeout;
  function debounced(...args) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }
  debounced.cancel = () => { if (timeout) clearTimeout(timeout); };
  return debounced;
};

const OutputSection = ({ output: initialOutput }) => {
  const [sectionData, setSectionData] = useState({});
  const [isCopied, setIsCopied] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState("python");
  const [selectedText, setSelectedText] = useState("");
  const [dialoguePosition, setDialoguePosition] = useState({ x: 0, y: 0 });
  const [showDialogue, setShowDialogue] = useState(false);
  const [refreshingSection, setRefreshingSection] = useState(null);
  const [error, setError] = useState(null);
  const [isTry, setIsTry] = useState(false);
  const [generatedSkeletonCode, setGeneratedSkeletonCode] = useState("");
  const [assistiveFeedback, setAssistiveFeedback] = useState(null);
  const [isAssistiveLoading, setIsAssistiveLoading] = useState(false);
  const [showTryOptions, setShowTryOptions] = useState(false);
  const [assistiveMode, setAssistiveMode] = useState(false);
  const [showIDE, setShowIDE] = useState(false);
  const [userCode, setUserCode] = useState("");
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [revealedHints, setRevealedHints] = useState(new Set());
  const editorRef = useRef(null);

  // Refs for cleanup
  const assistiveTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);
  const debouncedAssessRef = useRef();

  const currentSessionId = ChatManager.getCurrentSessionId();
  const problem = ChatManager.getSessionData(currentSessionId)?.problemStatement || "";
  const referenceCode = ChatManager.getLanguageData(currentSessionId, activeLanguage)?.Code || "";

  // Function to toggle hint visibility
  const toggleHintVisibility = (stepIndex) => {
    setRevealedHints(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepIndex)) {
        newSet.delete(stepIndex);
      } else {
        newSet.add(stepIndex);
      }
      return newSet;
    });
  };


  const handleCloseIDE = () => {
    // Cleanup any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (assistiveTimeoutRef.current) {
      clearTimeout(assistiveTimeoutRef.current);
    }
    if (debouncedAssessRef.current?.cancel) {
      debouncedAssessRef.current.cancel();
    }

    setShowIDE(false);
    setAssistiveMode(false);
    setGeneratedSkeletonCode("");
    setAssistiveFeedback(null);
    setIsTry(false);
    setUserCode("");
    setFeedbackHistory([]);
    setIsAssistiveLoading(false);
  };

  // Enhanced assistive assessment with better feedback
  const performAssistiveAssessment = async (code) => {
    console.log('Starting enhanced assessment...');
    
    if (!assistiveMode || !problem || !referenceCode || !code.trim()) {
      console.log('Assessment conditions not met');
      return;
    }
  
    // Get AI configuration from ChatManager
    const modelSelection = ChatManager.getModelSelection();
    const apiKey = ChatManager.getAPIKey(modelSelection.provider);
    const preferences = ChatManager.getPreferences();

    console.log('Model Selection:', modelSelection); // Check if provider is undefined
    console.log('API Key:', apiKey);
    console.log('Full Config:', ChatManager.getAIConfig());

  
    // Check if API key is available
    if (!apiKey) {
      setAssistiveFeedback(prev => ({
        ...prev,
        progressSummary: "API key not configured",
        error: `Please configure your ${modelSelection.provider} API key in settings`,
        tips: ["Click the settings button to configure your API keys"]
      }));
      return;
    }
  
    // Cancel existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
  
    setIsAssistiveLoading(true);
  
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/answerq/assistive-assess`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": currentSessionId,
          "x-ai-provider": modelSelection.provider,
          "x-ai-model": modelSelection.model
        },
        body: JSON.stringify({
          problem,
          referenceCode,
          userCode: code,
          language: activeLanguage,
          // Pass AI configuration
          provider: modelSelection.provider,
          apiKey: apiKey,
          preferences: preferences
        }),
        signal: abortControllerRef.current.signal,
      });
  
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid API key. Please check your configuration.");
        }
        throw new Error(`Server error: ${response.status}`);
      }
  
      const data = await response.json();
      console.log('Enhanced feedback received:', data);
  
      // Enhanced feedback structure
      const enhancedFeedback = {
        progressSummary: data.progressSummary || "Code analysis in progress",
        completionPercentage: data.completionPercentage || 0,
        codeAnalysis: data.codeAnalysis || {
          syntaxErrors: [],
          logicIssues: [],
          performanceIssues: [],
          qualityIssues: []
        },
        algorithmicInsights: data.algorithmicInsights || {
          currentApproach: "Analyzing approach...",
          referenceApproach: "",
          convergence: "",
          suggestions: []
        },
        nextSteps: data.nextSteps || [],
        technicalMetrics: data.technicalMetrics || {
          currentComplexity: "Waiting",
          targetComplexity: "",
          codeCompleteness: data.completionPercentage || 0
        },
        // Legacy fields for backward compatibility
        alignment: data.alignment || [],
        alternateApproach: data.alternateApproach,
        tips: data.tips || [],
        praise: data.praise || "",
        timestamp: Date.now(),
        // Add AI metadata
        aiMetadata: {
          provider: modelSelection.provider,
          model: modelSelection.model,
          timestamp: Date.now()
        }
      };
  
      setAssistiveFeedback(enhancedFeedback);
      setRevealedHints(new Set());
      setFeedbackHistory(prev => [...prev.slice(-4), enhancedFeedback]);
  
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request cancelled');
        return;
      }
      
      console.error("Assessment error:", error);
      
      setAssistiveFeedback(prev => ({
        ...prev,
        progressSummary: prev?.progressSummary || "Analysis temporarily unavailable",
        error: error.message.includes("API key") ? 
          "Please check your API key configuration in settings" : 
          `Connection issue: ${error.message}`,
        tips: [...(prev?.tips || []), 
          error.message.includes("API key") ? 
            "Configure your API key in settings" : 
            "Check your connection and try again"
        ]
      }));
    } finally {
      setIsAssistiveLoading(false);
    }
  };  

  // Setup debounced assessment with proper cleanup
  useEffect(() => {
    debouncedAssessRef.current = debounce(performAssistiveAssessment, 1400);
    return () => {
      if (debouncedAssessRef.current?.cancel) {
        debouncedAssessRef.current.cancel();
      }
    };
  }, [problem, referenceCode, assistiveMode, activeLanguage]);

  const handleClickTry = async () => {
    setShowTryOptions(true);
    setIsTry(true);
  };

  const handleStartSkeleton = async () => {
    setShowTryOptions(false);
    setAssistiveMode(false);
    setShowIDE(true);
    setGeneratedSkeletonCode("Loading skeleton code...");

    try {
      const sessionId = ChatManager.initSession();
      const languageData = ChatManager.getLanguageData(sessionId, activeLanguage) || {};
      const question = ChatManager.getSessionData(sessionId).problemStatement;

      const response = await axios.post(
        `http://127.0.0.1:${PORT}/answerq/skeletoncode`,
        { language: activeLanguage, sessionId, question, historyData: languageData },
        { headers: { "Content-Type": "application/json", "x-session-id": sessionId } }
      );

      if (response.status !== 200) throw new Error(`Server error: ${response.status}`);

      let skeletonCode = response.data?.skeletonCode || "No skeleton code generated.";
      skeletonCode = cleanCode(skeletonCode);

      languageData.skeletonCode = skeletonCode;
      ChatManager.storeLanguageData(sessionId, activeLanguage, languageData);

      setGeneratedSkeletonCode(skeletonCode);
      setUserCode(skeletonCode);

    } catch (error) {
      console.error("Skeleton generation error:", error);
      setGeneratedSkeletonCode("Failed to load skeleton code. Please try again.");
    }
  };

  const handleStartAssist = () => {
    setShowTryOptions(false);
    setAssistiveMode(true);
    setShowIDE(true);
    setGeneratedSkeletonCode("");
    setUserCode("");

    // Initial helpful message
    setAssistiveFeedback({
      progressSummary: "Welcome to AI-powered coding assistance!",
      completionPercentage: 0,
      codeAnalysis: { syntaxErrors: [], logicIssues: [], performanceIssues: [], qualityIssues: [] },
      algorithmicInsights: {
        currentApproach: "Ready to analyze your approach",
        suggestions: ["Start by understanding the problem requirements", "Plan your algorithm before coding"]
      },
      nextSteps: [
        {
          priority: 1,
          description: "Read and understand the problem statement",
          reasoning: "Clear understanding is crucial for correct implementation"
        },
        {
          priority: 2,
          description: "Plan your algorithm and data structures",
          reasoning: "Planning prevents implementation issues"
        }
      ],
      technicalMetrics: {
        currentComplexity: "Not yet calculated",
        codeCompleteness: 0
      },
      tips: ["Start typing to get real-time AI feedback!", "I'll analyze your code as you write it"],
      praise: "Let's build an amazing solution together!"
    });
  };

  // Enhanced editor change handler
  const handleEditorChange = (value) => {
    const currentValue = value || "";
    setUserCode(currentValue);
    setGeneratedSkeletonCode(currentValue);

    // Only assess in assistive mode with valid data
    if (assistiveMode && problem && referenceCode && currentValue.trim()) {
      if (debouncedAssessRef.current) {
        debouncedAssessRef.current(currentValue);
      }
    }
  };

  // Function to clean code output
  function cleanCode(code) {
    if (!code) return "";
    return code.replace(/^``````$/, "").trim();
  }

  // Initialize section data from props
  function initializeSectionData(output) {
    if (!output || !output.solutions) return {};
    const newData = {};

    ["python", "cpp", "java"].forEach((lang) => {
      newData[lang] = {
        Code: cleanCode(output.solutions?.[lang]?.Code || "No code generated"),
        Logic: output.solutions?.[lang]?.Logic || "No logic available",
        Time_Complexity: output.solutions?.[lang]?.Time_Complexity || "No time complexity data",
        Space_Complexity: output.solutions?.[lang]?.Space_Complexity || "No space complexity data",
        Improvements: output.solutions?.[lang]?.Improvements || "No improvement suggestions",
      };
    });

    return newData;
  }

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('customTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'string', foreground: 'CE9178' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.lineHighlightBackground': '#2d2d2d',
        'editorLineNumber.foreground': '#858585',
      }
    });

    monaco.editor.setTheme('customTheme');
    editor.focus();
  };

  useEffect(() => {
    setSectionData(initializeSectionData(initialOutput));
    setSelectedText("");
    setShowDialogue(false);
    setError(null);
    setRefreshingSection(null);
  }, [initialOutput]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (assistiveTimeoutRef.current) clearTimeout(assistiveTimeoutRef.current);
      if (debouncedAssessRef.current?.cancel) debouncedAssessRef.current.cancel();
    };
  }, []);

  // Enhanced Assistive Feedback Panel Component
  // const AssistiveFeedbackPanel = () => (
  //   <div className="assistive-feedback-panel">
  //     {/* Header with subtle loading indicator */}
  //     <div className="assistive-feedback-header">
  //       <h4>AI Code Assistant</h4>
  //       {isAssistiveLoading && (
  //         <div className="subtle-loading-indicator">
  //           <div className="loading-dot"></div>
  //           <span>Analyzing...</span>
  //         </div>
  //       )}
  //     </div>

  //     {assistiveFeedback ? (
  //       <div className={`assistive-feedback-content ${isAssistiveLoading ? 'updating' : ''}`}>
  //         {/* Progress Section */}
  //         {assistiveFeedback.progressSummary && (
  //           <div className="progress-section">
  //             <h5>Progress</h5>
  //             <p>{assistiveFeedback.progressSummary}</p>
  //             {assistiveFeedback.completionPercentage !== undefined && (
  //               <div className="progress-bar">
  //                 <div
  //                   className="progress-fill"
  //                   style={{ width: `${assistiveFeedback.completionPercentage}%` }}
  //                 ></div>
  //                 <span className="progress-text">{assistiveFeedback.completionPercentage}% Complete</span>
  //               </div>
  //             )}
  //           </div>
  //         )}

  //         {/* Code Analysis Section */}
  //         {assistiveFeedback.codeAnalysis && assistiveFeedback.codeAnalysis.syntaxErrors || assistiveFeedback.codeAnalysis.logicIssues || assistiveFeedback.codeAnalysis.performanceIssues(
  //           <div className="code-analysis-section">

  //             {assistiveFeedback.codeAnalysis.syntaxErrors?.length > 0 && (
  //               <>
  //                 <h5>🔍 Code Analysis</h5>
  //                 <div className="syntax-errors">
  //                   <strong>⚠️ Syntax Issues:</strong>
  //                   <ul>
  //                     {assistiveFeedback.codeAnalysis.syntaxErrors.map((error, idx) => (
  //                       <li key={idx} className="error-item">
  //                         <strong>Line {error.line}:</strong> {error.message}
  //                         {error.fix && <div className="error-fix">💡 Fix: {error.fix}</div>}
  //                       </li>
  //                     ))}
  //                   </ul>
  //                 </div>
  //               </>
  //             )}

  //             {assistiveFeedback.codeAnalysis.logicIssues?.length > 0 && (
  //               <div className="logic-issues">
  //                 <strong>🧠 Logic Analysis:</strong>
  //                 <ul>
  //                   {assistiveFeedback.codeAnalysis.logicIssues.map((issue, idx) => (
  //                     <li key={idx} className={`logic-item severity-${issue.severity}`}>
  //                       <span className="severity-badge">{issue.severity?.toUpperCase()}</span>
  //                       {issue.description}
  //                       {issue.suggestion && <div className="logic-suggestion">💡 {issue.suggestion}</div>}
  //                     </li>
  //                   ))}
  //                 </ul>
  //               </div>
  //             )}

  //             {assistiveFeedback.codeAnalysis.performanceIssues?.length > 0 && (
  //               <div className="performance-issues">
  //                 <strong>⚡ Performance Insights:</strong>
  //                 <ul>
  //                   {assistiveFeedback.codeAnalysis.performanceIssues.map((issue, idx) => (
  //                     <li key={idx} className="performance-item">
  //                       <strong>Issue:</strong> {issue.issue}
  //                       {issue.improvement && <div className="performance-fix">🚀 {issue.improvement}</div>}
  //                     </li>
  //                   ))}
  //                 </ul>
  //               </div>
  //             )}
  //           </div>
  //         )}

  //         {/* Algorithmic Insights
  //         {assistiveFeedback.algorithmicInsights && (
  //           <div className="algorithmic-insights-section">
  //             <h5>🧮 Algorithmic Analysis</h5>
  //             {assistiveFeedback.algorithmicInsights.currentApproach && (
  //               <div className="approach-analysis">
  //                 <strong>Your Approach:</strong> {assistiveFeedback.algorithmicInsights.currentApproach}
  //               </div>
  //             )}
  //             {assistiveFeedback.algorithmicInsights.convergence && (
  //               <div className="convergence-analysis">
  //                 <strong>Alignment:</strong> {assistiveFeedback.algorithmicInsights.convergence}
  //               </div>
  //             )}
  //             {assistiveFeedback.algorithmicInsights.suggestions?.length > 0 && (
  //               <div className="algo-suggestions">
  //                 <strong>Suggestions:</strong>
  //                 <ul>
  //                   {assistiveFeedback.algorithmicInsights.suggestions.map((suggestion, idx) => (
  //                     <li key={idx}>{suggestion}</li>
  //                   ))}
  //                 </ul>
  //               </div>
  //             )}
  //           </div>
  //         )} */}

  //         {/* Next Steps */}
  //         {assistiveFeedback.nextSteps?.length > 0 && (
  //           <div className="next-steps-section">
  //             <h5>📋 Next Steps</h5>
  //             <ol>
  //               {assistiveFeedback.nextSteps.map((step, idx) => (
  //                 <li key={idx} className="step-item">
  //                   <div className="step-description">
  //                     <strong>Priority {step.priority || idx + 1}:</strong> {step.description}
  //                   </div>
  //                   {step.codeHint && (
  //                     <div className="code-hint-container">
  //                       <button
  //                         className="reveal-hint-btn"
  //                         onClick={() => toggleHintVisibility(idx)}
  //                       >
  //                         {revealedHints.has(idx) ? '🙈 Hide Hint' : '💡 Show Code Hint'}
  //                       </button>
  //                       <pre
  //                         className={`step-code-hint ${revealedHints.has(idx) ? 'revealed' : 'blurred'}`}
  //                       >
  //                         {step.codeHint}
  //                       </pre>
  //                     </div>
  //                   )}
  //                   {step.reasoning && (
  //                     <div className="step-reasoning">
  //                       <em>Why: {step.reasoning}</em>
  //                     </div>
  //                   )}
  //                 </li>
  //               ))}
  //             </ol>
  //           </div>
  //         )}

  //         {/* Technical Metrics */}
  //         {assistiveFeedback.technicalMetrics && (
  //           <div className="technical-metrics-section">
  //             <h5>Technical Metrics</h5>
  //             <div className="metrics-grid">
  //               {assistiveFeedback.technicalMetrics.currentComplexity && (
  //                 <div className="metric-item">
  //                   <div className="metric-value">{assistiveFeedback.technicalMetrics.currentComplexity}</div>
  //                   <div className="metric-label">Current Complexity</div>
  //                 </div>
  //               )}
  //               {assistiveFeedback.technicalMetrics.targetComplexity && (
  //                 <div className="metric-item">
  //                   <div className="metric-value">{assistiveFeedback.technicalMetrics.targetComplexity}</div>
  //                   <div className="metric-label">Target Complexity</div>
  //                 </div>
  //               )}
  //               {assistiveFeedback.technicalMetrics.codeCompleteness !== undefined && (
  //                 <div className="metric-item">
  //                   <div className="metric-value">{assistiveFeedback.technicalMetrics.codeCompleteness}%</div>
  //                   <div className="metric-label">Completeness</div>
  //                 </div>
  //               )}
  //             </div>
  //           </div>
  //         )}

  //         {/* Legacy sections for backward compatibility */}
  //         {assistiveFeedback.alignment?.length > 0 && (
  //           <div className="assistive-alignment">
  //             <h5>Code Alignment</h5>
  //             <ul>
  //               {assistiveFeedback.alignment.map((item, idx) => (
  //                 <li key={idx} className="alignment-item">{item}</li>
  //               ))}
  //             </ul>
  //           </div>
  //         )}

  //         {assistiveFeedback.alternateApproach && (
  //           <div className="assistive-alternate">
  //             <h5>💡 Alternative Approach</h5>
  //             <p>{assistiveFeedback.alternateApproach}</p>
  //           </div>
  //         )}

  //         {assistiveFeedback.tips?.length > 0 && (
  //           <div className="assistive-tips">
  //             <h5>💡 Tips</h5>
  //             <ul>
  //               {assistiveFeedback.tips.map((tip, idx) => (
  //                 <li key={idx} className="tip-item">{tip}</li>
  //               ))}
  //             </ul>
  //           </div>
  //         )}

  //         {assistiveFeedback.error && (
  //           <div className="assistive-error">
  //             <h5>⚠️ Notice</h5>
  //             <p>{assistiveFeedback.error}</p>
  //           </div>
  //         )}
  //       </div>
  //     ) : (
  //       <div className="assistive-feedback-placeholder">
  //         <div className="placeholder-content">
  //           <h4>Real-time AI Assistant</h4>
  //           <p>Start typing your solution to get intelligent, technical feedback!</p>
  //           <ul>
  //             <li>Syntax and logic analysis</li>
  //             <li>Performance insights</li>
  //             <li>Actionable suggestions</li>
  //             <li>Progress tracking</li>
  //           </ul>
  //         </div>
  //       </div>
  //     )}
  //   </div>
  // );

  // Function to update section content on refresh
  const refreshContent = async (section) => {
    const sessionId = ChatManager.initSession();
    const languageData = ChatManager.getLanguageData(sessionId, activeLanguage) || { chatHistory: [] };
    setRefreshingSection(section);
    setError(null);
    const question = ChatManager.getSessionData(sessionId).problemStatement;

    try {
      const response = await axios.post(
        `http://127.0.0.1:${PORT}/answerq/refresh`,
        { section, language: activeLanguage, sessionId, question, historyData: languageData },
        { headers: { "Content-Type": "application/json", "x-session-id": sessionId } }
      );

      if (response.status !== 200) throw new Error(`Server error: ${response.status}`);

      const newContent = response.data?.answer?.[section] || "No data available";
      languageData[section] = newContent;
      ChatManager.storeLanguageData(sessionId, activeLanguage, languageData);

      setSectionData((prevData) => ({
        ...prevData,
        [activeLanguage]: {
          ...prevData[activeLanguage],
          [section]: section === "Code" ? cleanCode(newContent) : newContent,
        },
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshingSection(null);
    }
  };

  const handleCopy = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    if (selectedText) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(selectedText);
      setDialoguePosition({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
      setShowDialogue(true);
    }
  };

  return (
    <div className="output-section">
      <h2 className="title">Generated Output</h2>
      <div className="output-container">
        {/* Left Panel */}
        <GlassPanel className="code-panel">
          <div className="panel-header">
            <h3 className="panel-title">
              {showTryOptions
                ? "Choose Mode"
                : showIDE && assistiveMode
                ? "AI Assistant"
                : "Code"}
            </h3>
            <div className="language-switcher">
              {!showTryOptions && (
                <>
                  {["python", "cpp", "java"].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setActiveLanguage(lang);
                        setIsTry(false);
                      }}
                      className={activeLanguage === lang ? "active" : ""}
                    >
                      {lang.toUpperCase()}
                    </button>
                  ))}
                  <button
                    className={`try-btn ${isTry ? "active" : ""}`}
                    onClick={handleClickTry}
                  >
                    {isTry ? "Trying" : "Try"}
                  </button>
                </>
              )}
            </div>
            <div className="action-buttons">
              {showIDE && (
                <button
                  onClick={handleCloseIDE}
                  className="close-ide-btn"
                >
                  ✕ Exit
                </button>
              )}
              {!showTryOptions && (
                <>
                  <button
                    className="refresh-btn"
                    onClick={() => refreshContent("Code")}
                    disabled={refreshingSection === "Code"}
                  >
                    {refreshingSection === "Code" ? "⏳" : "🔄"}
                  </button>
                  <CopyToClipboard
                    text={sectionData?.[activeLanguage]?.Code || ""}
                    onCopy={handleCopy}
                  >
                    <button className="copy-btn">
                      📋
                    </button>
                  </CopyToClipboard>
                </>
              )}
            </div>
          </div>
  
          {/* Dynamic Content */}
          {showTryOptions ? (
            <div className="try-options-content">
              <div className="try-options-inner">
                <h3>Choose Your Coding Experience</h3>
                <div className="modal-options">
                  <button
                    onClick={handleStartSkeleton}
                    className="modal-btn skeleton-btn"
                  >
                    <span className="btn-icon">🏗️</span>
                    <div>
                      <strong>Start with Skeleton</strong>
                      <small>Get a structured code template with hints</small>
                    </div>
                  </button>
                  <button
                    onClick={handleStartAssist}
                    className="modal-btn assist-btn"
                  >
                    <span className="btn-icon">🤖</span>
                    <div>
                      <strong>AI Assist Mode</strong>
                      <small>Real-time feedback as you code</small>
                    </div>
                  </button>
                </div>
                <button
                  onClick={() => setShowTryOptions(false)}
                  className="modal-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : showIDE ? (
            <Editor
              height="100%"
              language={activeLanguage}
              theme="vs-dark"
              value={generatedSkeletonCode}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
            />
          ) : (
            <div className="code-content">
              <SyntaxHighlighter
                language={activeLanguage}
                style={materialDark}
              >
                {sectionData?.[activeLanguage]?.Code || "No code generated"}
              </SyntaxHighlighter>
            </div>
          )}
        </GlassPanel>
  
        {/* Right Panel - UPDATED with new FeedbackPanel */}
        <GlassPanel className="analysis-panel">
          {showIDE && assistiveMode ? (
            <FloatingFeedbackManager
              feedback={assistiveFeedback}
              isVisible={assistiveMode && assistiveFeedback}
              editorRef={editorRef} // Pass reference to Monaco editor
            />

          ) : (
            <>
              {["Logic", "Time_Complexity", "Space_Complexity", "Improvements"].map(
                (section) => (
                  <GlassPanel className="analysis-section" key={section}>
                    <div className="analysis-header">
                      <h3 className="analysis-title">
                        {section.replace("_", " ")}
                      </h3>
                      <button
                        className="refresh-btn"
                        onClick={() => refreshContent(section)}
                        disabled={refreshingSection === section}
                      >
                        {refreshingSection === section ? "⏳" : "🔄"}
                      </button>
                    </div>
                    <div className="analysis-content">
                      <ReactMarkdown className="markdown-content">
                        {sectionData?.[activeLanguage]?.[section] ||
                          "No data available"}
                      </ReactMarkdown>
                    </div>
                  </GlassPanel>
                )
              )}
            </>
          )}
        </GlassPanel>
      </div>
      {error && <div className="error-message">Error: {error}</div>}
  
      {/* DoubtDialogue Modal */}
      {showDialogue && (
        <DoubtDialogue
          selectedText={selectedText}
          position={dialoguePosition}
          onClose={() => setShowDialogue(false)}
        />
      )}
    </div>
  );  
};

export default OutputSection;