import React, { useState, useEffect } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import { CopyToClipboard } from "react-copy-to-clipboard";
import DoubtDialogue from "./doubtDialogue";
import "./OutputSection.css";
import axios from "axios";
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

    try {
      const response = await axios.post(
        `http://127.0.0.1:${PORT}/answerq/refresh`,
        { section, language: activeLanguage },
        { headers: { "Content-Type": "application/json" } }
      );

      const newContent = response.data?.answer?.[section] || "No data available";
      console.log(newContent)

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

      {/* Code Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Generated Code</h3>
          <div className="refresh-button">
            <button onClick={() => refreshContent("Code")} disabled={refreshingSection === "Code"}>
              {refreshingSection === "Code" ? "Refreshing..." : "🔄 Refresh"}
            </button>
          </div>
        </div>
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
        <div className="code-window" onMouseUp={handleTextSelection}>
          <SyntaxHighlighter language={activeLanguage} style={materialDark}>
            {sectionData?.[activeLanguage]?.Code || "No code generated"}
          </SyntaxHighlighter>
          <div className="copy-button">
            <CopyToClipboard
              text={sectionData?.[activeLanguage]?.Code || ""}
              onCopy={handleCopy}
            >
              <button className={`copy-btn ${isCopied ? "copied" : ""}`}>
                {isCopied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </CopyToClipboard>
          </div>
        </div>
      </div>

      {/* Other Sections */}
      {["Logic", "Time_Complexity", "Space_Complexity", "Improvements"].map((section) => (
        <div className="card" key={section}>
          <div className="card-header">
            <h3 className="card-title">{section.replace("_", " ")}</h3>
            <div className="refresh-button">
              <button onClick={() => refreshContent(section)} disabled={refreshingSection === section}>
                {refreshingSection === section ? "Refreshing..." : "🔄 Refresh"}
              </button>
            </div>
          </div>
          <ReactMarkdown className="markdown-content">
            {sectionData?.[activeLanguage]?.[section] || "No data available"}
          </ReactMarkdown>
        </div>
      ))}

      {showDialogue && (
        <DoubtDialogue
          activeLanguage={activeLanguage}
          selectedText={selectedText}
          dialoguePosition={dialoguePosition}
          showDialogue={showDialogue}
          onClose={() => setShowDialogue(false)}
        />
      )}
    </div>
  );
};

export default OutputSection;
