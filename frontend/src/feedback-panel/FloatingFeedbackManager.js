import React, { useState, useEffect, useRef } from 'react';
import EnhancedFeedbackPanel from './EnhancedFeedbackPanel';

const FloatingFeedbackManager = ({ feedback, isVisible, editorRef }) => {
  const [panelMode, setPanelMode] = useState('docked'); // 'docked', 'floating', 'minimized', 'overlay'
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef(null);

  // Auto-positioning based on editor content
  useEffect(() => {
    if (panelMode === 'overlay' && editorRef?.current && feedback) {
      positionOverlay();
    }
  }, [feedback, panelMode]);

  const positionOverlay = () => {
    if (!editorRef?.current) return;

    const editor = editorRef.current;
    const editorRect = editor.getBoundingClientRect();
    
    // Position panel near active line or error location
    const activePosition = getActiveCodePosition();
    
    setPosition({
      x: editorRect.right - 420, // 400px panel width + 20px margin
      y: activePosition?.y || editorRect.top + 60
    });
  };

  const getActiveCodePosition = () => {
    // This would integrate with Monaco Editor's API to get cursor position
    // or error line positions for more intelligent positioning
    if (!editorRef?.current) return null;
    
    try {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      const position = editor.getPosition();
      
      if (position) {
        const lineTop = editor.getTopForLineNumber(position.lineNumber);
        const editorRect = editor.getDomNode().getBoundingClientRect();
        
        return {
          x: editorRect.left + 50,
          y: editorRect.top + lineTop
        };
      }
    } catch (error) {
      console.log('Could not get editor position:', error);
    }
    
    return null;
  };

  const handleMouseDown = (e) => {
    if (panelMode !== 'floating') return;
    
    setIsDragging(true);
    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleMinimize = () => {
    setPanelMode('minimized');
  };

  const handleClose = () => {
    setPanelMode('docked');
  };

  const handleExpand = () => {
    setPanelMode(panelMode === 'floating' ? 'docked' : 'floating');
  };

  const handleModeChange = (mode) => {
    setPanelMode(mode);
    
    // Auto-position for different modes
    switch (mode) {
      case 'floating':
        setPosition({ x: window.innerWidth - 440, y: 80 });
        break;
      case 'overlay':
        positionOverlay();
        break;
      default:
        break;
    }
  };

  if (!isVisible || panelMode === 'minimized') {
    return (
      <div 
        className="feedback-minimized-tab"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: 'rgba(59, 130, 246, 0.9)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          fontSize: '12px',
          fontWeight: '600',
          zIndex: 1000,
          transition: 'all 0.3s ease',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
        }}
        onClick={() => setPanelMode('floating')}
      >
        🤖 AI Feedback ({feedback?.completionPercentage || 0}%)
      </div>
    );
  }

  const panelStyle = panelMode === 'floating' || panelMode === 'overlay'
    ? {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 1000,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s ease',
        width: '400px',
        height: '500px',
        maxHeight: '80vh'
      }
    : {};

  return (
    <>
      {/* Mode Toggle Controls */}
      {panelMode === 'docked' && (
        <div 
          className="panel-mode-controls"
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            display: 'flex',
            gap: '4px',
            zIndex: 10
          }}
        >
          <button
            className="mode-btn"
            onClick={() => handleModeChange('floating')}
            title="Float panel"
            style={{
              background: 'rgba(51, 65, 85, 0.7)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              color: '#94a3b8',
              borderRadius: '4px',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            📋
          </button>
          <button
            className="mode-btn"
            onClick={() => handleModeChange('overlay')}
            title="Overlay mode"
            style={{
              background: 'rgba(51, 65, 85, 0.7)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              color: '#94a3b8',
              borderRadius: '4px',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            🎯
          </button>
        </div>
      )}

      {/* Enhanced Feedback Panel */}
      <div
        ref={panelRef}
        style={panelStyle}
        onMouseDown={panelMode === 'floating' ? handleMouseDown : undefined}
      >
        <EnhancedFeedbackPanel
          feedback={feedback}
          isFloating={panelMode === 'floating' || panelMode === 'overlay'}
          isCompact={panelMode === 'overlay'}
          onMinimize={handleMinimize}
          onClose={handleClose}
          onExpand={handleExpand}
        />
      </div>

      {/* Floating Panel Styles */}
      <style jsx>{`
        .feedback-minimized-tab:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(0, 0, 0, 0.4);
        }
        
        .mode-btn:hover {
          background: rgba(71, 85, 105, 0.9) !important;
          color: #e2e8f0 !important;
        }
        
        .panel-mode-controls {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        
        .modern-feedback-panel:hover + .panel-mode-controls,
        .panel-mode-controls:hover {
          opacity: 1;
        }
      `}</style>
    </>
  );
};

export default FloatingFeedbackManager;