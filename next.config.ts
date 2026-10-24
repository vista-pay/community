import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The portal talks to the Nest API only through its own route handlers, so
  // no backend origin is ever reachable from the browser and no token is
  // readable by script. See src/app/api/README.md.
  typedRoutes: true,
};

export default nextConfig;
