package net.neoforged.fml;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

public class DeferredWorkQueue {
    private final String name;
    private final List<Runnable> tasks = new ArrayList<>();

    public DeferredWorkQueue(String name) {
        this.name = name;
    }

    public CompletableFuture<Void> enqueueWork(Runnable work) {
        var f = new CompletableFuture<Void>();
        tasks.add(() -> {
            try {
                work.run();
                f.complete(null);
            } catch (Throwable t) {
                f.completeExceptionally(t);
            }
        });
        return f;
    }

    public <T> CompletableFuture<T> enqueueWork(Supplier<T> work) {
        var f = new CompletableFuture<T>();
        tasks.add(() -> {
            try {
                f.complete(work.get());
            } catch (Throwable t) {
                f.completeExceptionally(t);
            }
        });
        return f;
    }

    public void runTasks() {
        var copy = new ArrayList<>(tasks);
        tasks.clear();
        copy.forEach(Runnable::run);
    }
}
