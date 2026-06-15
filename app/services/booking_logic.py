from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app import config
from app.models import Booking, Tariff


def _parse_time(s: str) -> time:
    h, m = map(int, s.split(":"))
    return time(h, m)


def _is_weekend_day(d: date) -> bool:
    return d.weekday() >= 4


def get_open_close_for_day(d: date) -> tuple[datetime, datetime]:
    if _is_weekend_day(d):
        open_t = _parse_time(config.WEEKEND_OPEN)
    else:
        open_t = _parse_time(config.WEEKDAY_OPEN)

    close_t = _parse_time(config.CLOSE_TIME)
    open_dt = datetime.combine(d, open_t)
    close_dt = datetime.combine(d, close_t)
    if close_dt <= open_dt:
        close_dt += timedelta(days=1)
    return open_dt, close_dt


def _is_valid_slot_start(dt: datetime) -> bool:
    return dt.minute == 0 and dt.second == 0


def calculate_total(tariff: Tariff, guests_count: int, hookah: bool = False) -> int:
    if tariff.category == "hourly" or tariff.pricing_mode == "per_person":
        total = config.HOURLY_PER_PERSON_RUB * guests_count
    elif tariff.category == "date" or tariff.pricing_mode == "fixed":
        total = tariff.base_price
    else:
        total = tariff.base_price
        if guests_count > config.INCLUDED_GUESTS_RENT:
            extra = guests_count - config.INCLUDED_GUESTS_RENT
            total += extra * config.EXTRA_PERSON_RUB_RENT

    if hookah:
        total += config.HOOKAH_RUB
    return total


def _booking_ranges(bookings: list[Booking], buffer: timedelta) -> list[tuple[datetime, datetime]]:
    ranges = []
    for b in bookings:
        if b.status == "cancelled":
            continue
        ranges.append((b.start_at - buffer, b.end_at + buffer))
    return ranges


def _overlaps(start: datetime, end: datetime, ranges: list[tuple[datetime, datetime]]) -> bool:
    for block_start, block_end in ranges:
        if start < block_end and end > block_start:
            return True
    return False


def _fetch_bookings_for_range(
    db: Session, hall_id: int, range_start: datetime, range_end: datetime
) -> list[Booking]:
    return (
        db.query(Booking)
        .filter(
            Booking.hall_id == hall_id,
            Booking.start_at < range_end,
            Booking.end_at > range_start,
        )
        .all()
    )


def get_available_slots(
    db: Session,
    hall_id: int,
    tariff_id: int,
    day: date,
) -> list[dict]:
    tariff = db.get(Tariff, tariff_id)
    if not tariff:
        return []

    open_dt, close_dt = get_open_close_for_day(day)
    duration = timedelta(minutes=tariff.duration_minutes)
    buffer = timedelta(minutes=config.BUFFER_MINUTES)
    step = timedelta(minutes=config.SLOT_STEP_MINUTES)

    now = datetime.now()
    range_start = open_dt - timedelta(days=1)
    range_end = close_dt + timedelta(days=1)
    bookings = _fetch_bookings_for_range(db, hall_id, range_start, range_end)
    blocked = _booking_ranges(bookings, buffer)

    slots: list[dict] = []
    current = open_dt
    while current + duration <= close_dt:
        if _is_valid_slot_start(current) and current >= now:
            end = current + duration
            if not _overlaps(current, end, blocked):
                slots.append(
                    {
                        "time": current.strftime("%H:%M"),
                        "end": end.strftime("%H:%M"),
                        "label": f"{current.strftime('%H:%M')} – {end.strftime('%H:%M')}",
                    }
                )
        current += step

    return slots


def create_booking_conflict(
    db: Session,
    hall_id: int,
    start_at: datetime,
    end_at: datetime,
    exclude_id: int | None = None,
) -> bool:
    buffer = timedelta(minutes=config.BUFFER_MINUTES)
    query = db.query(Booking).filter(
        Booking.hall_id == hall_id,
        Booking.status != "cancelled",
    )
    if exclude_id:
        query = query.filter(Booking.id != exclude_id)

    for b in query.all():
        block_start = b.start_at - buffer
        block_end = b.end_at + buffer
        if start_at < block_end and end_at > block_start:
            return True
    return False
