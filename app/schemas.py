import json
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class HallOut(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None

    model_config = {"from_attributes": True}


class TariffOut(BaseModel):
    id: int
    name: str
    slug: str
    duration_minutes: int
    base_price: int
    category: str
    pricing_mode: str
    description: str | None
    price_label: str | None
    image: str | None
    features: list[str] = []

    model_config = {"from_attributes": True}

    @field_validator("features", mode="before")
    @classmethod
    def parse_features(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return []
        return []


class PricePreview(BaseModel):
    hall_id: int
    tariff_id: int
    guests_count: int = Field(ge=1, le=20)
    hookah: bool = False


class PriceOut(BaseModel):
    base_price: int
    extra_guests: int
    extra_amount: int
    hookah_amount: int
    total_price: int
    breakdown: str


class BookingCreate(BaseModel):
    hall_id: int
    tariff_id: int
    date: date
    time: str
    client_name: str = Field(min_length=2, max_length=200)
    phone: str = Field(min_length=6, max_length=50)
    guests_count: int = Field(ge=1, le=20, default=2)
    hookah: bool = False
    note: str | None = None


class BookingOut(BaseModel):
    id: int
    hall_name: str
    tariff_name: str
    start_at: datetime
    end_at: datetime
    client_name: str
    phone: str
    guests_count: int
    total_price: int
    hookah: bool
    status: str
    created_at: datetime
    note: str | None

    model_config = {"from_attributes": True}


class StatusUpdate(BaseModel):
    status: str = Field(pattern="^(new|confirmed|cancelled)$")
