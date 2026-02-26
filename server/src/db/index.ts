import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;

// Helper functions for common queries
export async function getTracksWithInfo() {
  return prisma.track.findMany({
    include: {
      artist: true,
      album: true,
      source: true,
    },
    orderBy: [
      { artist: { name: 'asc' } },
      { album: { name: 'asc' } },
      { trackNumber: 'asc' },
    ],
  });
}

export async function searchTracks(query: string) {
  return prisma.track.findMany({
    where: {
      OR: [
        { title: { contains: query } },
        { artist: { name: { contains: query } } },
        { album: { name: { contains: query } } },
      ],
    },
    include: {
      artist: true,
      album: true,
    },
  });
}

export async function getAlbums() {
  return prisma.album.findMany({
    include: {
      artist: true,
      _count: { select: { tracks: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getArtists() {
  return prisma.artist.findMany({
    include: {
      _count: { select: { albums: true, tracks: true } },
    },
    orderBy: { name: 'asc' },
  });
}