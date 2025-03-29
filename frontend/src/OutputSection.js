import React, { useState, useEffect } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import { CopyToClipboard } from "react-copy-to-clipboard";
import DoubtDialogue from "./doubtDialogue";
import "./OutputSection.css";
import axios from "axios";
import Cookies from "js-cookie";
import { v4 as uuidv4 } from "uuid";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";

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

  // Ensure each user gets a unique session ID
  useEffect(() => {
    let sessionId = Cookies.get("session_id");
    if (!sessionId) {
      sessionId = uuidv4();
      Cookies.set("session_id", sessionId, { expires: 7, secure: true, sameSite: "Strict" });
    }
  }, []);

  // Function to clean and structure code output
  const cleanCode = (code) => {
    if (!code) return "";
    return code.replace(/^```[a-zA-Z0-9+]*\n/, "").replace(/```$/, "").replace(/\n\n/g, "\n");
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
    setRefreshingSection(section);
    setError(null);
    const sessionId = Cookies.get("session_id"); // Retrieve session ID

    try {
      const response = await axios.post(
        `http://127.0.0.1:${PORT}/answerq/refresh`,
        { section, language: activeLanguage },
        { headers: { "Content-Type": "application/json", "x-session-id": sessionId } }
      );

      const newContent = response.data?.answer?.[section] || "No data available";

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
                  onClick={() => setActiveLanguage(language)}
                  className={activeLanguage === language ? "active" : ""}
                >
                  {language.toUpperCase()}
                </button>
              ))}
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
          <div className="code-content" onMouseUp={handleTextSelection}>
            <SyntaxHighlighter language={activeLanguage} style={materialDark}>
              {sectionData?.[activeLanguage]?.Code || "No code generated"}
            </SyntaxHighlighter>
          </div>
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
        />
      )}
      
      {error && <div className="error-message">Error: {error}</div>}
    </div>
  );
};

export default OutputSection;