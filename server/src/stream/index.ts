import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../db/index.js';
import { getSSHClient } from '../sources/ssh.js';
import { getSMBClient } from '../sources/smb.js';

export interface StreamRequest {
  Params: { trackId: string };
  Headers: {
    range?: string;
  };
}

export async function streamTrack(
  request: FastifyRequest<StreamRequest>,
  reply: FastifyReply
) {
  const { trackId } = request.params;
  const range = request.headers.range;

  // Get track info from database
  const track = await prisma.track.findUnique({
    where: { id: trackId },
    include: { source: true },
  });

  if (!track) {
    return reply.code(404).send({ error: 'Track not found' });
  }

  if (!track.source.enabled) {
    return reply.code(503).send({ error: 'Source is disabled' });
  }

  try {
    let client: any;
    
    if (track.source.type === 'ssh') {
      client = await getSSHClient(track.source as any);
    } else if (track.source.type === 'smb') {
      client = await getSMBClient(track.source as any);
    } else {
      return reply.code(501).send({ error: `Unsupported source type: ${track.source.type}` });
    }

    // Get file stats
    const stat = await client.stat(track.path);
    const fileSize = stat.size;

    // Determine content type
    const contentTypes: Record<string, string> = {
      mp3: 'audio/mpeg',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
      wav: 'audio/wav',
      aac: 'audio/aac',
      wma: 'audio/x-ms-wma',
    };
    const ext = track.path.toLowerCase().split('.').pop() || 'mp3';
    const contentType = contentTypes[ext] || 'audio/mpeg';

    // Handle range requests for seeking
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Get partial file stream
      const stream = await client.readFileRange(track.path, start, end);

      reply.code(206);
      reply.header('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      reply.header('Accept-Ranges', 'bytes');
      reply.header('Content-Length', chunkSize);
      reply.header('Content-Type', contentType);

      return reply.send(stream);
    } else {
      // Full file stream
      const stream = await client.readFile(track.path);

      reply.header('Content-Length', fileSize);
      reply.header('Content-Type', contentType);
      reply.header('Accept-Ranges', 'bytes');

      return reply.send(stream);
    }
  } catch (err: any) {
    console.error('Stream error:', err);
    return reply.code(500).send({ error: 'Failed to stream track', details: err.message });
  }
}

// Get stream URL for a track
export function getStreamUrl(trackId: string, host: string): string {
  return `http://${host}/api/stream/${trackId}`;
}