import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import './Friends.css'

export default function Friends() {
  const [users, setUsers] = useState([])
  const [friendships, setFriendships] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const { user } = useAuth()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [usersResult, friendshipsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .neq('id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('friendships')
          .select('*')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`),
      ])

      if (usersResult.error) throw usersResult.error
      if (friendshipsResult.error) throw friendshipsResult.error

      setUsers(usersResult.data || [])
      setFriendships(friendshipsResult.data || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendFriendRequest = async (friendId) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .insert([{ user_id: user.id, friend_id: friendId, status: 'pending' }])

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error sending friend request:', error)
    }
  }

  const acceptFriendRequest = async (friendshipId) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error accepting friend request:', error)
    }
  }

  const removeFriend = async (friendshipId) => {
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error removing friend:', error)
    }
  }

  const getFriendshipStatus = (userId) => {
    const friendship = friendships.find(
      (f) =>
        (f.user_id === user.id && f.friend_id === userId) ||
        (f.friend_id === user.id && f.user_id === userId)
    )

    if (!friendship) return { status: 'none', friendshipId: null }

    return {
      status: friendship.status,
      friendshipId: friendship.id,
      isReceiver: friendship.friend_id === user.id,
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const pendingRequests = users.filter((u) => {
    const fs = getFriendshipStatus(u.id)
    return fs.status === 'pending' && fs.isReceiver
  })

  const friends = users.filter((u) => {
    const fs = getFriendshipStatus(u.id)
    return fs.status === 'accepted'
  })

  const otherUsers = filteredUsers.filter((u) => {
    const fs = getFriendshipStatus(u.id)
    return fs.status === 'none' || (fs.status === 'pending' && !fs.isReceiver)
  })

  if (loading) {
    return (
      <div className="friends-container">
        <div className="loading">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="friends-container">
      <div className="friends-content">
        <div className="search-section">
          <h1>Поиск друзей</h1>
          <input
            type="text"
            placeholder="Поиск по имени или username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {pendingRequests.length > 0 && (
          <div className="friends-section">
            <h2>Входящие заявки</h2>
            <div className="users-grid">
              {pendingRequests.map((u) => {
                const fs = getFriendshipStatus(u.id)
                return (
                  <div key={u.id} className="user-card pending">
                    <div className="user-avatar">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" />
                      ) : (
                        <div className="avatar-placeholder">{u.full_name.charAt(0)}</div>
                      )}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{u.full_name}</div>
                      <div className="user-username">@{u.username}</div>
                      {u.bio && <div className="user-bio">{u.bio}</div>}
                    </div>
                    <div className="user-actions">
                      <button
                        className="btn-accept"
                        onClick={() => acceptFriendRequest(fs.friendshipId)}
                      >
                        Принять
                      </button>
                      <button
                        className="btn-reject"
                        onClick={() => removeFriend(fs.friendshipId)}
                      >
                        Отклонить
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {friends.length > 0 && (
          <div className="friends-section">
            <h2>Мои друзья ({friends.length})</h2>
            <div className="users-grid">
              {friends.map((u) => {
                const fs = getFriendshipStatus(u.id)
                return (
                  <div key={u.id} className="user-card friend">
                    <div className="user-avatar">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" />
                      ) : (
                        <div className="avatar-placeholder">{u.full_name.charAt(0)}</div>
                      )}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{u.full_name}</div>
                      <div className="user-username">@{u.username}</div>
                      {u.bio && <div className="user-bio">{u.bio}</div>}
                    </div>
                    <div className="user-actions">
                      <button
                        className="btn-remove"
                        onClick={() => removeFriend(fs.friendshipId)}
                      >
                        Удалить из друзей
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="friends-section">
          <h2>Найти новых друзей</h2>
          {otherUsers.length === 0 ? (
            <div className="no-users">Пользователи не найдены</div>
          ) : (
            <div className="users-grid">
              {otherUsers.map((u) => {
                const fs = getFriendshipStatus(u.id)
                return (
                  <div key={u.id} className="user-card">
                    <div className="user-avatar">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" />
                      ) : (
                        <div className="avatar-placeholder">{u.full_name.charAt(0)}</div>
                      )}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{u.full_name}</div>
                      <div className="user-username">@{u.username}</div>
                      {u.bio && <div className="user-bio">{u.bio}</div>}
                    </div>
                    <div className="user-actions">
                      {fs.status === 'none' ? (
                        <button
                          className="btn-add"
                          onClick={() => sendFriendRequest(u.id)}
                        >
                          Добавить в друзья
                        </button>
                      ) : fs.status === 'pending' && !fs.isReceiver ? (
                        <button className="btn-pending" disabled>
                          Заявка отправлена
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
