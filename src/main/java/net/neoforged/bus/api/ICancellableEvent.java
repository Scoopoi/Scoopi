package net.neoforged.bus.api;

public interface ICancellableEvent {
    default void setCanceled(boolean canceled) {
        ((Event) this).canceled = canceled;
    }

    default boolean isCanceled() {
        return ((Event) this).canceled;
    }
}
