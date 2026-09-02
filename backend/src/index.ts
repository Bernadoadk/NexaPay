import app from './app';
import { NotificationService } from './lib/notificationService';
import { createServer } from 'http';

const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = createServer(app);

// Initialize WebSocket server for notifications
NotificationService.initializeWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
