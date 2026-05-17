# Навчальний тренажер з лінійного програмування

Дипломний проект з оптимізаційних методів: покрокове розв'язання задач лінійного програмування у браузері.

## Реалізовані алгоритми

| Метод | Файл | Опис |
|---|---|---|
| Симплекс-метод | `backend/algorithms/simplex.py` | Мінімізація/максимізація LP з покроковим записом таблиць |
| Метод гілок і меж | `backend/algorithms/branch_and_bound.py` | ILP з побудовою дерева підзадач, стратегія «найдробовіша змінна» |
| Метод потенціалів | `backend/algorithms/transport.py` | Транспортна задача з покроковим планом перевезень |
| Валідатор відповідей | `backend/algorithms/validator.py` | Перевірка покрокових дій студента |

---

## Технічний стек

### Backend
- **Python 3.12**
- **Flask 3.0** — REST API (9 ендпоінтів)
- **NumPy** — матричні обчислення
- **SciPy** (`linprog`) — LP-релаксації у методі гілок і меж
- **pytest** — 43 автоматичні тести

### Frontend
- **React 19** + **TypeScript 5.9**
- **React Router 6** — маршрутизація між розділами
- **React Context** — глобальний стан застосунку
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
│   │   ├── transport.py          # Метод потенціалів
│   │   └── validator.py          # Валідатор кроків студента
│   ├── data/
│   │   └── tasks.json            # Бібліотека навчальних задач (7 задач)
│   ├── tests/
│   │   ├── test_simplex.py       # 12 тестів
│   │   ├── test_branch_and_bound.py  # 12 тестів
│   │   ├── test_transport.py     # 10 тестів
│   │   └── test_validator.py     # 11 тестів
│   ├── app.py                    # Flask API (порт 5001)
│   └── requirements.txt
└── frontend/
    └── src/
        ├── context/
        │   └── AppContext.tsx     # React Context (режим перевірки, вибрана задача)
        ├── components/
        │   ├── SimplexSolver/    # Симплекс-таблиці
        │   ├── BranchAndBound/   # Дерево B&B (ReactFlow)
        │   ├── Transport/        # Транспортна задача
        │   │   ├── TransportSolver.tsx
        │   │   └── TransportTable.tsx
        │   ├── TaskSelector.tsx   # Вибір задачі з бібліотеки
        │   └── ProblemInputForm.tsx
        ├── api/client.ts         # Axios-запити до API
        ├── types/index.ts        # TypeScript-типи
        ├── AppRouter.tsx         # React Router маршрути
        └── App.tsx
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
pytest -v                         # 43 тести
```

---

## API

| Метод | Ендпоінт | Опис |
|---|---|---|
| GET | `/api/health` | Перевірка стану сервера |
| POST | `/api/simplex` | Розв'язання симплекс-методом |
| POST | `/api/simplex/check` | Перевірка вибору ведучого елемента |
| POST | `/api/branch-and-bound` | Розв'язання методом гілок і меж |
| POST | `/api/branch-and-bound/check` | Перевірка вибору змінної для розгалуження |
| POST | `/api/transport` | Розв'язання транспортної задачі |
| POST | `/api/transport/check` | Перевірка плану перевезень студента |
| GET | `/api/tasks` | Список навчальних задач (фільтр: `?type=simplex`) |
| GET | `/api/tasks/<id>` | Повні дані конкретної задачі |

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

## Приклад запиту (валідатор)

```json
POST /api/simplex/check
{
  "tableau": [[1,0,1,0,0,4],[0,2,0,1,0,12],[3,5,0,0,1,25],[-3,-5,0,0,0,0]],
  "col_names": ["x1","x2","s1","s2","s3"],
  "user_pivot_col": 1,
  "user_pivot_row": 2
}
```

Відповідь: `{valid, message, correct_col, correct_row, hint}`.

---

## Приклад запиту (транспортна задача)

```json
POST /api/transport
{
  "supply": [30, 40, 30],
  "demand": [25, 35, 40],
  "costs": [[2, 3, 1], [5, 4, 8], [5, 6, 8]]
}
```

Відповідь містить `status`, `optimal_value`, `allocation` (матриця розподілу), `steps` (кроки методу потенціалів).
