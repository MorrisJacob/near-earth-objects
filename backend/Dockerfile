# ── Stage 1: Build ────────────────────────────────────────────────────────────
# Use the official Go image to compile a statically-linked binary.
# CGO_ENABLED=0 ensures the output is a self-contained binary with no C runtime
# dependency, which lets us use a tiny Alpine base in the final stage.
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Copy the module manifest first so Docker can cache the dependency download
# layer independently of source changes (no external deps here, but good practice).
COPY go.mod ./
RUN go mod download

COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o server .

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
# Minimal Alpine image — the compiled binary is the only thing we need.
# ca-certificates is required so the server can make HTTPS calls to NASA's API.
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=builder /app/server .

EXPOSE 7777
CMD ["./server"]
