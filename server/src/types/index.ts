import { z } from 'zod';

// Connection source types
export const SourceTypeSchema = z.enum(['ssh', 'smb']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: SourceTypeSchema,
  host: z.string().min(1),
  port: z.preprocess((val) => (val === '' || val === null ? undefined : Number(val)), z.number().nullish()),
  username: z.string().nullish(),
  password: z.string().nullish(),
  share: z.string().nullish(), // SMB only
  basePath: z.string().default('/'),
  enabled: z.boolean().default(true),
});

export type Source = z.infer<typeof SourceSchema>;

export const TrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string().optional(),
  artistId: z.string().optional(),
  album: z.string().optional(),
  albumId: z.string().optional(),
  trackNumber: z.number().optional(),
  duration: z.number().optional(),
  path: z.string(),
  sourceId: z.string(),
  size: z.number().optional(),
  format: z.string().optional(),
  bitrate: z.number().optional(),
  sampleRate: z.number().optional(),
  imageUrl: z.string().optional(),
});

export type Track = z.infer<typeof TrackSchema>;

// Queue types
export const QueueItemSchema = z.object({
  trackId: z.string(),
  position: z.number(),
});

export type QueueItem = z.infer<typeof QueueItemSchema>;

// Scan result
export const ScanResultSchema = z.object({
  sourceId: z.string(),
  tracksFound: z.number(),
  errors: z.array(z.string()),
  status: z.enum(['complete', 'error']).optional(),
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

// Stream info
export const StreamInfoSchema = z.object({
  url: z.string(),
  format: z.string(),
  bitrate: z.number().optional(),
  duration: z.number().optional(),
});

export type StreamInfo = z.infer<typeof StreamInfoSchema>;