import React, { useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import Editor from "@monaco-editor/react";
import {
  Copy, ChevronDown, MessageSquare, Lightbulb
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import ChatManager from "./ChatManager";
import "./CodeInput.css";

const PORT = process.env.REACT_APP_PORT;

const CodeInput = () => {
  const sessionId = ChatManager.initSession();
  const [code, setCode] = useState("// Type your code here");
  const [language, setLanguage] = useState("javascript");
  const [processedTasks, setProcessedTasks] = useState(new Set());
  const [pendingTask, setPendingTask] = useState(null);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("explanations");
  const [explanations, setExplanations] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editor, setEditor] = useState(null);
  const [monaco, setMonaco] = useState(null);

  // LANGUAGES
  const languages = {
    "General": ["Python", "JavaScript", "Java", "C++"],
  };

  // Markdown rendering for explanations
  const components = {
    code: ({ node, inline, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const lang = match ? match[1] : 'javascript';
      return !inline && className ? (
        <SyntaxHighlighter
          style={materialDark}
          language={lang}
          PreTag="div"
          {...props}
        >{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
      ) : (
        <code className="codeinput-inline">{children}</code>
      );
    }
  };

  // Utility: debounce
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Theme and options for Monaco editor
  const handleEditorDidMount = (editor, monaco) => {
    setEditor(editor);
    setMonaco(monaco);

    monaco.editor.defineTheme('professionalTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff7b72', fontStyle: 'bold' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'number', foreground: '79c0ff' },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#21262d',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41',
        'editorCursor.foreground': '#58a6ff',
        'editor.findMatchBackground': '#ffd33d44',
        'editor.findMatchHighlightBackground': '#ffd33d22',
      }
    });

    monaco.editor.setTheme('professionalTheme');
    editor.updateOptions({
      smoothScrolling: true,
      cursorSmoothCaretAnimation: true,
      fontLigatures: true,
      fontSize: 14,
      lineHeight: 1.6,
      letterSpacing: 0.5,
      padding: { top: 16, bottom: 16 },
    });
  };

  // Handle code changes and /end
  const handleEditorChange = debounce(async (value) => {
    setCode(value);
    const lines = value.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    if (lastLine === '/end') {
      if (pendingTask) {
        sendQueryToBackend(pendingTask, value);
        setPendingTask(null);
        lines.pop();
        setCode(lines.join('\n'));
      }
    } else {
      const dsaiTask = extractDSAITask(value);
      if (dsaiTask && !pendingTask) setPendingTask(dsaiTask);
    }
  }, 120);

  // Language switcher
  const handleLanguageChange = (lang) => {
    setLanguage(lang.toLowerCase());
    setIsLanguageDropdownOpen(false);
  };

  // Backend: Code analysis
  const analyzeCode = async (currentCode) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/answerq/analyze-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          language,
          types: ["explanations"],
          sessionId
        }),
      });
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      // safety: ensure array
      if (Array.isArray(data.explanations)) {
        setExplanations(data.explanations);
      } else if (typeof data.explanations === "string") {
        setExplanations([data.explanations]);
      } else {
        setExplanations([]);
      }
    } catch (error) {
      console.error("Code analysis failed:", error);
      setExplanations(["Could not analyze code."]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analysisHandler = () => analyzeCode(code);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
  };

  const extractDSAITask = (currentCode) => {
    const lines = currentCode.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('@dsai') && !processedTasks.has(i)) {
        const task = line.substring(line.indexOf('@dsai') + 5).trim();
        return { task, lineIndex: i };
      }
    }
    return null;
  };

  // DSAI code insertion (unchanged, for your backend functionality)
  const extractCodeBlock = (data) => {
    try {
      let text = typeof data === 'string' ? data : String(data);
      const codeBlockRegex = /``````/;
      const match = text.match(codeBlockRegex);
      if (match && match[1]) return match[1].trim();
      return text.trim();
    } catch (error) {
      return '';
    }
  };

  const sendQueryToBackend = async (dsaiTask, currentCode) => {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/answerq/code-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          task: dsaiTask.task,
          language: language,
          sessionId: sessionId
        }),
      });
      const result = await response.json();
      if (result.answer && result.answer.code) {
        const codeOnly = extractCodeBlock(result.answer.code);
        const lines = currentCode.split('\n');
        lines.splice(dsaiTask.lineIndex + 1, 0, codeOnly);
        setCode(lines.join('\n'));
        setProcessedTasks(prev => new Set([...prev, dsaiTask.lineIndex]));
      }
    } catch (error) {
      console.error("Error sending request to backend:", error);
    }
  };

  return (
    <div className="codeinput-root">
      <div className="codeinput-panel">
        {/* HEADER */}
        <div className="codeinput-header">
          <div className="codeinput-lang-dropdown">
            <button
              className="codeinput-lang-btn"
              onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
              aria-expanded={isLanguageDropdownOpen}
            >
              <span role="img" aria-label="language">💻</span>
              <span>{language.charAt(0).toUpperCase() + language.slice(1)}</span>
              <ChevronDown size={16} />
            </button>
            {isLanguageDropdownOpen && (
              <div className="codeinput-lang-list">
                {Object.entries(languages).map(([category, langs]) => (
                  <div key={category}>
                    {/* <div className="codeinput-lang-category"></div> */}
                    {langs.map((lang) => (
                      <button
                        key={lang}
                        className="codeinput-lang-option"
                        onClick={() => handleLanguageChange(lang)}
                      >{lang}</button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="codeinput-toolbar-actions">
            {pendingTask && (
              <span className="codeinput-status-pending">
                <span className="codeinput-spinner" />Pending: {pendingTask.task.substring(0, 32)}...
              </span>
            )}
            {isAnalyzing && (
              <span className="codeinput-status-analyzing">
                <span className="codeinput-spinner" />Analyzing...
              </span>
            )}
            <button className="codeinput-toolbar-btn" onClick={analysisHandler} title="Analyze code">
              <Lightbulb size={17} />
            </button>
            <button className="codeinput-toolbar-btn" onClick={copyToClipboard} title="Copy to Clipboard">
              <Copy size={17} />
            </button>
          </div>
        </div>
        <div className="codeinput-body">
          {/* CODE EDITOR */}
          <div className="codeinput-editor-wrap">
            <div className="codeinput-editor">
              <Editor
                height="430px"
                language={language}
                value={code}
                onChange={handleEditorChange}
                onMount={handleEditorDidMount}
                options={{
                  selectOnLineNumbers: true,
                  automaticLayout: true,
                  fontSize: 14,
                  lineHeight: 1.6,
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  scrollBeyondLastLine: false
                }}
              />
            </div>
          </div>
          {/* EXCALIDRAW */}
          <div className="codeinput-excalidraw-wrap" style={{ margin: "32px 0", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 24px #0002" }}>
            <Excalidraw />
          </div>
        </div>
        {/* ONLY EXPLANATION TAB */}
        <div className="codeinput-insights-panel">
          {/* Single Tab - Looks cleaner */}
          <div className="codeinput-tabs">
            <button className="codeinput-tab-btn active" disabled>
              <MessageSquare size={16} />
              Explanations
              <span className="codeinput-tab-count">{Array.isArray(explanations) ? explanations.length : (explanations ? 1 : 0)}</span>
            </button>
          </div>
          <div className="codeinput-content-section">
            {isAnalyzing ? (
              <div className="codeinput-empty-state">
                <h3>Analyzing...</h3>
              </div>
            ) :
              (Array.isArray(explanations) ? explanations : explanations ? [explanations] : []).length === 0 ? (
                <div className="codeinput-empty-state">
                  <h3>No Explanations</h3>
                  <p>Click analyze to get code insights</p>
                </div>
              ) : (
                (Array.isArray(explanations) ? explanations : [explanations]).map((e, i) => (
                  <div key={i} className="codeinput-insight-item explanation">
                    <div className="codeinput-markdown-wrapper">
                      <ReactMarkdown components={components}>{e}</ReactMarkdown>
                    </div>
                  </div>
                ))
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeInput;
