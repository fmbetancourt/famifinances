import { buildCorsOrigin } from './cors-origin';

/** Invokes the predicate and returns the `allow` value it passes to the callback. */
function allow(predicate: ReturnType<typeof buildCorsOrigin>, origin: string | undefined): boolean {
  let result: boolean | undefined;
  predicate(origin, (_error, value) => {
    result = value;
  });
  return result === true;
}

describe('buildCorsOrigin (SEC-01)', () => {
  it('allows requests with no Origin (native app / server-to-server)', () => {
    const predicate = buildCorsOrigin(['https://app.example']);
    expect(allow(predicate, undefined)).toBe(true);
  });

  it('allows an allowlisted origin and denies others', () => {
    const predicate = buildCorsOrigin(['https://app.example']);
    expect(allow(predicate, 'https://app.example')).toBe(true);
    expect(allow(predicate, 'https://evil.example')).toBe(false);
  });

  it('denies all browser origins when the allowlist is empty (deny-by-default)', () => {
    const predicate = buildCorsOrigin([]);
    expect(allow(predicate, 'https://anything.example')).toBe(false);
    // A no-Origin request is still allowed (non-browser client).
    expect(allow(predicate, undefined)).toBe(true);
  });
});
