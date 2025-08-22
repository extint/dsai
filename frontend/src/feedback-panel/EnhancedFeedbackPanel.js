import React, { useState } from "react";
import "./FeedbackPanel-Enhanced.css";

const Icon = ({ type }) => {
  const map = {
    success: "✅",
    warning: "⚠️",
    error: "❌",
    info: "ℹ️",
    code: "⌨️",
    analytics: "📈",
    insights: "💡",
    steps: "📝",
    metrics: "📊",
    minimize: "➖",
    close: "✕",
    expand: "📋"
  };
  return <span className={`status-icon ${type}`}>{map[type] || map.info}</span>;
};

const ProgressRing = ({ percentage = 0 }) => {
  const pct = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - (pct / 100) * circumference;
  
  return (
    <div className="progress-ring">
      <svg className="progress-svg" width="48" height="48" viewBox="0 0 48 48">
        <circle 
          className="progress-circle-bg" 
          stroke="#334155" 
          strokeWidth="3" 
          fill="transparent" 
          r={radius} 
          cx="24" 
          cy="24" 
        />
        <circle
          className="progress-circle"
          stroke="#3b82f6"
          strokeWidth="3"
          fill="transparent"
          r={radius}
          cx="24"
          cy="24"
          style={{ strokeDasharray: circumference, strokeDashoffset: dash }}
        />
      </svg>
      <span className="progress-text">{pct}%</span>
    </div>
  );
};

function normalizeFeedback(raw) {
  if (!raw || typeof raw !== "object") return null;

  const {
    progressSummary = "",
    completionPercentage = 0,
    provider = raw.aiMetadata?.provider || "",
    processingTime,
    message,
    algorithmicInsights: aiRaw,
    technicalMetrics: tmRaw,
    nextSteps: stepsRaw,
    codeAnalysis: caRaw = {},
  } = raw;

  const {
    syntaxErrors = [],
    logicIssues = [],
    criticalIssues = [],
    complexityAnalysis = {},
    codeQuality = {},
    correctnessScore,
    positiveAspects = [],
  } = caRaw;

  const qualityIssues = Array.isArray(codeQuality.improvements)
    ? codeQuality.improvements.map((issue) => ({ issue }))
    : [];

  const algorithmicInsights = {
    currentApproach:
      (aiRaw && aiRaw.currentApproach) ||
      complexityAnalysis.explanation ||
      "",
    suggestions: (aiRaw && aiRaw.suggestions) ||
      (Array.isArray(logicIssues) ? logicIssues.map((i) => i.suggestion).filter(Boolean) : []),
  };

  const currentComplexityDerived =
    complexityAnalysis.timeComplexity && complexityAnalysis.spaceComplexity
      ? `${complexityAnalysis.timeComplexity} / ${complexityAnalysis.spaceComplexity}`
      : "N/A";

  const targetComplexityDerived =
    typeof complexityAnalysis.isOptimal === "boolean"
      ? complexityAnalysis.isOptimal ? "Optimal" : "Can be improved"
      : "N/A";

  const technicalMetrics = {
    currentComplexity: (tmRaw && tmRaw.currentComplexity) || currentComplexityDerived,
    targetComplexity: (tmRaw && tmRaw.targetComplexity) || targetComplexityDerived,
    codeCompleteness: (tmRaw && Number(tmRaw.codeCompleteness)) || Number(completionPercentage) || 0,
    correctnessScore: correctnessScore,
  };

  const nextSteps = (Array.isArray(stepsRaw) && stepsRaw.length
    ? stepsRaw
    : qualityIssues.map((q, idx) => ({
        priority: idx + 1,
        description: q.issue,
        reasoning: "Suggested improvement",
      }))) || [];

  let praise = raw.praise || "";
  if (!praise) {
    if (Number(correctnessScore) >= 90) praise = "🎉 Excellent work! Your solution is highly correct and efficient.";
    else if (Number(correctnessScore) >= 75) praise = "✅ Good work! There are some areas for improvement.";
    else if (Number(correctnessScore) > 0) praise = "💪 Keep iterating to improve your solution.";
    else if (message) praise = message;
  }

  return {
    progressSummary,
    completionPercentage: Number(completionPercentage) || 0,
    provider,
    processingTime,
    codeAnalysis: {
      syntaxErrors: Array.isArray(syntaxErrors) ? syntaxErrors : [],
      logicIssues: Array.isArray(logicIssues) ? logicIssues : [],
      criticalIssues: Array.isArray(criticalIssues) ? criticalIssues : [],
      qualityIssues,
    },
    algorithmicInsights,
    nextSteps,
    technicalMetrics,
    positiveAspects: Array.isArray(positiveAspects) ? positiveAspects : [],
    praise,
  };
}

const EnhancedFeedbackPanel = ({ 
  feedback, 
  isFloating = false, 
  isCompact = false,
  onMinimize,
  onClose,
  onExpand 
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [revealedHints, setRevealedHints] = useState(new Set());
  
  const data = normalizeFeedback(feedback);

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

  if (!data) {
    return (
      <div className={`modern-feedback-panel ${isFloating ? 'feedback-panel-floating' : ''} ${isCompact ? 'feedback-panel-compact' : ''}`}>
        <div className="feedback-placeholder">
          <div className="placeholder-animation">
            <span className="ai-icon">🤖</span>
            <h3>Start Coding for AI Feedback</h3>
            <p>Get real-time analysis as you type</p>
            <div className="feature-list">
              <div className="feature-item"><Icon type="code" /> Real-time analysis</div>
              <div className="feature-item"><Icon type="analytics" /> Performance insights</div>
              <div className="feature-item"><Icon type="steps" /> Next steps</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    progressSummary,
    completionPercentage,
    provider,
    processingTime,
    codeAnalysis: { syntaxErrors, logicIssues, criticalIssues, qualityIssues },
    algorithmicInsights,
    nextSteps,
    technicalMetrics,
    positiveAspects,
    praise,
  } = data;

  return (
    <div className={`modern-feedback-panel ${isFloating ? 'feedback-panel-floating' : ''} ${isCompact ? 'feedback-panel-compact' : ''}`}>
      {/* Header */}
      <div className="feedback-header">
        <div className="status-section">
          <ProgressRing percentage={completionPercentage} />
          <div className="status-text">
            <h2>AI Analysis</h2>
            <p className="progress-summary">{progressSummary || "Analyzing..."}</p>
            <div className="loading-indicator">
              {provider && <><Icon type="info" /><span>{provider}</span></>}
              {processingTime && <><Icon type="analytics" /><span>{processingTime}ms</span></>}
            </div>
          </div>
        </div>
        
        {isFloating && (
          <div className="panel-controls">
            <button className="control-btn minimize" onClick={onMinimize}>
              <Icon type="minimize" />
            </button>
            <button className="control-btn expand" onClick={onExpand}>
              <Icon type="expand" />
            </button>
            <button className="control-btn close" onClick={onClose}>
              <Icon type="close" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="feedback-content">
        {/* Analysis Cards - Horizontal */}
        <section className="analysis-section">
          <h3 className="section-title"><Icon type="code" /> Code Analysis</h3>
          <div className="analysis-grid">
            <div className={`analysis-card ${syntaxErrors.length ? "error" : "success"}`}>
              <div className="card-header">
                <Icon type="code" />
                <h4>Syntax</h4>
              </div>
              <div className="card-content">
                {syntaxErrors.length ? (
                  <><span className="issue-count">{syntaxErrors.length}</span>Issues found</>
                ) : (
                  <span className="success-state"><Icon type="success" />Clean</span>
                )}
              </div>
            </div>

            <div className={`analysis-card ${logicIssues.length ? "warning" : "success"}`}>
              <div className="card-header">
                <Icon type="insights" />
                <h4>Logic</h4>
              </div>
              <div className="card-content">
                {logicIssues.length ? (
                  <><span className="issue-count">{logicIssues.length}</span>Issues found</>
                ) : (
                  <span className="success-state"><Icon type="success" />Good</span>
                )}
              </div>
            </div>

            <div className="analysis-card">
              <div className="card-header">
                <Icon type="analytics" />
                <h4>Performance</h4>
              </div>
              <div className="card-content">
                <span className="success-state">No issues</span>
              </div>
            </div>

            <div className={`analysis-card ${qualityIssues.length ? "info" : ""}`}>
              <div className="card-header">
                <Icon type="info" />
                <h4>Quality</h4>
              </div>
              <div className="card-content">
                {qualityIssues.length ? (
                  <><span className="issue-count">{qualityIssues.length}</span>Suggestions</>
                ) : (
                  <span className="success-state">Good</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Metrics */}
        <section className="metrics-section">
          <h3 className="section-title"><Icon type="metrics" /> Metrics</h3>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-value">{technicalMetrics.currentComplexity}</div>
              <div className="metric-label">Complexity</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{technicalMetrics.targetComplexity}</div>
              <div className="metric-label">Target</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">{technicalMetrics.codeCompleteness}%</div>
              <div className="metric-label">Complete</div>
            </div>
            {typeof technicalMetrics.correctnessScore === "number" && (
              <div className="metric-card">
                <div className="metric-value">{technicalMetrics.correctnessScore}%</div>
                <div className="metric-label">Correct</div>
              </div>
            )}
          </div>
        </section>

        {/* Insights */}
        {algorithmicInsights.currentApproach && (
          <section className="insights-section">
            <h3 className="section-title"><Icon type="insights" /> Approach</h3>
            <div className="insights-content">
              <p>{algorithmicInsights.currentApproach}</p>
            </div>
          </section>
        )}

        {/* Next Steps - Tabbed */}
        {nextSteps.length > 0 && (
          <section className="next-steps-section">
            <h3 className="section-title"><Icon type="steps" /> Next Steps</h3>
            
            <div className="steps-tabs">
              {nextSteps.map((step, index) => (
                <button
                  key={index}
                  className={`step-tab ${activeStep === index ? 'active' : ''}`}
                  onClick={() => setActiveStep(index)}
                >
                  Step {step.priority || index + 1}
                </button>
              ))}
            </div>

            <div className="steps-content">
              {nextSteps.map((step, index) => (
                <div
                  key={index}
                  className={`step-detail ${activeStep === index ? 'active' : ''}`}
                >
                  <div className="step-header">
                    <span className="step-number">{step.priority || index + 1}</span>
                    <h4 className="step-title">{step.description || "Improvement"}</h4>
                  </div>
                  
                  {step.reasoning && (
                    <p className="step-reasoning">{step.reasoning}</p>
                  )}
                  
                  {step.codeHint && (
                    <div className="code-hint-container">
                      <button
                        className="reveal-hint-btn"
                        onClick={() => toggleHintVisibility(index)}
                      >
                        <Icon type="code" />
                        {revealedHints.has(index) ? 'Hide Hint' : 'Show Code Hint'}
                      </button>
                      {revealedHints.has(index) && (
                        <pre className="code-hint">{step.codeHint}</pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Praise */}
        {praise && (
          <div style={{ 
            gridColumn: "1 / -1", 
            background: "linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(16, 185, 129, 0.08))",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "8px",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            color: "#86efac"
          }}>
            <Icon type="success" />
            <span>{praise}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedFeedbackPanel;