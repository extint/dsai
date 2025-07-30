import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import DSAIEditor from './DSAIEditor';
import './CompetitiveCodingRoom.css';
import { useParams } from 'react-router-dom';
import { Upload, Play, Square, LogOut, Users, Clock } from 'lucide-react';

const USERS_PER_PAGE = 3;

export default function CompetitiveCodingRoom() {
  const { roomId } = useParams();
  const username = useRef(`coder-${Math.random().toString(36).substr(2, 4)}`);
  const [users, setUsers] = useState([]);
  const [userCodes, setUserCodes] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [roomTimer, setRoomTimer] = useState(60); // Default 60 minutes
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [roomStarted, setRoomStarted] = useState(false);
  const [roomEnded, setRoomEnded] = useState(false);
  const [userSubmissions, setUserSubmissions] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const socketRef = useRef(null);
  const debounceRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize socket connection and event handlers
  useEffect(() => {
    const socket = io('http://localhost:5173');
    socketRef.current = socket;

    const currentUser = username.current;

    setUsers([currentUser]);
    setUserCodes({ [currentUser]: '# Type your code here' });

    socket.emit('joinRoom', { roomId, username: currentUser });

    socket.on('userListUpdate', (updatedUsers) => {
      console.log('User list updated:', updatedUsers);
      setUsers(updatedUsers);
    });

    socket.on('loadAllCodes', (allCodes) => {
      console.log('Loading all codes:', allCodes);
      setUserCodes(prev => ({ ...prev, ...allCodes }));
    });

    socket.on('userCodeUpdate', ({ user, code }) => {
      console.log('Code update from user:', user);
      setUserCodes(prev => ({ ...prev, [user]: code }));
    });

    socket.on('loadUserCode', ({ user, code }) => {
      console.log('Loading user code:', user, code);
      setUserCodes(prev => ({ ...prev, [user]: code }));
    });

    // Room timer events
    socket.on('roomStarted', ({ timeLimit }) => {
      setRoomStarted(true);
      setTimeRemaining(timeLimit * 60); // Convert minutes to seconds
      setRoomTimer(timeLimit);
    });

    socket.on('roomEnded', () => {
      setRoomEnded(true);
      setRoomStarted(false);
      setTimeRemaining(null);
      clearInterval(timerRef.current);
    });

    socket.on('timerUpdate', ({ timeRemaining: remaining }) => {
      setTimeRemaining(remaining);
    });

    // Submission events
    socket.on('userSubmissionUpdate', ({ user, status, timestamp }) => {
      setUserSubmissions(prev => ({
        ...prev,
        [user]: { status, timestamp }
      }));
    });

    return () => {
      socket.disconnect();
      clearInterval(timerRef.current);
    };
  }, [roomId]);

  // Timer countdown effect
  useEffect(() => {
    if (roomStarted && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setRoomEnded(true);
            setRoomStarted(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timerRef.current);
  }, [roomStarted, timeRemaining]);

  // Format time display
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Room management functions
  const startRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('startRoom', { roomId, timeLimit: roomTimer });
    }
  };

  const endRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('endRoom', { roomId });
    }
  };

  const quitRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('leaveRoom', { roomId, username: username.current });
    }
    window.location.href = '/';
  };

  // Screenshot submission handling
  const handleSubmit = async (user) => {
    if (user !== username.current) return;

    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsSubmitting(true);
    setSubmissionStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('screenshot', file);
      formData.append('roomId', roomId);
      formData.append('username', username.current);

      const response = await fetch('http://localhost:5000/analyze-submission', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setSubmissionStatus('success');
        if (socketRef.current) {
          socketRef.current.emit('submissionComplete', {
            roomId,
            username: username.current,
            status: 'success',
            timestamp: Date.now()
          });
        }
      } else {
        setSubmissionStatus('failed');
      }
    } catch (error) {
      console.error('Submission error:', error);
      setSubmissionStatus('failed');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmissionStatus(null), 3000);
    }
  };

  // Handle code changes with debounce
  const handleChange = (code) => {
    if (userSubmissions[username.current]?.status === 'success') return; // Block if submitted

    setUserCodes(prev => ({ ...prev, [username.current]: code }));

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (socketRef.current) {
        socketRef.current.emit('userCodeChange', {
          roomId,
          username: username.current,
          code
        });
      }
    }, 300);
  };

  // Check if user is blocked from editing
  const isUserBlocked = (user) => {
    return userSubmissions[user]?.status === 'success' || !roomStarted || roomEnded;
  };

  // Separate main user from other users
  const mainUser = username.current;
  const otherUsers = users.filter(u => u !== mainUser);
  const totalPages = Math.ceil(otherUsers.length / USERS_PER_PAGE);
  const startIdx = currentPage * USERS_PER_PAGE;
  const otherUsersToShow = otherUsers.slice(startIdx, startIdx + USERS_PER_PAGE);

  return (
    <div className="room-wrapper">
      {/* Room Header with Timer and Controls */}
      <div className="room-header">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <p><Users size={16} /> Users online: {users.length}</p>
        </div>

        <div className="timer-section">
          {roomStarted && !roomEnded && (
            <div className={`timer ${timeRemaining <= 300 ? 'timer-warning' : ''}`}>
              <span>⏱️ {formatTime(timeRemaining)}</span>
            </div>
          )}

          {!roomStarted && (
            <div className="timer-controls">
              <label htmlFor="room-timer-input">
                <Clock size={18} /> Time Limit (minutes)
              </label>
              <input
                id="room-timer-input"
                type="number"
                value={roomTimer}
                onChange={(e) => setRoomTimer(Number(e.target.value))}
                min="1"
                max="300"
                className="timer-input"
                placeholder="60"
              />
            </div>
          )}
        </div>

        <div className="room-controls">
          {/* Conditionally show Start or End button */}
          {!roomStarted && (
            <button
              onClick={startRoom}
              className="start-btn"
              title="Start the coding session"
            >
              <Play size={16} /> Start Room
            </button>
          )}

          {roomStarted && !roomEnded && (
            <button
              onClick={endRoom}
              className="end-btn"
              title="End the coding session"
            >
              <Square size={16} /> End Room
            </button>
          )}

          <button
            onClick={quitRoom}
            className="quit-btn"
            title="Leave the room"
          >
            <LogOut size={16} /> Quit
          </button>
        </div>
      </div>

      <div className="main-layout">
        {/* Left side - Other users' IDEs */}
        <div className="left-panel">
          <div className="other-users-header">
            <h3>Other Users ({otherUsers.length})</h3>
            {totalPages > 1 && (
              <div className="mini-pagination">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
                  disabled={currentPage === 0}
                >
                  ←
                </button>
                <span>{currentPage + 1}/{totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))}
                  disabled={currentPage === totalPages - 1}
                >
                  →
                </button>
              </div>
            )}
          </div>

          <div className="other-users-grid">
            {otherUsersToShow.map((u) => (
              <div key={u} className="editor-container small readonly">
                <div className="editor-header">
                  <span>{u}</span>
                  <div className="user-status">
                    {userSubmissions[u]?.status === 'success' && (
                      <span className="status-badge success">✓ Submitted</span>
                    )}
                    <span className="readonly-badge">Read Only</span>
                  </div>
                </div>
                <DSAIEditor
                  defaultCode={userCodes[u] || '# Type your code here'}
                  readOnly={true}
                  language="python"
                />
                {/* <div className="ide-footer"> */}
                  {/* <button
                    className="submit-btn small"
                    disabled={true}
                  >
                    Submit
                  </button> */}
                {/* </div> */}
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Main user's IDE */}
        <div className="right-panel">
          <div className="editor-container main you">
            <div className="editor-header">
              <span>You ({mainUser})</span>
              <div className="user-status">
                {userSubmissions[mainUser]?.status === 'success' && (
                  <span className="status-badge success">✓ Submitted</span>
                )}
                {submissionStatus && (
                  <span className={`status-badge ${submissionStatus}`}>
                    {submissionStatus === 'uploading' && '⏳ Analyzing...'}
                    {submissionStatus === 'success' && '✓ Submission Verified'}
                    {submissionStatus === 'failed' && '✗ Submission Failed'}
                  </span>
                )}
                <span className="main-badge">Main Editor</span>
              </div>
            </div>
            <DSAIEditor
              defaultCode={userCodes[mainUser] || '# Type your code here'}
              readOnly={isUserBlocked(mainUser)}
              onChange={handleChange}
              language="python"
            />
            <div className="ide-footer">
              <button
                className="submit-btn"
                onClick={() => handleSubmit(mainUser)}
                disabled={isUserBlocked(mainUser) || isSubmitting}
              >
                <Upload size={16} />
                {isSubmitting ? 'Analyzing...' : 'Submit Screenshot'}
              </button>
              {isUserBlocked(mainUser) && userSubmissions[mainUser]?.status !== 'success' && (
                <span className="blocked-message">
                  {!roomStarted ? 'Room not started' : roomEnded ? 'Room ended' : 'Blocked'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input for screenshot upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* Submission status overlay */}
      {submissionStatus === 'uploading' && (
        <div className="submission-overlay">
          <div className="submission-modal">
            <h3>Analyzing Screenshot...</h3>
            <div className="loading-spinner"></div>
            <p>Please wait while we verify your LeetCode submission</p>
          </div>
        </div>
      )}
    </div>
  );
}
