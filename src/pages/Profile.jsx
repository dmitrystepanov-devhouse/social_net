import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Profile.css'

export default function Profile() {
  const { user, profile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ posts: 0, friends: 0, likes: 0 })

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    bio: '',
    avatar_url: '',
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
      })
      loadStats()
    }
  }, [profile])

  const loadStats = async () => {
    try {
      const [postsResult, friendsResult, likesResult] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact' }).eq('user_id', user.id),
        supabase
          .from('friendships')
          .select('id', { count: 'exact' })
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
          .eq('status', 'accepted'),
        supabase
          .from('likes')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id),
      ])

      setStats({
        posts: postsResult.count || 0,
        friends: friendsResult.count || 0,
        likes: likesResult.count || 0,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: formData.username,
          full_name: formData.full_name,
          bio: formData.bio,
          avatar_url: formData.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      setEditing(false)
      window.location.reload()
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Ошибка при обновлении профиля: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="loading">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="profile-container">
      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-header">
            <div className="profile-avatar-large">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" />
              ) : (
                <div className="avatar-placeholder-large">
                  {profile.full_name?.charAt(0) || '?'}
                </div>
              )}
            </div>

            {!editing ? (
              <div className="profile-info">
                <h1>{profile.full_name}</h1>
                <p className="username">@{profile.username}</p>
                {profile.bio && <p className="bio">{profile.bio}</p>}
                <p className="member-since">
                  На сайте с {formatDate(profile.created_at)}
                </p>
                <button className="edit-profile-btn" onClick={() => setEditing(true)}>
                  ✏️ Редактировать профиль
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="edit-form">
                <div className="form-group">
                  <label>Имя пользователя</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Полное имя</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>О себе</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows="3"
                    placeholder="Расскажите о себе..."
                  />
                </div>

                <div className="form-group">
                  <label>URL аватара</label>
                  <input
                    type="url"
                    value={formData.avatar_url}
                    onChange={(e) =>
                      setFormData({ ...formData, avatar_url: e.target.value })
                    }
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" disabled={loading} className="save-btn">
                    {loading ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false)
                      setFormData({
                        username: profile.username || '',
                        full_name: profile.full_name || '',
                        bio: profile.bio || '',
                        avatar_url: profile.avatar_url || '',
                      })
                    }}
                    className="cancel-btn"
                    disabled={loading}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="profile-stats">
            <div className="stat-card">
              <div className="stat-icon">📝</div>
              <div className="stat-value">{stats.posts}</div>
              <div className="stat-name">Постов</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-value">{stats.friends}</div>
              <div className="stat-name">Друзей</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">❤️</div>
              <div className="stat-value">{stats.likes}</div>
              <div className="stat-name">Лайков</div>
            </div>
          </div>
        </div>

        <div className="account-info-card">
          <h2>Информация об аккаунте</h2>
          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">Email</div>
              <div className="info-value">{user.email}</div>
            </div>
            <div className="info-item">
              <div className="info-label">ID пользователя</div>
              <div className="info-value">{user.id}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Дата создания</div>
              <div className="info-value">{formatDate(profile.created_at)}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Последнее обновление</div>
              <div className="info-value">{formatDate(profile.updated_at)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
