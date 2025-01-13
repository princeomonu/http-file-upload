const { spawn } = require('child_process');
const path = require('path');

// Start the server using ts-node
const server = spawn('npx', ['ts-node', path.join(__dirname, 'src', 'server.ts')], {
    stdio: 'inherit'
});

// Handle server process events
server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

server.on('close', (code) => {
    if (code !== 0) {
        console.error(`Server process exited with code ${code}`);
        process.exit(code);
    }
});

// Handle process termination
process.on('SIGTERM', () => {
    server.kill();
    process.exit(0);
});

process.on('SIGINT', () => {
    server.kill();
    process.exit(0);
});