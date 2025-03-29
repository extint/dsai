
// TextInput.js
import React from "react";
import './TextInput.css'
import { Button } from "@mui/material";

const TextInput = ({ problem, handleProblemChange, handleSubmit }) => {
  return (
    <div className="input-section">
      <textarea
        className="problem-input"
        placeholder="Enter your problem statement here..."
        value={problem}
        onChange={handleProblemChange}
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