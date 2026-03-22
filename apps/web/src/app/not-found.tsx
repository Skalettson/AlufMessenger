'use client';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100vh] p-4">
      <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-foreground mb-2">Страница не найдена</h2>
      <p className="text-muted-foreground mb-6">
        Страница которую вы ищете не существует или была удалена.
      </p>
      <a
        href="/"
        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        Вернуться на главную
      </a>
    </div>
  );
}
