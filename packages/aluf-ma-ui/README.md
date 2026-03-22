# @aluf/ma-ui

UI-кит и дизайн-система для **Aluf Mini-Apps**.

## 🚀 Преимущества перед Telegram UI

- **Быстрее** - оптимизированные компоненты с 60fps анимациями
- **Красивее** - современный дизайн с glassmorphism эффектами
- **Гибче** - полная кастомизация через CSS переменные
- **Доступнее** - встроенная a11y поддержка

## 📦 Установка

```bash
pnpm add @aluf/ma-ui
```

## 🎯 Быстрый старт

```typescript
import { AlufProvider, Button, Cell, List } from '@aluf/ma-ui';

function App() {
  return (
    <AlufProvider appId="my-app">
      <List>
        <Cell
          title="Настройки"
          subtitle="Управление приложением"
          onClick={() => console.log('click')}
        />
        <Button variant="primary" fullWidth>
          Сохранить
        </Button>
      </List>
    </AlufProvider>
  );
}
```

## 🎨 Компоненты

### Базовые
- `Button` - кнопка с вариантами primary/secondary/destructive
- `IconButton` - иконка-кнопка
- `Cell` - ячейка списка
- `List` - контейнер списка
- `Avatar` - аватар пользователя
- `Badge` - бейдж/метка

### Формы
- `Input` - поле ввода
- `Textarea` - многострочное поле
- `Switch` - переключатель
- `Checkbox` - чекбокс
- `Radio` - радио кнопка
- `Select` - выпадающий список
- `Slider` - слайдер

### Навигация
- `TabBar` - таб бар
- `NavBar` - навигационная панель
- `SegmentedControl` - сегментированный контроль

### Оверлеи
- `Modal` - модальное окно
- `Popup` - попап
- `ActionSheet` - лист действий
- `Alert` - алерт
- `Toast` - уведомление

### Контент
- `Skeleton` - скелетон загрузки
- `EmptyState` - пустое состояние
- `ErrorState` - состояние ошибки
- `Image` - изображение с lazy loading

## 🎨 Темы

Поддерживаются светлая, тёмная и системная темы:

```typescript
import { useAlufTheme } from '@aluf/ma-ui';

function ThemedComponent() {
  const { theme, isDark } = useAlufTheme();
  
  return <div className={theme}>...</div>;
}
```

## 📚 Документация

[Storybook с примерами](../../storybook/ma-ui/)

## 📄 Лицензия

Proprietary. Все права защищены.
