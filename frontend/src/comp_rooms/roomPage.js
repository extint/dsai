import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import DSAIEditor from './DSAIEditor';
import SessionSetupModal from './nickName/SessionSetupModal';
import './CompetitiveCodingRoom.css';
import { useParams } from 'react-router-dom';
import { Upload, Play, Square, LogOut, Users, Clock } from 'lucide-react';
// import { LeetCode } from 'leetcode-query';`
// const lc = new LeetCode();


const USERS_PER_PAGE = 3;
const PORT = process.env.REACT_APP_PORT || 3000; // Make sure this matches your backend port

export default function CompetitiveCodingRoom() {

  // --- Metrics helpers ---
  const now = () =>
    (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();

  const latencyBuckets = {
    samples: [],
    add(sample) {
      this.samples.push(sample);
      if (this.samples.length > 2000) this.samples.shift();
    },
    summary() {
      const byType = {};
      for (const s of this.samples) {
        (byType[s.eventType] ||= []).push(s.e2eLatencyMs);
      }
      const pct = (arr, p) => {
        if (!arr.length) return null;
        const a = [...arr].sort((x, y) => x - y);
        const idx = Math.floor((p / 100) * (a.length - 1));
        return Number(a[idx].toFixed(2));
      };
      const out = {};
      for (const [k, arr] of Object.entries(byType)) {
        out[k] = { count: arr.length, p50: pct(arr, 50), p95: pct(arr, 95) };
      }
      return out;
    }
  };

  const markClientReceiveAndRender = (eventType, payload = {}) => {
    const clientRecvTs = now();
    // Measure after React has painted
    requestAnimationFrame(() => {
      const clientRenderTs = now();
      const base = payload.clientEmitTs ?? clientRecvTs; // if no origin stamp, measure recv->render
      const e2eLatencyMs = Number((clientRenderTs - base).toFixed(2));
      const sample = {
        eventType,
        eventId: payload.eventId || 'unknown',
        e2eLatencyMs,
        clientRecvMs: Number((clientRecvTs - base).toFixed(2))
      };
      console.log('[METRIC][CLIENT]', sample);
      latencyBuckets.add(sample);
    });
  };

  // Emit helper to add tracing stamps
  const emitWithTrace = (socket, eventType, payload) => {
    const eventId = `${eventType}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    const clientEmitTs = now();
    socket.emit(eventType, { ...payload, eventId, clientEmitTs });
  };



  const { roomId } = useParams();

  // Generate unique username on every load (not editable, used internally)
  const username = useRef(`coder-${Math.random().toString(36).substr(2, 4)}`);

  // State hooks
  const [nickname, setNickname] = useState(null);  // User's chosen nickname
  const [users, setUsers] = useState([]);          // Array of { username, nickname }
  const [userCodes, setUserCodes] = useState({});
  const [userSubmissions, setUserSubmissions] = useState({});
  const [currentPage, setCurrentPage] = useState(0);
  const [roomTimer, setRoomTimer] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [roomStarted, setRoomStarted] = useState(false);
  const [roomEnded, setRoomEnded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [showRankingModal, setShowRankingModal] = useState(false);
  const [rankingData, setRankingData] = useState([]);
  const [lcHandle, setLcHandle] = useState('');
  const [targetSlug, setTargetSlug] = useState('');
  const [roomState, setRoomState] = useState({
    status: 'waiting', // 'waiting', 'started', 'ended'
    timeLimit: 60,
    timeRemaining: null
  });

  // Refs
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  const debounceRef = useRef(null);
  const fileInputRef = useRef(null);

  // Hook: Setup socket ONLY when nickname is set
  useEffect(() => {
    if (!nickname) return;

    const socket = io(`http://localhost:${PORT}`);
    socketRef.current = socket;

    const currentUser = username.current;
    socket.emit('joinRoom', { roomId, username: currentUser, nickname });

    // Enhanced room state management
    socket.on('roomStateUpdate', ({ status, timeLimit, timeRemaining }) => {
      console.log('Room state update received:', { status, timeLimit, timeRemaining });
      setRoomState({ status, timeLimit, timeRemaining });

      if (status === 'started') {
        setRoomStarted(true);
        setRoomEnded(false);
        if (timeRemaining) setTimeRemaining(timeRemaining);
      } else if (status === 'ended') {
        setRoomStarted(false);
        setRoomEnded(true);
        setTimeRemaining(null);
        console.log('Room ended - setting states');
      } else if (status === 'waiting') {
        setRoomStarted(false);
        setRoomEnded(false);
        setTimeRemaining(null);
      }
    });

    // CRITICAL: Fix the contestEnded handler
    socket.on('contestEnded', ({ ranking, eventId, clientEmitTs }) => {
      markClientReceiveAndRender('contestEnded', { eventId, clientEmitTs });
      console.log('Contest ended event received with ranking:', ranking);
      console.log(ranking);
      setRankingData(ranking);
      setShowRankingModal(true);

      // Force room state to ended
      setRoomEnded(true);
      setRoomStarted(false);
      setTimeRemaining(null);
      setRoomState(prev => ({ ...prev, status: 'ended' }));
    });

    // Handle room ended event
    socket.on('roomEnded', () => {
      console.log('Room ended event received');
      setRoomEnded(true);
      setRoomStarted(false);
      setTimeRemaining(null);
    });

    // Clear submissions when new session starts
    socket.on('clearSubmissions', () => {
      console.log('Clearing submissions');
      setUserSubmissions({});
      setSubmissionStatus(null);
    });

    socket.on('userListUpdate', (payload) => {
      // Normalize to array
      const list = Array.isArray(payload) ? payload : (payload?.users ?? []);
      // Optionally, coerce items to expected shape { username, nickname }
      const normalized = list.map(u => (
        typeof u === 'string' ? { username: u, nickname: u } : {
          username: u?.username ?? String(u?.user ?? ''),
          nickname: u?.nickname ?? u?.username ?? String(u?.user ?? '')
        }
      ));
      setUsers(normalized);

      // Trace fields if present
      const trace = Array.isArray(payload)
        ? {}
        : { eventId: payload.eventId, clientEmitTs: payload.clientEmitTs };
      markClientReceiveAndRender('userListUpdate', trace);
    });


    socket.on('contestEnded', ({ ranking }) => {
      setRankingData(ranking);
      setShowRankingModal(true);
      // Ensure room state is set to ended
      setRoomEnded(true);
      setRoomStarted(false);
    });

    // Listen to user list with nickname objects
    socket.on('userListUpdate', (usersWithNicknames) => {
      setUsers(usersWithNicknames); // Format: [{ username, nickname }]
    });

    // Contest ended with rankings
    socket.on('contestEnded', ({ ranking }) => {
      setRankingData(ranking);
      setShowRankingModal(true);
    });

    socket.on('loadAllCodes', (allCodes) => {
      setUserCodes(prev => ({ ...prev, ...allCodes }));
      markClientReceiveAndRender('loadAllCodes', {});
    });

    socket.on('userCodeUpdate', ({ user, code, eventId, clientEmitTs }) => {
      setUserCodes(prev => ({ ...prev, [user]: code }));
      markClientReceiveAndRender('userCodeUpdate', { eventId, clientEmitTs });
    });

    socket.on('loadUserCode', ({ user, code }) => {
      setUserCodes(prev => ({ ...prev, [user]: code }));
    });

    socket.on('roomStarted', ({ timeLimit }) => {
      setRoomStarted(true);
      setRoomEnded(false);
      setTimeRemaining(timeLimit * 60);
      setRoomTimer(timeLimit);
    });

    socket.on('roomEnded', () => {
      setRoomEnded(true);
      setRoomStarted(false);
      setTimeRemaining(null);
      clearInterval(timerRef.current);
    });

    socket.on('timerUpdate', ({ timeRemaining: remaining, eventId, clientEmitTs }) => {
      setTimeRemaining(remaining);
      markClientReceiveAndRender('timerUpdate', { eventId, clientEmitTs });
    });

    socket.on('userSubmissionUpdate', ({ user, status, timestamp, eventId, clientEmitTs }) => {
      markClientReceiveAndRender('userSubmissionUpdate', { eventId, clientEmitTs });
      console.log('User submission update:', { user, status, timestamp });
      setUserSubmissions(prev => ({
        ...prev,
        [user]: { status, timestamp }
      }));
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      clearInterval(timerRef.current);
    };
  }, [nickname, roomId]);


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

  // Format time for display
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    else return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Start, End, Quit room handlers
  const startRoom = () => {
    // Validate required fields
    if (!lcHandle || !lcHandle.trim()) {
      alert('Please enter your LeetCode handle');
      return;
    }

    if (!targetSlug || !targetSlug.trim()) {
      alert('Please enter the problem slug');
      return;
    }

    if (socketRef.current) {
      socketRef.current.emit('startRoom', {
        roomId,
        timeLimit: roomTimer,
        lcHandle: lcHandle.trim(),
        targetSlug: targetSlug.trim().toLowerCase()
      });
    }
  };



  const endRoom = () => {
    if (socketRef.current) socketRef.current.emit('endRoom', { roomId });
  };

  const quitRoom = () => {
    if (socketRef.current) socketRef.current.emit('leaveRoom', { roomId, username: username.current });
    window.location.href = '/'; // Or redirect to some lobby/homepage
  };

  const handleSubmit = async () => {
    if (!roomStarted || isSubmitting) return;
    setIsSubmitting(true);
    setSubmissionStatus('uploading');

    try {
      // Call your backend API endpoint that performs LeetCode verification
      const response = await fetch(`http://localhost:${PORT}/api/leetcode/verifyLCSubmission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          username: username.current,
          lcHandle,
          targetSlug
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        socketRef.current.emit('submissionComplete', {
          roomId,
          username: username.current,
          status: 'success',
          timestamp: Date.now()
        });
        setSubmissionStatus('success');
      } else {
        socketRef.current.emit('submissionComplete', {
          roomId,
          username: username.current,
          status: 'failed',
          timestamp: Date.now()
        });
        setSubmissionStatus('failed');
      }
    } catch (error) {
      console.error('LeetCode verification API error:', error);
      setSubmissionStatus('failed');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmissionStatus(null), 3000);
    }
  };

  // Handle file upload screenshot to backend
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

      const response = await fetch(`http://localhost:${PORT}/answerq/analyze-submission`, {
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
            timestamp: Date.now(),
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

  // Debounced code change handler to broadcast changes
  const handleChange = (code) => {
    if (userSubmissions[username.current]?.status === 'success') return; // Block if submitted

    setUserCodes(prev => ({ ...prev, [username.current]: code }));

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (socketRef.current) {
        emitWithTrace(socketRef.current, 'userCodeChange', {
          roomId,
          username: username.current,
          code,
        });
      }
    }, 300);
  };

  const canStartRoom = roomState.status === 'waiting' || roomState.status === 'ended';
  const canEndRoom = roomState.status === 'started';
  const isSessionActive = roomState.status === 'started';

  // Check if user is blocked from editing
  const isUserBlocked = (user) => {
    return userSubmissions[user]?.status === 'success' || !roomStarted || roomEnded;
  };

  useEffect(() => {
    const id = setInterval(() => {
      console.log('[METRIC][CLIENT][SUMMARY]', latencyBuckets.summary());
    }, 10000);
    return () => clearInterval(id);
  }, []);


  // Prepare users arrays with destructuring for rendering
  const mainUser = username.current;
  const safeUsers = Array.isArray(users) ? users : [];
const otherUsers = safeUsers.filter(u => u && u.username !== mainUser);
  // const otherUsers = users.filter(u => u.username !== mainUser);
  const totalPages = Math.ceil(otherUsers.length / USERS_PER_PAGE);
  const startIdx = currentPage * USERS_PER_PAGE;
  const otherUsersToShow = otherUsers.slice(startIdx, startIdx + USERS_PER_PAGE);

  if (!nickname || !lcHandle || !targetSlug) {
    return (
      <SessionSetupModal
        onSubmit={({ nickname, lcHandle, targetSlug }) => {
          setNickname(nickname);
          setLcHandle(lcHandle);
          setTargetSlug(targetSlug);
        }}
      />
    );
  }

  return (
    <div className="room-header">
      <div className="room-header-content">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <p><Users size={16} /> Users online: {users.length}</p>
        </div>

        <div className="timer-section">
          {isSessionActive && timeRemaining !== null && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }} className={`timer ${timeRemaining <= 300 ? 'timer-warning' : ''}`}>
              {/* <img src='/home/vedantmehra/Desktop/dsai/frontend/public/kitchen-timer.png'></img> */}
              <Clock style={{ marginRight: 15 + 'px' }} size={22} />
              <span style={{ fontSize: 25 + 'px' }} >{formatTime(timeRemaining)}</span>
            </div>
          )}

          {!isSessionActive && (
            <div className="timer-controls">
              <div className="timer-controls-inner">
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
            </div>
          )}
        </div>
        <div className="room-controls">
          {canStartRoom && (
            <button
              onClick={startRoom}
              className="start-btn"
              title="Start the coding session"
            >
              <Play size={16} /> Start Room
            </button>
          )}

          {canEndRoom && (
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

      {/* Main Layout: Left - other users, Right - main user */}
      <div className="main-layout">
        {/* Left panel: other users */}
        <div className="left-panel">
          <div className="other-users-header">
            <h3>Other Users ({otherUsers.length})</h3>
            {totalPages > 1 && (
              <div className="mini-pagination">
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 0))} disabled={currentPage === 0}>←</button>
                <span>{currentPage + 1}/{totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))} disabled={currentPage === totalPages - 1}>→</button>
              </div>
            )}
          </div>
          <div className="other-users-grid">
            {otherUsersToShow.map(({ username: otherUsername, nickname: otherNickname }) => (
              <div key={otherUsername} className="editor-container small readonly">
                <div className="editor-header">
                  <span>{otherNickname || otherUsername}</span>
                  <div className="user-status">
                    {userSubmissions[otherUsername]?.status === 'success' && <span className="status-badge success">✓ Submitted</span>}
                    <span className="readonly-badge">Read Only</span>
                  </div>
                </div>
                <DSAIEditor
                  defaultCode={userCodes[otherUsername] || '# Type your code here'}
                  readOnly={true}
                  language="python"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: main user */}
        <div className="right-panel">
          <div className="editor-container main you">
            <div className="editor-header">
              <span>You ({nickname || mainUser})</span>
              <div className="user-status">
                {userSubmissions[mainUser]?.status === 'success' && <span className="status-badge success">✓ Submitted</span>}
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
                onClick={handleSubmit}
                disabled={isUserBlocked(mainUser) || isSubmitting}
              >
                {isSubmitting ? 'Verifying...' : 'Submit'}
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

      {/* Ranking Modal (optional) */}
      {showRankingModal && (
        <ContestRankingsModal ranking={rankingData} onClose={() => setShowRankingModal(false)} />
      )}
    </div>
  );
}

function ContestRankingsModal({ ranking, onClose }) {
  console.log('🏆 Rendering rankings modal with data:', ranking);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content ranking-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🏆 Contest Rankings</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close rankings modal">
            ×
          </button>
        </div>

        <div className="ranking-table-container">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Participant</th>
                <th>Submission Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((user, idx) => {
                console.log(`Rendering user ${idx}:`, user);
                return (
                  <tr key={user.username || idx} className={user.status === 'success' ? 'success-row' : ''}>
                    <td className="rank-cell">#{idx + 1}</td>
                    <td className="nickname-cell">
                      {user.nickname || user.username || 'Unknown User'}
                    </td>
                    <td className="time-cell">
                      {user.timestamp ? new Date(user.timestamp).toLocaleString() : 'No submission'}
                    </td>
                    <td className="status-cell">
                      {user.status === 'success' && <span className="status-success">Success</span>}
                      {user.status === 'failed' && <span className="status-failed">Failed</span>}
                      {user.status === 'none' && <span className="status-none">Not Submitted</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-footer">
          <p>Total Participants: {ranking.length}</p>
        </div>
      </div>
    </div>
  );
}
