import React, { useState, useEffect } from "react";
import OutputSection from "./OutputSection";
import "./mainhome.css";
import TextInput from "./TextInput";
import CodeInput from "./CodeInput";
import Button from "@mui/material/Button";
import axios from "axios";
import { v4 as uuidv4 } from "uuid"; // For generating unique session IDs
import ChatManager from "./ChatManager"; // Import the ChatManager

const PORT = process.env.REACT_APP_PORT;

const MyApp = () => {
  const [problem, setProblem] = useState("");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    // Initialize session using ChatManager
    const id = ChatManager.initSession();
    setSessionId(id);
    
    // Load saved data if available
    const savedData = ChatManager.getSessionData(id);
    if (savedData && Object.keys(savedData).length > 0) {
      setOutput(savedData);
    }
  }, []);

  const handleProblemChange = (e) => setProblem(e.target.value);
  const handleCodeChange = (newCode) => setCode(newCode);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`http://127.0.0.1:${PORT}/answerq/answerdsaquestion`, {
        problemStatement: problem,
        sessionId: sessionId // Send sessionId with request
      }, {
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId // Keep for backward compatibility
        }
      });

      setOutput(response.data);
      
      // Store in local storage
      ChatManager.storeSessionData(sessionId, response.data);
      
    } catch (err) {
      setError(err.response?.data?.error || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const clearChatHistory = () => {
    ChatManager.clearSessionData(sessionId);
    setOutput(null);
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="heading">DSAI</h1>
      </header>
      <main className="main-content">
        {isCodeMode ? (
          <CodeInput problem={code} handleCodeChange={handleCodeChange} handleSubmit={handleSubmit} language="python" />
        ) : (
          <TextInput problem={problem} handleProblemChange={handleProblemChange} handleSubmit={handleSubmit} />
        )}
        <Button className="toggleButton" onClick={() => setIsCodeMode(!isCodeMode)} variant="outlined">
          Toggle Mode
        </Button>
        <Button className="clearChatButton" onClick={clearChatHistory} variant="outlined">
          Clear Chat History
        </Button>
        {loading && <p className="loading">Loading...</p>}
        {error && <p className="error">Error: {error}</p>}
        {output && <OutputSection output={output} />}
      </main>
    </div>
  );
};

export default MyApp;