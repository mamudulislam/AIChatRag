import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Queue } from 'bullmq';
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLLECTION_NAME = "pdf_chunks";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const qdrant = new QdrantClient({ url: QDRANT_URL });
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-3-small",
});
const chatModel = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
});

const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const queue = new Queue('file-processing-queue', {
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '.pdf');
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

const app = express();
const port = 9000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('AI Chat PDF Backend Running'));

app.post('/uploads/pdf', (req, res) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const job = await queue.add('process-pdf', { path: req.file.path });
      res.json({
        message: 'PDF uploaded successfully',
        jobId: job.id
      });
    } catch (queueErr) {
      console.error(queueErr);
      res.status(500).json({ error: 'Failed to enqueue PDF processing' });
    }
  });
});

app.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    // 1. Embed query
    const queryVector = await embeddings.embedQuery(message);

    // 2. Search Qdrant
    const searchResult = await qdrant.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: 5,
    });

    const context = searchResult.map(hit => hit.payload.text).join("\n\n");

    // 3. Generate response
    const response = await chatModel.invoke([
      ["system", "You are a helpful AI assistant. Use the following context from a PDF to answer the user's question. If the answer is not in the context, say you don't know based on the document.\n\nContext:\n" + context],
      ["human", message],
    ]);

    res.json({ reply: response.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process chat' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
