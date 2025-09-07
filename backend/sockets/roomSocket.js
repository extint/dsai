const redisClient = require('../redisClient');

const USER_LIST_KEY = (roomId) => `room:${roomId}:users`;
const USER_CODE_KEY = (roomId, username) => `room:${roomId}:user:${username}:code`;
const ROOM_TIMER_KEY = (roomId) => `room:${roomId}:timer`;
const ROOM_STATUS_KEY = (roomId) => `room:${roomId}:status`;
const ROOM_TIME_LIMIT_KEY = (roomId) => `room:${roomId}:timeLimit`;
const USER_SUBMISSION_KEY = (roomId, username) => `room:${roomId}:user:${username}:submission`;
const ROOM_NICKNAMES_KEY = (roomId) => `room:${roomId}:nicknames`;

// Timer intervals storage
const roomTimers = new Map();

// --- Metrics helpers ---
const sNow = () =>
  (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();

function logServerFanout(eventType, payload, marks, roomId, audienceCount) {
  const out = {
    eventType,
    eventId: payload?.eventId || 'unknown',
    roomId,
    audienceCount,
    serverRecvTs: marks.serverRecvTs,
    serverEmitTs: marks.serverEmitTs,
    fanoutWindowMs: Number((marks.serverEmitTs - marks.serverRecvTs).toFixed(2))
  };
  console.log('[METRIC][SERVER]', out);
}

async function getAudienceCount(io, roomId) {
  try {
    const sids = await io.in(roomId).allSockets();
    return sids.size;
  } catch {
    const room = io.sockets.adapter.rooms.get?.(roomId) || io.sockets.adapter.rooms[roomId];
    return room ? room.size || room.length || 0 : 0;
  }
}

function setupRoomSocket(io) {
  io.on("connection", (socket) => {
    socket.on("joinRoom", async ({ roomId, username, nickname }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.username = username;

      const nicknames = await redisClient.hGetAll(ROOM_NICKNAMES_KEY(roomId));
      const allNicknames = Object.values(nicknames).map(n => n.toLowerCase());

      let finalNickname = nickname && !allNicknames.includes(nickname.toLowerCase())
        ? nickname
        : `Guest${Math.floor(Math.random() * 10000)}`;

      // Save nickname for username
      await redisClient.hSet(ROOM_NICKNAMES_KEY(roomId), username, finalNickname);

      // Add user to Redis user set
      await redisClient.sAdd(USER_LIST_KEY(roomId), username);

      // Emit updated users with nicknames
      const updatedUsers = await redisClient.sMembers(USER_LIST_KEY(roomId));
      const updatedNicknames = await redisClient.hGetAll(ROOM_NICKNAMES_KEY(roomId));

      const usersWithNicknames = updatedUsers.map(u => ({
        username: u,
        nickname: updatedNicknames[u] || u
      }));

      {
        const eventId = `userListUpdate-${roomId}-${Date.now()}`;
        const marks = { serverRecvTs: sNow() };
        io.to(roomId).emit('userListUpdate', { users: usersWithNicknames, eventId, clientEmitTs: null });
        marks.serverEmitTs = sNow();
        const audienceCount = await getAudienceCount(io, roomId);
        logServerFanout('userListUpdate', { eventId }, marks, roomId, audienceCount);
      }

      // Load this user's code
      const userCode = await redisClient.get(USER_CODE_KEY(roomId, username)) || '';
      socket.emit("loadUserCode", { user: username, code: userCode });

      // Load all codes for new user
      const allCodes = {};
      for (const user of updatedUsers) {
        const code = await redisClient.get(USER_CODE_KEY(roomId, user)) || '';
        allCodes[user] = code;
      }
      socket.emit("loadAllCodes", allCodes);

      // Send comprehensive room status to newly joined user
      const roomStatus = await redisClient.get(ROOM_STATUS_KEY(roomId));
      const timeLimit = await redisClient.get(ROOM_TIME_LIMIT_KEY(roomId));
      const timeRemaining = await redisClient.get(ROOM_TIMER_KEY(roomId));

      // Send current room state
      socket.emit("roomStateUpdate", {
        status: roomStatus || 'waiting',
        timeLimit: parseInt(timeLimit) || 60,
        timeRemaining: parseInt(timeRemaining) || null
      });

      if (roomStatus === 'started' && timeRemaining) {
        socket.emit("roomStarted", {
          timeLimit: parseInt(timeLimit) || 60,
          timeRemaining: parseInt(timeRemaining)
        });
        socket.emit("timerUpdate", { timeRemaining: parseInt(timeRemaining) });
      } else if (roomStatus === 'ended') {
        socket.emit("roomEnded");
      }

      // Load user submissions status
      const submissions = {};
      for (const user of updatedUsers) {
        const submissionData = await redisClient.get(USER_SUBMISSION_KEY(roomId, user));
        if (submissionData) {
          submissions[user] = JSON.parse(submissionData);
        }
      }
      socket.emit("loadSubmissions", submissions);

      console.log(`User ${nickname} joined room ${roomId} (Status: ${roomStatus || 'waiting'})`);
    });

    // Handle per-user code changes
    socket.on("userCodeChange", async ({ roomId, username, code, eventId, clientEmitTs }) => {
      const marks = { serverRecvTs: sNow() };

      const userSubmission = await redisClient.get(USER_SUBMISSION_KEY(roomId, username));
      const roomStatus = await redisClient.get(ROOM_STATUS_KEY(roomId));

      if (userSubmission) {
        const submission = JSON.parse(userSubmission);
        if (submission.status === 'success') return; // Block code changes after successful submission
      }
      if (roomStatus !== 'started') return; // Block if room hasn't started

      await redisClient.set(USER_CODE_KEY(roomId, username), code);

      // Broadcast to others and echo trace fields
      io.to(roomId).emit("userCodeUpdate", {
        user: username,
        code,
        eventId,
        clientEmitTs
      });

      marks.serverEmitTs = sNow();

      const audienceCount = await getAudienceCount(io, roomId);
      logServerFanout('userCodeUpdate', { eventId }, marks, roomId, audienceCount);
    });

    // Room management events
    socket.on("startRoom", async ({ roomId, timeLimit, lcHandle, targetSlug }) => {
      const timeInSeconds = timeLimit * 60;

      // Clear any existing timer
      if (roomTimers.has(roomId)) {
        clearInterval(roomTimers.get(roomId));
        roomTimers.delete(roomId);
      }

      // Reset room state
      await redisClient.set(ROOM_STATUS_KEY(roomId), 'started');
      await redisClient.set(ROOM_TIME_LIMIT_KEY(roomId), timeLimit);
      await redisClient.set(ROOM_TIMER_KEY(roomId), timeInSeconds);

      // Clear all previous submissions when starting new session
      const allUsers = await redisClient.sMembers(USER_LIST_KEY(roomId));
      for (const user of allUsers) {
        await redisClient.del(USER_SUBMISSION_KEY(roomId, user));
      }

      // FIXED: Validate lcHandle and targetSlug before storing
      if (lcHandle && targetSlug &&
        typeof lcHandle === 'string' && lcHandle.trim().length > 0 &&
        typeof targetSlug === 'string' && targetSlug.trim().length > 0) {

        try {
          await redisClient.hSet(
            `room:${roomId}:lcInfo`,
            socket.username,
            JSON.stringify({
              lcHandle: lcHandle.trim(),
              targetSlug: targetSlug.trim().toLowerCase()
            })
          );
          console.log(`✅ Stored LeetCode info for ${socket.username}: ${lcHandle}, ${targetSlug}`);
        } catch (redisError) {
          console.error('❌ Redis operation failed:', redisError);
          socket.emit('error', { message: 'Failed to store LeetCode information' });
          return;
        }
      } else {
        console.warn(`⚠️  Missing or invalid LeetCode info for ${socket.username}:`, { lcHandle, targetSlug });
        socket.emit('error', { message: 'LeetCode handle and problem slug are required' });
        return;
      }

      // Broadcast room started to all users
      io.to(roomId).emit("roomStarted", { timeLimit });
      io.to(roomId).emit("roomStateUpdate", {
        status: 'started',
        timeLimit,
        timeRemaining: timeInSeconds
      });

      // Clear previous submissions from all clients
      io.to(roomId).emit("clearSubmissions");

      // Start countdown timer
      startRoomTimer(io, roomId, timeInSeconds);

      console.log(`🚀 Room ${roomId} started with ${timeLimit} minutes for problem: ${targetSlug}`);
    });

    socket.on("endRoom", async ({ roomId }) => {
      // Clear timer
      if (roomTimers.has(roomId)) {
        clearInterval(roomTimers.get(roomId));
        roomTimers.delete(roomId);
      }

      await redisClient.set(ROOM_STATUS_KEY(roomId), 'ended');
      await redisClient.del(ROOM_TIMER_KEY(roomId));

      // Generate final rankings before ending
      await generateAndBroadcastRankings(io, roomId);

      // Broadcast room ended
      io.to(roomId).emit("roomEnded");
      io.to(roomId).emit("roomStateUpdate", {
        status: 'ended',
        timeLimit: null,
        timeRemaining: null
      });

      console.log(`Room ${roomId} ended manually`);
    });

    socket.on("leaveRoom", async ({ roomId, username }) => {

      await redisClient.sRem(USER_LIST_KEY(roomId), username);
      await redisClient.del(USER_CODE_KEY(roomId, username));
      await redisClient.del(USER_SUBMISSION_KEY(roomId, username));
      await redisClient.hDel(ROOM_NICKNAMES_KEY(roomId), username);

      const remainingUsers = await redisClient.sMembers(USER_LIST_KEY(roomId));

      if (remainingUsers.length > 0) {
        const updatedNicknames = await redisClient.hGetAll(ROOM_NICKNAMES_KEY(roomId));
        const usersWithNicknames = remainingUsers.map(u => ({
          username: u,
          nickname: updatedNicknames[u] || u
        }));

        const eventId = `userListUpdate-${roomId}-${Date.now()}`;
        const marks = { serverRecvTs: sNow() };
        io.to(roomId).emit("userListUpdate", { users: usersWithNicknames, eventId, clientEmitTs: null });
        marks.serverEmitTs = sNow();
        const audienceCount = await getAudienceCount(io, roomId);
        logServerFanout("userListUpdate", { eventId }, marks, roomId, audienceCount);
      } else {
        await cleanupRoom(roomId);
      }


      socket.leave(roomId);
      console.log(`User ${username} left room ${roomId}`);
    });

    // Submission events - FIXED
    socket.on('submissionComplete', async ({ roomId, username, status, timestamp, eventId, clientEmitTs }) => {
      const marks = { serverRecvTs: sNow() };

      const nicknames = await redisClient.hGetAll(ROOM_NICKNAMES_KEY(roomId));
      const nickname = nicknames[username] || username;

      const submissionData = { status, timestamp, nickname, username };
      await redisClient.set(USER_SUBMISSION_KEY(roomId, username), JSON.stringify(submissionData));

      // Echo trace fields in broadcast
      io.to(roomId).emit('userSubmissionUpdate', {
        user: username,
        nickname,
        status,
        timestamp,
        eventId,
        clientEmitTs
      });

      marks.serverEmitTs = sNow();
      const audienceCount = await getAudienceCount(io, roomId);
      logServerFanout('userSubmissionUpdate', { eventId }, marks, roomId, audienceCount);

      // Existing "all submitted" logic unchanged:
      const allUsers = await redisClient.sMembers(USER_LIST_KEY(roomId));
      const submissions = await Promise.all(allUsers.map(async u => {
        const dataStr = await redisClient.get(USER_SUBMISSION_KEY(roomId, u));
        return dataStr ? JSON.parse(dataStr) : { status: "none", timestamp: null, username: u };
      }));
      const allSubmitted = submissions.every(sub => sub.status === 'success' || sub.status === 'failed');

      if (allSubmitted && allUsers.length > 0) {
        if (roomTimers.has(roomId)) {
          clearInterval(roomTimers.get(roomId));
          roomTimers.delete(roomId);
        }
        await redisClient.set(ROOM_STATUS_KEY(roomId), 'ended');
        await redisClient.del(ROOM_TIMER_KEY(roomId));
        await generateAndBroadcastRankings(io, roomId);
        io.to(roomId).emit("roomEnded");
        io.to(roomId).emit("roomStateUpdate", {
          status: 'ended',
          timeLimit: null,
          timeRemaining: null
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      const { roomId, username } = socket;
      if (!roomId || !username) return;

      await redisClient.sRem(USER_LIST_KEY(roomId), username);
      await redisClient.del(USER_CODE_KEY(roomId, username));
      await redisClient.del(USER_SUBMISSION_KEY(roomId, username));
      await redisClient.hDel(ROOM_NICKNAMES_KEY(roomId), username);

      const remainingUsers = await redisClient.sMembers(USER_LIST_KEY(roomId));

      if (remainingUsers.length > 0) {
        const updatedNicknames = await redisClient.hGetAll(ROOM_NICKNAMES_KEY(roomId));
        const usersWithNicknames = remainingUsers.map(u => ({
          username: u,
          nickname: updatedNicknames[u] || u
        }));

        const eventId = `userListUpdate - ${ roomId } - ${ Date.now() }`;
        const marks = { serverRecvTs: sNow() };
        io.to(roomId).emit("userListUpdate", { users: usersWithNicknames, eventId, clientEmitTs: null });
        marks.serverEmitTs = sNow();
        const audienceCount = await getAudienceCount(io, roomId);
        logServerFanout("userListUpdate", { eventId }, marks, roomId, audienceCount);
      } else {
        await cleanupRoom(roomId);
      }
      console.log(`User ${username} disconnected from ${roomId}`);
    });
  });
}

// Enhanced timer management function
function startRoomTimer(io, roomId, initialTime) {
  // Clear any existing timer
  if (roomTimers.has(roomId)) {
    clearInterval(roomTimers.get(roomId));
  }

  const timerInterval = setInterval(async () => {
    const currentTime = await redisClient.get(ROOM_TIMER_KEY(roomId));

    if (!currentTime || parseInt(currentTime) <= 0) {
      // Timer expired
      clearInterval(timerInterval);
      roomTimers.delete(roomId);

      await redisClient.set(ROOM_STATUS_KEY(roomId), 'ended');
      await redisClient.del(ROOM_TIMER_KEY(roomId));

      // Generate final rankings
      await generateAndBroadcastRankings(io, roomId);

      io.to(roomId).emit("roomEnded");
      io.to(roomId).emit("roomStateUpdate", {
        status: 'ended',
        timeLimit: null,
        timeRemaining: null
      });

      console.log(`Room ${roomId} timer expired`);
      return;
    }

    const newTime = parseInt(currentTime) - 1;
    await redisClient.set(ROOM_TIMER_KEY(roomId), newTime);

    // Broadcast timer update every second
    {
      const eventId = `timerUpdate-${roomId}-${Date.now()}`;
      const marks = { serverRecvTs: sNow() };
      // No originating client, so clientEmitTs is null
      io.to(roomId).emit("timerUpdate", { timeRemaining: newTime, eventId, clientEmitTs: null });
      marks.serverEmitTs = sNow();
      const audienceCount = await getAudienceCount(io, roomId);
      logServerFanout('timerUpdate', { eventId }, marks, roomId, audienceCount);
    }

    // Check if room was manually ended
    const roomStatus = await redisClient.get(ROOM_STATUS_KEY(roomId));
    if (roomStatus === 'ended') {
      clearInterval(timerInterval);
      roomTimers.delete(roomId);
    }
  }, 1000);

  // Store timer reference
  roomTimers.set(roomId, timerInterval);
  return timerInterval;
}

// Helper function to generate and broadcast rankings
async function generateAndBroadcastRankings(io, roomId) {
  const allUsers = await redisClient.sMembers(USER_LIST_KEY(roomId));
  const nicknames = await redisClient.hGetAll(ROOM_NICKNAMES_KEY(roomId)); // Get all nicknames

  const submissions = await Promise.all(allUsers.map(async u => {
    const dataStr = await redisClient.get(USER_SUBMISSION_KEY(roomId, u));
    const parsedData = dataStr ? JSON.parse(dataStr) : {
      status: "none",
      timestamp: null,
      username: u,
      nickname: nicknames[u] || u // Ensure nickname is always present
    };

    // Make sure nickname is set even if not in submission data
    if (!parsedData.nickname) {
      parsedData.nickname = nicknames[u] || u;
    }

    return parsedData;
  }));

  // Sort by timestamp (successful submissions first, then by time)
  const ranking = submissions
    .sort((a, b) => {
      // Success submissions come first
      if (a.status === 'success' && b.status !== 'success') return -1;
      if (b.status === 'success' && a.status !== 'success') return 1;

      // Among successful submissions, sort by timestamp
      if (a.status === 'success' && b.status === 'success') {
        return (a.timestamp || Infinity) - (b.timestamp || Infinity);
      }

      // For failed/none submissions, sort by timestamp
      return (a.timestamp || Infinity) - (b.timestamp || Infinity);
    });

  {
    const eventId = `contestEnded-${roomId}-${Date.now()}`;
    const marks = { serverRecvTs: sNow() };
    io.to(roomId).emit('contestEnded', { ranking, eventId, clientEmitTs: null });
    marks.serverEmitTs = sNow();
    const audienceCount = await getAudienceCount(io, roomId);
    logServerFanout('contestEnded', { eventId }, marks, roomId, audienceCount);
  }

  console.log(`Rankings broadcasted for room ${roomId}:`, ranking.map(r => `${r.nickname}(${r.status})`));
}

// Enhanced cleanup function
async function cleanupRoom(roomId) {
  // Clear timer if exists
  if (roomTimers.has(roomId)) {
    clearInterval(roomTimers.get(roomId));
    roomTimers.delete(roomId);
  }

  const keys = [
    USER_LIST_KEY(roomId),
    ROOM_TIMER_KEY(roomId),
    ROOM_STATUS_KEY(roomId),
    ROOM_TIME_LIMIT_KEY(roomId),
    ROOM_NICKNAMES_KEY(roomId),
    `room:${roomId}:lcInfo`
  ];

  // Delete all room-related keys
  for (const key of keys) {
    await redisClient.del(key);
  }

  // Clean up user-specific data
  const pattern = `room:${roomId}:user:*`;
  const userKeys = await redisClient.keys(pattern);
  if (userKeys.length > 0) {
    await redisClient.del(userKeys);
  }

  console.log(`Cleaned up room ${roomId}`);
}

module.exports = { setupRoomSocket };
