import React, { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { Copy, ChevronDown, Lightbulb, Maximize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

const PORT = process.env.REACT_APP_PORT;

const DSAIEditor = ({ 
  defaultCode = "# Type your code here", 
  language = "python",
  readOnly = false,
  onChange
}) => {
  const [code, setCode] = useState(defaultCode);
  const [processedTasks, setProcessedTasks] = useState(new Set());
  const [pendingTask, setPendingTask] = useState(null);
  const [explanations, setExplanations] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editor, setEditor] = useState(null);
  const [monaco, setMonaco] = useState(null);
  const [activeSection, setActiveSection] = useState("explanations");
  const lastDefaultCode = useRef(defaultCode);

  // Only update code when defaultCode actually changes and is different
  useEffect(() => {
    if (defaultCode !== lastDefaultCode.current && defaultCode !== code) {
      lastDefaultCode.current = defaultCode;
      setCode(defaultCode);
    }
  }, [defaultCode, code]);

  const handleEditorDidMount = (editor, monaco) => {
    setEditor(editor);
    setMonaco(monaco);
    monaco.editor.defineTheme('customTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.lineHighlightBackground': '#1f1f1f'
      }
    });
    monaco.editor.setTheme('customTheme');
  };

  const extractDSAITask = (code) => {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('@dsai') && !processedTasks.has(i)) {
        const task = line.substring(line.indexOf('@dsai') + 5).trim();
        return { task, lineIndex: i };
      }
    }
    return null;
  };

  const extractCodeBlock = (text) => {
    const codeBlockRegex = /``````/;
    const match = text.match(codeBlockRegex);
    return match ? match[1].trim() : text;
  };

  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const sendQueryToBackend = async (dsaiTask, currentCode) => {
    if (readOnly) return;
    
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/answerq/code-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          task: dsaiTask.task,
          language
        })
      });
      const result = await res.json();
      if (result.answer) {
        const codeOnly = extractCodeBlock(result.answer);
        const lines = currentCode.split('\n');
        lines.splice(dsaiTask.lineIndex + 1, 0, codeOnly);
        const updatedCode = lines.join('\n');
        setCode(updatedCode);
        if (onChange) onChange(updatedCode);
        setProcessedTasks(prev => new Set([...prev, dsaiTask.lineIndex]));
      }
    } catch (err) {
      console.error("Backend error:", err);
    }
  };

  const analyzeCode = async (currentCode) => {
    if (readOnly) return;
    
    setIsAnalyzing(true);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/answerq/analyze-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: currentCode,
          language,
          types: ["explanations"]
        })
      });
      const analysis = await res.json();
      setExplanations(analysis.explanations || []);
    } catch (err) {
      console.error("Analysis failed", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEditorChange = debounce((value) => {
    if (readOnly) return;
    
    setCode(value);
    if (onChange) onChange(value);
    
    const lines = value.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    
    if (lastLine === "/end" && pendingTask) {
      sendQueryToBackend(pendingTask, value);
      setPendingTask(null);
      lines.pop();
      const newCode = lines.join('\n');
      setCode(newCode);
      if (onChange) onChange(newCode);
    } else {
      const dsaiTask = extractDSAITask(value);
      if (dsaiTask && !pendingTask) setPendingTask(dsaiTask);
    }
  }, 100);

  return (
    <div className="dsai-editor-container">
      <Editor
        height="100%"
        defaultLanguage={language}
        value={code}
        onMount={handleEditorDidMount}
        onChange={handleEditorChange}
        options={{
          readOnly,
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          theme: 'customTheme'
        }}
      />
    </div>
  );
};

export default DSAIEditor;
