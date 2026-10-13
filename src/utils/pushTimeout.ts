/** Bound bridge/network work even when the underlying SDK ignores cancellation. */
export function withPushTimeout<T>(work: Promise<T>, ms = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Push setup timed out. Check your connection and try again.')), ms);
    work.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
