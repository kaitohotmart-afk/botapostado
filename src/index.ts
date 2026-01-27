import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import handler from '../api/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
// Discord sends payloads as JSON
app.use(bodyParser.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf;
    }
}));

// Route all requests to the Vercel handler
app.all('/api/interactions', (req, res) => {
    // Mock VercelRequest/Response if needed, but Express req/res are usually compatible enough
    // for simple handlers.
    // We might need to ensure req.body is what the handler expects.

    // The handler expects VercelRequest which extends IncomingMessage.
    // Express Request also extends IncomingMessage.

    return handler(req as any, res as any);
});

app.listen(PORT, () => {
    console.log(`Local server running at http://localhost:${PORT}`);
    console.log(`Interaction Endpoint: http://localhost:${PORT}/api/interactions`);
    console.log(`\nTo test with Discord, you need to expose this port to the internet (e.g., using ngrok)`);
    console.log(`and update the Interactions Endpoint URL in the Discord Developer Portal.`);
});
