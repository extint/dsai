import React, { useState } from "react";
// import { parse } from "python-parser";
import mermaid from "mermaid";
import * as pythonParser from 'python-parser';


// Global counter for unique node IDs
let nodeId = 0;
const getNextId = () => `N${nodeId++}`;

// Recursively process an AST node (for a statement) and return an object with:
// - diagram: generated Mermaid diagram fragment
// - start: starting node id of this fragment
// - end: ending node id of this fragment
const processStatement = (stmt) => {
  let localDiagram = "";
  let start, end;
  switch (stmt.type) {
    case "If":
      start = getNextId();
      end = getNextId();
      // For the condition, we simply label it "if condition" (you can extend this to convert stmt.test to a string)
      localDiagram += `${start}{if condition}\n`;
      // Process then branch
      let thenStart = getNextId();
      localDiagram += `${start} -- True --> ${thenStart}\n`;
      let thenLast = thenStart;
      stmt.body.forEach((s) => {
        const res = processStatement(s);
        localDiagram += res.diagram;
        localDiagram += `${thenLast} --> ${res.start}\n`;
        thenLast = res.end;
      });
      localDiagram += `${thenLast} --> ${end}\n`;
      // Process else branch if present
      if (stmt.orelse && stmt.orelse.length > 0) {
        let elseStart = getNextId();
        localDiagram += `${start} -- False --> ${elseStart}\n`;
        let elseLast = elseStart;
        stmt.orelse.forEach((s) => {
          const res = processStatement(s);
          localDiagram += res.diagram;
          localDiagram += `${elseLast} --> ${res.start}\n`;
          elseLast = res.end;
        });
        localDiagram += `${elseLast} --> ${end}\n`;
      } else {
        localDiagram += `${start} -- False --> ${end}\n`;
      }
      return { diagram: localDiagram, start, end };

    case "For":
      start = getNextId();
      end = getNextId();
      // For loop header (using a placeholder for loop details)
      localDiagram += `${start}[For loop]\n`;
      let loopStart = getNextId();
      localDiagram += `${start} --> ${loopStart}\n`;
      let loopLast = loopStart;
      stmt.body.forEach((s) => {
        const res = processStatement(s);
        localDiagram += res.diagram;
        localDiagram += `${loopLast} --> ${res.start}\n`;
        loopLast = res.end;
      });
      localDiagram += `${loopLast} --> ${end}[End For]\n`;
      return { diagram: localDiagram, start, end };

    case "While":
      start = getNextId();
      end = getNextId();
      localDiagram += `${start}[While loop]\n`;
      let whileStart = getNextId();
      localDiagram += `${start} --> ${whileStart}\n`;
      let whileLast = whileStart;
      stmt.body.forEach((s) => {
        const res = processStatement(s);
        localDiagram += res.diagram;
        localDiagram += `${whileLast} --> ${res.start}\n`;
        whileLast = res.end;
      });
      localDiagram += `${whileLast} --> ${end}[End While]\n`;
      return { diagram: localDiagram, start, end };

    case "Return":
      start = getNextId();
      localDiagram += `${start}[Return]\n`;
      end = start;
      return { diagram: localDiagram, start, end };

    default:
      // For any other statement type, just label it with its type.
      start = getNextId();
      localDiagram += `${start}[${stmt.type}]\n`;
      end = start;
      return { diagram: localDiagram, start, end };
  }
};

const generateFlowchartPython = (code) => {
  // Reset the node ID counter
  nodeId = 0;
  let diagram = "flowchart TD\n";
  try {
    const ast = pythonParser.default(code);
    // Process top-level nodes. Typically, Python code is a Module with a body.
    ast.body.forEach((node) => {
      if (node.type === "FunctionDef") {
        const funcStart = getNextId();
        diagram += `${funcStart}[Function: ${node.name}]\n`;
        let lastNode = funcStart;
        node.body.forEach((stmt) => {
          const res = processStatement(stmt);
          diagram += res.diagram;
          diagram += `${lastNode} --> ${res.start}\n`;
          lastNode = res.end;
        });
        const funcEnd = getNextId();
        diagram += `${lastNode} --> ${funcEnd}[End Function]\n`;
      } else {
        // Process any other top-level statement generically
        const res = processStatement(node);
        diagram += res.diagram;
      }
    });
  } catch (err) {
    return "Error parsing code. Please check your input.";
  }
  return diagram;
};

const PythonFlowchartGenerator = () => {
  const [code, setCode] = useState("");
  const [flowchart, setFlowchart] = useState("");

  const handleGenerate = () => {
    const diagram = generateFlowchartPython(code);
    setFlowchart(diagram);
    // Initialize Mermaid to process the new diagram.
    mermaid.initialize({ startOnLoad: true });
    mermaid.contentLoaded();
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Python Flowchart Generator</h2>
      <textarea
        placeholder="Enter your Python code here..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{ width: "100%", height: "200px", marginBottom: "10px" }}
      />
      <br />
      <button onClick={handleGenerate}>Generate Flowchart</button>
      <div
        style={{
          marginTop: "20px",
          border: "1px solid #ccc",
          padding: "10px",
          minHeight: "200px"
        }}
      >
        <div className="mermaid">{flowchart}</div>
      </div>
    </div>
  );
};

export default PythonFlowchartGenerator;
