interface ToastProps {
  message: string | null;
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-ink-900 text-white px-5 py-2.5 rounded-lg shadow-soft text-sm font-medium z-50">
      {message}
    </div>
  );
}
