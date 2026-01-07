# Multi-stage build
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --trusted-host pypi.org --trusted-host pypi.python.org --trusted-host files.pythonhosted.org -r requirements.txt

# Copy application code
COPY app.py .

# Copy frontend build from first stage
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Expose port 33766
EXPOSE 33766

# Set environment variables
ENV PORT=33766
ENV PYTHONUNBUFFERED=1

# Run the application with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:33766", "--workers", "2", "--timeout", "120", "app:app"]
