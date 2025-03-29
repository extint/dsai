// TextInput.js
import React from "react";
import './TextInput.css'
import { Button } from "@mui/material";

const TextInput = ({ problem, handleProblemChange, handleSubmit }) => {
  
  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault(); // Prevents newline in textarea
      handleSubmit(); // Calls the submit function
    }
  };

  return (
    <div className="input-section">
      <textarea
        className="problem-input"
        placeholder="Enter your problem statement here..."
        value={problem}
        onChange={handleProblemChange}
        onKeyDown={handleKeyDown} // Bind Enter key
      />
      <div className="actions">
        <Button
          className="submit-button" 
          onClick={handleSubmit}
          variant="contained"
          color="blue"
        >
          Submit
        </Button>
      </div>
    </div>
  );
};

export default TextInput;