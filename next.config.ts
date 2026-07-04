import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Order photos (material/reference/sketch) travel to createOrder as
      // base64 in the action body; the Next default of 1MB rejected real
      // orders (2-3 fabric photos ≈ 1.1MB+ encoded). 4mb, not higher,
      // because Vercel hard-caps serverless request bodies at 4.5MB —
      // NewOrderWizard enforces a matching client-side ceiling with a
      // clear error before submitting.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
