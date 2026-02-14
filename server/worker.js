import fs from "fs";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";


const COLLECTION_NAME = "pdf_chunks";
const QDRANT_URL = process.env.QDRANT_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
if (!QDRANT_URL) throw new Error("QDRANT_URL missing");
const qdrant = new QdrantClient({ url: QDRANT_URL });
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
    chunkSize: 500,
    chunkOverlap: 50,
  });
  return splitter.splitDocuments(docs);
}
const embeddings = new OpenAIEmbeddings({
  apiKey: OPENAI_API_KEY,
  model: "text-embedding-3-small",
});

async function generateEmbeddings(chunks) {
  return Promise.all(
    chunks.map(chunk => embeddings.embedQuery(chunk.pageContent))
  );
}
async function storeInQdrant(chunks, vectors) {
  const points = chunks.map((chunk, i) => ({
    id: uuidv4(),
    vector: vectors[i],
    payload: {
      text: chunk.pageContent,
      source: chunk.metadata?.source ?? null,
    },
  }));

  await qdrant.upsert(COLLECTION_NAME, { points });
  console.log(`Stored ${points.length} chunks`);
}
async function processPDF(filePath) {
  console.log("Processing:", path.basename(filePath));

  const chunks = await loadAndChunkPDF(filePath);
  const vectors = await generateEmbeddings(chunks);

  await ensureCollection(vectors[0].length);
  await storeInQdrant(chunks, vectors);

  console.log("Done:", path.basename(filePath));
}

async function processFolder(folderPath) {
  const absoluteFolder = path.resolve(folderPath);

  if (!fs.existsSync(absoluteFolder)) {
    throw new Error(`Folder not found: ${absoluteFolder}`);
  }

  const files = fs.readdirSync(absoluteFolder).filter(f =>
    f.toLowerCase().endsWith(".pdf")
  );

  if (!files.length) {
    console.log("No PDFs found");
    return;
  }

  for (const file of files) {
    try {
      await processPDF(path.join(absoluteFolder, file));
    } catch (err) {
      console.error("Failed:", file, err.message);
    }
  }
}
(async () => {
  await processFolder("./uploads");
})();