import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import fs from "fs";
import path from "path";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

import { QdrantClient } from "@qdrant/js-client-rest";

/* ---------------- CONFIG ---------------- */

const queueName = "file-processing-queue";

// Redis (required by BullMQ)
const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
});

// Qdrant
const qdrant = new QdrantClient({
  url: "http://localhost:6333",
});

const COLLECTION_NAME = "pdf_chunks";
const VECTOR_SIZE = 768; // Gemini embedding size

/* ---------------- HELPERS ---------------- */

async function ensureCollection() {
  const { collections } = await qdrant.getCollections();

  const exists = collections.some(
    (c) => c.name === COLLECTION_NAME
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });
    console.log("Qdrant collection created:", COLLECTION_NAME);
  }
}

async function loadAndChunkPDF(filePath) {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  return splitter.splitDocuments(docs);
}

async function generateEmbeddings(chunks) {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "text-embedding-004",
  });

  return Promise.all(
    chunks.map((c) => embeddings.embedQuery(c.pageContent))
  );
}

async function storeInQdrant(chunks, vectors) {
  const points = chunks.map((chunk, i) => ({
    id: `${Date.now()}-${i}`,
    vector: vectors[i],
    payload: {
      text: chunk.pageContent,
      source: chunk.metadata?.source,
    },
  }));

  await qdrant.upsert(COLLECTION_NAME, {
    points,
  });
}

/* ---------------- WORKER ---------------- */

const worker = new Worker(
  queueName,
  async (job) => {
    const filePath = job.data.path;

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log("Processing:", path.basename(filePath));

    await ensureCollection();

    const chunks = await loadAndChunkPDF(filePath);
    console.log("Chunks:", chunks.length);

    const vectors = await generateEmbeddings(chunks);
    console.log("Embeddings generated");

    await storeInQdrant(chunks, vectors);
    console.log("Stored in Qdrant");

    return {
      status: "success",
      chunks: chunks.length,
    };
  },
  { connection }
);

worker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed`, result);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed`, err);
});

console.log("Worker listening on:", queueName);

/* ---------------- PRODUCER (OPTIONAL) ---------------- */

export async function addPDFToQueue(filePath) {
  const queue = new Queue(queueName, { connection });

  await queue.add("process-pdf", {
    path: filePath,
  });

  console.log("Added to queue:", filePath);
}
