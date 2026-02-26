import { parseStream } from 'music-metadata';
import { join, dirname, basename } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db/index.js';
import { getSftpClient } from '../sources/ssh.js';
import { getSMBClient } from '../sources/smb.js';
import type { Source, ScanResult } from '../types/index.js';

const MUSIC_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aac'];

const ART_CACHE_DIR = join(process.cwd(), './public/art');
mkdir(ART_CACHE_DIR, { recursive: true });

function isMusicFile(filename: string): boolean {
  if (basename(filename).startsWith('._')) return false;
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return MUSIC_EXTENSIONS.includes(ext);
}

async function getClient(source: Source) {
  if (source.type === 'ssh') return getSftpClient(source);
  if (source.type === 'smb') return getSMBClient(source);
  throw new Error(`Unknown source type: ${source.type}`);
}

async function updateStatus(sourceId: string, data: any) {
  return prisma.sourceStatus.upsert({
    where: { sourceId },
    create: { sourceId, ...data },
    update: data,
  });
}

export async function scanSource(source: Source): Promise<ScanResult> {
  const result: ScanResult = { sourceId: source.id!, tracksFound: 0, errors: [] };
  const pathSeparator = source.type === 'smb' ? '\\' : '/';
  const rootPath = (source.basePath || '/').replace(/\/$/, '');
  let client;

  try {
    await updateStatus(source.id!, { status: 'scanning', progress: 0, lastError: null });
    client = await getClient(source);

    const allFiles = await scanDirectory(client, rootPath, pathSeparator);
    const musicFiles = allFiles.filter(f => isMusicFile(f.path));
    const total = musicFiles.length;

    if (total === 0) {
      await updateStatus(source.id!, { status: 'complete', progress: 100, totalFiles: 0, scannedFiles: 0, lastScan: new Date() });
      return result;
    }

    await updateStatus(source.id!, { totalFiles: total, scannedFiles: 0, progress: 5, status: 'scanning' });

    const existingTracks = await prisma.track.findMany({
      where: { sourceId: source.id! },
      select: { path: true }
    });
    const existingPaths = new Set(existingTracks.map(t => t.path));
    const foundPaths = new Set(musicFiles.map(f => f.path));

    const pathsToDelete = [...existingPaths].filter(path => !foundPaths.has(path));
    if (pathsToDelete.length > 0) {
      await prisma.track.deleteMany({
        where: { sourceId: source.id!, path: { in: pathsToDelete } }
      });
      await prisma.album.deleteMany({ where: { tracks: { none: {} } } });
      await prisma.artist.deleteMany({ where: { tracks: { none: {} }, albums: { none: {} } } });
    }

    let processed = 0;
    for (const file of musicFiles) {
      try {
        const metadata = await extractMetadata(client, file.path);
        const parentDir = basename(dirname(file.path));
        const dirPath = dirname(file.path);
        const folderPath = (dirPath !== rootPath) ? dirPath : null;

        const artist = metadata.artist ? await prisma.artist.upsert({ where: { name: metadata.artist }, update: {}, create: { name: metadata.artist } }) : null;
        let album = null;
        if (parentDir !== rootPath) {
          const effectiveArtistId = artist?.id;
          if (effectiveArtistId) {
            album = await prisma.album.upsert({
              where: { name_artistId: { name: parentDir, artistId: effectiveArtistId } },
              update: { imageUrl: metadata.imageUrl }, // Update album image if found
              create: { name: parentDir, artistId: effectiveArtistId, imageUrl: metadata.imageUrl },
            });
          } else {
             const unknownArtist = await prisma.artist.upsert({
               where: { name: 'Unknown Artist' }, update: {}, create: { name: 'Unknown Artist' }
             });
             album = await prisma.album.upsert({
               where: { name_artistId: { name: parentDir, artistId: unknownArtist.id } },
               update: { imageUrl: metadata.imageUrl },
               create: { name: parentDir, artistId: unknownArtist.id, imageUrl: metadata.imageUrl },
             });
          }
        }

        await prisma.track.upsert({
          where: { sourceId_path: { sourceId: source.id!, path: file.path } },
          update: { 
            title: metadata.title || basename(file.path), 
            artistId: artist?.id, 
            albumId: album?.id, 
            folderPath, 
            size: file.size,
            // Track may have its own image or fallback to album image
            imageUrl: metadata.imageUrl || album?.imageUrl 
          },
          create: {
            sourceId: source.id!, path: file.path, folderPath,
            title: metadata.title || basename(file.path), artistId: artist?.id, albumId: album?.id,
            duration: metadata.duration, trackNumber: metadata.trackNumber, size: file.size,
            imageUrl: metadata.imageUrl || album?.imageUrl
          },
        });
        result.tracksFound++;
      } catch (err: any) {
        result.errors.push(`Failed to process ${file.path}: ${err.message}`);
      } finally {
        processed++;
        if (processed % 10 === 0 || processed === total) {
          await updateStatus(source.id!, { scannedFiles: processed, progress: 5 + Math.round((processed / total) * 95) });
        }
      }
    }
    await updateStatus(source.id!, { status: 'complete', lastScan: new Date() });
    result.status = 'complete';
  } catch (err: any) {
    const message = err.message || 'Unknown error';
    result.errors.push(`Scan failed: ${message}`);
    result.status = 'error';
    await updateStatus(source.id!, { status: 'error', lastError: message });
  } finally {
    if (source.type === 'ssh' && client) client.end();
  }
  return result;
}

async function scanDirectory(client: any, path: string, separator: string): Promise<{path: string, size: number}[]> {
  let entries;
  try {
    entries = await new Promise<any[]>((resolve, reject) => {
      client.readdir(path, (err: Error | null, list: any[]) => err ? reject(err) : resolve(list));
    });
  } catch (e) { return []; }

  const files: {path: string, size: number}[] = [];
  for (const entry of entries) {
    const fullPath = [path, entry.filename].join(separator);
    if (entry.longname.startsWith('d')) {
      files.push(...await scanDirectory(client, fullPath, separator));
    } else {
      files.push({ path: fullPath, size: entry.attrs.size });
    }
  }
  return files;
}

async function extractMetadata(client: any, path: string) {
  try {
    const stream = client.createReadStream(path);
    const metadata = await parseStream(stream, { size: 16384 });
    
    let imageUrl = undefined;
    const picture = metadata.common.picture?.[0];
    if (picture) {
      const fileName = `${basename(path).replace(/\.[^/.]+$/, "")}_${uuidv4()}.jpg`;
      const artPath = join(ART_CACHE_DIR, fileName);
      await writeFile(artPath, picture.data);
      imageUrl = `/art/${fileName}`;
    }

    return {
      title: metadata.common.title,
      artist: metadata.common.artist,
      album: metadata.common.album,
      duration: metadata.format.duration ? Math.round(metadata.format.duration) : 0,
      trackNumber: metadata.common.track?.no,
      imageUrl
    };
  } catch (e) {
    return {
      title: basename(path).replace(/\.[^/.]+$/, ""),
      artist: 'Unknown Artist',
      album: undefined,
      duration: 0,
      trackNumber: undefined,
      imageUrl: undefined
    };
  }
}
