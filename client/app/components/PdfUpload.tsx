"use client";

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, Loader2 } from 'lucide-react';

export default function PdfUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setFile(files[0]);
            setStatus('idle');
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setStatus('idle');

        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const response = await fetch('http://localhost:9000/uploads/pdf', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                setStatus('success');
            } else {
                const errorData = await response.json() as { error?: string };
                console.error('Upload failed:', errorData.error);
                setStatus('error');
            }
        } catch (err) {
            console.error('Upload error:', err);
            setStatus('error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
            <div className="flex flex-col items-center gap-4">
                <label className="w-full h-32 flex flex-col items-center justify-center border-2 border-dashed border-white/30 rounded-xl cursor-pointer hover:border-white/50 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 text-white/60 group-hover:text-white transition-colors" />
                        <p className="mb-2 text-sm text-white/80">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-white/40">PDF only (max. 10MB)</p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                </label>

                {file && (
                    <div className="flex items-center gap-2 text-sm text-white/80 w-full px-2">
                        <FileText className="w-4 h-4" />
                        <span className="truncate">{file.name}</span>
                    </div>
                )}

                <button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-50 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Upload PDF'}
                </button>

                {status === 'success' && (
                    <div className="flex items-center gap-2 text-green-400 text-sm animate-in fade-in slide-in-from-top-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>PDF uploaded and processing started!</span>
                    </div>
                )}
                {status === 'error' && (
                    <p className="text-red-400 text-sm">Failed to upload PDF</p>
                )}
            </div>
        </div>
    );
}
