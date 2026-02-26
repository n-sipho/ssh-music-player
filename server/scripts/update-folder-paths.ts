import { PrismaClient } from '@prisma/client';
import { dirname, basename } from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating folderPath for existing tracks...');
  
  const tracks = await prisma.track.findMany({
    where: { folderPath: null },
    include: { source: true },
  });
  
  console.log(`Found ${tracks.length} tracks without folderPath`);
  
  const basePath = '/home/thabiso/Music'; // This should match your source base path
  const rootPath = basePath.replace(/\/$/, '');
  
  let updated = 0;
  for (const track of tracks) {
    const dirPath = dirname(track.path).replace(/\/$/, '');
    
    // Only set folderPath if it's not in the root directory
    if (dirPath !== rootPath) {
      await prisma.track.update({
        where: { id: track.id },
        data: { folderPath: dirPath },
      });
      updated++;
    }
  }
  
  console.log(`Updated ${updated} tracks with folderPath`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
