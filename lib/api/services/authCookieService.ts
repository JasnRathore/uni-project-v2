/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

const { parseCookie } = require('cookie');
const { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } = require('./sessionService.ts');

const ACCESS_COOKIE = 'portal_access_token';
const REFRESH_COOKIE = 'portal_refresh_token';

const baseCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

const accessCookieOptions = () => ({ ...baseCookieOptions(), maxAge: ACCESS_TOKEN_TTL_SECONDS });
const refreshCookieOptions = () => ({ ...baseCookieOptions(), maxAge: REFRESH_TOKEN_TTL_SECONDS });

const readAuthCookies = (cookieHeader: unknown): { accessToken: string | null; refreshToken: string | null } => {
  let parsed: Record<string, string> = {};
  try {
    parsed = (parseCookie(typeof cookieHeader === 'string' ? cookieHeader : '') as Record<string, string>) || {};
  } catch {
    parsed = {};
  }
  return {
    accessToken: parsed[ACCESS_COOKIE] || null,
    refreshToken: parsed[REFRESH_COOKIE] || null,
  };
};

const setAuthCookies = (res: any, tokens: { accessToken: string; refreshToken: string }): void => {
  if (typeof res?.cookie !== 'function') return;
  res.cookie(ACCESS_COOKIE, tokens.accessToken, accessCookieOptions());
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions());
};

const clearAuthCookies = (res: any): void => {
  if (typeof res?.clearCookie !== 'function') return;
  res.clearCookie(ACCESS_COOKIE, baseCookieOptions());
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions());
};

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
  readAuthCookies,
  setAuthCookies,
  clearAuthCookies,
};
