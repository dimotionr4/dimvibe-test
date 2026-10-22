# DimVibe — техническая архитектура реализации

**Статус:** PROPOSED (реализационная схема); ранее утверждённые функциональные решения имеют приоритет.  
**Назначение:** единый ориентир для Codex, Claude Code или другого разработчика.  
**Не утверждено:** язык, UI-фреймворк, провайдер БД, хостинг, система аутентификации и конкретные HTTP endpoints.

## 1. Структура кодовой базы

Рекомендуется **модульный монорепозиторий**, без обязательных микросервисов:

```text
dimvibe/
  apps/
    studio/                   # одно приложение, UI по ролям Admin/Teacher
    player/                   # публичный iframe/player
  packages/
    contracts/                # versioned Exercise, CheckResult, module interfaces
    ui/                       # общие визуальные компоненты
    editor-core/              # вкладки, сохранение, Preview, Undo/Redo
    player-core/              # жизненный цикл, проверки, результаты
    gap-engine/               # текстовая разметка, стабильные ID пропусков
    modules/
      fill-blanks/            # Module Editor + Module Player + evaluate
      image-to-gaps/          # Module Editor + Module Player + evaluate
  services/                   # логические слои, не отдельные серверы
    auth/
    exercises/
    media/
    publication/
  tests/
    contracts/
    integration/
    e2e/
  docs/                      # данный комплект инструкций
```

Пакеты — логические границы; физическое разделение на workspace packages выбирается после стека. `studio` и `player` могут развёртываться совместно.

## 2. Направление зависимостей

- `contracts` не зависит от приложений, Core или модулей.
- `gap-engine` зависит только от `contracts`/чистых утилит.
- `editor-core` и `player-core` зависят от `contracts`, UI и интерфейсов реестра, **не от внутренней реализации конкретных модулей**.
- `fill-blanks` и `image-to-gaps` зависят от `contracts`, `gap-engine` и разрешённых UI-примитивов; **не импортируют друг друга**.
- `studio` собирает Editor Core и Module Editors через registry; `player` собирает Player Core и Module Players через registry.
- `services` реализуют абстракции хранилища, а не навязывают Firebase/SQL в Core.
- Проверка полномочий происходит на серверной границе для каждого чтения/записи; скрытие UI не считается авторизацией.

## 3. Контракт данных (схематично)

```ts
type Role = 'admin' | 'teacher';
type ModuleId = 'fill-blanks' | 'image-to-gaps';

type ExerciseDocument = {
  id: string;
  schemaVersion: number;
  module: ModuleId;
  version: number;
  content: unknown;
  design: unknown;
  behavior: { maxAttempts: 1 | 2 | 3 | 4 | 5 } & Record<string, unknown>;
  publication: unknown;
  moduleData: unknown;
};

type CheckItem = { id: string; score: number; maxScore: number };
type CheckResult = { items: CheckItem[] };
```

**Важно:** это иллюстрация формы, **не утверждённый TypeScript API**. Поля владельца, даты, идентификаторы версий и статусы хранения могут жить в отдельной серверной записи; не смешивать метаданные доступа с опубликованным документом без решения. `maxAttempts` по умолчанию 5. Оценивание специфично модулю; Core агрегирует баллы.

## 4. Доменные записи и жизненные циклы

- **Account:** id, role, status, login identifier. Создание Teacher только администратором; самостоятельной регистрации нет.
- **Exercise:** постоянный id, ownerId, status (active/trashed), ссылки на Draft и активную PublishedVersion.
- **Draft:** редактируемые данные; сохраняется между сеансами преподавателя. Undo/Redo — в редакторе; не откатывает публикации.
- **PublishedVersion:** неизменяемый снимок, versionId, exerciseId, media references, publishedAt. Снимки не переписываются.
- **Publication pointer:** publishedVersionId и флаг доступности. Откат меняет указатель, а не снимок.
- **MediaAsset:** id, ownerId, метаданные, storage key, состояние видимости и ссылки использования. Не удалять физический объект, пока он нужен хотя бы одной сохраняемой опубликованной версии.
- **Player run:** состояние **только в памяти**; reload или Restart начинает новый проход; 1–5 проверок, invalid не тратит попытку.

## 5. Права

| Операция | Admin | Teacher |
|---|---|---|
| Управлять пользователями, ролями, глобальными настройками | все | нет |
| Читать/менять/удалять упражнения | все | только ownerId == actorId |
| Читать/менять/удалять медиа | все | только ownerId == actorId |
| Публиковать, откатывать, снимать с публикации | все | только свои |
| Просматривать публичный опубликованный Player | без авторизации преподавателя | без авторизации преподавателя |

Публичный доступ предоставляет только опубликованные разрешённые данные и необходимые медиа. Не отдавать Draft, приватные библиотеки или секретные storage keys. Административные действия журналировать. Удаление упражнения в корзину **не снимает** публикацию. Снятие с публикации отдельно отключает Player по постоянной ссылке. Окончательное удаление — отдельная подтверждаемая административная операция с проверкой ссылок.

## 6. Контракты сервисов (операции, не HTTP-маршруты)

- `AccountService`: provisionTeacher, disableTeacher, restoreTeacher, changeRole, listAccounts.
- `ExerciseService`: create, listMine/listAllForAdmin, readDraft, saveDraft, duplicate, trash, restore.
- `MediaService`: upload, list, attach, detach, softDelete, resolvePublishedAsset, garbageCollectSafely.
- `PublicationService`: validateReady, publishImmutable, getPublishedByExerciseId, rollbackToVersion, unpublish, listVersions.

Все мутирующие операции требуют actor context и проверку роли/владения. Публикация должна быть атомарной: указатель обновляется только после успешного сохранения снимка и проверки ссылок на медиа. Конкурентные изменения черновиков обрабатывать версионированием/optimistic concurrency; точный механизм после выбора БД.

## 7. Обязательные архитектурные тесты

1. Teacher A не может читать или менять Draft, MediaAsset и публикации Teacher B ни через UI, ни напрямую через сервис.
2. Admin может управлять материалами обоих преподавателей; действия записываются в аудит.
3. Общий компонент Editor Core используется обоими модулями без копирования.
4. Каждый модуль подключается через registry, без специальных условий в Core.
5. Изменения Fill Blanks не меняют Image to Gaps и наоборот.
6. Gap Engine сохраняет ID при соседних правках; Editor не позволяет создать 11-й пропуск.
7. Invalid Check не расходует попытку; reload очищает Player run, но не Draft.
8. Публикация не меняет Draft и создаёт immutable-снимок; откат сохраняет URL.
9. Trash не отключает публичный Player; Unpublish отключает его отдельно.
10. Удалённое из библиотеки медиа продолжает открываться в опубликованных версиях, где оно используется.
11. Публичный Player не раскрывает приватные данные и не требует входа ученика.
12. Player корректно работает в iframe LearnWorlds и на узком экране.

## 8. Порядок реализации

1. Выбор стека и репозитория; CI, сборка и тестовый стенд.
2. Contracts + registry + тестовые фиктивные модули.
3. Accounts/permissions + Exercise/Draft storage.
4. Editor Core и Player Core с контрактными тестами.
5. Shared Gap Engine + Fill Blanks end-to-end.
6. Immutable Publication + iframe и rollback.
7. Media Library + Image to Gaps, без переписывания Fill Blanks.
8. UX, локализация, адаптивность, регрессии, LearnWorlds.

Этапы дробить на небольшие задачи. Техническая готовность определяется тестами, не количеством сгенерированного кода.

## 9. Вопросы, которые нельзя решать молча

- Технологический стек, поставщик auth, DB и object storage, бюджет и хостинг.
- Способ выдачи приглашения преподавателю (email-ссылка или ручная передача одноразового приглашения).
- Семантика окончательного удаления опубликованных версий и сроки хранения корзины.
- Публичный режим доступа к упражнениям: только неугадываемая ссылка или публично индексируемая страница.

До решения этих вопросов строить интерфейсы и тестовые адаптеры, не привязывать Core к одному провайдеру.
