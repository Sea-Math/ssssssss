import express from "express";
import { createServer } from "node:http";
import { wisp } from "wisp-server-node"; // <-- Updated import here

const app = express();
const server = createServer(app);

// A simple status page to check if your server is awake
app.get("/", (req, res) => {
    res.send("🟢 Private Wisp Server is Online!");
});

// This intercepts WebSocket connections and routes them to Wisp
server.on("upgrade", (req, socket, head) => {
    if (req.url.endsWith("/wisp/")) {
        wisp.routeRequest(req, socket, head);
    } else {
        socket.end();
    }
});

// Set the port (cloud providers will provide process.env.PORT)
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Wisp server listening on port ${PORT}`);
});
