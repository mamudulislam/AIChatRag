'use client'
import * as React from 'react'
import { Upload } from 'lucide-react'

const FileComponent: React.FC = () => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handeluploadbuttunsclick = () => {
    fileInputRef.current?.click()
  }

  const handlePdfChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      alert('Only PDF files are allowed')
      return
    }

    const formData = new FormData()
    formData.append('pdf', file) // must match upload.single('pdf')

    try {
      setLoading(true)

      const res = await fetch('http://localhost:9000/uploads/pdf', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error('Upload failed')
      }

      const data = await res.json()
      console.log('Upload success:', data)
    } catch (err) {
      console.error(err)
      alert('Failed to upload PDF')
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  return (
    <>
      <div
        onClick={handeluploadbuttunsclick}
        className="w-full max-w-sm mx-auto
                   bg-slate-900 text-white
                   border border-slate-700 rounded-xl shadow-2xl
                   flex flex-col justify-center items-center gap-2
                   cursor-pointer hover:bg-slate-800 transition"
      >
        <Upload className="w-8 h-8 text-slate-300" />
        <span className="text-sm text-slate-300">
          {loading ? 'Uploading…' : 'Click to upload file'}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handlePdfChange}
      />
    </>
  )
}

export default FileComponent
