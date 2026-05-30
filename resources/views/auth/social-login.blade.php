<div class="mt-6">
    <div class="relative flex items-center justify-center my-4">
        <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300 dark:border-gray-700"></div>
        </div>
        <div class="relative px-4 text-sm bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">
            أو
        </div>
    </div>

    <x-filament::button
        href="{{ route('login') }}"
        tag="a"
        color="gray"
        class="w-full justify-center flex items-center gap-2 border border-gray-300 dark:border-gray-700 shadow-sm rounded-lg py-2"
        style="background-color: #1a1a1a; color: white;"
    >
        <span class="flex items-center justify-center gap-2">
            <svg class="h-5 w-5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                <g transform="matrix(1, 0, 0, 1, 0, 0)">
                    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.57h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.47c0,-0.61 -0.05,-1.2 -0.16,-1.7c0,0 0,0 0,0Z" fill="#4285f4"/>
                    <path d="M12,20.7c2.43,0 4.47,-0.8 5.96,-2.18l-2.92,-2.27c-0.81,0.54 -1.85,0.87 -3.04,0.87c-2.34,0 -4.32,-1.58 -5.03,-3.7l-3.02,2.34c1.49,2.96 4.54,4.94 8.05,4.94Z" fill="#34a853"/>
                    <path d="M6.97,13.52c-0.18,-0.54 -0.28,-1.11 -0.28,-1.7c0,-0.59 0.1,-1.16 0.28,-1.7l-3.02,-2.34c-0.62,1.24 -0.97,2.64 -0.97,4.12c0,1.48 0.35,2.88 0.97,4.12l3.02,-2.5Z" fill="#fbbc05"/>
                    <path d="M12,6.8c1.32,0 2.5,0.45 3.44,1.35l2.58,-2.58c-1.57,-1.46 -3.61,-2.35 -6.02,-2.35c-3.51,0 -6.56,1.98 -8.05,4.94l3.02,2.34c0.71,-2.12 2.69,-3.7 5.03,-3.7Z" fill="#ea4335"/>
                </g>
            </svg>
            تسجيل الدخول بواسطة Google
        </span>
    </x-filament::button>
</div>
