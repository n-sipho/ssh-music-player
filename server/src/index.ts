import Fastify from 'fastify';
import staticPlugin from '@fastify/static';
import { join } from 'path';
import { registerRoutes } from './routes/api.js';
import { scanSource } from './scanner/index.js';
import { discoveryManager } from './scanner/discovery.js';
import prisma from './db/index.js';

const PORT = 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = Fastify({
    logger: {
      transport: {
        target: 'pino-pretty',
      },
    },
  });

  try {
    if (process.env.NODE_ENV === 'production') {
      app.register(staticPlugin, {
        root: join(process.cwd(), '../client/dist'),
        prefix: '/',
      });
      app.setNotFoundHandler((req, reply) => {
        reply.sendFile('index.html');
      });
    }
    
    const artCacheDir = join(process.cwd(), './public/art');
    await import('fs/promises').then(fs => fs.mkdir(artCacheDir, { recursive: true }));
    app.register(staticPlugin, {
      root: artCacheDir,
      prefix: '/art',
      decorateReply: false,
    });

    await registerRoutes(app);
    await app.listen({ port: PORT, host: HOST });

    discoveryManager.start();

    app.log.info(`\n🎵 HomeMusic server running at http://${HOST}:${PORT}`);

    // --- Background Sync Engine ---
    const startBackgroundSync = async () => {
      console.log('--- Background Sync Started ---');
      try {
        const sources = await prisma.source.findMany({ where: { enabled: true } });
        for (const source of sources) {
          console.log(`Syncing: ${source.name}`);
          await scanSource(source as any);
        }
        console.log('--- Sync Completed ---');
      } catch (err) {
        console.error('Background sync failed:', err);
      }
    };

    // Run once on startup after 5 seconds
    setTimeout(startBackgroundSync, 5000);
    // setInterval(startBackgroundSync, 2 * 60 * 1000); // Removed: sync every 2 minutes

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

startServer();
