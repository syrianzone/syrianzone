# ── S6 Overlay: laravel-scheduler longrun daemon ──────────────────────────────
RUN mkdir -p /etc/s6-overlay/s6-rc.d/laravel-scheduler/dependencies.d
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/laravel-scheduler/type
COPY docker/s6/laravel-scheduler-run /etc/s6-overlay/s6-rc.d/laravel-scheduler/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/laravel-scheduler/run
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/laravel-scheduler

# ── S6 Overlay: reverb-server longrun daemon ──────────────────────────────────
RUN mkdir -p /etc/s6-overlay/s6-rc.d/reverb-server/dependencies.d
RUN echo "longrun" > /etc/s6-overlay/s6-rc.d/reverb-server/type
COPY docker/s6/reverb-server-run /etc/s6-overlay/s6-rc.d/reverb-server/run
RUN chmod +x /etc/s6-overlay/s6-rc.d/reverb-server/run
RUN touch /etc/s6-overlay/s6-rc.d/user/contents.d/reverb-server

# Drop back to www-data for runtime security
USER www-data

EXPOSE 8080 6001
