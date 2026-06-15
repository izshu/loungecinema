import json

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.database import engine
from app.models import Hall, Tariff

HALLS = [
    {"name": "The Moon", "slug": "the-moon", "description": "Уютный зал с мягким светом"},
    {"name": "Фламинго", "slug": "flamingo", "description": "Неоновый зал FLAMINGO"},
    {"name": "Black Room", "slug": "black-room", "description": "Премиальный зал BLACK ROOM"},
]

TARIFFS = [
    {
        "name": "1 час аренды",
        "slug": "hourly",
        "duration_minutes": 60,
        "base_price": 300,
        "category": "hourly",
        "pricing_mode": "per_person",
        "price_label": "300 ₽ / чел.",
        "image": "/static/images/tariffs/hourly.png",
        "description": "Почасовая аренда — цена за каждого гостя",
        "features": [
            "Фильм на большом экране",
            "Музыка, YouTube",
            "Настольные игры",
            "Караоке",
            "PlayStation",
            "Своя еда и напитки",
        ],
        "sort_order": 0,
    },
    {
        "name": "Easy",
        "slug": "easy",
        "duration_minutes": 180,
        "base_price": 6000,
        "category": "rent",
        "pricing_mode": "package",
        "price_label": "6 000 ₽",
        "image": "/static/images/tariffs/easy.png",
        "description": "3 часа · до 8 гостей в цене",
        "features": [
            "3 часа аренды зала",
            "Фильм на большом экране",
            "Караоке, музыка, YouTube",
            "PlayStation, настольные игры",
            "Своя еда и доставка",
            "Доплата 500 ₽/чел. сверх 8",
        ],
        "sort_order": 1,
    },
    {
        "name": "Normal",
        "slug": "normal",
        "duration_minutes": 240,
        "base_price": 8000,
        "category": "rent",
        "pricing_mode": "package",
        "price_label": "8 000 ₽",
        "image": "/static/images/tariffs/normal.png",
        "description": "4 часа · до 8 гостей в цене",
        "features": [
            "4 часа аренды зала",
            "Фильм, караоке, YouTube",
            "PlayStation, настолки",
            "Своя еда и доставка",
            "Доплата 500 ₽/чел. сверх 8",
        ],
        "sort_order": 2,
    },
    {
        "name": "Hard",
        "slug": "hard",
        "duration_minutes": 300,
        "base_price": 10000,
        "category": "rent",
        "pricing_mode": "package",
        "price_label": "10 000 ₽",
        "image": "/static/images/tariffs/hard.png",
        "description": "5 часов · до 8 гостей в цене",
        "features": [
            "5 часов аренды зала",
            "Полный набор развлечений",
            "Своя еда и доставка",
            "Доплата 500 ₽/чел. сверх 8",
        ],
        "sort_order": 3,
    },
    {
        "name": "Свидание Standard",
        "slug": "date-standard",
        "duration_minutes": 120,
        "base_price": 3490,
        "category": "date",
        "pricing_mode": "fixed",
        "price_label": "3 490 ₽",
        "image": "/static/images/tariffs/date-standard.png",
        "description": "2 часа · для двоих",
        "features": [
            "Декор: свечи и лепестки роз",
            "2 чизкейка, чайник чая",
            "Медведи по желанию",
            "Кино, караоке, PlayStation",
            "Своя еда и доставка",
        ],
        "sort_order": 4,
    },
    {
        "name": "Свидание VIP",
        "slug": "date-vip",
        "duration_minutes": 180,
        "base_price": 5490,
        "category": "date",
        "pricing_mode": "fixed",
        "price_label": "5 490 ₽",
        "image": "/static/images/tariffs/date-vip.png",
        "description": "3 часа · для двоих",
        "features": [
            "Декор: свечи, лепестки роз ×2",
            "Фрукты, шоколадное фондю",
            "Вино или шампанское на выбор",
            "Медведи по желанию",
            "Кино, караоке, PlayStation",
        ],
        "sort_order": 5,
    },
    {
        "name": "Свидание Premium",
        "slug": "date-premium",
        "duration_minutes": 240,
        "base_price": 9490,
        "category": "date",
        "pricing_mode": "fixed",
        "price_label": "9 490 ₽",
        "image": "/static/images/tariffs/date-premium.png",
        "description": "4 часа · для двоих",
        "features": [
            "Декор: свечи, лепестки ×8, шары",
            "2 вида суши, чай",
            "Кино, караоке, PlayStation",
            "Медведи по желанию",
            "Своя еда и доставка",
        ],
        "sort_order": 6,
    },
]


def _ensure_columns():
    """Добавить новые колонки в существующую SQLite БД."""
    insp = inspect(engine)
    if "tariffs" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("tariffs")}
    alters = []
    if "pricing_mode" not in cols:
        alters.append("ALTER TABLE tariffs ADD COLUMN pricing_mode VARCHAR(30) DEFAULT 'fixed'")
    if "features" not in cols:
        alters.append("ALTER TABLE tariffs ADD COLUMN features TEXT")
    if "image" not in cols:
        alters.append("ALTER TABLE tariffs ADD COLUMN image VARCHAR(200)")
    if "price_label" not in cols:
        alters.append("ALTER TABLE tariffs ADD COLUMN price_label VARCHAR(100)")
    if "bookings" in insp.get_table_names():
        bcols = {c["name"] for c in insp.get_columns("bookings")}
        if "hookah" not in bcols:
            alters.append("ALTER TABLE bookings ADD COLUMN hookah BOOLEAN DEFAULT 0")
    with engine.begin() as conn:
        for sql in alters:
            conn.execute(text(sql))


def _tariff_payload(t: dict) -> dict:
    features = t.get("features")
    return {
        **t,
        "features": json.dumps(features, ensure_ascii=False) if features else None,
    }


def sync_tariffs(db: Session) -> None:
    for t in TARIFFS:
        payload = _tariff_payload(t)
        row = db.query(Tariff).filter(Tariff.slug == t["slug"]).first()
        if row:
            for k, v in payload.items():
                setattr(row, k, v)
        else:
            db.add(Tariff(**payload))
    db.commit()


def seed_database(db: Session) -> None:
    _ensure_columns()

    if db.query(Hall).count() == 0:
        for h in HALLS:
            db.add(Hall(**h))
        db.commit()

    sync_tariffs(db)
