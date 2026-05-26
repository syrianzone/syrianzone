module.exports = {
    apps: [
        {
            name: 'syrianzone-frontend',
            cwd: './frontend',
            script: 'node_modules/.bin/next',
            args: 'start -p 3002',
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
            },
            instances: 1,
            autorestart: true,
            max_memory_restart: '1G',
        },
        {
            name: 'syrianzone-backend',
            cwd: './backend',
            script: 'artisan',
            args: 'serve --port=8000',
            interpreter: 'php',
            instances: 1,
            autorestart: true,
            max_memory_restart: '512M',
        },
    ],
};
