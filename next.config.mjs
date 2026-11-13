import { withSentryConfig } from '@sentry/nextjs/config';
import withRspack from 'next-rspack';

/** @type {import('next').NextConfig} */
const nextConfig = {};

// BUNDLER=rspack builds with next-rspack. withRspack must be the inner wrapper: Sentry picks its
// webpack or Turbopack setup from process.env.TURBOPACK, which only withRspack clears.
const config = process.env.BUNDLER === 'rspack' ? withRspack(nextConfig) : nextConfig;

export default withSentryConfig(config, {
  org: 'example-org',
  project: 'example-project',
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
});
