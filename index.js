#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const express = require('express');
const cors = require('cors');


let tailwindConfigPath = path.join(process.cwd(), 'tailwind.config.js');

if (!fs.existsSync(tailwindConfigPath)) {
  tailwindConfigPath = path.join(process.cwd(), 'tailwind.config.ts');
}

if (!fs.existsSync(tailwindConfigPath)) {
  throw new Error('Your tailwind.config.(js|ts) was not found. Make sure you are running this command in folder with tailwind.config.js or tailwind.config.ts');
}

console.log('tailwindConfigPath', tailwindConfigPath);

(async () => {
  let config;
  try {
    if (tailwindConfigPath.endsWith('.ts')) {
      const { register } = require('ts-node');
      register({
        compilerOptions: {
          module: 'commonjs', // Ensure compatibility with Node.js runtime
        },
      });
      // Dynamically import the TypeScript file with `ts-node` registered
      config = require(tailwindConfigPath);
    } else if (tailwindConfigPath.endsWith('.js')) {
      // Use regular Node.js `require` for JavaScript files
      config = require(tailwindConfigPath);
    } else {
      throw new Error(`Unsupported config file type: ${path.extname(tailwindConfigPath)}`);
    }
  } catch (error) {
    console.error('Failed to load Tailwind config:', error);
    process.exit(1);
  }

  console.log('config', config);

  const app = express();
  app.use(cors());

  const port = 7789;

  app.get('/', (req, res) => {
    res.json({
      config,
      folderName: process.cwd().split('/').pop(),
    });
  });

  app.post('/extend-theme', (req, res) => {
    const theme = config.theme || {};
    const extend = theme.extend || {};

    const keys = ['colors', 'boxShadow', 'fontSize', 'borderRadius'];

    let newTheme = {
      ...theme,
    };

    keys.forEach(key => {
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

    fs.writeFileSync(tailwindConfigPath, `/** @type {import('tailwindcss').Config} */
module.exports = ${JSON.stringify(newConfig, null, 2)}
    `);

    return res.json({
      config: newConfig,
      folderName: process.cwd().split('/').pop(),
    });
  });

  app.listen(port, () => {
    console.log(`You can now go back to Figma and press refresh button`);
  });
})();