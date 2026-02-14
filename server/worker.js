import fs from "fs";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { Worker } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";

const COLLECTION_NAME = "pdf_chunks";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

const qdrant = new QdrantClient({ url: QDRANT_URL });
const embeddings = new OpenAIEmbeddings({
  apiKey: OPENAI_API_KEY,
  model: "text-embedding-3-small",
});

async function ensureCollection(vectorSize) {
  const { collections } = await qdrant.getCollections();
  const exists = collections.some(c => c.name === COLLECTION_NAME);
  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    });
    console.log("Qdrant collection created:", COLLECTION_NAME);
  }
}

async function loadAndChunkPDF(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`PDF not found: ${absolutePath}`);
  }
  const loader = new PDFLoader(absolutePath);
  const docs = await loader.load();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });
  return splitter.splitDocuments(docs);
}

async function processPDF(filePath) {
  console.log("Processing:", path.basename(filePath));

  const chunks = await loadAndChunkPDF(filePath);
  const vectors = await Promise.all(
    chunks.map(chunk => embeddings.embedQuery(chunk.pageContent))
  );

  await ensureCollection(vectors[0].length);

  const points = chunks.map((chunk, i) => ({
    id: uuidv4(),
    vector: vectors[i],
    payload: {
      text: chunk.pageContent,
      source: chunk.metadata?.source ?? null,
    },
  }));

  await qdrant.upsert(COLLECTION_NAME, { points });
  console.log(`Stored ${points.length} chunks for ${path.basename(filePath)}`);
}

const worker = new Worker('file-processing-queue', async job => {
  if (job.name === 'process-pdf') {
    await processPDF(job.data.path);
  }
}, {
  connection: {
    host: REDIS_HOST,
    port: REDIS_PORT
  }
});

worker.on('completed', job => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed: ${err.message}`);
});

console.log("Worker started...");
