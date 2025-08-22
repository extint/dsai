import React from "react";
import "./FeedbackPanel.css";

/* Minimal inline icon set (no external deps) */
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
  };
  return <span className={`status-icon ${type}`}>{map[type] || map.info}</span>;
};

const ProgressRing = ({ percentage = 0 }) => {
  const pct = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference - (pct / 100) * circumference;
  return (
    <div className="progress-ring">
      <svg className="progress-svg" width="64" height="64" viewBox="0 0 64 64">
        <circle className="progress-circle-bg" stroke="#334155" strokeWidth="4" fill="transparent" r={radius} cx="32" cy="32" />
        <circle
          className="progress-circle"
          stroke="#3b82f6"
          strokeWidth="4"
          fill="transparent"
          r={radius}
          cx="32"
          cy="32"
          style={{ strokeDasharray: circumference, strokeDashoffset: dash }}
        />
      </svg>
      <span className="progress-text">{pct}%</span>
    </div>
  );
};

/**
 * Normalizes raw backend payload (both “complete” and “continue”) into a single UI model.
 */
function normalizeFeedback(raw) {
  if (!raw || typeof raw !== "object") return null;

  const {
    // common fields
    progressSummary = "",
    completionPercentage = 0,
    provider = raw.aiMetadata?.provider || "",
    processingTime,
    message,

    // present only in “continue” branch
    algorithmicInsights: aiRaw,
    technicalMetrics: tmRaw,
    nextSteps: stepsRaw,

    // always present
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

  // quality -> UI “qualityIssues”
  const qualityIssues = Array.isArray(codeQuality.improvements)
    ? codeQuality.improvements.map((issue) => ({ issue }))
    : [];

  // algorithmic insights: prefer backend; else derive from complexityAnalysis
  const algorithmicInsights = {
    currentApproach:
      (aiRaw && aiRaw.currentApproach) ||
      complexityAnalysis.explanation ||
      "",
    suggestions: (aiRaw && aiRaw.suggestions) ||
      (Array.isArray(logicIssues) ? logicIssues.map((i) => i.suggestion).filter(Boolean) : []),
  };

  // technical metrics: prefer backend; else derive from complexityAnalysis + completion
  const currentComplexityDerived =
    complexityAnalysis.timeComplexity && complexityAnalysis.spaceComplexity
      ? `${complexityAnalysis.timeComplexity} / ${complexityAnalysis.spaceComplexity}`
      : "N/A";

  const targetComplexityDerived =
    typeof complexityAnalysis.isOptimal === "boolean"
      ? complexityAnalysis.isOptimal
        ? "Optimal"
        : "Can be improved"
      : "N/A";

  const technicalMetrics = {
    currentComplexity: (tmRaw && tmRaw.currentComplexity) || currentComplexityDerived,
    targetComplexity: (tmRaw && tmRaw.targetComplexity) || targetComplexityDerived,
    codeCompleteness: (tmRaw && Number(tmRaw.codeCompleteness)) || Number(completionPercentage) || 0,
    correctnessScore: correctnessScore, // may be undefined in “continue”
  };

  // next steps: prefer backend; else derive from quality improvements
  const nextSteps =
    (Array.isArray(stepsRaw) && stepsRaw.length
      ? stepsRaw
      : qualityIssues.map((q, idx) => ({
        priority: idx + 1,
        description: q.issue,
        reasoning: "Suggested improvement",
      }))) || [];

  // praise: prefer provided; else infer; else fallback to message
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

const FeedbackPanel = ({ feedback }) => {
  const data = normalizeFeedback(feedback);

  if (!data) {
    return (
      <div className="modern-feedback-panel feedback-placeholder">
        <div className="placeholder-animation">
          <span className="ai-icon">🤖</span>
          <h3>Start Coding for AI Feedback</h3>
          <p>Unlock real-time code analysis, performance insights, and step-by-step guidance.</p>
          <div className="feature-list">
            <div className="feature-item"><Icon type="code" /> Real-time code analysis</div>
            <div className="feature-item"><Icon type="analytics" /> Algorithmic insights</div>
            <div className="feature-item"><Icon type="steps" /> Next-step actions</div>
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
    <div className="modern-feedback-panel">
      {/* Header */}
      <div className="feedback-header">
        <div className="header-content">
          <div className="status-section">
            <ProgressRing percentage={completionPercentage} />
            <div className="status-text">
              <h2>AI Code Analysis</h2>
              <p className="progress-summary">{progressSummary || "Analyzing..."}</p>
              <div className="loading-indicator">
                {provider ? (<><Icon type="info" /><span>Powered by {provider}</span></>) : null}
                {processingTime ? (<><span style={{ marginLeft: 8 }}><Icon type="analytics" /> {processingTime}ms</span></>) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

     

      {/* Content */}
      <div className="feedback-content">

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <section className="next-steps-section">
          <h3 className="section-title"><Icon type="steps" /> Next Steps</h3>
          <div className="steps-container">
            {nextSteps.map((step, i) => (
              <div key={`${step.priority ?? i}-${i}`} className="step-card">
                <span className="step-number">{step.priority ?? i + 1}</span>
                <div className="step-content">
                  <h4>{step.description || "Suggested Improvement"}</h4>
                  {step.reasoning ? <p className="step-reasoning">{step.reasoning}</p> : null}
                  {step.codeHint ? (
                    <div className="code-hint-container">
                      <pre className="code-hint revealed">{step.codeHint}</pre>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

        {/* Code Analysis */}
        <section className="analysis-section">
          <h3 className="section-title"><Icon type="code" /> Code Analysis</h3>
          <div className="analysis-grid">
            {/* Syntax */}
            <div className={`analysis-card ${syntaxErrors.length ? "error" : "success"}`}>
              <div className="card-header"><Icon type="code" /><h4>Syntax</h4></div>
              <div className="card-content">
                {syntaxErrors.length ? (
                  <ul className="issue-list">
                    {syntaxErrors.map((e, idx) => (
                      <li key={idx} className="error-item">
                        {e.line ? <span className="line-number">Ln {e.line}</span> : null}
                        {e.message || JSON.stringify(e)}
                        {e.fix ? <div className="fix-suggestion"><Icon type="success" />{e.fix}</div> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="success-state"><Icon type="success" /> Clean syntax detected</p>
                )}
              </div>
            </div>

            {/* Logic */}
            <div className={`analysis-card ${logicIssues.length ? "warning" : "success"}`}>
              <div className="card-header"><Icon type="insights" /><h4>Logic</h4></div>
              <div className="card-content">
                {logicIssues.length ? (
                  <ul className="issue-list">
                    {logicIssues.map((issue, idx) => (
                      <li key={idx} className="logic-item">
                        <span className={`severity-badge ${issue.severity || "medium"}`}>{issue.severity || "medium"}</span>
                        {issue.description || JSON.stringify(issue)}
                        {issue.suggestion ? <div className="logic-suggestion"><Icon type="info" />{issue.suggestion}</div> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="success-state"><Icon type="success" /> Logic flow looks good</p>
                )}
              </div>
            </div>

            {/* Performance (no data -> neutral) */}
            <div className="analysis-card">
              <div className="card-header"><Icon type="analytics" /><h4>Performance</h4></div>
              <div className="card-content">
                <p className="progress-summary">No performance issues reported.</p>
              </div>
            </div>

            {/* Quality */}
            <div className={`analysis-card ${qualityIssues.length ? "info" : ""}`}>
              <div className="card-header"><Icon type="info" /><h4>Quality</h4></div>
              <div className="card-content">
                {qualityIssues.length ? (
                  <ul className="issue-list">
                    {qualityIssues.map((q, idx) => (
                      <li key={idx} className="quality-item">{q.issue}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="progress-summary">No quality suggestions available.</p>
                )}
              </div>
            </div>

            {/* Critical Issues (if any) */}
            {criticalIssues.length > 0 && (
              <div className="analysis-card error" style={{ gridColumn: "1 / -1" }}>
                <div className="card-header"><Icon type="error" /><h4>Critical Issues</h4></div>
                <div className="card-content">
                  <ul className="issue-list">
                    {criticalIssues.map((c, idx) => <li key={idx} className="error-item">{typeof c === "string" ? c : JSON.stringify(c)}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Technical Metrics */}
        <section className="metrics-section">
          <h3 className="section-title"><Icon type="metrics" /> Technical Metrics</h3>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-header"><h4>Time / Space</h4></div>
              <div className="metric-content">
                <p className="metric-value">{technicalMetrics.currentComplexity}</p>
                <p className="metric-label">Complexity</p>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-header"><h4>Optimization</h4></div>
              <div className="metric-content">
                <p className="metric-value">{technicalMetrics.targetComplexity}</p>
                <p className="metric-label">Target</p>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-header"><h4>Completeness</h4></div>
              <div className="metric-content">
                <p className="metric-value">{technicalMetrics.codeCompleteness}%</p>
                <p className="metric-label">Code Completeness</p>
              </div>
            </div>
            {typeof technicalMetrics.correctnessScore === "number" && (
              <div className="metric-card">
                <div className="metric-header"><h4>Correctness</h4></div>
                <div className="metric-content">
                  <p className="metric-value">{technicalMetrics.correctnessScore}%</p>
                  <p className="metric-label">Score</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Algorithmic Insights */}
        {algorithmicInsights.currentApproach ? (
          <section className="insights-section">
            <h3 className="section-title"><Icon type="insights" /> Algorithmic Insights</h3>
            <div className="insights-content">
              <div className="insight-card">
                <h4>Your Approach</h4>
                <p className="long-text-content">{algorithmicInsights.currentApproach}</p>
              </div>
              {Array.isArray(algorithmicInsights.suggestions) && algorithmicInsights.suggestions.length > 0 && (
                <div className="insight-card">
                  <h4>Suggestions</h4>
                  <ul className="legacy-list">
                    {algorithmicInsights.suggestions.map((s, idx) => (
                      <li key={idx} className="legacy-item"><Icon type="info" />{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        ) : null}


        {/* Positive Aspects */}
        {positiveAspects.length > 0 && (
          <section className="legacy-section">
            <h3 className="section-title"><Icon type="success" /> What's Working Well</h3>
            <ul className="legacy-list">
              {positiveAspects.map((p, idx) => (
                <li key={idx} className="legacy-item"><Icon type="success" />{p}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Praise */}
        {praise ? (
          <section className="encouragement-section">
            <div className="encouragement-card">
              <Icon type="success" />
              <p>{praise}</p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default FeedbackPanel;
