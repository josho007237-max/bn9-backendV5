# 🤖 Topito BN9 – Telegram Bot + Mini App Control Center

โซลูชันครบวงจรสำหรับบริหาร Telegram Bot หลายตัวภายใต้บัญชีเดียว พร้อมแดชบอร์ด React + Tailwind ที่เชื่อม Supabase และ OpenAI เพื่อขยายฟีเจอร์ AI, Auto Command และ Mini App ได้ในคลิกเดียว

## 🌟 Highlights

- **Multi-Bot Ready** – เชื่อมหลายบอทด้วยไฟล์ `.env` หรือฐานข้อมูล Supabase และสลับจัดการได้จาก UI เดียว
- **Supabase Integration** – เก็บคำสั่ง, Quick Reply, Settings และสถานะ Webhook บน Supabase (รองรับ Service Role Key)
- **OpenAI Automation** – ทดลองสร้างคำตอบอัตโนมัติจาก GPT-5 / GPT-4o / GPT-4-mini / GPT-3.5-turbo พร้อมกำหนด Persona เฉพาะแบรนด์
- **Mini App Dashboard** – React + Tailwind UI ที่ออกแบบให้รองรับ Manifest, Deep Link และ Telegram Stars ในเฟสถัดไป
- **Instant Deployment** – Dockerfiles + docker-compose สำหรับ Backend + Frontend และแนะนำ Netlify / Replit / Render
- **Security by Design** – ไม่มี Token ในซอร์สโค้ด ทุก credentials รับจาก `.env` / Secret Manager เท่านั้น

## 📁 โครงสร้างโปรเจกต์

```
TopitoBN9/
├── backend/                 # Express API, Telegram Webhook, Supabase/OpenAI services
│   ├── routes/              # REST API สำหรับแดชบอร์ด (multi-bot)
│   ├── services/            # Telegram, Supabase, OpenAI, storage adapters
│   ├── data/bot-config.json # Local fallback store (เมื่อไม่ใช้ Supabase)
│   └── Dockerfile
├── frontend/                # React + Vite + Tailwind dashboard
│   ├── src/
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── Dockerfile
│   └── nginx.conf           # Production reverse proxy
├── docker-compose.yml       # Stack ครบชุดพร้อม volume สำหรับข้อมูลบอท
├── .env.example             # ตัวอย่าง Environment Variables
└── README.md
```

## 🔐 Environment Variables

คัดลอก `.env.example` แล้วแก้ค่าที่จำเป็น

```bash
cp .env.example .env
```

### Telegram

| Key | Description |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | โทเคนบอทตัวหลัก (ทางลัดกรณีมีบอทเดียว) |
| `TELEGRAM_BOT_NAME` / `TELEGRAM_BOT_USERNAME` | ใช้แสดงชื่อบนแดชบอร์ดเมื่อใช้ค่าเริ่มต้น |
| `TELEGRAM_BOTS` | JSON array สำหรับ multi-bot เช่น `[{"id":"main","name":"Topito","token":"000:ABC"}]` |
| `TELEGRAM_DEFAULT_BOT_ID` | รหัสบอทค่าเริ่มต้นหากไม่ส่งใน webhook |

### Mini App & Webhook

| Key | Description |
| --- | --- |
| `DOMAIN` | โดเมนสำหรับสร้าง URL `https://DOMAIN/webhook/:botId` อัตโนมัติ |
| `MINIAPP_ID` | ใช้ fallback เมื่อสร้างลิงก์ Mini App อัตโนมัติ |
| `MINIAPP_URL` | ระบุ URL ของ Mini App โดยตรง (เช่น Deep Link หรือ Stars) |

### Supabase

| Key | Description |
| --- | --- |
| `SUPABASE_URL` | URL โครงการ |
| `SUPABASE_ANON_KEY` | ใช้กับฝั่ง Frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | ใช้กับ Backend สำหรับอ่าน/เขียนตารางคำสั่ง (ต้องให้สิทธิ์ Service Role) |

> Backend จะสลับไปใช้ไฟล์ `data/bot-config.json` อัตโนมัติถ้ายังไม่ตั้งค่า Supabase ทำให้ทดลองแบบ offline ได้ทันที

### OpenAI

| Key | Description |
| --- | --- |
| `OPENAI_API_KEY` | API key สำหรับ GPT |
| `OPENAI_DEFAULT_MODEL` | โมเดลเริ่มต้น (เช่น `gpt-4o-mini`) |
| `OPENAI_SUPPORTED_MODELS` | รายการโมเดลที่ให้ผู้ใช้เลือกในแดชบอร์ด |

### Frontend Runtime (Vite)

| Key | Description |
| --- | --- |
| `VITE_API_BASE` | URL ของ Backend เช่น `http://localhost:3000` หรือ `https://api.bn9.club` |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | ให้แดชบอร์ดทราบว่าสามารถเชื่อม Supabase ได้หรือไม่ |
| `VITE_OPENAI_MODEL` | โมเดลที่แสดงใน UI เช่น `gpt-4o-mini` |

## 🧠 Supabase Schema Suggestion

สร้างตารางต่อไปนี้ (หรือปรับตามระบบของคุณ):

```sql
create table bots (
  id text primary key,
  name text,
  username text,
  description text,
  token text,
  webhook_url text,
  ai_persona text,
  ai_enabled boolean default false,
  miniapp_url text,
  last_synced_at timestamp,
  updated_at timestamp default now()
);

create table bot_commands (
  id uuid primary key,
  bot_id text references bots(id) on delete cascade,
  command text,
  description text,
  response text,
  buttons jsonb default '[]',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table bot_quick_replies (
  id uuid primary key,
  bot_id text references bots(id) on delete cascade,
  title text,
  keyword text,
  response text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table bot_settings (
  bot_id text primary key references bots(id) on delete cascade,
  default_response text,
  ai_persona text,
  ai_enabled boolean default false,
  ai_model text,
  ai_temperature numeric,
  auto_keyboard boolean default false,
  auto_commands boolean default false,
  miniapp_url text,
  webhook_url text,
  updated_at timestamp default now()
);
```

> มอบสิทธิ์ Service Role ให้ Backend ใช้ `upsert`/`delete` ได้เต็มที่ ขณะที่ Frontend ใช้ Anon Key เพื่อบอกสถานะการเชื่อมต่อเท่านั้น

## 🚀 การใช้งาน (Local Dev)

> ต้องการเวอร์ชันละเอียดสำหรับการเตรียมโปรดักชัน? ดู [Deployment Playbook](./DEPLOYMENT_GUIDE.md) ที่สรุปทุกขั้นตอนแบบ Runbook

### Backend

```bash
cd TopitoBN9/backend
npm install
npm start
```

Endpoints สำคัญ:

- `POST /webhook/:botId` – รับข้อความจาก Telegram สำหรับแต่ละบอท
- `POST /webhook` – ใช้ค่า `TELEGRAM_DEFAULT_BOT_ID` เมื่อไม่ส่งพารามิเตอร์
- `GET /health` – รายงานสถานะระบบรวม (บอท, Supabase, OpenAI, Local store)
- `GET /api/bots` – รายชื่อบอท
- `GET /api/system/status` – ตรวจสอบสถานะรวม Supabase/OpenAI/Webhook
- `GET /api/bots/:botId/config` – คำสั่ง + Quick Replies + Settings
- `POST /api/bots/:botId/commands` – เพิ่ม/แก้ไข/ลบคำสั่ง
- `POST /api/bots/:botId/quick-replies` – จัดการ Quick Replies
- `PUT /api/bots/:botId/settings` – บันทึก Default Response, AI, Mini App URL, Webhook
- `POST /api/bots/:botId/test-message` – ส่งข้อความทดสอบไปยัง chat id
- `POST /api/bots/:botId/ai/preview` – ขอคำตอบตัวอย่างจาก OpenAI ตาม Persona

### Frontend

```bash
cd TopitoBN9/frontend
npm install
npm run dev
```

แดชบอร์ดจะรันที่ `http://localhost:5173` พร้อม Tailwind UI และเรียก API ผ่าน `VITE_API_BASE`

- โค้ด Frontend เป็น React + **TypeScript** (Vite) พร้อม utility `src/api.ts` ที่ช่วยจัดการ fetch/typing
- UI ถูกออกแบบให้จัดการหลายบอท, คำสั่ง, Quick Reply และการตั้งค่า AI ได้ครบจบในหน้าเดียว

## 🐳 Deploy ด้วย Docker Compose

```bash
cd TopitoBN9
cp .env.example .env  # ปรับค่าให้ครบ โดยเฉพาะ TELEGRAM_BOTS / SUPABASE / OPENAI
VITE_API_BASE=http://backend:3000 docker compose up --build
```

- Backend: `http://localhost:3000`
- Frontend (ผ่าน nginx): `http://localhost:8080`
- Volume `bot-data` เก็บไฟล์ `bot-config.json` กรณีไม่ใช้ Supabase

### Deploy แยกบริการ

**Backend**
```bash
cd backend
docker build -t topito-backend .
docker run -p 3000:3000 --env-file ../.env topito-backend
```

**Frontend**
```bash
cd frontend
docker build -t topito-frontend --build-arg VITE_API_BASE=https://api.your-domain.com .
docker run -p 8080:80 topito-frontend
```

สำหรับ Netlify/Vercel ให้ตั้ง build command = `npm run build`, publish directory = `dist`

## 🧪 การทดสอบ Webhook

```bash
curl -X POST https://your-domain.com/webhook/primary \
  -H "Content-Type: application/json" \
  -d '{"message": {"chat": {"id": 12345}, "text": "/start"}}'
```

ระบบจะดึงคำสั่งจาก Supabase (หรือไฟล์ local) แล้วตอบกลับผ่าน Telegram API ทันที

## 🔮 Phase IV – Next Upgrades

- เชื่อม **AI Generator** แบบเต็มรูปกับ Supabase เพื่อเก็บประวัติคำตอบและสถิติ
- เพิ่ม **Mini App Manifest** + Deep Link + Telegram Stars Payment
- เปิดใช้งาน **Auto Keyboard / Auto Command Generation** ผ่าน OpenAI
- รองรับ **Supabase Auth** สำหรับการจัดการหลายบัญชีในอนาคต

## 📄 License

เผยแพร่ภายใต้ MIT License – สามารถนำไปปรับใช้หรือขยายความสามารถได้อย่างอิสระ
