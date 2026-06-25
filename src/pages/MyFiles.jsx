import { useState, useEffect, useRef } from 'react'
import { supabase, STORAGE_BUCKET_FILES } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './MyFiles.css'

const MAX_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB per file
// Bounded so a single user can't exhaust the shared free-tier storage and the
// unpaginated file list stays light. See supabase/migrations for the DB-level guard.
const MAX_FILES_PER_USER = 30
const ALLOWED_EXTENSIONS = [
  '.doc', '.docx',
  '.pdf',
  '.xls', '.xlsx',
  '.ppt', '.pptx',
  '.zip',
]
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
]

function getExtension(name) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

function isAllowedFile(file) {
  const ext = getExtension(file.name)
  if (!ALLOWED_EXTENSIONS.includes(ext)) return false
  if (file.size > MAX_SIZE_BYTES) return false
  if (ALLOWED_MIME_TYPES.length && file.type && !ALLOWED_MIME_TYPES.includes(file.type)) return false
  return true
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ'
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
}

function fileIcon(mimeType, fileName) {
  const ext = getExtension(fileName)
  if (ext === '.pdf') return '📄'
  if (['.doc', '.docx'].includes(ext)) return '📝'
  if (['.xls', '.xlsx'].includes(ext)) return '📊'
  if (['.ppt', '.pptx'].includes(ext)) return '📽️'
  if (ext === '.zip') return '📦'
  return '📎'
}

export default function MyFiles() {
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setFiles(data || [])
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setLoading(false)
    }
  }

  const uploadFile = async (file) => {
    if (files.length >= MAX_FILES_PER_USER) {
      setUploadError(`Достигнут лимит: не более ${MAX_FILES_PER_USER} файлов. Удалите ненужные, чтобы загрузить новые.`)
      return
    }
    if (!isAllowedFile(file)) {
      setUploadError(
        'Можно загружать только Word, PDF, Excel, PowerPoint или ZIP до 100 МБ.'
      )
      return
    }
    setUploadError('')
    setUploading(true)

    const fileExt = getExtension(file.name)
    const storagePath = `${user.id}/${crypto.randomUUID()}${fileExt}`

    try {
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET_FILES)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('user_files').insert({
        user_id: user.id,
        file_name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        mime_type: file.type || null,
      })

      if (insertError) {
        await supabase.storage.from(STORAGE_BUCKET_FILES).remove([storagePath])
        throw insertError
      }

      await loadFiles()
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError(error.message || 'Ошибка загрузки')
    } finally {
      setUploading(false)
    }
  }

  const enqueueUploads = (fileList) => {
    setUploadError('')
    const remaining = MAX_FILES_PER_USER - files.length
    if (remaining <= 0) {
      setUploadError(`Достигнут лимит: не более ${MAX_FILES_PER_USER} файлов. Удалите ненужные, чтобы загрузить новые.`)
      return
    }
    const list = Array.from(fileList)
    if (list.length > remaining) {
      setUploadError(`Можно загрузить ещё ${remaining}: лимит ${MAX_FILES_PER_USER} файлов, лишние пропущены.`)
    }
    list.slice(0, remaining).forEach((f) => uploadFile(f))
  }

  const handleInputChange = (e) => {
    if (e.target.files?.length) enqueueUploads(e.target.files)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) enqueueUploads(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const downloadFile = async (fileRecord) => {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET_FILES)
        .createSignedUrl(fileRecord.storage_path, 60)

      if (error) throw error
      if (data?.signedUrl) {
        const a = document.createElement('a')
        a.href = data.signedUrl
        a.download = fileRecord.file_name
        a.rel = 'noopener noreferrer'
        a.target = '_blank'
        a.click()
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('Не удалось скачать файл: ' + (error.message || 'ошибка'))
    }
  }

  const deleteFile = async (fileRecord) => {
    if (!confirm('Удалить файл «' + fileRecord.file_name + '»?')) return
    try {
      const { error: delStorage } = await supabase.storage
        .from(STORAGE_BUCKET_FILES)
        .remove([fileRecord.storage_path])

      if (delStorage) throw delStorage

      const { error: delRow } = await supabase
        .from('user_files')
        .delete()
        .eq('id', fileRecord.id)

      if (delRow) throw delRow
      await loadFiles()
    } catch (error) {
      console.error('Delete error:', error)
      alert('Не удалось удалить файл: ' + (error.message || 'ошибка'))
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="my-files-container">
        <div className="loading">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="my-files-container">
      <div className="my-files-content">
        <div className="page-header">
          <h1>Мои файлы</h1>
          <p className="page-description">
            Хранилище только для вас. Word, PDF, Excel, PowerPoint, ZIP — до 100 МБ. Никто кроме вас эти файлы не видит.
          </p>
        </div>

        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip"
            onChange={handleInputChange}
            className="upload-input"
          />
          <div className="upload-zone-icon">📁</div>
          <p className="upload-zone-text">
            {uploading ? 'Загрузка...' : 'Перетащите файлы сюда или нажмите для выбора'}
          </p>
          <p className="upload-zone-hint">DOC, DOCX, PDF, XLS, XLSX, PPT, PPTX, ZIP — до 100 МБ · {files.length}/{MAX_FILES_PER_USER}</p>
          {uploadError && <p className="upload-zone-error">{uploadError}</p>}
        </div>

        {files.length === 0 ? (
          <div className="no-files-card">
            <div className="no-files-icon">📂</div>
            <h2>Файлов пока нет</h2>
            <p>Загрузите документы или архивы — они будут доступны только вам.</p>
          </div>
        ) : (
          <div className="files-list">
            {files.map((fileRecord) => (
              <div key={fileRecord.id} className="file-card">
                <div className="file-icon">{fileIcon(fileRecord.mime_type, fileRecord.file_name)}</div>
                <div className="file-info">
                  <div className="file-name" title={fileRecord.file_name}>
                    {fileRecord.file_name}
                  </div>
                  <div className="file-meta">
                    {formatSize(fileRecord.file_size)} · {formatDate(fileRecord.created_at)}
                  </div>
                </div>
                <div className="file-actions">
                  <button
                    type="button"
                    className="btn-download"
                    onClick={() => downloadFile(fileRecord)}
                    title="Скачать"
                  >
                    ⬇️ Скачать
                  </button>
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() => deleteFile(fileRecord)}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
