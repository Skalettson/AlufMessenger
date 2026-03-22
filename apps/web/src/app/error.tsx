'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100vh] p-4">
      <h1 className="text-6xl font-bold text-foreground mb-4">500</h1>
      <h2 className="text-2xl font-semibold text-foreground mb-2">Произошла ошибка</h2>
      <p className="text-muted-foreground mb-6">
        {error.message || 'Что-то пошло не так'}
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        Попробовать снова
      </button>
    </div>
  );
}
