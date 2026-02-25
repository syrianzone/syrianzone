module.exports = {
    apps: [
        {
            name: 'syrianzone-frontend',
            cwd: './frontend',
            script: 'npm',
            args: 'run start',
            env: {
                NODE_ENV: 'production',
                PORT: 3002,
            },
            exec_mode: 'fork',
            instances: 1,
            autorestart: true,
            watch: false,
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
