package com.quickerp.core;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory sliding-window rate limiter. */
public final class RateLimiter {

    private final int limit;
    private final long windowMillis;
    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public RateLimiter(int limit, long windowMillis) {
        this.limit = limit;
        this.windowMillis = windowMillis;
    }

    /** Records an attempt and returns true when it is within the limit. */
    public boolean tryAcquire(String key) {
        long now = System.currentTimeMillis();
        Deque<Long> queue = hits.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (queue) {
            while (!queue.isEmpty() && now - queue.peekFirst() > windowMillis) queue.pollFirst();
            if (queue.size() >= limit) return false;
            queue.addLast(now);
        }
        if (hits.size() > 50_000) cleanup(now);
        return true;
    }

    public void reset(String key) {
        hits.remove(key);
    }

    private void cleanup(long now) {
        hits.entrySet().removeIf(entry -> {
            Deque<Long> queue = entry.getValue();
            synchronized (queue) {
                return queue.isEmpty() || now - queue.peekLast() > windowMillis;
            }
        });
    }
}
