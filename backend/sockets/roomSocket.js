const redisClient = require('../redisClient');

const USER_LIST_KEY = (roomId) => `room:${roomId}:users`;
const USER_CODE_KEY = (roomId, username) => `room:${roomId}:user:${username}:code`;
const ROOM_TIMER_KEY = (roomId) => `room:${roomId}:timer`;
const ROOM_STATUS_KEY = (roomId) => `room:${roomId}:status`;
const ROOM_TIME_LIMIT_KEY = (roomId) => `room:${roomId}:timeLimit`;
const USER_SUBMISSION_KEY = (roomId, username) => `room:${roomId}:user:${username}:submission`;

function setupRoomSocket(io) {
  io.on("connection", (socket) => {
    socket.on("joinRoom", async ({ roomId, username }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.username = username;

      // Add user to Redis set
      await redisClient.sAdd(USER_LIST_KEY(roomId), username);

      // Send updated user list
      const updatedUsers = await redisClient.sMembers(USER_LIST_KEY(roomId));
      io.to(roomId).emit("userListUpdate", updatedUsers);

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

      // Send room status to newly joined user
      const roomStatus = await redisClient.get(ROOM_STATUS_KEY(roomId));
      const timeLimit = await redisClient.get(ROOM_TIME_LIMIT_KEY(roomId));
      const timeRemaining = await redisClient.get(ROOM_TIMER_KEY(roomId));

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

      console.log(`User ${username} joined room ${roomId}`);
    });

    // Handle per-user code changes
    socket.on("userCodeChange", async ({ roomId, username, code }) => {
      // Check if user is allowed to make changes
      const userSubmission = await redisClient.get(USER_SUBMISSION_KEY(roomId, username));
      const roomStatus = await redisClient.get(ROOM_STATUS_KEY(roomId));
      
      if (userSubmission) {
        const submission = JSON.parse(userSubmission);
        if (submission.status === 'success') {
          return; // Block code changes after successful submission
        }
      }
      
      if (roomStatus !== 'started') {
        return; // Block code changes if room hasn't started
      }

      await redisClient.set(USER_CODE_KEY(roomId, username), code);

      // Broadcast to others in room
      socket.broadcast.to(roomId).emit("userCodeUpdate", {
        user: username,
        code,
      });
    });

    // Room management events
    socket.on("startRoom", async ({ roomId, timeLimit }) => {
      const timeInSeconds = timeLimit * 60; // Convert minutes to seconds
      
      await redisClient.set(ROOM_STATUS_KEY(roomId), 'started');
      await redisClient.set(ROOM_TIME_LIMIT_KEY(roomId), timeLimit);
      await redisClient.set(ROOM_TIMER_KEY(roomId), timeInSeconds);

      // Broadcast room started to all users
      io.to(roomId).emit("roomStarted", { timeLimit });

      // Start countdown timer
      startRoomTimer(io, roomId, timeInSeconds);

      console.log(`Room ${roomId} started with ${timeLimit} minutes`);
    });

    socket.on("endRoom", async ({ roomId }) => {
      await redisClient.set(ROOM_STATUS_KEY(roomId), 'ended');
      await redisClient.del(ROOM_TIMER_KEY(roomId));

      // Stop timer and broadcast room ended
      io.to(roomId).emit("roomEnded");

      console.log(`Room ${roomId} ended`);
    });

    socket.on("leaveRoom", async ({ roomId, username }) => {
      await redisClient.sRem(USER_LIST_KEY(roomId), username);
      await redisClient.del(USER_CODE_KEY(roomId, username));
      await redisClient.del(USER_SUBMISSION_KEY(roomId, username));

      const remainingUsers = await redisClient.sMembers(USER_LIST_KEY(roomId));
      io.to(roomId).emit("userListUpdate", remainingUsers);

      socket.leave(roomId);

      if (remainingUsers.length === 0) {
        // Cleanup room data
        await cleanupRoom(roomId);
      }

      console.log(`User ${username} left room ${roomId}`);
    });

    // Submission events
    socket.on("submissionComplete", async ({ roomId, username, status, timestamp }) => {
      const submissionData = {
        status,
        timestamp,
        user: username
      };

      await redisClient.set(
        USER_SUBMISSION_KEY(roomId, username), 
        JSON.stringify(submissionData)
      );

      // Broadcast submission update to all users in room
      io.to(roomId).emit("userSubmissionUpdate", {
        user: username,
        status,
        timestamp
      });

      console.log(`User ${username} submitted with status: ${status} in room ${roomId}`);
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      const { roomId, username } = socket;
      if (!roomId || !username) return;

      await redisClient.sRem(USER_LIST_KEY(roomId), username);
      await redisClient.del(USER_CODE_KEY(roomId, username));
      await redisClient.del(USER_SUBMISSION_KEY(roomId, username));

      const remainingUsers = await redisClient.sMembers(USER_LIST_KEY(roomId));
      io.to(roomId).emit("userListUpdate", remainingUsers);

      if (remainingUsers.length === 0) {
        await cleanupRoom(roomId);
      }

      console.log(`User ${username} disconnected from ${roomId}`);
    });
  });
}

// Timer management function
function startRoomTimer(io, roomId, initialTime) {
  const timerInterval = setInterval(async () => {
    const currentTime = await redisClient.get(ROOM_TIMER_KEY(roomId));
    
    if (!currentTime || parseInt(currentTime) <= 0) {
      // Timer expired
      clearInterval(timerInterval);
      await redisClient.set(ROOM_STATUS_KEY(roomId), 'ended');
      await redisClient.del(ROOM_TIMER_KEY(roomId));
      
      io.to(roomId).emit("roomEnded");
      console.log(`Room ${roomId} timer expired`);
      return;
    }

    const newTime = parseInt(currentTime) - 1;
    await redisClient.set(ROOM_TIMER_KEY(roomId), newTime);
    
    // Broadcast timer update every second
    io.to(roomId).emit("timerUpdate", { timeRemaining: newTime });
    
    // Check if room was manually ended
    const roomStatus = await redisClient.get(ROOM_STATUS_KEY(roomId));
    if (roomStatus === 'ended') {
      clearInterval(timerInterval);
    }
  }, 1000);

  // Store timer reference for cleanup (optional)
  return timerInterval;
}

// Cleanup function for room data
async function cleanupRoom(roomId) {
  const keys = [
    USER_LIST_KEY(roomId),
    ROOM_TIMER_KEY(roomId),
    ROOM_STATUS_KEY(roomId),
    ROOM_TIME_LIMIT_KEY(roomId)
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