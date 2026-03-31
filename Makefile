.PHONY: dev

# Start both the Laravel API server and the Vite dev server together.
# Ctrl+C stops both.
dev:
	@chmod +x scripts/dev.sh && bash scripts/dev.sh
