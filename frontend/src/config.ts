import React from "react";

export type MapSource = {
  type: "vector";
  tiles: string[];
  minzoom: number;
  maxzoom: number;
};

export interface Config {
  apiUrl: string;
  mapHome: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  obsMapSource?: MapSource;
  imprintUrl?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  banner?: {
    text: string;
    style?: "warning" | "info";
  };
}

async function loadConfig(): Promise<Config> {
  const response = await fetch(__webpack_public_path__ + "config.json");
  const config = await response.json();
  return config;
}

let _configPromise: Promise<Config> = loadConfig();
let _configCache: null | Config = null;

export function useConfig() {
  const [config, setConfig] = React.useState<Config>(_configCache);
  React.useEffect(() => {
    if (!_configCache) {
      _configPromise.then(setConfig);
    }
  }, []);
  return config;
}

export default _configPromise;
