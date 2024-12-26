#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import cors from 'cors';
const args = process.argv.slice(2);

// import { fileURLToPath } from 'url';

import { register } from 'ts-node';
import { URL } from 'url';

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


(async () => {
  let config;
  try {
    if (tailwindConfigPath.endsWith('.ts')) {
      // Register `ts-node` to handle TypeScript files
      // register({
      //   // transpileOnly: true, // Avoid full TypeScript checks for faster execution
      //   // "esModuleInterop": true,
      //   // compilerOptions: {
      //   //   module: 'commonjs', // Convert TypeScript to CommonJS for compatibility
      //   // },
      // });

      // Import the TypeScript config dynamically
      const importedConfig = await import(tailwindConfigPath);
      config = importedConfig.default || importedConfig;
    } else if (tailwindConfigPath.endsWith('.js')) {
      // Import JavaScript config
      const importedConfig = await import(tailwindConfigPath);
      config = importedConfig.default || importedConfig;
    } else {
      throw new Error(`Unsupported config file type: ${path.extname(tailwindConfigPath)}`);
    }
  } catch (error) {
    console.error('Failed to load Tailwind config:', error);
    process.exit(1);
  }

  console.log('Loaded config:', config);

  const app = express();
  app.use(cors());
  app.use(express.json()); // Middleware to parse JSON

  const port = 7789;

  // Endpoint to get the current config
  app.get('/', (req, res) => {
    res.json({
      config,
      folderName: path.basename(process.cwd()),
    });
  });

  // Endpoint to extend the theme
  app.post('/extend-theme', (req, res) => {
    const theme = config.theme || {};
    const extend = theme.extend || {};

    const keys = ['colors', 'boxShadow', 'fontSize', 'borderRadius'];

    let newTheme = {
      ...theme,
    };

    keys.forEach((key) => {
      const newValues = req.body[key] || {};
      const oldValues = extend[key] || {};

      newTheme = {
        ...newTheme,
        [key]: {
          ...oldValues,
          ...newValues,
        },
      };
    });

    const newConfig = {
      ...config,
      theme: newTheme,
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
