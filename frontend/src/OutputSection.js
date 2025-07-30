import React, { useState, useEffect } from "react";
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
import language from "react-syntax-highlighter/dist/esm/languages/hljs/1c";
import Editor from "@monaco-editor/react";


SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("cpp", cpp);

const PORT = process.env.REACT_APP_PORT;

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
  const [generatedSkeletonCode, setGeneratedSkeletonCode] = useState("")
  // Ensure each user gets a unique session ID
  const extractCommentsWithSpacing = (code, language) => {
    const lines = code.split("\n");
    let insideBlockComment = false;
    let processedLines = [];

    lines.forEach(line => {
        const trimmedLine = line.trim();

        if (language === "python") {
            if (trimmedLine.startsWith("#")) {
                processedLines.push(line); // Keep comment lines
            } else if (trimmedLine.length > 0) {
                processedLines.push(""); // Leave empty lines where code was
            }
        } else if (language === "cpp" || language === "java") {
            if (trimmedLine.startsWith("//")) {
                processedLines.push(line); // Keep single-line comments
            } else if (trimmedLine.includes("/*")) {
                insideBlockComment = true;
                processedLines.push(line); // Keep start of block comment
            } else if (insideBlockComment) {
                processedLines.push(line); // Keep inside block comment
                if (trimmedLine.includes("*/")) {
                    insideBlockComment = false;
                }
            } else if (trimmedLine.length > 0) {
                processedLines.push(""); // Leave empty lines where code was
            }
        } else {
            processedLines.push(line); // Unsupported language: keep as is
        }
    });

    return processedLines.join("\n");
  }
  const handleClickTry = async () => {
    setIsTry(true);
    setGeneratedSkeletonCode("Loading...");
  
    try {
      const sessionId = ChatManager.initSession();
      const languageData = ChatManager.getLanguageData(sessionId, activeLanguage);
      const question = ChatManager.getSessionData(sessionId).problemStatement;
  
      const response = await axios.post(
        `http://127.0.0.1:${PORT}/answerq/skeletoncode`,
        {
          language: activeLanguage,
          sessionId,
          question,
          historyData: languageData,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-session-id": sessionId,
          },
        }
      );
  
      if (response.status !== 200) throw new Error(`Server responded with ${response.status}`);
  
      // Ensure skeletonCode is valid
      let skeletonCode = response?.data?.skeletonCode || "No skeleton code generated.";
      try {
        const data = JSON.parse(skeletonCode);
        skeletonCode = data.Code || ""; // Return the code or an empty string if not found
      } catch (error) {
        console.error("Error parsing response:", error);
        return "";
      }   
      
      languageData.skeletonCode = skeletonCode;
      // languageData.skeletonCode = extractCommentsWithSpacing(skeletonCode,activeLanguage);
      
      // Store updated data
      ChatManager.storeLanguageData(sessionId, activeLanguage, languageData);
  
      if (typeof skeletonCode !== "string") {
        throw new Error("Invalid skeleton code format");
      }
  
      // setGeneratedSkeletonCode(skeletonCode);
      // setGeneratedSkeletonCode(String(skeletonCode || "No skeleton code available"));
      setGeneratedSkeletonCode(cleanCode(languageData.skeletonCode)|| "No skeleton code available");
    } catch (error) {
      console.error("Error fetching skeleton code:", error);
      setGeneratedSkeletonCode("Failed to load skeleton code.");
    }
  };
  

  // Function to clean and structure code output
  const cleanCode = (code) => {
    if (!code) return "";
    return code.replace(/^```[a-zA-Z0-9+]*\n/, "").replace(/```$/, "").trim();
  };
      
    // Function to initialize sectionData from props
    const initializeSectionData = (output) => {
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
    };

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

    const handleEditorChange = debounce(async (value) => {
    //  verfy the code tried by user peridoically
  
    }, 100);

    const handleEditorDidMount = (editor, monaco) => {
      // setEditor(editor);
      // setMonaco(monaco);
  
      monaco.editor.defineTheme('customTheme', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.lineHighlightBackground': '#1f1f1f',
        }
      });
  
      monaco.editor.setTheme('customTheme');
      // setGeneratedSkeletonCode()
    };

    
    // Sync new question's output when initialOutput changes
    useEffect(() => {
      setSectionData(initializeSectionData(initialOutput));
      setSelectedText("");
      setShowDialogue(false);
      setError(null);
      setRefreshingSection(null);
      }, [initialOutput]);
      
      // Function to update section content on refresh
      const refreshContent = async (section) => {
        const sessionId = ChatManager.initSession()
        const languageData = ChatManager.getLanguageData(sessionId, activeLanguage) || {
          chatHistory: []
        };
        
        setRefreshingSection(section);
        setError(null);
        const question = ChatManager.getSessionData(sessionId).problemStatement
        try {
          const response = await axios.post(
            `http://127.0.0.1:${PORT}/answerq/refresh`,
            { 
              section: section, 
              language: activeLanguage,
              sessionId,
              question,
              historyData: languageData // Send chat history with the request
            },
            { 
              headers: { 
                "Content-Type": "application/json", 
                "x-session-id": sessionId 
              } 
            }
            );
          if (response.status !== 200) throw new Error(`Server responded with status ${response.status}`);
          
          const newContent = response.data?.answer?.[section] || "No data available";
          languageData[section] = newContent
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
        {/* Left Panel - Code Section */}
        <div className="code-panel">
          <div className="panel-header">
            <h3 className="panel-title">Code</h3>
            <div className="language-switcher">
              {["python", "cpp", "java"].map((language) => (
                <button
                  key={language}
                  onClick={() => (setActiveLanguage(language),setIsTry(false))}
                  className={activeLanguage === language ? "active" : ""}
                >
                  {language.toUpperCase()}
                </button>
              ))}
              <button className={`try-btn ${isTry ? "active" : ""}`} onClick={handleClickTry}>
                {isTry ? "Trying" : "Try"}
              </button>
            </div>
            <div className="action-buttons">
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
                <button className={`copy-btn ${isCopied ? "copied" : ""}`}>
                  {isCopied ? "✓" : "📋"}
                </button>
              </CopyToClipboard>
            </div>
          </div>
          {!isTry ? <div className="code-content" onMouseUp={handleTextSelection}>
            <SyntaxHighlighter language={activeLanguage} style={materialDark}>
              {sectionData?.[activeLanguage]?.Code || "No code generated"}
            </SyntaxHighlighter>
          </div> : (
          <Editor
            height="100%"
            width="100%"
            language={activeLanguage}
            theme="vs-dark"
            value={generatedSkeletonCode || ""}
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
          )}
        </div>
        
        {/* Right Panel - Analysis Sections */}
        <div className="analysis-panel">
          {["Logic", "Time_Complexity", "Space_Complexity", "Improvements"].map((section) => (
            <div className="analysis-section" key={section}>
              <div className="analysis-header">
                <h3 className="analysis-title">{section.replace("_", " ")}</h3>
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
                  {sectionData?.[activeLanguage]?.[section] || "No data available"}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showDialogue && (
        <DoubtDialogue
          activeLanguage={activeLanguage}
          selectedText={selectedText}
          dialoguePosition={dialoguePosition}
          showDialogue={showDialogue}
          onClose={() => setShowDialogue(false)}
          className="doubt-dialogue"
        />
      )}
      
      {error && <div className="error-message">Error: {error}</div>}
    </div>
  );
};

export default OutputSection;