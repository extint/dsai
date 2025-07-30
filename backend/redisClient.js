const { createClient } = require('redis');

const client = createClient({
    username: 'default',
    password: 'eOT1tt2frrzwQ2fHcn4gS9x5bnxegy9z',
    socket: {
        host: 'redis-18736.c228.us-central1-1.gce.redns.redis-cloud.com',
        port: 18736
    }
});

async function connectRedis() {
    try {
        // Set up event listeners BEFORE connecting
        client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });
        
        client.on('connect', () => {
            console.log('Connected to Redis Cloud');
        });
        
        client.on('ready', () => {
            console.log('Redis client ready to use');
        });
        
        client.on('end', () => {
            console.log('Redis connection ended');
        });
        
        // Actually connect to Redis
        await client.connect();
        console.log('Redis connection established');
        
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
        throw error;
    }
}

// Connect immediately
connectRedis().catch(console.error);

module.exports = client;