import React, { useState } from "react";
import OutputSection from "./OutputSection";
import "./mainhome.css";
import TextInput from "./TextInput";
import CodeInput from "./CodeInput";
import Button from '@mui/material/Button';
import axios from "axios"

const PORT = process.env.REACT_APP_PORT;

const MyApp = () => {
  const [problem, setProblem] = useState("");
  const [code, setCode] = useState(""); // State to hold the code input
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCodeMode, setIsCodeMode] = useState(false);

  // Function to handle changes in the problem input
  const handleProblemChange = (e) => setProblem(e.target.value);

  // Function to handle changes in the code editor
  const handleCodeChange = (newCode) => {
    setCode(newCode); // Update the code state with the new code
  };

  // Toggle between text mode and code mode
  const toggleMode = () => {
    setIsCodeMode(!isCodeMode);
    setOutput(null)
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
  
    try {
      const response = await axios.post(`http://127.0.0.1:${PORT}/answerq/answerdsaquestion`, {
        problemStatement: problem,
      }, {
        headers: { "Content-Type": "application/json" }
      });
  
      // Axios automatically parses JSON, no need for .json()
      setOutput(response.data);
  
    } catch (err) {
      setError(err.response?.data?.error || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="heading">DSAI</h1>
      </header>

      <main className="main-content">
        {/* <div className="input"> */}
          {isCodeMode ? (
            <CodeInput
              problem={code} // Pass the code state to CodeInput
              handleCodeChange={handleCodeChange} // Handle changes in the code editor
              handleSubmit={handleSubmit}
              language="python" // Default language (can be dynamic)
            />
          ) : (
            <TextInput
              problem={problem}
              handleProblemChange={handleProblemChange}
              handleSubmit={handleSubmit}
            />
          )}
        {/* </div> */}
        <Button className = "toggleButton" onClick={toggleMode} variant="outlined">Toggle Mode</ Button>
        {loading && <p className="loading">Loading...</p>}
        {error && <p className="error">Error: {error}</p>}

        {output && <OutputSection output={output} />}
      </main>
    </div>
  );
};

export default MyApp;
