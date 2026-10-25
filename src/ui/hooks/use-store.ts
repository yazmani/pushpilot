import { useEffect, useState } from 'react';
import * as store from '@/core/storage/store';
import type { Key, Schema } from '@/core/storage/store';

/** Live view of storage keys; re-renders whenever the background writes them. */
export function useStore<K extends Key>(keys: K[]): Pick<Schema, K> & { ready: boolean } {
  const keyList = keys.join(',');
  const [state, setState] = useState<Pick<Schema, K> & { ready: boolean }>(() => {
    const init = { ready: false } as Pick<Schema, K> & { ready: boolean };
    for (const k of keys) (init as Record<string, unknown>)[k] = store.defaults[k];
    return init;
  });

  useEffect(() => {
    let alive = true;
    const ks = keyList.split(',') as K[];
    void store.getMany(ks).then((values) => alive && setState({ ...values, ready: true }));
    const off = store.onChange((changes) => {
      const relevant = ks.filter((k) => k in changes);
      if (!relevant.length) return;
      setState((prev) => {
        const next = { ...prev };
        for (const k of relevant) {
          (next as Record<string, unknown>)[k] =
            k === 'settings' ? { ...store.defaultSettings, ...(changes.settings as object) } : changes[k];
        }
        return next;
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, [keyList]);

  return state;
}
