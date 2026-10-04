function socialUrl(value: string | undefined, hosts: string[]) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
      ? url.toString() : null;
  } catch { return null; }
}

export function orderSocialLinks() {
  return {
    facebook: socialUrl(process.env.FACEBOOK_PAGE_URL, ["facebook.com", "fb.com", "m.me"]),
    instagram: socialUrl(process.env.INSTAGRAM_PROFILE_URL, ["instagram.com"]),
  };
}
