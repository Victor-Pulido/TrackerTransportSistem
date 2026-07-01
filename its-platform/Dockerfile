# ── Stage 1: Build React frontend ────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Build Go binary ──────────────────────────────────────────────
FROM golang:1.22-alpine AS go-builder
WORKDIR /app
# Download dependencies first (cached layer)
COPY go.mod go.sum ./
RUN go mod download
# Copy source
COPY . .
# Copy built frontend so //go:embed frontend/dist works
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
# modernc.org/sqlite is pure Go — CGO_ENABLED=0 is safe
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o its-demo .

# ── Stage 3: Minimal runtime image ────────────────────────────────────────
FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
# /data is the working directory where its-demo.db will be created
WORKDIR /data
COPY --from=go-builder /app/its-demo ./its-demo
EXPOSE 8080
CMD ["./its-demo"]
