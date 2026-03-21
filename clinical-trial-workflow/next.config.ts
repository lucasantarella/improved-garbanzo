import type { NextConfig } from "next";

const isGHPages = process.env.GITHUB_ACTIONS === "true";
const repoName = process.env.REPO_NAME || "workflow-tool";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGHPages ? `/${repoName}` : "",
  assetPrefix: isGHPages ? `/${repoName}/` : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
