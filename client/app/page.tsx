// app/page.tsx or pages/index.tsx depending on your Next.js setup
import React from 'react';
import PdfUpload from './components/PdfUpload';
import ChatInterface from './components/ChatInterface';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Chat with PDF',
  description: 'Chat with your PDF documents using AI.',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col items-center space-y-2 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            AI Chat with PDF
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl">
            Upload your documents and chat with them in real-time. Powered by LangChain, Qdrant, and OpenAI.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <h2 className="text-xl font-semibold px-2">Knowledge Base</h2>
            <PdfUpload />
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <p className="text-xs text-indigo-300 leading-relaxed font-medium">
                Tip: For best results, upload clean PDF text. Wait a few seconds for processing to finish before chatting.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <ChatInterface />
          </div>
        </div>
      </div>
    </main>
  );
}
