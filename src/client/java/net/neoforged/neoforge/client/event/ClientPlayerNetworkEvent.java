package net.neoforged.neoforge.client.event;

import net.neoforged.bus.api.Event;

public abstract class ClientPlayerNetworkEvent extends Event {
    public static class LoggingIn extends ClientPlayerNetworkEvent {
    }

    public static class LoggingOut extends ClientPlayerNetworkEvent {
    }
}
