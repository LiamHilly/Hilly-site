const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const scdl = require('soundcloud-downloader').default;
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors({
  origin: 'https://hilly-site-2.onrender.com', // your frontend
}));
app.use(bodyParser.json());

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_\-()\[\] ]/gi, '_');
}

app.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).send('No URL provided');
  try {
    const clientID = await scdl.getClientID();
    const playlist = await scdl.getSetInfo(playlistURL, clientID);
    const tracks = playlist.tracks;

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    for (const track of tracks) {
      const safeTitle = sanitizeFilename(track.title);
      const filePath = path.join(tempDir, `${safeTitle}.mp3`);

      const stream = await scdl.downloadFormat(track.permalink_url, scdl.FORMATS.MP3, clientID);

      if (!stream) {
        console.log(`Failed to download: ${track.title}`);
        continue;
      }

      const writeStream = fs.createWriteStream(filePath);
      stream.pipe(writeStream);
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }

    const zipPath = path.join(__dirname, 'playlist.zip');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipPath, 'playlist.zip', err => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
      });
    });

    archive.pipe(output);
    archive.directory(tempDir, false);
    archive.finalize();

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('Download failed.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
