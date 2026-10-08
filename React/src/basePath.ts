// Resolves the router basename: the publish prefix when the page is served under it, else '/'.
export const PUBLIC_BASE_PATH = '/sales-management/react';

export function resolveBasename(pathname: string = window.location.pathname): string {
  return pathname === PUBLIC_BASE_PATH || pathname.startsWith(`${PUBLIC_BASE_PATH}/`) ? PUBLIC_BASE_PATH : '/';
}

export function getPublicBasePath(pathname = window.location.pathname) {
  return pathname === PUBLIC_BASE_PATH ||
    pathname.startsWith(`${PUBLIC_BASE_PATH}/`)
    ? PUBLIC_BASE_PATH
    : '/';
}

/** URL of a file under public/, relative to the built base so it works with or without the prefix. */
export function assetUrl(path: string): string {
  const base = resolveBasename();
  return `${base === '/' ? '' : base}/${path.replace(/^\//, '')}`;
}
