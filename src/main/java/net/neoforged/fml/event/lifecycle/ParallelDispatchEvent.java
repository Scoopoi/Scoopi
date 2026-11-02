package net.neoforged.fml.event.lifecycle;

import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;

import net.neoforged.bus.api.Event;
import net.neoforged.fml.DeferredWorkQueue;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.event.IModBusEvent;

public abstract class ParallelDispatchEvent extends Event implements IModBusEvent {
    private final ModContainer container;
    private final DeferredWorkQueue workQueue;

    public ParallelDispatchEvent(ModContainer container, DeferredWorkQueue workQueue) {
        this.container = container;
        this.workQueue = workQueue;
    }

    public ModContainer getContainer() {
        return container;
    }

    public CompletableFuture<Void> enqueueWork(Runnable work) {
        return workQueue.enqueueWork(work);
    }

    public <T> CompletableFuture<T> enqueueWork(Supplier<T> work) {
        return workQueue.enqueueWork(work);
    }
}
