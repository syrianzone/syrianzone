export function guestAuthorizer(code: string, request: (channel: string, socket: string) => Promise<{ auth: string; channel_data: string }>, onError: (message: string) => void): (channel: string, socket: string) => Promise<{ auth?: string; channel_data?: string }> {
  return async (channel, socket) => {
    try {
      if (channel !== `presence-guesswho.${code}`) throw new Error('رفضت الغرفة طلب اتصال غير صالح.');
      return await request(channel, socket);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'تعذر توثيق الاتصال بالغرفة.');
      // The SDK maps missing auth to its documented failed-authorizer path. Rejecting here escapes its event listener.
      return {};
    }
  };
}
export function serializedLifecycle(): (task: () => Promise<void>) => Promise<void> {
  let pending = Promise.resolve();
  return task => { const next = pending.then(task); pending = next.catch(() => undefined); return next; };
}
// PORT STATUS: source app/Support/GuessWho/RoomChannel.php and native Pusher authorizer boundary; confidence high; todos 0.
