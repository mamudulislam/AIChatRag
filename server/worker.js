import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import path from "path";
import fs from "fs";
import { PDFLoader } from "langchain/document_loaders";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings"; // replace with Gemini embeddings
import { QdrantClient } from "@qdrant/js-client-rest";

// ----------------- Configuration -----------------
const queueName = "file-processing-queue";

// Redis connection
const connection = new IORedis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null,
});

// Qdrant client
const qdrant = new QdrantClient({ url: "http://localhost:6333" });
const COLLECTION_NAME = "pdf_chunks";

// ----------------- Helper functions -----------------

// Ensure Qdrant collection exists
async function ensureCollection() {
  const collections = await qdrant.collections.list();
  if (!collections.some(c => c.name === COLLECTION_NAME)) {
    await qdrant.collections.create({
      name: COLLECTION_NAME,
      vectors: { size: 1536, distance: "Cosine" }, // adjust vector size to your embedding model
    });
    console.log(`Created Qdrant collection: ${COLLECTION_NAME}`);
  }
}

// Load and chunk PDF
async function loadAndChunkPDF(filePath) {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  const chunks = await splitter.splitDocuments(docs);
  return chunks;
}

// Generate embeddings
async function getEmbeddings(chunks) {
  const embeddingModel = new OpenAIEmbeddings(); // replace with Gemini embeddings
  const embeddings = await Promise.all(
    chunks.map(chunk => embeddingModel.embedQuery(chunk.pageContent))
  );
  return embeddings;
}

// Store chunks in Qdrant
async function storeInQdrant(chunks, embeddings) {
  const points = chunks.map((chunk, i) => ({
    id: `${Date.now()}-${i}`,
    vector: embeddings[i],
    payload: { text: chunk.pageContent },
  }));

  await qdrant.points.upsert({
    collection_name: COLLECTION_NAME,
    points,
  });
}

// ----------------- Worker -----------------
const worker = new Worker(
  queueName,
  async job => {
    const filePath = job.data.path;
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

    console.log(`Processing PDF: ${path.basename(filePath)}`);

    await ensureCollection();

    const chunks = await loadAndChunkPDF(filePath);
    console.log(`PDF split into ${chunks.length} chunks.`);

    const embeddings = await getEmbeddings(chunks);
    console.log(`Generated embeddings for all chunks.`);

    await storeInQdrant(chunks, embeddings);
    console.log(`Stored chunks in Qdrant collection: ${COLLECTION_NAME}`);

    return { message: "PDF processed successfully", chunks: chunks.length };
  },
  { connection }
);
worker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed. Result:`, result);
});
worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed. Error:`, err.message);
});
console.log(`Worker listening on queue: ${queueName}`);
async function addPDFToQueue(filePath) {
  const queue = new Queue(queueName, { connection });
  await queue.add("process-pdf", { path: filePath });
  console.log(`Added PDF to queue: ${filePath}`);
}