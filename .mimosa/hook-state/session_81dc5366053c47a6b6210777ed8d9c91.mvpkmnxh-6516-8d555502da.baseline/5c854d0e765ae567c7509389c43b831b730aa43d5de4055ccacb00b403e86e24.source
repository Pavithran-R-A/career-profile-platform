import { useEffect } from 'react';
import { applyPageMeta, type PageMeta } from './meta';

/** Keep the document head in sync while a route is mounted. */
export function usePageMeta(meta: PageMeta | null): void {
  useEffect(() => {
    if (!meta) return;
    applyPageMeta(meta);
  }, [meta]);
}

/** Private/app routes: keep a title but never index. */
export function useNoindexMeta(title: string): void {
  useEffect(() => {
    applyPageMeta({ title, noindex: true });
  }, [title]);
}
