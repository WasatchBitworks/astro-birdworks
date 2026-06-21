import type { APIRoute } from "astro";
import { API_BASE } from "../lib/api";

// CMS base is the birds API path; trim to get the root CMS URL.
// e.g. https://cms.wasatchbitworks.com/api/birds → https://cms.wasatchbitworks.com
const CMS_ROOT = API_BASE.replace(/\/api\/birds$/, "");

// Site slug for SEO settings — wasatch-birdworks (the birds site),
// not wasatch-bitworks (the agency site).
const SEO_ENDPOINT = `${CMS_ROOT}/api/seo/wasatch-birdworks/robots.txt`;

export const GET: APIRoute = async () => {
  let body: string;

  try {
    const res = await fetch(SEO_ENDPOINT, {
      headers: { "User-Agent": "BirdWorks-Astro-Site/1.0" },
    });

    if (res.ok) {
      // CMS generates the Allow/Disallow line from the robots directive.
      // Replace its sitemap line with the correct Astro-generated path.
      const cms = await res.text();
      body = cms.replace(
        /^Sitemap:.*$/m,
        `Sitemap: https://wasatchbirdworks.com/sitemap-index.xml`
      );
    } else {
      // Fallback if CMS is unreachable at build time
      body = "User-agent: *\nAllow: /\nSitemap: https://wasatchbirdworks.com/sitemap-index.xml\n";
    }
  } catch {
    body = "User-agent: *\nAllow: /\nSitemap: https://wasatchbirdworks.com/sitemap-index.xml\n";
  }

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
