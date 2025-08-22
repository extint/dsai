import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './RoomSelection.css';
import { Users, Plus, ArrowRight, Clock, Code } from 'lucide-react';

const RoomSelectionPage = () => {
  const [roomId, setRoomId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const generateRoomId = () => {
    const adjectives = ['Swift', 'Clever', 'Bright', 'Quick', 'Smart', 'Sharp', 'Fast', 'Agile'];
    const nouns = ['Coders', 'Hackers', 'Devs', 'Programmers', 'Engineers', 'Builders'];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 1000);
    return `${adjective}${noun}${number}`;
  };

  const handleCreateRoom = () => {
    setIsCreating(true);
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    setTimeout(() => {
      navigate(`/room/${newRoomId}`);
    }, 1000);
  };

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      navigate(`/room/${roomId.trim()}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && roomId.trim()) {
      handleJoinRoom();
    }
  };

  return (
    <div className="room-selection-wrapper">
      <div className="room-selection-container">
        <div className="room-header">
          <div className="room-title">
            <Code size={32} className="title-icon" />
            <h1>Competitive Coding Rooms</h1>
          </div>
          <p className="room-subtitle">
            Collaborate, compete, and code together in real-time
          </p>
        </div>

        <div className="room-actions">
          {/* Create Room Section */}
          <div className="room-card">
            <div className="card-header">
              <Plus size={24} className="card-icon create-icon" />
              <h3>Create New Room</h3>
            </div>
            <p className="card-description">
              Start a new coding session and invite others to join
            </p>
            <div className="card-features">
              <div className="feature">
                <Clock size={16} />
                <span>Timed Sessions</span>
              </div>
              <div className="feature">
                <Users size={16} />
                <span>Multi-user Support</span>
              </div>
              <div className="feature">
                <Code size={16} />
                <span>Real-time Sync</span>
              </div>
            </div>
            <button 
              className="action-btn create-btn" 
              onClick={handleCreateRoom}
              disabled={isCreating}
            >
              {isCreating ? (
                <>
                  <div className="loading-spinner"></div>
                  Creating Room...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Room
                </>
              )}
            </button>
            {isCreating && (
              <div className="room-id-preview">
                Room ID: <strong>{roomId}</strong>
              </div>
            )}
          </div>

          {/* Join Room Section */}
          <div className="room-card">
            <div className="card-header">
              <ArrowRight size={24} className="card-icon join-icon" />
              <h3>Join Existing Room</h3>
            </div>
            <p className="card-description">
              Enter a room ID to join an ongoing session
            </p>
            <div className="join-room-form">
              <div className="input-container">
                <input
                  type="text"
                  placeholder="Enter Room ID (e.g., SwiftCoders123)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="room-input"
                  disabled={isCreating}
                />
              </div>
              <button 
                className="action-btn join-btn" 
                onClick={handleJoinRoom}
                disabled={!roomId.trim() || isCreating}
              >
                <ArrowRight size={16} />
                Join Room
              </button>
            </div>
          </div>
        </div>

        <div className="room-info">
          <h4>How it works:</h4>
          <div className="info-steps">
            <div className="step">
              <span className="step-number">1</span>
              <span>Create or join a room</span>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <span>Set your nickname and LeetCode handle</span>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <span>Start coding together in real-time</span>
            </div>
            <div className="step">
              <span className="step-number">4</span>
              <span>Submit solutions and view rankings</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomSelectionPage;
