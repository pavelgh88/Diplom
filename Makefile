.PHONY: install start stop test

# ── Встановлення залежностей ───────────────────────────────────────────────────
install:
	cd backend && python3 -m venv venv && \
	  venv/bin/pip install -q -r requirements.txt
	cd frontend && npm install --legacy-peer-deps --silent

# ── Запуск обох серверів ───────────────────────────────────────────────────────
start:
	@echo "Запуск backend  → http://localhost:5001"
	@cd backend && source venv/bin/activate && python app.py > /tmp/diploma_backend.log 2>&1 & \
	  echo $$! > /tmp/diploma_backend.pid
	@echo "Запуск frontend → http://localhost:3000"
	@cd frontend && npm start > /tmp/diploma_frontend.log 2>&1 & \
	  echo $$! > /tmp/diploma_frontend.pid
	@echo ""
	@echo "Сервери запущено. Зупинити: make stop"
	@echo "Логи backend:  tail -f /tmp/diploma_backend.log"
	@echo "Логи frontend: tail -f /tmp/diploma_frontend.log"

# ── Зупинка серверів ───────────────────────────────────────────────────────────
stop:
	@if [ -f /tmp/diploma_backend.pid ]; then \
	  kill $$(cat /tmp/diploma_backend.pid) 2>/dev/null && rm /tmp/diploma_backend.pid; \
	  echo "Backend зупинено"; fi
	@if [ -f /tmp/diploma_frontend.pid ]; then \
	  kill $$(cat /tmp/diploma_frontend.pid) 2>/dev/null && rm /tmp/diploma_frontend.pid; \
	  echo "Frontend зупинено"; fi
	@pkill -f "python app.py"  2>/dev/null || true
	@pkill -f "react-scripts"  2>/dev/null || true

# ── Тести ──────────────────────────────────────────────────────────────────────
test:
	cd backend && venv/bin/python -m pytest tests/ -v
