const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
dotenv.config();

const geminiRoutes = require('./routes/geminiRoutes');
const userRoutes = require('./routes/user');
const roomRoutes = require('./routes/roomRoutes');
const leetcodeRoute = require('./routes/leetcodeRoute')
const { setupRoomSocket } = require('./sockets/roomSocket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(req.method, req.path);
  next();
});

app.use('/api/user', userRoutes);
app.use('/answerq', geminiRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/leetcode', leetcodeRoute);

setupRoomSocket(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
