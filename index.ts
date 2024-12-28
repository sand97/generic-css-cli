#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import cors from 'cors';
const args = process.argv.slice(2);
import { exec } from 'node:child_process';
// import { fileURLToPath } from 'url';

import { register } from 'ts-node';

register();

// Helpers to work with file paths\

// Dynamically resolve Tailwind config path
let tailwindConfigPath: string;

if (args.length > 0) {
  tailwindConfigPath = args[0];
} else {
  tailwindConfigPath = path.join(process.cwd(), 'tailwind.config.js');
  if (!fs.existsSync(tailwindConfigPath)) {
    tailwindConfigPath = path.join(process.cwd(), 'tailwind.config.ts');
  }
}

console.log('tailwindConfigPath:', tailwindConfigPath);

if (!fs.existsSync(tailwindConfigPath)) {
  throw new Error(
    'Your tailwind.config.(js|ts) was not found. Make sure you are running this command in a folder with tailwind.config.js or tailwind.config.ts'
  );
}

async function getConfig() {
  let config: any;
  try {
    // Import the TypeScript config dynamically
    const importedConfig = await import(tailwindConfigPath + '?' + Date.now());
    config = importedConfig.default || importedConfig;
  } catch (error) {
    console.error('Failed to load Tailwind config:', error);
    process.exit(1);
  }

  return config;
}

async function lintFile(file: string) {
  const folder = path.dirname(file);
  const packageJsonPath = path.join(folder, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const { devDependencies } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    let prettierExist = false,
      eslintExist = false;

    Object.values(devDependencies).forEach((value: string) => {
      if (value.includes('prettier')) {
        prettierExist = true;
      } else if (value.includes('eslint')) {
        eslintExist = true;
      }
    });

    if (!eslintExist || !prettierExist) {
      return null;
    }

    exec(`npx prettier --write ${file}`, (err) => {
      if (err) {
        console.error(err);
        return;
      }
      exec(`npx eslint --fix ${file}`, (err) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log('File was successfully linted and fixed!');
      });
    });
  }
}

(async () => {
  const app = express();
  app.use(cors());
  app.use(express.json()); // Middleware to parse JSON

  const port = 7789;

  // Endpoint to get the current config
  app.get('/', async (req, res) => {
    const config = await getConfig();
    res.json({
      config,
      folderName: path.basename(process.cwd()),
    });
  });

  // Endpoint to extend the theme
  app.post('/extend-theme', async (req, res) => {
    const config = await getConfig();
    const theme = config.theme || {};
    let extend = { ...(theme.extend || {}) };

    const keys = ['colors', 'boxShadow', 'fontSize', 'lineHeight', 'fontWeight', 'borderRadius'];

    keys.forEach((key) => {
      const newValues = req.body[key] || {};
      const oldValues = extend[key] || {};

      if (Object.keys(newValues).length) {
        extend = {
          ...extend,
          [key]: {
            ...oldValues,
            ...newValues,
          },
        };
      }
    });

    const newConfig = {
      ...config,
      theme: {
        ...theme,
        extend,
      },
    };

    const newConfigContent = `/** @type {import('tailwindcss').Config} */
export default ${JSON.stringify(newConfig, null, 2)};
    `;

    try {
      fs.writeFileSync(tailwindConfigPath, newConfigContent);
      res.json({
        config: newConfig,
        folderName: path.basename(process.cwd()),
      });
      await lintFile(tailwindConfigPath);
    } catch (error) {
      console.error('Failed to write config:', error);
      res.status(500).json({ error: 'Failed to update Tailwind config' });
    }
  });

  // Start the server
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
})();
