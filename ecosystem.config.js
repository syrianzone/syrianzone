module.exports = {
    apps: [
        {
            name: 'syrianzone-frontend',
            cwd: './frontend',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 3001,
            },
        },
        {
            name: 'syrianzone-backend',
            cwd: './backend',
            script: 'artisan',
            args: 'serve --port=8001',
            interpreter: 'php',
            instances: 1,
            autorestart: true,
            max_memory_restart: '512M',
        },
    ],
};
