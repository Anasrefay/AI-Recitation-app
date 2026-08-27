FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Data files MUST live at / (root).  The app resolves their paths via
# Path(__file__).parents[2] from /app/app/<module>.py → /.
COPY quran_data.json /quran_data.json
COPY ar-tafsir-qurtubi.json /ar-tafsir-qurtubi.json

COPY backend/app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
