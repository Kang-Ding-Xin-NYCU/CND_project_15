FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY tests ./tests

RUN mkdir -p /app/data

EXPOSE 3443

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, ssl, urllib.request; protocol = 'https' if os.getenv('HTTPS') == 'true' else 'http'; port = os.getenv('PORT') or ('3443' if protocol == 'https' else '3000'); context = ssl._create_unverified_context() if protocol == 'https' else None; urllib.request.urlopen(f'{protocol}://127.0.0.1:{port}/api/health', context=context, timeout=3).read()"

CMD ["python", "-m", "app.main"]
