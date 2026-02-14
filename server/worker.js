import fs from "fs";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import 'dotenv/config';

const COLLECTION_NAME = "pdf_chunks";
const QDRANT_URL = process.env.QDRANT_URL;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) throw new Error("Please set GOOGLE_API_KEY environment variable.");

// Qdrant client
const qdrant = new QdrantClient({ url: QDRANT_URL });

// Ensure collection exists
async function ensureCollection(vectorSize) {
  const { collections } = await qdrant.getCollections();
  const exists = collections.some(c => c.name === COLLECTION_NAME);

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: { size: vectorSize, distance: "Cosine" },
    });
    console.log("Qdrant collection created:", COLLECTION_NAME);
  } else {
    console.log("Qdrant collection exists:", COLLECTION_NAME);
  }
}

// Load PDF and split into chunks
async function loadAndChunkPDF(filePath) {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
  const chunks = await splitter.splitDocuments(docs);

  console.log(`PDF '${path.basename(filePath)}' split into ${chunks.length} chunks`);
  return chunks;
}

// Generate embeddings using Google Generative AI
async function generateEmbeddings(chunks) {
 const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "textembedding-bison-001",
});


  const vectors = await Promise.all(
    chunks.map(c => embeddings.embedQuery(c.pageContent))
  );

  console.log("Embeddings generated for all chunks");
  return vectors;
}

// Store chunks + embeddings in Qdrant
async function storeInQdrant(chunks, vectors) {
  const points = chunks.map((chunk, i) => ({
    id: uuidv4(), // UUID ensures valid ID
    vector: vectors[i],
    payload: { text: chunk.pageContent, source: chunk.metadata?.source || null },
  }));

  await qdrant.upsert(COLLECTION_NAME, { points });
  console.log(`Stored ${points.length} points in Qdrant`);
}

// Process a single PDF
async function processPDF(filePath) {
  console.log("Processing PDF:", path.basename(filePath));

  const chunks = await loadAndChunkPDF(filePath);
  const vectors = await generateEmbeddings(chunks);

  await ensureCollection(vectors[0].length);
  await storeInQdrant(chunks, vectors);

  console.log("PDF processing complete:", path.basename(filePath));
}

// Process all PDFs in a folder
async function processFolder(folderPath) {
  if (!fs.existsSync(folderPath)) return console.error("Folder not found:", folderPath);

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".pdf"));
  if (files.length === 0) return console.log("No PDF files found in folder:", folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    await processPDF(filePath).catch(err => console.error("Error processing", file, err));
  }
}

// Run
(async () => {
  const uploadsFolder = "./uploads"; // folder with PDFs
  await processFolder(uploadsFolder);
})();
