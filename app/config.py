import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = f"sqlite:///{BASE_DIR / 'loungecinema.db'}"
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")

WEEKDAY_OPEN = "14:00"
WEEKEND_OPEN = "12:00"
CLOSE_TIME = "02:00"

BUFFER_MINUTES = 30
SLOT_STEP_MINUTES = 60

HOURLY_PER_PERSON_RUB = 300
INCLUDED_GUESTS_RENT = 8
EXTRA_PERSON_RUB_RENT = 500
DATE_PACKAGE_GUESTS = 2
HOOKAH_RUB = 1100

CONTACT = {
    "address": "г. Чита, ул. Анохина, 67",
    "phone": "+7 914 522 74 52",
    "email": "loungecinema67@qmail.com",
    "hours_weekday": "пн–чт: 14:00 – 02:00",
    "hours_weekend": "пт–вс: 12:00 – 02:00 (до последнего гостя)",
}
