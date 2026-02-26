import { FastifyInstance } from 'fastify';
import { basename } from 'path';
import prisma from '../db/index.js';
import { getTracksWithInfo, searchTracks, getAlbums, getArtists } from '../db/index.js';
import { scanSource } from '../scanner/index.js';
import { discoveryManager } from '../scanner/discovery.js';
import { streamTrack } from '../stream/index.js';
import { SourceSchema, TrackSchema } from '../types/index.js';

export async function registerRoutes(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  });

  // ============ Sources ============
  
  app.get('/api/sources', async (req, reply) => {
    const sources = await prisma.source.findMany({
      orderBy: { name: 'asc' },
      include: { status: true }, // Include scan status
    });
    return sources.map(s => ({ ...s, password: undefined }));
  });

  app.post('/api/sources', async (req, reply) => {
    const parsed = SourceSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });
    
    // Filter out extra properties
    const { id, ...dbData } = parsed.data;
    
    const source = await prisma.source.create({ 
      data: { 
        ...dbData, 
        status: { create: {} } 
      } 
    });
    return { ...source, password: undefined };
  });

  // Update a source
  app.patch('/api/sources/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = SourceSchema.partial().safeParse(req.body);
    
    if (!parsed.success) {
      console.error('Source validation failed:', parsed.error.issues);
      return reply.code(400).send({ error: parsed.error.issues });
    }

    // Filter out properties that shouldn't be updated directly
    const { status, id: _id, ...dbData } = parsed.data as any;

    const source = await prisma.source.update({
      where: { id },
      data: dbData,
    });

    return { ...source, password: undefined };
  });

  app.delete('/api/sources/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.$transaction([
      prisma.sourceStatus.deleteMany({ where: { sourceId: id } }),
      prisma.track.deleteMany({ where: { sourceId: id } }),
      prisma.source.delete({ where: { id } }),
    ]);
    await prisma.album.deleteMany({ where: { tracks: { none: {} } } });
    await prisma.artist.deleteMany({ where: { tracks: { none: {} }, albums: { none: {} } } });
    return { success: true };
  });

  // --- Scan Endpoints ---
  app.post('/api/scan', async (req, reply) => {
    const sources = await prisma.source.findMany({ where: { enabled: true } });
    
    // Fire off scans for all sources in the background
    for (const source of sources) {
      // Don't start a new scan if one is already running
      const currentStatus = await prisma.sourceStatus.findUnique({ where: { sourceId: source.id } });
      if (currentStatus?.status !== 'scanning') {
        scanSource(source as any).catch(err => {
          console.error(`[FATAL] Scan failed for ${source.name}:`, err);
        });
      }
    }

    return { success: true, message: 'Scan started for all enabled sources' };
  });

  app.post('/api/sources/:id/scan', async (req, reply) => {
    const { id } = req.params as { id: string };
    const source = await prisma.source.findUnique({ where: { id } });
    if (!source) return reply.code(404).send({ error: 'Source not found' });

    // Don't start a new scan if one is already running
    const currentStatus = await prisma.sourceStatus.findUnique({ where: { sourceId: id } });
    if (currentStatus?.status === 'scanning') {
      return reply.send(currentStatus); // Return the existing status instead of an error
    }

    // Run scan in the background, don't await it
    scanSource(source as any).catch(err => {
      console.error(`[FATAL] Scan failed for ${source.name}:`, err);
    });

    const status = await prisma.sourceStatus.findUnique({ where: { sourceId: id } });
    return reply.send(status || { status: 'starting' });
  });

  // Test source connection
  app.post('/api/sources/:id/test', async (req, reply) => {
    const { id } = req.params as { id: string };
    
    const source = await prisma.source.findUnique({ where: { id } });
    if (!source) {
      return reply.code(404).send({ error: 'Source not found' });
    }

    let client: any;
    try {
      if (source.type === 'ssh') {
        const { getSSHClient } = await import('../sources/ssh.js');
        client = await getSSHClient(source as any);
      } else if (source.type === 'smb') {
        const { getSMBClient } = await import('../sources/smb.js');
        client = await getSMBClient(source as any);
      }
      return { success: true, message: 'Connection successful' };
    } catch (err: any) {
      return reply.code(200).send({ success: false, message: err.message });
    }
  });

  app.get('/api/sources/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const status = await prisma.sourceStatus.findUnique({ where: { sourceId: id } });
    if (!status) return reply.code(404).send({ error: 'Status not found' });
    return status;
  });

  app.get('/api/discover', async () => {
    return discoveryManager.getDiscoveredServices();
  });

  // ============ Tracks, Albums, etc. ============
  app.get('/api/tracks', async () => await getTracksWithInfo());
  app.get('/api/stream/:trackId', streamTrack as any);

  app.get('/api/albums', async () => (await getAlbums()).map(a => ({
    id: a.id, name: a.name, artist: a.artist?.name, year: a.year, trackCount: a._count.tracks,
  })));
  
  app.get('/api/folders', async () => {
    const folderGroups = await prisma.track.groupBy({
      by: ['folderPath'], where: { folderPath: { not: null } }, _count: { folderPath: true }, orderBy: { folderPath: 'asc' },
    });

    return Promise.all(folderGroups.map(async f => {
      const track = await prisma.track.findFirst({
        where: { folderPath: f.folderPath },
        select: { imageUrl: true, album: { select: { imageUrl: true } } },
      });
      return { 
        id: f.folderPath, 
        name: basename(f.folderPath!), 
        trackCount: f._count.folderPath,
        imageUrl: track?.imageUrl || track?.album?.imageUrl
      };
    }));
  });

  // Get tracks for a specific folder path
  app.get('/api/folders/tracks', async (req, reply) => {
    const { path } = req.query as { path: string };
    if (!path) return reply.code(400).send({ error: 'Path is required' });

    return prisma.track.findMany({
      where: { folderPath: path },
      include: { artist: true, album: true },
      orderBy: { trackNumber: 'asc' },
    });
  });

  app.get('/api/albums/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const album = await prisma.album.findUnique({ where: { id }, include: { artist: true, tracks: { orderBy: { trackNumber: 'asc' } } } });
    if (!album) return reply.code(404).send({ error: 'Album not found' });
    return album;
  });

  app.get('/api/artists', async () => await getArtists());

  app.get('/api/artists/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const artist = await prisma.artist.findUnique({
      where: { id },
      include: {
        albums: {
          include: {
            _count: { select: { tracks: true } }
          }
        },
        tracks: {
          include: { album: true, artist: true },
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { albums: true, tracks: true } }
      }
    });
    if (!artist) return reply.code(404).send({ error: 'Artist not found' });
    return {
      ...artist,
      albumCount: artist._count.albums,
      trackCount: artist._count.tracks,
      topTracks: artist.tracks
    };
  });

  // ============ Playlists ============
  app.get('/api/playlists', async () => {
    return prisma.playlist.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    }).then(pls => pls.map((p: any) => ({ id: p.id, name: p.name, trackCount: p._count.items })));
  });

  app.post('/api/playlists', async (req, reply) => {
    const { name } = req.body as { name: string };
    if (!name) return reply.code(400).send({ error: 'Name is required' });
    return prisma.playlist.create({ data: { name } });
  });

  app.get('/api/playlists/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const playlist = await prisma.playlist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            track: {
              include: { artist: true, album: true }
            }
          }
        }
      }
    });
    if (!playlist) return reply.code(404).send({ error: 'Playlist not found' });
    
    return {
      id: playlist.id,
      name: playlist.name,
      tracks: playlist.items.map((item: any) => ({
        ...item.track,
        position: item.position
      }))
    };
  });

  app.delete('/api/playlists/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.playlistItem.deleteMany({ where: { playlistId: id } });
    await prisma.playlist.delete({ where: { id } });
    return { success: true };
  });
}
