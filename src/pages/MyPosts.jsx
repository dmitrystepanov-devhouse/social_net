import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './MyPosts.css'

export default function MyPosts() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingPost, setEditingPost] = useState(null)
  const [editContent, setEditContent] = useState('')
  const { user, profile } = useAuth()

  useEffect(() => {
    loadMyPosts()
  }, [])

  const loadMyPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          likes (id),
          comments (
            id,
            content,
            created_at,
            profiles:user_id (username, full_name)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPosts(data || [])
    } catch (error) {
      console.error('Error loading posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (post) => {
    setEditingPost(post.id)
    setEditContent(post.content)
  }

  const cancelEdit = () => {
    setEditingPost(null)
    setEditContent('')
  }

  const saveEdit = async (postId) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editContent, updated_at: new Date().toISOString() })
        .eq('id', postId)

      if (error) throw error

      setEditingPost(null)
      setEditContent('')
      await loadMyPosts()
    } catch (error) {
      console.error('Error updating post:', error)
    }
  }

  const deletePost = async (postId) => {
    if (!confirm('Вы уверены, что хотите удалить этот пост?')) return

    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId)
      if (error) throw error
      await loadMyPosts()
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="my-posts-container">
        <div className="loading">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="my-posts-container">
      <div className="my-posts-content">
        <div className="page-header">
          <h1>Мои посты</h1>
          <div className="stats">
            <div className="stat-item">
              <div className="stat-number">{posts.length}</div>
              <div className="stat-label">Постов</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">
                {posts.reduce((sum, post) => sum + post.likes.length, 0)}
              </div>
              <div className="stat-label">Лайков</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">
                {posts.reduce((sum, post) => sum + post.comments.length, 0)}
              </div>
              <div className="stat-label">Комментариев</div>
            </div>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="no-posts-card">
            <div className="no-posts-icon">📝</div>
            <h2>У вас пока нет постов</h2>
            <p>Начните делиться своими мыслями с друзьями!</p>
          </div>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <div key={post.id} className="my-post-card">
                <div className="post-header">
                  <div className="post-date">
                    {formatDate(post.created_at)}
                    {post.updated_at !== post.created_at && (
                      <span className="edited-badge"> (изменено)</span>
                    )}
                  </div>
                  <div className="post-actions">
                    {editingPost !== post.id && (
                      <>
                        <button
                          className="edit-btn"
                          onClick={() => startEdit(post)}
                        >
                          ✏️ Редактировать
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => deletePost(post.id)}
                        >
                          🗑️ Удалить
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="post-body">
                  {editingPost === post.id ? (
                    <div className="edit-form">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows="4"
                      />
                      <div className="edit-actions">
                        <button
                          className="save-btn"
                          onClick={() => saveEdit(post.id)}
                        >
                          Сохранить
                        </button>
                        <button className="cancel-btn" onClick={cancelEdit}>
                          Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="post-content">{post.content}</div>
                  )}
                </div>

                <div className="post-footer">
                  <div className="post-stat">
                    ❤️ {post.likes.length} {post.likes.length === 1 ? 'лайк' : 'лайков'}
                  </div>
                  <div className="post-stat">
                    💬 {post.comments.length}{' '}
                    {post.comments.length === 1 ? 'комментарий' : 'комментариев'}
                  </div>
                </div>

                {post.comments.length > 0 && (
                  <div className="comments-preview">
                    <div className="comments-header">Последние комментарии:</div>
                    {post.comments.slice(0, 3).map((comment) => (
                      <div key={comment.id} className="comment-preview">
                        <strong>{comment.profiles.full_name}</strong>:{' '}
                        {comment.content}
                      </div>
                    ))}
                    {post.comments.length > 3 && (
                      <div className="more-comments">
                        + еще {post.comments.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
