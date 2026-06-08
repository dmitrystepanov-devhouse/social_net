from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import List, Optional
import datetime
import uuid

# ==========================================
# 1. Настройка базы данных (SQLAlchemy)
# ==========================================
SQLALCHEMY_DATABASE_URL = "sqlite:///./social_net.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

# ==========================================
# 2. Модели базы данных (Соответствуют вашим SQL миграциям)
# ==========================================
class Profile(Base):
    __tablename__ = "profiles"
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True) # Добавлено для авторизации (замена Supabase Auth)
    hashed_password = Column(String)                # Добавлено для авторизации
    username = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    avatar_url = Column(String, default="")
    bio = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    posts = relationship("Post", back_populates="author")

class Post(Base):
    __tablename__ = "posts"
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    image_url = Column(String, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    author = relationship("Profile", back_populates="posts")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")

class Comment(Base):
    __tablename__ = "comments"
    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    post = relationship("Post", back_populates="comments")
    author = relationship("Profile")

class Like(Base):
    __tablename__ = "likes"
    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (UniqueConstraint('post_id', 'user_id', name='_post_user_uc'),)
    
    post = relationship("Post", back_populates="likes")

# Создаем таблицы
Base.metadata.create_all(bind=engine)

# ==========================================
# 3. Pydantic Схемы (Для валидации API)
# ==========================================
class ProfileBase(BaseModel):
    username: str
    full_name: str
    avatar_url: Optional[str] = ""
    bio: Optional[str] = ""

class ProfileResponse(ProfileBase):
    id: str
    created_at: datetime.datetime
    class Config: from_attributes = True

class PostCreate(BaseModel):
    content: str
    image_url: Optional[str] = ""

class CommentResponse(BaseModel):
    id: str
    content: str
    created_at: datetime.datetime
    author: ProfileResponse
    class Config: from_attributes = True

class LikeResponse(BaseModel):
    id: str
    user_id: str
    class Config: from_attributes = True

class PostResponse(BaseModel):
    id: str
    content: str
    created_at: datetime.datetime
    author: ProfileResponse
    comments: List[CommentResponse] = []
    likes: List[LikeResponse] = []
    class Config: from_attributes = True

# ==========================================
# 4. Инициализация FastAPI
# ==========================================
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Social Network API")

# Настройка CORS для работы с React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Адрес вашего Vite сервера
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# 5. Эндпоинты (Маршруты)
# ==========================================

@app.get("/api/posts", response_model=List[PostResponse], tags=["Posts"])
def get_feed(db: Session = Depends(get_db)):
    """Аналог вызова supabase.from('posts').select(...) из Feed.jsx"""
    posts = db.query(Post).order_by(Post.created_at.desc()).all()
    return posts

@app.post("/api/posts", response_model=PostResponse, tags=["Posts"])
def create_post(post: PostCreate, user_id: str, db: Session = Depends(get_db)):
    """Создание поста. В будущем user_id будет браться из JWT токена"""
    new_post = Post(content=post.content, image_url=post.image_url, user_id=user_id)
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    return new_post

@app.delete("/api/posts/{post_id}", tags=["Posts"])
def delete_post(post_id: str, user_id: str, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id, Post.user_id == user_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден или нет прав на удаление")
    db.delete(post)
    db.commit()
    return {"message": "Пост удален"}

@app.post("/api/posts/{post_id}/like", tags=["Interactions"])
def toggle_like(post_id: str, user_id: str, db: Session = Depends(get_db)):
    existing_like = db.query(Like).filter(Like.post_id == post_id, Like.user_id == user_id).first()
    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {"message": "Лайк убран", "liked": False}
    else:
        new_like = Like(post_id=post_id, user_id=user_id)
        db.add(new_like)
        db.commit()
        return {"message": "Лайк поставлен", "liked": True}