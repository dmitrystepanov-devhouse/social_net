import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Feed.css'

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [newPost, setNewPost] = useState('')
  const [loading, setLoading] = useState(true)
  const [commentTexts, setCommentTexts] = useState({})
  const [showComments, setShowComments] = useState({})
  const { user, profile } = useAuth()

  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    try {
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (username, full_name, avatar_url),
          likes (id, user_id),
          comments (
            id,
            content,
            created_at,
            profiles:user_id (username, full_name, avatar_url)
          )
        `)
        .order('created_at', { ascending: false })

      if (postsError) throw postsError

      setPosts(postsData || [])
    } catch (error) {
      console.error('Error loading posts:', error)
    } finally {
      setLoading(false)
    }
  }

  const createPost = async (e) => {
    e.preventDefault()
    if (!newPost.trim()) return

    try {
      const { error } = await supabase
        .from('posts')
        .insert([{ user_id: user.id, content: newPost }])

      if (error) throw error

      setNewPost('')
      await loadPosts()
    } catch (error) {
      console.error('Error creating post:', error)
    }
  }

  const toggleLike = async (postId) => {
    try {
      const post = posts.find((p) => p.id === postId)
      const userLike = post.likes.find((like) => like.user_id === user.id)

      if (userLike) {
        await supabase.from('likes').delete().eq('id', userLike.id)
      } else {
        await supabase.from('likes').insert([{ post_id: postId, user_id: user.id }])
      }

      await loadPosts()
    } catch (error) {
      console.error('Error toggling like:', error)
    }
  }

  const addComment = async (postId) => {
    const commentText = commentTexts[postId]
    if (!commentText?.trim()) return

    try {
      const { error } = await supabase
        .from('comments')
        .insert([{ post_id: postId, user_id: user.id, content: commentText }])

      if (error) throw error

      setCommentTexts({ ...commentTexts, [postId]: '' })
      await loadPosts()
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const deleteComment = async (commentId) => {
    try {
      const { error } = await supabase.from('comments').delete().eq('id', commentId)
      if (error) throw error
      await loadPosts()
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }

  const deletePost = async (postId) => {
    try {
      const { error } = await supabase.from('posts').delete().eq('id', postId)
      if (error) throw error
      await loadPosts()
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  if (loading) {
    return (
      <div className="feed-container feed-loading">
        <div className="loading">Загрузка...</div>
      </div>
    )
  }

  const tips = [
    'Делитесь мыслями — друзья это ценят.',
    'Добавьте фото или ссылку в следующий пост.',
    'Отвечайте на комментарии — так интереснее.',
    'Загляните в «Друзья» и найдите новых людей.',
  ]
  const randomTip = tips[Math.floor(Math.random() * tips.length)]

  return (
    <div className="feed-container">
      <aside className="feed-sidebar feed-sidebar-left">
        <div className="sidebar-card user-card-mini">
          <Link to="/profile" className="user-card-mini-link">
            <div className="user-card-mini-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <span>{profile?.full_name?.charAt(0) || '?'}</span>
              )}
            </div>
            <div className="user-card-mini-info">
              <strong>{profile?.full_name}</strong>
              <span>@{profile?.username}</span>
            </div>
          </Link>
          <Link to="/profile" className="user-card-mini-btn">Профиль →</Link>
        </div>
        <div className="sidebar-card tip-card">
          <div className="tip-card-icon">💡</div>
          <h3>Подсказка</h3>
          <p>{randomTip}</p>
        </div>
        <div className="sidebar-card quick-links">
          <h3>Разделы</h3>
          <Link to="/friends" className="quick-link">👥 Друзья</Link>
          <Link to="/my-posts" className="quick-link">📝 Мои посты</Link>
          <Link to="/profile" className="quick-link">👤 Профиль</Link>
        </div>
      </aside>

      <div className="feed-content">
        <div className="create-post-card">
          <h2>Создать пост</h2>
          <form onSubmit={createPost}>
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Что у вас нового?"
              rows="3"
            />
            <button type="submit" disabled={!newPost.trim()}>
              Опубликовать
            </button>
          </form>
        </div>

        <div className="posts-list">
          {posts.length === 0 ? (
            <div className="no-posts">Постов пока нет. Создайте первый!</div>
          ) : (
            posts.map((post) => {
              const isLiked = post.likes.some((like) => like.user_id === user.id)
              const isOwner = post.user_id === user.id

              return (
                <div key={post.id} className="post-card">
                  <div className="post-header">
                    <div className="post-author">
                      <div className="author-avatar">
                        {post.profiles?.avatar_url ? (
                          <img src={post.profiles.avatar_url} alt="" />
                        ) : (
                          <div className="avatar-placeholder">
                            {post.profiles?.full_name?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <div className="author-info">
                        <div className="author-name">{post.profiles?.full_name}</div>
                        <div className="author-username">@{post.profiles?.username}</div>
                      </div>
                    </div>
                    {isOwner && (
                      <button
                        className="delete-post-btn"
                        onClick={() => deletePost(post.id)}
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  <div className="post-content">{post.content}</div>

                  <div className="post-actions">
                    <button
                      className={`action-btn ${isLiked ? 'liked' : ''}`}
                      onClick={() => toggleLike(post.id)}
                    >
                      {isLiked ? '❤️' : '🤍'} {post.likes.length}
                    </button>
                    <button
                      className="action-btn"
                      onClick={() =>
                        setShowComments({
                          ...showComments,
                          [post.id]: !showComments[post.id],
                        })
                      }
                    >
                      💬 {post.comments.length}
                    </button>
                  </div>

                  {showComments[post.id] && (
                    <div className="comments-section">
                      <div className="comments-list">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="comment">
                            <div className="comment-header">
                              <div className="comment-author">
                                <strong>{comment.profiles?.full_name}</strong>
                                <span className="comment-username">
                                  @{comment.profiles?.username}
                                </span>
                              </div>
                              {comment.user_id === user.id && (
                                <button
                                  className="delete-comment-btn"
                                  onClick={() => deleteComment(comment.id)}
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                            <div className="comment-content">{comment.content}</div>
                          </div>
                        ))}
                      </div>

                      <div className="add-comment">
                        <input
                          type="text"
                          value={commentTexts[post.id] || ''}
                          onChange={(e) =>
                            setCommentTexts({
                              ...commentTexts,
                              [post.id]: e.target.value,
                            })
                          }
                          placeholder="Написать комментарий..."
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              addComment(post.id)
                            }
                          }}
                        />
                        <button onClick={() => addComment(post.id)}>Отправить</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <aside className="feed-sidebar feed-sidebar-right">
        <div className="sidebar-card stats-card">
          <h3>📊 Лента сегодня</h3>
          <div className="stats-row">
            <span className="stats-value">{posts.length}</span>
            <span className="stats-label">постов</span>
          </div>
          <div className="stats-row">
            <span className="stats-value">
              {posts.reduce((acc, p) => acc + p.likes.length, 0)}
            </span>
            <span className="stats-label">лайков</span>
          </div>
        </div>
        <div className="sidebar-card trends-card">
          <div className="trends-icon">✨</div>
          <h3>Интересное</h3>
          <p>Здесь появятся тренды и рекомендации, когда их будет больше.</p>
        </div>
        <div className="sidebar-card empty-card decorative">
          <div className="decorative-dots" aria-hidden="true" />
        </div>
      </aside>
    </div>
  )
}
