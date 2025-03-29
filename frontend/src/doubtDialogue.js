import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import Cookies from "js-cookie";
import { v4 as uuidv4 } from "uuid";
import "./doubtDialogue.css";

const DoubtDialogue = ({ activeLanguage, selectedText, dialoguePosition, showDialogue, onClose }) => {
  const [userDoubt, setUserDoubt] = useState("");
  const [followUpResponse, setFollowUpResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [doubts, setDoubts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);
  const dialogueRef = useRef(null);

  // Calculate optimal position based on selection
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Initialize session ID and load cached doubts
  useEffect(() => {
    let sessionId = Cookies.get("session_id");
    if (!sessionId) {
      sessionId = uuidv4();
      Cookies.set("session_id", sessionId, { expires: 7, secure: true, sameSite: "Strict" });
    }
    const storedDoubts = Cookies.get("doubtsHistory");
    if (storedDoubts) setDoubts(JSON.parse(storedDoubts));
  }, []);

  // Update position based on selection position
  useEffect(() => { 
    if (showDialogue && dialoguePosition) {
      // Get viewport dimensions
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      // Get dialogue dimensions (if available)
      const dialogueHeight = dialogueRef.current ? dialogueRef.current.offsetHeight : 400;
      const dialogueWidth = dialogueRef.current ? dialogueRef.current.offsetWidth : 400;
      
      // Calculate ideal position (near the selection)
      let top = dialoguePosition.y + 300; // Slightly below selection
      let left = dialoguePosition.x+dialoguePosition.width+800 ;
      
      // Adjust if would go off screen
      if (top + dialogueHeight > 2*viewportHeight) {
        top = Math.max(20, dialoguePosition.y - dialogueHeight - 20); // Place above selection
      }
      
      if (left + dialogueWidth > viewportWidth) {
        left = Math.max(20, viewportWidth - dialogueWidth - 20); // Adjust to fit screen width
      }
      
      setPosition({ top, left });
    }
  }, [showDialogue, dialoguePosition]);

  // Store doubts in cookies
  useEffect(() => {
    if (doubts.length > 0) {
      Cookies.set("doubtsHistory", JSON.stringify(doubts), { expires: 7, secure: true, sameSite: "Strict" });
    }
  }, [doubts]);

  const addDoubt = (doubt) => {
    setDoubts((prev) => {
      const updatedDoubts = [...prev, { ...doubt, language: activeLanguage, timestamp: new Date().toLocaleString() }];
      setCurrentIndex(updatedDoubts.length - 1);
      return updatedDoubts;
    });
  };

  const goToPreviousDoubt = () => setCurrentIndex((prev) => Math.max(0, prev - 1));
  const goToNextDoubt = () => setCurrentIndex((prev) => Math.min(doubts.length - 1, prev + 1));

  const handleDoubtSubmit = async () => {
    if (!selectedText || !userDoubt) return;

    const question = `${userDoubt}: \n${selectedText}`;
    setLoading(true);
    setError(null);

    const sessionId = Cookies.get("session_id");
    const PORT = process.env.REACT_APP_PORT;

    try {
      const response = await axios.post(
        `http://127.0.0.1:${PORT}/answerq/answerfollowup`,
        { doubt: question, language: activeLanguage },
        { headers: { "Content-Type": "application/json", "x-session-id": sessionId } }
      );

      if (response.status !== 200) throw new Error(`Server responded with status ${response.status}`);
      const followUpText = response.data.answer?.AnswerToFollowUp || "No response received";
      setFollowUpResponse(followUpText);
      addDoubt({ userDoubt, followUpResponse: followUpText, selectedCode: selectedText });
      setUserDoubt("");
    } catch (err) {
      setError(err.response?.data?.error || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!showDialogue) return null;

  return (
    <div 
      ref={dialogueRef}
      className={`doubt-dialogue ${isExpanded ? 'expanded' : 'collapsed'}`} 
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="doubt-dialogue-header">
        <div className="header-content">
          <div className="header-left">
            <h2>Code Assistant</h2>
            <span className="language-badge">{activeLanguage.toUpperCase()}</span>
          </div>
          <div className="header-actions">
            <button className="toggle-btn" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? '−' : '+'}
            </button>
            <button className="close-btn" onClick={() => { setFollowUpResponse(null); onClose(); }}>
              ×
            </button>
          </div>
        </div>
        {isExpanded && (
          <div className="selected-code">
            <div className="code-label">Selected Code:</div>
            <div className="code-snippet">{selectedText}</div>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="doubt-dialogue-body">
          <div className="input-container">
            <textarea
              placeholder="What would you like to know about this code?"
              value={userDoubt}
              onChange={(e) => setUserDoubt(e.target.value)}
              className="doubt-input"
            />
            <button 
              className={`submit-btn ${loading ? 'loading' : ''}`}
              onClick={handleDoubtSubmit}
              disabled={loading || !userDoubt}
            >
              {loading ? (
                <div className="loading-spinner"></div>
              ) : (
                <span>Ask</span>
              )}
            </button>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          {doubts.length > 0 && (
            <div className="doubt-history">
              <div className="history-header">
                <h3>Response History</h3>
                <div className="navigation">
                  <button
                    className="nav-btn"
                    onClick={goToPreviousDoubt}
                    disabled={currentIndex === 0}
                  >
                    ←
                  </button>
                  <span className="nav-index">{currentIndex + 1} / {doubts.length}</span>
                  <button
                    className="nav-btn"
                    onClick={goToNextDoubt}
                    disabled={currentIndex === doubts.length - 1}
                  >
                    →
                  </button>
                </div>
              </div>

              <div className="doubt-content">
                <div className="question-container">
                  <div className="question-header">
                    <span className="question-label">Question</span>
                    <span className="timestamp">{doubts[currentIndex]?.timestamp}</span>
                  </div>
                  <p className="question-text">{doubts[currentIndex]?.userDoubt}</p>
                </div>
                
                <div className="response-container">
                  <div className="response-header">
                    <span className="response-label">Response</span>
                  </div>
                  <ReactMarkdown className="markdown-content">
                    {doubts[currentIndex]?.followUpResponse || "No response received."}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DoubtDialogue;