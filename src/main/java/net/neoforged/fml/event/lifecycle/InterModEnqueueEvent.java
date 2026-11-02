package net.neoforged.fml.event.lifecycle;

import net.neoforged.fml.DeferredWorkQueue;
import net.neoforged.fml.ModContainer;

public class InterModEnqueueEvent extends ParallelDispatchEvent {
    public InterModEnqueueEvent(ModContainer container, DeferredWorkQueue workQueue) {
        super(container, workQueue);
    }
}
