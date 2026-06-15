"""Quick smoke test for booking API and index page."""
import json
import sys
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:8000"


def get(path: str):
    with urllib.request.urlopen(BASE + path) as r:
        return json.loads(r.read())


def post(path: str, body: dict):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    halls = get("/api/halls")
    tariffs = get("/api/tariffs")
    hourly = next(t for t in tariffs if t["category"] == "hourly")
    easy = next(t for t in tariffs if t["category"] == "rent" and "easy" in t["slug"].lower())
    date_t = next(t for t in tariffs if t["category"] == "date")

    hid = halls[0]["id"]
    p1 = post("/api/price", {"hall_id": hid, "tariff_id": hourly["id"], "guests_count": 6, "hookah": False})
    assert p1["total_price"] == 1800, p1

    p2 = post("/api/price", {"hall_id": hid, "tariff_id": easy["id"], "guests_count": 10, "hookah": False})
    assert p2["total_price"] == 7000, p2

    p3 = post("/api/price", {"hall_id": hid, "tariff_id": date_t["id"], "guests_count": 2, "hookah": False})
    assert p3["total_price"] == date_t["base_price"], p3

    day = (date.today() + timedelta(days=7)).isoformat()
    slots = get(f"/api/slots?hall_id={halls[0]['id']}&tariff_id={easy['id']}&day={day}")
    assert "slots" in slots and "busy" in slots

    html = urllib.request.urlopen(BASE + "/").read().decode()
    for marker in ("booking-desk", "hall-cards", "center-flow", "datetime-section", "guests-stepper", "top-progress"):
        assert marker in html, f"missing {marker}"

    print("smoke OK:", p1["total_price"], p2["total_price"], p3["total_price"], len(slots["slots"]), "slots")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("smoke FAIL:", e, file=sys.stderr)
        sys.exit(1)
