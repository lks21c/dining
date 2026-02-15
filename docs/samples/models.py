"""Dining SQLAlchemy models — separate dining.db binding."""

import os
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Boolean,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import declarative_base, relationship, scoped_session, sessionmaker

DiningBase = declarative_base()

# --------------- Engine / Session (separate dining.db) ---------------

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DINING_DB_PATH = os.path.join(_PROJECT_ROOT, "dining.db")
_engine = None
_SessionFactory = None


def _get_engine():
    global _engine
    if _engine is None:
        db_path = os.getenv("DINING_DB_PATH", _DINING_DB_PATH)
        _engine = create_engine(
            f"sqlite:///{db_path}",
            connect_args={"check_same_thread": False},
            pool_pre_ping=True,
        )
    return _engine


def get_dining_session():
    """Return a scoped session for dining.db."""
    global _SessionFactory
    if _SessionFactory is None:
        engine = _get_engine()
        _SessionFactory = scoped_session(sessionmaker(bind=engine))
    return _SessionFactory


def init_dining_db():
    """Create all dining tables if they don't exist."""
    engine = _get_engine()
    DiningBase.metadata.create_all(engine)


def _utcnow():
    return datetime.now(timezone.utc)


# --------------- Models ---------------


class CrawledPlace(DiningBase):
    __tablename__ = "crawled_place"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, index=True)
    category = Column(String(100))
    description = Column(String(500))
    address = Column(String(300))
    lat = Column(Float)
    lng = Column(Float)
    phone = Column(String(50))
    price_range = Column(String(50))
    atmosphere = Column(String(100))
    good_for = Column(String(200))
    image_url = Column(String(500))
    tags = Column(String(500))
    place_type = Column(String(20))  # restaurant | cafe | bar | bakery
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    sources = relationship(
        "PlaceSource", back_populates="crawled_place", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_crawled_place_lat_lng", "lat", "lng"),)


class PlaceSource(DiningBase):
    __tablename__ = "place_source"

    id = Column(Integer, primary_key=True, autoincrement=True)
    crawled_place_id = Column(Integer, ForeignKey("crawled_place.id", ondelete="CASCADE"), nullable=False)
    source = Column(String(50), nullable=False)
    source_url = Column(String(500))
    rating = Column(Float)
    review_count = Column(Integer)
    snippet = Column(String(500))
    metadata_ = Column("metadata", String(1000))
    crawled_at = Column(DateTime, default=_utcnow)

    crawled_place = relationship("CrawledPlace", back_populates="sources")

    __table_args__ = (
        UniqueConstraint("crawled_place_id", "source", name="uq_place_source"),
        Index("ix_place_source_source", "source"),
    )


class Menu(DiningBase):
    __tablename__ = "menu"

    id = Column(Integer, primary_key=True, autoincrement=True)
    place_name = Column(String(200), nullable=False, index=True)
    menu_name = Column(String(200), nullable=False)
    price = Column(String(50))
    source = Column(String(50), default="diningcode")
    crawled_at = Column(DateTime, default=_utcnow)

    __table_args__ = (
        UniqueConstraint("place_name", "menu_name", "source", name="uq_menu"),
    )


class Restaurant(DiningBase):
    __tablename__ = "restaurant"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)
    description = Column(String(500), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    price_range = Column(String(50), nullable=False)
    atmosphere = Column(String(100), nullable=False)
    good_for = Column(String(200), nullable=False)
    rating = Column(Float, nullable=False)
    review_count = Column(Integer, nullable=False)
    parking_available = Column(Boolean, default=False)
    nearby_parking = Column(String(200))

    __table_args__ = (Index("ix_restaurant_lat_lng", "lat", "lng"),)


class Cafe(DiningBase):
    __tablename__ = "cafe"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    specialty = Column(String(100), nullable=False)
    description = Column(String(500), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    price_range = Column(String(50), nullable=False)
    atmosphere = Column(String(100), nullable=False)
    good_for = Column(String(200), nullable=False)
    rating = Column(Float, nullable=False)
    review_count = Column(Integer, nullable=False)
    parking_available = Column(Boolean, default=False)
    nearby_parking = Column(String(200))

    __table_args__ = (Index("ix_cafe_lat_lng", "lat", "lng"),)


class ParkingLot(DiningBase):
    __tablename__ = "parking_lot"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    type = Column(String(50), nullable=False)
    address = Column(String(300))
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    capacity = Column(Integer, nullable=False)
    hourly_rate = Column(Integer, nullable=False)
    base_time = Column(Integer)
    base_rate = Column(Integer)
    extra_time = Column(Integer)
    extra_rate = Column(Integer)
    free_note = Column(String(300))
    description = Column(String(500), nullable=False)
    operating_hours = Column(String(100), nullable=False)

    __table_args__ = (Index("ix_parking_lot_lat_lng", "lat", "lng"),)
