# Деплой: Vercel (фронтенд) + Render (бекенд)

Після виконання цих кроків у тебе буде **одне посилання** на кшталт
`https://diploma-project.vercel.app`, яке можна надіслати викладачу — їй нічого
встановлювати не треба, просто відкриває в браузері.

Усе **безкоштовно**. Render free засинає після 15 хв простою → перший запит
після паузи ~30 с, далі швидко.

---

## Підготовка коду (вже зроблено)

- `backend/app.py` слухає `$PORT` і має керовану через env-змінну CORS.
- `backend/requirements.txt` містить `gunicorn`.
- `render.yaml` у корені — Render автоматично підхопить.
- `frontend/src/api/client.ts` бере URL з `REACT_APP_API_URL` (fallback на localhost).
- `frontend/vercel.json` — SPA-перенаправлення (React Router не зламається при оновленні сторінки).

---

## Крок 1 — GitHub

1. Створи репозиторій на GitHub (приватний або публічний — байдуже).
2. У корені проєкту:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<TWOJ-USERNAME>/<NAZWA-REPO>.git
   git push -u origin main
   ```

---

## Крок 2 — Render (бекенд)

1. Зареєструйся на <https://render.com> (увійти через GitHub — найшвидше).
2. **New → Blueprint** → вибери щойно створений репозиторій.
3. Render знайде `render.yaml` і запропонує створити сервіс `diploma-backend`.
   Натисни **Apply**.
4. Перший білд триває ~5-7 хв (треба скомпілювати scipy/numpy).
5. Коли статус стане **Live**, скопіюй URL зверху — буде щось на кшталт
   `https://diploma-backend.onrender.com`.
6. Перевір: відкрий `https://diploma-backend.onrender.com/api/tasks?type=simplex`
   у браузері — має повернути JSON зі списком задач.

---

## Крок 3 — Vercel (фронтенд)

1. Зареєструйся на <https://vercel.com> (через GitHub).
2. **Add New → Project** → імпортуй той самий репозиторій.
3. На екрані налаштування:
   - **Root Directory** → натисни *Edit* → вибери `frontend`.
   - **Framework Preset** → `Create React App` (визначиться автоматично).
   - **Environment Variables** → додай одну:
     - Name: `REACT_APP_API_URL`
     - Value: `https://diploma-backend.onrender.com/api`
       *(встав свій URL з кроку 2 + `/api` в кінці)*
4. Натисни **Deploy**. Білд ~2 хв.
5. Отримаєш URL типу `https://<nazwa-projektu>.vercel.app`. Це те, що даси викладачу.

---

## Крок 4 — Замкнути CORS (опційно, рекомендовано)

Щоб бекенд приймав запити лише з твого фронтенду:

1. Render → **diploma-backend** → **Environment** → **Add Environment Variable**:
   - Key: `FRONTEND_URL`
   - Value: твій Vercel URL (без `/api`), наприклад `https://diploma-project.vercel.app`
2. Render автоматично перезапустить сервіс (~1-2 хв).

---

## Перевірка

Відкрий Vercel URL → переходь по вкладках, генеруй задачу, розв'язуй.
Якщо фронтенд показує «Network Error» — перевір у DevTools (F12), чи звертається
до Render-URL, а не до `localhost:5001`.

---

## Подальші зміни

Після `git push` у `main`:
- **Vercel** автоматично перебілдить фронтенд (~1 хв).
- **Render** автоматично перебілдить бекенд (~3-5 хв).

Жодних ручних кроків.

---

## Якщо щось пішло не так

| Симптом | Що перевірити |
|--------|----------------|
| Білд Render падає на scipy | У dashboard перевір, що Python version = 3.12.x (вказано в `render.yaml`). |
| Фронтенд не бачить бекенд | `REACT_APP_API_URL` має закінчуватись на `/api`. Після зміни env на Vercel **обов'язково передеплой** (Vercel перезібрає бандл). |
| CORS error | Або не задай `FRONTEND_URL` зовсім (відкрито для всіх), або задай точний Vercel URL без `/` в кінці. |
| Render «спить» | Це нормально на free плані. Перший запит ~30 с. Для платного плану (~$7/міс) — без сну. |
