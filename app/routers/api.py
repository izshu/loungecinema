from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import config
from app.database import get_db
from app.models import Booking, Hall, Tariff
from app.schemas import (
    BookingCreate,
    BookingOut,
    HallOut,
    PriceOut,
    PricePreview,
    TariffOut,
)
from app.services.booking_logic import (
    calculate_total,
    create_booking_conflict,
    get_available_slots,
    get_open_close_for_day,
)

router = APIRouter(prefix="/api", tags=["api"])


@router.get("/halls", response_model=list[HallOut])
def list_halls(db: Session = Depends(get_db)):
    return db.query(Hall).order_by(Hall.id).all()


@router.get("/tariffs", response_model=list[TariffOut])
def list_tariffs(db: Session = Depends(get_db)):
    return db.query(Tariff).order_by(Tariff.sort_order).all()


@router.get("/slots")
def list_slots(
    hall_id: int,
    tariff_id: int,
    day: str,
    db: Session = Depends(get_db),
):
    try:
        parsed_day = datetime.strptime(day, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Неверный формат даты") from None

    if parsed_day < datetime.now().date():
        return {"slots": [], "busy": []}

    slots = get_available_slots(db, hall_id, tariff_id, parsed_day)
    available_times = {s["time"] for s in slots}

    open_dt, close_dt = get_open_close_for_day(parsed_day)

    tariff = db.get(Tariff, tariff_id)
    duration = timedelta(minutes=tariff.duration_minutes if tariff else 60)
    step = timedelta(minutes=config.SLOT_STEP_MINUTES)
    now = datetime.now()

    busy: list[str] = []
    current = open_dt
    while current + duration <= close_dt:
        if current.minute == 0 and current >= now:
            t = current.strftime("%H:%M")
            if t not in available_times:
                end = current + duration
                busy.append(f"{t} – {end.strftime('%H:%M')}")
        current += step

    return {"slots": slots, "busy": busy}


@router.post("/price", response_model=PriceOut)
def preview_price(body: PricePreview, db: Session = Depends(get_db)):
    tariff = db.get(Tariff, body.tariff_id)
    if not tariff:
        raise HTTPException(404, "Тариф не найден")

    guests = body.guests_count
    if tariff.category == "date":
        guests = config.DATE_PACKAGE_GUESTS

    extra_guests = 0
    extra_amount = 0
    hookah_amount = config.HOOKAH_RUB if body.hookah else 0

    if tariff.category == "hourly":
        base = config.HOURLY_PER_PERSON_RUB * body.guests_count
        breakdown = f"{config.HOURLY_PER_PERSON_RUB} ₽ × {body.guests_count} чел."
    elif tariff.category == "date":
        base = tariff.base_price
        breakdown = f"Пакет для двоих — {tariff.base_price} ₽"
    else:
        base = tariff.base_price
        breakdown = f"Пакет {tariff.base_price} ₽"
        if body.guests_count > config.INCLUDED_GUESTS_RENT:
            extra_guests = body.guests_count - config.INCLUDED_GUESTS_RENT
            extra_amount = extra_guests * config.EXTRA_PERSON_RUB_RENT
            breakdown += f" + {extra_amount} ₽ ({extra_guests} доп.)"

    if body.hookah:
        breakdown += f" + кальян {hookah_amount} ₽"

    total = calculate_total(tariff, body.guests_count, body.hookah)
    if tariff.category == "date":
        total = calculate_total(tariff, config.DATE_PACKAGE_GUESTS, body.hookah)

    return PriceOut(
        base_price=base,
        extra_guests=extra_guests,
        extra_amount=extra_amount,
        hookah_amount=hookah_amount,
        total_price=total,
        breakdown=breakdown,
    )


@router.post("/bookings", response_model=BookingOut)
def create_booking(body: BookingCreate, db: Session = Depends(get_db)):
    hall = db.get(Hall, body.hall_id)
    tariff = db.get(Tariff, body.tariff_id)
    if not hall or not tariff:
        raise HTTPException(404, "Зал или тариф не найден")

    guests = body.guests_count
    if tariff.category == "date":
        guests = config.DATE_PACKAGE_GUESTS

    try:
        start_at = datetime.strptime(
            f"{body.date.isoformat()} {body.time}", "%Y-%m-%d %H:%M"
        )
    except ValueError:
        raise HTTPException(400, "Неверное время") from None

    end_at = start_at + timedelta(minutes=tariff.duration_minutes)

    slots = get_available_slots(db, body.hall_id, body.tariff_id, body.date)
    if not any(s["time"] == body.time for s in slots):
        raise HTTPException(
            400,
            "Это время занято или недоступно. Выберите другой слот — зал и пакет сохранены.",
        )

    if create_booking_conflict(db, body.hall_id, start_at, end_at):
        raise HTTPException(400, "Конфликт с другой бронью")

    total = calculate_total(tariff, guests, body.hookah)

    booking = Booking(
        hall_id=body.hall_id,
        tariff_id=body.tariff_id,
        start_at=start_at,
        end_at=end_at,
        client_name=body.client_name.strip(),
        phone=body.phone.strip(),
        guests_count=guests,
        total_price=total,
        hookah=body.hookah,
        status="new",
        note=body.note,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)

    return BookingOut(
        id=booking.id,
        hall_name=hall.name,
        tariff_name=tariff.name,
        start_at=booking.start_at,
        end_at=booking.end_at,
        client_name=booking.client_name,
        phone=booking.phone,
        guests_count=booking.guests_count,
        total_price=booking.total_price,
        hookah=booking.hookah,
        status=booking.status,
        created_at=booking.created_at,
        note=booking.note,
    )


@router.get("/settings")
def get_settings():
    return {
        "weekday_open": config.WEEKDAY_OPEN,
        "weekend_open": config.WEEKEND_OPEN,
        "close_time": config.CLOSE_TIME,
        "hourly_per_person": config.HOURLY_PER_PERSON_RUB,
        "extra_person_rent": config.EXTRA_PERSON_RUB_RENT,
        "included_guests_rent": config.INCLUDED_GUESTS_RENT,
        "date_guests": config.DATE_PACKAGE_GUESTS,
        "hookah_rub": config.HOOKAH_RUB,
        "buffer_minutes": config.BUFFER_MINUTES,
        "contact": config.CONTACT,
    }


HALL_GALLERY = {
    "the-moon": 5,
    "flamingo": 5,
    "black-room": 3,
}


@router.get("/halls/gallery")
def halls_gallery():
    result = {}
    for slug, count in HALL_GALLERY.items():
        result[slug] = [f"/static/images/{slug}/{i}.png" for i in range(1, count + 1)]
    return result
