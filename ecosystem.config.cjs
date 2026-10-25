const path = require('path');

module.exports = {
  apps: [
    {
      name: 'lmgallery',
      script: 'server.ts',
      interpreter: './node_modules/.bin/tsx',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      out_file: path.join(__dirname, 'logs', 'out.log'),
      error_file: path.join(__dirname, 'logs', 'error.log'),
      log_file: path.join(__dirname, 'logs', 'combined.log'),
      time: true,
    },
  ],
};
