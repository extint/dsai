import React, { useState, useEffect } from "react";
import OutputSection from "./OutputSection";
import "./mainhome.css";
import TextInput from "./TextInput";
import CodeInput from "./CodeInput";
import Button from "@mui/material/Button";
import axios from "axios";
import Cookies from "js-cookie";
import { v4 as uuidv4 } from "uuid"; // For generating unique session IDs

const PORT = process.env.REACT_APP_PORT;

const MyApp = () => {
    const [problem, setProblem] = useState("");
    const [code, setCode] = useState("");
    const [output, setOutput] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isCodeMode, setIsCodeMode] = useState(false);

    useEffect(() => {
        let sessionId = Cookies.get("session_id");
        if (!sessionId) {
            sessionId = uuidv4(); // Generate a unique session ID
            Cookies.set("session_id", sessionId, { expires: 7, secure: true, sameSite: "Strict" });
        }

        const storedChats = Cookies.get(`chatHistory_${sessionId}`);
        if (storedChats) {
            setOutput(JSON.parse(storedChats));
        }
    }, []);

    const handleProblemChange = (e) => setProblem(e.target.value);
    const handleCodeChange = (newCode) => setCode(newCode);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        const sessionId = Cookies.get("session_id");

        try {
            const response = await axios.post(`http://127.0.0.1:${PORT}/answerq/answerdsaquestion`, {
                problemStatement: problem,
            }, {
                headers: { 
                    "Content-Type": "application/json",
                    "x-session-id": sessionId // Attach session ID
                }
            });

            setOutput(response.data);
            Cookies.set(`chatHistory_${sessionId}`, JSON.stringify(response.data), { expires: 1, secure: true, sameSite: "Strict" });

        } catch (err) {
            setError(err.response?.data?.error || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    const clearChatHistory = () => {
        const sessionId = Cookies.get("session_id");
        Cookies.remove(`chatHistory_${sessionId}`);
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
