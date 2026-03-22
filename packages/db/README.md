# @aluf/db

В `tsconfig.json` включено **`moduleDetection: "force"`**: иначе TypeScript считает исходники **CommonJS**, а `drizzle-orm` — **ESM-only**, и сборка падает с **TS1479** (типично в Docker при `pnpm turbo run build`).

При этом **`dist/` по-прежнему CommonJS** (`"use strict"` + `require`), пакет можно подключать из Nest-сервисов без `"type": "module"`.
