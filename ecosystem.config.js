module.exports = {
    apps: [
        {
            name: 'syrianzone-frontend',
            cwd: '.', // pm2 is started from frontend directory
            script: 'npm',
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
    ],
};
