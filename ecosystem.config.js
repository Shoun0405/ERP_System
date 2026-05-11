module.exports = {
  apps: [{
    name:                 'erp-backend',
    script:               './backend/server.js',
    instances:            1,
    autorestart:          true,
    watch:                false,
    max_memory_restart:   '512M',
    env: {
      NODE_ENV: 'production',
      PORT:     3001,
    },
    error_file:  './logs/err.log',
    out_file:    './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
