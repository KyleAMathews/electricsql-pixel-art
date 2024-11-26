/// <reference path="./.sst/platform/config.d.ts" />

import { execSync } from "child_process";
import { createExampleDbAndAddtoElectric } from "./infra/create-db-and-add-to-electric";

export default $config({
  app(input) {
    return {
      name: "electric-game",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: { neon: "0.6.3" },
    };
  },
  async run() {
    try {
      const { electricInfo, databaseUri } = createExampleDbAndAddtoElectric({
        name: `electric-game`,
      });

      databaseUri.properties.url.apply(applyMigrations);

      const electricUrlLink = new sst.Linkable("ElectricUrl", {
        properties: {
          url: process.env.ELECTRIC_URL
        },
      });

      // Add Cloudflare Worker
      const worker = new sst.cloudflare.Worker("electric-game-api", {
        handler: "./server/index.ts",
        url: true,
        link: [databaseUri, electricInfo, electricUrlLink],
      });

      const website = deploySite(electricInfo, worker);

      return {
        databaseUri: databaseUri.properties.url,
        ...electricInfo.properties,
        website: website.url,
        api: worker.url,
      };
    } catch (e) {
      console.error(`Failed to deploy electric-game stack`, e);
    }
  },
});

function applyMigrations(uri: string) {
  console.log(`apply migrations to `, uri)
  execSync(`npx pg-migrations apply --directory ./migrations`, {
    env: {
      ...process.env,
      DATABASE_URL: uri,
    },
  });
}

function deploySite(
  electricInfo: sst.Linkable<{ database_id: string; token: string }>,
  worker: sst.cloudflare.Worker,
) {
  return new sst.aws.StaticSite("game-app", {
    domain: {
      name: `something-something-not-yet-named${$app.stage === `production` ? `` : `-stage-${$app.stage}`}.electric-sql.com`,
      dns: sst.cloudflare.dns(),
    },
    dev: {
      url: `http://localhost:5173`,
    },
    environment: {
      VITE_ELECTRIC_TOKEN: electricInfo.properties.token,
      VITE_DATABASE_ID: electricInfo.properties.database_id,
      VITE_ELECTRIC_URL: process.env.ELECTRIC_URL,
      VITE_API_URL: worker.url as unknown as string,
    },
  });
}
