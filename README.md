# Навчальний тренажер з лінійного програмування

Дипломний проект з оптимізаційних методів: покрокове розв'язання задач лінійного програмування у браузері.

## Реалізовані алгоритми

| Метод | Файл | Опис |
|---|---|---|
| Симплекс-метод | `backend/algorithms/simplex.py` | Мінімізація/максимізація LP з покроковим записом таблиць |
| Метод гілок і меж | `backend/algorithms/branch_and_bound.py` | ILP з побудовою дерева підзадач |
| Метод потенціалів | `backend/algorithms/transport.py` | Транспортна задача з покроковим планом перевезень |

---

## Технічний стек

### Backend
- **Python 3.12**
- **Flask 3.0** — REST API
- **NumPy** — матричні обчислення
- **SciPy** (`linprog`) — LP-релаксації у методі гілок і меж
- **pytest** — 32 автоматичні тести

### Frontend
- **React 19** + **TypeScript 5.9**
- **Ant Design 5** — UI-компоненти
- **ReactFlow 11** — дерево гілок і меж
- **Axios** — HTTP-клієнт

---

## Структура проекту

```
diploma_project/
├── backend/
│   ├── algorithms/
│   │   ├── simplex.py            # Симплекс-метод
│   │   ├── branch_and_bound.py   # Метод гілок і меж
│   │   └── transport.py          # Метод потенціалів
│   ├── tests/
│   │   ├── test_simplex.py       # 12 тестів
│   │   ├── test_branch_and_bound.py  # 10 тестів
│   │   └── test_transport.py     # 10 тестів
│   ├── app.py                    # Flask API (порт 5001)
│   └── requirements.txt
└── frontend/
    └── src/
        ├── components/
        │   ├── SimplexSolver/    # Симплекс-таблиці
        │   ├── BranchAndBound/   # Дерево B&B (ReactFlow)
        │   ├── Transport/        # Транспортна задача
        │   │   ├── TransportSolver.tsx
        │   │   └── TransportTable.tsx
        │   └── ProblemInputForm.tsx
        ├── api/client.ts         # Axios-запити до API
        └── types/index.ts        # TypeScript-типи
```

---

## Запуск

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py                     # → http://localhost:5001
```

### Frontend

```bash
cd frontend
npm install
npm start                         # → http://localhost:3000
```

### Тести

```bash
cd backend
source venv/bin/activate
pytest -v                         # 32 тести
```

---

## API

| Метод | Ендпоінт | Тіло запиту |
|---|---|---|
| POST | `/api/simplex` | `{ c, A, b, maximize }` |
| POST | `/api/branch-and-bound` | `{ c, A, b, maximize, bounds? }` |
| POST | `/api/transport` | `{ supply, demand, costs }` |
| GET | `/api/health` | — |

---

## Приклад запиту (симплекс)

```json
POST /api/simplex
{
  "c": [3, 5],
  "A": [[1, 0], [0, 2], [3, 5]],
  "b": [4, 12, 25],
  "maximize": true
}
```

Відповідь містить `status`, `optimal_value`, `solution`, `steps` (покрокові таблиці), `num_iterations`.

---

## Приклад запиту (транспортна задача)

```json
POST /api/transport
{
  "supply": [30, 40, 20],
  "demand": [25, 35, 30],
  "costs": [[2, 3, 1], [5, 4, 8], [5, 6, 8]]
}
```

Відповідь містить `status`, `optimal_value`, `allocation` (матриця розподілу), `steps` (кроки методу потенціалів).
