#!/usr/bin/env node
const fs = require("fs")
const path = require("path")
const express = require('express')
const process = require("process")
var cors = require('cors')


const tailwindConfig = path.join(process.cwd(), 'tailwind.config.js');

if (!fs.existsSync(tailwindConfig)) {
  throw new Error('Your tailwind.config.js was not found')
}

const config = require(tailwindConfig);

const app = express()

app.use(cors())

const port = 7789

app.get('/', (req, res) => {
  res.json({
    config,
    folderName: process.cwd().split('/').pop(),
  })
})

app.post('/extend-theme', (req, res) => {

  const theme = config.theme || {}
  const extend = theme.extend || {}

  const keys = ['colors', 'boxShadow', 'fontSize', 'borderRadius']

  let newTheme = {
    ...theme,
  }

  keys.forEach(key => {
    const newValues = req.body[key] || {}
    const oldValues = extend[key] || {}

    newTheme = {
      ...newTheme,
      [key]: {
        ...oldValues,
        ...newValues
      }
    }
  })

  const newConfig = {
    ...config,
    theme: newTheme
  }

  fs.writeFileSync(tailwindConfig, `/** @type {import('tailwindcss').Config} */
module.exports = ${JSON.stringify(newConfig, null, 2)}
  `);

  return res.json({
    config: newConfig,
    folderName: process.cwd().split('/').pop(),
  });

})

app.listen(port, () => {
  console.log(`You can now go back to Figma and press refresh button`)
})
