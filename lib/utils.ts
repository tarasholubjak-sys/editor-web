// Utility functions shared across components

// Витягує перший H1 з markdown як заголовок
export function extractTitle(md: string): string {
  const m = md.match(/^#\s+(.+?)$/m);
  return m ? m[1].trim() : "Без назви";
}

// Безпечна копія в буфер: clipboard API падає на HTTP/non-secure context
export async function safeCopy(
  text: string,
  onSuccess: (msg: string) => void,
  okMsg: string,
  onFail?: (msg: string) => void,
): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      onSuccess(okMsg);
      return;
    }
    throw new Error("Clipboard API недоступний");
  } catch {
    // fallback через textarea
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      onSuccess(okMsg);
    } catch {
      (onFail || onSuccess)("Не вдалось скопіювати — виділи і Ctrl+C");
    }
  }
}
