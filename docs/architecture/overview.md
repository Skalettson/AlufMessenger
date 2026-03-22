# Архитектура Aluf Messenger

Обзор архитектуры мессенджера Aluf: микросервисы, коммуникация, потоки данных и диаграммы.

## Содержание

- [Обзор системы](#обзор-системы)
- [Микросервисы и коммуникация](#микросервисы-и-коммуникация)
- [Поток данных: отправка сообщения](#поток-данных-отправка-сообщения)
- [Поток аутентификации](#поток-аутентификации)
- [E2EE: Signal Protocol (X3DH + Double Ratchet)](#e2ee-signal-protocol-x3dh--double-ratchet)
- [Схема базы данных](#схема-базы-данных)

---

## Обзор системы

```mermaid
flowchart TB
    subgraph Clients["Клиенты"]
        Web["Web (Next.js)"]
        Mobile["Mobile (Flutter)"]
        Desktop["Desktop (Tauri)"]
    end

    subgraph Gateway["Шлюз"]
        API["API Gateway"]
        WS["Realtime (WebSocket)"]
        Bot["Bot API"]
    end

    subgraph Services["Микросервисы"]
        Auth["Auth"]
        User["User"]
        Chat["Chat"]
        Message["Message"]
        Media["Media"]
        Notif["Notification"]
        Call["Call"]
        Search["Search"]
        Story["Story"]
    end

    subgraph Infra["Инфраструктура"]
        PG[(PostgreSQL)]
        Redis[(Redis)]
        NATS[NATS JetStream]
        MinIO[(MinIO)]
    end

    Web --> API
    Web --> WS
    Mobile --> API
    Mobile --> WS
    Desktop --> API
    Desktop --> WS

    API --> Auth
    API --> User
    API --> Chat
    API --> Message
    API --> Media
    API --> Notif
    API --> Call
    API --> Search
    API --> Story
    WS --> Auth
    WS --> Message
    WS --> Chat
    Bot --> Message
    Bot --> Chat

    Auth --> PG
    Auth --> Redis
    User --> PG
    Chat --> PG
    Chat --> NATS
    Message --> PG
    Message --> NATS
    Media --> PG
    Media --> MinIO
    Search --> NATS
    Notif --> NATS
    Call --> NATS
    Story --> PG
    Story --> Redis
```

---

## Микросервисы и коммуникация

### Синхронная связь (gRPC)

API Gateway проксирует запросы к backend-сервисам через gRPC:

```mermaid
flowchart LR
    subgraph Sync["gRPC (синхронно)"]
        GW[API Gateway]
        A[Auth]
        U[User]
        C[Chat]
        M[Message]
        Me[Media]
        N[Notification]
        Ca[Call]
        S[Search]
        St[Story]
    end

    GW -->|ValidateToken| A
    GW -->|GetUser, UpdateProfile| U
    GW -->|CreateChat, GetChat| C
    GW -->|SendMessage, GetMessages| M
    GW -->|UploadFile, GetUrl| Me
    GW -->|SendPush| N
    GW -->|SignalCall| Ca
    GW -->|Search| S
    GW -->|CreateStory| St
```

### Асинхронная связь (NATS JetStream)

События между сервисами и Realtime доставляются через NATS:

```mermaid
flowchart TB
    subgraph Publishers["Издатели"]
        MessageSvc[Message Service]
        ChatSvc[Chat Service]
        CallSvc[Call Service]
        UserSvc[User Service]
        NotifSvc[Notification Service]
    end

    subgraph NATS["NATS JetStream"]
        MS["aluf.message.sent"]
        ME["aluf.message.edited"]
        MD["aluf.message.deleted"]
        CU["aluf.chat.updated"]
        CS["aluf.call.signal"]
        UU["aluf.user.updated"]
        NO["aluf.notification"]
        MI["aluf.message.incoming"]
        MR["aluf.message.read"]
        TY["aluf.typing"]
        PR["aluf.presence"]
    end

    subgraph Subscribers["Подписчики"]
        Realtime[Realtime Service]
        SearchSvc[Search Service]
        NotifListener[Notification Listener]
        BotSvc[Bot Service]
    end

    MessageSvc --> MS
    MessageSvc --> ME
    MessageSvc --> MD
    MessageSvc --> MI
    ChatSvc --> CU
    CallSvc --> CS
    UserSvc --> UU
    NotifSvc --> NO

    MS --> Realtime
    ME --> Realtime
    MD --> Realtime
    MS --> SearchSvc
    ME --> SearchSvc
    MD --> SearchSvc
    MS --> BotSvc
    ME --> BotSvc
    CU --> SearchSvc
    UU --> SearchSvc
    MS --> NotifListener
    CS --> NotifListener
    NO --> Realtime
    MR --> Realtime
    TY --> Realtime
    PR --> Realtime
```

---

## Поток данных: отправка сообщения

```mermaid
sequenceDiagram
    participant C as Клиент
    participant GW as API Gateway
    participant Auth as Auth Service
    participant MSG as Message Service
    participant NATS as NATS
    participant RT as Realtime Service
    participant WS as WebSocket

    C->>GW: POST /v1/messages (JWT)
    GW->>Auth: ValidateToken (gRPC)
    Auth-->>GW: userId

    GW->>MSG: SendMessage (gRPC)
    MSG->>MSG: Сохранение в БД
    MSG->>NATS: aluf.message.sent

    par Delivery
        NATS->>RT: aluf.message.sent
        RT->>WS: message.new
        WS->>C: Push к подписчикам чата
    end

    MSG-->>GW: Message
    GW-->>C: 201 Created
```

---

## Поток аутентификации

```mermaid
sequenceDiagram
    participant C as Клиент
    participant GW as API Gateway
    participant Auth as Auth Service
    participant Redis as Redis
    participant PG as PostgreSQL

    Note over C,PG: Регистрация / Вход
    C->>GW: POST /v1/auth/login (phone/email)
    GW->>Auth: RequestOTP (gRPC)
    Auth->>Auth: Генерация OTP
    Auth->>Redis: OTP (TTL 5 мин)
    Auth-->>GW: success
    GW-->>C: OTP отправлен

    C->>GW: POST /v1/auth/verify (OTP)
    GW->>Auth: VerifyOTP (gRPC)
    Auth->>Redis: Проверка OTP
    Auth->>PG: Создание/получение User
    Auth->>Auth: JWT (RS256, 15 мин)
    Auth->>Auth: Refresh Token (30 дней)
    Auth->>PG: Сохранение сессии
    Auth-->>GW: accessToken, refreshToken
    GW-->>C: tokens

    Note over C,PG: Защищённый запрос
    C->>GW: GET /v1/users/me (Authorization: Bearer)
    GW->>Auth: ValidateToken (gRPC)
    Auth->>Auth: Проверка подписи JWT
    Auth-->>GW: userId, alufId
    GW->>GW: Проксирование к User Service
```

---

## E2EE: Signal Protocol (X3DH + Double Ratchet)

Секретные чаты используют Aluf Protocol на базе Signal Protocol в пакете `@aluf/crypto`.

### X3DH — установка сессии

```mermaid
sequenceDiagram
    participant A as Alice (отправитель)
    participant Server as Сервер
    participant B as Bob (получатель)

    Note over B: Bob публикует PreKeyBundle:<br/>identityKey, signedPreKey, oneTimePreKey
    B->>Server: Загрузка bundle

    A->>Server: Получить bundle Bob
    Server-->>A: PreKeyBundle

    Note over A: performX3DH()
    A->>A: DH(identity_A, signedPreKey_B)
    A->>A: DH(ephemeral, identity_B)
    A->>A: DH(ephemeral, signedPreKey_B)
    A->>A: DH(ephemeral, oneTimePreKey_B)
    A->>A: sharedSecret = HKDF(...)
    A->>A: initSenderRatchet(sharedSecret)
    A->>Server: Initial message (ephemeral_pk, ciphertext)
```

### Double Ratchet — обмен сообщениями

```mermaid
flowchart TB
    subgraph Sender["Отправитель"]
        SK1[Send Ratchet Key]
        CK1[Chain Key]
        MK1[Message Key]
        E1[Encrypt]
    end

    subgraph Receiver["Получатель"]
        SK2[Receive Ratchet Key]
        CK2[Chain Key]
        MK2[Message Key]
        D2[Decrypt]
    end

    E1 -->|Header + Ciphertext| Receiver
    Sender -->|DH Step| CK1
    CK1 --> HKDF1[HKDF]
    HKDF1 --> MK1
    HKDF1 --> CK1
    MK1 --> E1

    Receiver --> MK2
    MK2 --> D2
    D2 --> CK2
    CK2 --> HKDF2[HKDF]
    HKDF2 --> CK2
```

### Компоненты E2EE

| Компонент   | Описание                                      |
|-------------|-----------------------------------------------|
| **X3DH**    | Аутентифицированный обмен ключами при первом контакте |
| **Double Ratchet** | Симметричное шифрование с forward secrecy |
| **HKDF**    | Derive ключей из общего секрета               |
| **Curve25519** | ECDH через TweetNaCl (nacl.scalarMult)     |
| **Хранение ключей** | `encryption_keys` в БД (identity, signed prekeys) |

---

## Схема базы данных

```mermaid
erDiagram
    users ||--o{ sessions : has
    users ||--o{ contacts : has
    users ||--o{ notification_tokens : has
    users ||--o{ encryption_keys : has

    chats ||--o{ chat_members : has
    chats ||--o{ messages : has
    chats ||--o{ invite_links : has
    users ||--o{ chat_members : "member of"
    chats }o--|| users : "created by"

    messages ||--o{ message_status : has
    messages ||--o{ reactions : has
    users ||--o{ messages : "sends"

    users ||--o{ stories : has
    stories ||--o{ story_views : has

    calls ||--o{ call_participants : has
    users ||--o{ call_participants : "participates"

    users ||--o{ chat_folders : has

    users {
        uuid id PK
        string aluf_id
        string username
        string display_name
    }

    chats {
        uuid id PK
        string type
        uuid created_by
    }

    messages {
        uuid id PK
        uuid chat_id FK
        uuid sender_id FK
        text content
        timestamp created_at
    }

    sessions {
        uuid id PK
        uuid user_id FK
        string token_hash
    }
```

### Основные таблицы

| Таблица               | Назначение                          |
|-----------------------|-------------------------------------|
| `users`               | Пользователи, профили               |
| `sessions`            | Сессии (refresh tokens)            |
| `chats`               | Чаты (личные, группы, каналы)       |
| `chat_members`        | Участники чатов                     |
| `messages`            | Сообщения                           |
| `message_status`      | Доставка / прочтение                |
| `encryption_keys`     | E2EE ключи (prekeys)                |
| `stories`             | Истории (24ч)                       |
| `calls`               | Звонки (WebRTC)                     |
| `notification_tokens` | Push-токены (FCM, APNs)              |
