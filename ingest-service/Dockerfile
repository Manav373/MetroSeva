FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and project files
COPY ingest-service/requirements.txt /app/ingest-service/
RUN pip install --no-cache-dir -r /app/ingest-service/requirements.txt

COPY ml/ /app/ml/
COPY ingest-service/ /app/ingest-service/

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "ingest-service.main:app", "--host", "0.0.0.0", "--port", "8000"]
