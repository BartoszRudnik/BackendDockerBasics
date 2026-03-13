# backend-docker-basics

Konteneryzowany backend Node.js z healthcheckiem, persistent storage i
strukturalnym logowaniem. Uruchamiany jednym poleceniem.

## Szybki start

```bash
docker volume create backend-data

docker run -d \
  --name backend \
  -p 3000:3000 \
  -v backend-data:/app/data \
  -e APP_VERSION=v0.1.0 \
  backend:v0.1.0

curl http://localhost:3000/health
```

## Build

```bash
# Zbuduj image z tagiem wersji
docker build -t backend:v0.1.0 .

# Zbuduj bez cache (np. po zmianie zależności)
docker build --no-cache -t backend:v0.1.0 .
```

## Endpoints

| Method | Path      | Opis                                      |
|--------|-----------|-------------------------------------------|
| GET    | `/health` | Status aplikacji, uptime, wersja          |
| POST   | `/upload` | Zapisz plik tekstowy na dysk              |
| GET    | `/files`  | Lista plików w persistent storage         |

### Przykłady

```bash
# Health check
curl http://localhost:3000/health
# {"status":"ok","version":"v0.1.0","uptime":42,"timestamp":"2026-03-12T..."}

# Upload pliku
curl -X POST http://localhost:3000/upload \
  -H "Content-Type: text/plain" \
  -d "hello from container"
# {"saved":"upload-1710245678123.txt"}

# Lista plików
curl http://localhost:3000/files
# {"files":["upload-1710245678123.txt"],"data_dir":"/app/data"}
```

## Zmienne środowiskowe

| Nazwa         | Domyślna     | Wymagana | Opis                                    |
|---------------|--------------|----------|-----------------------------------------|
| `PORT`        | `3000`       | ❌        | Port nasłuchu serwera                   |
| `HOST`        | `0.0.0.0`    | ❌        | Interfejs nasłuchu                      |
| `NODE_ENV`    | `production` | ❌        | Tryb pracy Node.js                      |
| `DATA_DIR`    | `/app/data`  | ❌        | Ścieżka do katalogu persistent storage  |
| `APP_VERSION` | `dev`        | ❌        | Wersja aplikacji (widoczna w /health)   |

> ⚠️ Nigdy nie hardcoduj sekretów w Dockerfile ani nie wkładaj `.env` do image'a.
> Przekazuj zmienne przez `-e` przy `docker run` lub przez Docker secrets w produkcji.

## Porty

| Port | Protokół | Opis                              |
|------|----------|-----------------------------------|
| 3000 | HTTP     | API (konfigurowalny przez `PORT`) |

## Volumes

| Mount point | Opis                                          |
|-------------|-----------------------------------------------|
| `/app/data` | Persistent storage — pliki uploadu            |

Named volume przeżywa `docker stop`, `docker restart` oraz `docker rm`.
Dane przepadają tylko po `docker volume rm backend-data`.

## Co trafia do image'a

| Co                          | Ścieżka w image'u          | Dlaczego                        |
|-----------------------------|----------------------------|---------------------------------|
| `src/server.js`             | `/app/src/server.js`       | Kod aplikacji                   |
| `node_modules/` (prod only) | `/app/node_modules/`       | Zależności runtime              |
| `package.json`              | `/app/package.json`        | Manifest projektu               |
| `package-lock.json`         | `/app/package-lock.json`   | Gwarancja reproducibility       |
| Node.js 22 runtime          | `/usr/local/bin/node`      | Interpreter — ~153 MB           |

## Co NIE trafia do image'a

| Co                    | Dlaczego                                              |
|-----------------------|-------------------------------------------------------|
| `.env`, `.env.*`      | Sekrety — przekazuj przez `-e` lub Docker secrets     |
| `node_modules/` z hosta | Build w kontenerze = deterministyczne środowisko    |
| `.git/`               | Historia repo nie jest częścią artefaktu deploymentu  |
| `*.log`               | Logi są efemeryczne — nie należą do image'a           |
| `README.md`           | Dokumentacja developerska                             |
| `docker-compose*.yml` | Orkiestracja lokalna, nie runtime                     |

## Debug

```bash
# Logi na żywo
docker logs backend -f

# Wejście do kontenera (sh bo Alpine nie ma bash)
docker exec -it backend sh

# Status i historia healthchecków
docker inspect --format='{{json .State.Health}}' backend | jq

# Ostatni wynik healthchecka
docker inspect --format='{{json .State.Health}}' backend | jq '.Log[-1]'

# Zmienne środowiskowe w działającym kontenerze
docker exec backend env

# Użycie zasobów (CPU/RAM)
docker stats backend --no-stream
```

## Analiza image'a

```bash
# Rozmiar końcowy
docker image ls backend

# Rozmiar każdej warstwy
docker history backend:v0.1.0
```

### Dlaczego image waży ~170 MB i jak go zmniejszyć

153 MB to koszt Node.js runtime — nieunikniony przy tym base image.
Twój kod aplikacji zajmuje ~33 KB.

| Technika | Oczekiwany rozmiar | Trade-off |
|---|---|---|
| Aktualny stan (`node:22-alpine`) | ~170 MB | Najprostszy setup, sh dostępny |
| Multi-stage build | ~120 MB | Bardziej złożony Dockerfile |
| Distroless base (`gcr.io/distroless/nodejs22`) | ~100 MB | Brak shella — trudniejszy debug |
| Przepisanie na Go + `scratch` base | ~10 MB | Zmiana języka, inna złożoność |

Aktualny image jest świadomym kompromisem: czytelność > rozmiar, etap v0.1.0.

## Graceful shutdown

Aplikacja obsługuje `SIGTERM` (wysyłany przez `docker stop`) i `SIGINT` (Ctrl+C).
Serwer kończy aktywne połączenia i zamyka się czysto w ciągu max 10 sekund.

```bash
docker stop backend
docker logs backend | tail -3
# {"time":"...","event":"shutdown_initiated","signal":"SIGTERM"}
# {"time":"...","event":"shutdown_complete"}
```

## Struktura projektu

```
backend-docker-basics/
├── src/
│   └── server.js        # Kod aplikacji
├── .dockerignore        # Co NIE trafia do build context
├── Dockerfile           # Przepis na image
├── package.json         # Manifest projektu
├── package-lock.json    # Lock file — commitowany do repo
└── README.md            # Ten plik
```

