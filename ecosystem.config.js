module.exports = {
    apps: [
        {
            name: 'syrianzone-backend',
            cwd: '.',
            script: 'artisan',
            args: 'serve --port=8000',
            interpreter: 'php',
            instances: 1,
            autorestart: true,
            max_memory_restart: '512M',
        },
    ],
};
