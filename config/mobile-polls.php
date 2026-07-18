<?php

return [
    'max_ballots_per_network_per_day' => (int) env('MOBILE_POLL_MAX_BALLOTS_PER_NETWORK_PER_DAY', 5),
    'private_data_retention_days' => (int) env('MOBILE_POLL_PRIVATE_DATA_RETENTION_DAYS', 30),
];
