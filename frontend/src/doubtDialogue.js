import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import axios from "axios"

const DoubtDialogue = ({
  activeLanguage,
  selectedText,
  dialoguePosition,
  showDialogue,
  onClose
}) => {
  const [userDoubt, setUserDoubt] = useState("");
  const [followUpResponse, setFollowUpResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [doubts, setDoubts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0); // Track which doubt is active
  // Add a new doubt
  const addDoubt = (doubt) => {
    setDoubts((prev) => [...prev, [doubt, activeLanguage]]);
    setCurrentIndex(doubts.length); // Set to the latest doubt
  };
// Navigate to previous and next doubts
  const goToPreviousDoubt = () => {
    if (currentIndex > 0) setCurrentIndex((prevIndex) => prevIndex - 1);
  };
  const goToNextDoubt = () => {
    if (currentIndex < doubts.length - 1) setCurrentIndex((prevIndex) => prevIndex + 1);
  };
  const handleDoubtSubmit = async () => {
    if (!selectedText || !userDoubt) return;

    const question = `${userDoubt}: \n${selectedText}`;
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post("http://127.0.0.1:5175/answerq/answerfollowup", {
        doubt: question,
        language: activeLanguage,},
        {headers: { "Content-Type": "application/json" }},
      );

      console.log(response)
      setFollowUpResponse(response.data.answer?.AnswerToFollowUp)
      // if (!response.ok) {
      //   throw new Error(`Server responded with status ${response.status}`);
      // }
      addDoubt({ userDoubt, followUpResponse: followUpResponse });
      // console.log(doubts)
      setUserDoubt(""); // Reset user input
    }
      catch (err) {
        setError(err.response?.data?.error || "An error occurred");
      } finally {
        setLoading(false);
      }
  };

  return (
    <>
      {showDialogue && (
        <div
          className="doubt-dialogue"
          style={{
            position: "absolute",
            top: dialoguePosition?.y + 400 || 0,
            left: "75%",
            width: "22%",
            backgroundColor: "rgb(0, 39, 93)",
            border: "1px solid #333",
            borderRadius: "8px",
            padding: "15px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
            // color: "rgba(0, 46, 229, 0.4)",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <div
            onClick={() => {
              setFollowUpResponse(null);
              onClose();
            }}
            className="close-button"
            style={{
              cursor: "pointer",
              fontWeight: "bold",
              color: "white",
              fontSize: "16px",
            }}
          >
            ✖
          </div>

          <textarea
            placeholder="Ask your doubt here..."
            value={userDoubt}
            onChange={(e) => setUserDoubt(e.target.value)}
            style={{
              width: "90%",
              height: "100px",
              marginBottom: "10px",
              padding: "5px",
              backgroundColor: "#2a2a3d",
              color: "#e5e5e5",
              border: "1px solid #444",
              borderRadius: "6px",
              fontFamily: "inherit",
              resize: "none",
            }}
          />

          <button
            onClick={handleDoubtSubmit}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007BFF",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#0056b3";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#007BFF";
            }}
          >
            Submit Doubt
          </button>
          {loading && <p className="loading">Loading...</p>}
          {error && <p className="error">Error: {error}</p>}
          {/* Navigation Buttons */}
          <div style={{ marginTop: "15px" }}>
            <button
              onClick={goToPreviousDoubt}
              disabled={currentIndex === 0} // Disable when on the first doubt
              style={{
                marginRight: "10px",
                padding: "8px 15px",
                backgroundColor: currentIndex === 0 ? "#444" : "#007BFF",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: currentIndex === 0 ? "not-allowed" : "pointer",
              }}
            >
              Previous
            </button>

            <button
              onClick={goToNextDoubt}
              disabled={currentIndex === doubts.length - 1 || doubts.length === 0} // Disable when on the last doubt
              style={{
                padding: "8px 15px",
                backgroundColor: currentIndex === doubts.length - 1 ? "#444" : "#007BFF",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: currentIndex === doubts.length - 1 ? "not-allowed" : "pointer",
              }}
            >
              Next
            </button>
          </div>

          {/* Display Current Doubt */}
          {doubts.length > 0 && (
            <div
              style={{
                marginTop: "15px",
                backgroundColor: "#2a2a3d",
                padding: "10px",
                borderRadius: "6px",
                color: "#e5e5e5",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
            >
              <h3 style={{ color: "#00d4ff" }}>Doubt {currentIndex + 1} ({doubts[currentIndex][1]}):</h3>
              <p style={{fontSize:"18px"}}>{doubts[currentIndex][0]?.userDoubt}</p>
              <h3 style={{ color: "#00d4ff" }}>Response:</h3>
              <ReactMarkdown className="markdown-content">
                {doubts[currentIndex][0]?.followUpResponse || "No response received."}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default DoubtDialogue;
