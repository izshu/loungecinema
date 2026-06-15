# LoungeCinema — онлайн-бронирование

Сайт записи для антикинотеатра: зал → пакет → дата/время → контакты.

## Запуск

```powershell
cd loungecinema
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Откройте в браузере: http://127.0.0.1:8000/

## Залы

- The Moon
- Фламинго
- Black Room

## Пакеты

| Пакет | Время | Цена |
|-------|-------|------|
| Easy | 3 ч | 6 000 ₽ |
| Normal | 4 ч | 8 000 ₽ |
| Hard | 5 ч | 10 000 ₽ |
| Свидание Standard | 2 ч | 3 490 ₽ |
| Свидание VIP | 3 ч | 5 490 ₽ |
| Свидание Premium | 4 ч | 9 490 ₽ |

Доплата за гостей (пакеты аренды): **300 ₽** с человека сверх 2-х (настройка в `app/config.py`).

## Настройки

Файл `app/config.py`:

- `OPEN_TIME` / `CLOSE_TIME` — часы работы
- `BUFFER_MINUTES` — пауза между сеансами (30 мин)
- `EXTRA_PERSON_RUB` — доплата за гостя

База данных: `loungecinema.db` (SQLite) в папке проекта.

> **Примечание:** В будущем планируется интеграция с YCLIENTS CRM для управления бронированиями.
