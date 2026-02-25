module.exports = {
    apps: [
        {
            name: 'syrianzone-frontend',
            cwd: './frontend',
            script: 'npm',
            args: 'start',
            env: {
                NODE_ENV: 'production',
                PORT: 3002,
            },
            instances: 1,
            autorestart: true,
            max_memory_restart: '1G',
        },
        {
            name: 'syrianzone-backend',
            cwd: './backend',
            script: 'artisan',
            args: 'serve --port=8002',
            interpreter: 'php',
            instances: 1,
            autorestart: true,
            max_memory_restart: '512M',
        },
    ],
};
