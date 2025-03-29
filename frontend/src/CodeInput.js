import React, { useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import Editor from "@monaco-editor/react";
import "./CodeInput.css";
import { Copy, ChevronDown, Maximize2, XCircle, AlertCircle, MessageSquare, Bug, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"; // Use Prism for syntax highlighting
import { materialDark } from "react-syntax-highlighter/dist/cjs/styles/prism"; // Dark theme for syntax highlighting

const App = () => {
  const [code, setCode] = useState("// Type your code here");
  const [language, setLanguage] = useState("javascript");
  const [processedTasks, setProcessedTasks] = useState(new Set());
  const [pendingTask, setPendingTask] = useState(null);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("issues");

    // New state for intelligent features
    const [diagnostics, setDiagnostics] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [explanations, setExplanations] = useState([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [editor, setEditor] = useState(null);
    const [monaco, setMonaco] = useState(null);

    const UIOptions = {
      canvasActions: {
        changeViewBackgroundColor: false,
        clearCanvas: false,
        loadScene: false,
        toggleTheme:true,
      },
    };

    const components = {
      p: ({ node, ...props }) => <p style={{ color: 'white', textAlign: "left" }} {...props} />,
      h1: ({ node, ...props }) => <h1 style={{ textAlign: "left" }} {...props} />,
      // Custom component for code blocks using SyntaxHighlighter
      code: ({ node, inline, className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : 'javascript'; // Default to JavaScript if no language specified
  
        return !inline && className ? (
          <SyntaxHighlighter
            style={materialDark} // Use the dark theme
            language={language}
            PreTag="div" // Use div instead of pre for better styling
            customStyle={{
              margin: "0",
              borderRadius: "4px",
              backgroundColor: "#2d2d2d", // Match your dark theme
              padding: "12px",
              fontSize: "14px",
              width: "100%",
              maxWidth: "100%",
              textAlign: "left", // Ensure left alignment
              overflowX: "auto", // Enable horizontal scrolling for long lines
            }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        ) : (
          <code style={{ color: 'white', backgroundColor: '#2d2d2d', padding: '2px 4px', borderRadius: "4px" }} {...props}>
            {children}
          </code>
        );
      },
    };

    const languages = {
      "General": ["Python", "JavaScript", "Java", "C++"],
    };
  
    // Debounce function
    const debounce = (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    };
  
    // Handle editor mount
    const handleEditorDidMount = (editor, monaco) => {
      setEditor(editor);
      setMonaco(monaco);
  
      monaco.editor.defineTheme('customTheme', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.lineHighlightBackground': '#1f1f1f',
        }
      });
  
      monaco.editor.setTheme('customTheme');
    };
  
    // Analyze code function
    const analyzeCode = async (currentCode) => {
      setIsAnalyzing(true);
      try {
        const response = await fetch("http://127.0.0.1:5000/analyze-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: currentCode,
            language,
            types: ["errors", "suggestions", "explanations"]
          }),
        });
  
        if (!response.ok) throw new Error('Analysis failed');
        
        const analysis = await response.json();
        return analysis;
      } catch (error) {
        console.error("Code analysis failed:", error);
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    };

    const analysisHandler = async () => {
      // New code analysis
      const analysis = await analyzeCode(code);
      if (analysis) {
        // updateDecorations(analysis);
        console.log(analysis)
        setDiagnostics([]);
        setSuggestions(analysis.suggestions || []);
        setExplanations(analysis.explanations || ["please"]);
      }
    }
  
    // Enhanced handle editor change
    const handleEditorChange = debounce(async (value) => {
      setCode(value);
      
      // Existing DSAI task processing
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
        if (dsaiTask && !pendingTask) {
          setPendingTask(dsaiTask);
        }
      }
  
    }, 100);

  const handleLanguageChange = (lang) => {
    setLanguage(lang.toLowerCase());
    setIsLanguageDropdownOpen(false);
  };

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

  const extractCodeBlock = (text) => {
    const codeBlockRegex = /```(?:\w+\n)?([\s\S]*?)```/;
    const match = text.match(codeBlockRegex);
    if (match) {
      return match[1].trim();
    }
    return text;
  };

  // const handleEditorChange = (value) => {
  //   setCode(value);
    
  //   // Check if the last line contains "/end"
  //   const lines = value.split('\n');
  //   const lastLine = lines[lines.length - 1].trim();
  //   // console.log(lines)
  //   // console.log(lastLine)
  //   if (lastLine === '/end') {
  //     // If there's a pending task, process it
  //     if (pendingTask) {
  //       console.log("sending task to backend", pendingTask, value);
  //       sendQueryToBackend(pendingTask, value);
  //       setPendingTask(null);
        
  //       // Remove the /end line
  //       lines.pop();
  //       setCode(lines.join('\n'));
  //     }
  //   } else {
  //     // Check for new @dsai task
  //     const dsaiTask = extractDSAITask(value);
  //     if (dsaiTask && !pendingTask) {
  //       setPendingTask(dsaiTask);
  //     }
  //   }
  // };

  const sendQueryToBackend = async (dsaiTask, currentCode) => {
    try {
      const response = await fetch("http://127.0.0.1:5000/code-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          code: currentCode,
          task: dsaiTask.task,
          language: language 
        }),
      });

      // if (!response.ok) {
      //   throw new Error(`Server error: ${response.statusText}`);
      // }

      const result = await response.json();
      if (result.answer) {
        // Extract only the code block from the response
        const codeOnly = extractCodeBlock(result.answer);
        
        // Split the code into lines
        const lines = currentCode.split('\n');
        
        // Insert the code block after the @dsai comment
        lines.splice(dsaiTask.lineIndex + 1, 0, codeOnly);
        
        // Join the lines back together and update the code
        const updatedCode = lines.join('\n');
        console.log("repsonse from backend",updatedCode);
        setCode(updatedCode);

        // Mark this task as processed
        setProcessedTasks(prev => new Set([...prev, dsaiTask.lineIndex]));
      }
    } catch (error) {
      console.error("Error sending request to backend:", error);
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "20px",
      width: "150%",
      maxWidth: "1400px",
      margin: "0 auto",
      marginBottom: "-20px",
      marginLeft: "-9%",
      minHeight: "60vh",
      gap: "20px"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: "40px",
        width: "100%",
      }}>
        {/* Editor container with feedback panel */}
        <div style={{
          flex: "1",
          maxWidth: "700px",
          height: "700px",
          border: "1px solid #2d2d2d",
          borderRadius: "8px",
          overflow: "hidden",
          backgroundColor: "#1e1e1e",
          display: "flex",
          flexDirection: "column"
        }}>
          {/* Custom header */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            backgroundColor: "#2d2d2d",
            borderBottom: "1px solid #3d3d3d"
          }}>
            {/* Language selector and existing controls */}
            <div style={{ position: "relative" }}>
              {/* Language selector */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "none",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: "14px",
                    padding: "4px 8px"
                  }}
                >
                  <span>{language}</span>
                  <ChevronDown size={16} />
                </button>

                {/* Language dropdown */}
                {isLanguageDropdownOpen && (
                  <div style={{
                    position: "absolute",
                    top: "100%",
                    left: "0",
                    backgroundColor: "#2d2d2d",
                    border: "1px solid #3d3d3d",
                    borderRadius: "4px",
                    padding: "8px 0",
                    zIndex: 1000,
                    minWidth: "200px"
                  }}>
                    {Object.entries(languages).map(([category, langs]) => (
                      <div key={category}>
                        <div style={{
                          padding: "4px 12px",
                          color: "#888",
                          fontSize: "12px"
                        }}>
                          {category}
                        </div>
                        {langs.map(lang => (
                          <button
                            key={lang}
                            onClick={() => handleLanguageChange(lang)}
                            style={{
                              display: "block",
                              width: "100%",
                              padding: "4px 12px",
                              background: "none",
                              border: "none",
                              color: "#fff",
                              cursor: "pointer",
                              textAlign: "left",
                              fontSize: "14px",
                              ":hover": {
                                backgroundColor: "#3d3d3d"
                              }
                            }}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{
              display: "flex",
              gap: "8px",
              alignItems: "center"
            }}>
              {isAnalyzing && <span style={{ color: "#666", fontSize: "12px" }}>Analyzing...</span>}
              <button onClick={copyToClipboard} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "4px" }}>
                <Copy size={16} />
              </button>
              <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "4px" }}>
                <Maximize2 size={16} />
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <Editor
            height="50%"
            width="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              fontSize: 14,
              minimap: { enabled: true },
              lineNumbers: "on",
              glyphMargin: true,
              folding: true,
            }}
          />

            {/* Feedback Panel */}
            <div style={{ 
            top:"50%",
              height: "50%", 
              backgroundColor: "#1e1e1e", 
              padding: "8px",
              borderTop: "1px solid #3d3d3d",
              display: "flex",
              flexDirection: "column"
            }}>
              {/* Button Section (Fixed) */}
              <div 
                style={{ 
                  display: "flex", 
                  gap: "16px", 
                  marginBottom: "8px", 
                  position: "relative", 
                  zIndex: 2,
                  backgroundColor: "#1e1e1e",
                  paddingBottom: "8px"
                }}
              >
                {/* <button 
                  style={{ background: "none", border: "none", color: "#fff", display: "flex", alignItems: "center", gap: "4px" }} 
                  onClick={() => setActiveSection("issues")}
                >
                  <AlertCircle size={16} /> Issues ({diagnostics.length})
                </button> */}
                {/* <button 
                  style={{ background: "none", border: "none", color: "#fff", display: "flex", alignItems: "center", gap: "4px" }} 
                  onClick={() => setActiveSection("suggestions")}
                >
                
                  <MessageSquare size={16} /> Suggestions ({suggestions.length})
                </button> */}
                {/* <button 
                  style={{ background: "none", border: "none", color: "#fff", display: "flex", alignItems: "center", gap: "4px" }} 
                  onClick={() => setActiveSection("debug")}
                >
                  <Bug size={16} /> Debug
                </button> */}
                <button 
                  style={{ background: "none", border: "none", color: "#fff", display: "flex", alignItems: "center", gap: "4px" }} 
                  onClick={() => {setActiveSection("explanations"); analysisHandler(); }}
                >
                  <Lightbulb size={16} /> Explanations
                </button>
              </div>

              {/* Scrollable Output Section */}
              <div 
                className="consoleOutput"
                style={{
                  flex: 1, // Takes up remaining space
                  overflowY: "auto", // Enables scrolling
                  paddingRight: "8px"
                }}
              >
                {activeSection === "explanations" && explanations && (
                  <div 
                    style={{
                      marginBottom: "4px",
                      backgroundColor: "#2d2d2d",
                      borderLeft: "3px solid #50fa7b",
                      overflow: "hidden"
                    }}
                  >
                    <div>
                      <ReactMarkdown components={components}>
                        {explanations}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Excalidraw container */}
        <div style={{
          flex: "1",
          maxWidth: "700px",
          height: "700px",
          border: "1px solid #1e3c72",
          borderRadius: "8px",
          overflow: "hidden"
        }}>
          <Excalidraw UIOptions={UIOptions} />
        </div>
      </div>
    </div>
  );
};

export default App;
