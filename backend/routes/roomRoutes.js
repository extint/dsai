const express = require('express');
const { v4: uuidv4 } = require('uuid');
const rooms = require('../store/rooms');

const router = express.Router();

router.post('/create', (req, res) => {
  const roomId = uuidv4();
  rooms.set(roomId, { users: [], code: '', started: false });
  res.json({ roomId });
});

router.post('/join/:roomId', (req, res) => {
  const { roomId } = req.params;
  if (!rooms.has(roomId)) return res.status(404).json({ error: 'Room not found' });
  console.log("joining");
  res.json({ success: true });
});

module.exports = router;
