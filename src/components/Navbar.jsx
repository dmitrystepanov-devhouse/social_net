import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-icon">📱</span>
          Социальная сеть
        </Link>

        <div className="navbar-links">
          <Link
            to="/"
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            <span className="nav-icon">🏠</span>
            Лента
          </Link>
          <Link
            to="/friends"
            className={`nav-link ${location.pathname === '/friends' ? 'active' : ''}`}
          >
            <span className="nav-icon">👥</span>
            Друзья
          </Link>
          <Link
            to="/my-posts"
            className={`nav-link ${location.pathname === '/my-posts' ? 'active' : ''}`}
          >
            <span className="nav-icon">📝</span>
            Мои посты
          </Link>
          <Link
            to="/my-files"
            className={`nav-link ${location.pathname === '/my-files' ? 'active' : ''}`}
          >
            <span className="nav-icon">📁</span>
            Мои файлы
          </Link>
          <Link
            to="/profile"
            className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
          >
            <span className="nav-icon">👤</span>
            Профиль
          </Link>
        </div>

        <div className="navbar-user">
          {profile && (
            <>
              <span className="user-name">{profile.username}</span>
              <button onClick={handleSignOut} className="logout-button">
                Выйти
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
