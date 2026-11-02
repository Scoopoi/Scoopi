package net.neoforged.fml;

import java.util.concurrent.Executor;
import java.util.function.BiFunction;

import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;

/**
 * On Fabric there is only one "mod" taking part in NeoForge-style mod bus events: AE2 itself.
 */
public final class ModLoader {
    public static ModContainer AE2_CONTAINER;

    private ModLoader() {
    }

    public static <T extends Event & IModBusEvent> void postEvent(T event) {
        if (AE2_CONTAINER != null) {
            AE2_CONTAINER.getEventBus().post(event);
        }
    }

    public static <T extends Event & IModBusEvent> T postEventWithReturn(T event) {
        postEvent(event);
        return event;
    }

    public static <T extends Event & IModBusEvent> void dispatchParallelEvent(String name, Executor syncExecutor,
            Executor parallelExecutor, Runnable afterEvent,
            BiFunction<ModContainer, DeferredWorkQueue, T> eventConstructor) {
        var queue = new DeferredWorkQueue(name);
        if (AE2_CONTAINER != null) {
            AE2_CONTAINER.getEventBus().post(eventConstructor.apply(AE2_CONTAINER, queue));
        }
        queue.runTasks();
        afterEvent.run();
    }
}
