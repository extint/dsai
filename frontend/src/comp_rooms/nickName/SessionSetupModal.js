// src/comp_rooms/SessionSetupModal.jsx
import React, { useState } from 'react';
import "./SessionSetupModal.css";

export default function SessionSetupModal({ onSubmit }) {
  const [nickname, setNickname] = useState('');
  const [lcHandle, setLcHandle] = useState('');
  const [targetSlug, setTargetSlug] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const n = nickname.trim();
    const h = lcHandle.trim();
    const s = targetSlug.trim().toLowerCase();

    if (!n) return setError("Please enter a nickname");
    if (n.length > 20) return setError("Nickname must be ≤ 20 chars");
    if (!h) return setError("Please enter your LeetCode handle");
    if (!s) return setError("Please enter the problem slug");

    setError('');
    onSubmit({ nickname: n, lcHandle: h, targetSlug: s });
  };

  const onKey = e => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div style={{padding:10 + "px"}} className="modal-content">
        <h2>Session Setup</h2>
        <input
          type="text"
          placeholder="Enter nickname"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          onKeyDown={onKey}
          maxLength={20}
          autoFocus
        />
        <input
          type="text"
          placeholder="LeetCode handle"
          value={lcHandle}
          onChange={e => setLcHandle(e.target.value)}
          onKeyDown={onKey}
        />
        <input
          type="text"
          placeholder="Problem slug (e.g. two-sum)"
          value={targetSlug}
          onChange={e => setTargetSlug(e.target.value)}
          onKeyDown={onKey}
        />
        {error && <div className="error">{error}</div>}
        <button onClick={handleSubmit} className="submit-btn">
          Start Session
        </button>
      </div>
    </div>
);
}
