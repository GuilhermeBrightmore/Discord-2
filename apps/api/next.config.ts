import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@discord2/server-core", "@discord2/contracts"],
};
export default config;
