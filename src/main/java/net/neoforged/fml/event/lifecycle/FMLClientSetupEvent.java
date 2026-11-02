package net.neoforged.fml.event.lifecycle;

import net.neoforged.fml.DeferredWorkQueue;
import net.neoforged.fml.ModContainer;

public class FMLClientSetupEvent extends ParallelDispatchEvent {
    public FMLClientSetupEvent(ModContainer container, DeferredWorkQueue workQueue) {
        super(container, workQueue);
    }
}
