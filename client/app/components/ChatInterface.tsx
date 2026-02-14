"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Bot } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const currentInput = input;
        const userMsg: Message = { role: 'user', content: currentInput };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const response = await fetch('http://localhost:9000/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: currentInput }),
            });

            const data = await response.json() as { reply?: string; error?: string };
            if (data.reply) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.reply as string }]);
            } else {
                setMessages(prev => [...prev, { role: 'assistant', content: "Error: " + (data.error || "Unknown error") }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Failed to connect to the server." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-white/10 bg-white/5">
                <h2 className="text-lg font-semibold text-white/90">Chat with PDF</h2>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-white/40 space-y-2">
                        <Bot className="w-12 h-12 opacity-20" />
                        <p>Upload a PDF and ask questions!</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-zinc-700'}`}>
                                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                            </div>
                            <div className={`p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-zinc-800 text-white/90 rounded-tl-none'}`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="flex gap-3 bg-zinc-800 p-3 rounded-2xl rounded-tl-none animate-pulse">
                            <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
                            <span className="text-sm text-white/60 font-medium">Thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 bg-white/5 border-t border-white/10">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything about the PDF..."
                        className="flex-1 bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || loading}
                        className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>

    );
}
